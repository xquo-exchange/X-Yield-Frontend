import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useUsdcBalance } from "../hooks/useUsdcBalance";
import { useAllowance } from "../hooks/useAllowance";
import { useVaultBalance } from "../hooks/useVaultBalance";
import { useApprove } from "../hooks/useApprove";
import { useDeposit } from "../hooks/useDeposit";
import { useWithdraw } from "../hooks/useWithdraw";
import { BASE_CHAIN_ID, USDC_DECIMALS } from "../lib/const/base";
import "./MorphoApp.css";

const MorphoApp = ({ onShowToast, mode }) => {
  const { walletAddress: account, isConnected, connectWallet, provider: walletProvider, chainId, switchToBase } = useWallet();
  
  const [showWarning, setShowWarning] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [txHash, setTxHash] = useState(null);
  
  // Fee configuration - conditional display
  const DEPOSIT_FEE = null; // Set to a number (e.g., 0.5) to show fee, or null to hide
  const WITHDRAWAL_FEE = 0.5; // Example: 0.5% withdrawal fee
  
  const BASE_APY = 8.5; // Example APY for Morpho

  // Use hooks for balances and transactions
  const { balance: usdcBalance } = useUsdcBalance(walletProvider, account);
  const { balance: vaultBalance } = useVaultBalance(walletProvider, account);
  const { allowance } = useAllowance(walletProvider, account);
  const { approve, isPending: isApprovePending, txHash: approveTxHash } = useApprove();
  const { deposit, isPending: isDepositPending, txHash: depositTxHash } = useDeposit();
  const { withdraw, getMaxWithdraw, isPending: isWithdrawPending, txHash: withdrawTxHash } = useWithdraw();

  const isLoading = isApprovePending || isDepositPending || isWithdrawPending;
  const currentTxHash = approveTxHash || depositTxHash || withdrawTxHash;

  // Update txHash when transaction hash changes
  useEffect(() => {
    if (currentTxHash) {
      setTxHash(currentTxHash);
    }
  }, [currentTxHash]);

  // Check if user is on correct network
  const isCorrectNetwork = chainId === BASE_CHAIN_ID;

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

  const setMaxAmount = async () => {
    if (mode === "deposit") {
      if (!usdcBalance || parseFloat(usdcBalance) <= 0) {
        onShowToast?.("error", "No USDC balance");
        return;
      }
      // Subtract 1 unit (in 6 decimals) to avoid dust/rounding issues
      const balanceBN = ethers.utils.parseUnits(usdcBalance, USDC_DECIMALS);
      const oneUnit = ethers.utils.parseUnits("1", USDC_DECIMALS);
      const maxAmount = balanceBN.sub(oneUnit);
      if (maxAmount.lte(0)) {
        setAmount(usdcBalance);
      } else {
        setAmount(ethers.utils.formatUnits(maxAmount, USDC_DECIMALS));
      }
    } else {
      // For withdraw, get max withdraw from vault
      if (!walletProvider || !account) {
        onShowToast?.("error", "Wallet not connected");
        return;
      }
      try {
        const maxWithdraw = await getMaxWithdraw(walletProvider, account);
        if (maxWithdraw && parseFloat(maxWithdraw) > 0) {
          setAmount(maxWithdraw);
        } else {
          onShowToast?.("error", "No vault balance available");
        }
      } catch (error) {
        console.error("Error getting max withdraw:", error);
        // Fallback to vault balance display
        if (vaultBalance && parseFloat(vaultBalance) > 0) {
          setAmount(vaultBalance);
        } else {
          onShowToast?.("error", "No vault balance available");
        }
      }
    }
  };

  // Execute Deposit (USDC → xPLS Vault)
  const executeDeposit = async () => {
    if (!account || !walletProvider) {
      onShowToast?.("error", "Please connect your wallet");
      return;
    }

    if (!isCorrectNetwork) {
      const result = await switchToBase();
      if (!result.success) {
        onShowToast?.("error", "Please switch to Base network");
        return;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Please enter an amount to deposit");
      return;
    }

    const amountBN = ethers.utils.parseUnits(amount, USDC_DECIMALS);
    const balanceBN = ethers.utils.parseUnits(usdcBalance || "0", USDC_DECIMALS);

    if (balanceBN.lt(amountBN)) {
      onShowToast?.("error", `Insufficient balance. You have ${parseFloat(usdcBalance || "0").toFixed(2)} USDC.`);
      return;
    }

    setShowStatus(true);
    setStatus("Preparing deposit...");
    setTxHash(null);

    try {
      // Check if approval is needed
      const allowanceBN = ethers.utils.parseUnits(allowance || "0", USDC_DECIMALS);

      if (allowanceBN.lt(amountBN)) {
        setStatus("Approving USDC...");
        onShowToast?.("info", "Approving USDC...");

        const approveResult = await approve(walletProvider, amount);
        
        if (!approveResult.success) {
          if (approveResult.error?.includes("rejected")) {
            onShowToast?.("error", "Approval cancelled");
          } else {
            onShowToast?.("error", approveResult.error || "Approval failed");
          }
          setShowStatus(false);
          return;
        }

        if (approveResult.txHash) {
          setTxHash(approveResult.txHash);
          onShowToast?.("success", "USDC approved! Proceeding with deposit...");
        }

        // Wait a bit for the approval to be mined
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setStatus("Depositing to vault...");
      onShowToast?.("info", "Depositing...");

      const depositResult = await deposit(walletProvider, amount, account);

      if (!depositResult.success) {
        if (depositResult.error?.includes("rejected")) {
          onShowToast?.("error", "Deposit cancelled");
        } else {
          onShowToast?.("error", depositResult.error || "Deposit failed");
        }
        setShowStatus(false);
        return;
      }

      if (depositResult.txHash) {
        setTxHash(depositResult.txHash);
        onShowToast?.("success", `Deposit successful!`, depositResult.txHash);
        setStatus("Deposit completed!");
        setAmount(""); // Clear input on success
      }

    } catch (error) {
      console.error("❌ Deposit error:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied")) {
        onShowToast?.("error", "Transaction cancelled");
      } else if (msg.includes("insufficient funds") || msg.includes("gas")) {
        onShowToast?.("error", "Insufficient ETH for gas fees");
      } else {
        onShowToast?.("error", "Deposit failed. Please try again.");
      }
      setShowStatus(false);
    }
  };

  // Execute Withdrawal (xPLS Vault → USDC)
  const executeWithdrawal = async () => {
    if (!account || !walletProvider) {
      onShowToast?.("error", "Please connect your wallet");
      return;
    }

    if (!isCorrectNetwork) {
      const result = await switchToBase();
      if (!result.success) {
        onShowToast?.("error", "Please switch to Base network");
        return;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Please enter an amount to withdraw");
      return;
    }

    setShowStatus(true);
    setStatus("Preparing withdrawal...");
    setTxHash(null);

    try {
      setStatus("Withdrawing from vault...");
      onShowToast?.("info", "Withdrawing...");

      // Withdraw assets (USDC amount)
      const withdrawResult = await withdraw(walletProvider, amount, account, account);

      if (!withdrawResult.success) {
        if (withdrawResult.error?.includes("rejected")) {
          onShowToast?.("error", "Withdrawal cancelled");
        } else if (withdrawResult.error?.includes("insufficient")) {
          onShowToast?.("error", "Insufficient vault balance");
        } else {
          onShowToast?.("error", withdrawResult.error || "Withdrawal failed");
        }
        setShowStatus(false);
        return;
      }

      if (withdrawResult.txHash) {
        setTxHash(withdrawResult.txHash);
        onShowToast?.("success", `Withdrawal successful!`, withdrawResult.txHash);
        setStatus("Withdrawal completed!");
        setAmount(""); // Clear input on success
      }

    } catch (error) {
      console.error("❌ Withdrawal error:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied")) {
        onShowToast?.("error", "Transaction cancelled");
      } else if (msg.includes("insufficient funds") || msg.includes("gas")) {
        onShowToast?.("error", "Insufficient ETH for gas fees");
      } else {
        onShowToast?.("error", "Withdrawal failed. Please try again.");
      }
      setShowStatus(false);
    }
  };

  const handleActionClick = async () => {
    setTxHash(null);
    
    if (!isConnected) {
      setShowWarning(true);
      return;
    }

    if (!isCorrectNetwork) {
      const result = await switchToBase();
      if (!result.success) {
        onShowToast?.("error", "Please switch to Base network");
        return;
      }
      // Wait a bit for network switch
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check if button should be disabled
    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Please enter an amount");
      return;
    }

    if (mode === "deposit") {
      const amountBN = ethers.utils.parseUnits(amount, USDC_DECIMALS);
      const balanceBN = ethers.utils.parseUnits(usdcBalance || "0", USDC_DECIMALS);
      if (balanceBN.lt(amountBN)) {
        onShowToast?.("error", "Insufficient USDC balance");
        return;
      }
      await executeDeposit();
    } else {
      await executeWithdrawal();
    }
  };

  // Determine button text and state
  const getButtonText = () => {
    if (isLoading) {
      if (isApprovePending) return "APPROVING...";
      if (isDepositPending) return "DEPOSITING...";
      if (isWithdrawPending) return "WITHDRAWING...";
      return "PROCESSING...";
    }

    if (mode === "deposit") {
      // Check if approval is needed
      if (amount && parseFloat(amount) > 0) {
        const amountBN = ethers.utils.parseUnits(amount, USDC_DECIMALS);
        const allowanceBN = ethers.utils.parseUnits(allowance || "0", USDC_DECIMALS);
        if (allowanceBN.lt(amountBN)) {
          return "APPROVE";
        }
      }
      return "DEPOSIT";
    } else {
      return "WITHDRAW";
    }
  };

  const isButtonDisabled = () => {
    if (isLoading) return true;
    if (!isConnected) return true;
    if (!isCorrectNetwork) return false; // Allow click to trigger network switch
    if (!amount || parseFloat(amount) <= 0) return true;
    
    if (mode === "deposit") {
      const amountBN = ethers.utils.parseUnits(amount, USDC_DECIMALS);
      const balanceBN = ethers.utils.parseUnits(usdcBalance || "0", USDC_DECIMALS);
      return balanceBN.lt(amountBN);
    }
    
    return false;
  };

  const yieldProjection = calculateYield();
  const withdrawSummary = calculateWithdrawSummary();

  return (
    <>
      <div className="morpho-container">
        <div className="pool-detail-card">
          <h3 className="pool-title">X-QUO VAULT</h3>
          
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

        <div className="morpho-token-box">
          <div className="morpho-token-header">
            <span className="morpho-balance-label">
              Avail. {mode === "deposit"
                ? parseFloat(usdcBalance).toFixed(2)
                : parseFloat(vaultBalance).toFixed(6)}{" "}
              {mode === "deposit" ? "USDC" : "Vault"}
            </span>
            <button onClick={setMaxAmount} className="morpho-max-button">
              MAX
            </button>
          </div>

          <div className="morpho-input-row">
            <input
              type="text"
              inputMode="decimal"
              className="morpho-amount-input"
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

          <div className="morpho-usd-value">
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
          className="morpho-action-button"
          onClick={handleActionClick}
          disabled={isButtonDisabled()}
        >
          <span className="morpho-button-text">
            {getButtonText()}
          </span>
        </button>
      </div>

      {showWarning &&
        ReactDOM.createPortal(
          <div className="morpho-warning" onClick={closeWarning}>
            <div className="morpho-warning__content" onClick={(e) => e.stopPropagation()}>
              <h3 className="morpho-warning__title">Wallet not connected</h3>
              <p className="morpho-warning__text">Connect Wallet to continue.</p>
              <div className="morpho-warning__actions">
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

export default MorphoApp;

