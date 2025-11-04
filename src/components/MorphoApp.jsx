import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import "./MorphoApp.css";

// Vault address on Base
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

const VaultApp = ({ onShowToast, mode }) => {
  const { walletAddress: account, isConnected, connectWallet, provider: walletProvider, chainId } = useWallet();
  
  const [showWarning, setShowWarning] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [vaultBalance, setVaultBalance] = useState("0");
  
  // In-memory balance cache
  const balanceCacheRef = useRef(null);
  const hasFetchedOnConnectRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  // Fee configuration - conditional display
  const DEPOSIT_FEE = null; // Set to a number (e.g., 0.5) to show fee, or null to hide
  const WITHDRAWAL_FEE = 0.5; // Example: 0.5% withdrawal fee
  
  const BASE_APY = 8.5; // Vault APY

  // Invalidate balance cache
  const invalidateBalanceCache = useCallback(() => {
    console.log('💰 [BALANCE] Cache invalidated', { 
      hadCache: !!balanceCacheRef.current,
      previousCache: balanceCacheRef.current ? {
        account: balanceCacheRef.current.account,
        chainId: balanceCacheRef.current.chainId,
        age: Date.now() - balanceCacheRef.current.timestamp
      } : null
    });
    balanceCacheRef.current = null;
  }, []);

  // Fetch balances function (reusable) - optimized with caching
  const fetchBalances = useCallback(async (forceRefresh = false) => {
    const startTime = performance.now();
    console.log('💰 [BALANCE] fetchBalances called', { forceRefresh, account, chainId, hasProvider: !!walletProvider });
    
    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      console.log('💰 [BALANCE] Fetch already in progress, skipping duplicate');
      return;
    }
    
    if (!account || !walletProvider) {
      console.log('💰 [BALANCE] Early return: missing account or provider');
      setUsdcBalance("0");
      setVaultBalance("0");
      balanceCacheRef.current = null;
      return;
    }

    if (chainId !== 8453) {
      console.log('💰 [BALANCE] Early return: wrong chainId', chainId);
      setUsdcBalance("0");
      setVaultBalance("0");
      balanceCacheRef.current = null;
      return;
    }
    
    // Mark as fetching
    isFetchingRef.current = true;

    // Check cache first (unless force refresh)
    const cache = balanceCacheRef.current;
    const cacheCheckTime = performance.now();
    if (!forceRefresh && cache && 
        cache.account === account && 
        cache.chainId === chainId) {
      // Use cached balances
      console.log('💰 [BALANCE] Using cache', { 
        cacheAge: Date.now() - cache.timestamp,
        usdcBalance: cache.usdcBalance,
        vaultBalance: cache.vaultBalance,
        cacheCheckTime: `${(cacheCheckTime - startTime).toFixed(2)}ms`
      });
      setUsdcBalance(cache.usdcBalance);
      setVaultBalance(cache.vaultBalance);
      return;
    }
    console.log('💰 [BALANCE] Cache miss or force refresh', { 
      hasCache: !!cache,
      cacheAccount: cache?.account,
      cacheChainId: cache?.chainId,
      cacheCheckTime: `${(cacheCheckTime - startTime).toFixed(2)}ms`
    });

    try {
      const contractCreationStart = performance.now();
      // Fetch all data in parallel for speed
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        walletProvider
      );
      
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        walletProvider
      );
      const contractCreationTime = performance.now() - contractCreationStart;
      console.log('💰 [BALANCE] Contracts created', { contractCreationTime: `${contractCreationTime.toFixed(2)}ms` });

      // Parallel fetch all data
      const rpcCallStart = performance.now();
      console.log('💰 [BALANCE] Starting parallel RPC calls...');
      const [usdcBal, usdcDecimals, vaultTokenBalance, network] = await Promise.all([
        usdcContract.balanceOf(account),
        usdcContract.decimals(),
        vaultContract.balanceOf(account),
        walletProvider.getNetwork()
      ]);
      const rpcCallTime = performance.now() - rpcCallStart;
      console.log('💰 [BALANCE] RPC calls completed', { 
        rpcCallTime: `${rpcCallTime.toFixed(2)}ms`,
        usdcBalanceRaw: usdcBal.toString(),
        vaultBalanceRaw: vaultTokenBalance.toString(),
        decimals: usdcDecimals.toString(),
        networkChainId: network.chainId
      });
      
      // Verify network matches
      if (network.chainId !== 8453) {
        console.log('💰 [BALANCE] Network mismatch, returning early', { networkChainId: network.chainId });
        setUsdcBalance("0");
        setVaultBalance("0");
        balanceCacheRef.current = null;
        return;
      }

      // Format USDC balance
      const formatStart = performance.now();
      const formattedUsdc = ethers.utils.formatUnits(usdcBal, usdcDecimals);
      const formatTime = performance.now() - formatStart;
      console.log('💰 [BALANCE] USDC formatted', { 
        formattedUsdc,
        formatTime: `${formatTime.toFixed(2)}ms`
      });
      
      // Convert vault tokens to USDC value
      let formattedVaultBalance = "0";
      if (!vaultTokenBalance.isZero()) {
        const convertStart = performance.now();
        console.log('💰 [BALANCE] Converting vault tokens to assets...');
        const assetsValue = await vaultContract.convertToAssets(vaultTokenBalance);
        const convertTime = performance.now() - convertStart;
        formattedVaultBalance = ethers.utils.formatUnits(assetsValue, 6); // USDC has 6 decimals
        console.log('💰 [BALANCE] Vault conversion completed', { 
          assetsValueRaw: assetsValue.toString(),
          formattedVaultBalance,
          convertTime: `${convertTime.toFixed(2)}ms`
        });
      } else {
        console.log('💰 [BALANCE] Vault balance is zero, skipping conversion');
      }

      // Update state and cache
      const stateUpdateStart = performance.now();
      setUsdcBalance(formattedUsdc);
      setVaultBalance(formattedVaultBalance);
      
      // Store in cache
      balanceCacheRef.current = {
        usdcBalance: formattedUsdc,
        vaultBalance: formattedVaultBalance,
        account,
        chainId,
        timestamp: Date.now()
      };
      const stateUpdateTime = performance.now() - stateUpdateStart;
      const totalTime = performance.now() - startTime;
      
      console.log('💰 [BALANCE] ✅ Fetch complete', {
        usdcBalance: formattedUsdc,
        vaultBalance: formattedVaultBalance,
        stateUpdateTime: `${stateUpdateTime.toFixed(2)}ms`,
        totalTime: `${totalTime.toFixed(2)}ms`,
        breakdown: {
          contractCreation: `${contractCreationTime.toFixed(2)}ms`,
          rpcCalls: `${rpcCallTime.toFixed(2)}ms`,
          formatting: `${formatTime.toFixed(2)}ms`,
          stateUpdate: `${stateUpdateTime.toFixed(2)}ms`
        }
      });
    } catch (error) {
      const totalTime = performance.now() - startTime;
      console.error('💰 [BALANCE] ❌ Error fetching balances', {
        error: error.message,
        errorCode: error.code,
        totalTime: `${totalTime.toFixed(2)}ms`,
        stack: error.stack
      });
      
      // Handle network change errors gracefully
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('underlying network changed')) {
        console.log('💰 [BALANCE] Network error detected, not resetting balances');
        isFetchingRef.current = false;
        return; // Don't reset balances - wait for provider to update
      }
      
      setUsdcBalance("0");
      setVaultBalance("0");
      balanceCacheRef.current = null;
    } finally {
      // Always clear fetching flag
      isFetchingRef.current = false;
    }
  }, [account, walletProvider, chainId]);

  // Fetch balances when account/chainId/provider changes or on initial connection
  // Merged both useEffects to prevent duplicate fetches
  useEffect(() => {
    // Reset flag when disconnected
    if (!isConnected) {
      console.log('💰 [BALANCE] Resetting fetch flag on disconnect');
      hasFetchedOnConnectRef.current = false;
      return;
    }
    
    // Only fetch if we have all required dependencies
    if (!account || !walletProvider || chainId !== 8453) {
      return;
    }
    
    // Force refresh on initial connection, use cache for subsequent changes
    const shouldForceRefresh = !hasFetchedOnConnectRef.current;
    if (shouldForceRefresh) {
      console.log('💰 [BALANCE] Triggering force refresh on initial connection');
      hasFetchedOnConnectRef.current = true;
      fetchBalances(true);
    } else {
      console.log('💰 [BALANCE] useEffect triggered (dependency change)', { account, chainId, hasProvider: !!walletProvider });
      fetchBalances(false); // Use cache for subsequent dependency changes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, account, walletProvider, chainId]); // Depend on isConnected too to handle disconnects

  useEffect(() => {
    if (isConnected && showWarning) setShowWarning(false);
  }, [isConnected, showWarning]);

  const closeWarning = () => {
    setShowWarning(false);
  };
  
  const calculateYield = () => {
    if (!amount || parseFloat(amount) <= 0) return { daily: 0, monthly: 0, yearly: 0 };
    
    const principal = parseFloat(amount);
    const apy = BASE_APY;
    
    const yearly = principal * (apy / 100);
    const monthly = yearly / 12;
    const daily = yearly / 365;
    
    return {
      daily: daily.toFixed(2),
      monthly: monthly.toFixed(2),
      yearly: yearly.toFixed(2)
    };
  };
  
  const calculateWithdrawSummary = () => {
    if (!amount || parseFloat(amount) <= 0) return { usdc: 0, fee: 0, net: 0 };
    
    const vaultAmount = parseFloat(amount);
    const estimatedUSDC = vaultAmount; // 1:1 for simplicity
    const fee = WITHDRAWAL_FEE ? (estimatedUSDC * (WITHDRAWAL_FEE / 100)) : 0;
    const netAmount = estimatedUSDC - fee;
    
    return {
      usdc: estimatedUSDC.toFixed(2),
      fee: fee.toFixed(2),
      net: netAmount.toFixed(2)
    };
  };

  const setMaxAmount = () => {
    const bal = mode === "deposit" ? usdcBalance : vaultBalance;
    
    if (!bal || parseFloat(bal) <= 0) {
      onShowToast?.("error", `No ${mode === "deposit" ? "USDC" : "vault"} balance`);
      return;
    }
    
    setAmount(bal);
  };

  // Execute Deposit (USDC → Vault)
  const executeDeposit = async () => {
    console.log("🔵 ========== DEPOSIT START ==========");
    console.log("🔵 Input amount (string):", amount);
    console.log("🔵 Input amount (parsed float):", parseFloat(amount));
    
    if (!account || !walletProvider) {
      onShowToast?.("error", "Please connect your wallet");
      return;
    }

    if (chainId !== 8453) {
      onShowToast?.("error", "Please switch to Base network");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Please enter an amount to deposit");
      return;
    }

    setIsLoading(true);
    setStatus("Preparing deposit...");
    setTxHash(null);

    try {
      const signer = walletProvider.getSigner();
      console.log("🔵 Signer address:", await signer.getAddress());

      // Check USDC balance
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ],
        signer
      );

      const decimals = await usdcContract.decimals();
      console.log("🔵 USDC decimals:", decimals);
      
      const balance = await usdcContract.balanceOf(account);
      console.log("🔵 USDC balance (raw):", balance.toString());
      console.log("🔵 USDC balance (formatted):", ethers.utils.formatUnits(balance, decimals));
      
      const requiredAmount = ethers.utils.parseUnits(amount, decimals);
      console.log("🔵 Required amount (raw BigNumber):", requiredAmount.toString());
      console.log("🔵 Required amount (formatted check):", ethers.utils.formatUnits(requiredAmount, decimals));
      console.log("🔵 Required amount string length:", requiredAmount.toString().length);
      console.log("🔵 Required amount hex:", requiredAmount.toHexString());

      if (balance.lt(requiredAmount)) {
        const actualBalance = ethers.utils.formatUnits(balance, decimals);
        onShowToast?.("error", `You need ${amount} USDC but only have ${parseFloat(actualBalance).toFixed(2)} USDC.`);
        setIsLoading(false);
        return;
      }

      setStatus("Approving USDC...");

      // Step 1: Approve USDC for vault
      const approvalAmount = ethers.constants.MaxUint256; // Approve max for gas efficiency
      console.log("🔵 Approval amount (MaxUint256):", approvalAmount.toString());

      // Check current allowance first
      const currentAllowance = await usdcContract.allowance(account, VAULT_ADDRESS);
      console.log("🔵 Current allowance (raw):", currentAllowance.toString());
      console.log("🔵 Current allowance (formatted):", ethers.utils.formatUnits(currentAllowance, decimals));
      console.log("🔵 Allowance sufficient?", currentAllowance.gte(requiredAmount));
      
      if (currentAllowance.lt(requiredAmount)) {
        console.log("🔵 Approving USDC...");
        const approveTx = await usdcContract.approve(VAULT_ADDRESS, approvalAmount);
        console.log("🔵 Approve tx hash:", approveTx.hash);
        setTxHash(approveTx.hash);
        await approveTx.wait();
        console.log("✅ USDC approved");
      } else {
        console.log("🔵 Skipping approval - allowance already sufficient");
      }

      // Step 2: Deposit to vault
      setStatus("Depositing to vault...");
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        signer
      );

      console.log("🔵 Vault address:", VAULT_ADDRESS);
      console.log("🔵 Deposit params:");
      console.log("  - assets (requiredAmount):", requiredAmount.toString());
      console.log("  - receiver (account):", account);
      
      // Try to estimate gas first
      try {
        const estimatedGas = await vaultContract.estimateGas.deposit(requiredAmount, account);
        console.log("🔵 Estimated gas:", estimatedGas.toString());
      } catch (gasError) {
        console.warn("🔵 Gas estimation failed:", gasError.message);
      }

      // Try to simulate the call
      try {
        const result = await vaultContract.callStatic.deposit(requiredAmount, account);
        console.log("🔵 Simulated deposit result (shares):", result.toString());
      } catch (simError) {
        console.error("🔵 Static call simulation failed:", simError);
        console.error("🔵 Simulation error message:", simError.message);
        console.error("🔵 Simulation error data:", simError.data);
        if (simError.data && typeof simError.data === 'string' && simError.data.length >= 138) {
          try {
            // Try to decode revert reason
            const reason = ethers.utils.toUtf8String("0x" + simError.data.slice(138));
            console.error("🔵 Revert reason:", reason);
          } catch (e) {
            console.error("🔵 Could not decode revert reason");
          }
        }
      }

      // Double-check USDC balance right before deposit
      const balanceBeforeDeposit = await usdcContract.balanceOf(account);
      console.log("🔵 USDC balance right before deposit:", balanceBeforeDeposit.toString());
      console.log("🔵 Balance >= required?", balanceBeforeDeposit.gte(requiredAmount));
      
      // Verify allowance one more time
      const finalAllowance = await usdcContract.allowance(account, VAULT_ADDRESS);
      console.log("🔵 Final allowance check:", finalAllowance.toString());
      console.log("🔵 Allowance >= required?", finalAllowance.gte(requiredAmount));
      
      // Check vault state before deposit
      try {
        const totalAssets = await vaultContract.totalAssets();
        console.log("🔵 Vault totalAssets:", totalAssets.toString());
        const assetAddress = await vaultContract.asset();
        console.log("🔵 Vault asset address:", assetAddress);
        console.log("🔵 Asset matches USDC?", assetAddress.toLowerCase() === USDC_ADDRESS.toLowerCase());
      } catch (vaultCheckError) {
        console.warn("🔵 Could not check vault state:", vaultCheckError.message);
      }
      
      // Try to preview the deposit to see what shares we'd get
      try {
        const previewShares = await vaultContract.previewDeposit(requiredAmount);
        console.log("🔵 Preview shares (previewDeposit):", previewShares.toString());
        if (previewShares.isZero()) {
          console.warn("🔵 ⚠️ WARNING: previewDeposit returns 0 shares! This might cause the transaction to revert.");
        }
      } catch (previewError) {
        console.warn("🔵 Could not preview deposit (function may not exist):", previewError.message);
      }

      console.log("🔵 Sending deposit transaction...");
      const depositTx = await vaultContract.deposit(requiredAmount, account);
      console.log("🔵 Deposit tx hash:", depositTx.hash);
      console.log("🔵 Deposit tx:", {
        to: depositTx.to,
        from: depositTx.from,
        data: depositTx.data,
        value: depositTx.value?.toString(),
        gasLimit: depositTx.gasLimit?.toString(),
      });
      
      setTxHash(depositTx.hash);
      setStatus("Waiting for confirmation...");

      const receipt = await depositTx.wait();
      console.log("✅ Deposit confirmed:", receipt.transactionHash);
      console.log("🔵 Receipt status:", receipt.status);
      console.log("🔵 Receipt gas used:", receipt.gasUsed.toString());

      // Step 3: Refresh balances
      setStatus("Updating balances...");
      setShowStatus(false);
      onShowToast?.("success", `Successfully deposited ${amount} USDC!`, receipt.transactionHash);

      // Invalidate cache and refresh balances after transaction
      console.log("🔵 Refreshing balances after deposit transaction...");
      invalidateBalanceCache();
      const balanceRefreshStart = performance.now();
      await fetchBalances(true); // Force refresh after transaction
      const balanceRefreshTime = performance.now() - balanceRefreshStart;
      console.log(`🔵 Balance refresh completed in ${balanceRefreshTime.toFixed(2)}ms`);
      setAmount(""); // Clear input
      
      console.log("🔵 ========== DEPOSIT SUCCESS ==========");

    } catch (error) {
      console.error("❌ ========== DEPOSIT ERROR ==========");
      console.error("❌ Error object:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error data:", error.data);
      
      if (error.receipt) {
        console.error("❌ Transaction receipt:", error.receipt);
        console.error("❌ Receipt status:", error.receipt.status);
        console.error("❌ Receipt gas used:", error.receipt.gasUsed?.toString());
        console.error("❌ Receipt logs:", error.receipt.logs);
      }
      
      if (error.transaction) {
        console.error("❌ Transaction details:", {
          hash: error.transaction.hash,
          to: error.transaction.to,
          from: error.transaction.from,
          data: error.transaction.data,
          value: error.transaction.value?.toString(),
        });
      }
      
      // Try to decode revert reason if available
      if (error.data && typeof error.data === 'string' && error.data.startsWith('0x')) {
        console.error("❌ Revert data:", error.data);
        try {
          // Standard revert reason format: 0x08c379a0 (Error(string)) + offset + length + reason
          if (error.data.startsWith('0x08c379a0') && error.data.length >= 138) {
            try {
              const reason = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + error.data.slice(138));
              console.error("❌ Decoded revert reason:", reason[0]);
            } catch (decodeErr) {
              console.error("❌ Could not decode ABI-encoded revert reason:", decodeErr.message);
            }
          } else if (error.data.length >= 138) {
            // Try to decode as UTF-8 string
            try {
              const reason = ethers.utils.toUtf8String('0x' + error.data.slice(138));
              if (reason && reason.trim().length > 0) {
                console.error("❌ Revert reason (UTF-8):", reason);
              }
            } catch (e) {
              console.error("❌ Could not decode as UTF-8");
            }
          }
        } catch (decodeError) {
          console.error("❌ Could not decode revert reason:", decodeError);
        }
      }
      
      // Try to get revert reason from the transaction receipt
      if (error.receipt && error.receipt.status === 0 && error.transaction) {
        try {
          console.error("❌ Attempting to get revert reason from transaction...");
          // Try to call the transaction again to get the revert reason
          const provider = walletProvider;
          if (provider && provider.call) {
            try {
              const result = await provider.call({
                to: error.transaction.to,
                data: error.transaction.data,
                from: error.transaction.from || account,
                gasLimit: error.transaction.gasLimit
              });
              console.error("❌ Call result (should be empty if reverted):", result);
            } catch (callError) {
              console.error("❌ Call error message:", callError.message);
              if (callError.data && callError.data !== error.data) {
                console.error("❌ Call error data (different):", callError.data);
                // Try to decode this error data
                try {
                  if (callError.data && typeof callError.data === 'string' && 
                      callError.data.startsWith('0x08c379a0') && callError.data.length >= 138) {
                    const reason = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + callError.data.slice(138));
                    console.error("❌ Call error decoded reason:", reason[0]);
                  }
                } catch (e) {
                  console.error("❌ Could not decode call error");
                }
              }
            }
          }
        } catch (traceError) {
          console.error("❌ Could not trace transaction:", traceError);
        }
      }
      
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("User denied")) {
        onShowToast?.("error", "You cancelled the transaction. Please try again when ready.");
      } else if (msg.includes("insufficient funds") || msg.includes("gas required exceeds")) {
        onShowToast?.("error", "You don't have enough ETH to pay for gas fees. Please add ETH to your wallet.");
      } else {
        onShowToast?.("error", "Something went wrong with your deposit. Please try again.");
      }
      
      console.error("❌ ========== DEPOSIT ERROR END ==========");
    } finally {
      setIsLoading(false);
      setShowStatus(false);
    }
  };

  // Execute Withdrawal (Vault → USDC)
  const executeWithdrawal = async () => {
    console.log("🟠 ========== WITHDRAWAL START ==========");
    console.log("🟠 Input amount (string):", amount);
    console.log("🟠 Input amount (parsed float):", parseFloat(amount));
    
    if (!account || !walletProvider) {
      onShowToast?.("error", "Please connect your wallet");
      return;
    }

    if (chainId !== 8453) {
      onShowToast?.("error", "Please switch to Base network");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Please enter an amount to withdraw");
      return;
    }

    setIsLoading(true);
    setStatus("Preparing withdrawal...");
    setTxHash(null);

    try {
      const signer = walletProvider.getSigner();
      console.log("🟠 Signer address:", await signer.getAddress());

      // Create vault contract instance
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        signer
      );

      // Get vault token decimals and user's balance
      const vaultDecimals = await vaultContract.decimals();
      console.log("🟠 Vault decimals:", vaultDecimals);
      
      const userVaultBalance = await vaultContract.balanceOf(account);
      console.log("🟠 User vault balance (raw shares):", userVaultBalance.toString());
      
      // Get asset value of current vault balance
      const currentAssetsValue = await vaultContract.convertToAssets(userVaultBalance);
      console.log("🟠 Current assets value (raw):", currentAssetsValue.toString());
      console.log("🟠 Current assets value (formatted):", ethers.utils.formatUnits(currentAssetsValue, 6));

      // User enters amount in USDC terms, we need to convert to vault shares if needed
      // Using withdraw() function which takes assets (USDC) amount directly
      const usdcAmount = ethers.utils.parseUnits(amount, 6); // USDC has 6 decimals
      console.log("🟠 USDC amount (raw BigNumber):", usdcAmount.toString());
      console.log("🟠 USDC amount (formatted check):", ethers.utils.formatUnits(usdcAmount, 6));
      console.log("🟠 USDC amount string length:", usdcAmount.toString().length);
      console.log("🟠 USDC amount hex:", usdcAmount.toHexString());

      // Check if user has enough vault tokens to withdraw this amount
      // Convert the requested USDC amount to shares to check balance
      const requiredShares = await vaultContract.convertToShares(usdcAmount);
      console.log("🟠 Required shares (raw):", requiredShares.toString());
      console.log("🟠 Required shares vs balance:", {
        required: requiredShares.toString(),
        available: userVaultBalance.toString(),
        sufficient: userVaultBalance.gte(requiredShares)
      });

      if (userVaultBalance.lt(requiredShares)) {
        // Calculate max withdrawable
        const maxWithdrawableAssets = await vaultContract.convertToAssets(userVaultBalance);
        const maxUsdc = ethers.utils.formatUnits(maxWithdrawableAssets, 6);
        console.warn("🟠 Insufficient balance - max withdrawable:", maxUsdc);
        onShowToast?.("error", `Insufficient vault balance. Maximum: ${parseFloat(maxUsdc).toFixed(2)} USDC`);
        setIsLoading(false);
        return;
      }

      setStatus("Withdrawing from vault...");

      console.log("🟠 Vault address:", VAULT_ADDRESS);
      console.log("🟠 Withdraw params:");
      console.log("  - assets (usdcAmount):", usdcAmount.toString());
      console.log("  - receiver (account):", account);
      console.log("  - owner (account):", account);

      // Try to estimate gas first
      try {
        const estimatedGas = await vaultContract.estimateGas.withdraw(usdcAmount, account, account);
        console.log("🟠 Estimated gas:", estimatedGas.toString());
      } catch (gasError) {
        console.warn("🟠 Gas estimation failed:", gasError.message);
        console.warn("🟠 Gas error data:", gasError.data);
      }

      // Try to simulate the call
      try {
        const result = await vaultContract.callStatic.withdraw(usdcAmount, account, account);
        console.log("🟠 Simulated withdrawal result (shares):", result.toString());
      } catch (simError) {
        console.error("🟠 Static call simulation failed:", simError);
        console.error("🟠 Simulation error message:", simError.message);
        console.error("🟠 Simulation error data:", simError.data);
      }

      // Use withdraw() function - takes assets (USDC amount) and returns shares
      // withdraw(uint256 assets, address receiver, address owner)
      console.log("🟠 Sending withdrawal transaction...");
      const withdrawTx = await vaultContract.withdraw(usdcAmount, account, account);
      console.log("🟠 Withdraw tx hash:", withdrawTx.hash);
      console.log("🟠 Withdraw tx:", {
        to: withdrawTx.to,
        from: withdrawTx.from,
        data: withdrawTx.data,
        value: withdrawTx.value?.toString(),
        gasLimit: withdrawTx.gasLimit?.toString(),
      });
      
      setTxHash(withdrawTx.hash);
      setStatus("Waiting for confirmation...");

      const receipt = await withdrawTx.wait();
      console.log("✅ Withdrawal confirmed:", receipt.transactionHash);
      console.log("🟠 Receipt status:", receipt.status);
      console.log("🟠 Receipt gas used:", receipt.gasUsed.toString());

      setStatus("Updating balances...");
      setShowStatus(false);
      onShowToast?.("success", `Successfully withdrew ${amount} USDC!`, receipt.transactionHash);

      // Invalidate cache and refresh balances after transaction
      console.log("🟠 Refreshing balances after withdrawal transaction...");
      invalidateBalanceCache();
      const balanceRefreshStart = performance.now();
      await fetchBalances(true); // Force refresh after transaction
      const balanceRefreshTime = performance.now() - balanceRefreshStart;
      console.log(`🟠 Balance refresh completed in ${balanceRefreshTime.toFixed(2)}ms`);
      setAmount(""); // Clear input
      
      console.log("🟠 ========== WITHDRAWAL SUCCESS ==========");

    } catch (error) {
      console.error("❌ ========== WITHDRAWAL ERROR ==========");
      console.error("❌ Error object:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error data:", error.data);
      
      if (error.receipt) {
        console.error("❌ Transaction receipt:", error.receipt);
        console.error("❌ Receipt status:", error.receipt.status);
        console.error("❌ Receipt gas used:", error.receipt.gasUsed?.toString());
        console.error("❌ Receipt logs:", error.receipt.logs);
        console.error("❌ Receipt block number:", error.receipt.blockNumber);
      }
      
      if (error.transaction) {
        console.error("❌ Transaction details:", {
          hash: error.transaction.hash,
          to: error.transaction.to,
          from: error.transaction.from,
          data: error.transaction.data,
          value: error.transaction.value?.toString(),
        });
      }
      
      // Try to decode revert reason if available
      if (error.data && typeof error.data === 'string' && error.data.startsWith('0x')) {
        console.error("❌ Revert data:", error.data);
      }
      
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("User denied")) {
        onShowToast?.("error", "You cancelled the transaction. Please try again when ready.");
      } else {
        onShowToast?.("error", "Something went wrong with your withdrawal. Please try again.");
      }
      
      console.error("❌ ========== WITHDRAWAL ERROR END ==========");
    } finally {
      setIsLoading(false);
      setShowStatus(false);
    }
  };

  const handleActionClick = () => {
    setTxHash(null);
    
    if (!isConnected) {
      setShowWarning(true);
      return;
    }

    if (chainId !== 8453) {
      onShowToast?.("error", "Please switch to Base network");
      return;
    }

    setShowStatus(true);
    if (mode === "deposit") {
      executeDeposit();
    } else {
      executeWithdrawal();
    }
  };

  const yieldProjection = calculateYield();
  const withdrawSummary = calculateWithdrawSummary();

  return (
    <>
      <div className="vault-container">
        <div className="pool-detail-card">
          <h3 className="pool-title">X-Quo Yield</h3>
          
          <div className="pool-stats-grid">
            <div className="pool-stat">
              <span className="pool-stat-label">Your Position</span>
              <span className="pool-stat-value">${parseFloat(vaultBalance || 0).toFixed(2)}</span>
            </div>
            <div className="pool-stat">
              <span className="pool-stat-label">APY</span>
              <span className="pool-stat-value apy-highlight">{BASE_APY.toFixed(2)}%</span>
            </div>
            <div className="pool-stat">
              <span className="pool-stat-label">Network</span>
              <span className="pool-stat-value">Base</span>
            </div>
          </div>
        </div>

        <div className="vault-token-box">
          <div className="vault-token-header">
            <span className="vault-balance-label">
              Avail. {mode === "deposit"
                ? parseFloat(usdcBalance).toFixed(2)
                : parseFloat(vaultBalance).toFixed(6)}{" "}
              {mode === "deposit" ? "USDC" : "Vault"}
            </span>
            <button onClick={setMaxAmount} className="vault-max-button">
              MAX
            </button>
          </div>

          <div className="vault-input-row">
            <input
              type="text"
              inputMode="decimal"
              className="vault-amount-input"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
            />
          </div>

          <div className="vault-usd-value">
            {amount && parseFloat(amount) > 0
              ? `≈ $${parseFloat(amount).toFixed(2)}`
              : "≈ $0.00"}
          </div>
        </div>

        {mode === "deposit" && amount && parseFloat(amount) > 0 && (
          <div className="yield-projection">
            <h4 className="yield-title">Projected Earnings</h4>
            <div className="yield-grid">
              <div className="yield-item">
                <span className="yield-period">Daily</span>
                <span className="yield-amount">${yieldProjection.daily}</span>
              </div>
              <div className="yield-item">
                <span className="yield-period">Monthly</span>
                <span className="yield-amount">${yieldProjection.monthly}</span>
              </div>
              <div className="yield-item">
                <span className="yield-period">Yearly</span>
                <span className="yield-amount highlight">${yieldProjection.yearly}</span>
              </div>
            </div>
            <p className="yield-note">
              Based on {BASE_APY.toFixed(2)}% APY
            </p>
            {DEPOSIT_FEE !== null && (
              <div className="fee-notice">
                <span>Deposit Fee: {DEPOSIT_FEE}%</span>
              </div>
            )}
          </div>
        )}

        {mode === "withdraw" && amount && parseFloat(amount) > 0 && (
          <div className="withdraw-summary">
            <h4 className="withdraw-title">Withdrawal Summary</h4>
            <div className="withdraw-rows">
              <div className="withdraw-row">
                <span className="withdraw-label">Vault Tokens</span>
                <span className="withdraw-value">{amount}</span>
              </div>
              <div className="withdraw-row">
                <span className="withdraw-label">USDC (est.)</span>
                <span className="withdraw-value">${withdrawSummary.usdc}</span>
              </div>
              {WITHDRAWAL_FEE !== null && (
                <div className="withdraw-row warning">
                  <span className="withdraw-label">Fee ({WITHDRAWAL_FEE}%)</span>
                  <span className="withdraw-value">-${withdrawSummary.fee}</span>
                </div>
              )}
              <div className="withdraw-row total">
                <span className="withdraw-label">Net Amount</span>
                <span className="withdraw-value">${withdrawSummary.net}</span>
              </div>
            </div>
          </div>
        )}

        <button
          className="vault-action-button"
          onClick={handleActionClick}
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
        >
          <span className="vault-button-text">
            {isLoading
              ? "PROCESSING..."
              : mode === "deposit"
              ? "DEPOSIT"
              : "WITHDRAW"}
          </span>
        </button>
      </div>

      {showWarning &&
        ReactDOM.createPortal(
          <div className="vault-warning" onClick={closeWarning}>
            <div className="vault-warning__content" onClick={(e) => e.stopPropagation()}>
              <h3 className="vault-warning__title">Wallet not connected</h3>
              <p className="vault-warning__text">Connect Wallet to continue.</p>
              <div className="vault-warning__actions">
                <button className="btn-secondary" onClick={closeWarning}>Close</button>
                <button className="btn-primary" onClick={() => { closeWarning(); connectWallet(); }}>
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showStatus &&
        ReactDOM.createPortal(
          <div className="status-overlay">
            <div className="status-modal-positioned">
              <h3 className="status-modal-title">Operation Status</h3>
              {isLoading && (
                <div className="status-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              <p className="status-modal-text">
                {status || "Waiting..."}
              </p>
              {txHash && (
                <div style={{ marginTop: 12 }}>
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4a9eff', textDecoration: 'underline', fontSize: '0.9em' }}
                  >
                    View on BaseScan
                  </a>
                </div>
              )}
              {!isLoading && (
                <button className="status-close-btn" onClick={() => setShowStatus(false)}>
                  Close
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default VaultApp;

