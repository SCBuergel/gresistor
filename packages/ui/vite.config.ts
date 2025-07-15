import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ensure environment variables are available
const walletConnectProjectId = '62626bd02bc0c91a73103509f9da4896';

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
    'process.env.REACT_APP_WALLETCONNECT_PROJECT_ID': JSON.stringify(walletConnectProjectId),
    'process.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(walletConnectProjectId),
    // For import.meta.env access
    'import.meta.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(walletConnectProjectId),
    'import.meta.env.REACT_APP_WALLETCONNECT_PROJECT_ID': JSON.stringify(walletConnectProjectId),
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