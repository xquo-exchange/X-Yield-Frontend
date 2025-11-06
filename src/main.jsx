import React from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import App from './App'
import './index.css'

// Polyfill Buffer for browser
window.Buffer = Buffer

// Global error handler for unhandled WalletConnect promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorMessage = error?.message || String(error);
  
  // Suppress known WalletConnect session errors (these are harmless)
  if (
    errorMessage?.includes('No matching key') ||
    errorMessage?.includes('session topic doesn\'t exist') ||
    errorMessage?.includes('Pending session not found') ||
    errorMessage?.includes('No matching key')
  ) {
    // These are from stale WalletConnect sessions - harmless, just suppress
    event.preventDefault();
    return;
  }
  
  // Let other errors propagate normally
  console.error('Unhandled promise rejection:', error);
});

// CRITICAL MOBILE FIX: Disable StrictMode in development to prevent double-mounting
// StrictMode causes components to mount twice, which can trigger duplicate wallet connection attempts
// This is especially problematic on mobile where each connection attempt triggers wallet app pop-ups
const isDevelopment = import.meta.env.DEV;

createRoot(document.getElementById('root')).render(
  // Only use StrictMode in development if needed for debugging
  // For now, disable it to prevent mobile pop-up spam from double-mounting
  <App />
  // Uncomment below if you need StrictMode for debugging (but be aware of double-mounting issues)
  // isDevelopment ? (
  //   <React.StrictMode>
  //     <App />
  //   </React.StrictMode>
  // ) : (
  //   <App />
  // )
)
