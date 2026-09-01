import React, { useEffect, useMemo, useState } from 'react';
import TopTabs from './TopTabs';
import NativeChart from './NativeChart';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { useTrackedTrades } from '../contexts/TrackedTradesContext';
import { useWallet } from '../contexts/WalletContext';
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

/** One chronological trade-event row: which tracked wallet moved, what they
 * bought/sold, the USD (and SOL) they put in, and how the coin has moved since. */
function TradeEventRow({ trade, walletLabel, currentPrice, onOpenProfile, onOpenPosition }) {
  const { walletAddress, mint, type, symbol, image, solAmount, usdAmount, priceUsd, time } = trade;
  const sincePct = currentPrice > 0 && priceUsd > 0
    ? ((currentPrice - priceUsd) / priceUsd) * 100
    : null;
  const sinceUp = sincePct !== null ? sincePct >= 0 : null;

  return (
    <div
      className="tw-tweet"
      role="button"
      tabIndex={0}
      onClick={() => onOpenPosition?.(walletAddress, mint, { displayName: walletLabel, tokenSymbol: symbol, tokenImage: image })}
    >
      <div
        className="tw-tweet-avatar"
        style={{ background: gradientForWallet(walletAddress) }}
        onClick={(e) => { e.stopPropagation(); onOpenProfile?.(walletAddress, { displayName: walletLabel }); }}
        title="View wallet profile"
      >
        <AnimalSilhouetteAvatar address={walletAddress} />
      </div>
      <div className="tw-tweet-body">
        <div className="tw-tweet-header">
          <span
            className="tw-tweet-name"
            onClick={(e) => { e.stopPropagation(); onOpenProfile?.(walletAddress, { displayName: walletLabel }); }}
          >
            {walletLabel || buildWalletName(walletAddress)}
          </span>
          <span className="tw-tweet-handle">{shortWalletAddress(walletAddress)}</span>
          {time > 0 && (
            <>
              <span className="tw-tweet-dot">·</span>
              <span className="tw-tweet-time">{timeAgo(time)}</span>
            </>
          )}
        </div>
        <p className="tw-tweet-text">
          {type === 'sell' ? 'Sold' : 'Bought'} <strong>${symbol}</strong>
          {usdAmount > 0
            ? <> for <strong>{formatUsdCompact(usdAmount)}</strong>{solAmount > 0 ? ` (${solAmount.toFixed(3)} SOL)` : ''}</>
            : (solAmount > 0 ? ` for ${solAmount.toFixed(3)} SOL` : '')}
          {sincePct !== null && (
            <span className={sinceUp ? 'tw-up' : 'tw-down'}>
              {' '}· {sinceUp ? 'up' : 'down'} {Math.abs(sincePct).toFixed(1)}% since
            </span>
          )}
        </p>
        <div className="tw-tweet-trade-card">
          <span className="tw-tweet-coin-img">
            {image ? <img src={image} alt="" loading="lazy" /> : <span className="tw-tweet-coin-egg">🥚</span>}
          </span>
          <span className="tw-tweet-trade-meta">
            <span className="tw-tweet-trade-symbol">${symbol}</span>
            <span className={`tw-tweet-trade-side ${type === 'sell' ? 'sell' : 'buy'}`}>
              {type === 'sell' ? 'Sell' : 'Buy'}{time > 0 ? ` · ${timeAgo(time)} ago` : ''}
            </span>
          </span>
          {sincePct !== null && (
            <span className={`tw-tweet-pnl-chip ${sinceUp ? 'pos' : 'neg'}`}>
              {sinceUp ? '+' : ''}{sincePct.toFixed(1)}% since
            </span>
          )}
        </div>
      </div>
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
  const { trackedWallets, untrackWallet } = useTrackedWallets();
  const { tradesByMint, tradesLoaded } = useTrackedTrades();
  const { connected: walletConnected } = useWallet();

  // All tracked wallets' trades, newest first — the "recent moves" timeline.
  const tradeFeed = useMemo(() => {
    const all = [];
    for (const list of tradesByMint.values()) all.push(...list);
    all.sort((a, b) => b.time - a.time);
    return all.slice(0, 60);
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

  return (
    <div className="tracked-view">
      <TopTabs
        activeFilter={activeFeed}
        onFilterChange={({ type }) => setActiveFeed(type)}
        customTabs={TRACKED_TABS}
      />

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
          <div className="tw-feed-scroller">
            {/* Tracked wallets strip — tap to open a profile, × to untrack */}
            <div className="tw-wallet-strip">
              {trackedWallets.map((w) => (
                <span key={w.address} className="tw-wallet-chip">
                  <span
                    className="tw-wallet-chip-main"
                    onClick={() => onWalletClick?.(w.address, { displayName: w.label })}
                    role="button"
                  >
                    <span className="tw-wallet-chip-avatar" style={{ background: gradientForWallet(w.address) }}>
                      <AnimalSilhouetteAvatar address={w.address} />
                    </span>
                    <span className="tw-wallet-chip-name">{w.label || buildWalletName(w.address)}</span>
                  </span>
                  <button
                    type="button"
                    className="tw-wallet-chip-x"
                    title="Stop tracking"
                    onClick={() => untrackWallet(w.address)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="tw-feed">
              {tradeFeed.length > 0 ? (
                tradeFeed.map((trade) => (
                  <TradeEventRow
                    key={`${trade.signature || trade.time}-${trade.walletAddress}-${trade.mint}`}
                    trade={trade}
                    walletLabel={labelByWallet.get(trade.walletAddress)}
                    currentPrice={livePrices.get(trade.mint) || 0}
                    onOpenProfile={onWalletClick}
                    onOpenPosition={onOpenPosition}
                  />
                ))
              ) : (
                <div className="tracked-empty tracked-empty--inline">
                  <p>{tradesLoaded ? 'No recent trades from your tracked wallets yet.' : 'Loading recent moves…'}</p>
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
            {favorites.map((coin) => (
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
  );
}

export default TrackedView;

