import React, { useEffect, useMemo, useRef, useState } from 'react';
import NativeChart from './NativeChart';
import { getTransactions } from '../utils/transactionStorage';
import { getSolUsdPrice } from '../utils/orderFillTracking';
import CautionTapeBanner from './CautionTapeBanner';
import './OrderDetailView.css';

const formatUsd = (n) => {
  if (n === null || n === undefined || !isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${v.toPrecision(4)}`;
};

/**
 * Full-screen view opened from the Active Orders tab: shows the coin's chart
 * with an arrow marking where the wallet bought in and a line marking the
 * order's sell/buy target, with the primary action being to cancel the
 * pending limit order and return the escrowed funds to the wallet.
 */
function OrderDetailView({ order, walletAddress, solUsdPrice = 150, cancelling, onCancel, onBack, onCoinClick, jupiterLink }) {
  const [entryPriceUsd, setEntryPriceUsd] = useState(null);
  const [entryTime, setEntryTime] = useState(null);
  const [refocusSignal, setRefocusSignal] = useState(0);

  // Hide the feed's floating buttons (comment, transactions, swipe hint, etc.)
  // while this full-screen chart is open.
  useEffect(() => {
    document.body.classList.add('odv-open');
    return () => document.body.classList.remove('odv-open');
  }, []);

  useEffect(() => {
    if (!walletAddress || !order?.tokenMint) { setEntryPriceUsd(null); setEntryTime(null); return; }
    let cancelled = false;

    (async () => {
      const buys = getTransactions(walletAddress).filter(
        (tx) => tx.tokenMint === order.tokenMint && tx.type === 'buy' && Number(tx.outputAmount) > 0
      );
      if (!buys.length) { if (!cancelled) { setEntryPriceUsd(null); setEntryTime(null); } return; }
      const needsSolUsd = buys.some((tx) => !(Number(tx.pricePerTokenUsd) > 0));
      const solUsd = needsSolUsd ? await getSolUsdPrice() : 0;
      let tokens = 0;
      let cost = 0;
      for (const tx of buys) {
        const usd = Number(tx.pricePerTokenUsd) > 0
          ? Number(tx.pricePerTokenUsd)
          : Number(tx.pricePerToken) * solUsd;
        if (!(usd > 0)) continue;
        tokens += Number(tx.outputAmount);
        cost += Number(tx.outputAmount) * usd;
      }
      if (cancelled) return;
      setEntryPriceUsd(tokens > 0 ? cost / tokens : null);
      const lastBuy = buys[buys.length - 1];
      setEntryTime(lastBuy?.timestamp ? Math.floor(lastBuy.timestamp / 1000) : null);
    })();

    return () => { cancelled = true; };
  }, [walletAddress, order?.tokenMint]);

  const triggerPriceUsd = Number(order?.triggerPrice) > 0 ? Number(order.triggerPrice) * solUsdPrice : null;
  const currentPriceUsd = Number(order?.currentPrice) > 0 ? Number(order.currentPrice) * solUsdPrice : null;
  const isSell = (order?.orderType || 'buy') === 'sell';

  // ── Drag-down to dismiss ────────────────────────────────────────────────
  // The sheet follows the finger while dragging down, then either slides all
  // the way out (back) or springs back into place, mirroring the buy/sell
  // drawer's finger-tracking open gesture and WalletProfileView's swipe-back.
  const rootRef = useRef(null);
  const backdropRef = useRef(null);
  const closingRef = useRef(false);
  const dragRef = useRef(null);

  const closeWithSlide = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const el = rootRef.current;
    if (!el) { onBack?.(); return; }
    el.classList.remove('odv-dragging', 'odv-settling');
    el.classList.add('odv-closing');
    el.style.transform = 'translateY(100%)';
    if (backdropRef.current) backdropRef.current.style.background = 'rgba(3, 7, 16, 0)';
    setTimeout(() => onBack?.(), 220);
  };

  const handleSwipeStart = (e) => {
    if (closingRef.current || e.target.closest?.('.native-chart') || e.touches.length > 1) {
      dragRef.current = null;
      return;
    }
    const t = e.touches[0];
    dragRef.current = { x: t.clientX, y: t.clientY, dragging: false, lastY: t.clientY, lastT: e.timeStamp, vy: 0 };
  };

  const handleSwipeMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.dragging) {
      // Axis lock: give up on a dominant horizontal drag, engage on downward motion.
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { dragRef.current = null; return; }
      if (dy > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        d.dragging = true;
        rootRef.current?.classList.add('odv-dragging');
      } else {
        return;
      }
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.vy = (t.clientY - d.lastY) / dt;
    d.lastY = t.clientY;
    d.lastT = e.timeStamp;
    const el = rootRef.current;
    const clamped = Math.max(0, dy);
    if (el) el.style.transform = `translateY(${clamped}px)`;
    if (backdropRef.current) {
      const height = el?.clientHeight || window.innerHeight;
      const fade = Math.max(0, 1 - clamped / (height * 0.7));
      backdropRef.current.style.background = `rgba(3, 7, 16, ${0.48 * fade})`;
    }
  };

  const handleSwipeEnd = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.dragging) return;
    const el = rootRef.current;
    if (!el) return;
    const t = e.changedTouches[0];
    const dy = Math.max(0, t.clientY - d.y);
    const height = el.clientHeight || window.innerHeight;
    const flick = d.vy > 0.5 && dy > 40; // fast downward flick commits early
    el.classList.remove('odv-dragging');
    if (dy > Math.min(140, height * 0.3) || flick) {
      closeWithSlide();
    } else {
      el.classList.add('odv-settling');
      el.style.transform = 'translateY(0px)';
      if (backdropRef.current) backdropRef.current.style.background = 'rgba(3, 7, 16, 0.48)';
      setTimeout(() => {
        el.classList.remove('odv-settling');
        el.style.transform = '';
      }, 240);
    }
  };

  const markers = useMemo(() => {
    if (!entryTime || !(entryPriceUsd > 0)) return null;
    return [{
      time: entryTime,
      position: 'aboveBar',
      color: '#4f8cff',
      shape: 'arrowDown',
      text: `Bought ${formatUsd(entryPriceUsd)}`,
    }];
  }, [entryTime, entryPriceUsd]);

  const chartCoin = useMemo(() => ({
    mintAddress: order?.tokenMint,
    pairAddress: order?.resolvedPairAddress || order?.rawOrder?.tokenPairAddress || null,
  }), [order?.tokenMint, order?.resolvedPairAddress, order?.rawOrder]);

  const cashoutSol = isSell ? (Number(order?.amount) || 0) * (Number(order?.currentPrice) || 0) : (Number(order?.rawOrder?.estimatedValue) || 0);
  const cashoutUsd = cashoutSol * solUsdPrice;

  if (!order) return null;

  return (
    <div className="odv-backdrop" ref={backdropRef} onClick={closeWithSlide}>
      <div
        className="odv-root"
        ref={rootRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onTouchCancel={handleSwipeEnd}
      >
        <button className="odv-back" onClick={closeWithSlide} title="Back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <CautionTapeBanner message="IN PROGRESS — LIMIT ORDERS UNDER MAINTENANCE" compact />

        <div className="odv-header">
          <button
            type="button"
            className="odv-header-coin-btn"
            onClick={() => onCoinClick?.({
              mintAddress: order.tokenMint,
              address: order.tokenMint,
              symbol: order.tokenSymbol,
              name: order.tokenName,
              image: order.tokenImage,
              banner: order.bannerSrc,
              pairAddress: order.resolvedPairAddress,
            })}
            title="View coin"
          >
            {order.tokenImage ? (
              <img className="odv-token-img" src={order.tokenImage} alt={order.tokenSymbol} />
            ) : (
              <div className="odv-token-img odv-token-img--ph">{order.tokenSymbol?.[0] || '?'}</div>
            )}
            <div className="odv-token-info">
              <div className="odv-token-symbol">{order.tokenSymbol}</div>
              <div className="odv-token-name">{order.tokenName}</div>
            </div>
          </button>
          <span className={`odv-type-badge odv-type-${isSell ? 'sell' : 'buy'}`}>
            {isSell ? '↑ SELL' : '↓ BUY'}
          </span>
        </div>

        <div className="odv-chart-wrap">
          <NativeChart
            coin={chartCoin}
            isActive={true}
            isExpanded={true}
            livePrice={currentPriceUsd}
            entryPrice={entryPriceUsd}
            markers={markers}
            targetPrice={triggerPriceUsd}
            targetLabel={`${isSell ? 'Sell' : 'Buy'} target ${formatUsd(triggerPriceUsd)}`}
            targetColor={isSell ? '#ef5350' : '#26a69a'}
            focusTimelineFrom={entryTime ? entryTime * 1000 : null}
            refocusSignal={refocusSignal}
          />
          {entryTime && (
            <button
              className="odv-recenter-btn"
              onClick={() => setRefocusSignal((n) => n + 1)}
              title="Show buy-in & target on chart"
              aria-label="Show buy-in & target on chart"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.6" y2="16.6" />
              </svg>
              View entry &amp; target
            </button>
          )}
        </div>

        <div className="odv-prices">
          <div className="odv-price-item">
            <span className="odv-price-label">Now</span>
            <span className="odv-price-val">{formatUsd(currentPriceUsd)}</span>
          </div>
          <span className="odv-price-arrow">›</span>
          <div className="odv-price-item">
            <span className="odv-price-label">Target</span>
            <span className="odv-price-val odv-price-target">{formatUsd(triggerPriceUsd)}</span>
          </div>
        </div>

        <button
          className="odv-primary-btn"
          disabled={cancelling}
          onClick={() => onCancel?.(order.orderId)}
        >
          {cancelling ? 'Cashing out…' : (
            <>
              {isSell ? 'Sell & Cancel Order' : 'Cancel Order'}
              {cashoutUsd > 0 && <span className="odv-primary-btn-amount">{formatUsd(cashoutUsd)}</span>}
            </>
          )}
        </button>
        <div className="odv-primary-hint">Cancels the pending limit order and returns your funds to your wallet.</div>

        {jupiterLink && (
          <a className="odv-secondary-btn" href={jupiterLink} target="_blank" rel="noopener noreferrer">
            View on Jupiter
          </a>
        )}
      </div>
    </div>
  );
}

export default OrderDetailView;
