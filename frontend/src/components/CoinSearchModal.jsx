import React, { useState, useEffect } from 'react';
import { API_CONFIG } from '../config/api';
import './CoinSearchModal.css';

function resolveApiBase() {
  return API_CONFIG.BASE_URL;
}

function CoinSearchModal({ visible, onClose, onCoinSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    verifiedOnly: false,
    excludeSuspicious: false,
    minLiquidity: '',
    sortBy: 'liquidity' // liquidity, marketCap, holders, price
  });

  // Use same base resolution as TokenScroller
  const API_ROOT = resolveApiBase();

  // Handle search with debounce
  useEffect(() => {
    if (!visible) return;
    
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
        setError(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, visible]);

  // Handle search input using Jupiter Ultra API
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const cleanQuery = searchQuery.trim();

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Searching Jupiter Ultra for:', cleanQuery);

      // Build query params
      const params = new URLSearchParams({
        query: cleanQuery
      });

      if (filters.verifiedOnly) params.append('verifiedOnly', 'true');
      if (filters.excludeSuspicious) params.append('excludeSuspicious', 'true');
      if (filters.minLiquidity) params.append('minLiquidity', filters.minLiquidity);
      if (filters.sortBy) params.append('sort', filters.sortBy);

      const response = await fetch(`${API_ROOT}/api/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Search failed. Please try again.');
      }

      const data = await response.json();
      
      if (data.success && data.results) {
        console.log(`✅ Found ${data.results.length} tokens`);
        setSearchResults(data.results);
        
        if (data.results.length === 0) {
          setError('No tokens found. Try a different search term.');
        }
      } else {
        throw new Error(data.error || 'Search failed');
      }

    } catch (err) {
      console.error('❌ Search error:', err);
      setError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking on search result - NOW WITH ENRICHMENT!
  const handleResultClick = async (tokenData) => {
    // Transform Jupiter Ultra format to Moonfeed format
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

    // Clean up search UI
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    onClose();

    console.log(`🔄 Enriching ${coinData.symbol}...`);
    
    try {
      // Send coin data to backend for enrichment
      const response = await fetch(`${API_ROOT}/api/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin: coinData })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Enriched ${coinData.symbol} in ${data.enrichmentTime}ms (cached: ${data.cached})`);
          // Show coin with enriched data (only call once!)
          if (onCoinSelect) onCoinSelect(data.coin);
        } else {
          console.warn('⚠️ Enrichment failed, showing basic data');
          if (onCoinSelect) onCoinSelect(coinData);
        }
      } else {
        console.warn(`⚠️ Enrichment API returned ${response.status}, showing basic data`);
        if (onCoinSelect) onCoinSelect(coinData);
      }
    } catch (enrichError) {
      console.error('❌ Enrichment error, showing basic data:', enrichError);
      if (onCoinSelect) onCoinSelect(coinData);
    }
  };

  // Handle enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
      handleSearch();
    }
  };

  // Clear results when input changes
  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (error) setError(null);
  };

  // Toggle filters
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Update filter
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Re-trigger search with new filters
    if (searchQuery.trim().length >= 2) {
      setTimeout(() => handleSearch(), 100);
    }
  };

  // Format large numbers
  const formatNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Format price
  const formatPrice = (price) => {
    if (!price) return '$0.00';
    if (price < 0.00001) return `$${price.toExponential(2)}`;
    if (price < 1) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(4)}`;
  };

  // Get organic score color
  const getOrganicScoreColor = (scoreLabel) => {
    if (!scoreLabel) return '#888';
    // Handle both string and number types
    const label = String(scoreLabel).toLowerCase();
    if (label.includes('high')) return '#22c55e';
    if (label.includes('medium')) return '#eab308';
    if (label.includes('low')) return '#ef4444';
    return '#888';
  };

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h3>Search Tokens</h3>
          <div className="search-header-actions">
            <button 
              className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
              onClick={toggleFilters}
              title="Toggle filters"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
            </button>
            <button className="search-close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="search-modal-body">
          {/* Search input */}
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search tokens (e.g., SOL, BONK, or token address)"
              value={searchQuery}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="search-input"
              autoFocus
            />
            {loading && (
              <div className="search-loading-indicator">
                <div className="search-spinner"></div>
              </div>
            )}
          </div>

          {/* Filters section */}
          {showFilters && (
            <div className="search-filters">
              <div className="filter-row">
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) => updateFilter('verifiedOnly', e.target.checked)}
                  />
                  <span>Verified Only</span>
                </label>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.excludeSuspicious}
                    onChange={(e) => updateFilter('excludeSuspicious', e.target.checked)}
                  />
                  <span>Exclude Suspicious</span>
                </label>
              </div>
              <div className="filter-row">
                <label className="filter-input-label">
                  <span>Min Liquidity ($)</span>
                  <input
                    type="number"
                    placeholder="e.g., 10000"
                    value={filters.minLiquidity}
                    onChange={(e) => updateFilter('minLiquidity', e.target.value)}
                    className="filter-input"
                  />
                </label>
              </div>
              <div className="filter-row">
                <label className="filter-select-label">
                  <span>Sort By</span>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className="filter-select"
                  >
                    <option value="liquidity">Liquidity</option>
                    <option value="marketCap">Market Cap</option>
                    <option value="holders">Holder Count</option>
                    <option value="price">Price</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="search-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="search-results">
              <div className="search-results-header">
                <span className="results-count">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="search-results-list">
                {searchResults.map((token, index) => (
                  <div 
                    key={token.mint || index} 
                    className="search-result-card"
                    onClick={() => handleResultClick(token)}
                  >
                    <div className="search-result-image">
                      <img 
                        src={token.image || token.logo || '/profile-placeholder.png'} 
                        alt={token.name || token.symbol}
                        onError={(e) => {
                          e.target.src = '/profile-placeholder.png';
                        }}
                      />
                    </div>
                    
                    <div className="search-result-info">
                      <div className="search-result-header">
                        <h4 className="search-result-name">
                          {token.name || 'Unknown Token'}
                          {token.verified && (
                            <svg className="verified-badge" width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                          )}
                        </h4>
                        <span className="search-result-symbol">${token.symbol || 'UNKNOWN'}</span>
                      </div>
                      
                      <div className="search-result-stats">
                        <div className="stat-item">
                          <span className="stat-label">Price:</span>
                          <span className="stat-value">{formatPrice(token.price)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">MC:</span>
                          <span className="stat-value">{formatNumber(token.marketCap)}</span>
                        </div>
                        {token.liquidity && (
                          <div className="stat-item">
                            <span className="stat-label">Liq:</span>
                            <span className="stat-value">{formatNumber(token.liquidity)}</span>
                          </div>
                        )}
                      </div>

                      {/* 24h changes */}
                      {token.change24h !== undefined && (
                        <div className="search-result-change">
                          <span className={`change-badge ${token.change24h >= 0 ? 'positive' : 'negative'}`}>
                            {token.change24h >= 0 ? '↑' : '↓'} {Math.abs(token.change24h).toFixed(2)}%
                          </span>
                        </div>
                      )}

                      {/* Safety indicators */}
                      <div className="search-result-badges">
                        {(token.organicScoreLabel || token.organicScore) && (
                          <span 
                            className="badge organic-badge"
                            style={{ color: getOrganicScoreColor(token.organicScoreLabel || token.organicScore) }}
                          >
                            {token.organicScoreLabel || (typeof token.organicScore === 'number' ? 'Score: ' + token.organicScore : token.organicScore)}
                          </span>
                        )}
                        {token.holderCount && (
                          <span className="badge holders-badge">
                            👥 {token.holderCount.toLocaleString()}
                          </span>
                        )}
                        {token.suspicious && (
                          <span className="badge warning-badge">⚠️ Suspicious</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="search-result-arrow">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Help text - only show when no search query */}
          {!searchQuery && !searchResults.length && (
            <div className="search-help">
              <h4>Search any Solana token:</h4>
              <p className="powered-by-text">Powered by Jupiter Ultra - Search by name, symbol, or address!</p>
              <ul>
                <li>By name (e.g., "Dogwifhat")</li>
                <li>By symbol (e.g., "SOL", "BONK")</li>
                <li>By mint address</li>
                <li>Results include price, market cap, liquidity & safety indicators</li>
                <li>Use filters to refine your search</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CoinSearchModal;
