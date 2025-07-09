import { defineConfig } from 'vite'
import dotenv from 'dotenv'
// Load environment variables from .env file at project root
dotenv.config()
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/gresistor/' : '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  define: {
    global: 'globalThis',
    // Force inject environment variables for process.env access
    'process.env.REACT_APP_WALLETCONNECT_PROJECT_ID': JSON.stringify(process.env.REACT_APP_WALLETCONNECT_PROJECT_ID),
    'process.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(process.env.VITE_WALLETCONNECT_PROJECT_ID),
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'crypto-browserify', 'stream-browserify', 'process'],
  },
})