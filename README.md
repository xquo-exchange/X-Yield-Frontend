# MorphoApp - Morpho Protocol on Base

A React web application that connects to the Morpho protocol on Base mainnet (chainId 8453). Built with the same visual style, layout, and UX as X-QUO.

## 🎯 Project Overview

This application provides a clean, user-friendly interface for:
- **Depositing** funds to Morpho pools on Base
- **Withdrawing** funds from Morpho pools
- **WalletConnect** integration (Base mainnet only)
- Conditional fee display
- Legal disclaimer section

## 🏗️ Architecture

### Components

1. **Navbar** - Top navigation with wallet connection and network switching
2. **Sidebar** - Tab switcher for Deposit/Withdraw modes
3. **Header** - Page title and important notice disclaimer
4. **MorphoApp** - Main interaction component for deposit/withdraw flows
5. **Toast** - Notification system for success/error messages

### Context & Hooks

- **WalletContext** - Manages wallet connection state and Base network configuration
- **useWallet** - Custom hook to access wallet functionality

### Utilities

- **walletconnectProvider.js** - WalletConnect v2 provider configured for Base mainnet

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm
- A Web3 wallet (MetaMask, Trust Wallet, Rainbow, etc.)
- ETH on Base network for gas fees

### Installation & Setup

```bash
npm install
cp .env.example .env
```

Fill in the `.env` file with your RPC endpoint and AppKit (WalletConnect) Project ID before running the app.

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

## 🔧 Configuration

### Environment & Network Settings

Create or update `.env` (see `.env.example`) with the following keys:

```bash
VITE_RPC_URL=https://mainnet.base.org
VITE_REOWN_PROJECT_ID=your_walletconnect_project_id
```

- `VITE_RPC_URL` is consumed by `src/config/env.js` to create a read-only RPC transport for AppKit/Wagmi.
- `VITE_REOWN_PROJECT_ID` is required for WalletConnect/AppKit. No fallback is embedded in the codebase.

The rest of the Base-specific configuration (chain ID `8453`, explorer URLs, contract addresses) lives in `src/config/appKit.js`, `src/contexts/WalletContext.jsx`, and `src/lib/const/base.js`.

### Fee Configuration

Fees are conditionally displayed. To show/hide fees, edit `src/components/MorphoApp.jsx`:

```javascript
const DEPOSIT_FEE = null; // Set to a number (e.g., 0.5) to show, or null to hide
const WITHDRAWAL_FEE = 0.5; // Example: 0.5% withdrawal fee
```

### Contract Addresses

Update Morpho vault address in `src/components/MorphoApp.jsx`:

```javascript
const MORPHO_VAULT_ADDRESS = "0x..."; // Replace with actual Morpho vault address
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
```

## 🎨 Styling

The app uses the same visual style as X-QUO:
- Dark theme with glassmorphism effects
- Inter font family
- Responsive design (mobile-first)
- Smooth animations and transitions

Color palette:
- Background: `#0a0a0a` / `#000000`
- Primary accent: `rgba(16, 185, 129, 0.9)` (green)
- Error/Warning: `rgba(239, 68, 68, 0.9)` (red)
- Borders: `rgba(255, 255, 255, 0.06)`

## 📋 Features Implemented

✅ WalletConnect integration with Base mainnet  
✅ Deposit/Withdraw UI flow  
✅ Balance fetching for USDC and vault tokens  
✅ Yield projections based on APY  
✅ Withdrawal fee calculations (conditional)  
✅ Network validation and switching  
✅ Responsive design (mobile, tablet, desktop)  
✅ Toast notifications  
✅ Transaction status modals  
✅ Legal disclaimer section  

### APY & Bonus Model (frontend behavior)

- **Backend-driven APY**: Base APY is fetched from the backend (`/api/apy` and `/api/apy/history`); no local APY computation is shown in the UI.
- **Total APY shown to users**: `Total APY = Base APY + Referral bonus + Early-user bonus`.
- **Referral bonus**: Each qualifying referral grants a boost for 30 days; referral boosts are capped at **+1.5%** total.
- **Early-user bonus**: +0.5% APY applied for 1 year from activation (admin/cutoff controlled). This is separate from referral boosts.
- **Separation of bonuses**: Referral and early bonuses are tracked and displayed separately to avoid double counting.
- **Chart vs. headline**: The APY chart shows **base APY only**; the headline APY displays the **total APY** (base + bonuses).

## 🚀 Farcaster Mini App integration

The project is now wired for Farcaster Mini Apps per the official docs:

- Added `@farcaster/miniapp-sdk` dependency.
- Mini App detection + `sdk.actions.ready()` is called in `src/App.jsx` so the splash screen hides only after the app is ready inside a Mini App host.
- Manifest lives at `public/.well-known/farcaster.json` and will be served at `/.well-known/farcaster.json` when deployed.

### What you must update before going live

1) **Manifest account association**  
   - Replace `REPLACE_WITH_ACCOUNT_ASSOCIATION_HEADER` and `REPLACE_WITH_ACCOUNT_ASSOCIATION_SIGNATURE` in `public/.well-known/farcaster.json` with values from the Warpcast Mini App Manifest tool (`https://farcaster.xyz/~/developers/new`).  
   - Update `payload` if your production domain differs (`eyJkb21haW4iOiJ5b3VyLWRvbWFpbi5jb20ifQ` encodes `your-domain.com`). Make sure the domain matches exactly.

2) **Domain + asset URLs**  
   - Swap `https://your-domain.com` in the manifest for your real domain and ensure `iconUrl`, `splashImageUrl`, and `ogImageUrl` point to hosted assets (3:2 image for OG is recommended; icon 200x200 for splash).

3) **Host the manifest**  
   - Deploy the site so `https://<your-domain>/.well-known/farcaster.json` is publicly reachable. Vite will copy the file from `public/.well-known`.

### How to test in Developer Mode

1) Enable Developer Mode in Warpcast: `https://farcaster.xyz/~/settings/developer-tools`.
2) Run the app locally: `npm install` then `npm run dev` (defaults to `http://localhost:5173`).
3) Point the Mini App previewer to your dev URL or a tunneled URL (e.g., `https://<tunnel>.ngrok.io`) so the host can load it.
4) Confirm the splash screen hides (ready fired) and the app renders. Check browser console for `Mini App ready() failed` logs if something blocks the call.
5) Verify the manifest by curling it: `curl -s https://<your-domain>/.well-known/farcaster.json`.

### Production checklist

- Build: `npm run build`.
- Deploy the `dist` output and ensure HTTPS is enabled.
- Validate the manifest from the deployed domain.
- Submit/preview in Warpcast Developer Mode and ensure the header/splash data render correctly.

## 🔨 TODO: Morpho Integration

The current implementation includes **placeholder logic** for Morpho contract interactions. To complete the integration:

1. **Add Morpho SDK or Contract ABIs**
   ```bash
   npm install @morpho-labs/morpho-ethers-contract
   ```

2. **Update `MorphoApp.jsx`** with actual Morpho contract calls:
   - Replace `executeDeposit()` placeholder with Morpho vault deposit logic
   - Replace `executeWithdrawal()` placeholder with Morpho vault withdraw logic
   - Fetch actual vault balance from Morpho contract

3. **Example Integration Pattern**:
   ```javascript
   // In executeDeposit()
   const morphoVault = new ethers.Contract(
     MORPHO_VAULT_ADDRESS,
     MORPHO_VAULT_ABI,
     signer
   );
   
   const tx = await morphoVault.deposit(requiredAmount, account);
   await tx.wait();
   ```

# Project Structure

```
C:\x-yield-frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx / .css
│   │   ├── Sidebar.jsx / .css
│   │   ├── Header.jsx / .css
│   │   ├── Toast.jsx / .css
│   │   └── MorphoApp.jsx / .css
│   ├── contexts/
│   │   └── WalletContext.jsx
│   ├── hooks/
│   │   └── useWallet.js
│   ├── utils/
│   │   └── walletconnectProvider.js
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── public/
│   └── README_ASSETS.md (instructions for logo assets)
├── package.json
└── vite.config.js
```

# Security Notes

- Always verify contract addresses before transactions
- Test thoroughly on Base testnet before mainnet
- Users should understand DeFi risks (see disclaimer in app)
- Never commit private keys or sensitive data

## 📝 Reference

This project was built using the X-QUO reference files from `c:\react-fronted\src\` to maintain consistent UX and styling.

## 📄 License

This is a demonstration project. Ensure you have proper licensing for production use.

# Contributing

To extend this project:
1. Complete Morpho protocol integration
2. Add additional Morpho vaults
3. Implement advanced features (compound strategies, etc.)
4. Add analytics/tracking
5. Implement proper error handling for all edge cases

# Known Issues

- Morpho contract integration is placeholder logic
- Asset files (logos) need to be copied manually (see `public/README_ASSETS.md`)

# Support

For issues related to:
- **Morpho Protocol**: [Morpho Documentation](https://docs.morpho.xyz)
- **Base Network**: [Base Documentation](https://docs.base.org)
- **WalletConnect**: [WalletConnect Docs](https://docs.walletconnect.com)
