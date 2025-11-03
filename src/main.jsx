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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
