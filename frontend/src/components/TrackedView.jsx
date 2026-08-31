import React, { useState } from 'react';
import TopTabs from './TopTabs';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { useWallet } from '../contexts/WalletContext';
import WalletConnectOnboarding from './WalletConnectOnboarding';
import { WalletChip } from '../utils/walletIdentity';
import './TrackedView.css';

const TRACKED_TABS = [
  { id: 'wallets', label: 'Wallets', icon: 'users' },
  { id: 'coins', label: 'Coins', icon: 'star' },
];

const timeAgo = (ts) => {
  if (!ts) return '';
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatPrice = (price) => {
  const n = Number(price);
  if (!n) return null;
  if (n < 0.00001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
};

const formatCompact = (num) => {
  const n = Number(num);
  if (!n) return null;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

/**
 * "Tracked" tab: two list views — tracked wallets and tracked coins.
 * Tapping a row opens the full wallet profile / coin detail page.
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
  const { connected: walletConnected } = useWallet();

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
          <div className="tracked-list-scroller">
            <div className="tracked-list">
              {trackedWallets.map((wallet) => (
                <button
                  key={wallet.address}
                  type="button"
                  className="tracked-list-row"
                  onClick={() => onWalletClick?.(wallet.address, { displayName: wallet.label })}
                >
                  <WalletChip address={wallet.address} size={44} />
                  <span className="tracked-list-row-meta">
                    {wallet.addedAt && <span className="tracked-list-row-sub">Tracked {timeAgo(wallet.addedAt)}</span>}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="tracked-list-row-remove"
                    title="Stop tracking"
                    onClick={(e) => { e.stopPropagation(); untrackWallet(wallet.address); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); untrackWallet(wallet.address); } }}
                  >
                    ×
                  </span>
                </button>
              ))}
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
        <div className="tracked-list-scroller">
          <div className="tracked-list">
            {favorites.map((coin) => {
              const mint = coin.mintAddress || coin.address;
              const price = formatPrice(coin.price_usd || coin.priceUsd || coin.price);
              const change = Number(coin.priceChange24h ?? coin.change_24h ?? coin.priceChanges?.h24) || 0;
              const trackedAt = formatPrice(coin.trackedAtPrice);
              const image = coin.image || coin.logo || coin.profileImage;
              return (
                <button
                  key={mint}
                  type="button"
                  className="tracked-list-row tracked-coin-row"
                  onClick={() => onCoinSelect?.(coin)}
                >
                  <span className="tracked-coin-avatar">
                    {image ? <img src={image} alt="" loading="lazy" /> : <span className="tracked-coin-avatar-egg">🥚</span>}
                  </span>
                  <span className="tracked-list-row-meta">
                    <span className="tracked-coin-title">
                      <strong>{coin.symbol || coin.name || 'Unknown'}</strong>
                      {change !== 0 && (
                        <em className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</em>
                      )}
                    </span>
                    <span className="tracked-list-row-sub">
                      {price && <span>{price}</span>}
                      {price && trackedAt && <span className="dot">·</span>}
                      {trackedAt && <span>Tracked at {trackedAt}</span>}
                      {!price && !trackedAt && coin.market_cap_usd && <span>MC {formatCompact(coin.market_cap_usd)}</span>}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="tracked-list-row-remove"
                    title="Stop tracking this coin"
                    onClick={(e) => handleRemoveCoin(e, coin)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRemoveCoin(e, coin); }}
                  >
                    ×
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackedView;

