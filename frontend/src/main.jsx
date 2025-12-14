import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Jupiter Wallet Kit imports
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';

// Standard Solana wallet adapters
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  Coin98WalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// WebSocket context for singleton connection
import { LiveDataProvider } from './hooks/useLiveDataContext.jsx';

// Wallet notification handler
import { WalletNotification } from './components/WalletNotification.jsx';

// Root component that provides wallet context
function RootApp() {
  // Initialize wallet adapters - these provide the connection to browser wallet extensions
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new Coin98WalletAdapter(),
      new TrustWalletAdapter(),
    ],
    []
  );
  
  return (
    <UnifiedWalletProvider
      wallets={wallets}
      config={{
        autoConnect: false,
        env: "mainnet-beta",
        metadata: {
          name: "Moonfeed",
          description: "Discover trending meme coins on Solana",
          url: typeof window !== 'undefined' ? window.location.origin : 'https://moonfeed.app',
          iconUrls: ['https://moonfeed.app/favicon.ico'],
        },
        notificationCallback: WalletNotification,
        walletlistExplanation: {
          href: "https://jup.ag",
        },
        theme: "dark",
        lang: "en",
      }}
    >
      <LiveDataProvider>
        <App />
      </LiveDataProvider>
    </UnifiedWalletProvider>
  );
}

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
    <RootApp />
  </StrictMode>,
)
// Vercel webhook test Sat Dec 13 17:26:33 PST 2025
