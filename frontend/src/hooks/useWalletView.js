// Shared "which wallet am I viewing" state for Trades/Profile — main connected
// wallet vs the in-app ⚡ trading wallet, switchable like Instagram accounts.
//
// Every screen must agree on the active identity, so the resolution rules live
// in ONE place (resolveIdentity) and every consumer goes through
// useActiveWalletIdentity(). Rules:
//   • preference 'instant'      → trading wallet (if it exists)
//   • preference 'main'         → main wallet; while the adapter is still
//                                 (re)connecting we report ready=false instead
//                                 of flipping to the trading wallet and back
//   • preference 'disconnected' → nothing (user explicitly signed out)
//   • no preference ('auto')    → main if connected, else trading wallet
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { PublicKey } from '@solana/web3.js';
import { loadTradingWallet } from '../utils/instantTradeWallet';

const STORAGE = 'moonfeed_wallet_view'; // 'main' | 'instant' | 'disconnected' | (unset = auto)
const VALID = new Set(['main', 'instant', 'disconnected', 'auto']);

const readPreference = () => {
  try {
    const stored = localStorage.getItem(STORAGE);
    return stored && VALID.has(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
};

// Module-level so every hook instance shares one trading-wallet load.
let instantWalletCache = { loaded: false, wallet: null, promise: null };
function loadInstantWalletShared(force = false) {
  if (!force && instantWalletCache.promise) return instantWalletCache.promise;
  const promise = loadTradingWallet().then((w) => {
    instantWalletCache = { loaded: true, wallet: w || null, promise };
    return w || null;
  }).catch(() => {
    instantWalletCache = { loaded: true, wallet: null, promise };
    return null;
  });
  instantWalletCache = { ...instantWalletCache, promise };
  return promise;
}

export function useWalletView() {
  const [preference, setPreferenceState] = useState(readPreference);
  const [instantWallet, setInstantWallet] = useState(() => instantWalletCache.wallet);
  const [instantReady, setInstantReady] = useState(() => instantWalletCache.loaded);

  useEffect(() => {
    let alive = true;
    loadInstantWalletShared().then((w) => { if (alive) { setInstantWallet(w); setInstantReady(true); } });
    const onModeChange = (e) => setPreferenceState(VALID.has(e.detail) ? e.detail : 'auto');
    const onWalletChange = () => loadInstantWalletShared(true).then((w) => { if (alive) { setInstantWallet(w); setInstantReady(true); } });
    window.addEventListener('moonfeed:wallet-view-changed', onModeChange);
    window.addEventListener('moonfeed:instant-wallet-changed', onWalletChange);
    return () => {
      alive = false;
      window.removeEventListener('moonfeed:wallet-view-changed', onModeChange);
      window.removeEventListener('moonfeed:instant-wallet-changed', onWalletChange);
    };
  }, []);

  const setMode = useCallback((next) => {
    const value = VALID.has(next) ? next : 'main';
    try { localStorage.setItem(STORAGE, value); } catch { /* private mode */ }
    setPreferenceState(value);
    window.dispatchEvent(new CustomEvent('moonfeed:wallet-view-changed', { detail: value }));
  }, []);

  // Back-compat: `mode` is the coarse 'main' | 'instant' | 'disconnected' view.
  const mode = preference === 'auto' ? 'main' : preference;
  return { mode, preference, setMode, instantWallet, instantReady };
}

/**
 * Pure resolver — exported for tests and for non-hook callers.
 * @returns {{ viewingInstant: boolean, address: string|null, connected: boolean, ready: boolean, reason: string }}
 */
export function resolveIdentity({ preference, instantAddress, instantReady, mainAddress, mainConnected, mainConnecting, demoAddress = null }) {
  if (demoAddress) return { viewingInstant: false, address: demoAddress, connected: true, ready: true, reason: 'demo' };
  const main = mainConnected && mainAddress ? mainAddress : null;
  if (preference === 'instant') {
    if (instantAddress) return { viewingInstant: true, address: instantAddress, connected: true, ready: true, reason: 'instant' };
    if (!instantReady) return { viewingInstant: false, address: null, connected: false, ready: false, reason: 'instant-loading' };
    // Trading wallet gone (cleared storage) — fall through to main/auto.
  }
  if (preference === 'disconnected') return { viewingInstant: false, address: null, connected: false, ready: true, reason: 'disconnected' };
  if (main) return { viewingInstant: false, address: main, connected: true, ready: true, reason: 'main' };
  if (mainConnecting) return { viewingInstant: false, address: null, connected: false, ready: false, reason: 'main-connecting' };
  if (preference === 'main') return { viewingInstant: false, address: null, connected: false, ready: true, reason: 'main-not-connected' };
  // auto
  if (!instantReady) return { viewingInstant: false, address: null, connected: false, ready: false, reason: 'instant-loading' };
  if (instantAddress) return { viewingInstant: true, address: instantAddress, connected: true, ready: true, reason: 'auto-instant' };
  return { viewingInstant: false, address: null, connected: false, ready: true, reason: 'none' };
}

/**
 * The one answer to "who is signed in right now" for every screen.
 * `ready === false` means we are still finding out (adapter auto-connecting or
 * the trading wallet still loading) — show a neutral loading state, don't
 * render the connect screen or the other wallet's data.
 */
export function useActiveWalletIdentity({ demoPublicKey = null } = {}) {
  const view = useWalletView();
  const adapter = useWallet();
  const mainAddress = adapter.publicKey ? adapter.publicKey.toString() : null;
  const resolved = resolveIdentity({
    preference: view.preference,
    instantAddress: view.instantWallet?.publicKey || null,
    instantReady: view.instantReady,
    mainAddress,
    mainConnected: Boolean(adapter.connected),
    mainConnecting: Boolean(adapter.connecting),
    demoAddress: demoPublicKey ? demoPublicKey.toString() : null,
  });
  const publicKey = useMemo(() => {
    if (!resolved.address) return null;
    if (demoPublicKey && resolved.reason === 'demo') return demoPublicKey;
    try { return new PublicKey(resolved.address); } catch { return null; }
  }, [resolved.address, resolved.reason, demoPublicKey]);

  // Switching to the main wallet: if the adapter remembers a wallet, reconnect
  // it silently; only fall back to onboarding (caller-provided) when there is
  // nothing to reconnect. Never leaves the UI on a blank overlay.
  const switchTo = useCallback(async (next, { onNeedsConnect } = {}) => {
    view.setMode(next);
    if (next !== 'main' || adapter.connected) return;
    if (adapter.wallet && !adapter.connecting) {
      try {
        await adapter.connect();
        return;
      } catch (err) {
        console.warn('[wallet-view] reconnect failed:', err?.message);
      }
    }
    onNeedsConnect?.();
  }, [view, adapter]);

  return {
    ...view,
    ...resolved,
    publicKey,
    mainAddress,
    mainConnected: Boolean(adapter.connected && adapter.publicKey),
    mainConnecting: Boolean(adapter.connecting),
    mainRemembered: Boolean(adapter.wallet),
    switchTo,
  };
}

// The single "who is signed in" answer for account features (follow/track,
// synced lists, holdings). Thin wrapper over useActiveWalletIdentity so the
// rules never diverge.
export function useActiveAccount() {
  const id = useActiveWalletIdentity();
  return {
    address: id.address,
    connected: id.connected,
    isInstant: id.connected && id.viewingInstant,
    ready: id.ready,
    mode: id.mode,
    setMode: id.setMode,
    instantWallet: id.instantWallet,
  };
}
