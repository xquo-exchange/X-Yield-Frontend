import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { cookieStorage, createStorage } from '@wagmi/core'
import { base } from '@reown/appkit/networks'

console.log('Env vars', import.meta.env)

const fallbackProjectId = '88686807816516c396fdf733fd957d95'
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || fallbackProjectId

if (!import.meta.env.VITE_REOWN_PROJECT_ID) {
  console.warn(
    'VITE_REOWN_PROJECT_ID is not defined; using embedded fallback project ID. Set the env var to override.'
  )
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

