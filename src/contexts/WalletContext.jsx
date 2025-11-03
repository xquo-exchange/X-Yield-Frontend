import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { initWalletConnect, clearWalletConnectCache } from '../utils/walletconnectProvider';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [walletType] = useState('walletconnect');
  const wcProviderRef = useRef(null);
  const lastChainIdRef = useRef(null);
  const chainChangeTimeoutRef = useRef(null);
  const listenersSetupRef = useRef(false);
  const accountsChangedHandlerRef = useRef(null);
  const chainChangedHandlerRef = useRef(null);
  const disconnectHandlerRef = useRef(null);
  const pendingTargetChainRef = useRef(null);

  // Version check and auto-reconnect on mount
  useEffect(() => {
    // Check app version and clear cache if needed
    const APP_VERSION = '1.0.0';
    const storedVersion = localStorage.getItem('appVersion');
    
    if (storedVersion !== APP_VERSION) {
      console.log('🔄 New version detected, clearing cache...');
      localStorage.clear();
      clearWalletConnectCache();
      localStorage.setItem('appVersion', APP_VERSION);
    }
    
    const autoConnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected');
      if (wasConnected === 'true') {
        try {
          console.log('🔄 Auto-reconnecting wallet...');
          // Only auto-reconnect if we're not already connected
          // This prevents re-opening the modal after a successful connection
          if (!isConnected) {
            await connectWallet();
          } else {
            console.log('✅ Already connected, skipping auto-reconnect');
          }
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
          localStorage.removeItem('walletConnected');
        }
      }
    };

    autoConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, not on connectWallet changes

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      if (wcProviderRef.current && typeof wcProviderRef.current.removeAllListeners === 'function') {
        wcProviderRef.current.removeAllListeners();
      }
    };
  }, []);

  // Connect wallet via WalletConnect
  const connectWallet = useCallback(async () => {
    // Prevent duplicate connects and second QR modals
    if (connecting) {
      return { success: false, error: 'ALREADY_CONNECTING', message: 'Already connecting...' };
    }
    if (isConnected && wcProviderRef.current && wcProviderRef.current.connected) {
      return { success: true, address: walletAddress, chainId };
    }

    setConnecting(true);
    try {
      console.log('🔗 Initializing WalletConnect for Base...');
      // If we already have a provider and it's connected, reuse it
      if (wcProviderRef.current && wcProviderRef.current.connected) {
        console.log('🔗 Reusing existing WalletConnect session');
      }
      const wcProvider = wcProviderRef.current && wcProviderRef.current.connected
        ? wcProviderRef.current
        : await initWalletConnect();
      wcProviderRef.current = wcProvider;

      // CRITICAL: Set up chainChanged handler FIRST to block Ethereum events
      // This must happen BEFORE we check the chain or switch
      chainChangedHandlerRef.current = async (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        
        // CRITICAL: If we're actively switching to Base, aggressively ignore Ethereum (1) events
        // This prevents stale Ethereum events from overriding our Base switch
        if (pendingTargetChainRef.current === 8453 && newChainId === 1) {
          console.log('⏭️ Ignoring Ethereum chain event during Base switch (stale event)');
          return; // Completely ignore Ethereum events while switching to Base
        }
        
        // If we're in a pending switch and this event isn't the target, ignore it
        if (pendingTargetChainRef.current && newChainId !== pendingTargetChainRef.current) {
          console.log('⏭️ Ignoring non-target chain change during switch:', newChainId, '(waiting for', pendingTargetChainRef.current, ')');
          return;
        }
        
        // If it matches the pending target, clear the pending flag
        if (pendingTargetChainRef.current === newChainId) {
          console.log('✅ Chain change matches target, clearing pending flag');
          pendingTargetChainRef.current = null;
          setSwitchingNetwork(false);
        }
        
        // Immediate check: if we already processed this chain, silently return
        if (lastChainIdRef.current === newChainId) {
          return; // Silent skip - duplicate event
        }
        
        // Mark as processing immediately to prevent concurrent handlers
        const previousChainId = lastChainIdRef.current;
        lastChainIdRef.current = newChainId;
        
        // If there's already a pending timeout for a different chain, clear it
        if (chainChangeTimeoutRef.current) {
          clearTimeout(chainChangeTimeoutRef.current);
          chainChangeTimeoutRef.current = null;
        }
        
        // Debounce chain change to prevent multiple rapid fires
        chainChangeTimeoutRef.current = setTimeout(async () => {
          if (lastChainIdRef.current !== newChainId) {
            console.log('⏭️ Chain changed again before processing, skipping:', newChainId);
            return;
          }
          
          console.log('🔄 Chain changed:', chainIdHex, '→', newChainId);
          setChainId(newChainId);
          
          // Recreate ethers provider when chain changes
          try {
            const newEthersProvider = new ethers.providers.Web3Provider(wcProvider);
            setProvider(newEthersProvider);
            console.log('✅ Chain updated to:', newChainId, '- Provider recreated');
          } catch (error) {
            console.error('Error recreating provider on chain change:', error);
            lastChainIdRef.current = previousChainId;
          }
          
          chainChangeTimeoutRef.current = null;
        }, 100);
      };
      
      // Register chainChanged handler IMMEDIATELY to block Ethereum events
      wcProvider.on('chainChanged', chainChangedHandlerRef.current);
      
      // CRITICAL: Switch to Base IMMEDIATELY after connection, BEFORE creating ethers provider
      // This prevents Ethereum from ever being seen by the user
      // Set pending flag IMMEDIATELY to block all Ethereum events
      pendingTargetChainRef.current = 8453;
      lastChainIdRef.current = 8453; // Set optimistically to Base
      setSwitchingNetwork(true);
      
      try {
        // Get current chain from WalletConnect provider directly (faster than ethers)
        const currentChainId = await wcProvider.request({ method: 'eth_chainId' });
        const currentChainIdNum = parseInt(currentChainId, 16);
        
        console.log(`🔍 Initial chain detected: ${currentChainIdNum}`);
        
        if (currentChainIdNum !== 8453) {
          console.log('🔄 Switching to Base BEFORE creating ethers provider...');
          // Switch to Base IMMEDIATELY - don't wait
          await wcProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // Base mainnet (8453 in hex)
          });
          console.log('✅ Switched to Base - waiting for confirmation...');
          
          // Wait for chain to actually switch (with timeout)
          let retries = 5;
          while (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
            const newChainId = await wcProvider.request({ method: 'eth_chainId' });
            const newChainIdNum = parseInt(newChainId, 16);
            if (newChainIdNum === 8453) {
              console.log('✅ Confirmed on Base network');
              break;
            }
            retries--;
            console.log(`⏳ Waiting for Base switch... (${retries} retries left)`);
          }
        } else {
          console.log('✅ Already on Base network');
        }
      } catch (switchError) {
        // If chain not added, try to add it
        if (switchError.code === 4902) {
          console.log('➕ Base network not found, adding it...');
          await wcProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://base.llamarpc.com'],
              blockExplorerUrls: ['https://basescan.org']
            }]
          });
          // Wait for network to be added
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.warn('⚠️ Network switch error:', switchError);
          // Continue anyway - will show warning but still connect
        }
      }

      // NOW create ethers provider AFTER we've switched to Base
      // This ensures ethers provider is created with Base network
      const ethersProvider = new ethers.providers.Web3Provider(wcProvider);
      const signer = ethersProvider.getSigner();
      const address = await signer.getAddress();
      const network = await ethersProvider.getNetwork();
      
      // Verify we're on Base
      if (network.chainId !== 8453) {
        console.warn(`⚠️ Still not on Base after switch (${network.chainId}), but continuing...`);
      }

      // Remove old listeners if they exist (prevents duplicates)
      // Only remove if it's the same provider instance
      if (listenersSetupRef.current && wcProviderRef.current === wcProvider) {
        const removeListener = (event, handler) => {
          if (handler && wcProvider) {
            // Try .off() first (EIP-1193 style)
            if (typeof wcProvider.off === 'function') {
              wcProvider.off(event, handler);
            }
            // Try .removeListener() (Node.js EventEmitter style)
            else if (typeof wcProvider.removeListener === 'function') {
              wcProvider.removeListener(event, handler);
            }
          }
        };
        
        removeListener('accountsChanged', accountsChangedHandlerRef.current);
        removeListener('chainChanged', chainChangedHandlerRef.current);
        removeListener('disconnect', disconnectHandlerRef.current);
        console.log('🧹 Removed old event listeners');
      }

      // Create new listener functions
      accountsChangedHandlerRef.current = (accounts) => {
        console.log('🔄 Accounts changed:', accounts);
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
        } else {
          handleDisconnect();
        }
      };

      // chainChanged handler is set up above, before the switch

      disconnectHandlerRef.current = () => {
        console.log('🔌 WalletConnect disconnected');
        handleDisconnect();
      };

      // Set up remaining event listeners (chainChanged already set up above)
      wcProvider.on('accountsChanged', accountsChangedHandlerRef.current);
      // chainChanged already registered above to block Ethereum events early
      wcProvider.on('disconnect', disconnectHandlerRef.current);
      
      listenersSetupRef.current = true;
      console.log('✅ Event listeners set up');

      // Update state with Base network - we already switched above
      // User never sees Ethereum because we switched BEFORE creating ethers provider
      setWalletAddress(address);
      setIsConnected(true);
      setProvider(ethersProvider);
      setChainId(8453); // Always set to Base - we switched above
      lastChainIdRef.current = 8453;
      pendingTargetChainRef.current = null;
      setSwitchingNetwork(false);
      console.log('✅ Connected directly to Base (8453) - Ethereum never shown');
      
      localStorage.setItem('walletConnected', 'true');
      setConnecting(false);
      console.log('✅ Wallet connected:', address);
      
      return {
        success: true,
        address,
        chainId: lastChainIdRef.current || 8453, // Return actual chainId (should be Base now)
      };
    } catch (error) {
      setConnecting(false);
      console.error('❌ WalletConnect error:', error);

      if (error.message?.includes('User rejected') || error.message?.includes('User closed modal')) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Connection declined. You can retry anytime.',
        };
      }

      return {
        success: false,
        error: 'CONNECTION_FAILED',
        message: 'Failed to connect wallet. Please try again.',
      };
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      if (wcProviderRef.current) {
        await wcProviderRef.current.disconnect();
      }
      handleDisconnect();
      return {
        success: true,
        message: 'Wallet disconnected successfully.',
      };
    } catch (error) {
      console.error('Disconnect error:', error);
      handleDisconnect();
      return {
        success: true,
        message: 'Wallet disconnected.',
      };
    }
  }, []);

  // Helper to clear state on disconnect
  const handleDisconnect = () => {
    setWalletAddress(null);
    setIsConnected(false);
    setChainId(null);
    setProvider(null);
    lastChainIdRef.current = null;
    pendingTargetChainRef.current = null; // Clear pending chain switch
    setSwitchingNetwork(false);
    listenersSetupRef.current = false;
    
    if (chainChangeTimeoutRef.current) {
      clearTimeout(chainChangeTimeoutRef.current);
      chainChangeTimeoutRef.current = null;
    }
    
    // Remove specific listeners
    if (wcProviderRef.current) {
      const provider = wcProviderRef.current;
      const removeListener = (event, handler) => {
        if (handler) {
          // Try .off() first (EIP-1193 style)
          if (typeof provider.off === 'function') {
            provider.off(event, handler);
          }
          // Try .removeListener() (Node.js EventEmitter style)
          else if (typeof provider.removeListener === 'function') {
            provider.removeListener(event, handler);
          }
        }
      };
      
      removeListener('accountsChanged', accountsChangedHandlerRef.current);
      removeListener('chainChanged', chainChangedHandlerRef.current);
      removeListener('disconnect', disconnectHandlerRef.current);
      
      // Fallback: remove all listeners if specific removal doesn't work
      if (typeof provider.removeAllListeners === 'function') {
        provider.removeAllListeners();
      }
      wcProviderRef.current = null;
    }
    
    // Clear handler refs
    accountsChangedHandlerRef.current = null;
    chainChangedHandlerRef.current = null;
    disconnectHandlerRef.current = null;
    
    localStorage.removeItem('walletConnected');
    clearWalletConnectCache();
  };

  // Switch to Base mainnet
  const switchToBase = useCallback(async () => {
    if (!wcProviderRef.current) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      await wcProviderRef.current.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base mainnet (8453 in hex)
      });
      return { success: true };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Network switch declined.',
        };
      }

      // If chain not added, try to add it
      if (error.code === 4902) {
        try {
          await wcProviderRef.current.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://base.llamarpc.com'],
              blockExplorerUrls: ['https://basescan.org']
            }]
          });
          return { success: true };
        } catch (addError) {
          return {
            success: false,
            error: 'CHAIN_ADD_FAILED',
            message: 'Failed to add Base network.',
          };
        }
      }

      return {
        success: false,
        error: 'CHAIN_NOT_SUPPORTED',
        message: 'Please switch to Base network.',
      };
    }
  }, []);

  // Check balance
  const checkBalance = useCallback(async (tokenAddress, requiredAmount) => {
    if (!provider || !isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        signer
      );

      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      const required = ethers.utils.parseUnits(requiredAmount.toString(), decimals);

      if (balance.lt(required)) {
        return {
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient balance for amount and/or gas. Adjust the amount or top up your wallet.',
        };
      }

      return {
        success: true,
        balance: ethers.utils.formatUnits(balance, decimals),
      };
    } catch (error) {
      console.error('Balance check failed:', error);
      return {
        success: false,
        error: 'BALANCE_CHECK_FAILED',
        message: 'Failed to check balance.',
      };
    }
  }, [provider, isConnected, walletAddress]);

  // Approve transaction
  const approveTransaction = useCallback(async (tokenAddress, spenderAddress, amount) => {
    if (!provider || !isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );

      const tx = await tokenContract.approve(spenderAddress, amount);
      await tx.wait();

      return { success: true };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Signature declined. You can retry anytime.',
        };
      }

      return {
        success: false,
        error: 'APPROVAL_FAILED',
        message: 'Approval failed. Please try again.',
      };
    }
  }, [provider, isConnected]);

  // Expose WalletConnect provider
  const getWalletConnectProvider = useCallback(() => {
    return wcProviderRef.current;
  }, []);

  const value = {
    walletAddress,
    isConnected,
    connecting,
    provider,
    chainId,
    switchingNetwork,
    walletType,
    connectWallet,
    disconnectWallet,
    switchToBase,
    checkBalance,
    approveTransaction,
    getWalletConnectProvider,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

