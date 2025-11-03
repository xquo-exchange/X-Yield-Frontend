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
      // Only auto-reconnect if explicitly marked as connected
      // This prevents stale connections from persisting
      const wasConnected = localStorage.getItem('walletConnected');
      if (wasConnected === 'true') {
        try {
          console.log('🔄 Auto-reconnecting wallet...');
          // Clear everything first to ensure fresh connection
          clearWalletConnectCache();
          await connectWallet();
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
          // Clear on failure to prevent retry loops
          localStorage.removeItem('walletConnected');
          clearWalletConnectCache();
        }
      } else {
        // Make sure cache is clear if not auto-connecting
        clearWalletConnectCache();
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

    setConnecting(true);
    
    // 🧹 CLEAR EVERYTHING FOR FRESH START - Reset state completely
    console.log('🧹 Clearing all wallet state for fresh connection...');
    
    // Clear all state first
    setWalletAddress(null);
    setIsConnected(false);
    setChainId(null);
    setProvider(null);
    setSwitchingNetwork(false);
    
    // Clear all refs
    lastChainIdRef.current = null;
    pendingTargetChainRef.current = null;
    listenersSetupRef.current = false;
    
    // Clear timeout if exists
    if (chainChangeTimeoutRef.current) {
      clearTimeout(chainChangeTimeoutRef.current);
      chainChangeTimeoutRef.current = null;
    }
    
    // Remove old event listeners if provider exists
    if (wcProviderRef.current) {
      try {
        const provider = wcProviderRef.current;
        const removeListener = (event, handler) => {
          if (handler) {
            if (typeof provider.off === 'function') {
              provider.off(event, handler);
            } else if (typeof provider.removeListener === 'function') {
              provider.removeListener(event, handler);
            }
          }
        };
        
        removeListener('accountsChanged', accountsChangedHandlerRef.current);
        removeListener('chainChanged', chainChangedHandlerRef.current);
        removeListener('disconnect', disconnectHandlerRef.current);
        
        if (typeof provider.removeAllListeners === 'function') {
          provider.removeAllListeners();
        }
        
        // Disconnect the old provider if connected
        if (provider.connected) {
          try {
            await provider.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      } catch (e) {
        console.warn('⚠️ Error cleaning up old provider:', e);
      }
      
      wcProviderRef.current = null;
    }
    
    // Clear handler refs
    accountsChangedHandlerRef.current = null;
    chainChangedHandlerRef.current = null;
    disconnectHandlerRef.current = null;
    
    // Clear WalletConnect cache
    clearWalletConnectCache();
    
    // Clear localStorage wallet-related items
    localStorage.removeItem('walletConnected');
    // Clear any other wallet-related localStorage items
    Object.keys(localStorage).forEach(key => {
      if (key.includes('wallet') || key.includes('wc') || key.includes('WalletConnect')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ All wallet state cleared, starting fresh connection...');
    
    try {
      console.log('🔗 Initializing WalletConnect for Base...');
      
      // Always create a fresh provider - no reusing old sessions
      const wcProvider = await initWalletConnect();
      wcProviderRef.current = wcProvider;

      // Create ethers provider
      const ethersProvider = new ethers.providers.Web3Provider(wcProvider);
      const signer = ethersProvider.getSigner();
      const address = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

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

      chainChangedHandlerRef.current = async (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        
        // If we're in a pending switch and this event isn't the target, ignore it
        // This prevents WalletConnect from switching us back during network change
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
        // Set it immediately to prevent other handlers (if any) from processing
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
          // Double-check we should still process (chain might have changed again)
          if (lastChainIdRef.current !== newChainId) {
            console.log('⏭️ Chain changed again before processing, skipping:', newChainId);
            return;
          }
          
          console.log('🔄 Chain changed:', chainIdHex, '→', newChainId);
          setChainId(newChainId);
          
          // Recreate ethers provider when chain changes to avoid network mismatch errors
          try {
            const newEthersProvider = new ethers.providers.Web3Provider(wcProvider);
            setProvider(newEthersProvider);
            console.log('✅ Chain updated to:', newChainId, '- Provider recreated');
          } catch (error) {
            console.error('Error recreating provider on chain change:', error);
            // Revert chainId on error
            lastChainIdRef.current = previousChainId;
          }
          
          chainChangeTimeoutRef.current = null;
        }, 100); // 100ms debounce
      };

      disconnectHandlerRef.current = () => {
        console.log('🔌 WalletConnect disconnected');
        handleDisconnect();
      };

      // Set up event listeners (only once per provider instance)
      wcProvider.on('accountsChanged', accountsChangedHandlerRef.current);
      wcProvider.on('chainChanged', chainChangedHandlerRef.current);
      wcProvider.on('disconnect', disconnectHandlerRef.current);
      
      listenersSetupRef.current = true;
      console.log('✅ Event listeners set up');

      // Update state
      setWalletAddress(address);
      setIsConnected(true);
      setProvider(ethersProvider);
      setChainId(network.chainId);
      lastChainIdRef.current = network.chainId; // Track initial chain
      localStorage.setItem('walletConnected', 'true');
      setConnecting(false);

      console.log('✅ Wallet connected:', address);
      console.log('✅ Network:', network.chainId === 8453 ? 'Base Mainnet' : `Chain ${network.chainId}`);
      
      // Auto-switch to Base if not already on Base
      if (network.chainId !== 8453) {
        console.log(`🔄 Current network is ${network.chainId}, switching to Base (8453)...`);
        pendingTargetChainRef.current = 8453; // Mark that we're switching to Base
        setSwitchingNetwork(true);
        
        try {
          await wcProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // Base mainnet (8453 in hex)
          });
          console.log('✅ Switched to Base network');
          
          // Optimistically update state to Base immediately after successful switch
          // This prevents balance fetch from seeing the wrong network during timing window
          try {
            const newEthersProvider = new ethers.providers.Web3Provider(wcProvider);
            setProvider(newEthersProvider);
            setChainId(8453);
            lastChainIdRef.current = 8453;
            console.log('✅ Optimistically updated to Base (8453) - waiting for chainChanged confirmation');
          } catch (optimisticError) {
            console.warn('⚠️ Failed to optimistically update provider, will rely on chainChanged event:', optimisticError);
          }
        } catch (switchError) {
          // Clear pending flag on error
          pendingTargetChainRef.current = null;
          setSwitchingNetwork(false);
          
          // If chain not added, try to add it
          if (switchError.code === 4902) {
            try {
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
              console.log('✅ Base network added and switched');
              
              // Optimistically update to Base after adding
              try {
                const newEthersProvider = new ethers.providers.Web3Provider(wcProvider);
                setProvider(newEthersProvider);
                setChainId(8453);
                lastChainIdRef.current = 8453;
                pendingTargetChainRef.current = null; // Clear after successful switch
              } catch (optimisticError) {
                console.warn('⚠️ Failed to optimistically update after add, will rely on chainChanged event:', optimisticError);
              }
              } catch (addError) {
              console.warn('⚠️ Failed to add Base network:', addError);
              pendingTargetChainRef.current = null;
                setSwitchingNetwork(false);
              // Continue anyway - user can manually switch later
            }
          } else if (switchError.code === 4001) {
            console.warn('⚠️ User rejected network switch to Base');
            pendingTargetChainRef.current = null;
            setSwitchingNetwork(false);
            // Continue anyway - user chose not to switch
          } else {
            console.warn('⚠️ Network switch error:', switchError);
            pendingTargetChainRef.current = null;
            setSwitchingNetwork(false);
            // Continue anyway - connection still works
          }
        }
      } else {
        console.log('✅ Already on Base network');
        pendingTargetChainRef.current = null; // Ensure no pending if already on Base
        setSwitchingNetwork(false);
      }
      
      return {
        success: true,
        address,
        chainId: network.chainId,
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

  // Helper to clear state on disconnect - THOROUGH CLEANUP
  const handleDisconnect = () => {
    console.log('🧹 Starting thorough disconnect cleanup...');
    
    // Clear all state
    setWalletAddress(null);
    setIsConnected(false);
    setChainId(null);
    setProvider(null);
    setSwitchingNetwork(false);
    setConnecting(false);
    
    // Clear all refs
    lastChainIdRef.current = null;
    pendingTargetChainRef.current = null;
    listenersSetupRef.current = false;
    
    // Clear timeout if exists
    if (chainChangeTimeoutRef.current) {
      clearTimeout(chainChangeTimeoutRef.current);
      chainChangeTimeoutRef.current = null;
    }
    
    // Remove all listeners and disconnect provider
    if (wcProviderRef.current) {
      try {
        const provider = wcProviderRef.current;
        
        // Remove specific listeners
        const removeListener = (event, handler) => {
          if (handler) {
            if (typeof provider.off === 'function') {
              provider.off(event, handler);
            } else if (typeof provider.removeListener === 'function') {
              provider.removeListener(event, handler);
            }
          }
        };
        
        removeListener('accountsChanged', accountsChangedHandlerRef.current);
        removeListener('chainChanged', chainChangedHandlerRef.current);
        removeListener('disconnect', disconnectHandlerRef.current);
        
        // Remove all listeners as fallback
        if (typeof provider.removeAllListeners === 'function') {
          provider.removeAllListeners();
        }
        
        // Disconnect if connected
        if (provider.connected) {
          try {
            provider.disconnect().catch(() => {
              // Ignore disconnect errors
            });
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      } catch (e) {
        console.warn('⚠️ Error during provider cleanup:', e);
      }
      
      wcProviderRef.current = null;
    }
    
    // Clear handler refs
    accountsChangedHandlerRef.current = null;
    chainChangedHandlerRef.current = null;
    disconnectHandlerRef.current = null;
    
    // Clear WalletConnect cache
    clearWalletConnectCache();
    
    // Clear ALL localStorage items related to wallet
    localStorage.removeItem('walletConnected');
    
    // Aggressively clear any WalletConnect/localStorage items
    const keysToRemove = [];
    Object.keys(localStorage).forEach(key => {
      if (
        key.includes('wallet') || 
        key.includes('wc@') || 
        key.includes('WalletConnect') ||
        key.includes('WALLETCONNECT') ||
        key.startsWith('wc-') ||
        key.includes('ethereum')
      ) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`⚠️ Failed to remove localStorage key: ${key}`, e);
      }
    });
    
    console.log('✅ Disconnect cleanup complete - all state and cache cleared');
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

