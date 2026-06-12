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

const CopyTradeContext = createContext(null);

export const useCopyTrade = () => {
  const ctx = useContext(CopyTradeContext);
  if (!ctx) throw new Error('useCopyTrade must be used inside CopyTradeProvider');
  return ctx;
};

const POLL_INTERVAL_MS = 20000; // 20 seconds
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

  // Keep lastSeen in a ref so poll() always reads the freshest value
  const lastSeenRef = useRef(loadLastSeen());
  const pollRef = useRef(null);

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
            return {
              id: s.signature,
              ...s,
              walletLabel:
                wallet?.label ||
                `${s.walletAddress.slice(0, 4)}...${s.walletAddress.slice(-4)}`,
            };
          });

        if (newNotifs.length === 0) return prev;

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

  // Stable callback — reads onCopyTrade from ref so it never becomes stale
  const copyTrade = useCallback(
    notification => {
      dismiss(notification.id);
      onCopyTradeRef.current?.(notification);
    },
    [dismiss]
  );

  return (
    <CopyTradeContext.Provider value={{ queue, dismiss, copyTrade }}>
      {children}
    </CopyTradeContext.Provider>
  );
};
