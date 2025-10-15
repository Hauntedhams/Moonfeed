import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import './WalletModal.css';

const WalletModal = ({ walletAddress, traderData, onClose }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        console.log(`📊 Trading stats:`, result.trading);
        console.log(`💰 SOL activity:`, result.solActivity);
        console.log(`🪙 Tokens traded:`, result.tokens?.length || 0);
        
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
      if (traderData) {
        setWalletData({ ...traderData, isTraderData: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateWinRate = (tokens) => {
    if (!tokens || tokens.length === 0) return 0;
    const closedPositions = tokens.filter(t => Math.abs(t.netAmount) < 0.001 && t.sells > 0);
    if (closedPositions.length === 0) return 0;
    const wins = closedPositions.filter(t => t.sells >= t.buys).length;
    return Math.round((wins / closedPositions.length) * 100);
  };

  const calculateTotalProfit = (solActivity) => {
    if (!solActivity) return 0;
    const netChange = parseFloat(solActivity.netChange);
    const solPrice = 150;
    return Math.round(netChange * solPrice);
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

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="wallet-modal-close" onClick={onClose}>×</button>
        
        <div className="wallet-modal-body">
          {loading && (
            <div className="wallet-loading">
              <div className="spinner"></div>
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
              {/* Profile Header with Robot Icon & Address */}
              <div className="wallet-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, rgba(79, 195, 247, 0.3), rgba(103, 126, 234, 0.3))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    flexShrink: 0
                  }}>
                    🤖
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '4px' }}>Wallet Address</div>
                    <a 
                      href={`https://solscan.io/account/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wallet-link"
                      style={{ fontSize: '14px', wordBreak: 'break-all' }}
                    >
                      {walletAddress}
                      <span className="external-icon">↗</span>
                    </a>
                  </div>
                </div>

                {/* Main Stats: Win Rate & Total Profit */}
                {walletData.isHeliusData && (
                  <div className="wallet-stats-grid" style={{ marginBottom: '20px' }}>
                    <div className="stat-card">
                      <div className="stat-label">Total Profit</div>
                      <div className={`stat-value ${walletData.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                        {walletData.totalProfit >= 0 ? '+' : ''}{formatCurrency(walletData.totalProfit)}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                        Based on SOL activity
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Win Rate</div>
                      <div className={`stat-value ${walletData.winRate >= 50 ? 'positive' : ''}`}>
                        {walletData.winRate}%
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                        Closed positions
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                  <button className="track-btn" style={{
                    padding: '12px',
                    background: 'rgba(79, 195, 247, 0.2)',
                    border: '1px solid rgba(79, 195, 247, 0.3)',
                    borderRadius: '8px',
                    color: '#4FC3F7',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    Track Wallet
                  </button>
                  <button className="copy-trade-btn" style={{
                    padding: '12px',
                    background: 'rgba(103, 126, 234, 0.2)',
                    border: '1px solid rgba(103, 126, 234, 0.3)',
                    borderRadius: '8px',
                    color: '#677EEA',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    Copy Trade
                  </button>
                </div>

                {/* Info Messages */}
                {walletData.isHeliusData && walletData.hasData && (
                  <div className="wallet-info-message">
                    📊 Showing comprehensive trading analytics (last 100 transactions)
                  </div>
                )}
                {walletData.isHeliusData && !walletData.hasData && (
                  <div className="wallet-info-message" style={{ background: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)' }}>
                    ℹ️ No transaction history found for this wallet
                  </div>
                )}
              </div>

              {/* Consolidated Trading Overview */}
              {walletData.isHeliusData && walletData.trading && (
                <div className="wallet-section">
                  <h3>📈 Trading Overview</h3>
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
                  
                  {walletData.trading.firstTradeDate && (
                    <div className="wallet-stats-grid" style={{ marginTop: '12px' }}>
                      <div className="stat-card">
                        <div className="stat-label">First Trade</div>
                        <div className="stat-value" style={{ fontSize: '12px' }}>
                          {formatDate(walletData.trading.firstTradeDate)}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Last Trade</div>
                        <div className="stat-value" style={{ fontSize: '12px' }}>
                          {formatDate(walletData.trading.lastTradeDate)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SOL Activity */}
              {walletData.isHeliusData && walletData.solActivity && (
                <div className="wallet-section">
                  <h3>💰 SOL Activity</h3>
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
              {walletData.isHeliusData && walletData.tokens && walletData.tokens.length > 0 && (
                <div className="wallet-section">
                  <h3>🪙 Top Traded Tokens</h3>
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
            </>
          )}

          {!loading && !walletData && (
            <div className="wallet-section">
              <div className="no-data">
                <p>ℹ️ No data available for this wallet</p>
                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '8px' }}>
                  Try viewing this wallet's activity on{' '}
                  <a 
                    href={`https://solscan.io/account/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Solscan ↗
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
