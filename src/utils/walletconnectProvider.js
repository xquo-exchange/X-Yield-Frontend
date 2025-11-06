import { EthereumProvider } from "@walletconnect/ethereum-provider";

// Cache the provider instance to prevent multiple initializations
let cachedProvider = null;
let isInitializing = false;
// Track if we're in the initial connection phase (when deeplinks are allowed)
let isInitialConnectionPhase = false;
// Track if connection has been established (after enable() succeeds)
let isConnectionEstablished = false;

export async function initWalletConnect() {
  // Prevent concurrent initializations - return early if already initializing
  if (isInitializing) {
    console.log('🔗 WalletConnect: Already initializing, waiting...');
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // After initialization completes, return the cached provider if it exists
    if (cachedProvider && cachedProvider.connected) {
      // Ensure connection state flags are set correctly for cached provider
      isInitialConnectionPhase = false;
      isConnectionEstablished = true;
      return cachedProvider;
    }
  }

  // Check if we have an existing connected provider - return it without showing QR
  if (cachedProvider && cachedProvider.connected) {
    console.log('🔗 WalletConnect: Using existing connected provider (no QR needed)');
    // Ensure connection state flags are set correctly for cached provider
    isInitialConnectionPhase = false;
    isConnectionEstablished = true;
    return cachedProvider;
  }

  // IMPORTANT: Clear stale cached provider before creating new one
  // This prevents issues when reconnecting after disconnect
  if (cachedProvider) {
    console.log('🧹 Clearing stale cached provider before new connection...');
    try {
      if (cachedProvider.connected) {
        await cachedProvider.disconnect();
      }
    } catch (e) {
      // Ignore errors when clearing stale provider
      console.log('⚠️ Error disconnecting stale provider (continuing anyway):', e);
    }
    cachedProvider = null;
  }

  isInitializing = true;
  console.log('🔗 WalletConnect: Initializing provider for Base...');
  
  try {
    // Check if there's an existing valid WalletConnect session in localStorage
    // If there is, we don't need to show QR modal immediately
    // WalletConnect will restore the session if it's still valid
    const hasExistingSession = typeof window !== 'undefined' && 
      Object.keys(localStorage).some(key => 
        (key.startsWith('wc@2:session:') || key.startsWith('WCM_')) &&
        localStorage.getItem(key) // Make sure it's not empty
      );
    
    console.log(`🔍 WalletConnect: Existing session detected: ${hasExistingSession ? 'Yes' : 'No'}`);
    
    // Initialize provider - only show QR if no existing session
    // If session exists, WalletConnect will try to restore it first
    const provider = await EthereumProvider.init({
      projectId: "88686807816516c396fdf733fd957d95",
      chains: [8453], // Base mainnet
      showQrModal: !hasExistingSession, // Only show QR if no existing session
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
    
    // Wrap the provider's request method to suppress deeplink errors after connection
    // WalletConnect internally tries to use deeplinks for every request, but after
    // connection is established, we should suppress these errors as they're just noise
    const originalRequest = provider.request.bind(provider);
    
    // Store original console methods to restore later
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    provider.request = async function(args) {
      // Only suppress deeplink errors after connection is established
      const shouldSuppress = !isInitialConnectionPhase && isConnectionEstablished;
      
      // Temporarily override console methods to suppress deeplink-related errors
      let consoleErrorOverride = null;
      let consoleWarnOverride = null;
      
      if (shouldSuppress) {
        consoleErrorOverride = function(...args) {
          const message = args.join(' ');
          // Suppress deeplink-related console errors
          if (
            message.includes('metamask://') ||
            message.includes('scheme does not have a registered handler') ||
            message.includes('Not allowed to launch') ||
            message.includes('user gesture is required') ||
            message.includes('Failed to launch') ||
            message.includes('Document does not have focus, skipping deeplink')
          ) {
            // Suppress these errors silently
            return;
          }
          // Allow other errors through
          originalConsoleError.apply(console, args);
        };
        
        consoleWarnOverride = function(...args) {
          const message = args.join(' ');
          // Suppress deeplink-related console warnings
          if (
            message.includes('metamask://') ||
            message.includes('deeplink') ||
            message.includes('Document does not have focus')
          ) {
            // Suppress these warnings silently
            return;
          }
          // Allow other warnings through
          originalConsoleWarn.apply(console, args);
        };
        
        // Apply overrides
        console.error = consoleErrorOverride;
        console.warn = consoleWarnOverride;
      }
      
      try {
        const result = await originalRequest(args);
        // Restore console after request completes
        if (shouldSuppress) {
          console.error = originalConsoleError;
          console.warn = originalConsoleWarn;
        }
        return result;
      } catch (error) {
        // Restore console before handling error
        if (shouldSuppress) {
          console.error = originalConsoleError;
          console.warn = originalConsoleWarn;
        }
        
        // Check if it's a deeplink-related error that we should suppress
        const errorMessage = error?.message || String(error);
        const isDeeplinkError = 
          errorMessage.includes('deeplink') ||
          errorMessage.includes('metamask://') ||
          errorMessage.includes('scheme does not have a registered handler') ||
          errorMessage.includes('Not allowed to launch') ||
          errorMessage.includes('user gesture is required');
        
        // If it's a deeplink error after connection is established,
        // WalletConnect should handle the request through the existing session
        // The deeplink failure is just noise - the request should still work
        if (isDeeplinkError && shouldSuppress) {
          // Suppress the error - WalletConnect will use the existing session
          // This is expected behavior - deeplinks are only needed for initial connection
          // After connection, requests go through the established session
          throw error; // Still throw, but console errors are already suppressed
        }
        
        // For other errors or during initial connection, throw normally
        throw error;
      }
    };
    
    // CRITICAL: Always call enable() after init to ensure connection
    // enable() will:
    // - Restore existing session if valid (won't show QR)
    // - Show QR modal if no valid session exists
    console.log('🔗 WalletConnect: Provider created, enabling connection...');
    
    // Mark that we're in the initial connection phase (allow deeplinks)
    isInitialConnectionPhase = true;
    isConnectionEstablished = false;
    
    try {
      await provider.enable();
      console.log('✅ WalletConnect: Provider enabled successfully');
      
      // Connection established - mark that we're past initial connection phase
      isInitialConnectionPhase = false;
      isConnectionEstablished = true;
    } catch (error) {
      // Reset connection phase flags on error
      isInitialConnectionPhase = false;
      
      // If already connected, enable() might throw - check if it's actually connected
      if (provider.connected) {
        console.log('✅ WalletConnect: Provider already connected (session reused)');
        isConnectionEstablished = true;
      } else {
        // If enable failed, check if it's because session was invalid
        // In this case, we need to trigger QR modal manually
        console.log('⚠️ WalletConnect: Enable failed, checking if we need to show QR...');
        
        // If we thought there was a session but enable failed, the session was likely invalid
        // Clear it and try again with QR modal enabled
        if (hasExistingSession) {
          console.log('🧹 Clearing invalid session and retrying with QR modal...');
          // Clear the invalid session
          try {
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('wc@2:session:') || key.startsWith('WCM_')) {
                localStorage.removeItem(key);
              }
            });
          } catch (e) {
            // Ignore errors
          }
          
          // Re-initialize with QR modal enabled
          // Actually, we can't re-init easily here, so let's just throw and let the caller retry
          // Or better: set a flag to show QR on next attempt
          console.error('❌ WalletConnect: Session was invalid. Please retry connection.');
          isInitializing = false;
          cachedProvider = null;
          throw new Error('Invalid session detected. Please reconnect.');
        } else {
          // Re-throw if it's a real error and provider is not connected
          console.error('❌ WalletConnect: Enable failed and provider not connected:', error);
          isInitializing = false;
          cachedProvider = null;
          throw error;
        }
      }
    }
    
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
    isInitialConnectionPhase = false;
    isConnectionEstablished = false;
    // Clear cached provider on error to ensure clean state
    cachedProvider = null;
    console.error('❌ WalletConnect: Initialization failed -', error.message || error);
    throw error;
  }
}

// Function to clear the cached provider - THOROUGH CLEANUP
export function clearWalletConnectCache() {
  console.log('🧹 Clearing WalletConnect cache...');
  
  // Reset connection state flags
  isInitialConnectionPhase = false;
  isConnectionEstablished = false;
  
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

