import React, { useState, useEffect, useCallback } from "react";
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
  "function totalAssets() view returns (uint256)"
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
  
  // Fee configuration - conditional display
  const DEPOSIT_FEE = null; // Set to a number (e.g., 0.5) to show fee, or null to hide
  const WITHDRAWAL_FEE = 0.5; // Example: 0.5% withdrawal fee
  
  const BASE_APY = 8.5; // Vault APY

  // Fetch balances function (reusable)
  const fetchBalances = useCallback(async () => {
    console.log('🔍 Balance fetch triggered:', { account, hasProvider: !!walletProvider, chainId });
    
    if (!account || !walletProvider) {
      console.log('⏭️ Skipping balance fetch - missing account or provider');
      setUsdcBalance("0");
      setVaultBalance("0");
      return;
    }

    if (chainId !== 8453) {
      console.log(`⏭️ Skipping balance fetch - wrong network (chainId: ${chainId}, expected: 8453)`);
      setUsdcBalance("0");
      setVaultBalance("0");
      return;
    }

    try {
      console.log("🔄 Fetching balances...");
      console.log("  - Account:", account);
      console.log("  - Chain ID:", chainId);
      
      // Verify network matches before fetching
      const network = await walletProvider.getNetwork();
      console.log("  - Provider network chainId:", network.chainId);
      
      if (network.chainId !== 8453) {
        console.log(`⚠️ Network mismatch: Expected 8453 (Base), got ${network.chainId}. Skipping balance fetch.`);
        setUsdcBalance("0");
        setVaultBalance("0");
        return;
      }
      
      console.log("  - Fetching USDC balance from:", USDC_ADDRESS);
      // Fetch USDC balance
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        walletProvider
      );
      
      const [usdcBal, usdcDecimals] = await Promise.all([
        usdcContract.balanceOf(account),
        usdcContract.decimals()
      ]);
      
      console.log("  - USDC raw balance:", usdcBal.toString(), "decimals:", usdcDecimals);
      const formattedUsdc = ethers.utils.formatUnits(usdcBal, usdcDecimals);
      setUsdcBalance(formattedUsdc);
      console.log("  - USDC formatted balance:", formattedUsdc);
      
      console.log("  - Fetching vault balance from:", VAULT_ADDRESS);
      // Fetch vault balance (ERC-4626)
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        walletProvider
      );

      const [vaultTokenBalance, assetAddress] = await Promise.all([
        vaultContract.balanceOf(account),
        vaultContract.asset() // Verify it matches USDC
      ]);

      console.log("  - Vault token balance (shares):", vaultTokenBalance.toString());
      console.log("  - Vault asset address:", assetAddress);

      // Convert vault tokens to USDC value using convertToAssets
      let formattedVaultBalance = "0";
      if (!vaultTokenBalance.isZero()) {
        console.log("  - Converting shares to assets...");
        const assetsValue = await vaultContract.convertToAssets(vaultTokenBalance);
        const usdcDecimals = 6; // USDC has 6 decimals
        console.log("  - Assets value (raw):", assetsValue.toString());
        formattedVaultBalance = ethers.utils.formatUnits(assetsValue, usdcDecimals);
        console.log("  - Assets value (formatted):", formattedVaultBalance);
      }

      setVaultBalance(formattedVaultBalance);
      console.log("✅ Balance fetch complete - USDC:", formattedUsdc, "Vault:", formattedVaultBalance);
    } catch (error) {
      console.error("❌ Balance fetch error:", error);
      console.error("  - Error code:", error.code);
      console.error("  - Error message:", error.message);
      console.error("  - Error stack:", error.stack);
      
      // Handle network change errors gracefully
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('underlying network changed')) {
        console.log("⚠️ Network change detected during balance fetch. Will retry on next update.");
        // Don't reset balances to 0 immediately - wait for provider to update
        return;
      }
      
      console.log("⚠️ Setting balances to 0 due to error");
      setUsdcBalance("0");
      setVaultBalance("0");
    }
  }, [account, walletProvider, chainId]);

  // Fetch balances on mount/account change (with debounce to prevent rapid calls)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchBalances();
    }, 150); // Small delay to let provider settle after chain changes
    
    return () => clearTimeout(timeoutId);
  }, [fetchBalances]);

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
      const balance = await usdcContract.balanceOf(account);
      const requiredAmount = ethers.utils.parseUnits(amount, decimals);

      if (balance.lt(requiredAmount)) {
        const actualBalance = ethers.utils.formatUnits(balance, decimals);
        onShowToast?.("error", `You need ${amount} USDC but only have ${parseFloat(actualBalance).toFixed(2)} USDC.`);
        setIsLoading(false);
        return;
      }

      setStatus("Approving USDC...");

      // Step 1: Approve USDC for vault
      const approvalAmount = ethers.constants.MaxUint256; // Approve max for gas efficiency

      // Check current allowance first
      const currentAllowance = await usdcContract.allowance(account, VAULT_ADDRESS);
      if (currentAllowance.lt(requiredAmount)) {
        const approveTx = await usdcContract.approve(VAULT_ADDRESS, approvalAmount);
        setTxHash(approveTx.hash);
        await approveTx.wait();
        console.log("✅ USDC approved");
      }

      // Step 2: Deposit to vault
      setStatus("Depositing to vault...");
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        signer
      );

      const depositTx = await vaultContract.deposit(requiredAmount, account);
      setTxHash(depositTx.hash);
      setStatus("Waiting for confirmation...");

      const receipt = await depositTx.wait();
      console.log("✅ Deposit confirmed:", receipt.transactionHash);

      // Step 3: Refresh balances
      setStatus("Updating balances...");
      setShowStatus(false);
      onShowToast?.("success", `Successfully deposited ${amount} USDC!`, receipt.transactionHash);

      // Refresh balances
      await fetchBalances();
      setAmount(""); // Clear input

    } catch (error) {
      console.error("❌ Deposit error:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("User denied")) {
        onShowToast?.("error", "You cancelled the transaction. Please try again when ready.");
      } else if (msg.includes("insufficient funds") || msg.includes("gas required exceeds")) {
        onShowToast?.("error", "You don't have enough ETH to pay for gas fees. Please add ETH to your wallet.");
      } else {
        onShowToast?.("error", "Something went wrong with your deposit. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setShowStatus(false);
    }
  };

  // Execute Withdrawal (Vault → USDC)
  const executeWithdrawal = async () => {
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

      // Create vault contract instance
      const vaultContract = new ethers.Contract(
        VAULT_ADDRESS,
        VAULT_ABI,
        signer
      );

      // Get vault token decimals and user's balance
      const vaultDecimals = await vaultContract.decimals();
      const userVaultBalance = await vaultContract.balanceOf(account);

      // User enters amount in USDC terms, we need to convert to vault shares if needed
      // Using withdraw() function which takes assets (USDC) amount directly
      const usdcAmount = ethers.utils.parseUnits(amount, 6); // USDC has 6 decimals

      // Check if user has enough vault tokens to withdraw this amount
      // Convert the requested USDC amount to shares to check balance
      const requiredShares = await vaultContract.convertToShares(usdcAmount);

      if (userVaultBalance.lt(requiredShares)) {
        // Calculate max withdrawable
        const maxWithdrawableAssets = await vaultContract.convertToAssets(userVaultBalance);
        const maxUsdc = ethers.utils.formatUnits(maxWithdrawableAssets, 6);
        onShowToast?.("error", `Insufficient vault balance. Maximum: ${parseFloat(maxUsdc).toFixed(2)} USDC`);
        setIsLoading(false);
        return;
      }

      setStatus("Withdrawing from vault...");

      // Use withdraw() function - takes assets (USDC amount) and returns shares
      // withdraw(uint256 assets, address receiver, address owner)
      const withdrawTx = await vaultContract.withdraw(usdcAmount, account, account);
      setTxHash(withdrawTx.hash);
      setStatus("Waiting for confirmation...");

      const receipt = await withdrawTx.wait();
      console.log("✅ Withdrawal confirmed:", receipt.transactionHash);

      setStatus("Updating balances...");
      setShowStatus(false);
      onShowToast?.("success", `Successfully withdrew ${amount} USDC!`, receipt.transactionHash);

      // Refresh balances
      await fetchBalances();
      setAmount(""); // Clear input

    } catch (error) {
      console.error("❌ Withdrawal error:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("User denied")) {
        onShowToast?.("error", "You cancelled the transaction. Please try again when ready.");
      } else {
        onShowToast?.("error", "Something went wrong with your withdrawal. Please try again.");
      }
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

