import React, { useState } from 'react';
import ModernTokenScroller from './ModernTokenScroller';
import TopTabs from './TopTabs';
import NotificationsFeed from './NotificationsFeed';
import { useWallet } from '../contexts/WalletContext';
import './FavoritesGrid.css';

function FavoritesGrid({ favorites = [], onCoinClick, onFavoritesChange }) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' or 'notifications'
  const { connected, connecting, connectWallet, walletAddress } = useWallet();

  const handleTabChange = ({ type }) => {
    setActiveTab(type);
  };

  // Show wallet connection prompt if not connected
  if (!connected) {
    return (
      <div className="favorites-empty wallet-required">
        <div className="empty-state">
          <p>Connect wallet to see notifications</p>
          <button 
            className="connect-wallet-button"
            onClick={connectWallet}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
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
          <div className="empty-icon">⭐</div>
          <h2>No Favorites Yet</h2>
          <p>Start following coins to see them here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-list-container">
      {/* Use TopTabs component with custom tabs for Favorites view */}
      <TopTabs
        activeFilter={activeTab}
        onFilterChange={handleTabChange}
        showFilterButton={false}
        isFilterActive={false}
        hasCustomFilters={false}
        customTabs={[
          { id: 'feed', label: 'Feed', icon: 'star' },
          { id: 'notifications', label: 'Notifications', icon: 'zap' }
        ]}
      />
      
      {/* Show content based on active tab */}
      {activeTab === 'feed' ? (
        <ModernTokenScroller
          onFavoritesChange={onFavoritesChange}
          favorites={favorites}
          filters={{}}
          onlyFavorites={true}
          onTradeClick={() => {}}
          onCurrentCoinChange={() => {}}
          advancedFilters={null}
          showFiltersButton={false}
        />
      ) : (
        <NotificationsFeed favorites={favorites} />
      )}
    </div>
  );
}

export default FavoritesGrid;
