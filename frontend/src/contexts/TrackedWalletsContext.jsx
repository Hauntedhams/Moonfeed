import React, { createContext, useContext, useState, useEffect } from 'react';

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

  // Load tracked wallets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('moonfeed_tracked_wallets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTrackedWallets(parsed);
        console.log(`📋 Loaded ${parsed.length} tracked wallets from storage`);
      } catch (err) {
        console.error('Error loading tracked wallets:', err);
      }
    }
  }, []);

  // Save to localStorage whenever trackedWallets changes
  useEffect(() => {
    if (trackedWallets.length >= 0) {
      localStorage.setItem('moonfeed_tracked_wallets', JSON.stringify(trackedWallets));
    }
  }, [trackedWallets]);

  const trackWallet = (walletAddress, label = null) => {
    // Check if already tracked
    if (trackedWallets.some(w => w.address === walletAddress)) {
      console.log(`⚠️ Wallet ${walletAddress} is already tracked`);
      return false;
    }

    const newWallet = {
      address: walletAddress,
      label: label || `Wallet ${trackedWallets.length + 1}`,
      addedAt: Date.now(),
      lastViewed: Date.now()
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

  const value = {
    trackedWallets,
    trackWallet,
    untrackWallet,
    updateWalletLabel,
    updateLastViewed,
    isTracked
  };

  return (
    <TrackedWalletsContext.Provider value={value}>
      {children}
    </TrackedWalletsContext.Provider>
  );
};
