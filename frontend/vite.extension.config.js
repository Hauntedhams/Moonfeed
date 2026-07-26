import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chrome Extension build config
// Outputs to ../chrome-extension/dist/ with relative asset paths

// Vite plugin: remove remote scripts from index.html for the extension build.
// Chrome Web Store (Manifest V3) prohibits remotely-hosted code.
function stripRemoteScripts() {
  return {
    name: 'strip-remote-scripts',
    transformIndexHtml(html) {
      // Remove any <script> tags whose src starts with http:// or https://
      return html.replace(/<script[^>]+src=['"]https?:\/\/[^'"]+['"][^>]*><\/script>/gi, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), stripRemoteScripts()],
  base: './', // Relative paths — required for chrome-extension:// protocol

  define: {
    // Force production API and flag this as the extension build
    'import.meta.env.VITE_API_URL': JSON.stringify('https://api.moonfeed.app'),
    'import.meta.env.VITE_IS_EXTENSION': JSON.stringify('true'),
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
    'import.meta.env.MODE': JSON.stringify('production'),
    // Some Solana/wallet packages reference process.env
    'process.env.NODE_ENV': JSON.stringify('production'),
  },

  build: {
    outDir: '../chrome-extension/dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'wallet-vendor': [
            '@solana/web3.js',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-wallets',
            '@jup-ag/wallet-adapter',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
  },
})
