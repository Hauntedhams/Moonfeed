import React from 'react';
import './FavoritesGrid.css';

function FavoritesGrid({ favorites = [], onCoinClick, onFavoritesChange }) {
  // Temporarily disable liquidity lock filter for testing
  const filteredFavorites = favorites; // .filter(coin => coin.liquidityLocked === true);
  
  // Helper to toggle favorite
  const toggleFavorite = (coin) => {
    console.log('Toggle favorite called for:', coin.symbol, coin.id);
    const updated = favorites.filter(fav => fav.id !== coin.id);
    console.log('Updated favorites list:', updated.length, 'items');
    if (onFavoritesChange) {
      onFavoritesChange(updated);
      console.log('onFavoritesChange called successfully');
    } else {
      console.warn('onFavoritesChange callback not provided');
    }
  };

  if (filteredFavorites.length === 0) {
    return (
      <div className="favorites-empty">
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <h2>No Favorites Yet</h2>
          <p>Start favoriting coins to see them here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-list-container">
      <div className="favorites-header">
        <h1>Your Favorites</h1>
        <p>{filteredFavorites.length} coin{filteredFavorites.length !== 1 ? 's' : ''} saved</p>
      </div>
      
      <div className="favorites-grid">
        {filteredFavorites.map((coin) => (
          <div 
            key={coin.id} 
            className="favorite-card"
            onClick={() => onCoinClick && onCoinClick(coin)}
            title="Click to view coin details"
          >
            {/* Remove button */}
            <button
              className="favorite-remove-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(coin);
              }}
              title="Remove from favorites"
              type="button"
            >
              ×
            </button>

            {/* Profile Image */}
            <div className="favorite-profile-container">
              <img 
                src={coin.profileImage || coin.profile || coin.logo || coin.image || '/profile-placeholder.svg'} 
                alt={coin.symbol || coin.name} 
                className="favorite-profile-image"
                onError={(e) => {
                  if (e.target.src.includes('profile-placeholder.svg')) {
                    return;
                  }
                  
                  const fallbacks = [
                    coin.profile,
                    coin.logo, 
                    coin.image,
                    '/profile-placeholder.svg'
                  ].filter(Boolean);
                  
                  const currentIndex = fallbacks.findIndex(url => e.target.src.includes(url));
                  const nextFallback = fallbacks[currentIndex + 1];
                  
                  if (nextFallback) {
                    e.target.src = nextFallback;
                  } else {
                    e.target.src = '/profile-placeholder.svg';
                  }
                }}
              />
            </div>

            {/* Coin Info */}
            <div className="favorite-coin-info">
              <div className="favorite-symbol">
                ${coin.symbol || 'Unknown'}
              </div>
              <div className="favorite-name">
                {coin.name || 'Unknown Coin'}
              </div>
            </div>

            {/* Stats */}
            <div className="favorite-stats">
              <div className="favorite-stat">
                <span className="favorite-stat-label">Price</span>
                <span className="favorite-stat-value">
                  {typeof coin.priceUsd === 'number' && !isNaN(coin.priceUsd)
                    ? `$${coin.priceUsd < 0.01 
                        ? coin.priceUsd.toFixed(6) 
                        : coin.priceUsd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}`
                    : '$0.00'}
                </span>
              </div>

              {typeof coin.priceChange24h === 'number' && !isNaN(coin.priceChange24h) && (
                <div className="favorite-stat">
                  <span className="favorite-stat-label">24h Change</span>
                  <span className={`favorite-stat-value ${coin.priceChange24h >= 0 ? 'positive' : 'negative'}`}>
                    {coin.priceChange24h > 0 ? '+' : ''}{coin.priceChange24h.toFixed(2)}%
                  </span>
                </div>
              )}

              <div className="favorite-stat">
                <span className="favorite-stat-label">Market Cap</span>
                <span className="favorite-stat-value">
                  {typeof coin.marketCap === 'number' && !isNaN(coin.marketCap)
                    ? coin.marketCap >= 1000000
                      ? `$${(coin.marketCap / 1000000).toFixed(2)}M`
                      : coin.marketCap >= 1000
                        ? `$${(coin.marketCap / 1000).toFixed(1)}K`
                        : `$${coin.marketCap.toFixed(0)}`
                    : '$0'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FavoritesGrid;
