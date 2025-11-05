import { EthereumProvider } from "@walletconnect/ethereum-provider";

// Cache the provider instance to prevent multiple initializations
let cachedProvider = null;
let isInitializing = false;

export async function initWalletConnect() {
  // Prevent concurrent initializations - return early if already initializing
  if (isInitializing) {
    console.log('🔗 WalletConnect: Already initializing, waiting...');
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // After initialization completes, return the cached provider if it exists
    if (cachedProvider && cachedProvider.connected) {
      return cachedProvider;
    }
  }

  // Check if we have an existing connected provider - return it without showing QR
  if (cachedProvider && cachedProvider.connected) {
    console.log('🔗 WalletConnect: Using existing connected provider (no QR needed)');
    return cachedProvider;
  }

  isInitializing = true;
  console.log('🔗 WalletConnect: Initializing provider for Base...');
  
  try {
    // Initialize provider - this will check for existing sessions in localStorage
    const provider = await EthereumProvider.init({
      projectId: "88686807816516c396fdf733fd957d95",
      chains: [8453], // Base mainnet
      showQrModal: true, // Show QR for initial connections, but not during network switches
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
        8453: "https://mainnet.base.org" // Base mainnet RPC (official, fastest)
      }
    });
    
    // CRITICAL: Only call enable() if not already connected to prevent mobile pop-up spam
    // On mobile, enable() triggers wallet app deep links, so we must avoid calling it unnecessarily
    if (!provider.connected) {
      console.log('🔗 WalletConnect: Provider created, enabling connection...');
      try {
        await provider.enable();
        console.log('✅ WalletConnect: Provider enabled successfully');
      } catch (error) {
        // Re-throw if it's a real error and provider is not connected
        console.error('❌ WalletConnect: Enable failed and provider not connected:', error);
        throw error;
      }
    } else {
      console.log('✅ WalletConnect: Provider already connected (session reused, skipping enable())');
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
  
  // CRITICAL: Clear WalletConnect localStorage sessions
  // This ensures a fresh connection after disconnect
  // WalletConnect v2 stores sessions with these prefixes
  try {
    const keys = Object.keys(localStorage);
    let clearedCount = 0;
    keys.forEach(key => {
      // WalletConnect v2 stores sessions with these prefixes
      if (key.startsWith('wc@2:') || key.startsWith('WCM_') || key.startsWith('walletconnect')) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });
    if (clearedCount > 0) {
      console.log(`🗑️ Removed ${clearedCount} WalletConnect session(s) from localStorage`);
    }
  } catch (e) {
    console.warn('⚠️ Error clearing WalletConnect localStorage:', e);
  }
  
  console.log('✅ WalletConnect cache cleared');
}

// Debounce timer for modal closing to prevent spam
let modalCloseTimeout = null;
let isModalClosing = false;

// Forcefully close WalletConnect modal - call this during chain changes
// Added debouncing to prevent mobile pop-up spam
export function closeWalletConnectModal() {
  // If already closing or scheduled to close, skip
  if (isModalClosing || modalCloseTimeout) {
    return;
  }
  
  // Debounce modal closing to prevent rapid-fire calls
  modalCloseTimeout = setTimeout(() => {
    isModalClosing = true;
    modalCloseTimeout = null;
    
    try {
    // Close WalletConnect v2 modal using multiple selectors
    const modalSelectors = [
      'w3m-modal',
      '[data-wcm-modal]',
      '.walletconnect-modal',
      'walletconnect-modal',
      '#walletconnect-wrapper'
    ];
    
    for (const selector of modalSelectors) {
      const modal = document.querySelector(selector);
      if (modal) {
        // Try to close via shadow DOM
        if (modal.shadowRoot) {
          const closeButton = modal.shadowRoot.querySelector('button[aria-label="Close"], button[aria-label="close"], .w3m-modal-close, button.close');
          if (closeButton) {
            closeButton.click();
            console.log('✅ WalletConnect modal closed via shadow DOM');
            return;
          }
        }
        
        // Try to remove from DOM
        modal.remove();
        console.log('✅ WalletConnect modal removed from DOM');
      }
    }
    
    // Try to close via WalletConnect provider API if available
    if (cachedProvider && typeof cachedProvider.closeModal === 'function') {
      cachedProvider.closeModal();
      console.log('✅ WalletConnect modal closed via provider API');
    }
    } catch (error) {
      // Silently fail - modal might already be closed
    } finally {
      // Reset flag after a short delay to allow modal to close
      setTimeout(() => {
        isModalClosing = false;
      }, 200);
    }
  }, 100); // 100ms debounce to prevent spam
}

