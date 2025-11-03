import { useState, useEffect } from 'react';
import { USDC_ADDRESS, USDC_DECIMALS } from '../lib/const/base';
import { erc20Abi } from '../lib/abis/erc20';

export function useUsdcBalance(provider, account) {
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!provider || !account) {
      setBalance('0');
      return;
    }

    let mounted = true;

    const fetchBalance = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { ethers } = await import('ethers');
        const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, provider);
        const balanceBN = await usdcContract.balanceOf(account);
        
        if (!mounted) return;
        
        const formatted = ethers.utils.formatUnits(balanceBN, USDC_DECIMALS);
        setBalance(formatted);
      } catch (err) {
        console.error('Error fetching USDC balance:', err);
        if (!mounted) return;
        setError(err.message || 'Failed to fetch balance');
        setBalance('0');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchBalance();

    // Poll for balance updates every 5 seconds
    const interval = setInterval(fetchBalance, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [provider, account]);

  return { balance, isLoading, error };
}



