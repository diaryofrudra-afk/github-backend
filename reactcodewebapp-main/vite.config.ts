import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Must match the port uvicorn is started on. Override via env if it changes —
        // do NOT add a second config file (see "Local dev invariants" in CLAUDE.md).
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
