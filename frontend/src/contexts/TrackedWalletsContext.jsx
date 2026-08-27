import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { getFullApiUrl } from '../config/api';
import { useWalletConnectOnboarding } from '../components/WalletConnectOnboarding';

const TrackedWalletsContext = createContext();

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
      return;
    }
    if (syncedWalletRef.current === walletAddress) return;
    syncedWalletRef.current = walletAddress;

    fetch(getFullApiUrl(`/api/users/${walletAddress}/tracked-wallets`))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const remote = Array.isArray(data?.trackedWallets) ? data.trackedWallets : [];
        skipNextSaveRef.current = true;
        setTrackedWallets(remote);
        console.log(`☁️ Synced ${remote.length} tracked wallets from account`);
      })
      .catch(err => console.warn('Could not load tracked wallets from account:', err.message));
  }, [connected, walletAddress]);

  // Cache only the active account's list for a faster connected reload.
  useEffect(() => {
    if (connected && walletAddress) {
      localStorage.setItem('moonfeed_tracked_wallets', JSON.stringify(trackedWallets));
    }
  }, [trackedWallets, connected, walletAddress]);

  // Save to the signed-in account whenever trackedWallets changes, so it syncs cross-device.
  useEffect(() => {
    if (!connected || !walletAddress) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetch(getFullApiUrl(`/api/users/${walletAddress}/tracked-wallets`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedWallets }),
      }).catch(err => console.warn('Could not save tracked wallets to account:', err.message));
    }, 800);
    return () => clearTimeout(timer);
  }, [trackedWallets, connected, walletAddress]);

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
