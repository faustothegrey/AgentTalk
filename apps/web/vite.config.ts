import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind the dev server to all interfaces so it's reachable over the LAN/SSH host
    // (e.g. remote browsing) without passing --host each time (PO, 2026-07-16).
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
