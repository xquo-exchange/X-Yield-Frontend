import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { cookieStorage, createStorage } from '@wagmi/core'
import { base } from '@reown/appkit/networks'
import { ENV } from './env'

export const networks = [base]
const baseCaipId = `eip155:${base.id}`
const projectId = ENV.reownProjectId

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false,
  storage: createStorage({ storage: cookieStorage }),
  customRpcUrls: {
    [baseCaipId]: [{ url: ENV.rpcUrl }]
  }
})

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  enableNetworkSwitch: false,
  showWallets: false,
  themeMode: 'dark',
  metadata: {
    name: 'X-QUO Vault',
    description: 'X-QUO Vault on Base',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://xquo-chi.vercel.app',
    icons: [
      typeof window !== 'undefined'
        ? `${window.location.origin}/x-quo_icon.png`
        : 'https://xquo-chi.vercel.app/x-quo_icon.png'
    ]
  },
  features: {
    socials: false,
    email: false,
  }
});

