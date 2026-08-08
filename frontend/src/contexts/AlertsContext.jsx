import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useWallet } from './WalletContext';
import {
  getAllPrefs,
  getPrefs,
  toggleLevel as storageToggleLevel,
  clearPrefs as storageClearPrefs,
  replaceAllPrefs,
  markTriggered,
  getNotifications,
  addNotification,
  getUnreadCount,
  markAllRead as storageMarkAllRead,
  syncPrefsToBackend,
  loadPrefsFromBackend,
} from '../utils/alertStorage';

const AlertsContext = createContext(null);

// Safe fallback so components (e.g. CoinCard) never crash if rendered outside
// the provider — alert controls simply become no-ops.
const NOOP_ALERTS = {
  prefs: {},
  notifications: [],
  unreadCount: 0,
  toggleLevel: () => {},
  clearCoinAlerts: () => {},
  getCoinAlerts: () => null,
  markAllRead: () => {},
  refreshFromStorage: () => {},
};

export const useAlerts = () => {
  return useContext(AlertsContext) || NOOP_ALERTS;
};

// How often to poll prices for coins that have alerts set.
const POLL_INTERVAL = 45000;

export function AlertsProvider({ children }) {
  const wallet = useWallet();
  const walletAddress = wallet?.walletAddress || null;
  const connected = wallet?.connected || false;

  const [prefs, setPrefs] = useState(() => getAllPrefs());
  const [notifications, setNotifications] = useState(() => getNotifications());
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());

  const refreshFromStorage = useCallback(() => {
    setPrefs(getAllPrefs());
    setNotifications(getNotifications());
    setUnreadCount(getUnreadCount());
  }, []);

  // Toggle an alert level for a coin. Persists locally and (if connected) syncs.
  const toggleLevel = useCallback(
    (coin, level, currentPrice) => {
      storageToggleLevel(coin, level, currentPrice);
      const updated = getAllPrefs();
      setPrefs(updated);
      if (connected && walletAddress) {
        syncPrefsToBackend(walletAddress, updated);
      }
    },
    [connected, walletAddress]
  );

  const clearCoinAlerts = useCallback(
    (mint) => {
      storageClearPrefs(mint);
      const updated = getAllPrefs();
      setPrefs(updated);
      if (connected && walletAddress) {
        syncPrefsToBackend(walletAddress, updated);
      }
    },
    [connected, walletAddress]
  );

  const markAllRead = useCallback(() => {
    const list = storageMarkAllRead();
    setNotifications(list);
    setUnreadCount(0);
  }, []);

  const getCoinAlerts = useCallback((mint) => getPrefs(mint), []);

  // Hydrate preferences from the backend once a wallet connects.
  useEffect(() => {
    if (!connected || !walletAddress) return;
    let cancelled = false;
    (async () => {
      const remote = await loadPrefsFromBackend(walletAddress);
      if (cancelled || !remote) return;
      // Merge remote into local, preferring local baselines that already exist.
      const local = getAllPrefs();
      const merged = { ...remote, ...local };
      replaceAllPrefs(merged);
      setPrefs(merged);
      syncPrefsToBackend(walletAddress, merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, walletAddress]);

  // Price monitoring: poll Dexscreener for coins that have alerts and fire
  // notifications when a level threshold is crossed.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    const checkAlerts = async () => {
      const current = prefsRef.current;
      const mints = Object.keys(current);
      if (mints.length === 0) return;

      // Dexscreener accepts up to 30 comma-separated addresses per request.
      const batches = [];
      for (let i = 0; i < mints.length; i += 30) {
        batches.push(mints.slice(i, i + 30));
      }

      const priceByMint = new Map();
      await Promise.all(
        batches.map(async (batch) => {
          try {
            const res = await fetch(
              `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`
            );
            if (!res.ok) return;
            const data = await res.json();
            (data?.pairs || []).forEach((pair) => {
              const addr = pair?.baseToken?.address;
              const price = Number(pair?.priceUsd);
              if (addr && price > 0 && !priceByMint.has(addr)) {
                priceByMint.set(addr, price);
              }
            });
          } catch (_) {
            /* silent — will retry next interval */
          }
        })
      );

      let fired = false;
      mints.forEach((mint) => {
        const entry = current[mint];
        if (!entry) return;
        const price = priceByMint.get(mint);
        if (!price || !entry.basePrice) return;

        const changePct = ((price - entry.basePrice) / entry.basePrice) * 100;
        (entry.levels || []).forEach((level) => {
          if (entry.triggered && entry.triggered[level]) return;
          const crossed = level > 0 ? changePct >= level : changePct <= level;
          if (!crossed) return;

          markTriggered(mint, level);
          const sign = level > 0 ? '+' : '';
          addNotification({
            id: `alert-${mint}-${level}-${Date.now()}`,
            mint,
            coin: entry.coin,
            level,
            price,
            message:
              level > 0
                ? `is up ${sign}${level}% — your alert was triggered`
                : `is down ${level}% — your alert was triggered`,
            timestamp: Date.now(),
          });
          fired = true;
        });
      });

      if (fired) {
        setPrefs(getAllPrefs());
        setNotifications(getNotifications());
        setUnreadCount(getUnreadCount());
      }
    };

    checkAlerts();
    const id = setInterval(checkAlerts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const value = {
    prefs,
    notifications,
    unreadCount,
    toggleLevel,
    clearCoinAlerts,
    getCoinAlerts,
    markAllRead,
    refreshFromStorage,
  };

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}
