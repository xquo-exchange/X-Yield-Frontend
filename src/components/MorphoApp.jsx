import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import "./MorphoApp.css";

// Placeholder Morpho vault address on Base (replace with actual address)
const MORPHO_VAULT_ADDRESS = "0x1440D8BE4003BE42005d7E25f15B01f1635F7640";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

const MorphoApp = ({ onShowToast, mode }) => {
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
  
  const BASE_APY = 8.5; // Example APY for Morpho

  // Fetch balances
  useEffect(() => {
    let mounted = true;
    
    const fetchBalances = async () => {
      if (!account || !walletProvider || chainId !== 8453) {
        setUsdcBalance("0");
        setVaultBalance("0");
        return;
      }

      try {
        console.log("🔄 Fetching balances...");
        
        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          walletProvider
        );
        
        const [usdcBal, usdcDecimals] = await Promise.all([
          usdcContract.balanceOf(account),
          usdcContract.decimals()
        ]);
        
        if (!mounted) return;
        const formattedUsdc = ethers.utils.formatUnits(usdcBal, usdcDecimals);
        setUsdcBalance(formattedUsdc);
        
        // TODO: Fetch vault balance from Morpho contract
        // For now, using placeholder value
        setVaultBalance("0");
        
        console.log("✅ Balances - USDC:", formattedUsdc, "Vault:", "0");
      } catch (error) {
        console.error("Balance fetch error:", error);
        if (!mounted) return;
        setUsdcBalance("0");
        setVaultBalance("0");
      }
    };

    fetchBalances();
    
    return () => { mounted = false; };
  }, [account, walletProvider, chainId]);

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

  // Execute Deposit (USDC → Morpho Vault) - PLACEHOLDER
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
          "function approve(address spender, uint256 amount) returns (bool)"
        ],
        signer
      );
      const metamorphoContract = new ethers.Contract(
        MORPHO_VAULT_ADDRESS, 
        [
          'function deposit(uint256 amount, address receiver) returns (uint256)'
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

      await usdcContract.approve(metamorphoTokenAddress, amount);
      const shares = await metamorphoContract.deposit(amount, signer.address); // Provider address è l'indirizzo del wallet che richiede la deposit (modificato) 
      
      console.log("📝 Deposit simulation:");
      console.log("  - Amount:", amount, "USDC");
      console.log("  - Vault:", MORPHO_VAULT_ADDRESS);
      console.log("  - User:", account);

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

  // Execute Withdrawal (Morpho Vault → USDC) - PLACEHOLDER
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
      setStatus("Withdrawing...");
      
      // TODO: Replace with actual Morpho vault contract interaction
      onShowToast?.("error", "Morpho integration pending. This is a demo interface showing the UX flow.");
      
      console.log("📝 Withdrawal simulation:");
      console.log("  - Amount:", amount, "vault tokens");
      console.log("  - Vault:", MORPHO_VAULT_ADDRESS);
      console.log("  - User:", account);

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
      <div className="morpho-container">
        <div className="pool-detail-card">
          <h3 className="pool-title">Morpho Vault on Base</h3>
          
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
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
        >
          <span className="morpho-button-text">
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

