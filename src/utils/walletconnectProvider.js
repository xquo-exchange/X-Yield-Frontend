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

    // If we have an existing provider instance, check if it's already connected
    if (cachedProvider) {
      if (cachedProvider.connected) {
        console.log('✅ WalletConnect: Existing provider already connected, reusing it');
        return cachedProvider;
      }
      // Only try enabling if not connected (but this will open modal)
      // Check if there are active sessions first
      try {
        const sessions = cachedProvider.signer?.session?.values() || [];
        if (sessions.length > 0) {
          console.log('🔗 WalletConnect: Found active session, reusing without modal');
          // Don't call enable() - just return the provider
          return cachedProvider;
        }
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
    
    console.log('🔗 WalletConnect: Provider created, checking connection status...');
    
    // Check if already connected before calling enable() (which opens modal)
    if (provider.connected) {
      console.log('✅ WalletConnect: Provider already connected, skipping enable()');
      cachedProvider = provider;
      isInitializing = false;
      return provider;
    }
    
    // Only call enable() if not already connected (this opens the QR modal)
    console.log('🔗 WalletConnect: Enabling connection...');
    await provider.enable();
    console.log('✅ WalletConnect: Provider enabled successfully');
    
    // Close the modal after successful connection (if it's still open)
    // WalletConnect modal should auto-close, but we ensure it's closed
    try {
      // Wait a bit for the modal to auto-close
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to close the modal programmatically if it exists
      const modalElement = document.querySelector('w3m-modal');
      if (modalElement && modalElement.shadowRoot) {
        const closeButton = modalElement.shadowRoot.querySelector('button[aria-label="Close"]');
        if (closeButton) {
          closeButton.click();
          console.log('✅ WalletConnect: Modal closed programmatically');
        }
      }
    } catch (modalCloseError) {
      // Ignore errors - modal might already be closed
      console.log('ℹ️ WalletConnect: Modal close attempt completed (may already be closed)');
    }
    
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

