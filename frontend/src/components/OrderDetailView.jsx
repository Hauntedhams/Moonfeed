import React, { useEffect, useMemo, useState } from 'react';
import NativeChart from './NativeChart';
import { getTransactions } from '../utils/transactionStorage';
import { getSolUsdPrice } from '../utils/orderFillTracking';
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
function OrderDetailView({ order, walletAddress, solUsdPrice = 150, cancelling, onCancel, onBack, jupiterLink }) {
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
    <div className="odv-backdrop" onClick={onBack}>
      <div className="odv-root" onClick={(e) => e.stopPropagation()}>
        <button className="odv-back" onClick={onBack} title="Back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="odv-header">
          {order.tokenImage ? (
            <img className="odv-token-img" src={order.tokenImage} alt={order.tokenSymbol} />
          ) : (
            <div className="odv-token-img odv-token-img--ph">{order.tokenSymbol?.[0] || '?'}</div>
          )}
          <div className="odv-token-info">
            <div className="odv-token-symbol">{order.tokenSymbol}</div>
            <div className="odv-token-name">{order.tokenName}</div>
          </div>
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
