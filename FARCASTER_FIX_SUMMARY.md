# Farcaster Mini App Balance Fix

## Problem
When the app was opened in the Farcaster Mini App:
- Wallet connected automatically using Farcaster's built-in wallet
- Balances did NOT load (showed 0)
- Works fine with Rainbow wallet and other external wallets
- Works fine on desktop

## Root Cause
The app's mobile detection code was treating Farcaster as a "regular mobile browser" and:
1. **Immediately disconnecting** the wallet after connection
2. **Clearing localStorage** and cookies on page load
3. **Preventing auto-reconnection** of existing accounts

This caused the Farcaster wallet to connect but immediately get disconnected, preventing balance fetching.

## Solution Implemented

### 1. Farcaster Detection
Added detection for Farcaster environment using user agent:
```javascript
const isFarcasterEnv = typeof navigator !== 'undefined' && 
  /Farcaster|Warpcast/i.test(navigator.userAgent);
```

### 2. Modified Mobile Behavior
Updated three key areas in `src/contexts/WalletContext.jsx`:

#### A. Initial Setup (Line ~131)
- **Before:** All mobile devices had wallet cleared and no auto-reconnect
- **After:** Farcaster is treated like desktop - wallet persists and auto-reconnects

#### B. localStorage Persistence (Line ~99)
- **Before:** Only desktop saved wallet connection to localStorage
- **After:** Desktop AND Farcaster save connection state

#### C. Page Unload Handler (Line ~411)
- **Before:** All mobile devices disconnected wallet on page unload
- **After:** Only regular mobile (not Farcaster) disconnects on unload

### 3. Added Debug UI (Farcaster Only)
Added temporary debugging interface that only shows in Farcaster:
- Shows balance fetch status
- Displays wallet address, chainId, provider status
- Shows error messages if balance fetch fails
- Fixed position at top of screen
- Green monospace text on dark background

Debug info appears in:
- `src/contexts/WalletContext.jsx` - Added `debugInfo` state
- `src/components/MorphoApp.jsx` - Added visual debug panel

### 4. Enhanced Console Logging
Added detailed console logs throughout the balance fetching process:
- Environment detection
- Balance fetch triggers
- Success/failure states
- Error details

## Files Changed

1. **src/contexts/WalletContext.jsx**
   - Modified mobile detection logic to exclude Farcaster
   - Added `debugInfo` state for on-screen debugging
   - Enhanced logging throughout `fetchBalances()`
   - Updated localStorage persistence logic
   - Modified page unload handler

2. **src/components/MorphoApp.jsx**
   - Added Farcaster detection
   - Added `debugInfo` from wallet context
   - Added visual debug panel (Farcaster only)

## Testing

### In Farcaster Mini App:
1. Open the app in Farcaster
2. You should see a green debug panel at the top
3. Watch for these statuses:
   - `⏳ Fetching balances...` - Balance fetch started
   - `✅ USDC: X, Vault: Y` - Balances loaded successfully
   - `❌ No wallet or provider` - Wallet not connected
   - `❌ Wrong chain: X` - Not on Base (chainId 8453)
   - `❌ Error: ...` - RPC or contract error

### Expected Behavior:
- Wallet auto-connects with Farcaster's built-in wallet
- Debug panel shows connection status
- Balances load automatically
- No more disconnection on mobile

### Debug Panel Shows:
- Real-time balance fetch status
- Connection state (✅ or ❌)
- Chain ID (should be 8453)
- Shortened wallet address

## Removing Debug UI (Later)

When debugging is complete, remove:

1. In `src/contexts/WalletContext.jsx`:
   - Remove `debugInfo` state (line ~43)
   - Remove all `setDebugInfo()` calls in `fetchBalances()`
   - Remove `debugInfo` from context value export

2. In `src/components/MorphoApp.jsx`:
   - Remove `debugInfo` from `useWallet()` destructuring
   - Remove `isFarcaster` variable
   - Remove the entire debug panel div (lines with "Farcaster Debug")

## Notes

- Debug UI is **ONLY visible in Farcaster** (not desktop, not regular mobile)
- Console logs remain for all environments
- The fix does NOT require any Reown/WalletConnect configuration changes
- Works with Farcaster's built-in wallet and external wallets like Rainbow

