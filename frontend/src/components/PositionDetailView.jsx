import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFullApiUrl, fetchJsonWithTimeout } from '../config/api';
import NativeChart from './NativeChart';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { AnimalSilhouetteAvatar, buildWalletName, gradientForWallet, shortWalletAddress } from '../utils/walletIdentity';
import './PositionDetailView.css';

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—';
  const n = Number(amount);
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};

const formatMcap = (n) => {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const formatPercent = (p) => {
  if (p === null || p === undefined || !isFinite(Number(p))) return '—';
  const n = Number(p);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

// Pick a chart timeframe wide enough that both the entry and exit candle are visible.
const tfIndexForHold = (secs) => {
  if (!secs) return 2; // 15m default
  if (secs < 3600 * 2) return 1; // 5m
  if (secs < 3600 * 12) return 2; // 15m
  if (secs < 3600 * 24 * 3) return 3; // 1h
  if (secs < 3600 * 24 * 14) return 4; // 4h
  return 5; // 1d
};

/**
 * Full-screen FOMO-style position detail: candlestick chart with entry/exit
 * markers plus PnL, avg entry/exit market cap, invested $ and tx count — for
 * a single wallet+token position.
 */
function PositionDetailView({ walletAddress, mint, profileHint = {}, onBack, onOpenProfile, onMimicTrade, onCoinClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartPrice, setChartPrice] = useState(null);
  const { trackWallet, isTracked } = useTrackedWallets();
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    setTracked(isTracked(walletAddress));
  }, [walletAddress, isTracked]);

  const handleFollow = () => {
    if (!tracked && trackWallet(walletAddress)) setTracked(true);
  };
  // Coalesce the chart's crosshair callback (fires dozens of times/sec during a
  // fast swipe) into at most one state update per animation frame.
  const pendingChartPointRef = useRef(null);
  const chartPriceRafRef = useRef(false);
  const handleChartCrosshairMove = useCallback((point) => {
    pendingChartPointRef.current = point;
    if (chartPriceRafRef.current) return;
    chartPriceRafRef.current = true;
    requestAnimationFrame(() => {
      chartPriceRafRef.current = false;
      setChartPrice(pendingChartPointRef.current?.price ?? null);
    });
  }, []);

  // Hide the feed's fixed-position buy-drawer swipe hint while this full-screen
  // overlay is open — it would otherwise bleed through on top of it.
  useEffect(() => {
    document.body.classList.add('pdv-open');
    return () => document.body.classList.remove('pdv-open');
  }, []);

  useEffect(() => {
    if (!walletAddress || !mint) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setChartPrice(null);
    fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${walletAddress}/position/${mint}`))
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress, mint]);

  const markers = useMemo(() => {
    const list = [];
    if (data?.timing?.firstBuy && data.avgEntryPrice) {
      list.push({
        time: Math.floor(data.timing.firstBuy / 1000),
        position: 'belowBar',
        color: '#26a69a',
        shape: 'arrowUp',
        text: `Entry ${formatMcap(data.avgEntryMarketCap)}`,
      });
    }
    if (data?.timing?.lastSell && data.avgExitPrice) {
      list.push({
        time: Math.floor(data.timing.lastSell / 1000),
        position: 'aboveBar',
        color: '#ef5350',
        shape: 'arrowDown',
        text: `Exit ${formatMcap(data.avgExitMarketCap)}`,
      });
    }
    // Fallback: if no timing from API, plot the swap marker from notification/profileHint
    if (list.length === 0 && profileHint?.timestamp) {
      const timeSec = Math.floor(profileHint.timestamp < 1e12 ? profileHint.timestamp : profileHint.timestamp / 1000);
      const isSell = profileHint.type === 'sell';
      const solText = profileHint.solAmount ? ` (${Number(profileHint.solAmount).toFixed(3)} SOL)` : '';
      list.push({
        time: timeSec,
        position: isSell ? 'aboveBar' : 'belowBar',
        color: isSell ? '#ef5350' : '#26a69a',
        shape: isSell ? 'arrowDown' : 'arrowUp',
        text: `${isSell ? 'Sold' : 'Bought'}${solText}`,
      });
    }
    return list.sort((a, b) => a.time - b.time);
  }, [data, profileHint]);

  const fastTraderPosition = useMemo(() => {
    const trader = profileHint?.traderData;
    if (trader) {
      return {
        success: true,
        symbol: profileHint?.tokenSymbol || 'Token',
        name: profileHint?.tokenName || profileHint?.tokenSymbol || 'Token',
        image: profileHint?.tokenImage || null,
        currentMarketCap: profileHint?.currentMarketCap ?? null,
        pnl: { total: trader.total ?? trader.realized ?? 0 },
        invested: trader.total_invested ?? trader.invested ?? 0,
        proceeds: trader.realized ?? trader.proceeds ?? 0,
        roi: trader.roi ?? null,
        counts: trader.counts || { total: null },
        avgEntryMarketCap: null,
        avgExitMarketCap: null,
        timing: null,
        fast: true,
      };
    }
    if (profileHint?.solAmount || profileHint?.tokenSymbol) {
      return {
        success: true,
        symbol: profileHint?.tokenSymbol || 'Token',
        name: profileHint?.tokenName || profileHint?.tokenSymbol || 'Token',
        image: profileHint?.tokenImage || null,
        currentMarketCap: profileHint?.currentMarketCap ?? null,
        pnl: { total: 0 },
        invested: profileHint?.solAmount ?? null,
        proceeds: null,
        roi: null,
        counts: { total: 1 },
        avgEntryMarketCap: null,
        avgExitMarketCap: null,
        timing: profileHint.timestamp ? { firstBuy: (profileHint.timestamp < 1e12 ? profileHint.timestamp * 1000 : profileHint.timestamp) } : null,
        fast: true,
      };
    }
    return null;
  }, [profileHint]);

  const position = data?.success ? data : fastTraderPosition;
  const tokenSymbol = position?.symbol || profileHint?.tokenSymbol || 'Token';
  const tokenName = position?.name || profileHint?.tokenName || tokenSymbol;
  const tokenImage = position?.image || profileHint?.tokenImage || null;
  const reportedPnl = position?.pnl?.total ?? 0;
  const entryPrice = Number(position?.avgEntryPrice);
  const invested = Number(position?.invested);
  const hasHistoricalPrice = Number.isFinite(chartPrice) && chartPrice > 0 && Number.isFinite(entryPrice) && entryPrice > 0 && Number.isFinite(invested) && invested > 0;
  const historicalRoi = hasHistoricalPrice ? ((chartPrice - entryPrice) / entryPrice) * 100 : null;
  const pnlTotal = hasHistoricalPrice ? invested * (historicalRoi / 100) : reportedPnl;
  const roi = hasHistoricalPrice ? historicalRoi : position?.roi;
  const isProfit = pnlTotal >= 0;
  const chartCoin = mint ? { mintAddress: mint } : null;
  const displayName = profileHint?.displayName || profileHint?.name || buildWalletName(walletAddress);

  // Swipe right anywhere on the page (except the interactive chart, which owns
  // its own horizontal drag-to-pan) opens this wallet's full profile.
  const swipeStartRef = useRef(null);
  const handleSwipeTouchStart = (e) => {
    if (e.target.closest?.('.native-chart')) { swipeStartRef.current = null; return; }
    const t = e.touches?.[0];
    swipeStartRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const handleSwipeTouchEnd = (e) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches?.[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx > 70 && dx > Math.abs(dy) * 1.4) {
      onOpenProfile?.({ displayName, ...profileHint });
    }
  };

  // Dragging the pull handle down past a threshold dismisses the sheet, like a
  // native bottom sheet — the sheet follows the finger the whole way, then
  // either slides fully out (back) or springs back into place.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const pdvRootRef = useRef(null);
  const dragStartYRef = useRef(null);
  const dragLastRef = useRef(null);
  const handleHandleTouchStart = (e) => {
    const t = e.touches?.[0];
    dragStartYRef.current = t ? t.clientY : null;
    dragLastRef.current = t ? { y: t.clientY, t: e.timeStamp, vy: 0 } : null;
    setDragging(true);
  };
  const handleHandleTouchMove = (e) => {
    if (dragStartYRef.current == null) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dy = t.clientY - dragStartYRef.current;
    if (dragLastRef.current) {
      const dt = Math.max(1, e.timeStamp - dragLastRef.current.t);
      dragLastRef.current.vy = (t.clientY - dragLastRef.current.y) / dt;
      dragLastRef.current.y = t.clientY;
      dragLastRef.current.t = e.timeStamp;
    }
    if (dy > 0) setDragY(dy);
  };
  const handleHandleTouchEnd = () => {
    const vy = dragLastRef.current?.vy || 0;
    const flick = vy > 0.5 && dragY > 30;
    dragStartYRef.current = null;
    dragLastRef.current = null;
    setDragging(false);
    if (dragY > 90 || flick) {
      setClosing(true);
      const height = pdvRootRef.current?.clientHeight || window.innerHeight;
      setDragY(height);
      setTimeout(() => onBack?.(), 200);
    } else {
      setDragY(0);
    }
  };
  const closeWithSlide = () => {
    if (closing) return;
    setClosing(true);
    setDragging(false);
    const height = pdvRootRef.current?.clientHeight || window.innerHeight;
    setDragY(height);
    setTimeout(() => onBack?.(), 200);
  };

  return (
    <div className="pdv-backdrop" onClick={closeWithSlide}>
    <div
      className="pdv-root"
      ref={pdvRootRef}
      style={dragY ? { transform: `translateY(${dragY}px)`, transition: (dragging && !closing) ? 'none' : undefined } : undefined}
      onClick={(event) => event.stopPropagation()}
      onTouchStart={handleSwipeTouchStart}
      onTouchEnd={handleSwipeTouchEnd}
    >
      <div
        className="pdv-drag-handle"
        onTouchStart={handleHandleTouchStart}
        onTouchMove={handleHandleTouchMove}
        onTouchEnd={handleHandleTouchEnd}
      />
      <button className="pdv-back" onClick={closeWithSlide} title="Back" aria-label="Back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="pdv-wallet-header">
        <button
          className="pdv-wallet-profile"
          type="button"
          onClick={() => onOpenProfile?.({ displayName, ...profileHint })}
          title="Open wallet profile"
        >
          <span className="pdv-wallet-avatar" style={{ background: gradientForWallet(walletAddress) }}>
            <AnimalSilhouetteAvatar address={walletAddress} className="pdv-animal-avatar" />
          </span>
          <span className="pdv-wallet-copy">
            <span className="pdv-wallet-name">{displayName}</span>
            <span className="pdv-wallet-sub">{shortWalletAddress(walletAddress)}</span>
          </span>
          <span className="pdv-wallet-chevron">›</span>
        </button>
        <button className="pdv-follow-btn" type="button" onClick={handleFollow} disabled={tracked}>{tracked ? 'Following' : 'Follow'}</button>
      </div>

      {error && !position && (
        <div className="pdv-inline-error">Detailed wallet position is unavailable.</div>
      )}

      {error && position?.fast && (
        <div className="pdv-inline-note">Showing fast trader stats while detailed entry and exit data catches up.</div>
      )}

      <div className="pdv-header">
        <button
          className="pdv-token-btn"
          type="button"
          onClick={() => onCoinClick?.({ mintAddress: mint, address: mint, symbol: tokenSymbol, name: tokenName, image: tokenImage })}
          disabled={!onCoinClick || !mint}
          title={`Open ${tokenSymbol}`}
        >
          {tokenImage ? (
            <img className="pdv-token-img" src={tokenImage} alt={tokenSymbol} />
          ) : (
            <div className="pdv-token-img pdv-token-img--ph">{tokenSymbol?.[0] || '?'}</div>
          )}
          <div className="pdv-token-info">
            <div className="pdv-token-symbol">{tokenSymbol}</div>
            <div className="pdv-token-mcap">{formatMcap(position?.currentMarketCap)} <span className="pdv-token-mcap-label">Market cap</span></div>
          </div>
          {onCoinClick && mint && <span className="pdv-token-chevron">›</span>}
        </button>
      </div>

      <div className="pdv-pnl-block">
        <div className={`pdv-pnl-amount ${position ? (isProfit ? 'pos' : 'neg') : 'loading'}`}>
          {position ? formatCurrency(pnlTotal) : 'Loading PnL'}
        </div>
        <div className={`pdv-pnl-pct ${position ? (isProfit ? 'pos' : 'neg') : 'loading'}`}>
          {position ? formatPercent(roi) : 'Fetching wallet position'}
        </div>
      </div>

      <div className="pdv-chart-wrap">
        <NativeChart
          coin={chartCoin}
          isActive={true}
          isExpanded={true}
          markers={markers}
          initialTfIndex={tfIndexForHold(position?.timing?.holdTimeSecs)}
          focusTimelineFrom={position?.timing?.firstBuy || (profileHint?.timestamp ? (profileHint.timestamp < 1e12 ? profileHint.timestamp * 1000 : profileHint.timestamp) : null)}
          onCrosshairMove={handleChartCrosshairMove}
        />
      </div>

      <div className="pdv-entryexit">
        <div className="pdv-entryexit-item">
          <span className="pdv-entryexit-label">Avg entry</span>
          <span className="pdv-entryexit-value">{position ? `${formatMcap(position.avgEntryMarketCap)} MC` : '—'}</span>
        </div>
        <div className="pdv-entryexit-item">
          <span className="pdv-entryexit-label">Avg exit</span>
          <span className="pdv-entryexit-value">{position ? `${formatMcap(position.avgExitMarketCap)} MC` : '—'}</span>
        </div>
      </div>

      <div className="pdv-footer-stats">
        <div className="pdv-footer-stat">
          <span className="pdv-footer-stat-value">{position ? formatCurrency(position.invested) : '—'}</span>
          <span className="pdv-footer-stat-label">Invested</span>
        </div>
        <div className="pdv-footer-stat">
          <span className="pdv-footer-stat-value">{position?.counts?.total ?? '—'}</span>
          <span className="pdv-footer-stat-label">Transactions</span>
        </div>
      </div>

      {onMimicTrade && (
        <button
          className="pdv-mimic-btn"
          onClick={() => onMimicTrade({ mintAddress: mint, address: mint, symbol: tokenSymbol, name: tokenName, image: tokenImage })}
        >
          Trade {tokenSymbol}
        </button>
      )}
    </div>
    </div>
  );
}

export default PositionDetailView;
