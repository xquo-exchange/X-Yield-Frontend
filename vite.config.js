import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process'],
    }),
    emailEndpointPlugin(),
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
