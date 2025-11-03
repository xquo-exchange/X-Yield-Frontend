import { useState, useEffect } from 'react';
import { VAULT_ADDRESS, USDC_DECIMALS } from '../lib/const/base';
import { erc4626Abi } from '../lib/abis/erc4626';

export function useVaultBalance(provider, account) {
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
        const vaultContract = new ethers.Contract(VAULT_ADDRESS, erc4626Abi, provider);
        
        // Get shares balance
        const sharesBN = await vaultContract.balanceOf(account);
        
        if (!mounted) return;
        
        // If shares are 0, balance is 0
        if (sharesBN.isZero()) {
          setBalance('0');
          setIsLoading(false);
          return;
        }
        
        // Convert shares to assets using previewRedeem
        // previewRedeem(shares) returns the amount of assets that would be received
        try {
          const assetsBN = await vaultContract.previewRedeem(sharesBN);
          const formatted = ethers.utils.formatUnits(assetsBN, USDC_DECIMALS);
          setBalance(formatted);
        } catch (previewErr) {
          // Fallback: if previewRedeem fails, assume 1:1 ratio (though this shouldn't happen)
          console.warn('previewRedeem failed, using 1:1 fallback:', previewErr);
          const formatted = ethers.utils.formatUnits(sharesBN, USDC_DECIMALS);
          setBalance(formatted);
        }
      } catch (err) {
        console.error('Error fetching vault balance:', err);
        if (!mounted) return;
        setError(err.message || 'Failed to fetch vault balance');
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
