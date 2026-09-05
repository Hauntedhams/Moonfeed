import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useTrackedWallets } from './TrackedWalletsContext';
import { getFullApiUrl } from '../config/api';
import { initTradeNotifications, notifyWalletTrade } from '../utils/tradeNotifications';
import { addNotification } from '../utils/alertStorage';

const CopyTradeContext = createContext(null);

export const useCopyTrade = () => {
  const ctx = useContext(CopyTradeContext);
  if (!ctx) throw new Error('useCopyTrade must be used inside CopyTradeProvider');
  return ctx;
};

const POLL_INTERVAL_MS = 60000; // 60s — each backend cache miss costs 100 Helius credits per wallet
const LS_KEY = 'moonfeed_copytrade_seen';

function loadLastSeen() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLastSeen(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

/**
 * CopyTradeProvider
 *
 * Polls /api/copy-trade/recent-swaps every 20 seconds for tracked wallets.
 * Pushes new swap notifications into `queue`.
 * Calls `onCopyTrade(notification)` when the user taps "Copy Trade".
 */
export const CopyTradeProvider = ({ children, onCopyTrade }) => {
  const { trackedWallets } = useTrackedWallets();
  const [queue, setQueue] = useState([]); // pending toast notifications

  // Request OS notification permission once we have wallets to watch.
  useEffect(() => {
    if (trackedWallets.some(w => w.copyTradeEnabled !== false)) {
      initTradeNotifications();
    }
  }, [trackedWallets]);

  // Keep lastSeen in a ref so poll() always reads the freshest value
  const lastSeenRef = useRef(loadLastSeen());
  const pollRef = useRef(null);
  const walletProfilesRef = useRef({});

  useEffect(() => {
    const activeWallets = trackedWallets.filter(w => w.copyTradeEnabled !== false && w.address);
    if (!activeWallets.length) {
      walletProfilesRef.current = {};
      return;
    }

    let cancelled = false;
    Promise.all(activeWallets.map(async (wallet) => {
      try {
        const res = await fetch(getFullApiUrl(`/api/users/${wallet.address}`));
        if (!res.ok) return null;
        const profile = await res.json();
        return [wallet.address, {
          displayName: profile?.displayName || '',
          profilePicture: profile?.profilePicture || null,
        }];
      } catch {
        return null;
      }
    })).then((entries) => {
      if (cancelled) return;
      walletProfilesRef.current = Object.fromEntries(entries.filter(Boolean));
    });

    return () => { cancelled = true; };
  }, [trackedWallets]);

  // Store onCopyTrade in a ref to keep copyTrade() callback stable
  const onCopyTradeRef = useRef(onCopyTrade);
  useEffect(() => {
    onCopyTradeRef.current = onCopyTrade;
  }, [onCopyTrade]);

  const poll = useCallback(async () => {
    if (!trackedWallets.length) return;

    // Only poll wallets that have copy trading enabled (default true for legacy wallets)
    const activeWallets = trackedWallets.filter(w => w.copyTradeEnabled !== false);
    if (!activeWallets.length) return;

    // Build per-wallet since timestamps:
    // - If we've seen a tx before: use that timestamp
    // - If brand new: use the wallet's addedAt time so we don't surface old trades
    const wallets = activeWallets.map(w => ({
      address: w.address,
      since: lastSeenRef.current[w.address] ?? Math.floor((w.addedAt || Date.now()) / 1000),
    }));

    try {
      const res = await fetch(getFullApiUrl('/api/copy-trade/recent-swaps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets }),
      });

      if (!res.ok) return;

      const { swaps } = await res.json();
      if (!Array.isArray(swaps) || swaps.length === 0) return;

      // Update lastSeen timestamps
      const updated = { ...lastSeenRef.current };
      swaps.forEach(s => {
        if (!updated[s.walletAddress] || s.timestamp > updated[s.walletAddress]) {
          updated[s.walletAddress] = s.timestamp;
        }
      });
      lastSeenRef.current = updated;
      saveLastSeen(updated);

      // Enrich with wallet label and push to queue (deduplicate by signature)
      setQueue(prev => {
        const seen = new Set(prev.map(n => n.id));
        const newNotifs = swaps
          .filter(s => !seen.has(s.signature))
          .map(s => {
            const wallet = trackedWallets.find(w => w.address === s.walletAddress);
            const profile = walletProfilesRef.current[s.walletAddress] || {};
            return {
              id: s.signature,
              ...s,
              walletLabel:
                profile.displayName ||
                wallet?.label ||
                `${s.walletAddress.slice(0, 4)}...${s.walletAddress.slice(-4)}`,
              walletProfileImage: profile.profilePicture || null,
            };
          });

        if (newNotifs.length === 0) return prev;

        // Fire a native OS push notification for each new trade if notifications are enabled
        newNotifs.forEach(n => {
          const targetW = trackedWallets.find(w => w.address === n.walletAddress);
          if (!targetW || targetW.notificationsEnabled !== false) {
            // Wallet alerts show the WALLET's picture: the hosted profile pic
            // when it's a remote URL, otherwise the same generated avatar the
            // app renders (served by the backend avatar endpoint).
            const walletImage = /^https:/i.test(n.walletProfileImage || '')
              ? n.walletProfileImage
              : (n.walletAddress ? getFullApiUrl(`/api/avatar/wallet/${n.walletAddress}.png`) : null);
            notifyWalletTrade({ ...n, walletImage });
          }
          addNotification({
            id: `wallet-trade-${n.signature || n.id}`,
            target: 'wallets',
            walletAddress: n.walletAddress,
            walletLabel: n.walletLabel,
            walletProfileImage: n.walletProfileImage || null,
            mint: n.tokenMint,
            coin: {
              symbol: n.tokenSymbol || 'TOKEN',
              name: n.tokenSymbol || 'Token',
              image: n.tokenImage || null,
            },
            message: `${n.type === 'sell' ? 'Sold' : 'Bought'} ${n.tokenSymbol || 'a token'}`,
            timestamp: (n.timestamp || Date.now() / 1000) * ((n.timestamp || 0) < 1e12 ? 1000 : 1),
          });
        });

        // Haptic feedback on mobile
        try {
          if (navigator.vibrate) navigator.vibrate(50);
        } catch {
          // ignore
        }

        return [...newNotifs, ...prev].slice(0, 10); // cap at 10
      });
    } catch (err) {
      // Non-critical — silently swallow poll errors
      console.debug('[CopyTrade] Poll error:', err.message);
    }
  }, [trackedWallets]);

  // Start / restart polling when tracked wallets change
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!trackedWallets.length) return;

    poll(); // fire immediately
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [trackedWallets, poll]);

  const dismiss = useCallback(id => {
    setQueue(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setQueue([]);
  }, []);

  // Stable callback — reads onCopyTrade from ref so it never becomes stale
  const copyTrade = useCallback(
    notification => {
      dismiss(notification.id);
      onCopyTradeRef.current?.(notification);
    },
    [dismiss]
  );

  return (
    <CopyTradeContext.Provider value={{ queue, dismiss, dismissAll, copyTrade }}>
      {children}
    </CopyTradeContext.Provider>
  );
};
