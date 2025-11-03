import { EthereumProvider } from "@walletconnect/ethereum-provider";

// Cache the provider instance to prevent multiple initializations
let cachedProvider = null;
let isInitializing = false;

export async function initWalletConnect() {
  try {
    // Return cached provider if already connected
    if (cachedProvider && cachedProvider.connected) {
      console.log('🔗 WalletConnect: Using cached provider');
      return cachedProvider;
    }

    // Prevent concurrent initializations
    if (isInitializing) {
      console.log('🔗 WalletConnect: Waiting for initialization to complete...');
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (cachedProvider && cachedProvider.connected) {
        return cachedProvider;
      }
    }

    // If we have an existing provider instance but it's not enabled yet, try enabling it
    if (cachedProvider && !cachedProvider.connected) {
      try {
        console.log('🔗 WalletConnect: Enabling existing provider session...');
        await cachedProvider.enable();
        console.log('✅ WalletConnect: Existing provider enabled');
        return cachedProvider;
      } catch (e) {
        console.warn('⚠️ WalletConnect: Existing provider enable failed, reinitializing...', e);
      }
    }

    isInitializing = true;
    console.log('🔗 WalletConnect: Initializing provider for Base...');
    
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

// Function to clear the cached provider
export function clearWalletConnectCache() {
  cachedProvider = null;
  isInitializing = false;
}

