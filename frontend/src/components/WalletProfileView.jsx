import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import './ProfileView.css';
import './WalletProfileView.css';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Deterministic gradient avatar from a wallet address
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
  const ms = ts < 1e12 ? ts * 1000 : ts; // seconds vs ms
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

// Normalize a Solana Tracker trade into a coin tile
const parseTrade = (t) => {
  if (!t) return null;
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

const WalletProfileView = ({ walletAddress, onBack }) => {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [coins, setCoins] = useState([]);
  const [coinsLoading, setCoinsLoading] = useState(true);
  const { trackWallet, untrackWallet, isTracked, trackedWallets, toggleCopyTrade } = useTrackedWallets();
  const [tracked, setTracked] = useState(false);
  const [copyHintDismissed, setCopyHintDismissed] = useState(false);

  useEffect(() => {
    setTracked(isTracked(walletAddress));
    setCopyHintDismissed(false);
  }, [walletAddress, isTracked]);

  // Hide the feed's floating card action buttons while this overlay is open
  useEffect(() => {
    document.body.classList.add('wpv-open');
    return () => document.body.classList.remove('wpv-open');
  }, []);

  const trackedWallet = trackedWallets.find((w) => w.address === walletAddress);
  const copyEnabled = trackedWallet ? trackedWallet.copyTradeEnabled !== false : false;

  // Fetch aggregate wallet analytics
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    setStats(null);
    fetch(getFullApiUrl(`/api/wallet/${walletAddress}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { if (!cancelled) { if (d.success) setStats(d); else setStatsError('No data'); } })
      .catch((e) => { if (!cancelled) setStatsError(e.message); })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  // Fetch traded-coins feed
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setCoinsLoading(true);
    setCoins([]);
    fetch(getFullApiUrl(`/api/wallet/${walletAddress}/trades`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return;
        const raw = d?.data?.trades || d?.trades || d?.data || [];
        const list = Array.isArray(raw) ? raw : [];
        const parsed = list.map(parseTrade).filter(Boolean);
        // De-duplicate by mint so the feed shows distinct coins (most recent first)
        const seen = new Set();
        const distinct = [];
        for (const c of parsed) {
          if (seen.has(c.mint)) continue;
          seen.add(c.mint);
          distinct.push(c);
        }
        setCoins(distinct);
      })
      .catch(() => { if (!cancelled) setCoins([]); })
      .finally(() => { if (!cancelled) setCoinsLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  const handleTrackWallet = () => {
    if (!tracked) {
      trackWallet(walletAddress);
      setTracked(true);
    }
  };

  // Opt into copying: tracking a wallet enables copy-trade prompts by default.
  const handleCopyToggle = () => {
    if (!tracked) { trackWallet(walletAddress); setTracked(true); }
    else { toggleCopyTrade(walletAddress); }
  };

  const handleUntrack = () => {
    untrackWallet(walletAddress);
    setTracked(false);
  };

  const trading = stats?.trading || {};
  const pnl = stats?.pnl || {};
  const identity = stats?.identity || null;

  return (
    <div className="wpv-root">
      <button className="wpv-back" onClick={onBack} title="Back" aria-label="Back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Header — mirrors ProfileView, with wallet stats in the name/bio slot */}
      <div className="pv-ig-header wpv-ig-header">
        <div className="pv-ig-top-row">
          <div className="pv-ig-avatar-wrap">
            <div className="pv-ig-avatar-ph" style={{ background: gradientFor(walletAddress) }}>
              <span className="wpv-avatar-egg" role="img" aria-label="wallet">🥚</span>
            </div>
          </div>
          <div className="pv-ig-stats">
            <div className="pv-ig-stat">
              <span className="pv-ig-stat-num">{statsLoading ? '—' : formatNumber(trading.totalTrades)}</span>
              <span className="pv-ig-stat-label">Trades</span>
            </div>
            <div className="pv-ig-stat">
              <span className="pv-ig-stat-num">{statsLoading ? '—' : formatNumber(trading.uniqueTokens)}</span>
              <span className="pv-ig-stat-label">Tokens</span>
            </div>
            <div className="pv-ig-stat">
              <span className="pv-ig-stat-num">{statsLoading ? '—' : formatPercent(stats?.winRate)}</span>
              <span className="pv-ig-stat-label">Win Rate</span>
            </div>
          </div>
        </div>

        <a
          className="pv-ig-addr-chip"
          href={`https://solscan.io/account/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View on Solscan"
        >
          {shortAddr(walletAddress)} ↗
        </a>

        {identity?.name && (
          <div className="wpv-identity-name">
            {identity.name}
            {identity.type && <span className="wpv-identity-type">{identity.type}</span>}
          </div>
        )}

        {/* Statistics occupy the name/bio slot of the profile layout */}
        {statsLoading ? (
          <div className="wpv-metrics-loading">
            <div className="wpv-spinner" />
            <span>Loading analytics…</span>
          </div>
        ) : stats ? (
          <div className="wpv-metrics wpv-metrics--inheader">
            <div className="wpv-metric-group">
              <div className="wpv-metric-group-title">Performance</div>
              <div className="wpv-metric-grid">
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Realized PnL</span>
                  <span className={`wpv-metric-value ${(pnl.realized ?? 0) >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(pnl.realized)}</span>
                </div>
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Win Rate</span>
                  <span className="wpv-metric-value">{formatPercent(stats.winRate)}</span>
                </div>
                <div className="wpv-metric">
                  <span className="wpv-metric-label">ROI</span>
                  <span className={`wpv-metric-value ${(stats.roi ?? 0) >= 0 ? 'pos' : 'neg'}`}>{formatPercent(stats.roi)}</span>
                </div>
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Avg Hold</span>
                  <span className="wpv-metric-value">{formatHold(stats.avgHoldTimeSecs)}</span>
                </div>
              </div>
            </div>

            <div className="wpv-metric-group">
              <div className="wpv-metric-group-title">PnL Overview</div>
              <div className="wpv-metric-grid">
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Invested</span>
                  <span className="wpv-metric-value">{formatCurrency(pnl.invested)}</span>
                </div>
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Proceeds</span>
                  <span className="wpv-metric-value">{formatCurrency(pnl.proceeds)}</span>
                </div>
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Unrealized</span>
                  <span className={`wpv-metric-value ${(pnl.unrealized ?? 0) >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(pnl.unrealized)}</span>
                </div>
                <div className="wpv-metric">
                  <span className="wpv-metric-label">Open / Closed</span>
                  <span className="wpv-metric-value">{formatNumber(trading.activePositions)} / {formatNumber(trading.closedPositions)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {statsError && !statsLoading && (
          <div className="wpv-error">Couldn't load full analytics for this wallet.</div>
        )}

        {/* Actions row — mirrors ProfileView's Edit/Disconnect row */}
        <div className="pv-ig-actions">
          <button
            className={`pv-ig-btn pv-ig-btn--edit wpv-track-action ${tracked ? 'wpv-track-action--on' : ''}`}
            onClick={handleTrackWallet}
            disabled={tracked}
          >
            {tracked ? '✓ Tracked' : 'Track Wallet'}
          </button>
          <button
            className={`pv-ig-btn pv-ig-btn--edit ${tracked && copyEnabled ? 'wpv-track-btn--on' : ''}`}
            onClick={handleCopyToggle}
          >
            {!tracked ? 'Copy Next Trade' : copyEnabled ? '✓ Copying Trades' : 'Resume Copying'}
          </button>
        </div>

        {tracked && !copyHintDismissed && (
          <div className="wpv-copy-hint">
            <span className="wpv-copy-hint-text">
              {copyEnabled
                ? "You'll get a prompt to mirror this trader's next Jupiter swap."
                : 'Copy trading paused — tap Resume to get prompts again.'}
            </span>
            <button
              className="wpv-copy-dismiss"
              onClick={() => setCopyHintDismissed(true)}
              title="Dismiss"
              aria-label="Dismiss copy trading message"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Coins feed */}
      <div className="wpv-feed-title">Coins Traded</div>
      <div className="wpv-feed">
        {coinsLoading ? (
          <div className="wpv-feed-loading">
            <div className="wpv-spinner" />
            <span>Loading coins…</span>
          </div>
        ) : coins.length === 0 ? (
          <div className="wpv-empty">
            <span className="wpv-empty-icon">🪙</span>
            <p>No traded coins found</p>
          </div>
        ) : (
          <div className="wpv-grid">
            {coins.map((c) => (
              <a
                key={c.tx}
                className={`wpv-card wpv-card--${c.type}`}
                href={`https://solscan.io/token/${c.mint}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.image ? (
                  <img src={c.image} alt={c.symbol} className="wpv-card-bg" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="wpv-card-bg wpv-card-bg--ph" style={{ background: gradientFor(c.mint) }} />
                )}
                <div className="wpv-card-overlay" />
                <div className="wpv-card-body">
                  <div className="wpv-card-top">
                    {c.image ? (
                      <img src={c.image} alt={c.symbol} className="wpv-card-avatar" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="wpv-card-avatar wpv-card-avatar--ph">{(c.symbol || '?').slice(0, 2)}</div>
                    )}
                    <span className={`wpv-card-badge wpv-card-badge--${c.type}`}>{c.type === 'sell' ? 'SELL' : 'BUY'}</span>
                  </div>
                  <div className="wpv-card-info">
                    <span className="wpv-card-symbol">{c.symbol}</span>
                    {c.time && <span className="wpv-card-time">{timeAgo(c.time)}</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="wpv-footer">Data from Solana Tracker</div>
    </div>
  );
};

export default WalletProfileView;
