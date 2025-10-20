import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getFullApiUrl } from '../config/api';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import './WalletPopup.css';

const WalletPopup = ({ walletAddress, traderData, onClose }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { trackWallet, untrackWallet, isTracked } = useTrackedWallets();
  const { isDarkMode } = useDarkMode();
  const [tracked, setTracked] = useState(false);

  // Check if wallet is already tracked
  useEffect(() => {
    setTracked(isTracked(walletAddress));
  }, [walletAddress, isTracked]);

  useEffect(() => {
    if (walletAddress) {
      fetchWalletData();
    }
  }, [walletAddress]);

  const fetchWalletData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = getFullApiUrl(`/api/wallet/${walletAddress}`);
      console.log(`🔍 Fetching wallet data for: ${walletAddress}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Wallet API not available`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Wallet data loaded from Helius`);
        
        // Calculate win rate from token data
        const winRate = calculateWinRate(result.tokens || []);
        const totalProfit = calculateTotalProfit(result.solActivity);
        
        setWalletData({ 
          ...result, 
          isHeliusData: true,
          winRate,
          totalProfit
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ Error fetching wallet data:', err);
      setError(`Unable to fetch wallet data: ${err.message}`);
      // Even if API fails, keep trader data if we have it
      if (traderData) {
        setWalletData({ ...traderData, isTraderData: true });
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate win rate from closed positions
  const calculateWinRate = (tokens) => {
    if (!tokens || tokens.length === 0) return 0;
    
    const closedPositions = tokens.filter(t => Math.abs(t.netAmount) < 0.001 && t.sells > 0);
    
    if (closedPositions.length === 0) return 0;
    
    const wins = closedPositions.filter(t => t.sells >= t.buys).length;
    
    return Math.round((wins / closedPositions.length) * 100);
  };

  // Calculate total profit from SOL activity
  const calculateTotalProfit = (solActivity) => {
    if (!solActivity) return 0;
    const netChange = parseFloat(solActivity.netChange);
    // Assume SOL price of $150 for rough USD estimate
    const solPrice = 150;
    return Math.round(netChange * solPrice);
  };

  const formatWallet = (wallet) => {
    if (!wallet) return 'Unknown';
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '-';
    const absAmount = Math.abs(Number(amount));
    if (!isFinite(absAmount)) return '-';
    if (absAmount >= 1000000) return `$${(absAmount / 1000000).toFixed(2)}M`;
    if (absAmount >= 1000) return `$${(absAmount / 1000).toFixed(2)}K`;
    return `$${absAmount.toFixed(2)}`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    const number = Number(num);
    if (!isFinite(number)) return '-';
    if (number >= 1000000) return `${(number / 1000000).toFixed(2)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(2)}K`;
    return number.toLocaleString();
  };

  const formatPercentage = (percent) => {
    if (percent === null || percent === undefined) return '-';
    const number = Number(percent);
    if (!isFinite(number)) return '-';
    return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return '-';
    }
  };

  // Handle click outside popup - do NOT close (per requirements)
  const handleBackdropClick = (e) => {
    // Popup is interactable and does not close on outside click
    e.stopPropagation();
  };

  const popupContent = (
    <div className="wallet-popup-backdrop" onClick={handleBackdropClick}>
      <div className={`wallet-popup ${isDarkMode ? 'dark-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="wallet-popup-close" onClick={onClose} title="Close">
          ×
        </button>

        {/* Header */}
        <div className="wallet-popup-header">
          <span className="wallet-popup-icon">👛</span>
          <h3 className="wallet-popup-title">Wallet Analytics</h3>
          {!loading && !error && (
            <button 
              className={`track-wallet-btn ${tracked ? 'tracked' : ''}`}
              onClick={() => {
                if (tracked) {
                  untrackWallet(walletAddress);
                  setTracked(false);
                } else {
                  trackWallet(walletAddress);
                  setTracked(true);
                }
              }}
              title={tracked ? 'Untrack this wallet' : 'Track this wallet'}
            >
              {tracked ? '⭐ Tracked' : '☆ Track'}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="wallet-popup-content">
          {loading && (
            <div className="wallet-popup-loading">
              <div className="loading-spinner-small"></div>
              <p>Loading wallet data...</p>
            </div>
          )}

          {error && (
            <div className="wallet-popup-error">
              <p>❌ {error}</p>
              <button onClick={fetchWalletData} className="retry-btn-small">
                Retry
              </button>
            </div>
          )}

          {!loading && walletData && (
            <>
              {/* Wallet Address */}
              <div className="wallet-popup-section">
                <div className="wallet-popup-label">Wallet Address</div>
                <a 
                  href={`https://solscan.io/account/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-popup-address"
                  title="View on Solscan"
                >
                  {formatWallet(walletAddress)}
                  <span className="external-link-icon">↗</span>
                </a>
              </div>

              {/* Trading Overview & Performance - Side by Side */}
              {walletData.isHeliusData && walletData.trading && (
                <>
                  {/* Top Section: Trading Activity + Performance */}
                  <div className="wallet-popup-section">
                    <div className="wallet-popup-label">Trading Activity</div>
                    <div className="wallet-popup-stats">
                      <div className="wallet-stat-item">
                        <span className="stat-label">Total Trades</span>
                        <span className="stat-value">{formatNumber(walletData.trading.totalTrades)}</span>
                      </div>
                      <div className="wallet-stat-item">
                        <span className="stat-label">Unique Tokens</span>
                        <span className="stat-value">{formatNumber(walletData.trading.uniqueTokens)}</span>
                      </div>
                      <div className="wallet-stat-item">
                        <span className="stat-label">Active Positions</span>
                        <span className="stat-value">{formatNumber(walletData.trading.activePositions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics - Right next to Trading Activity */}
                  <div className="wallet-popup-section">
                    <div className="wallet-popup-label">Performance</div>
                    <div className="wallet-popup-stats">
                      <div className="wallet-stat-item">
                        <span className="stat-label">Est. Profit</span>
                        <span className={`stat-value ${walletData.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                          {formatCurrency(walletData.totalProfit)}
                        </span>
                      </div>
                      <div className="wallet-stat-item">
                        <span className="stat-label">Win Rate</span>
                        <span className="stat-value">{walletData.winRate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* SOL Activity */}
                  {walletData.solActivity && (
                    <div className="wallet-popup-section">
                      <div className="wallet-popup-label">SOL Activity</div>
                      <div className="wallet-popup-stats">
                        <div className="wallet-stat-item">
                          <span className="stat-label">Total In</span>
                          <span className="stat-value positive">{Number(walletData.solActivity.totalIn || 0).toFixed(2)} SOL</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Total Out</span>
                          <span className="stat-value negative">{Number(walletData.solActivity.totalOut || 0).toFixed(2)} SOL</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Net Change</span>
                          <span className={`stat-value ${Number(walletData.solActivity.netChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                            {Number(walletData.solActivity.netChange || 0) >= 0 ? '+' : ''}{Number(walletData.solActivity.netChange || 0).toFixed(2)} SOL
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DexCheck Whale Status */}
                  {walletData.dexcheck && walletData.dexcheck.whale && walletData.dexcheck.whale.isWhale && (
                    <div className="wallet-popup-section whale-section">
                      <div className="wallet-popup-label">
                        🐋 Whale Status
                        <span className="whale-badge">Whale Detected</span>
                      </div>
                      <div className="wallet-popup-stats">
                        <div className="wallet-stat-item">
                          <span className="stat-label">Whale Score</span>
                          <span className="stat-value whale-score">{walletData.dexcheck.whale.whaleScore}/100</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Large Trades</span>
                          <span className="stat-value">{walletData.dexcheck.whale.largeTradeCount}</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Total Volume</span>
                          <span className="stat-value">{formatCurrency(walletData.dexcheck.whale.totalVolume)}</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Avg Trade Size</span>
                          <span className="stat-value">{formatCurrency(walletData.dexcheck.whale.avgTradeSize)}</span>
                        </div>
                      </div>
                      {walletData.dexcheck.whale.recentLargeTrades && walletData.dexcheck.whale.recentLargeTrades.length > 0 && (
                        <div className="recent-whale-trades">
                          <div className="trades-header">Recent Large Trades</div>
                          {walletData.dexcheck.whale.recentLargeTrades.slice(0, 3).map((trade, idx) => (
                            <div key={idx} className="whale-trade-item">
                              <div className="trade-side-badge" data-side={trade.side}>
                                {trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL'}
                              </div>
                              <div className="trade-details">
                                <span className="trade-token">{trade.tokenSymbol}</span>
                                <span className="trade-amount">{formatCurrency(trade.amountUsd)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DexCheck Top Trader Rankings */}
                  {walletData.dexcheck && walletData.dexcheck.topTrader && walletData.dexcheck.topTrader.isTopTrader && (
                    <div className="wallet-popup-section top-trader-section">
                      <div className="wallet-popup-label">
                        🏆 Top Trader Rankings
                        <span className="top-trader-badge">Elite Trader</span>
                      </div>
                      {walletData.dexcheck.topTrader.topRankings && walletData.dexcheck.topTrader.topRankings.length > 0 && (
                        <div className="top-rankings-list">
                          {walletData.dexcheck.topTrader.topRankings.map((ranking, idx) => (
                            <div key={idx} className="ranking-item">
                              <div className="rank-badge">#{ranking.rank}</div>
                              <div className="ranking-stats">
                                <div className="stat-row">
                                  <span className="stat-label">ROI:</span>
                                  <span className={`stat-value ${ranking.roi >= 0 ? 'positive' : 'negative'}`}>
                                    {ranking.roi >= 0 ? '+' : ''}{ranking.roi.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Profit:</span>
                                  <span className="stat-value">{formatCurrency(ranking.overallProfit)}</span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Trades:</span>
                                  <span className="stat-value">{ranking.totalTrades}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {walletData.dexcheck.topTrader.avgRank && (
                        <div className="avg-rank-display">
                          Average Rank: <strong>#{walletData.dexcheck.topTrader.avgRank}</strong> across tracked pairs
                        </div>
                      )}
                    </div>
                  )}

                  {/* DexCheck Trading Activity */}
                  {walletData.dexcheck && walletData.dexcheck.trading && (
                    <div className="wallet-popup-section dexcheck-trading-section">
                      <div className="wallet-popup-label">🎯 DexCheck Trading Stats</div>
                      <div className="wallet-popup-stats">
                        <div className="wallet-stat-item">
                          <span className="stat-label">Total Trades</span>
                          <span className="stat-value">{walletData.dexcheck.trading.totalTrades}</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">24h Trades</span>
                          <span className="stat-value">{walletData.dexcheck.trading.recentTrades24h}</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Win Rate</span>
                          <span className="stat-value">{walletData.dexcheck.trading.winRate}%</span>
                        </div>
                        <div className="wallet-stat-item">
                          <span className="stat-label">Est. Profit</span>
                          <span className={`stat-value ${walletData.dexcheck.trading.estimatedProfit >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(walletData.dexcheck.trading.estimatedProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DexCheck Recent Activity */}
                  {walletData.dexcheck && walletData.dexcheck.recentActivity && walletData.dexcheck.recentActivity.length > 0 && (
                    <div className="wallet-popup-section recent-activity-section">
                      <div className="wallet-popup-label">⚡ Recent Trading Activity</div>
                      <div className="recent-activity-list">
                        {walletData.dexcheck.recentActivity.slice(0, 5).map((trade, idx) => (
                          <div key={idx} className="activity-item">
                            <div className="activity-side" data-side={trade.side}>
                              {trade.side === 'buy' ? '🟢' : '🔴'}
                            </div>
                            <div className="activity-details">
                              <span className="activity-amount">{formatCurrency(trade.amountUsd)}</span>
                              <span className="activity-time">
                                {new Date(trade.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Tokens */}
                  {walletData.tokens && walletData.tokens.length > 0 && (
                    <div className="wallet-popup-section">
                      <div className="wallet-popup-label">Top Tokens Traded</div>
                      <div className="wallet-popup-tokens">
                        {walletData.tokens.slice(0, 5).map((token, idx) => (
                          <div key={idx} className="wallet-token-item">
                            <div className="token-info">
                              <span className="token-symbol">{token.symbol || 'Unknown'}</span>
                              <span className="token-trades">{token.buys + token.sells} trades</span>
                            </div>
                            <div className="token-stats">
                              <span className="token-buy">✅ {token.buys}</span>
                              <span className="token-sell">❌ {token.sells}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Source Info */}
                  <div className="wallet-popup-footer">
                    <span className="data-source">
                      📊 Data from Helius & DexCheck APIs
                      {walletData.dexcheck && (
                        <span className="dexcheck-badge">⚡ Enhanced with DexCheck</span>
                      )}
                    </span>
                  </div>
                </>
              )}

              {/* Fallback for trader-only data */}
              {walletData.isTraderData && !walletData.isHeliusData && (
                <>
                  <div className="wallet-popup-section">
                    <div className="wallet-popup-label">Token Trading Stats</div>
                    <div className="wallet-popup-stats">
                      {walletData.totalBought !== undefined && (
                        <div className="wallet-stat-item">
                          <span className="stat-label">Total Bought</span>
                          <span className="stat-value">{formatCurrency(walletData.totalBought)}</span>
                        </div>
                      )}
                      {walletData.totalSold !== undefined && (
                        <div className="wallet-stat-item">
                          <span className="stat-label">Total Sold</span>
                          <span className="stat-value">{formatCurrency(walletData.totalSold)}</span>
                        </div>
                      )}
                      {walletData.profit !== undefined && (
                        <div className="wallet-stat-item">
                          <span className="stat-label">Profit</span>
                          <span className={`stat-value ${walletData.profit >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(walletData.profit)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="wallet-popup-footer">
                    <span className="data-source">📊 Token-specific trading data</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Render via portal to escape stacking contexts
  return createPortal(popupContent, document.body);
};

export default WalletPopup;
