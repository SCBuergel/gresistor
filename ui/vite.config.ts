import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false, // Try other ports if 5173 is taken
    host: true, // Allow external connections
    open: false, // Don't auto-open browser
  },
  preview: {
    port: 4173,
    strictPort: false,
  }
}) 