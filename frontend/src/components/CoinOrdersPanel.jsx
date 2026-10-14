// Orders tab of the Trade window: set a price alert / auto-order for the coin
// (buy-the-dip or sell-high / stop-loss) and manage the ones already active.
// Uses the same soft orders the coin card's drag-on-chart drawer creates, so
// everything shows up in Trades → Orders and executes via the device / cloud
// auto-executor for the trading wallet. "Drag on chart" hands off to the
// card's drawer for fine control.
import React, { useEffect, useMemo, useState } from 'react';
import { createSoftOrder, fetchSoftOrders, cancelSoftOrder, bustActiveSoftOrdersCache } from '../utils/softOrders';
import { useActiveAccount } from '../hooks/useWalletView';
import { getPresets } from '../utils/instantTradeWallet';
import { getFullApiUrl } from '../config/api';
import CautionTapeBanner from './CautionTapeBanner';
import './CoinOrdersPanel.css';

const SELL_UP_CHIPS = [25, 50, 100, 200];
const SELL_DOWN_CHIPS = [-10, -25, -50];
const BUY_CHIPS = [-10, -25, -50, -75];
const EXPIRY_CHIPS = [{ id: '1d', label: '1 day', ms: 864e5 }, { id: '7d', label: '7 days', ms: 7 * 864e5 }, { id: '30d', label: '30 days', ms: 30 * 864e5 }, { id: 'none', label: 'No expiry', ms: null }];

const fmtPrice = (p) => {
  const v = Number(p);
  if (!(v > 0)) return '—';
  if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  if (v >= 0.0001) return `$${v.toFixed(6)}`;
  return `$${v.toPrecision(3)}`;
};
const fmtTokens = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function CoinOrdersPanel({ coin, currentPriceUsd, onClose }) {
  const mint = coin?.mintAddress || coin?.address;
  const { address, connected, isInstant } = useActiveAccount();
  const price = Number(currentPriceUsd) || Number(coin?.price_usd) || Number(coin?.priceUsd) || 0;

  const [side, setSide] = useState('sell');
  const [pct, setPct] = useState(50);
  const [customPct, setCustomPct] = useState('');
  const [amountSol, setAmountSol] = useState(() => String(getPresets().buySol || 0.05));
  const [sellShare, setSellShare] = useState(100);
  const [expiry, setExpiry] = useState('7d');
  const [holding, setHolding] = useState(null); // { amount, amountRaw } | null
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  const effectivePct = customPct.trim() !== '' && Number.isFinite(Number(customPct)) ? Number(customPct) : pct;
  const triggerPrice = price > 0 ? price * (1 + effectivePct / 100) : 0;

  const refreshOrders = async () => {
    if (!address || !mint) { setOrders([]); return; }
    try {
      const list = await fetchSoftOrders(address, 'active');
      setOrders(list.filter((o) => o.tokenMint === mint));
    } catch { /* keep last */ }
  };

  useEffect(() => { refreshOrders(); }, [address, mint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    setHolding(null);
    if (!address || !mint) return undefined;
    fetch(getFullApiUrl(`/api/wallet/${address}/balance?mint=${mint}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.success) setHolding({ amount: Number(d.amount) || 0 }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [address, mint]);

  const chips = side === 'buy' ? BUY_CHIPS : [...SELL_UP_CHIPS, ...SELL_DOWN_CHIPS];
  useEffect(() => { setPct(side === 'buy' ? -25 : 50); setCustomPct(''); }, [side]);

  const holdingTokens = holding?.amount || 0;
  const sellTokens = holdingTokens * (sellShare / 100);
  const canSubmit = connected && mint && price > 0 && triggerPrice > 0 && !busy
    && (side === 'buy' ? Number(amountSol) > 0 : sellTokens > 0)
    && (side === 'buy' ? effectivePct < 0 : effectivePct !== 0);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setResult(null);
    try {
      const exp = EXPIRY_CHIPS.find((e) => e.id === expiry)?.ms;
      await createSoftOrder({
        walletAddress: address,
        mint,
        tokenSymbol: coin?.symbol || null,
        tokenName: coin?.name || null,
        tokenImage: coin?.image || coin?.logo || null,
        side,
        triggerPriceUsd: triggerPrice,
        currentPriceUsd: price,
        amountSol: side === 'buy' ? Number(amountSol) : null,
        amountTokens: side === 'sell' ? sellTokens : null,
        expiresAt: exp ? Date.now() + exp : null,
      });
      bustActiveSoftOrdersCache();
      const kind = side === 'buy' ? 'Buy' : effectivePct > 0 ? 'Take-profit' : 'Stop-loss';
      setResult({ ok: true, text: `${kind} set at ${fmtPrice(triggerPrice)} (${effectivePct > 0 ? '+' : ''}${effectivePct}%)${isInstant ? ' — executes automatically for your trading wallet' : ' — you\u2019ll get an alert to approve the trade'}` });
      refreshOrders();
    } catch (err) {
      setResult({ ok: false, text: err?.message || 'Could not set the order' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (orderId) => {
    try {
      await cancelSoftOrder(orderId, address);
      bustActiveSoftOrdersCache();
      setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
    } catch (err) {
      setResult({ ok: false, text: err?.message || 'Could not cancel' });
    }
  };

  const openChartDrawer = () => {
    window.dispatchEvent(new CustomEvent('moonfeed:open-order-drawer', { detail: { mint } }));
    onClose?.();
  };

  const kindOf = (o) => (o.type === 'buy' ? 'Buy at' : o.triggerCondition === 'below' ? 'Stop-loss' : 'Take-profit');
  const pctOf = (o) => (price > 0 && Number(o.triggerPriceUsd) > 0 ? ((o.triggerPriceUsd - price) / price) * 100 : null);

  const sideLabel = useMemo(() => (side === 'buy' ? 'Buy when price drops' : effectivePct >= 0 ? 'Sell when price rises' : 'Sell if price drops (stop-loss)'), [side, effectivePct]);

  if (!connected) {
    return <div className="cop-empty">Connect a wallet or set up a trading wallet to place orders.</div>;
  }

  return (
    <div className="cop">
      {!isInstant && <CautionTapeBanner compact />}

      <div className="cop-side" role="radiogroup" aria-label="Order side">
        <button type="button" className={`cop-side-btn${side === 'sell' ? ' active sell' : ''}`} onClick={() => setSide('sell')} role="radio" aria-checked={side === 'sell'}>Sell at</button>
        <button type="button" className={`cop-side-btn${side === 'buy' ? ' active buy' : ''}`} onClick={() => setSide('buy')} role="radio" aria-checked={side === 'buy'}>Buy at</button>
      </div>

      <div className="cop-row">
        <span className="cop-label">{sideLabel}</span>
        <span className="cop-market">Market {fmtPrice(price)}</span>
      </div>

      <div className="cop-chips">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={`cop-chip${customPct === '' && pct === c ? ' active' : ''}${c < 0 ? ' down' : ' up'}`}
            onClick={() => { setPct(c); setCustomPct(''); }}
          >
            {c > 0 ? '+' : ''}{c}%
          </button>
        ))}
        <input
          className={`cop-chip cop-chip-input${customPct !== '' ? ' active' : ''}`}
          inputMode="decimal"
          placeholder="Custom %"
          value={customPct}
          onChange={(e) => setCustomPct(e.target.value.replace(/[^0-9.-]/g, ''))}
        />
      </div>

      <div className="cop-target">
        <span>Trigger</span>
        <strong className={effectivePct >= 0 ? 'up' : 'down'}>{fmtPrice(triggerPrice)}</strong>
        <small>{effectivePct > 0 ? '+' : ''}{Number(effectivePct).toFixed(1)}% from market</small>
      </div>

      {side === 'buy' ? (
        <div className="cop-row cop-amount">
          <span className="cop-label">Spend</span>
          <span className="cop-amount-input">
            <input inputMode="decimal" value={amountSol} onChange={(e) => setAmountSol(e.target.value)} />
            <em>SOL</em>
          </span>
        </div>
      ) : (
        <div className="cop-row cop-amount">
          <span className="cop-label">
            Sell
            <small>{holding === null ? 'checking balance…' : holdingTokens > 0 ? `${fmtTokens(holdingTokens)} ${coin?.symbol || ''} held` : `no ${coin?.symbol || 'tokens'} in this wallet`}</small>
          </span>
          <span className="cop-share">
            {[25, 50, 75, 100].map((s) => (
              <button key={s} type="button" className={`cop-chip${sellShare === s ? ' active' : ''}`} onClick={() => setSellShare(s)}>{s}%</button>
            ))}
          </span>
        </div>
      )}

      <div className="cop-row">
        <span className="cop-label">Expires</span>
        <span className="cop-share">
          {EXPIRY_CHIPS.map((e) => (
            <button key={e.id} type="button" className={`cop-chip${expiry === e.id ? ' active' : ''}`} onClick={() => setExpiry(e.id)}>{e.label}</button>
          ))}
        </span>
      </div>

      <button type="button" className={`cop-submit ${side}`} disabled={!canSubmit} onClick={submit}>
        {busy ? 'Setting…' : side === 'buy'
          ? `Set buy order · ${Number(amountSol) || 0} SOL at ${fmtPrice(triggerPrice)}`
          : `Set ${effectivePct >= 0 ? 'take-profit' : 'stop-loss'} · ${sellShare}% at ${fmtPrice(triggerPrice)}`}
      </button>
      <p className="cop-hint">
        {isInstant
          ? 'Trading wallet: the order executes automatically when the price crosses (while the app is open, or 24/7 with Cloud execution).'
          : 'Connected wallet: you\u2019ll get a push alert when the price crosses and approve the swap in your wallet.'}
      </p>

      {result && <div className={`cop-result ${result.ok ? 'ok' : 'err'}`}>{result.text}</div>}

      <button type="button" className="cop-link" onClick={openChartDrawer}>Drag targets on the chart instead →</button>

      <div className="cop-active">
        <div className="cop-active-title">Active orders on {coin?.symbol || 'this coin'} <span>{orders.length}</span></div>
        {orders.length === 0 ? (
          <div className="cop-empty cop-empty--inline">None yet</div>
        ) : orders.map((o) => {
          const p = pctOf(o);
          return (
            <div key={o.orderId} className={`cop-order ${o.type === 'buy' ? 'buy' : o.triggerCondition === 'below' ? 'stop' : 'tp'}`}>
              <span className="cop-order-main">
                <strong>{kindOf(o)}</strong>
                <span>{fmtPrice(o.triggerPriceUsd)}{p !== null ? ` · ${p >= 0 ? '+' : ''}${p.toFixed(1)}%` : ''}</span>
              </span>
              <span className="cop-order-amt">
                {o.type === 'buy' ? `${Number(o.amountSol).toFixed(3)} SOL` : `${fmtTokens(o.amountTokens)} ${coin?.symbol || ''}`}
              </span>
              <button type="button" className="cop-cancel" onClick={() => cancel(o.orderId)} aria-label="Cancel order">×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
