// WalletContext.jsx

import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  getAccount,
  getChainId,
  getWalletClient,
  watchAccount,
  watchChainId,
} from "@wagmi/core";
import { appKit, wagmiAdapter } from "../config/appKit";
import { isMobileDevice } from "../utils/isMobile";

const VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
  "function previewWithdraw(uint256 assets) view returns (uint256 shares)",
];

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [vaultBalance, setVaultBalance] = useState("0");
  const [isBalancesLoading, setIsBalancesLoading] = useState(false);
  const walletType = "reown-appkit";

  const accountWatcherRef = useRef(null);
  const networkWatcherRef = useRef(null);
  const balanceCacheRef = useRef(null);

  const wagmiConfig = wagmiAdapter.wagmiConfig;

  const handleDisconnect = useCallback(() => {
    setWalletAddress(null);
    setIsConnected(false);
    setChainId(null);
    setProvider(null);
    setSwitchingNetwork(false);
    setConnecting(false);
    setUsdcBalance("0");
    setVaultBalance("0");
    setIsBalancesLoading(false);
    balanceCacheRef.current = null;
    localStorage.removeItem("walletConnected");
  }, []);

  const initializeProvider = useCallback(
    async (accountData) => {
      const account = accountData ?? getAccount(wagmiConfig);
      if (!account?.address) {
        return;
      }

      try {
        const walletClient = await getWalletClient(wagmiConfig, {
          chainId: account.chainId,
        });

        if (!walletClient) {
          throw new Error("Wallet client unavailable");
        }

        const ethersProvider = new ethers.providers.Web3Provider(
          walletClient.transport,
          "any"
        );

        setProvider(ethersProvider);
        setWalletAddress(account.address);
        setIsConnected(true);

        if (typeof account.chainId === "number") {
          setChainId(account.chainId);
        } else {
          const currentChainId = getChainId(wagmiConfig);
          setChainId(typeof currentChainId === "number" ? currentChainId : null);
        }

        // Only save to localStorage on desktop OR Farcaster (not regular mobile)
        const isFarcasterEnv = typeof navigator !== 'undefined' &&
          /Farcaster|Warpcast/i.test(navigator.userAgent);

        if (!isMobileDevice() || isFarcasterEnv) {
          localStorage.setItem("walletConnected", "true");
        }
      } catch (error) {
        console.error("Failed to initialize provider:", error);
        setProvider(null);
      }
    },
    [wagmiConfig]
  );

  const handleAccountChange = useCallback(
    async (accountData) => {
      if (accountData?.status === "disconnected" || !accountData?.address) {
        handleDisconnect();
        return;
      }

      await initializeProvider(accountData);
    },
    [handleDisconnect, initializeProvider]
  );

  useEffect(() => {
    const APP_VERSION = "1.0.0";
    const storedVersion = localStorage.getItem("appVersion");

    if (storedVersion !== APP_VERSION) {
      localStorage.clear();
      localStorage.setItem("appVersion", APP_VERSION);
    }

    // 🔥 CRITICAL: Detect Farcaster - don't clear wallet state in Farcaster
    const isFarcasterEnv = typeof navigator !== 'undefined' &&
      /Farcaster|Warpcast/i.test(navigator.userAgent);

    console.log('🔍 Environment check:', {
      isMobile: isMobileDevice(),
      isFarcaster: isFarcasterEnv,
      shouldClearWallet: isMobileDevice() && !isFarcasterEnv,
      userAgent: navigator.userAgent
    });

    // On mobile devices, clear wallet connection state and don't auto-reconnect
    // BUT: Skip this in Farcaster environment
    if (isMobileDevice() && !isFarcasterEnv) {
      // Clear wallet connection flag
      localStorage.removeItem("walletConnected");

      // Disconnect any existing wallet connection
      handleDisconnect();

      // Clear wagmi storage (cookies) for mobile
      try {
        // Clear all cookies that might contain wallet connection data
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          // Clear wagmi-related cookies
          if (name.includes("wagmi") || name.includes("wc@") || name.includes("reown")) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
          }
        });
      } catch (error) {
        console.warn("Failed to clear cookies:", error);
      }

      // Don't auto-reconnect on mobile - user must manually connect each time
      // Set up watchers but don't initialize existing account
      accountWatcherRef.current = watchAccount(wagmiConfig, {
        onChange: handleAccountChange,
      });

      networkWatcherRef.current = watchChainId(wagmiConfig, {
        onChange: (nextChainId) =>
          setChainId(typeof nextChainId === "number" ? nextChainId : null),
      });

      return () => {
        accountWatcherRef.current?.();
        accountWatcherRef.current = null;
        networkWatcherRef.current?.();
        networkWatcherRef.current = null;
      };
    }

    // Desktop or Farcaster behavior: auto-reconnect if account exists
    const existingAccount = getAccount(wagmiConfig);
    if (existingAccount?.address) {
      console.log('🟢 Auto-reconnecting existing account in Farcaster/Desktop:', existingAccount.address);
      initializeProvider(existingAccount);
    }

    accountWatcherRef.current = watchAccount(wagmiConfig, {
      onChange: handleAccountChange,
    });

    networkWatcherRef.current = watchChainId(wagmiConfig, {
      onChange: (nextChainId) =>
        setChainId(typeof nextChainId === "number" ? nextChainId : null),
    });

    return () => {
      accountWatcherRef.current?.();
      accountWatcherRef.current = null;
      networkWatcherRef.current?.();
      networkWatcherRef.current = null;
    };
  }, [handleAccountChange, initializeProvider, wagmiConfig, handleDisconnect]);

  const connectWallet = useCallback(async () => {
    if (connecting) {
      return {
        success: false,
        error: "ALREADY_CONNECTING",
        message: "Already connecting...",
      };
    }

    setConnecting(true);

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 Connection attempt ${attempt}/${MAX_RETRIES}`);

        // Open wallet connection modal
        await appKit.open();

        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify account exists with retry
        let account = getAccount(wagmiConfig);
        let accountRetries = 0;
        while (!account?.address && accountRetries < 5) {
          await new Promise(resolve => setTimeout(resolve, 300));
          account = getAccount(wagmiConfig);
          accountRetries++;
        }

        if (!account?.address) {
          if (attempt < MAX_RETRIES) {
            console.warn(`⚠️ No account found, retrying... (${attempt}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            continue;
          }
          setConnecting(false);
          return {
            success: false,
            error: "NO_ACCOUNT",
            message: "Wallet connection failed. Please try again.",
          };
        }

        console.log('✅ Account found:', account.address);

        // Initialize provider
        try {
          await initializeProvider(account);
        } catch (initError) {
          console.error('❌ Provider initialization failed:', initError);
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            continue;
          }
          throw initError;
        }

        // Wait a bit for provider to be set
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check and switch network if needed
        let currentChainId = getChainId(wagmiConfig);
        if (currentChainId !== 8453) {
          console.log('🔄 Switching to Base network...');
          setSwitchingNetwork(true);
          try {
            await appKit.switchNetwork(8453);
            
            // Wait for network switch to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify network switch with retries
            let networkRetries = 0;
            while (networkRetries < 10) {
              currentChainId = getChainId(wagmiConfig);
              if (currentChainId === 8453) {
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 300));
              networkRetries++;
            }
            
            if (currentChainId !== 8453) {
              console.warn('⚠️ Network switch verification failed');
              if (attempt < MAX_RETRIES) {
                setSwitchingNetwork(false);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                continue;
              }
              setSwitchingNetwork(false);
              setConnecting(false);
              return {
                success: false,
                error: "CHAIN_NOT_SUPPORTED",
                message: "Please switch to Base network manually.",
              };
            }
            
            setChainId(8453);
            console.log('✅ Successfully switched to Base network');
          } catch (error) {
            console.warn("Network switch error:", error);
            if (error?.code === 4001 || error?.code === "USER_REJECTED_REQUEST") {
              setSwitchingNetwork(false);
              setConnecting(false);
              return {
                success: false,
                error: "USER_REJECTED_SIGNATURE",
                message: "Network switch declined.",
              };
            }
            if (attempt < MAX_RETRIES) {
              setSwitchingNetwork(false);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
              continue;
            }
              setSwitchingNetwork(false);
              setConnecting(false);
              return {
                success: false,
                error: "CHAIN_NOT_SUPPORTED",
                message: "Please switch to Base network.",
              };
          } finally {
            setSwitchingNetwork(false);
          }
        }

        // Final verification
        const finalAccount = getAccount(wagmiConfig);
        const finalChainId = getChainId(wagmiConfig);
        
        if (!finalAccount?.address) {
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            continue;
          }
          setConnecting(false);
          return {
            success: false,
            error: "CONNECTION_FAILED",
            message: "Connection verification failed. Please try again.",
          };
        }

        console.log('✅ Connection successful:', {
          address: finalAccount.address,
          chainId: finalChainId
        });

        setConnecting(false);
        return {
          success: true,
          address: finalAccount.address,
          chainId: typeof finalChainId === "number" ? finalChainId : 8453,
        };

      } catch (error) {
        console.error(`❌ Connection attempt ${attempt} failed:`, error);

        if (
          error?.code === "USER_REJECTED_REQUEST" ||
          error?.message?.includes("User rejected")
        ) {
          setConnecting(false);
          return {
            success: false,
            error: "USER_REJECTED_SIGNATURE",
            message: "Connection declined. You can retry anytime.",
          };
        }

        // If this was the last attempt, return error
        if (attempt === MAX_RETRIES) {
          setConnecting(false);
          return {
            success: false,
            error: "CONNECTION_FAILED",
            message: "Failed to connect after multiple attempts. Please try again.",
          };
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }

    setConnecting(false);
    return {
      success: false,
      error: "CONNECTION_FAILED",
      message: "Failed to connect wallet. Please try again.",
    };
  }, [connecting, initializeProvider, wagmiConfig]);

  const disconnectWallet = useCallback(async () => {
    try {
      await appKit.disconnect();
    } catch (error) {
      console.error("Disconnect error:", error);
    } finally {
      handleDisconnect();
    }

    return {
      success: true,
      message: "Wallet disconnected.",
    };
  }, [handleDisconnect]);

  const switchToBase = useCallback(async () => {
    setSwitchingNetwork(true);
    try {
      await appKit.switchNetwork(8453);
      setChainId(8453);
      return { success: true };
    } catch (error) {
      if (error?.code === 4001 || error?.code === "USER_REJECTED_REQUEST") {
        return {
          success: false,
          error: "USER_REJECTED_SIGNATURE",
          message: "Network switch declined.",
        };
      }

      return {
        success: false,
        error: "CHAIN_NOT_SUPPORTED",
        message: "Please switch to Base network.",
      };
    } finally {
      setSwitchingNetwork(false);
    }
  }, []);

  const invalidateBalanceCache = useCallback(() => {
    balanceCacheRef.current = null;
  }, []);

  const fetchBalances = useCallback(
    async (forceRefresh = false) => {
      const isFarcasterEnv = typeof navigator !== 'undefined' &&
        /Farcaster|Warpcast/i.test(navigator.userAgent);

      console.log('🔍 fetchBalances called:', {
        walletAddress,
        hasProvider: !!provider,
        chainId,
        forceRefresh
      });


      if (!walletAddress) {
        console.warn('⚠️ Balance fetch skipped - no wallet', { walletAddress });
        setIsBalancesLoading(false);
        setUsdcBalance("0");
        setVaultBalance("0");
        balanceCacheRef.current = null;
        return;
      }

      if (chainId !== 8453) {
        console.warn('⚠️ Balance fetch skipped - wrong chainId:', chainId);
        setIsBalancesLoading(false);
        setUsdcBalance("0");
        setVaultBalance("0");
        balanceCacheRef.current = null;
        return;
      }

      console.log('✅ Fetching balances for', walletAddress, 'on chainId', chainId);
      setIsBalancesLoading(true);

      const cache = balanceCacheRef.current;
      if (
        !forceRefresh &&
        cache &&
        cache.account === walletAddress &&
        cache.chainId === chainId
      ) {
        setUsdcBalance(cache.usdcBalance);
        setVaultBalance(cache.vaultBalance);
        setIsBalancesLoading(false);
        return;
      }

      try {
        // FARCASTER FIX: Use fallback RPC provider for read operations
        // Farcaster wallet provider doesn't support eth_call, so we use public RPC for reads

        // Initialize readProvider - ALWAYS use fallback RPC in Farcaster for safety
        let readProvider = null;

        if (isFarcasterEnv) {
          // In Farcaster, always use public RPC for reading (Farcaster provider is unreliable)
          console.log('🔄 Farcaster detected - using public RPC for balance reads');
          readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        } else if (provider) {
          // Not Farcaster - use the wallet's provider normally
          readProvider = provider;
        } else {
          // No provider - use fallback
          console.log('🔄 No provider - using fallback RPC for balance reads');
          readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        }

        // Safety check - should never happen but just in case
        if (!readProvider) {
          throw new Error('Failed to initialize read provider');
        }

        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          readProvider
        );

        const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, readProvider);

        const [usdcBal, usdcDecimals, vaultTokenBalance, network] = await Promise.all([
          usdcContract.balanceOf(walletAddress),
          usdcContract.decimals(),
          vaultContract.balanceOf(walletAddress),
          readProvider.getNetwork(),
        ]);

        if (network.chainId !== 8453) {
          setIsBalancesLoading(false);
          setUsdcBalance("0");
          setVaultBalance("0");
          balanceCacheRef.current = null;
          return;
        }

        const formattedUsdc = ethers.utils.formatUnits(usdcBal, usdcDecimals);

        let formattedVaultBalance = "0";
        if (!vaultTokenBalance.isZero()) {
          const assetsValue = await vaultContract.convertToAssets(vaultTokenBalance);
          formattedVaultBalance = ethers.utils.formatUnits(assetsValue, 6);
        }

        console.log('✅ Balances fetched successfully:', {
          usdc: formattedUsdc,
          vault: formattedVaultBalance
        });


        setUsdcBalance(formattedUsdc);
        setVaultBalance(formattedVaultBalance);
        setIsBalancesLoading(false);

        balanceCacheRef.current = {
          usdcBalance: formattedUsdc,
          vaultBalance: formattedVaultBalance,
          account: walletAddress,
          chainId,
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error('❌ Balance fetch error:', error);

        if (error.code === "NETWORK_ERROR" || error.message?.includes("underlying network changed")) {
          setIsBalancesLoading(false);
          return;
        }

        setUsdcBalance("0");
        setVaultBalance("0");
        balanceCacheRef.current = null;
        setIsBalancesLoading(false);
      }
    },
    [walletAddress, provider, chainId]
  );

  useEffect(() => {
    if (walletAddress && provider && chainId === 8453) {
      fetchBalances(false);
    }
  }, [walletAddress, provider, chainId, fetchBalances]);

  useEffect(() => {
    // On mobile, disconnect wallet when page is about to unload/reload
    // BUT: Don't do this in Farcaster
    const isFarcasterEnv = typeof navigator !== 'undefined' &&
      /Farcaster|Warpcast/i.test(navigator.userAgent);

    if (isMobileDevice() && !isFarcasterEnv) {
      const handleBeforeUnload = () => {
        // Clear localStorage
        localStorage.removeItem("walletConnected");

        // Disconnect wallet
        handleDisconnect();
      };

      // Handle page unload/reload
      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("pagehide", handleBeforeUnload);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("pagehide", handleBeforeUnload);
      };
    }
  }, [handleDisconnect]);

  const checkBalance = useCallback(
    async (tokenAddress, requiredAmount) => {
      if (!provider || !isConnected) {
        return {
          success: false,
          error: "NOT_CONNECTED",
          message: "Wallet not connected.",
        };
      }

      try {
        const signer = provider.getSigner();
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          signer
        );

        const balance = await tokenContract.balanceOf(walletAddress);
        const decimals = await tokenContract.decimals();
        const required = ethers.utils.parseUnits(requiredAmount.toString(), decimals);

        if (balance.lt(required)) {
          return {
            success: false,
            error: "INSUFFICIENT_FUNDS",
            message: "Insufficient balance for amount and/or gas. Adjust the amount or top up your wallet.",
          };
        }

        return {
          success: true,
          balance: ethers.utils.formatUnits(balance, decimals),
        };
      } catch (error) {
        console.error("Balance check failed:", error);
        return {
          success: false,
          error: "BALANCE_CHECK_FAILED",
          message: "Failed to check balance.",
        };
      }
    },
    [provider, isConnected, walletAddress]
  );

  const approveTransaction = useCallback(
    async (tokenAddress, spenderAddress, amount) => {
      if (!provider || !isConnected) {
        return {
          success: false,
          error: "NOT_CONNECTED",
          message: "Wallet not connected.",
        };
      }

      try {
        const signer = provider.getSigner();
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function approve(address spender, uint256 amount) returns (bool)"],
          signer
        );

        const tx = await tokenContract.approve(spenderAddress, amount);
        await tx.wait();

        return { success: true };
      } catch (error) {
        if (error.code === 4001) {
          return {
            success: false,
            error: "USER_REJECTED_SIGNATURE",
            message: "Signature declined. You can retry anytime.",
          };
        }

        return {
          success: false,
          error: "APPROVAL_FAILED",
          message: "Approval failed. Please try again.",
        };
      }
    },
    [provider, isConnected]
  );

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
    fetchBalances,
    invalidateBalanceCache,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};


