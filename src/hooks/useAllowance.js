import { useState, useEffect } from 'react';
import { USDC_ADDRESS, VAULT_ADDRESS, USDC_DECIMALS } from '../lib/const/base';
import { erc20Abi } from '../lib/abis/erc20';

export function useAllowance(provider, owner, spender = VAULT_ADDRESS) {
  const [allowance, setAllowance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!provider || !owner) {
      setAllowance('0');
      return;
    }

    let mounted = true;

    const fetchAllowance = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { ethers } = await import('ethers');
        const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, provider);
        const allowanceBN = await usdcContract.allowance(owner, spender);
        
        if (!mounted) return;
        
        const formatted = ethers.utils.formatUnits(allowanceBN, USDC_DECIMALS);
        setAllowance(formatted);
      } catch (err) {
        console.error('Error fetching allowance:', err);
        if (!mounted) return;
        setError(err.message || 'Failed to fetch allowance');
        setAllowance('0');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchAllowance();

    return () => {
      mounted = false;
    };
  }, [provider, owner, spender]);

  return { allowance, isLoading, error };
}



