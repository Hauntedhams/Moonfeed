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

// Solana Mobile Wallet Adapter — lets the native Android app connect to an
// installed wallet app (Phantom, Solflare, etc.) via the MWA protocol instead
// of relying on a browser extension that doesn't exist inside the WebView.
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

// WebSocket context for singleton connection
import { LiveDataProvider } from './hooks/useLiveDataContext.jsx';

// Universal wallet profile sync
import { UserProfileProvider } from './contexts/UserProfileContext.jsx';

// Wallet notification handler
import { WalletNotification } from './components/WalletNotification.jsx';

// Demo mode (App Review access without a real wallet)
import { DemoModeProvider } from './contexts/DemoModeContext.jsx';
import WalletModalTopActions from './components/WalletModalTopActions.jsx';

// Root component that provides wallet context
const IS_EXTENSION = import.meta.env.VITE_IS_EXTENSION === 'true';

function RootApp() {
  // Initialize wallet adapters — skipped in extension build to avoid loading
  // remote scripts (plugin.jup.ag) which violate Chrome Web Store policy.
  const wallets = useMemo(
    () => {
      if (IS_EXTENSION) return [];

      const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

      // On Android (native app / mobile web), add the Mobile Wallet Adapter so
      // the user can connect to their installed Phantom/Solflare app natively.
      const mobileAdapters = isAndroid
        ? [
            new SolanaMobileWalletAdapter({
              addressSelector: createDefaultAddressSelector(),
              appIdentity: {
                name: 'Moonfeed',
                uri: 'https://moonfeed.app',
                icon: '/favicon.ico',
              },
              authorizationResultCache: createDefaultAuthorizationResultCache(),
              cluster: 'mainnet-beta',
              onWalletNotFound: createDefaultWalletNotFoundHandler(),
            }),
          ]
        : [];

      return [
        ...mobileAdapters,
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
        new CoinbaseWalletAdapter(),
        new Coin98WalletAdapter(),
        new TrustWalletAdapter(),
      ];
    },
    []
  );

  const inner = (
    <LiveDataProvider>
      <UserProfileProvider>
        <App />
      </UserProfileProvider>
    </LiveDataProvider>
  );

  // In extension mode: skip UnifiedWalletProvider entirely so plugin.jup.ag
  // is never loaded (remote scripts are prohibited in Chrome extensions).
  if (IS_EXTENSION) return <DemoModeProvider>{inner}</DemoModeProvider>;

  return (
    <DemoModeProvider>
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
          // Inject "Browse without a wallet" + "Explore demo account" actions.
          // Jupiter only exposes a footer slot; CSS lifts them to the top of the
          // Connect Wallet modal (above the wallet list) so it's clear a wallet
          // is optional and App Review can preview every feature.
          walletModalAttachments: {
            footer: <WalletModalTopActions />,
          },
          theme: "dark",
          lang: "en",
        }}
      >
        {inner}
      </UnifiedWalletProvider>
    </DemoModeProvider>
  );
}

// Register service worker for PWA and caching (skip in Chrome extension — sw.js doesn't exist there)
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_IS_EXTENSION) {
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
