import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Allow access through ngrok tunnels (e.g. for scanning table QR codes from a phone)
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
    // Forward API calls (and the live-updates WebSocket) to the FastAPI backend during development
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000', ws: true },
    },
  },
})
