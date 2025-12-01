import React from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { WagmiConfig } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MiniAppProvider } from '@neynar/react'
import '@neynar/react/dist/style.css'

import App from './App'
import './index.css'
import { appKit, wagmiAdapter } from './config/appKit'

// Ensure AppKit is initialized (side effect import)
void appKit

// Polyfill Buffer for browser
window.Buffer = Buffer

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorMessage = error?.message || String(error);

  if (
    errorMessage?.includes('No matching key') ||
    errorMessage?.includes('session topic doesn\'t exist') ||
    errorMessage?.includes('Pending session not found')
  ) {
    event.preventDefault();
    return;
  }

  console.error('Unhandled promise rejection:', error);
});

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <WagmiConfig config={wagmiAdapter.wagmiConfig}>
      <MiniAppProvider analyticsEnabled={true}>
        <App />
      </MiniAppProvider>
    </WagmiConfig>
  </QueryClientProvider>
)