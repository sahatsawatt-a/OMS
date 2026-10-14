import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Forward API calls to the FastAPI backend during development
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
})
