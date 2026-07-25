import React, { createContext, useContext, useState } from 'react';
import { PublicKey } from '@solana/web3.js';

/**
 * Demo Mode Context
 * Allows Apple App Reviewers to access all app screens without a real Solana wallet.
 *
 * SETUP (one-time, before resubmitting to App Review):
 * 1. Create a new Solana wallet (Phantom or Solflare).
 * 2. Send ~0.5 SOL to it.
 * 3. Open https://app.moonfeed.app and make 2-3 meme coin swaps with that wallet.
 * 4. Replace DEMO_WALLET_ADDRESS below with that wallet's public address.
 * 5. Rebuild and redeploy.
 */
const DEMO_WALLET_ADDRESS = '34GAnxxnJQpSbPbe7sbgDTdBzBD4Hq74bSZicZiyRpmd';

const DemoModeContext = createContext(null);

export const useDemoMode = () => {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider');
  return ctx;
};

export const DemoModeProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);

  let demoPublicKey = null;
  if (DEMO_WALLET_ADDRESS && !DEMO_WALLET_ADDRESS.startsWith('REPLACE_')) {
    try {
      demoPublicKey = new PublicKey(DEMO_WALLET_ADDRESS);
    } catch (e) {
      console.warn('[DemoMode] Invalid demo wallet address:', DEMO_WALLET_ADDRESS);
    }
  }

  const enableDemoMode = () => {
    console.log('[DemoMode] Demo mode enabled for App Review');
    setIsDemoMode(true);
  };

  const disableDemoMode = () => {
    console.log('[DemoMode] Demo mode disabled');
    setIsDemoMode(false);
  };

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        demoPublicKey,
        demoWalletAddress: DEMO_WALLET_ADDRESS,
        enableDemoMode,
        disableDemoMode,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
};
