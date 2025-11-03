import { useState } from 'react';
import { VAULT_ADDRESS, USDC_DECIMALS } from '../lib/const/base';
import { erc4626Abi } from '../lib/abis/erc4626';

export function useDeposit() {
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const deposit = async (provider, amount, receiver) => {
    if (!provider || !receiver) {
      setError('Provider or receiver not available');
      return { success: false, error: 'Provider or receiver not available' };
    }

    setIsPending(true);
    setError(null);
    setTxHash(null);

    try {
      const { ethers } = await import('ethers');
      const signer = provider.getSigner();
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, erc4626Abi, signer);

      // Parse amount to BigNumber with 6 decimals (USDC decimals)
      const amountBN = ethers.utils.parseUnits(amount, USDC_DECIMALS);

      const tx = await vaultContract.deposit(amountBN, receiver);
      setTxHash(tx.hash);

      const receipt = await tx.wait();

      setIsPending(false);

      return {
        success: true,
        txHash: tx.hash,
        receipt,
        shares: receipt.events?.find((e) => e.event === 'Deposit')?.args?.shares?.toString()
      };
    } catch (err) {
      console.error('Deposit error:', err);
      setIsPending(false);
      
      let errorMessage = 'Deposit failed';
      if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
        errorMessage = 'User rejected transaction';
      } else if (err.message?.includes('insufficient') || err.message?.includes('balance')) {
        errorMessage = 'Insufficient balance';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  return {
    deposit,
    isPending,
    txHash,
    error
  };
}



