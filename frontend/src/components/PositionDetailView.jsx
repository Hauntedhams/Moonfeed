import React, { useEffect, useMemo, useState } from 'react';
import { getFullApiUrl, fetchJsonWithTimeout } from '../config/api';
import NativeChart from './NativeChart';
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
function PositionDetailView({ walletAddress, mint, profileHint = {}, onBack, onOpenProfile, onMimicTrade }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartPrice, setChartPrice] = useState(null);

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
    if (!data?.timing) return [];
    const list = [];
    if (data.timing.firstBuy && data.avgEntryPrice) {
      list.push({
        time: Math.floor(data.timing.firstBuy / 1000),
        position: 'belowBar',
        color: '#26a69a',
        shape: 'arrowUp',
        text: `Entry ${formatMcap(data.avgEntryMarketCap)}`,
      });
    }
    if (data.timing.lastSell && data.avgExitPrice) {
      list.push({
        time: Math.floor(data.timing.lastSell / 1000),
        position: 'aboveBar',
        color: '#ef5350',
        shape: 'arrowDown',
        text: `Exit ${formatMcap(data.avgExitMarketCap)}`,
      });
    }
    return list.sort((a, b) => a.time - b.time);
  }, [data]);

  const fastTraderPosition = useMemo(() => {
    const trader = profileHint?.traderData;
    if (!trader) return null;
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

  return (
    <div className="pdv-backdrop" onClick={onBack}>
    <div className="pdv-root" onClick={(event) => event.stopPropagation()}>
      <button className="pdv-back" onClick={onBack} title="Back" aria-label="Back">
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
        <button className="pdv-follow-btn" type="button" onClick={() => onOpenProfile?.({ displayName, ...profileHint })}>Follow</button>
      </div>

      {error && !position && (
        <div className="pdv-inline-error">Detailed wallet position is unavailable.</div>
      )}

      {error && position?.fast && (
        <div className="pdv-inline-note">Showing fast trader stats while detailed entry and exit data catches up.</div>
      )}

      <div className="pdv-header">
        {tokenImage ? (
          <img className="pdv-token-img" src={tokenImage} alt={tokenSymbol} />
        ) : (
          <div className="pdv-token-img pdv-token-img--ph">{tokenSymbol?.[0] || '?'}</div>
        )}
        <div className="pdv-token-info">
          <div className="pdv-token-symbol">{tokenSymbol}</div>
          <div className="pdv-token-mcap">{formatMcap(position?.currentMarketCap)} <span className="pdv-token-mcap-label">Market cap</span></div>
        </div>
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
          focusTimelineFrom={position?.timing?.firstBuy}
          onCrosshairMove={(point) => setChartPrice(point?.price ?? null)}
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
