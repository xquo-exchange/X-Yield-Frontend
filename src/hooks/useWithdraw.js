import { useState } from 'react';
import { VAULT_ADDRESS, USDC_DECIMALS } from '../lib/const/base';
import { erc4626Abi } from '../lib/abis/erc4626';

export function useWithdraw() {
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const withdraw = async (provider, assets, receiver, owner) => {
    if (!provider || !receiver || !owner) {
      setError('Provider, receiver, or owner not available');
      return { success: false, error: 'Provider, receiver, or owner not available' };
    }

    setIsPending(true);
    setError(null);
    setTxHash(null);

    try {
      const { ethers } = await import('ethers');
      const signer = provider.getSigner();
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, erc4626Abi, signer);

      // Parse assets amount to BigNumber with 6 decimals (USDC decimals)
      const assetsBN = ethers.utils.parseUnits(assets, USDC_DECIMALS);

      const tx = await vaultContract.withdraw(assetsBN, receiver, owner);
      setTxHash(tx.hash);

      const receipt = await tx.wait();

      setIsPending(false);

      return {
        success: true,
        txHash: tx.hash,
        receipt,
        shares: receipt.events?.find((e) => e.event === 'Withdraw')?.args?.shares?.toString()
      };
    } catch (err) {
      console.error('Withdraw error:', err);
      setIsPending(false);
      
      let errorMessage = 'Withdraw failed';
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

  const getMaxWithdraw = async (provider, owner) => {
    if (!provider || !owner) {
      return null;
    }

    try {
      const { ethers } = await import('ethers');
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, erc4626Abi, provider);
      const maxWithdrawBN = await vaultContract.maxWithdraw(owner);
      return ethers.utils.formatUnits(maxWithdrawBN, USDC_DECIMALS);
    } catch (err) {
      console.error('Error fetching max withdraw:', err);
      return null;
    }
  };

  return {
    withdraw,
    getMaxWithdraw,
    isPending,
    txHash,
    error
  };
}



