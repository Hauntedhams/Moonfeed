import React, { useState, useEffect, useRef } from 'react';
import { getFullApiUrl } from '../config/api';
import WalletModal from './WalletModal';
import './TopTradersList.css';

const TopTradersList = ({ coinAddress }) => {
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [selectedTraderData, setSelectedTraderData] = useState(null);
  const loadingRef = useRef(false); // Prevent duplicate calls

  // Auto-load top traders when component mounts
  useEffect(() => {
    console.log('🔄 TopTradersList useEffect triggered:', {
      coinAddress,
      loaded,
      loading,
      loadingRef: loadingRef.current,
      shouldLoad: coinAddress && !loaded && !loading && !loadingRef.current
    });
    
    // Prevent duplicate calls using ref
    if (coinAddress && !loaded && !loading && !loadingRef.current) {
      console.log('✅ Conditions met - calling loadTopTraders()');
      loadTopTraders();
    } else {
      if (!coinAddress) console.log('⚠️ No coinAddress provided');
      if (loaded) console.log('⚠️ Already loaded');
      if (loading || loadingRef.current) console.log('⚠️ Already loading');
    }
  }, [coinAddress]);

  const loadTopTraders = async () => {
    if (!coinAddress) {
      console.error('❌ No coin address provided');
      setError('No coin address provided');
      return;
    }

    // Prevent duplicate concurrent calls
    if (loadingRef.current) {
      console.warn('⚠️ Already loading, skipping duplicate call');
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const url = getFullApiUrl(`/api/top-traders/${coinAddress}`);
      console.log(`🔍 Loading top traders for: ${coinAddress}`);
      console.log(`📡 Request URL: ${url}`);
      
      const response = await fetch(url);
      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      console.log(`📊 Response ok: ${response.ok}`);
      
      const result = await response.json();
      console.log(`📦 Response data:`, result);
      console.log(`📦 Has success field: ${result.hasOwnProperty('success')}, value: ${result.success}`);
      console.log(`📦 Has data field: ${result.hasOwnProperty('data')}, is array: ${Array.isArray(result.data)}, length: ${result.data?.length}`);

      if (!response.ok) {
        console.error(`❌ Response not OK: ${response.status}`);
        throw new Error(result.error || result.details || `HTTP ${response.status}: Failed to fetch top traders`);
      }

      if (result.success && result.data) {
        console.log(`✅ Setting ${result.data.length} traders to state`);
        setTraders(result.data);
        setLoaded(true);
        console.log(`✅ Successfully loaded ${result.data.length} top traders`);
      } else {
        console.error('❌ Invalid response format:', {
          success: result.success,
          hasData: !!result.data,
          dataType: typeof result.data,
          isArray: Array.isArray(result.data)
        });
        throw new Error('Invalid response format - missing success or data field');
      }

    } catch (err) {
      console.error('❌ Error loading top traders:', err);
      console.error('❌ Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      setError(err.message);
      setLoaded(false); // Allow retry
    } finally {
      setLoading(false);
      loadingRef.current = false;
      console.log(`🏁 loadTopTraders finished. Loading: false`);
    }
  };

  const formatWallet = (wallet) => {
    if (!wallet) return 'Unknown';
    // Short format: F8..dt (2 chars + .. + 2 chars)
    return `${wallet.slice(0, 2)}..${wallet.slice(-2)}`;
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
      {traders.length === 0 ? (
        <div className="no-traders">No trader data available</div>
      ) : (
        <div className="traders-table-container">
          <div className="traders-table">
            {/* Column Headers */}
            <div className="table-header">
              <div className="col-rank">#</div>
              <div className="col-wallet">Wallet</div>
              <div className="col-buy">Buy</div>
              <div className="col-sell">Sell</div>
              <div className="col-pnl">PnL</div>
            </div>
            <div className="traders-scroll-window">
              {traders.map((trader, index) => (
                <div key={trader.wallet || index} className="table-row">
                  <div className="col-rank">#{index + 1}</div>
                  <div 
                    className="col-wallet clickable"
                    onClick={() => {
                      setSelectedWallet(trader.wallet);
                      setSelectedTraderData(trader); // Pass full trader data
                    }}
                    title="Click to view wallet details"
                  >
                    {formatWallet(trader.wallet)}
                  </div>
                  <div className="col-buy">{formatCurrency(trader.total_invested || 0)}</div>
                  <div className="col-sell">{formatCurrency(trader.realized || 0)}</div>
                  <div className={`col-pnl ${trader.total >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(trader.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Wallet Modal */}
      {selectedWallet && (
        <WalletModal 
          walletAddress={selectedWallet}
          traderData={selectedTraderData}
          onClose={() => {
            setSelectedWallet(null);
            setSelectedTraderData(null);
          }}
        />
      )}
    </div>
  );
};

export default TopTradersList;
