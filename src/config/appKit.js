import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { cookieStorage, createStorage } from '@wagmi/core'
import { base } from '@reown/appkit/networks'

console.log('Env vars', import.meta.env)
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('VITE_REOWN_PROJECT_ID is not defined')
}

export const networks = [base]

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false,
  storage: createStorage({ storage: cookieStorage })
})

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
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

