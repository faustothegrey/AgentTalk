import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The orchestrator's HTTP+WS backend. Both halves read the SAME knob (`PORT`)
// and the SAME default, so moving the backend moves the proxy with it — before
// BL-060 this target was hardcoded to 3000 while the orchestrator honoured
// `PORT`, which made `PORT` a knob that turned and did nothing: the backend
// moved and the UI silently kept talking to 3000.
//
// The default is deliberately NOT 3000: that is the most contended port in JS
// dev (React/Next/CRA/Express all default there) and it is DiagramTalk's on
// this machine. Note `localhost:3000` elsewhere in this repo means DiagramTalk,
// not the orchestrator — do not "unify" those.
const ORCHESTRATOR_PORT = process.env.PORT ?? '3100'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind the dev server to all interfaces so it's reachable over the LAN/SSH host
    // (e.g. remote browsing) without passing --host each time (PO, 2026-07-16).
    host: '0.0.0.0',
    proxy: {
      '/api': `http://localhost:${ORCHESTRATOR_PORT}`,
      '/ws': {
        target: `ws://localhost:${ORCHESTRATOR_PORT}`,
        ws: true,
      },
    },
  },
})
