// Shared "which wallet am I viewing" state for Trades/Profile — main connected
// wallet vs the in-app ⚡ trading wallet, switchable like Instagram accounts.
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { loadTradingWallet } from '../utils/instantTradeWallet';

const STORAGE = 'moonfeed_wallet_view'; // 'main' | 'instant'

export function useWalletView() {
  const [mode, setModeState] = useState(() => (localStorage.getItem(STORAGE) === 'instant' ? 'instant' : 'main'));
  const [instantWallet, setInstantWallet] = useState(null);

  useEffect(() => {
    let alive = true;
    loadTradingWallet().then((w) => { if (alive) setInstantWallet(w); });
    const onModeChange = (e) => setModeState(e.detail === 'instant' ? 'instant' : 'main');
    const onWalletChange = () => loadTradingWallet().then((w) => { if (alive) setInstantWallet(w); });
    window.addEventListener('moonfeed:wallet-view-changed', onModeChange);
    window.addEventListener('moonfeed:instant-wallet-changed', onWalletChange);
    return () => {
      alive = false;
      window.removeEventListener('moonfeed:wallet-view-changed', onModeChange);
      window.removeEventListener('moonfeed:instant-wallet-changed', onWalletChange);
    };
  }, []);

  const setMode = useCallback((next) => {
    const value = next === 'instant' ? 'instant' : 'main';
    localStorage.setItem(STORAGE, value);
    setModeState(value);
    window.dispatchEvent(new CustomEvent('moonfeed:wallet-view-changed', { detail: value }));
  }, []);

  return { mode, setMode, instantWallet };
}

// The single "who is signed in" answer for account features (follow/track,
// synced lists, holdings). The ⚡ trading wallet is a full Moonfeed account:
// it is the active identity when selected in the wallet switcher, and the
// automatic fallback whenever no main wallet is connected.
export function useActiveAccount() {
  const { mode, setMode, instantWallet } = useWalletView();
  const { publicKey, connected: mainConnected } = useWallet();
  const mainAddress = mainConnected ? (publicKey?.toString() || null) : null;
  const instantAddress = instantWallet?.publicKey || null;
  const isInstant = Boolean(instantAddress) && (mode === 'instant' || !mainAddress);
  const address = isInstant ? instantAddress : mainAddress;
  return {
    address,
    connected: Boolean(address),
    isInstant: Boolean(address) && isInstant,
    mode,
    setMode,
    instantWallet,
  };
}
