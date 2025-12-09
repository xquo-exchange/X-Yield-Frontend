import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { sendGTMEvent } from "../utils/gtm";
import "./MorphoApp.css";
import { computeAPY } from "../utils/calculateYield"
import PoweredByMorpho from "./PoweredByMorpho";
import EmailBanner from "./EmailBanner";
import InfoModal, { InfoButton } from "./InfoModal/InfoModal";
import ReferralRewards from "./ReferralRewards";

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
    "function previewWithdraw(uint256 assets) view returns (uint256 shares)",
    "function maxWithdraw(address owner) view returns (uint256)" // Maximum withdrawable assets
];

const VaultApp = ({ onShowToast, mode, setMode }) => {
    const {
        walletAddress: account,
        isConnected,
        connectWallet,
        provider: walletProvider,
        chainId,
        usdcBalance,
        vaultBalance,
        fetchBalances,
        invalidateBalanceCache,
        isBalancesLoading
    } = useWallet();

    // Check if we're in Farcaster
    const isFarcaster = typeof navigator !== 'undefined' &&
        /Farcaster|Warpcast/i.test(navigator.userAgent);

    const [showWarning, setShowWarning] = useState(false);
    const [amount, setAmount] = useState("");
    const [status, setStatus] = useState("");
    const [showStatus, setShowStatus] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [txHash, setTxHash] = useState(null);
    const [infoModalType, setInfoModalType] = useState(null);

    // Fee configuration - conditional display
    const DEPOSIT_FEE = null; // Set to a number (e.g., 0.5) to show fee, or null to hide
    const WITHDRAWAL_FEE = 0.5; // Example: 0.5% withdrawal fee

    const [BASE_APY, setBaseApy] = useState(0);
    const [isApyLoading, setIsApyLoading] = useState(true);

    useEffect(() => {
        if (isConnected && showWarning) setShowWarning(false);
    }, [isConnected, showWarning]);

    const closeWarning = () => {
        setShowWarning(false);
    };


    useEffect(() => {
        async function fetchData() {
            setIsApyLoading(true);
            try {
                const newApy = await computeAPY();
                setBaseApy(newApy);
            } catch (error) {
                console.error("Error fetching APY:", error);
                setBaseApy(0);
            } finally {
                setIsApyLoading(false);
            }
        }
        fetchData();
    }, [isConnected]);

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

            // FARCASTER FIX: Don't call getAddress() on Farcaster signer (uses eth_call)
            // We already have the account address from wallet context
            if (!isFarcaster) {
                console.log("🔵 Signer address:", await signer.getAddress());
            } else {
                console.log("🔵 Signer address (from context):", account);
            }

            // FARCASTER FIX: Use fallback RPC for read operations
            let readProvider = walletProvider;
            if (isFarcaster) {
                console.log("🔄 Farcaster detected - using fallback RPC for reads");
                readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
            }

            // Check USDC balance using READ provider
            const usdcContractRead = new ethers.Contract(
                USDC_ADDRESS,
                [
                    "function balanceOf(address) view returns (uint256)",
                    "function decimals() view returns (uint8)",
                    "function allowance(address owner, address spender) view returns (uint256)"
                ],
                readProvider
            );

            // Separate contract for WRITE operations (approve)
            const usdcContractWrite = new ethers.Contract(
                USDC_ADDRESS,
                [
                    "function approve(address spender, uint256 amount) returns (bool)",
                ],
                signer
            );

            const decimals = await usdcContractRead.decimals();
            console.log("🔵 USDC decimals:", decimals);

            const balance = await usdcContractRead.balanceOf(account);
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
            const approvalAmount = requiredAmount; // Approve exact amount only
            console.log("🔵 Approval amount (exact):", approvalAmount.toString());

            // Check current allowance first (READ operation)
            const currentAllowance = await usdcContractRead.allowance(account, VAULT_ADDRESS);
            console.log("🔵 Current allowance (raw):", currentAllowance.toString());
            console.log("🔵 Current allowance (formatted):", ethers.utils.formatUnits(currentAllowance, decimals));
            console.log("🔵 Allowance sufficient?", currentAllowance.gte(requiredAmount));

            if (currentAllowance.lt(requiredAmount)) {
                console.log("🔵 Approving USDC...");

                try {
                    // Estimate gas using readProvider (public RPC) first
                    let overrides = {};
                    if (isFarcaster) {
                        console.log("🔵 Estimating approval gas with readProvider...");
                        try {
                            // Manually estimate gas using the read provider
                            // We need to construct the transaction data manually since we can't use the write contract for estimation
                            const data = usdcContractWrite.interface.encodeFunctionData("approve", [VAULT_ADDRESS, approvalAmount]);
                            const estimatedGas = await readProvider.estimateGas({
                                to: USDC_ADDRESS,
                                from: account,
                                data: data,
                                value: 0
                            });
                            console.log("🔵 Estimated gas:", estimatedGas.toString());

                            // Add buffer and set overrides
                            overrides = {
                                gasLimit: estimatedGas.mul(120).div(100)
                            };
                            console.log("🔵 Using overrides:", overrides);
                        } catch (estimateError) {
                            console.warn("⚠️ Gas estimation failed, using fallback:", estimateError);
                            overrides = { gasLimit: ethers.BigNumber.from("100000") }; // Safe default for approve
                        }
                    }

                    const approveTx = await usdcContractWrite.approve(VAULT_ADDRESS, approvalAmount, overrides);
                    console.log("🔵 Approval transaction received");
                    console.log("🔵 Transaction object type:", typeof approveTx);
                    console.log("🔵 Transaction object keys:", Object.keys(approveTx || {}));

                    try {
                        console.log("🔵 Trying to access tx.hash:", approveTx.hash);
                        setTxHash(approveTx.hash);
                    } catch (hashError) {
                        console.error("❌ Error accessing transaction hash:", hashError);
                    }

                    // FARCASTER FIX: Use readProvider to wait for transaction (Farcaster provider can't check status)
                    console.log("🔵 About to wait for approval confirmation...");
                    if (isFarcaster) {
                        console.log("🔵 Using readProvider.waitForTransaction for Farcaster");
                        if (!approveTx.hash) {
                            throw new Error("Transaction hash is missing");
                        }
                        const receipt = await readProvider.waitForTransaction(approveTx.hash);
                        console.log("✅ USDC approved (via fallback provider), receipt:", receipt);
                    } else {
                        console.log("🔵 Using approveTx.wait() for desktop");
                        await approveTx.wait();
                        console.log("✅ USDC approved");
                    }
                } catch (approvalError) {
                    console.error("❌ Approval or wait error:", approvalError);
                    console.error("❌ Error details:", {
                        message: approvalError.message,
                        code: approvalError.code,
                        data: approvalError.data,
                        stack: approvalError.stack
                    });
                    throw approvalError; // Re-throw to be caught by outer catch
                }
            } else {
                console.log("🔵 Skipping approval - allowance already sufficient");
            }

            // Step 2: Deposit to vault
            setStatus("Depositing to vault...");

            // Vault contract for WRITE operations (deposit)
            const vaultContractWrite = new ethers.Contract(
                VAULT_ADDRESS,
                VAULT_ABI,
                signer
            );

            // Vault contract for READ operations (in Farcaster, use fallback)
            const vaultContractRead = new ethers.Contract(
                VAULT_ADDRESS,
                VAULT_ABI,
                isFarcaster ? readProvider : walletProvider
            );

            console.log("🔵 Vault address:", VAULT_ADDRESS);
            console.log("🔵 Deposit params:");
            console.log("  - assets (requiredAmount):", requiredAmount.toString());
            console.log("  - receiver (account):", account);

            // Skip gas estimation and simulation in Farcaster (they use eth_call which fails)
            if (!isFarcaster) {
                // Try to estimate gas first
                try {
                    const estimatedGas = await vaultContractWrite.estimateGas.deposit(requiredAmount, account);
                    console.log("🔵 Estimated gas:", estimatedGas.toString());
                } catch (gasError) {
                    console.warn("🔵 Gas estimation failed:", gasError.message);
                }

                // Try to simulate the call
                try {
                    const result = await vaultContractWrite.callStatic.deposit(requiredAmount, account);
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
            } else {
                console.log("🔵 Skipping gas estimation/simulation in Farcaster");
            }

            // Double-check USDC balance right before deposit (READ operation)
            const balanceBeforeDeposit = await usdcContractRead.balanceOf(account);
            console.log("🔵 USDC balance right before deposit:", balanceBeforeDeposit.toString());
            console.log("🔵 Balance >= required?", balanceBeforeDeposit.gte(requiredAmount));

            // Verify allowance one more time (READ operation)
            const finalAllowance = await usdcContractRead.allowance(account, VAULT_ADDRESS);
            console.log("🔵 Final allowance check:", finalAllowance.toString());
            console.log("🔵 Allowance >= required?", finalAllowance.gte(requiredAmount));

            // Check vault state before deposit (READ operations)
            try {
                const totalAssets = await vaultContractRead.totalAssets();
                console.log("🔵 Vault totalAssets:", totalAssets.toString());
                const assetAddress = await vaultContractRead.asset();
                console.log("🔵 Vault asset address:", assetAddress);
                console.log("🔵 Asset matches USDC?", assetAddress.toLowerCase() === USDC_ADDRESS.toLowerCase());
            } catch (vaultCheckError) {
                console.warn("🔵 Could not check vault state:", vaultCheckError.message);
            }

            // Try to preview the deposit to see what shares we'd get (READ operation)
            try {
                const previewShares = await vaultContractRead.previewDeposit(requiredAmount);
                console.log("🔵 Preview shares (previewDeposit):", previewShares.toString());
                if (previewShares.isZero()) {
                    console.warn("🔵 ⚠️ WARNING: previewDeposit returns 0 shares! This might cause the transaction to revert.");
                }
            } catch (previewError) {
                console.warn("🔵 Could not preview deposit (function may not exist):", previewError.message);
            }

            console.log("🔵 Sending deposit transaction...");

            let depositOverrides = {};
            if (isFarcaster) {
                console.log("🔵 Estimating deposit gas with readProvider...");
                try {
                    // Manually estimate gas using the read provider for deposit
                    const data = vaultContractWrite.interface.encodeFunctionData("deposit", [requiredAmount, account]);
                    const estimatedGas = await readProvider.estimateGas({
                        to: VAULT_ADDRESS,
                        from: account,
                        data: data,
                        value: 0
                    });
                    console.log("🔵 Estimated gas for deposit:", estimatedGas.toString());

                    // Add buffer and set overrides
                    depositOverrides = {
                        gasLimit: estimatedGas.mul(120).div(100)
                    };
                    console.log("🔵 Using deposit overrides:", depositOverrides);
                } catch (estimateError) {
                    console.warn("⚠️ Gas estimation failed for deposit, using fallback:", estimateError);
                    depositOverrides = { gasLimit: ethers.BigNumber.from("500000") }; // Safe default for ERC4626 deposit
                }
            }

            const depositTx = await vaultContractWrite.deposit(requiredAmount, account, depositOverrides);
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

            // FARCASTER FIX: Use readProvider to wait for transaction (Farcaster provider can't check status)
            let receipt;
            if (isFarcaster) {
                receipt = await readProvider.waitForTransaction(depositTx.hash);
                console.log("✅ Deposit confirmed (via fallback provider):", receipt.transactionHash);
            } else {
                receipt = await depositTx.wait();
                console.log("✅ Deposit confirmed:", receipt.transactionHash);
            }
            console.log("🔵 Receipt status:", receipt.status);
            console.log("🔵 Receipt gas used:", receipt.gasUsed.toString());

            // Step 3: Refresh balances
            setStatus("Updating balances...");
            setShowStatus(false);
            onShowToast?.("success", `Successfully deposited ${amount} USDC!`, receipt.transactionHash);

            //GTM Deposit
            sendGTMEvent('Deposit', {
                apy_percent: BASE_APY,
                amount_usd: parseFloat(amount),
                network: 'Base'
            });

            // Invalidate cache and refresh balances after transaction
            invalidateBalanceCache();
            await fetchBalances(true); // Force refresh after transaction
            setAmount(""); // Clear input

            console.log("🔵 ========== DEPOSIT SUCCESS ==========");

        } catch (error) {
            console.error("❌ ========== DEPOSIT ERROR ==========");
            console.error("❌ Error object:", error);
            console.error("❌ Error message:", error.message);
            console.error("❌ Error code:", error.code);
            console.error("❌ Error data:", error.data);

            if (isFarcaster) {
            }

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

        if (isFarcaster) {
        }

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

            // FARCASTER FIX: Don't call getAddress() on Farcaster signer (uses eth_call)
            // We already have the account address from wallet context
            if (!isFarcaster) {
                console.log("🟠 Signer address:", await signer.getAddress());
            } else {
                console.log("🟠 Signer address (from context):", account);
            }

            // FARCASTER FIX: Use fallback RPC for read operations
            let readProvider = walletProvider;
            if (isFarcaster) {
                console.log("🔄 Farcaster detected - using fallback RPC for reads");
                readProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
            }

            // Create vault contract instances
            // WRITE operations (withdraw)
            const vaultContractWrite = new ethers.Contract(
                VAULT_ADDRESS,
                VAULT_ABI,
                signer
            );

            // READ operations (balanceOf, decimals, convertToAssets, etc.)
            const vaultContractRead = new ethers.Contract(
                VAULT_ADDRESS,
                VAULT_ABI,
                readProvider
            );

            // Get vault token decimals and user's balance (READ operations)
            const vaultDecimals = await vaultContractRead.decimals();
            console.log("🟠 Vault decimals:", vaultDecimals);

            const userVaultBalance = await vaultContractRead.balanceOf(account);
            console.log("🟠 User vault balance (raw shares):", userVaultBalance.toString());

            // Get asset value of current vault balance (READ operation)
            const currentAssetsValue = await vaultContractRead.convertToAssets(userVaultBalance);
            console.log("🟠 Current assets value (raw):", currentAssetsValue.toString());
            console.log("🟠 Current assets value (formatted):", ethers.utils.formatUnits(currentAssetsValue, 6));

            // User enters amount in USDC terms, we need to convert to vault shares if needed
            // Using withdraw() function which takes assets (USDC) amount directly
            let usdcAmount = ethers.utils.parseUnits(amount, 6); // USDC has 6 decimals
            console.log("🟠 USDC amount (raw BigNumber):", usdcAmount.toString());
            console.log("🟠 USDC amount (formatted check):", ethers.utils.formatUnits(usdcAmount, 6));
            console.log("🟠 USDC amount string length:", usdcAmount.toString().length);
            console.log("🟠 USDC amount hex:", usdcAmount.toHexString());

            // CRITICAL: Check the actual maximum withdrawable amount from the vault
            // This accounts for ERC-4626 rounding and prevents 0x4323a555 errors (READ operation)
            const maxWithdrawable = await vaultContractRead.maxWithdraw(account);
            console.log("🟠 Max withdrawable (from vault):", maxWithdrawable.toString());
            console.log("🟠 Max withdrawable (formatted):", ethers.utils.formatUnits(maxWithdrawable, 6));

            // Cap the withdrawal amount to maxWithdrawable if it exceeds it
            if (usdcAmount.gt(maxWithdrawable)) {
                console.warn("🟠 ⚠️ Requested amount exceeds maxWithdrawable, capping to max");
                usdcAmount = maxWithdrawable;
                const cappedAmountFormatted = ethers.utils.formatUnits(maxWithdrawable, 6);
                console.log("🟠 Capped withdrawal amount:", cappedAmountFormatted);
            }

            // Check if user has enough vault tokens to withdraw this amount
            // Convert the requested USDC amount to shares to check balance (READ operation)
            const requiredShares = await vaultContractRead.convertToShares(usdcAmount);
            console.log("🟠 Required shares (raw):", requiredShares.toString());
            console.log("🟠 Required shares vs balance:", {
                required: requiredShares.toString(),
                available: userVaultBalance.toString(),
                sufficient: userVaultBalance.gte(requiredShares)
            });

            if (userVaultBalance.lt(requiredShares)) {
                // Calculate max withdrawable (READ operation)
                const maxWithdrawableAssets = await vaultContractRead.convertToAssets(userVaultBalance);
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

            // Check ETH balance for gas first (READ operation)
            const ethBalance = await readProvider.getBalance(account);
            console.log("🟠 ETH balance (raw):", ethBalance.toString());
            console.log("🟠 ETH balance (formatted):", ethers.utils.formatEther(ethBalance));

            // Minimum gas required (rough estimate: 0.0001 ETH should be enough for most transactions)
            const minGasRequired = ethers.utils.parseEther("0.0001");
            if (ethBalance.lt(minGasRequired)) {
                onShowToast?.("error", "Insufficient ETH for gas fees. Please add ETH to your wallet.");
                setIsLoading(false);
                return;
            }

            // Skip simulation and gas estimation in Farcaster (they use eth_call which fails)
            let gasLimit;
            if (!isFarcaster) {
                // Try to simulate the call first to catch revert reasons
                try {
                    const result = await vaultContractWrite.callStatic.withdraw(usdcAmount, account, account);
                    console.log("🟠 ✅ Static call simulation passed - shares to burn:", result.toString());
                } catch (simError) {
                    console.error("🟠 ❌ Static call simulation failed:", simError);
                    console.error("🟠 Simulation error message:", simError.message);
                    console.error("🟠 Simulation error data:", simError.data);

                    // Check if it's a specific revert reason we can decode
                    if (simError.data && typeof simError.data === 'string') {
                        // Try to decode custom error
                        const errorData = simError.data;
                        console.error("🟠 Error data (hex):", errorData);

                        // Common ERC-4626 errors
                        if (errorData === "0x4323a555") {
                            onShowToast?.("error", "Withdrawal amount exceeds available assets. Please check your balance.");
                        } else if (errorData.startsWith("0x08c379a0")) {
                            // Try to decode string error
                            try {
                                const reason = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + errorData.slice(138));
                                onShowToast?.("error", `Transaction would fail: ${reason[0]}`);
                            } catch (e) {
                                onShowToast?.("error", "Transaction would fail. Please check your balance and try again.");
                            }
                        } else {
                            onShowToast?.("error", "Transaction simulation failed. Please check your balance and try again.");
                        }
                    } else {
                        onShowToast?.("error", "Transaction would fail. Please check your balance and try again.");
                    }
                    setIsLoading(false);
                    return;
                }

                // Estimate gas with fallback - CRITICAL for reliable transactions
                try {
                    const estimatedGas = await vaultContractWrite.estimateGas.withdraw(usdcAmount, account, account);
                    // Add 20% buffer for safety
                    gasLimit = estimatedGas.mul(120).div(100);
                    console.log("🟠 ✅ Estimated gas:", estimatedGas.toString());
                    console.log("🟠 ✅ Gas limit with 20% buffer:", gasLimit.toString());
                } catch (gasError) {
                    console.warn("🟠 ⚠️ Gas estimation failed, using fallback gas limit:", gasError.message);
                    // Fallback: Use a safe default gas limit for ERC-4626 withdrawals
                    // Typical withdrawal operations use 150k-300k gas, so 400k is a safe upper bound
                    gasLimit = ethers.BigNumber.from("400000");
                    console.log("🟠 ⚠️ Using fallback gas limit:", gasLimit.toString());

                    // Even though estimation failed, if simulation passed, we can still try
                    // But log a warning
                    console.warn("🟠 ⚠️ Proceeding with fallback gas limit - transaction may still succeed");
                }
            } else {
                // Farcaster: Skip simulation and use fallback gas limit or manual estimation
                console.log("🟠 Skipping simulation in Farcaster");
                try {
                    console.log("🟠 Estimating withdrawal gas with readProvider...");
                    const data = vaultContractWrite.interface.encodeFunctionData("withdraw", [usdcAmount, account, account]);
                    const estimatedGas = await readProvider.estimateGas({
                        to: VAULT_ADDRESS,
                        from: account,
                        data: data,
                        value: 0
                    });
                    console.log("🟠 Estimated gas for withdrawal:", estimatedGas.toString());
                    gasLimit = estimatedGas.mul(120).div(100);
                } catch (err) {
                    console.warn("⚠️ Gas estimation failed for withdrawal, using fallback:", err);
                    gasLimit = ethers.BigNumber.from("500000");
                }
            }

            // Verify we have enough ETH for the gas (READ operation)
            const gasPrice = await readProvider.getGasPrice();
            const maxGasCost = gasLimit.mul(gasPrice);
            console.log("🟠 Gas price:", gasPrice.toString());
            console.log("🟠 Max gas cost:", ethers.utils.formatEther(maxGasCost), "ETH");

            if (ethBalance.lt(maxGasCost)) {
                onShowToast?.("error", `Insufficient ETH for gas. Need ~${ethers.utils.formatEther(maxGasCost)} ETH but have ${ethers.utils.formatEther(ethBalance)} ETH.`);
                setIsLoading(false);
                return;
            }

            console.log("🟠 Sending withdrawal transaction...");
            console.log("🟠 Final transaction summary:", {
                amountUSDC: ethers.utils.formatUnits(usdcAmount, 6),
                receiver: account,
                owner: account,
                gasLimit: gasLimit.toString(),
                vaultAddress: VAULT_ADDRESS
            });

            let withdrawOverrides = {
                gasLimit: gasLimit // Always specify gas limit explicitly
            };

            const withdrawTx = await vaultContractWrite.withdraw(usdcAmount, account, account, withdrawOverrides);
            console.log("🟠 ✅ Withdraw tx hash:", withdrawTx.hash);
            console.log("🟠 ✅ Withdraw tx:", {
                to: withdrawTx.to,
                from: withdrawTx.from,
                data: withdrawTx.data,
                value: withdrawTx.value?.toString(),
                gasLimit: withdrawTx.gasLimit?.toString(),
                gasPrice: withdrawTx.gasPrice?.toString(),
            });

            setTxHash(withdrawTx.hash);
            setStatus("Waiting for confirmation...");

            // FARCASTER FIX: Use readProvider to wait for transaction (Farcaster provider can't check status)
            let receipt;
            if (isFarcaster) {
                receipt = await readProvider.waitForTransaction(withdrawTx.hash);
                console.log("✅ Withdrawal confirmed (via fallback provider):", receipt.transactionHash);
            } else {
                receipt = await withdrawTx.wait();
                console.log("✅ Withdrawal confirmed:", receipt.transactionHash);
            }
            console.log("🟠 Receipt status:", receipt.status);
            console.log("🟠 Receipt gas used:", receipt.gasUsed.toString());
            console.log("🟠 Transaction confirmation details:", {
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                effectiveGasPrice: receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : 'N/A',
                status: receipt.status === 1 ? 'Success' : 'Failed'
            });

            setStatus("Updating balances...");
            setShowStatus(false);
            onShowToast?.("success", `Successfully withdrew ${amount} USDC!`, receipt.transactionHash);

            //GTM Withdrawal
            sendGTMEvent('Withdrawal', {
                apy_percent: BASE_APY,
                amount_usd: parseFloat(amount),
                network: 'Base'
            });

            // Invalidate cache and refresh balances after transaction
            invalidateBalanceCache();
            await fetchBalances(true); // Force refresh after transaction
            setAmount(""); // Clear input

            console.log("🟠 ========== WITHDRAWAL SUCCESS ==========");

        } catch (error) {
            console.error("❌ ========== WITHDRAWAL ERROR ==========");
            console.error("❌ Error object:", error);
            console.error("❌ Error message:", error.message);
            console.error("❌ Error code:", error.code);
            console.error("❌ Error data:", error.data);

            if (isFarcaster) {
            }

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
                    <h3 className="pool-title">
                        {mode === "deposit" ? "Deposit USDC to Earn Yield" : "Withdraw Funds"}
                    </h3>

                    <div className="pool-stats-grid">
                        <div className="pool-stat">
                            <span className="pool-stat-label">Current APY</span>
                            <span className="pool-stat-value apy-highlight" style={{ fontSize: '24px' }}>
                                {isApyLoading ? <span className="loading-dots"></span> : `${BASE_APY.toFixed(2)}%`}
                                <span className="apy-text">APY</span>
                                <InfoButton type="apy" onClick={() => setInfoModalType('apy')} />
                            </span>
                        </div>
                        <div className="pool-stat">
                            <span className="pool-stat-label">Your Balance</span>
                            <span className="pool-stat-value">
                                {isBalancesLoading ? <span className="loading-dots"></span> : `$${parseFloat(vaultBalance || 0).toFixed(2)}`}
                            </span>
                        </div>
                        <div className="pool-stat">
                            <span className="pool-stat-label">Network</span>
                            <span className="pool-stat-value">Base</span>
                        </div>
                    </div>
                </div>

                <div className="mobile-mode-toggle">
                    <button
                        className={`mobile-toggle-btn ${mode === 'deposit' ? 'active' : ''}`}
                        onClick={() => setMode?.('deposit')}
                    >
                        Deposit
                    </button>
                    <button
                        className={`mobile-toggle-btn ${mode === 'withdraw' ? 'active' : ''}`}
                        onClick={() => setMode?.('withdraw')}
                    >
                        Withdraw
                    </button>
                </div>

                <div className="vault-token-box">
                    <div className="vault-token-header">
                        <span className="vault-balance-label">
                            {isBalancesLoading
                                ? <span>Available: <span className="loading-dots"></span></span>
                                : `Available: ${mode === "deposit"
                                    ? parseFloat(usdcBalance || 0).toFixed(2)
                                    : parseFloat(vaultBalance || 0).toFixed(6)
                                } ${mode === "deposit" ? "USDC" : "xPLS"}`}
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
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                                    setAmount(value);
                                }
                            }}
                        />
                        <span style={{ fontSize: '18px', fontWeight: '600', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {mode === "deposit" ? "USDC" : "xPLS"}
                            {mode === "withdraw" && <InfoButton type="xpls" onClick={() => setInfoModalType('xpls')} />}
                        </span>
                    </div>

                    <div className="vault-usd-value">
                        {amount && parseFloat(amount) > 0
                            ? `≈ $${parseFloat(amount).toFixed(2)}`
                            : "≈ $0.00"}
                    </div>
                </div>

                {mode === "deposit" && amount && parseFloat(amount) > 0 && (
                    <div className="yield-projection">
                        <h4 className="yield-title">
                            Projected Earnings
                            <InfoButton type="earnings" onClick={() => setInfoModalType('earnings')} />
                        </h4>
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
                            {isApyLoading ? <span>Loading APY<span className="loading-dots"></span></span> : `Based on ${BASE_APY.toFixed(2)}% APY`}
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
                        <h4 className="withdraw-title">
                            Withdrawal Summary
                            <InfoButton type="withdrawal" onClick={() => setInfoModalType('withdrawal')} />
                        </h4>
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
                                ? "DEPOSIT USDC"
                                : "WITHDRAW USDC"}
                    </span>
                </button>


            </div>
            
            <ReferralRewards 
                walletAddress={account}
                onShowToast={onShowToast}
            />

            <div className="email-banner-wrapper">
                <EmailBanner />
            </div>
            <div className="powered-by-container">
                <PoweredByMorpho />
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

            <InfoModal 
                type={infoModalType} 
                isOpen={!!infoModalType} 
                onClose={() => setInfoModalType(null)} 
            />
        </>
    );
};

export default VaultApp;

