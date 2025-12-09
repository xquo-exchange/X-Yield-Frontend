const env = import.meta.env || {}

const rpcUrl = env.VITE_RPC_URL?.trim()
if (!rpcUrl) {
  throw new Error('Missing VITE_RPC_URL. Add it to your .env file to point at a valid RPC endpoint.')
}

const reownProjectId = env.VITE_REOWN_PROJECT_ID?.trim()
if (!reownProjectId) {
  throw new Error('Missing VITE_REOWN_PROJECT_ID. Add it to your .env file to supply the AppKit project ID.')
}

const apiBaseUrl = env.VITE_API_BASE_URL?.trim() || 'https://x-yield-backend-ts-main.vercel.app'

export const ENV = Object.freeze({
  rpcUrl,
  reownProjectId,
  apiBaseUrl
})
