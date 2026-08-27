import React, { useState, useEffect, useRef } from 'react';
import { API_CONFIG } from '../config/api';
import './FeedSelector.css';

// Feed definitions (kept in sync with the old TopTabs base tabs)
export const BASE_FEEDS = [
  { id: 'dextrending', label: 'DEXtrending', detail: 'Dexscreener + CoinGecko hot pools', icon: 'trending-up' },
  { id: 'whalefeed', label: 'Whale', detail: 'Large, liquid multi-source picks', icon: 'whale' },
  { id: 'graduating', label: 'Graduating', detail: 'Pump.fun bonding-curve launches', icon: 'graduation-cap' },
  { id: 'new', label: 'New', detail: 'Fresh Solana Tracker launches', icon: 'sparkles' },
  { id: 'trending', label: 'Trending', detail: 'Solana Tracker momentum leaders', icon: 'fire' }
];

export const FEED_ORDER = BASE_FEEDS.map((feed) => feed.id);

const CUSTOM_FEED = { id: 'custom', label: 'Custom', detail: 'Your saved market filters', icon: 'filter' };

// Per-feed explainer shown in the expandable info drawer.
const FEED_INFO = {
  dextrending: {
    purpose: 'Hot Solana coins selected from a broader multi-source pool, with new and rising DEX activity prioritized.',
    sources: 'Dexscreener (boosted, latest, profiles and keyword searches) plus CoinGecko Onchain trending and new Solana pools.',
    reason: 'Candidates are deduped by mint and ranked by liquidity, volume, activity and age so a coin appearing across sources has a stronger signal.'
  },
  whalefeed: {
    purpose: 'The blue-chip meme coins — large, established tokens with deep liquidity and proven staying power.',
    sources: 'Built from the same Dexscreener + CoinGecko Onchain candidate pool as DEXtrending, filtered to big established pairs.',
    reason: 'Preset gates for liquidity ≥ $250k, volume ≥ $200k, market cap ≥ $1M and age ≥ 24h (no upper age cap) so you only see coins that have survived and stayed liquid.'
  },
  graduating: {
    purpose: 'Pump.fun tokens on the bonding curve that are close to graduating to a full DEX listing on Raydium.',
    sources: 'Pump.fun bonding-curve data.',
    reason: 'As SOL is deposited these tokens climb toward 100% completion — this preset catches them right before they graduate, a key moment for early entries.'
  },
  new: {
    purpose: 'The freshest launches — tokens created very recently with strong early trading.',
    sources: 'Recent Solana launches via Solana Tracker.',
    reason: 'Preset prioritizes tokens under ~48h old with real early volume so you can find opportunities at the earliest stage.'
  },
  trending: {
    purpose: 'Tokens with strong overall momentum — high volume, growing holders and positive price action.',
    sources: 'Solana Tracker trending data, enriched with live prices.',
    reason: 'Preset ranks on sustained trading activity and momentum so you see coins the market is actively rallying behind.'
  },
  custom: {
    purpose: 'Your own filtered feed built from the criteria you choose.',
    sources: 'Applies your filters across our full token pool.',
    reason: 'Use this when the presets don’t match what you’re looking for and you want full control.'
  }
};

// Small inline icon renderer (matches the old TopTabs icon set)
const renderIcon = (iconName) => {
  const iconProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  switch (iconName) {
    case 'sparkles':
      return (
        <svg {...iconProps}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          <path d="M5 3v4" />
          <path d="M19 17v4" />
          <path d="M3 5h4" />
          <path d="M17 19h4" />
        </svg>
      );
    case 'graduation-cap':
      return (
        <svg {...iconProps}>
          <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
          <path d="M22 10v6" />
          <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
        </svg>
      );
    case 'fire':
      return (
        <svg {...iconProps}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case 'trending-up':
      return (
        <svg {...iconProps}>
          <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
          <polyline points="16,7 22,7 22,13" />
        </svg>
      );
    case 'whale':
      return (
        <svg {...iconProps}>
          <path d="M3 11c2 0 3 1.5 5 1.5S11 11 13 11s3 1.5 5 1.5c1.5 0 2.2-.8 3-1.5" />
          <path d="M3 11c0-4 3-7 8-7 4 0 7 2.5 8 6" />
          <path d="M11 4c1 1.5 1.5 3 1.5 5" />
          <path d="M20 15c0 3-2 5-5 5-2 0-3.5-1-4.5-2.5" />
        </svg>
      );
    case 'filter':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 4.5H21V6H3V4.5ZM6 10.5H18V12H6V10.5ZM9 16.5H15V18H9V16.5Z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
};

const formatNumber = (num) => {
  if (!num) return 'N/A';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatPrice = (price) => {
  if (!price) return '$0.00';
  if (price < 0.00001) return `$${price.toExponential(2)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(4)}`;
};

// Avatar that falls back to an egg when a token has no (or a broken) image.
// Self-contained error state avoids the flashing caused by onError src swaps.
function TokenAvatar({ src, alt }) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;
  return (
    <div className="feed-selector-result-img">
      {showImg ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setErrored(true)} />
      ) : (
        <span className="feed-selector-result-egg" role="img" aria-label="no image">🥚</span>
      )}
    </div>
  );
}

/**
 * FeedSelector — a single pill in the top-right that combines feed switching
 * and token search. Tapping the pill opens a dropdown to scroll through the
 * different feeds and search for any token.
 */
function FeedSelector({
  activeFilter,
  onFilterChange,
  onCoinSelect,
  hasCustomFilters = false,
  onAdvancedFilterClick,
  onFeedListOpen
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [expandedInfo, setExpandedInfo] = useState(null);
  const rootRef = useRef(null);

  const feeds = hasCustomFilters ? [...BASE_FEEDS, CUSTOM_FEED] : BASE_FEEDS;
  const activeFeed = feeds.find((f) => f.id === activeFilter) || BASE_FEEDS[0];
  const orderedFeeds = [activeFeed, ...feeds.filter((feed) => feed.id !== activeFeed.id)];

  const API_ROOT = API_CONFIG.BASE_URL;

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
        setError(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  // Reset search state when closing
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setExpandedInfo(null);
    }
  }, [open]);

  const handleSearch = async () => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ query: cleanQuery, sort: 'liquidity' });
      const response = await fetch(`${API_ROOT}/api/search?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.results) {
        setSearchResults(data.results);
        if (data.results.length === 0) {
          setError('No tokens found. Try a different search term.');
        }
      } else {
        throw new Error(data.error || 'Search failed. Please try again.');
      }
    } catch (err) {
      console.error('❌ Search error:', err);
      setError(err.message || 'Search failed. Please check your connection and try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = async (tokenData) => {
    const coinData = {
      ...tokenData,
      id: tokenData.mintAddress || tokenData.mint || tokenData.id,
      tokenAddress: tokenData.mintAddress || tokenData.mint || tokenData.tokenAddress,
      mintAddress: tokenData.mintAddress || tokenData.mint,
      symbol: tokenData.symbol,
      name: tokenData.name,
      image: tokenData.image || tokenData.profilePic,
      priceUsd: tokenData.priceUsd || tokenData.price,
      marketCap: tokenData.marketCap,
      description: tokenData.description
    };

    setOpen(false);

    try {
      const response = await fetch(`${API_ROOT}/api/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin: coinData })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (onCoinSelect) onCoinSelect(data.coin);
        } else if (onCoinSelect) {
          onCoinSelect(coinData);
        }
      } else if (onCoinSelect) {
        onCoinSelect(coinData);
      }
    } catch (enrichError) {
      console.error('❌ Enrichment error, showing basic data:', enrichError);
      if (onCoinSelect) onCoinSelect(coinData);
    }
  };

  const handleFeedSelect = (feedId) => {
    if (feedId !== activeFilter) {
      onFilterChange({ type: feedId });
    }
    setOpen(false);
  };

  const handleFeedListOpen = (feedId) => {
    onFeedListOpen?.(feedId);
    setOpen(false);
  };

  return (
    <div className="feed-selector" ref={rootRef}>
      {/* Search button */}
      <button
        className={`feed-selector-search-button ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Search tokens and browse feeds"
        title="Search tokens and browse feeds"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="feed-selector-dropdown">
          {/* Search bar */}
          <div className="feed-selector-search">
            <svg
              className="feed-selector-search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="feed-selector-search-input"
              placeholder="Search any token..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
            />
            {loading && <div className="feed-selector-spinner" />}
            {searchQuery && !loading && (
              <button
                className="feed-selector-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setError(null);
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {error && <div className="feed-selector-error">{error}</div>}

          {/* Search results OR feed list */}
          {searchQuery.trim().length >= 2 ? (
            <div className="feed-selector-results">
              {searchResults.map((token, index) => (
                <button
                  key={token.mint || token.mintAddress || index}
                  className="feed-selector-result"
                  onClick={() => handleResultClick(token)}
                >
                  <TokenAvatar
                    src={token.image || token.logo || null}
                    alt={token.name || token.symbol}
                  />
                  <div className="feed-selector-result-info">
                    <div className="feed-selector-result-top">
                      <span className="feed-selector-result-name">{token.name || 'Unknown Token'}</span>
                      <span className="feed-selector-result-symbol">${token.symbol || 'UNKNOWN'}</span>
                    </div>
                    <div className="feed-selector-result-stats">
                      <span>{formatPrice(token.price)}</span>
                      <span className="dot">·</span>
                      <span>MC {formatNumber(token.marketCap)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="feed-selector-feeds">
              <div className="feed-selector-section-label">Feeds</div>
              {orderedFeeds.map((feed) => {
                const info = FEED_INFO[feed.id];
                const infoOpen = expandedInfo === feed.id;
                return (
                  <div key={feed.id} className="feed-selector-feed-row">
                    <div className={`feed-selector-feed ${feed.id === activeFilter ? 'active' : ''}`}>
                      <button
                        className="feed-selector-feed-select"
                        onClick={() => handleFeedListOpen(feed.id)}
                      >
                        <span className="feed-selector-feed-icon">{renderIcon(feed.icon)}</span>
                        <span className="feed-selector-feed-copy">
                          <span className="feed-selector-feed-label">{feed.label}</span>
                          <span className="feed-selector-feed-detail">{feed.detail}</span>
                        </span>
                      </button>
                      <button
                        className="feed-selector-switch-feed"
                        onClick={() => handleFeedSelect(feed.id)}
                        aria-label={`${feed.id === activeFilter ? `${feed.label} is selected` : `Switch to ${feed.label}`}`}
                        title={feed.id === activeFilter ? `${feed.label} selected` : `Switch to ${feed.label}`}
                      >
                        {feed.id === activeFilter ? (
                          <svg
                            className="feed-selector-check"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg
                            className="feed-selector-info-chevron"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        )}
                      </button>
                      {info && (
                        <button
                          className="feed-selector-info-toggle"
                          onClick={() => setExpandedInfo(infoOpen ? null : feed.id)}
                          aria-label={`About ${feed.label} feed`}
                          aria-expanded={infoOpen}
                        >
                          <svg
                            className={`feed-selector-info-chevron ${infoOpen ? 'up' : ''}`}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {info && infoOpen && (
                      <div className="feed-selector-info-drawer">
                        <p className="feed-selector-info-line">
                          <span className="feed-selector-info-tag">What it is</span>
                          {info.purpose}
                        </p>
                        <p className="feed-selector-info-line">
                          <span className="feed-selector-info-tag">Sources</span>
                          {info.sources}
                        </p>
                        <p className="feed-selector-info-line">
                          <span className="feed-selector-info-tag">Why this preset</span>
                          {info.reason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {onAdvancedFilterClick && (
                <button
                  className="feed-selector-feed feed-selector-filter-row"
                  onClick={() => {
                    onAdvancedFilterClick();
                    setOpen(false);
                  }}
                >
                  <span className="feed-selector-feed-icon">{renderIcon('filter')}</span>
                  <span className="feed-selector-feed-label">Custom Filters</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FeedSelector;
