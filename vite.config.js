import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { promises as fs } from 'fs'
import path from 'path'

const EMAIL_FILE = path.resolve('data/client_email.json')

function emailEndpointPlugin() {
  return {
    name: 'email-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/saveEmail', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })

        req.on('end', async () => {
          try {
            const { email } = JSON.parse(body || '{}')
            if (!email || typeof email !== 'string') {
              throw new Error('Email required')
            }

            await fs.mkdir(path.dirname(EMAIL_FILE), { recursive: true })
            await fs.writeFile(
              EMAIL_FILE,
              JSON.stringify(
                {
                  client_email: email.trim(),
                  saved_at: new Date().toISOString(),
                },
                null,
                2
              ),
              'utf-8'
            )

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (error) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })
    },
  }
}

function subscribeEndpointPlugin() {
  return {
    name: 'subscribe-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/subscribe', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => {
          body += chunk
        })

        req.on('end', async () => {
          try {
            const { email } = JSON.parse(body || '{}')
            if (!email || typeof email !== 'string') {
              throw new Error('Email required')
            }

            // Load env vars if not already present
            const env = loadEnv('', process.cwd(), '')
            const API_KEY = process.env.EO_API_KEY || env.EO_API_KEY
            const LIST_ID = process.env.EO_LIST_ID || env.EO_LIST_ID

            if (!API_KEY || !LIST_ID) {
              throw new Error('Missing server configuration (EO_API_KEY or EO_LIST_ID)')
            }

            const response = await fetch(`https://emailoctopus.com/api/1.6/lists/${LIST_ID}/contacts`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                api_key: API_KEY,
                email_address: email.trim(),
              }),
            })

            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
              if (data.error && data.error.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, message: 'Already subscribed' }))
                return
              }
              throw new Error(data.error?.message || 'Failed to subscribe')
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))

          } catch (error) {
            console.error('Subscription error:', error)
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process'],
    }),
    emailEndpointPlugin(),
    subscribeEndpointPlugin(),
  ],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
