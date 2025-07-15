import { defineConfig } from 'vite'
import dotenv from 'dotenv'
import react from '@vitejs/plugin-react'

// Load environment variables from .env file at project root
dotenv.config()

// Ensure environment variables are available
const walletConnectProjectId = process.env.VITE_WALLETCONNECT_PROJECT_ID || process.env.REACT_APP_WALLETCONNECT_PROJECT_ID;
if (!walletConnectProjectId) {
  console.warn('⚠️ WalletConnect Project ID not found in environment variables');
  console.warn('Please set VITE_WALLETCONNECT_PROJECT_ID in your .env file');
} else {
  console.log('✅ WalletConnect Project ID loaded for build:', walletConnectProjectId);
}

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
    // Also inject into import.meta.env for Vite compatibility
    'import.meta.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(process.env.VITE_WALLETCONNECT_PROJECT_ID),
    'import.meta.env.REACT_APP_WALLETCONNECT_PROJECT_ID': JSON.stringify(process.env.REACT_APP_WALLETCONNECT_PROJECT_ID),
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