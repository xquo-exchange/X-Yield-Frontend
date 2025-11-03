import { useState } from 'react';
import { USDC_ADDRESS, VAULT_ADDRESS, USDC_DECIMALS } from '../lib/const/base';
import { erc20Abi } from '../lib/abis/erc20';

export function useApprove() {
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const approve = async (provider, amount) => {
    if (!provider) {
      setError('Provider not available');
      return { success: false, error: 'Provider not available' };
    }

    setIsPending(true);
    setError(null);
    setTxHash(null);

    try {
      const { ethers } = await import('ethers');
      const signer = provider.getSigner();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);

      // Parse amount to BigNumber with 6 decimals
      const amountBN = ethers.utils.parseUnits(amount, USDC_DECIMALS);

      // For maximum allowance, use max uint256, otherwise use the specific amount
      const maxUint256 = ethers.constants.MaxUint256;
      const approveAmount = amount === 'max' || amount === 'MAX' ? maxUint256 : amountBN;

      const tx = await usdcContract.approve(VAULT_ADDRESS, approveAmount);
      setTxHash(tx.hash);

      const receipt = await tx.wait();

      setIsPending(false);

      return {
        success: true,
        txHash: tx.hash,
        receipt
      };
    } catch (err) {
      console.error('Approve error:', err);
      setIsPending(false);
      
      let errorMessage = 'Approval failed';
      if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
        errorMessage = 'User rejected transaction';
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
    approve,
    isPending,
    txHash,
    error
  };
}



