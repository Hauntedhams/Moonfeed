import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BUILD VERSION: 2024-12-11-v10-FORCE-REBUILD
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Enable code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'wallet-vendor': [
            '@solana/web3.js', 
            '@solana/wallet-adapter-react', 
            '@solana/wallet-adapter-wallets',
            '@jup-ag/wallet-adapter'
          ],
        }
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.logs - needed for wallet callbacks
      }
    }
  },
  // Enable faster rebuilds in dev
  server: {
    hmr: {
      overlay: false
    }
  }
})
// Force Vercel rebuild Sat Dec 13 08:19:33 PST 2025
// Trigger fresh deploy Sat Dec 13 08:38:36 PST 2025
// Trigger Vercel deployment Sat Dec 13 16:57:17 PST 2025
