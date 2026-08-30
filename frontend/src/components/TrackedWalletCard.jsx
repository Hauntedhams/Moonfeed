import React, { useEffect, useMemo, useState } from 'react';
import { getFullApiUrl, fetchJsonWithTimeout } from '../config/api';
import NativeChart from './NativeChart';
import { AnimalSilhouetteAvatar } from '../utils/walletIdentity';
import './TrackedWalletCard.css';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const gradientFor = (addr = '') => {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 65%, 55%) 0%, hsl(${h2}, 65%, 45%) 100%)`;
};

const shortAddr = (a) => (a ? `${a.slice(0, 4)}...${a.slice(-4)}` : 'Unknown');

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

const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  const n = Number(num);
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
};

const formatPercent = (p) => {
  if (p === null || p === undefined) return '—';
  const n = Number(p);
  if (!isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
};

const formatHold = (secs) => {
  if (!secs) return '—';
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`;
  return `${Math.round(secs / 86400)}d`;
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// Normalize a Solana Tracker / Helius trade into a token-side summary
const parseTrade = (t) => {
  if (!t) return null;

  // Helius-shaped fallback from the backend
  if (t.mint) {
    if (t.mint === SOL_MINT) return null;
    return {
      tx: t.tx || t.signature,
      type: t.type || 'buy',
      mint: t.mint,
      symbol: t.symbol || 'Unknown',
      name: t.name || '',
      image: t.image || null,
      solAmount: t.solAmount ?? null,
      time: t.time || t.timestamp,
    };
  }

  const from = t.from || {};
  const to = t.to || {};
  const fromIsSol = from.address === SOL_MINT;
  const toIsSol = to.address === SOL_MINT;

  let side, type;
  if (fromIsSol && !toIsSol) { side = to; type = 'buy'; }
  else if (toIsSol && !fromIsSol) { side = from; type = 'sell'; }
  else { side = to.token ? to : from; type = 'buy'; }

  const token = side.token || {};
  if (!side.address || side.address === SOL_MINT) return null;

  return {
    tx: t.tx || `${side.address}-${t.time}`,
    type,
    mint: side.address,
    symbol: token.symbol || 'Unknown',
    name: token.name || '',
    image: token.image || null,
    solAmount: fromIsSol ? from.amount : (toIsSol ? to.amount : null),
    time: t.time,
  };
};

/**
 * One full-screen slide in the tracked-wallets feed: the wallet's most recently
 * traded coin chart (marked with when you started tracking) is the primary
 * content, mirroring CoinCard; analytics + most recent trade live behind an
 * expand button like CoinCard's expand-details chevron.
 */
function TrackedWalletCard({ wallet, shouldLoad = true, onOpenProfile, onOpenPosition, onMimicTrade, onUntrack }) {
  const address = wallet?.address;
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastTrade, setLastTrade] = useState(null);
  const [tradeLoading, setTradeLoading] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    if (!address || !shouldLoad) return;
    let cancelled = false;
    setStatsLoading(true);
    fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${address}`))
      .then((d) => { if (!cancelled && d.success) setStats(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [address, shouldLoad]);

  useEffect(() => {
    if (!address || !shouldLoad) return;
    let cancelled = false;
    setTradeLoading(true);
    fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${address}/trades`))
      .then((d) => {
        if (cancelled) return;
        const raw = d?.data?.trades || d?.trades || d?.data || [];
        const list = Array.isArray(raw) ? raw : [];
        const parsed = list.map(parseTrade).filter(Boolean);
        setLastTrade(parsed[0] || null);
      })
      .catch(() => { if (!cancelled) setLastTrade(null); })
      .finally(() => { if (!cancelled) setTradeLoading(false); });
    return () => { cancelled = true; };
  }, [address, shouldLoad]);

  const trading = stats?.trading || {};
  const pnl = stats?.pnl || {};

  // Chart the coin behind the wallet's most recent trade; NativeChart resolves
  // its own pool from the mint if we don't have a pairAddress handy here.
  const chartCoin = useMemo(
    () => (lastTrade?.mint ? { mintAddress: lastTrade.mint } : null),
    [lastTrade?.mint]
  );

  // Marks the point on the chart's timeline where the user started following this wallet.
  const trackedMarker = useMemo(() => {
    if (!wallet?.addedAt) return null;
    return [{
      time: Math.floor(wallet.addedAt / 1000),
      position: 'belowBar',
      color: '#fbbf24',
      shape: 'arrowUp',
      text: 'Tracked wallet here',
    }];
  }, [wallet?.addedAt]);

  return (
    <div className="twc-card">
      {/* Wallet Name on Top */}
      <div className="twc-top-overlay">
        <div
          className="twc-avatar twc-avatar--clickable"
          style={{ background: gradientFor(address) }}
          onClick={() => onOpenProfile?.(address)}
          title="View full wallet profile"
        >
          <AnimalSilhouetteAvatar address={address} />
        </div>
        <div className="twc-identity twc-identity--clickable" onClick={() => onOpenProfile?.(address)} title="View full wallet profile">
          <div className="twc-label">{wallet?.label || shortAddr(address)}</div>
          <a
            className="twc-addr"
            href={`https://solscan.io/account/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {shortAddr(address)} ↗
          </a>
        </div>
        <button
          className="twc-profile-top-btn"
          onClick={() => onOpenProfile?.(address)}
          title="View full wallet profile"
        >
          Profile ↗
        </button>
        <button className="twc-untrack" onClick={() => onUntrack?.(address)} title="Stop tracking">
          Untrack
        </button>
      </div>

      {/* Main Content: Chart */}
      <div className="twc-chart-wrap">
        {chartCoin ? (
          <NativeChart coin={chartCoin} isActive={shouldLoad} isExpanded={false} markers={trackedMarker} />
        ) : (
          <div className="twc-chart-placeholder">
            {tradeLoading ? (
              <><div className="twc-spinner" /><span>Loading chart…</span></>
            ) : (
              <span>No recent trades to chart</span>
            )}
          </div>
        )}
      </div>

      {/* Trade Summary: bought/sold for X and current value is X */}
      {lastTrade && (
        <div className="twc-trade-summary-bar">
          <div className="twc-summary-row">
            <span className="twc-summary-symbol">{lastTrade.symbol}</span>
            <span className={`twc-summary-action twc-summary-action--${lastTrade.type}`}>
              {lastTrade.type === 'sell' ? 'Sold' : 'Bought'}
              {lastTrade.solAmount ? ` for ${Number(lastTrade.solAmount).toFixed(3)} SOL` : ''}
            </span>
            <span className="twc-summary-time">{timeAgo(lastTrade.time)}</span>
          </div>
          {lastTrade.mint && (
            <div className="twc-summary-sub">
              Current value: {statsLoading ? '…' : formatCurrency(pnl.invested)}
            </div>
          )}
        </div>
      )}

      <div className="twc-bottom-bar">
        <div className="twc-bottom-pnl" onClick={() => onOpenProfile?.(address)} style={{ cursor: 'pointer' }}>
          <span className="twc-bottom-pnl-label">Realized PnL</span>
          <span className={`twc-bottom-pnl-value ${(pnl.realized ?? 0) >= 0 ? 'pos' : 'neg'}`}>
            {statsLoading ? '—' : formatCurrency(pnl.realized)}
          </span>
        </div>
        {lastTrade && (
          <button
            className="twc-mimic-btn"
            onClick={() => onMimicTrade?.({
              mintAddress: lastTrade.mint,
              address: lastTrade.mint,
              symbol: lastTrade.symbol,
              name: lastTrade.name || lastTrade.symbol,
              image: lastTrade.image,
            }, lastTrade)}
          >
            {lastTrade.type === 'sell' ? 'Mimic Sell' : 'Mimic Buy'}
          </button>
        )}
        <button
          className="twc-expand-btn"
          onClick={() => setDetailsExpanded((v) => !v)}
          title={detailsExpanded ? 'Collapse details' : 'Expand details'}
          aria-label={detailsExpanded ? 'Collapse details' : 'Expand details'}
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: detailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>

      {detailsExpanded && (
        <div className="twc-details-panel">
          <div className="twc-topstats">
            <div className="twc-topstat">
              <span className="twc-topstat-num">{statsLoading ? '—' : formatNumber(trading.totalTrades)}</span>
              <span className="twc-topstat-label">Trades</span>
            </div>
            <div className="twc-topstat">
              <span className="twc-topstat-num">{statsLoading ? '—' : formatNumber(trading.uniqueTokens)}</span>
              <span className="twc-topstat-label">Tokens</span>
            </div>
            <div className="twc-topstat">
              <span className="twc-topstat-num">{statsLoading ? '—' : formatPercent(stats?.winRate)}</span>
              <span className="twc-topstat-label">Win Rate</span>
            </div>
          </div>

          <div className="twc-metrics">
            <div className="twc-metric">
              <span className="twc-metric-label">Realized PnL</span>
              <span className={`twc-metric-value ${(pnl.realized ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                {statsLoading ? '—' : formatCurrency(pnl.realized)}
              </span>
            </div>
            <div className="twc-metric">
              <span className="twc-metric-label">ROI</span>
              <span className={`twc-metric-value ${(stats?.roi ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                {statsLoading ? '—' : formatPercent(stats?.roi)}
              </span>
            </div>
            <div className="twc-metric">
              <span className="twc-metric-label">Unrealized</span>
              <span className={`twc-metric-value ${(pnl.unrealized ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                {statsLoading ? '—' : formatCurrency(pnl.unrealized)}
              </span>
            </div>
            <div className="twc-metric">
              <span className="twc-metric-label">Avg Hold</span>
              <span className="twc-metric-value">{statsLoading ? '—' : formatHold(stats?.avgHoldTimeSecs)}</span>
            </div>
            <div className="twc-metric">
              <span className="twc-metric-label">Invested</span>
              <span className="twc-metric-value">{statsLoading ? '—' : formatCurrency(pnl.invested)}</span>
            </div>
            <div className="twc-metric">
              <span className="twc-metric-label">Open / Closed</span>
              <span className="twc-metric-value">
                {statsLoading ? '—' : `${formatNumber(trading.activePositions)} / ${formatNumber(trading.closedPositions)}`}
              </span>
            </div>
          </div>

          <div className="twc-trade-section">
            <div className="twc-section-title">Most Recent Trade</div>
            {tradeLoading ? (
              <div className="twc-trade-loading"><div className="twc-spinner" /><span>Loading trade…</span></div>
            ) : !lastTrade ? (
              <div className="twc-trade-empty">No recent trades found</div>
            ) : (
              <div
                className="twc-trade twc-trade--tappable"
                onClick={() => onOpenPosition?.(address, lastTrade.mint)}
                role="button"
                title="View position detail"
              >
                <div className="twc-trade-row">
                  {lastTrade.image ? (
                    <img className="twc-trade-img" src={lastTrade.image} alt={lastTrade.symbol} />
                  ) : (
                    <div className="twc-trade-img twc-trade-img--ph">{lastTrade.symbol?.[0] || '?'}</div>
                  )}
                  <div className="twc-trade-info">
                    <div className="twc-trade-symbol">
                      {lastTrade.symbol}
                      <span className={`twc-trade-type twc-trade-type--${lastTrade.type}`}>
                        {lastTrade.type === 'sell' ? 'SELL' : 'BUY'}
                      </span>
                    </div>
                    <div className="twc-trade-meta">
                      {lastTrade.solAmount ? `${Number(lastTrade.solAmount).toFixed(3)} SOL · ` : ''}
                      {timeAgo(lastTrade.time)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="twc-profile-btn" onClick={() => onOpenProfile?.(address)}>
            View Full Wallet Profile
          </button>
        </div>
      )}
    </div>
  );
}

export default TrackedWalletCard;
