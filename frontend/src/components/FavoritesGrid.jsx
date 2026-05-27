import React, { useState, useEffect } from 'react';
import TopTabs from './TopTabs';
import NotificationsFeed from './NotificationsFeed';
import { useWallet } from '../contexts/WalletContext';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import './FavoritesGrid.css';

function FavoritesGrid({ favorites = [], onCoinClick, onFavoritesChange }) {
  const [activeTab, setActiveTab] = useState('feed');
  const { connected, walletAddress } = useWallet();
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

  if (favorites.length === 0) {
    return (
      <div className="favorites-empty">
        <div className="empty-state">
          <div className="wallet-connected-badge">
            <span className="wallet-icon-small">👛</span>
            <span className="wallet-address">{walletAddress.substring(0, 4)}...{walletAddress.substring(walletAddress.length - 4)}</span>
          </div>
          <div className="empty-icon">♥</div>
          <h2>No Favorites Yet</h2>
          <p>Heart coins to save them here!</p>
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
          { id: 'notifications', label: 'Notifications', icon: 'zap' }
        ]}
      />

      {activeTab === 'feed' ? (
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
      ) : (
        <NotificationsFeed favorites={favorites} />
      )}
    </div>
  );
}

export default FavoritesGrid;
