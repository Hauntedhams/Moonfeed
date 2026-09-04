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

const formatUsdPrice = (p) => {
  const n = Number(p);
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 0) return 'just now';
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
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
 * The FOMO-style position card: wallet header, invested/PnL topline, token
 * header, candlestick chart with entry/exit ⊕ pins, a stats grid, and
 * Trade/Share actions — for a single wallet+token position.
 *
 * Renders in two modes:
 *  - default: fills the PositionDetailView bottom sheet (chart flex-grows).
 *  - `embedded`: an inline feed card (fixed-height chart, no follow button,
 *    chart stays in scroll-passthrough mode so the feed scrolls natively).
 */
function PositionCard({ walletAddress, mint, profileHint = {}, embedded = false, onOpenProfile, onMimicTrade, onCoinClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartPrice, setChartPrice] = useState(null);
  const [tokenBanner, setTokenBanner] = useState(profileHint?.tokenBanner || profileHint?.banner || null);
  const [chartFocusTime, setChartFocusTime] = useState(null);
  const [chartFocusNonce, setChartFocusNonce] = useState(0);
  // Which ⊕ pin the chart is currently zoomed into — tapping it again zooms back
  // out to the default framing that shows both the buy and the sell.
  const [zoomedPin, setZoomedPin] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const zoomToTradeTime = (timeMs) => {
    if (!timeMs) return;
    setChartFocusTime(timeMs);
    setChartFocusNonce((n) => n + 1); // re-zoom even when tapping the same point again
  };
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

  useEffect(() => {
    if (!walletAddress || !mint) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setChartPrice(null);
    setChartFocusTime(null);
    setZoomedPin(null);
    fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${walletAddress}/position/${mint}`))
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress, mint]);

  useEffect(() => {
    if (!mint) return undefined;
    let cancelled = false;
    fetchJsonWithTimeout(getFullApiUrl('/api/coins/enrich-single'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintAddress: mint }),
    }).then((result) => {
      const banner = result?.coin?.banner || result?.banner || result?.data?.banner;
      if (!cancelled && banner) setTokenBanner(banner);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mint]);

  const markers = useMemo(() => {
    const list = [];
    // Entry/exit are marked by the clickable ⊕ pins (tradePins) instead of
    // text markers; only the fallback swap marker from a notification remains.
    if (!data?.timing?.firstBuy && !data?.timing?.lastSell && profileHint?.timestamp) {
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

  const tradePins = useMemo(() => {
    const pins = [];
    if (data?.timing?.firstBuy) {
      pins.push({ id: 'entry', timeMs: data.timing.firstBuy, price: data.avgEntryPrice, kind: 'entry', label: 'Entry' });
    }
    if (data?.timing?.lastSell) {
      pins.push({ id: 'exit', timeMs: data.timing.lastSell, price: data.avgExitPrice, kind: 'exit', label: 'Exit' });
    }
    return pins;
  }, [data]);

  const handleTradePinClick = useCallback((id) => {
    if (zoomedPin === id) {
      setZoomedPin(null);
      setChartFocusTime(null);
      setChartFocusNonce((n) => n + 1); // re-frame back out around both trades
      return;
    }
    const timeMs = id === 'entry' ? data?.timing?.firstBuy : data?.timing?.lastSell;
    if (!timeMs) return;
    setZoomedPin(id);
    zoomToTradeTime(timeMs);
  }, [zoomedPin, data]);

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
  // Position still open (never sold) — the PnL shown is unrealized/theoretical.
  const isOpenPosition = !!position && !(Number(position?.counts?.sells) > 0 || position?.timing?.lastSell);
  const chartCoin = mint ? { mintAddress: mint } : null;
  const displayName = profileHint?.displayName || profileHint?.name || buildWalletName(walletAddress);

  // When the wallet first bought in (drives the "Bought in Xm ago" sub-line).
  // The fast hint carries the feed trade's own time until position data lands.
  const boughtInMs = position?.timing?.firstBuy
    || (profileHint?.timestamp ? (profileHint.timestamp < 1e12 ? profileHint.timestamp * 1000 : profileHint.timestamp) : null);
  const boughtInText = boughtInMs ? timeAgo(boughtInMs) : null;

  const handleShare = async () => {
    const text = `${displayName} ${isProfit ? 'made' : 'lost'} ${formatCurrency(Math.abs(pnlTotal))} (${formatPercent(roi)}) on $${tokenSymbol} — entry ${formatMcap(position?.avgEntryMarketCap)} MC → exit ${formatMcap(position?.avgExitMarketCap)} MC. Spotted on Moonfeed 🌙 https://moonfeed.app`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1600);
      }
    } catch (_) {
      // user dismissed the share sheet
    }
  };

  return (
    <div className={embedded ? 'pdv-card pdv-card--embedded' : 'pdv-card'}>
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
            <span className="pdv-wallet-sub">
              {shortWalletAddress(walletAddress)}
              {boughtInText && ` · Bought in ${boughtInText} ago`}
            </span>
          </span>
          <span className="pdv-wallet-chevron">›</span>
        </button>
        {!embedded && (
          <button className="pdv-follow-btn" type="button" onClick={handleFollow} disabled={tracked}>{tracked ? 'Following' : 'Follow'}</button>
        )}
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

      <div className="pdv-position-banner" style={tokenBanner ? { '--pdv-banner-image': `url("${tokenBanner}")` } : undefined}>
        <div className="pdv-invested">
          <span className="pdv-topline-label">Invested</span>
          <span className="pdv-topline-value">{position ? formatCurrency(position.invested) : '—'}</span>
        </div>
        <div className="pdv-pnl-block">
          <div className={`pdv-pnl-amount ${position ? (isProfit ? 'pos' : 'neg') : 'loading'}`}>
            {position ? `${isProfit ? '+' : ''}${formatCurrency(pnlTotal)}${isOpenPosition ? '*' : ''}` : 'Loading PnL'}
          </div>
        </div>
        <div className="pdv-pnl-pct-block">
          <div className={`pdv-pnl-pct ${position ? (isProfit ? 'pos' : 'neg') : 'loading'}`}>
            {position ? formatPercent(roi) : 'Fetching wallet position'}
          </div>
          {isOpenPosition && <div className="pdv-pnl-note">*Theoretical — position not sold yet</div>}
        </div>
      </div>

      <div className="pdv-chart-wrap">
        <NativeChart
          coin={chartCoin}
          isActive={true}
          isExpanded={!embedded}
          markers={markers}
          tradePins={tradePins}
          onTradePinClick={handleTradePinClick}
          activeTradePinId={zoomedPin}
          initialTfIndex={tfIndexForHold(position?.timing?.holdTimeSecs)}
          focusTimelineFrom={position?.timing?.firstBuy || (profileHint?.timestamp ? (profileHint.timestamp < 1e12 ? profileHint.timestamp * 1000 : profileHint.timestamp) : null)}
          focusTimelineTo={position?.timing?.lastSell || null}
          focusTimelineAt={chartFocusTime}
          refocusSignal={chartFocusNonce}
          onCrosshairMove={handleChartCrosshairMove}
        />
      </div>

      <div className="pdv-bottom-card">
        <div className="pdv-bottom-grid">
          <div className="pdv-bottom-stat">
            <span className="pdv-bottom-stat-value">{position ? (isOpenPosition ? 'Holding' : formatCurrency(position.proceeds)) : '—'}</span>
            <span className="pdv-bottom-stat-label">{isOpenPosition ? 'Status' : 'Sold for'}</span>
          </div>
          <div className="pdv-bottom-stat">
            <span className="pdv-bottom-stat-value entry">{position ? `${formatMcap(position.avgEntryMarketCap)} MC` : '—'}</span>
            <span className="pdv-bottom-stat-label">Entry</span>
          </div>
          <div className="pdv-bottom-stat">
            <span className="pdv-bottom-stat-value exit">{position ? `${formatMcap(position.avgExitMarketCap)} MC` : '—'}</span>
            <span className="pdv-bottom-stat-label">Exit</span>
          </div>
          <div className="pdv-bottom-stat">
            <span className="pdv-bottom-stat-value">{formatUsdPrice(position?.avgEntryPrice)}</span>
            <span className="pdv-bottom-stat-label">Avg. entry</span>
          </div>
          <div className="pdv-bottom-stat">
            <span className="pdv-bottom-stat-value">{formatUsdPrice(position?.avgExitPrice)}</span>
            <span className="pdv-bottom-stat-label">Avg. exit</span>
          </div>
          <div className="pdv-bottom-stat">
            <span className="pdv-bottom-stat-value">{position?.counts?.total ?? '—'}</span>
            <span className="pdv-bottom-stat-label">Transactions</span>
          </div>
        </div>
      </div>

      <div className="pdv-actions">
        {onMimicTrade && (
          <button
            className="pdv-mimic-btn"
            onClick={() => onMimicTrade({ mintAddress: mint, address: mint, symbol: tokenSymbol, name: tokenName, image: tokenImage })}
          >
            Trade {tokenSymbol}
          </button>
        )}
        <button className="pdv-share-btn" type="button" onClick={handleShare}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {shareCopied ? 'Copied!' : 'Share'}
        </button>
      </div>
    </div>
  );
}

export default PositionCard;
