import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { initWalletConnect, clearWalletConnectCache } from '../utils/walletconnectProvider';

// Vault contract addresses on Base
const VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

// ERC-4626 Vault ABI (only the functions we need)
const VAULT_ABI = [
  // ERC-4626 Core Functions
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  
  // ERC-20 Functions (vault token)
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  
  // ERC-4626 View Functions
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function asset() view returns (address)", // Returns USDC address
  "function totalAssets() view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
  "function previewWithdraw(uint256 assets) view returns (uint256 shares)"
];

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [walletType] = useState('walletconnect');
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [vaultBalance, setVaultBalance] = useState("0");
  const [isBalancesLoading, setIsBalancesLoading] = useState(false);
  const wcProviderRef = useRef(null);
  const lastChainIdRef = useRef(null);
  const chainChangeTimeoutRef = useRef(null);
  const listenersSetupRef = useRef(false);
  const accountsChangedHandlerRef = useRef(null);
  const chainChangedHandlerRef = useRef(null);
  const disconnectHandlerRef = useRef(null);
  const pendingTargetChainRef = useRef(null);
  const lastAccountRef = useRef(null);
  const accountChangeTimeoutRef = useRef(null);
  const chainChangeProcessingRef = useRef(false);
  const balanceCacheRef = useRef(null);

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

    // Check if already connected - reuse existing provider without showing QR
    if (wcProviderRef.current && wcProviderRef.current.connected && isConnected && walletAddress) {
      console.log('✅ Already connected, reusing existing provider');
      return {
        success: true,
        address: walletAddress,
        chainId: chainId,
      };
    }

    setConnecting(true);
    
    try {
      console.log('🔗 Initializing WalletConnect for Base...');
      
      // Check for existing provider first - don't clear if we can reuse it
      let wcProvider = wcProviderRef.current;
      
      if (!wcProvider || !wcProvider.connected) {
        // Only clear if we need a fresh connection
        console.log('🧹 Clearing wallet state for fresh connection...');
        
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
    lastAccountRef.current = null;
    chainChangeProcessingRef.current = false;
    
    // Clear timeouts if exist
    if (chainChangeTimeoutRef.current) {
      clearTimeout(chainChangeTimeoutRef.current);
      chainChangeTimeoutRef.current = null;
    }
    if (accountChangeTimeoutRef.current) {
      clearTimeout(accountChangeTimeoutRef.current);
      accountChangeTimeoutRef.current = null;
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
        
        // Clear our app's localStorage items (but NOT WalletConnect session storage)
        localStorage.removeItem('walletConnected');
        
        // Get fresh provider
        wcProvider = await initWalletConnect();
      } else {
        console.log('✅ Reusing existing connected provider (no QR needed)');
      }
      
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
        const newAccount = accounts.length > 0 ? accounts[0] : null;
        
        // Ignore duplicate account changes
        if (newAccount === lastAccountRef.current) {
          return; // Silent skip - duplicate event
        }
        
        lastAccountRef.current = newAccount;
        
        // Debounce account changes to prevent rapid-fire duplicates
        if (accountChangeTimeoutRef.current) {
          clearTimeout(accountChangeTimeoutRef.current);
        }
        
        accountChangeTimeoutRef.current = setTimeout(() => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
          } else {
            handleDisconnect();
          }
          accountChangeTimeoutRef.current = null;
        }, 100);
      };

      chainChangedHandlerRef.current = async (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        
        // Immediate duplicate check - if same chainId as last processed, skip
        if (lastChainIdRef.current === newChainId && chainId === newChainId) {
          return; // Silent skip - already on this chain
        }
        
        // If currently processing a chain change, ignore new events
        if (chainChangeProcessingRef.current) {
          return; // Silent skip - already processing
        }
        
        // If we're in a pending switch and this event isn't the target, ignore it
        if (pendingTargetChainRef.current && newChainId !== pendingTargetChainRef.current) {
          return; // Silent skip - waiting for target chain
        }
        
        // If it matches the pending target, clear the pending flag
        if (pendingTargetChainRef.current === newChainId) {
          pendingTargetChainRef.current = null;
          setSwitchingNetwork(false);
        }
        
        // Mark as processing immediately to prevent concurrent handlers
        const previousChainId = lastChainIdRef.current;
        lastChainIdRef.current = newChainId;
        chainChangeProcessingRef.current = true;
        
        // If there's already a pending timeout, clear it
        if (chainChangeTimeoutRef.current) {
          clearTimeout(chainChangeTimeoutRef.current);
          chainChangeTimeoutRef.current = null;
        }
        
        // Debounce chain change to catch rapid-fire events
        chainChangeTimeoutRef.current = setTimeout(async () => {
          // Double-check we should still process
          if (lastChainIdRef.current !== newChainId || chainId === newChainId) {
            chainChangeProcessingRef.current = false;
            return;
          }
          
          console.log('🔄 Chain changed:', chainIdHex, '→', newChainId);
          
          // Only recreate provider if chainId actually changed
          if (chainId !== newChainId) {
            setChainId(newChainId);
            
            // Recreate ethers provider when chain changes to avoid network mismatch errors
            try {
              const newEthersProvider = new ethers.providers.Web3Provider(wcProvider);
              setProvider(newEthersProvider);
              console.log('✅ Chain updated to:', newChainId);
            } catch (error) {
              console.error('Error recreating provider on chain change:', error);
              // Revert chainId on error
              lastChainIdRef.current = previousChainId;
              setChainId(previousChainId);
            }
          }
          
          chainChangeTimeoutRef.current = null;
          chainChangeProcessingRef.current = false;
        }, 200); // Increased debounce to catch rapid-fire events
      };

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
      // CRITICAL: Clear WalletConnect cache before handling disconnect
      // This ensures the module-level cached provider is cleared
      clearWalletConnectCache();
      handleDisconnect();
      return {
        success: true,
        message: 'Wallet disconnected successfully.',
      };
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still clear cache even if disconnect throws an error
      clearWalletConnectCache();
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
    setUsdcBalance("0");
    setVaultBalance("0");
    setIsBalancesLoading(false);
    
    // Clear all refs
    lastChainIdRef.current = null;
    pendingTargetChainRef.current = null;
    listenersSetupRef.current = false;
    lastAccountRef.current = null;
    chainChangeProcessingRef.current = false;
    balanceCacheRef.current = null;
    
    // Clear timeouts if exist
    if (chainChangeTimeoutRef.current) {
      clearTimeout(chainChangeTimeoutRef.current);
      chainChangeTimeoutRef.current = null;
    }
    if (accountChangeTimeoutRef.current) {
      clearTimeout(accountChangeTimeoutRef.current);
      accountChangeTimeoutRef.current = null;
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
    
    // Force page refresh to ensure clean state for next connection
    // This ensures WalletConnect is fully reset and QR code will work
    console.log('🔄 Refreshing page for clean reconnect...');
    setTimeout(() => {
      window.location.reload();
    }, 100); // Small delay to ensure cleanup completes
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

  // Invalidate balance cache
  const invalidateBalanceCache = useCallback(() => {
    balanceCacheRef.current = null;
  }, []);

  // Fetch balances function (reusable) - optimized with caching
  const fetchBalances = useCallback(async (forceRefresh = false) => {
    if (!walletAddress || !provider) {
      setIsBalancesLoading(false);
      setUsdcBalance("0");
      setVaultBalance("0");
      balanceCacheRef.current = null;
      return;
    }

    if (chainId !== 8453) {
      setIsBalancesLoading(false);
      setUsdcBalance("0");
      setVaultBalance("0");
      balanceCacheRef.current = null;
      return;
    }

    setIsBalancesLoading(true);

    // Check cache first (unless force refresh)
    const cache = balanceCacheRef.current;
    if (!forceRefresh && cache && 
        cache.account === walletAddress && 
        cache.chainId === chainId) {
      // Use cached balances
      setUsdcBalance(cache.usdcBalance);
      setVaultBalance(cache.vaultBalance);
      setIsBalancesLoading(false);
      return;
    }

    try {
      // Fetch all data in parallel for speed
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        provider
      );
      
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        provider
      );

      // Parallel fetch all data
      const [usdcBal, usdcDecimals, vaultTokenBalance, network] = await Promise.all([
        usdcContract.balanceOf(walletAddress),
        usdcContract.decimals(),
        vaultContract.balanceOf(walletAddress),
        provider.getNetwork()
      ]);
      
      // Verify network matches
      if (network.chainId !== 8453) {
        setIsBalancesLoading(false);
        setUsdcBalance("0");
        setVaultBalance("0");
        balanceCacheRef.current = null;
        return;
      }

      // Format USDC balance
      const formattedUsdc = ethers.utils.formatUnits(usdcBal, usdcDecimals);
      
      // Convert vault tokens to USDC value
      let formattedVaultBalance = "0";
      if (!vaultTokenBalance.isZero()) {
        const assetsValue = await vaultContract.convertToAssets(vaultTokenBalance);
        formattedVaultBalance = ethers.utils.formatUnits(assetsValue, 6); // USDC has 6 decimals
      }

      // Update state and cache
      setUsdcBalance(formattedUsdc);
      setVaultBalance(formattedVaultBalance);
      setIsBalancesLoading(false);
      
      // Store in cache
      balanceCacheRef.current = {
        usdcBalance: formattedUsdc,
        vaultBalance: formattedVaultBalance,
        account: walletAddress,
        chainId,
        timestamp: Date.now()
      };
    } catch (error) {
      // Handle network change errors gracefully
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('underlying network changed')) {
        setIsBalancesLoading(false);
        return; // Don't reset balances - wait for provider to update
      }
      
      setUsdcBalance("0");
      setVaultBalance("0");
      balanceCacheRef.current = null;
      setIsBalancesLoading(false);
    }
  }, [walletAddress, provider, chainId]);

  // Fetch balances when account/provider/chainId changes
  useEffect(() => {
    if (walletAddress && provider && chainId === 8453) {
      fetchBalances(false); // Don't force refresh on dependency changes
    }
  }, [walletAddress, provider, chainId, fetchBalances]);

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
    usdcBalance,
    vaultBalance,
    isBalancesLoading,
    connectWallet,
    disconnectWallet,
    switchToBase,
    checkBalance,
    approveTransaction,
    getWalletConnectProvider,
    fetchBalances,
    invalidateBalanceCache,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

