import React, { useState, useEffect, useMemo } from 'react';
import TopTabs from './TopTabs';
import NotificationsFeed from './NotificationsFeed';
import { useWallet } from '../contexts/WalletContext';
import { useDemoMode } from '../contexts/DemoModeContext';
import { useAlerts } from '../contexts/AlertsContext';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { useCopyTrade } from '../contexts/CopyTradeContext';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import WalletConnectOnboarding from './WalletConnectOnboarding';
import { getTransactions } from '../utils/transactionStorage';
import './FavoritesGrid.css';

function FavoritesGrid({ favorites = [], onCoinClick, onFavoritesChange, onSetupOrder, onWalletClick }) {
  const [activeTab, setActiveTab] = useState('all');
  const { connected: walletConnected, walletAddress: walletAddr } = useWallet();
  const { isDemoMode, demoWalletAddress } = useDemoMode();
  const { notifications: alertNotifs, markAllRead } = useAlerts();
  const { trackedWallets, untrackWallet, toggleCopyTrade } = useTrackedWallets();
  const { queue: copyTradeQueue, copyTrade } = useCopyTrade();
  const connected = isDemoMode || walletConnected;
  const walletAddress = isDemoMode ? demoWalletAddress : walletAddr;
  const [transactions, setTransactions] = useState([]);
  // Map of mintAddress -> { priceChange: {h1,h6,h24}, banner: string|null }
  const [liveData, setLiveData] = useState(new Map());

  // Fetch live price + banner from Dexscreener for all favorited coins
  useEffect(() => {
    if (!favorites.length) return;
    const mints = favorites
      .map(f => f.mintAddress || f.address)
      .filter(Boolean);
    if (!mints.length) return;

    let cancelled = false;
    const fetchAll = async () => {
      await Promise.all(mints.map(async (mint) => {
        try {
          const res = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${mint}`
          );
          if (!res.ok) return;
          const data = await res.json();
          const pair = data?.pairs?.[0];
          if (!pair || cancelled) return;
          const banner = pair.info?.header || pair.info?.imageUrl || null;
          const priceChange = pair.priceChange || null; // {m5, h1, h6, h24}
          setLiveData(prev => new Map(prev).set(mint, { banner, priceChange }));
        } catch (_) { /* silent */ }
      }));
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [favorites.map(f => f.mintAddress || f.address).join(',')]);

  const handleTabChange = ({ type }) => setActiveTab(type);

  // Clear the unread badge whenever alerts become visible (All or Alerts tab)
  useEffect(() => {
    if (activeTab === 'all' || activeTab === 'notifications') {
      markAllRead();
    }
  }, [activeTab, markAllRead]);

  // Load trade history whenever wallet changes or history tab is opened
  useEffect(() => {
    if (walletAddress) {
      setTransactions(getTransactions(walletAddress));
    } else {
      setTransactions([]);
    }
  }, [walletAddress, activeTab]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const secs = Math.floor((Date.now() - timestamp) / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleRemoveFavorite = (e, coin) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f =>
      (f.mintAddress || f.address) !== (coin.mintAddress || coin.address)
    );
    onFavoritesChange?.(newFavs);
  };

  const getPriceDirection = (coin) => {
    const mint = coin.mintAddress || coin.address;
    const live = liveData.get(mint);
    const changes = live?.priceChange || coin.priceChange || coin.priceChanges;
    if (!changes) return 'neutral';
    const val = changes.h1 ?? changes.h6 ?? changes.h24 ?? changes.m5 ?? null;
    if (val === null) return 'neutral';
    return val >= 0 ? 'up' : 'down';
  };

  const formatPriceChange = (coin) => {
    const mint = coin.mintAddress || coin.address;
    const live = liveData.get(mint);
    const changes = live?.priceChange || coin.priceChange || coin.priceChanges;
    if (!changes) return null;
    const val = changes.h1 ?? changes.h6 ?? changes.h24 ?? changes.m5 ?? null;
    if (val === null) return null;
    return (val >= 0 ? '+' : '') + Number(val).toFixed(2) + '%';
  };

  // Merged, recency-sorted activity feed combining triggered alerts, trade
  // history and saved coins into a single Instagram-style list.
  const feedItems = useMemo(() => {
    const items = [];

    (alertNotifs || []).forEach((n) => {
      items.push({
        id: n.id,
        kind: 'alert',
        timestamp: n.timestamp || 0,
        coin: n.coin || {},
        level: n.level,
        message: n.message,
      });
    });

    (transactions || []).forEach((tx) => {
      items.push({
        id: `tx-${tx.signature}`,
        kind: 'trade',
        timestamp: tx.timestamp || 0,
        tx,
      });
    });

    favorites.forEach((coin, idx) => {
      const mint = coin.mintAddress || coin.address;
      // Older favorites have no savedAt — fall back to array order so the most
      // recently added still surface above them.
      const ts = coin.savedAt || idx + 1;
      items.push({
        id: `saved-${mint || idx}`,
        kind: 'saved',
        timestamp: ts,
        coin,
      });
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [alertNotifs, transactions, favorites]);

  // Group feed items into Instagram-style time buckets (Today / Yesterday / Earlier)
  const groupedFeed = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const groups = { Today: [], Yesterday: [], Earlier: [] };
    feedItems.forEach((item) => {
      // Fallback ordinal timestamps (small ints) count as "Earlier"
      if (item.timestamp >= startOfToday) groups.Today.push(item);
      else if (item.timestamp >= startOfYesterday) groups.Yesterday.push(item);
      else groups.Earlier.push(item);
    });
    return groups;
  }, [feedItems]);

  const coinFromItem = (item) => {
    if (item.kind === 'trade') {
      return {
        mintAddress: item.tx.tokenMint,
        symbol: item.tx.tokenSymbol,
        name: item.tx.tokenName,
        image: item.tx.tokenImage,
      };
    }
    return item.coin;
  };

  const renderFeedRow = (item) => {
    const coin = coinFromItem(item);
    const symbol = coin.symbol || '??';
    const name = coin.name || '';
    const image = coin.profileImage || coin.image || coin.tokenImage || null;

    let icon = '★';
    let iconColor = '#f59e0b';
    let message = null;

    if (item.kind === 'alert') {
      const up = item.level > 0;
      icon = up ? '▲' : '▼';
      iconColor = up ? '#22c55e' : '#ef4444';
      message = item.message;
    } else if (item.kind === 'trade') {
      const isSell = item.tx.type === 'sell';
      icon = isSell ? '↑' : '↓';
      iconColor = isSell ? '#ef4444' : '#22c55e';
      message = isSell
        ? `sold for ${Number(item.tx.outputAmount || 0).toFixed(4)} SOL`
        : `bought for ${Number(item.tx.inputAmount || 0).toFixed(4)} SOL`;
    } else {
      icon = '★';
      iconColor = '#f59e0b';
      message = 'saved to your favorites';
    }

    return (
      <div key={item.id} className={`feed-row feed-row--${item.kind}`} onClick={() => onCoinClick?.(coin)}>
        <div className="feed-row-icon" style={{ background: `${iconColor}18`, color: iconColor }}>
          {icon}
        </div>
        <div className="feed-row-avatar-wrap">
          {image ? (
            <img
              src={image}
              alt={symbol}
              className="feed-row-avatar"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div className="feed-row-avatar feed-row-avatar--placeholder" style={{ display: image ? 'none' : 'flex' }}>
            {symbol.slice(0, 2)}
          </div>
        </div>
        <div className="feed-row-body">
          <div className="feed-row-title">
            <span className="feed-row-symbol">{symbol}</span>
            {name && <span className="feed-row-name">{name}</span>}
          </div>
          <div className="feed-row-message">{message}</div>
        </div>
        <div className="feed-row-right">
          <span className="feed-row-time">{formatTimeAgo(item.timestamp > 100000 ? item.timestamp : null) || ''}</span>
          {item.kind === 'alert' && onSetupOrder && (
            <button
              className="feed-row-order-btn"
              onClick={(e) => { e.stopPropagation(); onSetupOrder(coin, item.level); }}
            >
              Set up order
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!connected) {
    return (
      <div className="favorites-empty wallet-required">
        <div className="empty-state">
          <p>Connect wallet to see notifications</p>
          <div className="wallet-button-container">
            <WalletConnectOnboarding>
              <UnifiedWalletButton />
            </WalletConnectOnboarding>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-list-container">
      <TopTabs
        activeFilter={activeTab}
        onFilterChange={handleTabChange}
        showFilterButton={false}
        isFilterActive={false}
        hasCustomFilters={false}
        customTabs={[
          { id: 'all', label: 'All', icon: 'sparkles' },
          { id: 'feed', label: 'Saved', icon: 'star' },
          { id: 'copytrades', label: 'Tracked', icon: 'users' },
          { id: 'history', label: 'History', icon: 'clock' },
          { id: 'notifications', label: 'Alerts', icon: 'zap' },
        ]}
      />

      {activeTab === 'all' ? (
        feedItems.length === 0 ? (
          <div className="fav-grid-scroll">
            <div className="fav-empty-inline">
              <div className="empty-icon">✦</div>
              <h2>Nothing here yet</h2>
              <p>Follow coins and set price alerts to see activity here</p>
            </div>
          </div>
        ) : (
          <div className="fav-grid-scroll">
            <div className="feed-list">
              {['Today', 'Yesterday', 'Earlier'].map((section) =>
                groupedFeed[section].length > 0 ? (
                  <div key={section} className="feed-section">
                    <div className="feed-section-title">{section}</div>
                    {groupedFeed[section].map((item) => renderFeedRow(item))}
                  </div>
                ) : null
              )}
            </div>
          </div>
        )
      ) : activeTab === 'feed' ? (
        favorites.length === 0 ? (
          <div className="fav-grid-scroll">
            <div className="fav-empty-inline">
              <div className="empty-icon">♥</div>
              <h2>No Favorites Yet</h2>
              <p>Heart coins to save them here!</p>
            </div>
          </div>
        ) : (
        <div className="fav-grid-scroll">
          <div className="fav-grid">
            {favorites.map((coin) => {
              const mint = coin.mintAddress || coin.address;
              const symbol = coin.symbol || coin.baseToken?.symbol || '??';
              const name = coin.name || coin.baseToken?.name || '';
              const image = coin.image || coin.tokenImage || coin.baseToken?.image || null;
              // Prefer live banner, fallback to stored banner
              const liveMeta = liveData.get(mint);
              const banner = liveMeta?.banner || coin.banner || coin.tokenBannerImage || null;
              const direction = getPriceDirection(coin);
              const changeLabel = formatPriceChange(coin);

              return (
                <div
                  key={mint || symbol}
                  className={`fav-card fav-card--${direction}`}
                  onClick={() => onCoinClick?.(coin)}
                >
                  {/* Blurred banner background */}
                  {banner && (
                    <img
                      src={banner}
                      alt=""
                      className="fav-card-bg"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="fav-card-overlay" />

                  {/* Top row: profile pic + remove */}
                  <div className="fav-card-top">
                    <div className="fav-card-avatar-wrap">
                      {image ? (
                        <img
                          src={image}
                          alt={symbol}
                          className="fav-card-avatar"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="fav-card-avatar fav-card-avatar--placeholder"
                        style={{ display: image ? 'none' : 'flex' }}
                      >
                        {symbol.slice(0, 2)}
                      </div>
                    </div>
                    <button
                      className="fav-card-remove"
                      onClick={(e) => handleRemoveFavorite(e, coin)}
                      title="Remove from favorites"
                    >
                      ×
                    </button>
                  </div>

                  {/* Coin name row */}
                  <div className="fav-card-info">
                    <span className="fav-card-symbol">{symbol}</span>
                    <span className="fav-card-name">{name}</span>
                  </div>

                  {/* Price change pill */}
                  <div className={`fav-card-change fav-card-change--${direction}`}>
                    {changeLabel ?? (liveMeta ? '—' : '…')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )
      ) : activeTab === 'copytrades' ? (
        <div className="fav-grid-scroll">
          {trackedWallets.length === 0 ? (
            <div className="fav-empty-inline">
              <div className="empty-icon">👥</div>
              <h2>No Copy Trades Yet</h2>
              <p>Tap any wallet in the feed and enable "Copy Trades" to track it here</p>
            </div>
          ) : (
            <>
            {copyTradeQueue.length > 0 && (
              <div className="tracked-trade-section">
                <div className="tracked-trade-heading">Recent Trades</div>
                <div className="tracked-trade-list">
                  {copyTradeQueue.map((trade) => (
                    <div key={trade.id} className={`tracked-trade-row tracked-trade-row--${trade.type}`}>
                      <div className="tracked-trade-main">
                        <div className="tracked-trade-topline">
                          <span className="tracked-trade-wallet">{trade.walletLabel}</span>
                          <span className={`tracked-trade-badge tracked-trade-badge--${trade.type}`}>
                            {trade.type === 'sell' ? 'SELL' : 'BUY'}
                          </span>
                        </div>
                        <div className="tracked-trade-detail">
                          <strong>{trade.tokenSymbol || 'Unknown token'}</strong>
                          <span>
                            {trade.type === 'sell' ? 'sold for' : 'bought for'}{' '}
                            {Number(trade.solAmount || 0).toFixed(4)} SOL
                          </span>
                        </div>
                        <span className="tracked-trade-time">{formatTimeAgo((trade.timestamp || 0) * 1000)}</span>
                      </div>
                      <button
                        className="tracked-trade-copy-btn"
                        onClick={() => copyTrade(trade)}
                      >
                        Copy Trade
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="copytrade-list">
              {trackedWallets.map((w) => {
                const copyOn = w.copyTradeEnabled !== false;
                return (
                  <div
                    key={w.address}
                    className="copytrade-row"
                    onClick={() => onWalletClick?.(w.address)}
                  >
                    <div className="copytrade-avatar">
                      {w.address.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="copytrade-info">
                      <span className="copytrade-label">{w.label}</span>
                      <span className="copytrade-addr">
                        {w.address.slice(0, 5)}…{w.address.slice(-5)}
                      </span>
                    </div>
                    <div className="copytrade-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`copytrade-toggle ${copyOn ? 'copytrade-toggle--on' : 'copytrade-toggle--off'}`}
                        onClick={() => toggleCopyTrade(w.address)}
                        title={copyOn ? 'Copy trading on — tap to disable' : 'Copy trading off — tap to enable'}
                        aria-pressed={copyOn}
                      >
                        <span className="copytrade-toggle-track">
                          <span className="copytrade-toggle-thumb" />
                        </span>
                      </button>
                      <button
                        className="copytrade-remove"
                        onClick={() => untrackWallet(w.address)}
                        title="Stop tracking this wallet"
                        aria-label="Stop tracking"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      ) : activeTab === 'history' ? (
        <div className="fav-grid-scroll">
          {transactions.length === 0 ? (
            <div className="fav-empty-inline">
              <div className="empty-icon">📋</div>
              <h2>No Trade History</h2>
              <p>Coins you buy through Moonfeed will appear here</p>
            </div>
          ) : (
            <div className="history-list">
              {transactions.map((tx) => (
                <div
                  key={tx.signature}
                  className="history-item"
                  onClick={() => onCoinClick?.({
                    mintAddress: tx.tokenMint,
                    symbol: tx.tokenSymbol,
                    name: tx.tokenName,
                    image: tx.tokenImage,
                  })}
                >
                  <div className="history-item-avatar">
                    {tx.tokenImage ? (
                      <img
                        src={tx.tokenImage}
                        alt={tx.tokenSymbol}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="history-item-avatar-placeholder"
                      style={{ display: tx.tokenImage ? 'none' : 'flex' }}
                    >
                      {(tx.tokenSymbol || '?').slice(0, 2)}
                    </div>
                  </div>
                  <div className="history-item-info">
                    <span className="history-item-symbol">{tx.tokenSymbol || 'Unknown'}</span>
                    <span className="history-item-name">{tx.tokenName || ''}</span>
                  </div>
                  <div className="history-item-right">
                    <span className={`history-item-type history-item-type--${tx.type || 'buy'}`}>
                      {tx.type === 'sell' ? '↑ Sell' : '↓ Buy'}
                    </span>
                    <span className="history-item-amount">
                      {tx.type === 'sell'
                        ? `+${Number(tx.outputAmount || 0).toFixed(4)} SOL`
                        : `-${Number(tx.inputAmount || 0).toFixed(4)} SOL`}
                    </span>
                    <span className="history-item-time">{formatTimeAgo(tx.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <NotificationsFeed favorites={favorites} />
      )}
    </div>
  );
}

export default FavoritesGrid;
