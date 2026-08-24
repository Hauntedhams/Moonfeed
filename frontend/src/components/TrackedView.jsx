import React, { useCallback, useRef, useState } from 'react';
import TopTabs from './TopTabs';
import ModernTokenScroller from './ModernTokenScroller';
import TrackedWalletCard from './TrackedWalletCard';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import './TrackedView.css';

const TRACKED_TABS = [
  { id: 'wallets', label: 'Wallets', icon: 'users' },
  { id: 'coins', label: 'Coins', icon: 'star' },
];

/**
 * "Tracked" tab: two swipeable feeds — tracked wallets (analytics + mimic their
 * latest trade) and tracked coins (standard coin cards).
 */
function TrackedView({
  favorites = [],
  onFavoritesChange,
  onTradeClick,
  onWalletClick,
  onCurrentCoinChange,
}) {
  const [activeFeed, setActiveFeed] = useState('wallets');
  const { trackedWallets, untrackWallet } = useTrackedWallets();
  const walletsRef = useRef(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const handleWalletScroll = useCallback(() => {
    const el = walletsRef.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / el.clientHeight);
    setVisibleIndex((prev) => (prev === index ? prev : index));
  }, []);

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
            <span className="tracked-empty-icon">👛</span>
            <h3>No tracked wallets</h3>
            <p>Tap a trader's wallet anywhere in the app and hit “Track Wallet” to follow their moves here.</p>
          </div>
        ) : (
          <div className="tracked-wallets-scroller" ref={walletsRef} onScroll={handleWalletScroll}>
            {trackedWallets.map((wallet, index) => (
              <div className="tracked-wallet-slide" key={wallet.address}>
                <TrackedWalletCard
                  wallet={wallet}
                  shouldLoad={Math.abs(index - visibleIndex) <= 1}
                  onOpenProfile={onWalletClick}
                  onMimicTrade={(coin, trade) =>
                    onTradeClick?.(coin, trade?.type === 'sell' ? { side: 'sell' } : {})
                  }
                  onUntrack={untrackWallet}
                />
              </div>
            ))}
          </div>
        )
      ) : favorites.length === 0 ? (
        <div className="tracked-empty">
          <span className="tracked-empty-icon">⭐</span>
          <h3>No tracked coins</h3>
          <p>Hit “Track” on any coin card and it will show up in this feed.</p>
        </div>
      ) : (
        <ModernTokenScroller
          favorites={favorites}
          onlyFavorites={true}
          onFavoritesChange={onFavoritesChange}
          filters={{}}
          onTradeClick={onTradeClick}
          onWalletClick={onWalletClick}
          onCurrentCoinChange={onCurrentCoinChange}
          advancedFilters={null}
          onSearchClick={null}
        />
      )}
    </div>
  );
}

export default TrackedView;
