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
    
    // Find closed positions (netAmount ≈ 0)
    const closedPositions = tokens.filter(t => Math.abs(t.netAmount) < 0.001 && t.sells > 0);
    
    if (closedPositions.length === 0) return 0;
    
    // Approximate "wins" as positions where they sold more than they bought
    // (indicating profit-taking, though not 100% accurate without price data)
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
                {walletData.isTraderData && (
                  <div className="wallet-info-message" style={{ marginTop: '12px' }}>
                    💡 Showing trading data for this token only (from Top Traders)
                  </div>
                )}
                {walletData.isHeliusData && walletData.hasData && (
                  <div className="wallet-info-message" style={{ marginTop: '12px' }}>
                    � Showing comprehensive trading analytics (last 100 transactions)
                  </div>
                )}
                {walletData.isHeliusData && !walletData.hasData && (
                  <div className="wallet-info-message" style={{ marginTop: '12px', background: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)' }}>
                    ℹ️ No transaction history found for this wallet
                  </div>
                )}
              </div>

              {/* Trading Activity Overview (from Helius) */}
              {walletData.isHeliusData && walletData.trading && (
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

              {/* Trading History Dates (from Helius) */}
              {walletData.isHeliusData && walletData.trading && walletData.trading.firstTradeDate && (
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

              {/* SOL Activity (from Helius) */}
              {walletData.isHeliusData && walletData.solActivity && (
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

              {/* Top Traded Tokens (from Helius) */}
              {walletData.isHeliusData && walletData.tokens && walletData.tokens.length > 0 && (
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

              {/* Trading Performance (from Top Traders data only) */}
              {walletData.isTraderData && (walletData.total_invested !== undefined || walletData.realized !== undefined || walletData.total !== undefined) && (
                <div className="wallet-section">
                  <h3>Performance on This Token</h3>
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
                    {walletData.total !== undefined && !walletData.isPortfolioData && (
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

              {/* Transaction Activity (from Top Traders only) */}
              {walletData.isTraderData && (walletData.total_trades !== undefined || walletData.buy_count !== undefined || walletData.sell_count !== undefined) && (
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

              {/* No data message */}
              {!walletData.isTraderData && !walletData.isPortfolioData && (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
