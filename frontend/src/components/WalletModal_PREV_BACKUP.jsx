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
        
        // Calculate win rate and total profit
        const winRate = calculateWinRate(result.tokens || []);
        const totalProfit = calculateTotalProfit(result.solActivity);
        
        setWalletData({ 
          ...result, 
          winRate,
          totalProfit
        });
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
    return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '-';
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) return `$${(absAmount / 1000000).toFixed(2)}M`;
    if (absAmount >= 1000) return `$${(absAmount / 1000).toFixed(2)}K`;
    return `$${absAmount.toLocaleString()}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '-';
    }
  };

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
            <span style={{ fontSize: '1.4rem' }}>🤖</span>
            Wallet Overview
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

          {!loading && walletData && walletData.hasData && (
            <>
              {/* Wallet Address */}
              <div className="wallet-section" style={{ textAlign: 'center', paddingBottom: '20px' }}>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px'
                }}>
                  <span style={{ fontSize: '2rem' }}>🤖</span>
                  <span style={{ 
                    fontSize: '14px', 
                    opacity: 0.7,
                    fontFamily: 'monospace'
                  }}>
                    {formatWallet(walletAddress)}
                  </span>
                </div>
              </div>

              {/* Main Stats */}
              <div className="wallet-section">
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>Stats</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '20px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>Total Profit</div>
                    <div style={{ 
                      fontSize: '32px', 
                      fontWeight: 'bold',
                      color: walletData.totalProfit >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {formatCurrency(walletData.totalProfit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>Win Rate</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                      {walletData.winRate}%
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '12px'
                }}>
                  <button 
                    style={{
                      padding: '14px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, '_blank')}
                    onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    Track
                  </button>
                  <button 
                    style={{
                      padding: '14px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onClick={() => alert('Copy Trade feature coming soon!')}
                    onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    Copy Trade
                  </button>
                </div>
              </div>

              {/* Trading Activity Details */}
              {walletData.trading && (
                <div className="wallet-section">
                  <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>Trading Activity</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Total Trades</div>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{walletData.trading.totalTrades}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Unique Tokens</div>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{walletData.trading.uniqueTokens}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Active Positions</div>
                      <div style={{ fontSize: '20px', fontWeight: '600', color: '#10b981' }}>{walletData.trading.activeTrades}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Avg Trades/Day</div>
                      <div style={{ fontSize: '20px', fontWeight: '600' }}>{walletData.trading.avgTradesPerDay}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trading History */}
              {walletData.trading && walletData.trading.firstTradeDate && (
                <div className="wallet-section">
                  <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>Trading History</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>First Trade</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{formatDate(walletData.trading.firstTradeDate)}</div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Last Trade</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{formatDate(walletData.trading.lastTradeDate)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* SOL Activity */}
              {walletData.solActivity && (
                <div className="wallet-section">
                  <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>SOL Activity</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6', marginBottom: '4px' }}>Total Spent</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#ef4444' }}>
                        {walletData.solActivity.totalSpent} SOL
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6', marginBottom: '4px' }}>Total Received</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#10b981' }}>
                        {walletData.solActivity.totalReceived} SOL
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6', marginBottom: '4px' }}>Net Change</div>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: '600',
                        color: parseFloat(walletData.solActivity.netChange) >= 0 ? '#10b981' : '#ef4444'
                      }}>
                        {parseFloat(walletData.solActivity.netChange) >= 0 ? '+' : ''}
                        {walletData.solActivity.netChange} SOL
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', opacity: 0.6', marginBottom: '4px' }}>Total Fees</div>
                      <div style={{ fontSize: '16px', fontWeight: '600' }}>
                        {walletData.solActivity.totalFees} SOL
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Traded Tokens */}
              {walletData.tokens && walletData.tokens.length > 0 && (
                <div className="wallet-section">
                  <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>
                    Top Traded Tokens ({walletData.tokens.length})
                  </h3>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: '8px 16px',
                    fontSize: '11px',
                    opacity: 0.5,
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <div>TOKEN</div>
                    <div style={{ textAlign: 'right' }}>BUYS</div>
                    <div style={{ textAlign: 'right' }}>SELLS</div>
                    <div style={{ textAlign: 'right' }}>STATUS</div>
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {walletData.tokens.slice(0, 10).map((token, index) => (
                      <div key={index} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto auto',
                        gap: '8px 16px',
                        padding: '10px 0',
                        alignItems: 'center',
                        borderBottom: index < 9 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(79,195,247,0.2), rgba(103,126,234,0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px'
                          }}>
                            🪙
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', fontFamily: 'monospace' }}>
                              {token.mint.slice(0, 8)}...
                            </div>
                            <div style={{ fontSize: '10px', opacity: 0.5' }}>
                              {token.totalBought.toFixed(2)} tokens
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: '500', color: '#10b981' }}>
                          {token.buys}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: '500', color: '#ef4444' }}>
                          {token.sells}
                        </div>
                        <div style={{ 
                          textAlign: 'right', 
                          fontSize: '11px', 
                          fontWeight: '600',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: Math.abs(token.netAmount) > 0.001 ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                          color: Math.abs(token.netAmount) > 0.001 ? '#10b981' : '#6b7280'
                        }}>
                          {Math.abs(token.netAmount) > 0.001 ? 'ACTIVE' : 'CLOSED'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && walletData && !walletData.hasData && (
            <div className="wallet-section">
              <div className="no-data">
                <p>ℹ️ No transaction history found</p>
                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '8px' }}>
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
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
