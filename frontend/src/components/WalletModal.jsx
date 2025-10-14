import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import './WalletModal.css';

const WalletModal = ({ walletAddress, traderData, onClose }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (walletAddress) {
      // If we have trader data from Top Traders, use that immediately
      if (traderData) {
        setWalletData(traderData);
        setLoading(false);
      } else {
        fetchWalletData();
      }
    }
  }, [walletAddress, traderData]);

  const fetchWalletData = async () => {
    // Don't fetch if we already have trader data
    if (traderData) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const url = getFullApiUrl(`/api/wallet/${walletAddress}`);
      console.log(`🔍 Fetching wallet data for: ${walletAddress}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Wallet API not available yet`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Wallet data loaded:`, result.data);
        setWalletData(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ Error fetching wallet data:', err);
      setError('Wallet API is not available. Showing available data from Top Traders.');
      // Even if API fails, keep trader data if we have it
      if (traderData) {
        setWalletData(traderData);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatWallet = (wallet) => {
    if (!wallet) return 'Unknown';
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '-';
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) return `$${(absAmount / 1000000).toFixed(2)}M`;
    if (absAmount >= 1000) return `$${(absAmount / 1000).toFixed(2)}K`;
    return `$${absAmount.toFixed(2)}`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatPercentage = (percent) => {
    if (percent === null || percent === undefined) return '-';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return '-';
    }
  };

  // Handle click outside modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="wallet-modal-backdrop" onClick={handleBackdropClick}>
      <div className="wallet-modal">
        <div className="wallet-modal-header">
          <h2>
            <span style={{ fontSize: '1.4rem' }}>👛</span>
            Wallet Tracker
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="wallet-modal-content">
          {loading && (
            <div className="wallet-loading">
              <div className="loading-spinner" />
              <p>Loading wallet data...</p>
            </div>
          )}

          {error && (
            <div className="wallet-error">
              <p>❌ {error}</p>
              <button onClick={fetchWalletData} className="retry-btn">
                Retry
              </button>
            </div>
          )}

          {!loading && walletData && (
            <>
              {/* Wallet Address */}
              <div className="wallet-section">
                <h3>Wallet Address</h3>
                <div className="wallet-address-display">
                  <a 
                    href={`https://solscan.io/account/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wallet-link"
                  >
                    {walletAddress}
                    <span className="external-icon">↗</span>
                  </a>
                </div>
                {traderData && (
                  <div className="wallet-info-message" style={{ marginTop: '12px' }}>
                    💡 Showing trading data for this token only
                  </div>
                )}
              </div>

              {/* Trading Performance (from Top Traders data) */}
              {(walletData.total_invested !== undefined || walletData.realized !== undefined || walletData.total !== undefined) && (
                <div className="wallet-section">
                  <h3>{traderData ? 'Performance on This Token' : 'Trading Statistics'}</h3>
                  <div className="wallet-stats-grid">
                    {walletData.total_invested !== undefined && walletData.total_invested !== 0 && (
                      <div className="stat-card">
                        <div className="stat-label">Total Bought</div>
                        <div className="stat-value positive">{formatCurrency(walletData.total_invested)}</div>
                      </div>
                    )}
                    {walletData.realized !== undefined && walletData.realized !== 0 && (
                      <div className="stat-card">
                        <div className="stat-label">Total Sold</div>
                        <div className="stat-value">{formatCurrency(walletData.realized)}</div>
                      </div>
                    )}
                    {walletData.total !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Profit/Loss</div>
                        <div className={`stat-value ${walletData.total >= 0 ? 'positive' : 'negative'}`}>
                          {walletData.total >= 0 ? '+' : ''}{formatCurrency(walletData.total)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Balance Information (if available from full API) */}
              {!traderData && (walletData.sol_balance !== undefined || walletData.total_value_usd !== undefined) && (
                <div className="wallet-section">
                  <h3>Balance</h3>
                  <div className="wallet-stats-grid">
                    {walletData.sol_balance !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">SOL Balance</div>
                        <div className="stat-value">{walletData.sol_balance?.toFixed(4) || '-'} SOL</div>
                      </div>
                    )}
                    {walletData.total_value_usd !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Total Value</div>
                        <div className="stat-value">{formatCurrency(walletData.total_value_usd)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Full API Trading Statistics (if available) */}
              {!traderData && (walletData.total_pnl !== undefined || walletData.pnl_percentage !== undefined) && (
                <div className="wallet-section">
                  <h3>Trading Statistics</h3>
                  <div className="wallet-stats-grid">
                    {walletData.total_invested !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Total Invested</div>
                        <div className="stat-value">{formatCurrency(walletData.total_invested)}</div>
                      </div>
                    )}
                    {walletData.total_realized !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Total Realized</div>
                        <div className="stat-value">{formatCurrency(walletData.total_realized)}</div>
                      </div>
                    )}
                    {walletData.total_pnl !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Total PnL</div>
                        <div className={`stat-value ${walletData.total_pnl >= 0 ? 'positive' : 'negative'}`}>
                          {formatCurrency(walletData.total_pnl)}
                        </div>
                      </div>
                    )}
                    {walletData.pnl_percentage !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">PnL %</div>
                        <div className={`stat-value ${walletData.pnl_percentage >= 0 ? 'positive' : 'negative'}`}>
                          {formatPercentage(walletData.pnl_percentage)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Transaction Activity */}
              {(walletData.total_trades !== undefined || walletData.buy_count !== undefined || walletData.sell_count !== undefined) && (
                <div className="wallet-section">
                  <h3>Transaction Activity</h3>
                  <div className="wallet-stats-grid">
                    {walletData.total_trades !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Total Trades</div>
                        <div className="stat-value">{formatNumber(walletData.total_trades)}</div>
                      </div>
                    )}
                    {walletData.buy_count !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Buys</div>
                        <div className="stat-value positive">{formatNumber(walletData.buy_count)}</div>
                      </div>
                    )}
                    {walletData.sell_count !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Sells</div>
                        <div className="stat-value negative">{formatNumber(walletData.sell_count)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Win Rate */}
              {(walletData.win_rate !== undefined || walletData.wins !== undefined || walletData.losses !== undefined) && (
                <div className="wallet-section">
                  <h3>Performance</h3>
                  <div className="wallet-stats-grid">
                    {walletData.win_rate !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Win Rate</div>
                        <div className={`stat-value ${walletData.win_rate >= 50 ? 'positive' : 'negative'}`}>
                          {walletData.win_rate.toFixed(2)}%
                        </div>
                      </div>
                    )}
                    {walletData.wins !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Wins</div>
                        <div className="stat-value positive">{formatNumber(walletData.wins)}</div>
                      </div>
                    )}
                    {walletData.losses !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Losses</div>
                        <div className="stat-value negative">{formatNumber(walletData.losses)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Metrics */}
              {(walletData.avg_hold_time !== undefined || walletData.tokens_held !== undefined) && (
                <div className="wallet-section">
                  <h3>Additional Metrics</h3>
                  <div className="wallet-stats-grid">
                    {walletData.avg_hold_time !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Avg Hold Time</div>
                        <div className="stat-value">{walletData.avg_hold_time}</div>
                      </div>
                    )}
                    {walletData.tokens_held !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Tokens Held</div>
                        <div className="stat-value">{formatNumber(walletData.tokens_held)}</div>
                      </div>
                    )}
                    {walletData.first_trade_date !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">First Trade</div>
                        <div className="stat-value">{formatDate(walletData.first_trade_date)}</div>
                      </div>
                    )}
                    {walletData.last_trade_date !== undefined && (
                      <div className="stat-card">
                        <div className="stat-label">Last Trade</div>
                        <div className="stat-value">{formatDate(walletData.last_trade_date)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw Data Display (for debugging - can be removed) */}
              {Object.keys(walletData).length === 0 && (
                <div className="wallet-section">
                  <div className="no-data">
                    <p>No data available for this wallet</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
