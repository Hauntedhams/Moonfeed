import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Jupiter Wallet Kit imports (replaces old wallet adapter)
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { useWrappedReownAdapter } from '@jup-ag/jup-mobile-adapter';

// WebSocket context for singleton connection
import { LiveDataProvider } from './hooks/useLiveDataContext.jsx';

// Wallet notification handler
import { WalletNotification } from './components/WalletNotification.jsx';

// Solana RPC endpoint (mainnet-beta for production)
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Root component that provides wallet context
function RootApp() {
  // Initialize Jupiter Mobile Adapter with WalletConnect/Reown configuration
  // This adapter enables mobile wallet connections through WalletConnect protocol
  const { jupiterAdapter } = useWrappedReownAdapter({
    appKitOptions: {
      metadata: {
        name: 'Moonfeed',
        description: 'Discover trending meme coins on Solana with TikTok-style scrolling',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://moonfeed.app',
        icons: ['https://moonfeed.app/favicon.ico'],
      },
      // TODO: Get your project ID from https://dashboard.reown.com/
      // This is required for WalletConnect functionality
      projectId: 'YOUR_REOWN_PROJECT_ID', // Replace with your Reown project ID
      features: {
        analytics: false,
        socials: ['google', 'x', 'apple'],
        email: false,
      },
      // Disable built-in wallet list to use only Jupiter Mobile Adapter
      enableWallets: false,
    },
  });
  
  // Configure wallet adapters for the UnifiedWalletProvider
  // This memoized array includes the Jupiter Mobile Adapter and filters out any invalid adapters
  const wallets = useMemo(() => {
    return [
      jupiterAdapter, // Jupiter Mobile Adapter with WalletConnect integration
    ].filter((item) => item && item.name && item.icon);
  }, [jupiterAdapter]);

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
