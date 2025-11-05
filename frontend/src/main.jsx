import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Wallet imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// WebSocket context for singleton connection
import { LiveDataProvider } from './hooks/useLiveDataContext.jsx';

// Default styles for wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';

// Solana network (mainnet-beta for production)
const network = WalletAdapterNetwork.Mainnet;
const endpoint = clusterApiUrl(network);

// Wallet configuration
const wallets = [];

// Register service worker for PWA and caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('✅ Service Worker registered'))
      .catch(err => console.log('❌ Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <LiveDataProvider>
            <App />
          </LiveDataProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
)
