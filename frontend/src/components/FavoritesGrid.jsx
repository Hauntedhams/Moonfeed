import React, { useState, useEffect } from 'react';
import TopTabs from './TopTabs';
import NotificationsFeed from './NotificationsFeed';
import { useWallet } from '../contexts/WalletContext';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { getTransactions } from '../utils/transactionStorage';
import './FavoritesGrid.css';

function FavoritesGrid({ favorites = [], onCoinClick, onFavoritesChange }) {
  const [activeTab, setActiveTab] = useState('feed');
  const { connected, walletAddress } = useWallet();
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

  if (!connected) {
    return (
      <div className="favorites-empty wallet-required">
        <div className="empty-state">
          <p>Connect wallet to see notifications</p>
          <div className="wallet-button-container">
            <UnifiedWalletButton />
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
          { id: 'feed', label: 'Saved', icon: 'star' },
          { id: 'history', label: 'History', icon: 'clock' },
          { id: 'notifications', label: 'Alerts', icon: 'zap' },
        ]}
      />

      {activeTab === 'feed' ? (
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
