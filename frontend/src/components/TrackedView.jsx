import React, { useEffect, useMemo, useRef, useState } from 'react';
import TopTabs from './TopTabs';
import NativeChart from './NativeChart';
import PositionCard from './PositionCard';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { useTrackedTrades } from '../contexts/TrackedTradesContext';
import { useWallet } from '../contexts/WalletContext';
import { useAlerts } from '../contexts/AlertsContext';
import WalletConnectOnboarding from './WalletConnectOnboarding';
import { AnimalSilhouetteAvatar, buildWalletName, gradientForWallet, shortWalletAddress } from '../utils/walletIdentity';
import { getFullApiUrl, fetchJsonWithTimeout } from '../config/api';
import './TrackedView.css';

const TRACKED_TABS = [
  { id: 'wallets', label: 'Wallets', icon: 'users' },
  { id: 'coins', label: 'Coins', icon: 'star' },
];

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const timeAgo = (ts) => {
  if (!ts) return '';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const formatPrice = (price) => {
  const n = Number(price);
  if (!n) return null;
  if (n < 0.00001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
};

const formatUsdCompact = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};

// Normalize a Solana Tracker / Helius trade into a token-side summary (mirrors TrackedWalletCard's parser).
const parseTrade = (t) => {
  if (!t) return null;
  if (t.mint) {
    if (t.mint === SOL_MINT) return null;
    return { type: t.type || 'buy', mint: t.mint, symbol: t.symbol || 'Unknown', image: t.image || null, solAmount: t.solAmount ?? null, time: t.time || t.timestamp };
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
    type,
    mint: side.address,
    symbol: token.symbol || 'Unknown',
    image: token.image || null,
    solAmount: fromIsSol ? from.amount : (toIsSol ? to.amount : null),
    time: t.time,
  };
};

/** Mounts a heavy trade card (position fetch + OHLCV chart) only while it is
 * near the viewport — the feed holds up to 60 cards, and each mounted chart
 * costs several MB, so far-away cards are unmounted again to keep memory flat
 * no matter how far the user scrolls. */
function LazyTradeCard({ children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setVisible(entry.isIntersecting);
    }, { rootMargin: '1200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="tw-card-slot">
      {visible ? children : <div className="tw-card-placeholder" />}
    </div>
  );
}

/** One tweet-style row: avatar + name/handle/time header, a caption describing
 * the wallet's most recent trade (colored by direction), and a PnL chip —
 * tapping anywhere opens the full wallet profile. */
function WalletTweetRow({ wallet, onOpenProfile, onUntrack }) {
  const address = wallet?.address;
  const [lastTrade, setLastTrade] = useState(null);
  const [pnlRealized, setPnlRealized] = useState(null);
  const [roi, setRoi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    Promise.all([
      fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${address}/trades`)).catch(() => null),
      fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${address}`)).catch(() => null),
    ]).then(([tradesRes, statsRes]) => {
      if (cancelled) return;
      const raw = tradesRes?.data?.trades || tradesRes?.trades || tradesRes?.data || [];
      const list = Array.isArray(raw) ? raw : [];
      const parsed = list.map(parseTrade).filter(Boolean);
      setLastTrade(parsed[0] || null);
      if (statsRes?.success) {
        setPnlRealized(Number(statsRes.pnl?.realized));
        setRoi(Number(statsRes.roi));
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  const roiUp = Number.isFinite(roi) ? roi >= 0 : null;

  return (
    <div
      className="tw-tweet"
      role="button"
      tabIndex={0}
      onClick={() => onOpenProfile?.(address, { displayName: wallet.label })}
    >
      <div className="tw-tweet-avatar" style={{ background: gradientForWallet(address) }}>
        <AnimalSilhouetteAvatar address={address} />
      </div>
      <div className="tw-tweet-body">
        <div className="tw-tweet-header">
          <span className="tw-tweet-name">{wallet.label || buildWalletName(address)}</span>
          <span className="tw-tweet-handle">{shortWalletAddress(address)}</span>
          {wallet.addedAt && (
            <>
              <span className="tw-tweet-dot">·</span>
              <span className="tw-tweet-time">{timeAgo(wallet.addedAt)}</span>
            </>
          )}
          <button
            type="button"
            className="tw-tweet-close"
            title="Stop tracking"
            onClick={(e) => { e.stopPropagation(); onUntrack?.(address); }}
          >
            ×
          </button>
        </div>
        <p className="tw-tweet-text">
          {loading ? (
            'Loading recent activity…'
          ) : lastTrade ? (
            <>
              {lastTrade.type === 'sell' ? 'Sold' : 'Bought'} <strong>${lastTrade.symbol}</strong>
              {lastTrade.solAmount ? ` for ${Number(lastTrade.solAmount).toFixed(3)} SOL` : ''}
              {roiUp !== null && (
                <span className={roiUp ? 'tw-up' : 'tw-down'}> · {roiUp ? 'up' : 'down'} {Math.abs(roi).toFixed(1)}% ROI</span>
              )}
            </>
          ) : (
            'No recent trades yet'
          )}
        </p>
        {lastTrade && (
          <div className="tw-tweet-trade-card">
            <span className="tw-tweet-coin-img">
              {lastTrade.image ? <img src={lastTrade.image} alt="" loading="lazy" /> : <span className="tw-tweet-coin-egg">🥚</span>}
            </span>
            <span className="tw-tweet-trade-meta">
              <span className="tw-tweet-trade-symbol">${lastTrade.symbol}</span>
              <span className={`tw-tweet-trade-side ${lastTrade.type === 'sell' ? 'sell' : 'buy'}`}>
                {lastTrade.type === 'sell' ? 'Sell' : 'Buy'}{lastTrade.time ? ` · ${timeAgo(lastTrade.time)} ago` : ''}
              </span>
            </span>
            {Number.isFinite(pnlRealized) && (
              <span className={`tw-tweet-pnl-chip ${pnlRealized >= 0 ? 'pos' : 'neg'}`}>
                {formatUsdCompact(pnlRealized)} PnL
              </span>
            )}
          </div>
        )}
        {!lastTrade && Number.isFinite(pnlRealized) && (
          <span className={`tw-tweet-pnl-chip ${pnlRealized >= 0 ? 'pos' : 'neg'}`}>
            Realized PnL {formatUsdCompact(pnlRealized)}
          </span>
        )}
      </div>
    </div>
  );
}

/** One post-style row for a tracked coin: a live mini chart as the "attached
 * media" with the tracked-at price line + live price badge, like a compact
 * coin card — tapping opens the full coin view. */
function CoinPostRow({ coin, onSelect, onRemove, onTradeClick }) {
  const price = Number(coin.price_usd || coin.priceUsd || coin.price) || null;
  const trackedAtPrice = Number(coin.trackedAtPrice) || null;
  const perf = price && trackedAtPrice ? ((price - trackedAtPrice) / trackedAtPrice) * 100 : null;
  const priceText = formatPrice(price);
  const trackedAtText = formatPrice(trackedAtPrice);

  const chartCoin = useMemo(() => ({
    mintAddress: coin.mintAddress || coin.address,
    pairAddress: coin.pairAddress,
    poolAddress: coin.poolAddress,
  }), [coin.mintAddress, coin.address, coin.pairAddress, coin.poolAddress]);

  return (
    <div className="tw-post" role="button" tabIndex={0} onClick={() => onSelect?.(coin)}>
      <div className="tw-post-header">
        <span
          className="tw-post-avatar tw-post-avatar--clickable"
          title="Open coin"
          onClick={(e) => { e.stopPropagation(); onSelect?.(coin); }}
        >
          {coin.image || coin.logo ? <img src={coin.image || coin.logo} alt="" loading="lazy" /> : <span className="tw-post-egg-sm">🥚</span>}
        </span>
        <span className="tw-post-title">{coin.symbol || coin.name || 'Unknown'}</span>
        {priceText && <span className="tw-post-price">{priceText}</span>}
        {perf !== null && (
          <span className={`tw-post-perf-chip ${perf >= 0 ? 'pos' : 'neg'}`}>
            {perf >= 0 ? '+' : ''}{perf.toFixed(1)}%
          </span>
        )}
        <button
          type="button"
          className="tw-tweet-close"
          title="Stop tracking this coin"
          onClick={(e) => { e.stopPropagation(); onRemove?.(e, coin); }}
        >
          ×
        </button>
      </div>
      {trackedAtText && (
        <p className="tw-post-caption">
          Tracking since {trackedAtText}
          {perf !== null && (
            <span className={perf >= 0 ? 'tw-up' : 'tw-down'}> · {perf >= 0 ? 'up' : 'down'} {Math.abs(perf).toFixed(1)}% since</span>
          )}
        </p>
      )}
      <div className="tw-post-chart" onClick={(e) => e.stopPropagation()}>
        <NativeChart
          coin={chartCoin}
          isActive={true}
          isExpanded={false}
          livePrice={price}
          trackedPrice={trackedAtPrice}
          trackedTime={coin.savedAt || coin.timestamp}
        />
      </div>
      <div className="tw-post-actions">
        <button
          type="button"
          className="tw-post-buy-btn"
          onClick={(e) => { e.stopPropagation(); onTradeClick?.(coin); }}
        >
          Buy
        </button>
        <button
          type="button"
          className="tw-post-view-btn"
          onClick={(e) => { e.stopPropagation(); onSelect?.(coin); }}
        >
          View coin
        </button>
      </div>
    </div>
  );
}

/**
 * "Tracked" tab: a Twitter/X-style timeline — tracked wallets read as tweets
 * about their most recent trade, tracked coins read as photo posts showing
 * performance since tracked. Tapping either opens the full wallet profile /
 * coin detail page.
 */
function TrackedView({
  favorites = [],
  onFavoritesChange,
  onTradeClick,
  onWalletClick,
  onCoinSelect,
  onOpenPosition,
  onCurrentCoinChange,
}) {
  const [activeFeed, setActiveFeed] = useState('wallets');
  const [coinSort, setCoinSort] = useState('newest');
  const [walletSort, setWalletSort] = useState('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activityPanel, setActivityPanel] = useState(null);
  const { trackedWallets, untrackWallet } = useTrackedWallets();
  const { tradesByMint, tradesLoaded } = useTrackedTrades();
  const { connected: walletConnected } = useWallet();
  const { notifications, markNotificationsRead } = useAlerts();

  // All tracked wallets' trades, newest first — the "recent moves" timeline.
  // Deduped to one card per wallet+mint: the card itself summarizes the whole
  // position (invested, PnL, tx count), so repeat same-coin trades would render
  // identical cards. The latest trade's time/image seeds the card.
  const tradeFeed = useMemo(() => {
    const all = [];
    for (const list of tradesByMint.values()) all.push(...list);
    all.sort((a, b) => b.time - a.time);
    const seen = new Set();
    const deduped = [];
    for (const t of all) {
      const key = `${t.walletAddress}:${t.mint}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(t);
      if (deduped.length >= 40) break;
    }
    return deduped;
  }, [tradesByMint]);

  const labelByWallet = useMemo(() => {
    const m = new Map();
    for (const w of trackedWallets) m.set(w.address, w.label);
    return m;
  }, [trackedWallets]);

  // Live USD prices for the coins in the feed (Dexscreener supports 30 mints per call).
  const [livePrices, setLivePrices] = useState(new Map());
  const feedMintsKey = useMemo(
    () => [...new Set(tradeFeed.map((t) => t.mint))].sort().join(','),
    [tradeFeed]
  );
  useEffect(() => {
    const mints = feedMintsKey ? feedMintsKey.split(',') : [];
    if (!mints.length) return undefined;
    let cancelled = false;
    (async () => {
      const prices = new Map();
      for (let i = 0; i < mints.length; i += 30) {
        try {
          const chunk = mints.slice(i, i + 30);
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
          if (!res.ok) continue;
          const data = await res.json();
          for (const pair of data.pairs || []) {
            const mint = pair.baseToken?.address;
            const price = Number(pair.priceUsd);
            if (!mint || !(price > 0)) continue;
            const liq = Number(pair.liquidity?.usd) || 0;
            const prev = prices.get(mint);
            if (!prev || liq > prev.liq) prices.set(mint, { price, liq });
          }
        } catch (_) { /* keep whatever we have */ }
      }
      if (!cancelled) {
        setLivePrices(new Map([...prices].map(([m, v]) => [m, v.price])));
      }
    })();
    return () => { cancelled = true; };
  }, [feedMintsKey]);

  const handleRemoveCoin = (e, coin) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f =>
      (f.mintAddress || f.address) !== (coin.mintAddress || coin.address)
    );
    onFavoritesChange?.(newFavs);
  };

  // Coins tab ordering — perf sorts use the same price fields CoinPostRow displays.
  const sortedFavorites = useMemo(() => {
    const trackedAtOf = (c) => Number(c.savedAt || c.timestamp || c.addedAt) || 0;
    const perfOf = (c) => {
      const price = Number(c.price_usd || c.priceUsd || c.price) || 0;
      const tracked = Number(c.trackedAtPrice) || 0;
      return price > 0 && tracked > 0 ? (price - tracked) / tracked : null;
    };
    const list = [...favorites];
    if (coinSort === 'oldest') {
      list.sort((a, b) => trackedAtOf(a) - trackedAtOf(b));
    } else if (coinSort === 'gainers' || coinSort === 'losers') {
      const dir = coinSort === 'gainers' ? -1 : 1;
      list.sort((a, b) => {
        const pa = perfOf(a);
        const pb = perfOf(b);
        if (pa === null && pb === null) return trackedAtOf(b) - trackedAtOf(a);
        if (pa === null) return 1; // unknown perf sinks to the bottom
        if (pb === null) return -1;
        return (pa - pb) * dir;
      });
    } else {
      list.sort((a, b) => trackedAtOf(b) - trackedAtOf(a)); // newest
    }
    return list;
  }, [favorites, coinSort]);

  const COIN_SORTS = [
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
    { id: 'gainers', label: 'Top gainers' },
    { id: 'losers', label: 'Losers' },
  ];

  const WALLET_SORTS = [
    { id: 'newest', label: 'Newest' },
    { id: 'buys', label: 'Buys' },
    { id: 'sells', label: 'Sells' },
    { id: 'biggest', label: 'Biggest' },
    { id: 'gainers', label: 'Top gainers' },
  ];

  const sortOptions = activeFeed === 'wallets' ? WALLET_SORTS : COIN_SORTS;
  const activeSort = activeFeed === 'wallets' ? walletSort : coinSort;

  const selectSort = (sort) => {
    if (activeFeed === 'wallets') setWalletSort(sort);
    else setCoinSort(sort);
    setShowSortMenu(false);
  };

  // Wallets tab ordering/filtering — "since" uses the live Dexscreener price.
  const visibleTrades = useMemo(() => {
    const sinceOf = (t) => {
      const now = livePrices.get(t.mint) || 0;
      return now > 0 && t.priceUsd > 0 ? (now - t.priceUsd) / t.priceUsd : null;
    };
    let list = [...tradeFeed];
    if (walletSort === 'buys') list = list.filter((t) => t.type !== 'sell');
    else if (walletSort === 'sells') list = list.filter((t) => t.type === 'sell');
    else if (walletSort === 'biggest') list.sort((a, b) => (b.usdAmount || 0) - (a.usdAmount || 0));
    else if (walletSort === 'gainers') {
      list.sort((a, b) => {
        const sa = sinceOf(a);
        const sb = sinceOf(b);
        if (sa === null && sb === null) return b.time - a.time;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      });
    }
    return list;
  }, [tradeFeed, walletSort, livePrices]);

  // Horizontal swipe between the Wallets / Coins feeds, page following the finger.
  // The sort bar is a fixed overlay (its own horizontal scroll), so swipes
  // starting on it must not slide the pages.
  const FEED_ORDER = ['wallets', 'coins'];
  const SLIDE_MS = 190;
  const pagesRef = useRef(null);
  const swipeRef = useRef(null);
  const slideTimersRef = useRef([]);
  const [dragX, setDragX] = useState(0);
  const [slidePhase, setSlidePhase] = useState('idle'); // idle | drag | settle | jump

  const pushTimer = (fn, ms) => {
    const id = setTimeout(fn, ms);
    slideTimersRef.current.push(id);
    return id;
  };

  useEffect(() => () => slideTimersRef.current.forEach(clearTimeout), []);

  const pageWidth = () => pagesRef.current?.offsetWidth || window.innerWidth || 1;

  const animateToFeed = (target, dir) => {
    const width = pageWidth();
    setSlidePhase('settle');
    setDragX(-dir * width);
    pushTimer(() => {
      setActiveFeed(target);
      setSlidePhase('jump');
      setDragX(dir * width);
      pushTimer(() => {
        setSlidePhase('settle');
        setDragX(0);
        pushTimer(() => setSlidePhase('idle'), SLIDE_MS);
      }, 20);
    }, SLIDE_MS);
  };

  const selectFeed = (target) => {
    if (target === activeFeed) return;
    setShowSortMenu(false);
    setActivityPanel(null);
    animateToFeed(target, FEED_ORDER.indexOf(target) > FEED_ORDER.indexOf(activeFeed) ? 1 : -1);
  };

  const notificationsFor = (target, unreadOnly = false) => (notifications || []).filter((notification) => {
    const notificationTarget = notification.target || 'coins';
    return notificationTarget === target && (!unreadOnly || !notification.read);
  });

  const unreadTabCounts = {
    wallets: notificationsFor('wallets', true).length,
    coins: notificationsFor('coins', true).length,
  };

  const openActivityPanel = (target) => {
    const unread = notificationsFor(target, true).slice(0, 20);
    setShowSortMenu(false);
    setActivityPanel({ target, notifications: unread });
    if (unread.length) {
      const unreadIds = new Set(unread.map((notification) => notification.id));
      markNotificationsRead((notification) => unreadIds.has(notification.id));
    }
  };

  const handleActivityClick = (notification) => {
    setActivityPanel(null);
    if (notification.target === 'wallets' && notification.walletAddress) {
      onWalletClick?.(notification.walletAddress, { displayName: notification.walletLabel });
    } else if ((notification.target || 'coins') === 'coins' && notification.coin) {
      onCoinSelect?.({ ...notification.coin, mintAddress: notification.mint || notification.coin.mintAddress });
    }
  };

  const handlePageTouchStart = (e) => {
    if (slidePhase === 'settle' || slidePhase === 'jump') return;
    if (e.target.closest?.('.native-chart, .tw-filter-control')) { swipeRef.current = null; return; }
    const t = e.touches?.[0];
    swipeRef.current = t ? { x: t.clientX, y: t.clientY, axis: null } : null;
  };

  const handlePageTouchMove = (e) => {
    const start = swipeRef.current;
    const t = e.touches?.[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (!start.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      start.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (start.axis === 'x') setSlidePhase('drag');
    }
    if (start.axis !== 'x') return;
    const idx = FEED_ORDER.indexOf(activeFeed);
    const atEdge = (dx < 0 && idx === FEED_ORDER.length - 1) || (dx > 0 && idx === 0);
    setDragX(atEdge ? dx * 0.28 : dx);
  };

  const handlePageTouchEnd = () => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.axis !== 'x') return;
    const idx = FEED_ORDER.indexOf(activeFeed);
    const dir = dragX < 0 ? 1 : -1;
    const target = FEED_ORDER[idx + dir];
    if (target && Math.abs(dragX) > Math.min(90, pageWidth() * 0.25)) {
      animateToFeed(target, dir);
    } else {
      setSlidePhase('settle');
      setDragX(0);
      pushTimer(() => setSlidePhase('idle'), SLIDE_MS);
    }
  };

  return (
    <div className="tracked-view">
      <TopTabs
        activeFilter={activeFeed}
        onFilterChange={({ type }) => selectFeed(type)}
        onActiveTabClick={openActivityPanel}
        customTabs={TRACKED_TABS}
        tabBadges={unreadTabCounts}
      />

      {activityPanel && (
        <section className="tw-activity-panel" aria-label={`New ${activityPanel.target} notifications`}>
          <div className="tw-activity-panel-header">
            <span>New activity</span>
            <button type="button" aria-label="Close notifications" onClick={() => setActivityPanel(null)}>×</button>
          </div>
          {activityPanel.notifications.length ? (
            <div className="tw-activity-list">
              {activityPanel.notifications.map((notification) => (
                <button key={notification.id} type="button" className="tw-activity-item" onClick={() => handleActivityClick(notification)}>
                  <span className="tw-activity-dot" aria-hidden="true" />
                  {notification.walletProfileImage ? (
                    <img src={notification.walletProfileImage} alt="" />
                  ) : notification.target === 'wallets' && notification.walletAddress ? (
                    <span className="tw-activity-avatar" style={{ background: gradientForWallet(notification.walletAddress) }}>
                      <AnimalSilhouetteAvatar address={notification.walletAddress} />
                    </span>
                  ) : notification.coin?.image ? (
                    <img src={notification.coin.image} alt="" />
                  ) : (
                    <span className="tw-activity-avatar" aria-hidden="true" />
                  )}
                  <span className="tw-activity-copy">
                    <strong>{notification.walletLabel || notification.coin?.symbol || 'Tracked activity'}</strong>
                    <span>{notification.message}</span>
                  </span>
                  <time>{timeAgo(notification.timestamp)}</time>
                </button>
              ))}
            </div>
          ) : <p className="tw-activity-empty">No new notifications.</p>}
        </section>
      )}

      <div className="tw-filter-control">
        <button
          type="button"
          className={`tw-filter-button${showSortMenu ? ' active' : ''}`}
          aria-label={`Filter ${activeFeed}`}
          aria-expanded={showSortMenu}
          onClick={() => setShowSortMenu((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
        </button>
        {showSortMenu && (
          <div className="tw-filter-menu" role="menu" aria-label={`${activeFeed} filters`}>
            {sortOptions.map((sort) => (
              <button
                key={sort.id}
                type="button"
                role="menuitemradio"
                aria-checked={activeSort === sort.id}
                className={activeSort === sort.id ? 'active' : ''}
                onClick={() => selectSort(sort.id)}
              >
                {sort.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="tw-pages"
        ref={pagesRef}
        onTouchStart={handlePageTouchStart}
        onTouchMove={handlePageTouchMove}
        onTouchEnd={handlePageTouchEnd}
        onTouchCancel={handlePageTouchEnd}
      >
      <div
        className={`tw-page${slidePhase === 'drag' || slidePhase === 'jump' ? ' no-anim' : ''}`}
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          opacity: 1 - Math.min(0.4, Math.abs(dragX) / 420),
        }}
      >
      {activeFeed === 'wallets' ? (
        trackedWallets.length === 0 ? (
          <div className="tracked-empty">
            <h3>No tracked wallets</h3>
            <p>Tap a trader's wallet anywhere in the app and hit “Track Wallet” to follow their moves here.</p>
            {!walletConnected && (
              <WalletConnectOnboarding>
                <button type="button" className="tracked-empty-connect">Connect wallet</button>
              </WalletConnectOnboarding>
            )}
          </div>
        ) : (
          <div className="tw-feed-scroller tw-card-scroller">
            <div className="tw-feed tw-card-feed">
              {visibleTrades.length > 0 ? (
                visibleTrades.map((trade) => (
                  <LazyTradeCard key={`${trade.signature || trade.time}-${trade.walletAddress}-${trade.mint}`}>
                    <PositionCard
                      embedded
                      walletAddress={trade.walletAddress}
                      mint={trade.mint}
                      profileHint={{
                        displayName: labelByWallet.get(trade.walletAddress),
                        tokenSymbol: trade.symbol,
                        tokenImage: trade.image,
                        timestamp: trade.time,
                        type: trade.type,
                        solAmount: trade.solAmount,
                      }}
                      onOpenProfile={(hint) => onWalletClick?.(trade.walletAddress, hint)}
                      onMimicTrade={onTradeClick}
                      onCoinClick={onCoinSelect}
                    />
                  </LazyTradeCard>
                ))
              ) : (
                <div className="tracked-empty tracked-empty--inline">
                  <p>{tradesLoaded ? (tradeFeed.length ? 'No trades match this filter.' : 'No recent trades from your tracked wallets yet.') : 'Loading recent moves…'}</p>
                </div>
              )}
            </div>
          </div>
        )
      ) : favorites.length === 0 ? (
        <div className="tracked-empty">
          <h3>No tracked coins</h3>
          <p>Hit “Track” on any coin card and it will show up in this feed.</p>
          {!walletConnected && (
            <WalletConnectOnboarding>
              <button type="button" className="tracked-empty-connect">Connect wallet</button>
            </WalletConnectOnboarding>
          )}
        </div>
      ) : (
        <div className="tw-feed-scroller">
          <div className="tw-feed">
            {sortedFavorites.map((coin) => (
              <CoinPostRow
                key={coin.mintAddress || coin.address}
                coin={coin}
                onSelect={onCoinSelect}
                onRemove={handleRemoveCoin}
                onTradeClick={onTradeClick}
              />
            ))}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

export default TrackedView;

