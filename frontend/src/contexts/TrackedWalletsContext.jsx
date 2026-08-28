import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { getFullApiUrl } from '../config/api';
import { useWalletConnectOnboarding } from '../components/WalletConnectOnboarding';

const TrackedWalletsContext = createContext();

// Per-account cache so switching wallets never shows the previous account's list.
const cacheKey = (address) => `moonfeed_tracked_wallets_${address}`;

export const useTrackedWallets = () => {
  const context = useContext(TrackedWalletsContext);
  if (!context) {
    throw new Error('useTrackedWallets must be used within TrackedWalletsProvider');
  }
  return context;
};

export const TrackedWalletsProvider = ({ children }) => {
  const [trackedWallets, setTrackedWallets] = useState([]);
  const { publicKey, connected } = useWallet();
  const { openWalletConnect } = useWalletConnectOnboarding();
  const walletAddress = publicKey?.toString() || null;
  const syncedWalletRef = useRef(null); // account address we've already pulled synced data for
  const skipNextSaveRef = useRef(false); // true right after loading remote data, to avoid an immediate re-save
  const hydratedRef = useRef(false); // blocks saving until the first remote read settles
  const pendingSaveTimerRef = useRef(null); // debounce timer for the backend save, flushable on backgrounding
  const latestSaveRef = useRef({ walletAddress: null, trackedWallets: [] }); // always up to date for the flush handler

  // Tracking and copy-trade notifications require a connected account. Remove
  // legacy guest records so they cannot appear or run notifications after logout.
  useEffect(() => {
    if (!connected || !walletAddress) {
      setTrackedWallets([]);
      localStorage.removeItem('moonfeed_tracked_wallets');
    }
  }, [connected, walletAddress]);

  // When a wallet signs in, pull this account's synced tracked-wallet list from the
  // backend so tracked wallets follow the user across devices.
  useEffect(() => {
    if (!connected || !walletAddress) {
      syncedWalletRef.current = null;
      hydratedRef.current = false;
      return;
    }
    if (syncedWalletRef.current === walletAddress) return;
    syncedWalletRef.current = walletAddress;
    hydratedRef.current = false;

    // Show the cached list immediately; the remote read reconciles it.
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey(walletAddress)) || '[]');
    } catch (_) { /* ignore corrupt cache */ }
    if (Array.isArray(cached) && cached.length) {
      skipNextSaveRef.current = true;
      setTrackedWallets(cached);
    }

    fetch(getFullApiUrl(`/api/users/${walletAddress}/tracked-wallets`))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const remote = Array.isArray(data?.trackedWallets) ? data.trackedWallets : [];
        // An empty account must not wipe a device that still holds the list — that
        // local copy gets pushed up instead.
        if (remote.length) {
          skipNextSaveRef.current = true;
          setTrackedWallets(remote);
        }
        console.log(`☁️ Synced ${remote.length} tracked wallets from account`);
      })
      .catch(err => console.warn('Could not load tracked wallets from account:', err.message))
      .finally(() => { hydratedRef.current = true; });
  }, [connected, walletAddress]);

  // Cache only the active account's list for a faster connected reload.
  useEffect(() => {
    if (connected && walletAddress) {
      localStorage.setItem(cacheKey(walletAddress), JSON.stringify(trackedWallets));
    }
  }, [trackedWallets, connected, walletAddress]);

  // Keep the latest values available to the background-flush handler below.
  useEffect(() => {
    latestSaveRef.current = { walletAddress, trackedWallets };
  }, [walletAddress, trackedWallets]);

  const saveTrackedWalletsNow = (addr, list) => {
    fetch(getFullApiUrl(`/api/users/${addr}/tracked-wallets`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackedWallets: list }),
      keepalive: true, // lets the request finish even if the tab/app is closing
    }).catch(err => console.warn('Could not save tracked wallets to account:', err.message));
  };

  // Save to the signed-in account whenever trackedWallets changes, so it syncs cross-device.
  useEffect(() => {
    if (!connected || !walletAddress) return;
    // Saving before the remote read lands would push an empty list over real data.
    if (!hydratedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    pendingSaveTimerRef.current = setTimeout(() => {
      pendingSaveTimerRef.current = null;
      saveTrackedWalletsNow(walletAddress, trackedWallets);
    }, 800);
    return () => {
      clearTimeout(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
    };
  }, [trackedWallets, connected, walletAddress]);

  // A debounced save can be silently lost if the app is backgrounded/closed before
  // the timer fires (e.g. tracking a wallet then immediately switching apps) — flush
  // any pending save the instant the app is hidden so nothing gets dropped.
  useEffect(() => {
    const flush = () => {
      if (!pendingSaveTimerRef.current) return;
      clearTimeout(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
      const { walletAddress: addr, trackedWallets: list } = latestSaveRef.current;
      if (addr) saveTrackedWalletsNow(addr, list);
    };
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Ask the backend to warm analytics/trades for tracked wallets in the background.
  useEffect(() => {
    if (trackedWallets.length === 0) return;

    const timer = setTimeout(() => {
      fetch(getFullApiUrl('/api/wallet/warm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets: trackedWallets.slice(0, 20), includeTrades: true }),
      }).catch((err) => {
        console.warn('Wallet warm request failed:', err.message);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [trackedWallets]);

  const trackWallet = (walletAddress, label = null) => {
    if (!connected) {
      openWalletConnect();
      return false;
    }

    // Check if already tracked
    if (trackedWallets.some(w => w.address === walletAddress)) {
      console.log(`⚠️ Wallet ${walletAddress} is already tracked`);
      return false;
    }

    const newWallet = {
      address: walletAddress,
      label: label || `Wallet ${trackedWallets.length + 1}`,
      addedAt: Date.now(),
      lastViewed: Date.now(),
      copyTradeEnabled: true,
    };

    setTrackedWallets(prev => [...prev, newWallet]);
    console.log(`✅ Tracking wallet: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);
    return true;
  };

  const untrackWallet = (walletAddress) => {
    setTrackedWallets(prev => prev.filter(w => w.address !== walletAddress));
    console.log(`🗑️ Untracked wallet: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);
  };

  const updateWalletLabel = (walletAddress, newLabel) => {
    setTrackedWallets(prev => 
      prev.map(w => 
        w.address === walletAddress 
          ? { ...w, label: newLabel }
          : w
      )
    );
  };

  const updateLastViewed = (walletAddress) => {
    setTrackedWallets(prev => 
      prev.map(w => 
        w.address === walletAddress 
          ? { ...w, lastViewed: Date.now() }
          : w
      )
    );
  };

  const isTracked = (walletAddress) => {
    return trackedWallets.some(w => w.address === walletAddress);
  };

  const toggleCopyTrade = (walletAddress) => {
    setTrackedWallets(prev =>
      prev.map(w =>
        w.address === walletAddress
          ? { ...w, copyTradeEnabled: !(w.copyTradeEnabled ?? true) }
          : w
      )
    );
  };

  const value = {
    trackedWallets,
    trackWallet,
    untrackWallet,
    updateWalletLabel,
    updateLastViewed,
    isTracked,
    toggleCopyTrade,
  };

  return (
    <TrackedWalletsContext.Provider value={value}>
      {children}
    </TrackedWalletsContext.Provider>
  );
};
