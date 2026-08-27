import React, { useState, useEffect } from 'react';
import { getFullApiUrl, fetchJsonWithTimeout } from '../config/api';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import './ProfileView.css';
import './WalletProfileView.css';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const ANON_ANIMALS = [
  { name: 'Wolf', body: 'M12 4.2 17.5 7.8 20 5.8 18.7 13.2 21 16.5 16.7 16.2 14.2 19.8 12 17 9.8 19.8 7.3 16.2 3 16.5 5.3 13.2 4 5.8 6.5 7.8z' },
  { name: 'Fox', body: 'M12 5 16.8 7.3 20 4.8 18.5 13.7 20.2 17.8 15.2 16.4 12 19.2 8.8 16.4 3.8 17.8 5.5 13.7 4 4.8 7.2 7.3z' },
  { name: 'Lynx', body: 'M6.2 5.2 10.4 8.5 12 6.9 13.6 8.5 17.8 5.2 17 12.7 19.2 15.4 15 16.5 12 19.3 9 16.5 4.8 15.4 7 12.7z' },
  { name: 'Hare', body: 'M8.6 12.3 C6.5 7.8 6.5 3.9 8.2 3.4 C10 5.6 10.5 8.6 10.5 11.1 C11.1 11 11.7 11 12.3 11.1 C12.3 8.5 13 5.1 15.1 3.1 C16.7 3.9 16.4 8.2 14.6 12.3 C17.1 13.2 18.8 15.3 18.8 17.8 C16.8 19 14.5 19.6 12 19.6 C9.5 19.6 7.2 19 5.2 17.8 C5.2 15.3 6.9 13.2 8.6 12.3z' },
  { name: 'Bull', body: 'M4.3 7.1 C6.8 7.1 7.9 8.7 8.9 10.1 C9.8 9.6 10.8 9.4 12 9.4 C13.2 9.4 14.2 9.6 15.1 10.1 C16.1 8.7 17.2 7.1 19.7 7.1 C18.8 9.8 17.7 11.7 16.6 13 C17 14.1 17.1 15.2 17 16.5 C15.6 18 13.8 18.8 12 18.8 C10.2 18.8 8.4 18 7 16.5 C6.9 15.2 7 14.1 7.4 13 C6.3 11.7 5.2 9.8 4.3 7.1z' },
  { name: 'Manta', body: 'M2.8 12.5 C6.6 7.8 9.3 6.1 12 6.1 C14.7 6.1 17.4 7.8 21.2 12.5 C17.7 13.2 15.4 14.6 13.3 17.4 L12 20 L10.7 17.4 C8.6 14.6 6.3 13.2 2.8 12.5z' },
];

const NAME_WORDS = {
  a: ['Agile', 'Amber', 'Astral'], b: ['Bold', 'Bright', 'Brisk'], c: ['Cosmic', 'Clever', 'Crimson'],
  d: ['Daring', 'Dusky', 'Drift'], e: ['Electric', 'Emerald', 'Echo'], f: ['Feral', 'Frost', 'Fleet'],
  g: ['Golden', 'Ghost', 'Glowing'], h: ['Hidden', 'Hollow', 'Hyper'], i: ['Ivory', 'Ion', 'Iron'],
  j: ['Jade', 'Jolly', 'Jet'], k: ['Keen', 'Kinetic', 'Kindled'], l: ['Lucky', 'Lunar', 'Lucid'],
  m: ['Mystic', 'Magnetic', 'Molten'], n: ['Neon', 'Noble', 'Nomad'], o: ['Obsidian', 'Oracle', 'Orbit'],
  p: ['Prime', 'Phantom', 'Polar'], q: ['Quick', 'Quiet', 'Quantum'], r: ['Radiant', 'Rogue', 'Rapid'],
  s: ['Solar', 'Sharp', 'Silver'], t: ['Turbo', 'Twilight', 'True'], u: ['Ultra', 'Umber', 'Unbound'],
  v: ['Vivid', 'Velvet', 'Vector'], w: ['Wild', 'White', 'Wired'], x: ['Xeno', 'Xray', 'Xtra'],
  y: ['Young', 'Yellow', 'Yonder'], z: ['Zealous', 'Zenith', 'Zesty'],
};

const NAME_CREATURES = {
  a: ['Albatross', 'Antelope', 'Axolotl'], b: ['Badger', 'Bobcat', 'Bison'], c: ['Cougar', 'Cobra', 'Crane'],
  d: ['Dolphin', 'Dragonfly', 'Deer'], e: ['Eagle', 'Egret', 'Elk'], f: ['Falcon', 'Fox', 'Finch'],
  g: ['Gecko', 'Gazelle', 'Gull'], h: ['Heron', 'Hawk', 'Hare'], i: ['Ibis', 'Impala', 'Ibex'],
  j: ['Jaguar', 'Jay', 'Jackal'], k: ['Kestrel', 'Koala', 'Koi'], l: ['Lynx', 'Lion', 'Lark'],
  m: ['Manta', 'Marten', 'Magpie'], n: ['Nightingale', 'Narwhal', 'Newt'], o: ['Ocelot', 'Otter', 'Orca'],
  p: ['Panther', 'Puffin', 'Python'], q: ['Quail', 'Quokka', 'Quetzal'], r: ['Raven', 'Ray', 'Robin'],
  s: ['Swan', 'Stingray', 'Sparrow'], t: ['Tiger', 'Toucan', 'Tern'], u: ['Urchin', 'Umbrellabird', 'Uakari'],
  v: ['Viper', 'Vicuna', 'Vole'], w: ['Wolf', 'Whale', 'Wren'], x: ['Xerus', 'Xenops', 'Xolo'],
  y: ['Yak', 'Yabby', 'Yellowtail'], z: ['Zebra', 'Zebu', 'Zorilla'],
};

// Deterministic gradient avatar from a wallet address
const gradientFor = (addr = '') => {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 65%, 55%) 0%, hsl(${h2}, 65%, 45%) 100%)`;
};

const hashAddress = (addr = '') => {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
};

const getAnonAnimal = (addr = '') => ANON_ANIMALS[hashAddress(addr) % ANON_ANIMALS.length];

const wordForLetter = (dict, letter, hash) => {
  const words = dict[letter.toLowerCase()] || dict.a;
  return words[hash % words.length];
};

const buildWalletName = (addr = '') => {
  const suffix = (addr.match(/[a-z0-9]+$/i)?.[0] || addr).slice(-6);
  const letters = suffix.match(/[a-z]/gi) || [];
  const digits = suffix.match(/\d/g) || [];
  const fallbackLetters = (addr.match(/[a-z]/gi) || ['a', 'n']).slice(-2);
  const [adjInitial, nounInitial] = (letters.length >= 2 ? letters.slice(-2) : fallbackLetters).map((c) => c.toLowerCase());
  const hash = hashAddress(addr);
  const numberTag = digits.length ? ` ${digits.slice(-2).join('')}` : '';
  return `${wordForLetter(NAME_WORDS, adjInitial, hash)} ${wordForLetter(NAME_CREATURES, nounInitial, Math.floor(hash / 7))}${numberTag}`;
};

const AnimalSilhouetteAvatar = ({ address }) => {
  const animal = getAnonAnimal(address);
  return (
    <svg className="wpv-animal-avatar" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={animal.body} />
    </svg>
  );
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

const WalletProfileView = ({ walletAddress, profileHint = {}, onBack }) => {
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
    fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${walletAddress}`))
      .then((d) => { if (!cancelled) { if (d.success) setStats(d); else setStatsError('No data'); } })
      .catch((e) => { if (!cancelled) setStatsError(e.name === 'AbortError' ? 'Timed out' : e.message); })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [walletAddress]);

  // Fetch traded-coins feed
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    setCoinsLoading(true);
    setCoins([]);
    fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${walletAddress}/trades`))
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
    if (!tracked && trackWallet(walletAddress)) {
      setTracked(true);
    }
  };

  // Opt into copying: tracking a wallet enables copy-trade prompts by default.
  const handleCopyToggle = () => {
    if (!tracked) {
      if (trackWallet(walletAddress)) setTracked(true);
      return;
    }
    toggleCopyTrade(walletAddress);
  };

  const handleUntrack = () => {
    untrackWallet(walletAddress);
    setTracked(false);
  };

  const trading = stats?.trading || {};
  const pnl = stats?.pnl || {};
  const identity = stats?.identity || null;
  const anonAnimal = getAnonAnimal(walletAddress);
  const displayName = identity?.name || profileHint?.displayName || profileHint?.name || buildWalletName(walletAddress);
  const latestCoin = coins[0] || null;

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
              <AnimalSilhouetteAvatar address={walletAddress} />
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

        <div className="wpv-identity-name">
          <span>{displayName}</span>
          <span className="wpv-identity-type">{identity?.type || anonAnimal.name}</span>
        </div>

        <div className="wpv-fast-card">
          <div className="wpv-fast-user-row">
            <div className="wpv-fast-mini-avatar" style={{ background: gradientFor(walletAddress) }}>
              <AnimalSilhouetteAvatar address={walletAddress} />
            </div>
            <div className="wpv-fast-user-copy">
              <span className="wpv-fast-name">{displayName}</span>
              <span className="wpv-fast-sub">{shortAddr(walletAddress)}</span>
            </div>
            <button className="wpv-fast-follow" onClick={handleTrackWallet} disabled={tracked}>
              {tracked ? 'Tracked' : 'Follow'}
            </button>
          </div>

          <div className="wpv-fast-position">
            {coinsLoading ? (
              <div className="wpv-fast-skeleton">
                <span />
                <span />
                <span />
              </div>
            ) : latestCoin ? (
              <>
                <div className="wpv-fast-token-row">
                  {latestCoin.image ? (
                    <img className="wpv-fast-token-img" src={latestCoin.image} alt={latestCoin.symbol} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="wpv-fast-token-img wpv-fast-token-img--ph" style={{ background: gradientFor(latestCoin.mint) }}>
                      {(latestCoin.symbol || '?').slice(0, 2)}
                    </div>
                  )}
                  <div className="wpv-fast-token-copy">
                    <span className="wpv-fast-token-symbol">{latestCoin.symbol}</span>
                    <span className="wpv-fast-token-meta">
                      {latestCoin.type === 'sell' ? 'Closed' : 'Opened'} {timeAgo(latestCoin.time)} ago
                    </span>
                  </div>
                  <span className={`wpv-fast-side wpv-fast-side--${latestCoin.type}`}>{latestCoin.type === 'sell' ? 'Sell' : 'Buy'}</span>
                </div>
                <div className="wpv-fast-pnl-card">
                  <span className="wpv-fast-pnl-label">Deep PnL</span>
                  <span className="wpv-fast-pnl-value">{statsLoading ? 'Calculating...' : formatCurrency(pnl.realized)}</span>
                </div>
              </>
            ) : (
              <div className="wpv-fast-empty">No recent wallet trades yet</div>
            )}
          </div>
        </div>

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
