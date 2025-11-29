import React, { useEffect } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';

/**
 * Wallet Debug Component
 * Logs wallet connection events to help diagnose connection issues
 */
const WalletDebug = () => {
  const wallet = useWallet();

  useEffect(() => {
    console.log('🔍 Wallet Debug - Current State:', {
      connected: wallet.connected,
      connecting: wallet.connecting,
      disconnecting: wallet.disconnecting,
      publicKey: wallet.publicKey?.toString(),
      walletName: wallet.wallet?.adapter?.name,
      readyState: wallet.wallet?.adapter?.readyState,
    });
  }, [
    wallet.connected,
    wallet.connecting,
    wallet.disconnecting,
    wallet.publicKey,
    wallet.wallet,
  ]);

  // Log when connect is called
  useEffect(() => {
    if (wallet.connecting) {
      console.log('🔄 Wallet is connecting...', {
        walletName: wallet.wallet?.adapter?.name,
      });
    }
  }, [wallet.connecting, wallet.wallet]);

  // Log when connection succeeds
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      console.log('✅ Wallet connected successfully!', {
        publicKey: wallet.publicKey.toString(),
        walletName: wallet.wallet?.adapter?.name,
      });
    }
  }, [wallet.connected, wallet.publicKey, wallet.wallet]);

  // Log connection errors
  useEffect(() => {
    const handleError = (error) => {
      console.error('❌ Wallet connection error:', error);
    };

    // Listen for wallet events if available
    if (wallet.wallet?.adapter) {
      const adapter = wallet.wallet.adapter;
      adapter.on?.('error', handleError);
      
      return () => {
        adapter.off?.('error', handleError);
      };
    }
  }, [wallet.wallet]);

  return null; // This component doesn't render anything
};

export default WalletDebug;
