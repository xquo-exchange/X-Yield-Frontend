import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { initWalletConnect } from '../utils/walletconnectProvider';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [walletType] = useState('walletconnect');
  const wcProviderRef = useRef(null);

  // Version check and auto-reconnect on mount
  useEffect(() => {
    // Check app version and clear cache if needed
    const APP_VERSION = '1.0.0';
    const storedVersion = localStorage.getItem('appVersion');
    
    if (storedVersion !== APP_VERSION) {
      console.log('🔄 New version detected, clearing cache...');
      localStorage.clear();
      localStorage.setItem('appVersion', APP_VERSION);
    }
    
    const autoConnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected');
      if (wasConnected === 'true') {
        try {
          console.log('🔄 Auto-reconnecting wallet...');
          await connectWallet();
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
          localStorage.removeItem('walletConnected');
        }
      }
    };

    autoConnect();
  }, []);

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
    setConnecting(true);
    try {
      console.log('🔗 Initializing WalletConnect for Base...');
      const wcProvider = await initWalletConnect();
      wcProviderRef.current = wcProvider;

      // Create ethers provider
      const ethersProvider = new ethers.providers.Web3Provider(wcProvider);
      const signer = ethersProvider.getSigner();
      const address = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

      // Set up event listeners
      wcProvider.on('accountsChanged', (accounts) => {
        console.log('🔄 Accounts changed:', accounts);
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
        } else {
          handleDisconnect();
        }
      });

      wcProvider.on('chainChanged', (chainIdHex) => {
        console.log('🔄 Chain changed:', chainIdHex);
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        console.log('✅ Chain updated to:', newChainId);
      });

      wcProvider.on('disconnect', () => {
        console.log('🔌 WalletConnect disconnected');
        handleDisconnect();
      });

      // Update state
      setWalletAddress(address);
      setIsConnected(true);
      setProvider(ethersProvider);
      setChainId(network.chainId);
      localStorage.setItem('walletConnected', 'true');
      setConnecting(false);

      console.log('✅ Wallet connected:', address);
      console.log('✅ Network:', network.chainId === 8453 ? 'Base Mainnet' : `Chain ${network.chainId}`);
      
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

  // Helper to clear state on disconnect
  const handleDisconnect = () => {
    setWalletAddress(null);
    setIsConnected(false);
    setChainId(null);
    setProvider(null);
    localStorage.removeItem('walletConnected');
    if (wcProviderRef.current && typeof wcProviderRef.current.removeAllListeners === 'function') {
      wcProviderRef.current.removeAllListeners();
      wcProviderRef.current = null;
    }
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

