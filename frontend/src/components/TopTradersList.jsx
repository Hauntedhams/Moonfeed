import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import './TopTradersList.css';

const TopTradersList = ({ coinAddress }) => {
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Auto-load top traders when component mounts
  useEffect(() => {
    if (coinAddress && !loaded && !loading) {
      loadTopTraders();
    }
  }, [coinAddress]);

  const loadTopTraders = async () => {
    if (!coinAddress) {
      setError('No coin address provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 Loading top traders for: ${coinAddress}`);
      
      const response = await fetch(getFullApiUrl(`/api/top-traders/${coinAddress}`));
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch top traders');
      }

      if (result.success && result.data) {
        setTraders(result.data);
        setLoaded(true);
        console.log(`✅ Loaded ${result.data.length} top traders`);
      } else {
        throw new Error('Invalid response format');
      }

    } catch (err) {
      console.error('❌ Error loading top traders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatWallet = (wallet) => {
    if (!wallet) return 'Unknown';
    // Make wallet address even shorter for better space utilization
    return `${wallet.slice(0, 2)}...${wallet.slice(-2)}`;
  };

  const formatTokenAmount = (amount) => {
    if (amount === 0) return '-';
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toFixed(0);
  };

  const formatCurrency = (amount) => {
    if (amount === 0) return '-';
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) return `$${(absAmount / 1000000).toFixed(1)}M`;
    if (absAmount >= 1000) return `$${(absAmount / 1000).toFixed(1)}K`;
    return `$${absAmount.toFixed(0)}`;
  };

  const formatTransactionCount = (count) => {
    if (!count) return '';
    return ` / ${count} txns`;
  };

  if (loading) {
    return (
      <div className="traders-loading">
        <div className="loading-spinner" />
        <p>Loading top traders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="traders-error">
        <p>❌ {error}</p>
        <button 
          className="retry-btn"
          onClick={loadTopTraders}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="top-traders-container">
      <div className="top-traders-header">
        <h3>Top {traders.length} Traders</h3>
        <button 
          className="refresh-traders-btn"
          onClick={loadTopTraders}
          disabled={loading}
        >
          {loading ? '↻' : '↻'}
        </button>
      </div>
      
      {traders.length === 0 ? (
        <div className="no-traders">No trader data available</div>
      ) : (
        <div className="traders-table-container">
          <div className="traders-table">
            <div className="traders-scroll-window">
              {traders.map((trader, index) => (
                <div key={trader.wallet || index} className="table-row">
                  <div className="trader-left">
                    <div className="trader-rank">#{index + 1}</div>
                    <div className="trader-wallet">
                      <span className="wallet-address">{formatWallet(trader.wallet)}</span>
                      <div className="trader-stats">
                        <span className="stat-item">
                          🟢 {formatCurrency(trader.total_invested || 0)}
                        </span>
                        <span className="stat-item">
                          🔴 {formatCurrency(trader.realized || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="trader-right">
                    <div className={`pnl-amount ${trader.total >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(trader.total)}
                    </div>
                    <div className="pnl-details">
                      {formatTokenAmount(trader.held || 0)} held
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopTradersList;
