import { EthereumProvider } from "@walletconnect/ethereum-provider";

export async function initWalletConnect() {
  try {
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
        name: "MorphoApp",
        description: "Morpho Protocol Integration on Base",
        url: typeof window !== 'undefined' ? window.location.origin : "https://morphoapp.vercel.app",
        icons: [
          typeof window !== 'undefined' 
            ? `${window.location.origin}/x-quo_icon.png`
            : "https://morphoapp.vercel.app/x-quo_icon.png"
        ]
      },
      rpcMap: {
        8453: "https://base.llamarpc.com" // Base mainnet RPC
      }
    });
    
    console.log('🔗 WalletConnect: Provider created, enabling connection...');
    await provider.enable();
    console.log('✅ WalletConnect: Provider enabled successfully');
    return provider;
  } catch (error) {
    console.error('❌ WalletConnect: Initialization failed -', error.message || error);
    throw error;
  }
}

