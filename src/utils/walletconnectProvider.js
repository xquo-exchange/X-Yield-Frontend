import { EthereumProvider } from "@walletconnect/ethereum-provider";

// Cache the provider instance to prevent multiple initializations
let cachedProvider = null;
let isInitializing = false;

export async function initWalletConnect() {
  try {
    // 🧹 ALWAYS START FRESH - Don't reuse cached providers
    // This ensures we get a clean connection every time
    if (cachedProvider) {
      console.log('🧹 Clearing existing cached provider for fresh start...');
      try {
        if (cachedProvider.connected) {
          await cachedProvider.disconnect();
        }
        if (typeof cachedProvider.removeAllListeners === 'function') {
          cachedProvider.removeAllListeners();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      cachedProvider = null;
    }

    // Prevent concurrent initializations
    if (isInitializing) {
      console.log('🔗 WalletConnect: Waiting for initialization to complete...');
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    isInitializing = true;
    console.log('🔗 WalletConnect: Initializing fresh provider for Base...');
    
    const provider = await EthereumProvider.init({
      projectId: "88686807816516c396fdf733fd957d95",
      chains: [8453], // Base mainnet
      showQrModal: true,
      qrModalOptions: {
        themeMode: "dark",
        themeVariables: {
          "--wcm-z-index": "9999"
        },
        enableExplorer: true,
        explorerRecommendedWalletIds: [
          "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
          "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0", // Trust Wallet
          "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369", // Rainbow
        ],
      },
      metadata: {
        name: "X-QUO Yield",
        description: "X-QUO Vault on Base",
        url: typeof window !== 'undefined' ? window.location.origin : "https://xquo-chi.vercel.app",
        icons: [
          typeof window !== 'undefined' 
            ? `${window.location.origin}/x-quo_icon.png`
            : "https://xquo-chi.vercel.app/x-quo_icon.png"
        ]
      },
      rpcMap: {
        8453: "https://base.llamarpc.com" // Base mainnet RPC
      }
    });
    
    console.log('🔗 WalletConnect: Provider created, enabling connection...');
    await provider.enable();
    console.log('✅ WalletConnect: Provider enabled successfully');
    
    cachedProvider = provider;
    isInitializing = false;
    return provider;
  } catch (error) {
    isInitializing = false;
    console.error('❌ WalletConnect: Initialization failed -', error.message || error);
    throw error;
  }
}

// Function to clear the cached provider - THOROUGH CLEANUP
export function clearWalletConnectCache() {
  console.log('🧹 Clearing WalletConnect cache...');
  
  // Disconnect and cleanup existing provider if it exists
  if (cachedProvider) {
    try {
      // Remove all event listeners
      if (typeof cachedProvider.removeAllListeners === 'function') {
        cachedProvider.removeAllListeners();
      }
      
      // Disconnect if connected
      if (cachedProvider.connected) {
        cachedProvider.disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        });
      }
    } catch (e) {
      console.warn('⚠️ Error during provider cleanup:', e);
    }
    
    cachedProvider = null;
  }
  
  isInitializing = false;
  
  // Also clear any WalletConnect localStorage items
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove = [];
    Object.keys(localStorage).forEach(key => {
      if (
        key.includes('wc@') || 
        key.includes('WalletConnect') ||
        key.includes('WALLETCONNECT') ||
        key.startsWith('wc-')
      ) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore errors
      }
    });
  }
  
  console.log('✅ WalletConnect cache cleared');
}

