// Instant buy mode bar — two big Buy / Sell buttons pinned above the bottom
// nav for the coin currently in view. Appears only while "Instant buy mode"
// is ON in the Trade window and a trading wallet exists. One tap trades at
// the saved presets with no confirmation (that is the mode's whole point);
// tapping the coin strip opens the Trade window to change mode / settings.
import React, { useEffect, useState, useRef } from 'react';
import { getPresets, loadTradingWallet } from '../utils/instantTradeWallet';
import { executeInstantBuy, executeInstantSell, getTradingLimits } from '../utils/instantTrade';
import { readPendingTrades } from '../utils/pendingTrades';
import './InstantTradeBar.css';

export default function InstantTradeBar({ coin, visible = true, onOpenTrade }) {
  const [presets, setPresets] = useState(() => getPresets());
  const [hasWallet, setHasWallet] = useState(false);
  const [walletKey, setWalletKey] = useState(null);
  const [busy, setBusy] = useState(null); // 'buy' | 'sell' | null
  const [flash, setFlash] = useState(null); // { ok, text }
  const [limits, setLimits] = useState(null);
  const [pending, setPending] = useState(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    const syncWallet = () => loadTradingWallet().then((w) => {
      if (alive) { setHasWallet(Boolean(w)); setWalletKey(w?.publicKey || null); }
    }).catch((error) => {
      console.error('[instant-trade-bar] wallet unavailable:', error.message);
      if (alive) { setHasWallet(false); setWalletKey(null); }
    });
    syncWallet();
    const onPresets = (e) => setPresets({ ...getPresets(), ...(e.detail || {}) });
    window.addEventListener('moonfeed:instant-presets-changed', onPresets);
    window.addEventListener('moonfeed:instant-wallet-changed', syncWallet);
    return () => {
      alive = false;
      window.removeEventListener('moonfeed:instant-presets-changed', onPresets);
      window.removeEventListener('moonfeed:instant-wallet-changed', syncWallet);
      clearTimeout(flashTimer.current);
    };
  }, []);

  const mint = coin?.mintAddress || coin?.address;
  const show = visible && presets.enabled && hasWallet && Boolean(mint);

  useEffect(() => {
    if (!show) { setPending(null); return undefined; }
    let alive = true;
    const syncPending = async (event) => {
      try {
        const wallet = await loadTradingWallet();
        if (!alive) return;
        const records = readPendingTrades().filter((record) => record.walletAddress === wallet?.publicKey && record.tokenMint === mint);
        setPending(records.find((record) => record.status !== 'confirmed') || records[0] || null);
        if (event?.detail?.mint === mint && event.detail.error) {
          setFlash({ ok: false, text: event.detail.error });
        }
      } catch (error) {
        console.error('[instant-trade-bar] pending history unavailable:', error.message);
        if (alive) setFlash({ ok: false, text: error.message });
      }
    };
    syncPending();
    window.addEventListener('moonfeed:instant-trade', syncPending);
    window.addEventListener('moonfeed:instant-wallet-changed', syncPending);
    window.addEventListener('moonfeed:trade-recovery-error', syncPending);
    return () => {
      alive = false;
      window.removeEventListener('moonfeed:instant-trade', syncPending);
      window.removeEventListener('moonfeed:instant-wallet-changed', syncPending);
      window.removeEventListener('moonfeed:trade-recovery-error', syncPending);
    };
  }, [show, mint]);

  // Balance / max-buy awareness so the Buy button can say when it can't afford the preset.
  useEffect(() => {
    if (!show) return undefined;
    let alive = true;
    setLimits(null);
    getTradingLimits(mint).then((l) => { if (alive) setLimits(l); }).catch((error) => {
      console.warn('[instant-trade-bar] balance limits unavailable:', error.message);
    });
    return () => { alive = false; };
  }, [show, mint, flash, walletKey]);

  const say = (ok, text) => {
    clearTimeout(flashTimer.current);
    setFlash({ ok, text });
    flashTimer.current = setTimeout(() => setFlash(null), 5000);
  };

  const buy = async () => {
    if (busy) return;
    setBusy('buy');
    try {
      const out = await executeInstantBuy(coin);
      say(!out.warning, out.warning || (out.confirmed ? `Bought ${presets.buySol} SOL of ${coin.symbol}` : `Buy submitted — confirming…`));
    } catch (err) {
      say(false, (err?.message || 'Buy failed').slice(0, 110));
    } finally {
      setBusy(null);
    }
  };

  const sell = async () => {
    if (busy) return;
    const pct = Math.min(100, Math.max(1, Number(presets.sellPct) || 100));
    setBusy('sell');
    try {
      const out = await executeInstantSell(coin, pct);
      say(!out.warning, out.warning || (out.confirmed ? `Sold ${pct === 100 ? 'position' : `${pct}%`} of ${coin.symbol} for ${Number(out.solReceived || 0).toFixed(4)} SOL` : 'Sell submitted — confirming…'));
    } catch (err) {
      say(false, (err?.message || 'Sell failed').slice(0, 110));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    document.body.classList.toggle('itb-open', show);
    return () => document.body.classList.remove('itb-open');
  }, [show]);

  if (!show) return null;

  const sellPct = Math.min(100, Math.max(1, Number(presets.sellPct) || 100));
  const cantAfford = limits && limits.sol < Number(presets.buySol) + limits.buyOverheadSol;

  return (
    <div className="itb" role="region" aria-label="Instant trade">
      {pending
        ? <a className="itb-flash pending" href={`https://solscan.io/tx/${pending.signature}`} target="_blank" rel="noopener noreferrer">{pending.status === 'confirmed' ? 'Trade confirmed — history/exit setup incomplete. View transaction.' : 'Awaiting confirmation — view transaction. Do not retry.'}</a>
        : flash && <div className={`itb-flash ${flash.ok ? 'ok' : 'err'}`}>{flash.text}</div>}
      <button type="button" className="itb-strip" onClick={onOpenTrade} title="Instant buy mode is on — tap to change mode or settings">
        <span className="itb-dot" />
        <span className="itb-strip-text">
          <strong>Instant mode</strong>
          <span>{coin?.symbol || 'Coin'} · {presets.slippagePct}% slip{presets.autoSellPct ? ` · TP +${presets.autoSellPct}%` : ''}{presets.stopLossPct ? ` · SL −${presets.stopLossPct}%` : ''}</span>
        </span>
        {limits && <span className="itb-balance">{limits.sol.toFixed(3)} SOL</span>}
      </button>
      <div className="itb-buttons">
        <button type="button" className={`itb-btn itb-btn--buy${busy === 'buy' ? ' busy' : ''}${cantAfford ? ' warn' : ''}`} disabled={Boolean(busy || pending)} onClick={buy}>
          <span className="itb-btn-label">{busy === 'buy' ? 'Buying…' : 'Buy'}</span>
          <span className="itb-btn-sub">{cantAfford ? `Need ${(Number(presets.buySol) + (limits?.buyOverheadSol || 0)).toFixed(3)} SOL` : `${presets.buySol} SOL`}</span>
        </button>
        <button type="button" className={`itb-btn itb-btn--sell${busy === 'sell' ? ' busy' : ''}`} disabled={Boolean(busy || (pending && pending.status !== 'confirmed'))} onClick={sell}>
          <span className="itb-btn-label">{busy === 'sell' ? 'Selling…' : 'Sell'}</span>
          <span className="itb-btn-sub">{sellPct === 100 ? 'whole position' : `${sellPct}% of position`}</span>
        </button>
      </div>
    </div>
  );
}
