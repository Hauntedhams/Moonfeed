import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import './WalletModal.css';

const WalletModal = ({ walletAddress, traderData, onClose }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (walletAddress) {
      // Always fetch Helius data when wallet modal opens
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
        console.log(`📊 Trading stats:`, result.trading);
        console.log(`💰 SOL activity:`, result.solActivity);
        console.log(`🪙 Tokens traded:`, result.tokens?.length || 0);
        
        setWalletData(result);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ Error fetching wallet data:', err);
      setError(`Unable to fetch wallet data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
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
            Wallet Analytics
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="wallet-modal-content">
          {loading && (
            <div className="wallet-loading">
              <div className="loading-spinner" />
              <p>Loading wallet analytics...</p>
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
                {walletData.hasData && (
                  <div className="wallet-info-message" style={{ marginTop: '12px' }}>
                    📊 Comprehensive trading analytics (last 100 transactions)
                  </div>
                )}
                {!walletData.hasData && (
                  <div className="wallet-info-message" style={{ marginTop: '12px', background: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)' }}>
                    ℹ️ No transaction history found for this wallet
                  </div>
                )}
              </div>

              {/* Trading Activity Overview */}
              {walletData.trading && (
                <div className="wallet-section">
                  <h3>Trading Activity</h3>
                  <div className="wallet-stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">Total Trades</div>
                      <div className="stat-value">{formatNumber(walletData.trading.totalTrades)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Unique Tokens</div>
                      <div className="stat-value">{formatNumber(walletData.trading.uniqueTokens)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Active Positions</div>
                      <div className="stat-value positive">{formatNumber(walletData.trading.activeTrades)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Avg Trades/Day</div>
                      <div className="stat-value">{walletData.trading.avgTradesPerDay}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trading History Dates */}
              {walletData.trading && walletData.trading.firstTradeDate && (
                <div className="wallet-section">
                  <h3>Trading History</h3>
                  <div className="wallet-stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">First Trade</div>
                      <div className="stat-value" style={{ fontSize: '13px' }}>
                        {formatDate(walletData.trading.firstTradeDate)}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Last Trade</div>
                      <div className="stat-value" style={{ fontSize: '13px' }}>
                        {formatDate(walletData.trading.lastTradeDate)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SOL Activity */}
              {walletData.solActivity && (
                <div className="wallet-section">
                  <h3>SOL Activity</h3>
                  <div className="wallet-stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">Total Spent</div>
                      <div className="stat-value negative">{walletData.solActivity.totalSpent} SOL</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total Received</div>
                      <div className="stat-value positive">{walletData.solActivity.totalReceived} SOL</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Net Change</div>
                      <div className={`stat-value ${parseFloat(walletData.solActivity.netChange) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(walletData.solActivity.netChange) >= 0 ? '+' : ''}{walletData.solActivity.netChange} SOL
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total Fees</div>
                      <div className="stat-value">{walletData.solActivity.totalFees} SOL</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Traded Tokens */}
              {walletData.tokens && walletData.tokens.length > 0 && (
                <div className="wallet-section">
                  <h3>Top Traded Tokens</h3>
                  <div className="token-holdings-list">
                    {walletData.tokens.slice(0, 10).map((token, index) => (
                      <div key={index} className="token-holding-item">
                        <div className="token-info">
                          <div style={{ 
                            width: '36px', 
                            height: '36px', 
                            borderRadius: '50%', 
                            background: 'linear-gradient(135deg, rgba(79, 195, 247, 0.2), rgba(103, 126, 234, 0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                          }}>
                            🪙
                          </div>
                          <div>
                            <div className="token-name">{token.mint.slice(0, 8)}...</div>
                            <div className="token-symbol" style={{ fontSize: '11px' }}>
                              {token.buys} buys • {token.sells} sells
                            </div>
                          </div>
                        </div>
                        <div className="token-value" style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>
                            {token.totalBought.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.7 }}>
                            {Math.abs(token.netAmount) > 0.001 ? 'Active' : 'Closed'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Data Fallback */}
              {!walletData.hasData && (
                <div className="wallet-section">
                  <div className="no-data">
                    <p>ℹ️ No transaction history available</p>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '8px' }}>
                      This wallet may be new or hasn't made any transactions yet.{' '}
                      <a 
                        href={`https://solscan.io/account/${walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Solscan ↗
                      </a>
                    </p>
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
