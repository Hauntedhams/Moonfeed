import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getFullApiUrl } from '../config/api';
import { getTransactions, deleteTransaction, storeTransaction, clearTransactions } from '../utils/transactionStorage';
import './OrdersView.css';

const OrdersView = () => {
  const { publicKey, connected, signTransaction } = useWallet();
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [showLimitOrderInfo, setShowLimitOrderInfo] = useState(false);
  const [activeSection, setActiveSection] = useState('orders'); // 'orders' or 'transactions'

  // Fetch orders when wallet connects or filter changes
  useEffect(() => {
    const setupOrders = async () => {
      if (connected && publicKey) {
        fetchOrders();
        fetchTransactions();
      } else {
        setOrders([]);
        setTransactions([]);
        
        // Clear order caches on disconnect
        const { clearAllOrderCaches } = await import('../utils/orderCache.js');
        clearAllOrderCaches();
      }
    };
    
    setupOrders();
  }, [connected, publicKey, statusFilter]);

  // Fetch transactions from localStorage AND blockchain (Helius API)
  const fetchTransactions = async () => {
    if (!publicKey) return;
    
    setLoadingTransactions(true);
    try {
      const walletAddress = publicKey.toString();
      
      // Get locally stored transactions first (instant)
      const storedTransactions = getTransactions(walletAddress);
      
      // Show local storage transactions immediately while we fetch from API
      if (storedTransactions.length > 0) {
        setTransactions(storedTransactions);
      }
      
      // Fetch blockchain transactions from backend
      try {
        const response = await fetch(getFullApiUrl(`/api/wallet/${walletAddress}/swaps?limit=50`));
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.transactions && result.transactions.length > 0) {
            console.log(`📡 Fetched ${result.transactions.length} swap transactions from blockchain`);
            
            // Merge blockchain transactions with local storage
            // Update existing ones if they have "Unknown" data, add new ones
            for (const tx of result.transactions) {
              const existing = storedTransactions.find(st => st.signature === tx.signature);
              
              if (!existing) {
                // New transaction - add it
                storeTransaction({
                  walletAddress,
                  signature: tx.signature,
                  type: tx.type,
                  tokenMint: tx.tokenMint,
                  tokenSymbol: tx.tokenSymbol,
                  tokenName: tx.tokenName,
                  tokenImage: tx.tokenImage,
                  inputAmount: tx.inputAmount,
                  outputAmount: tx.outputAmount,
                  inputMint: tx.inputMint,
                  outputMint: tx.outputMint,
                  pricePerToken: tx.pricePerToken,
                  timestamp: tx.timestamp,
                });
              } else if (existing.tokenSymbol === 'Unknown' && tx.tokenSymbol !== 'Unknown') {
                // Existing transaction has Unknown data - update it with better metadata
                // Delete old and add new with better data
                deleteTransaction(walletAddress, tx.signature);
                storeTransaction({
                  walletAddress,
                  signature: tx.signature,
                  type: tx.type,
                  tokenMint: tx.tokenMint,
                  tokenSymbol: tx.tokenSymbol,
                  tokenName: tx.tokenName,
                  tokenImage: tx.tokenImage,
                  inputAmount: tx.inputAmount || existing.inputAmount,
                  outputAmount: tx.outputAmount || existing.outputAmount,
                  inputMint: tx.inputMint,
                  outputMint: tx.outputMint,
                  pricePerToken: tx.pricePerToken || existing.pricePerToken,
                  timestamp: tx.timestamp || existing.timestamp,
                });
              }
            }
            
            // Refresh from localStorage (now includes blockchain txs)
            const updatedTransactions = getTransactions(walletAddress);
            setTransactions(updatedTransactions);
          } else if (storedTransactions.length === 0) {
            // No blockchain transactions and no local storage
            setTransactions([]);
          }
        } else {
          // API failed, use local storage only
          console.warn('Failed to fetch blockchain transactions, using local storage only');
          if (storedTransactions.length === 0) {
            setTransactions([]);
          }
        }
      } catch (apiError) {
        console.error('Error fetching blockchain transactions:', apiError);
        // Fallback to local storage (already set above)
        if (storedTransactions.length === 0) {
          setTransactions([]);
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Handle clearing cache and re-fetching fresh data
  const handleClearAndRefresh = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    clearTransactions(walletAddress);
    setTransactions([]);
    
    // Fetch fresh from blockchain
    await fetchTransactions();
  };

  // Handle delete transaction
  const handleDeleteTransaction = (signature) => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    const deleted = deleteTransaction(walletAddress, signature);
    
    if (deleted) {
      // Refresh transactions list
      fetchTransactions();
    }
  };

  // Helper function to check if an order is expired
  const isOrderExpired = (order) => {
    if (!order.expiresAt) return false;
    
    try {
      const expiresAtDate = new Date(order.expiresAt);
      if (isNaN(expiresAtDate.getTime())) return false;
      
      const now = new Date();
      return now > expiresAtDate;
    } catch (err) {
      console.error('Error checking order expiration:', err);
      return false;
    }
  };

  // Fetch active orders
  const fetchOrders = async () => {
    if (!publicKey) return;
    
    const walletAddress = publicKey.toString();
    
    // Check cache first
    const { getCachedOrders, setCachedOrders } = await import('../utils/orderCache.js');
    const cachedOrders = getCachedOrders(walletAddress, statusFilter);
    
    if (cachedOrders) {
      // Use cached data
      if (statusFilter === 'active') {
        const activeOrders = [];
        const expiredOrders = [];
        
        cachedOrders.forEach(order => {
          if (isOrderExpired(order)) {
            expiredOrders.push(order);
          } else {
            activeOrders.push(order);
          }
        });
        
        if (expiredOrders.length > 0) {
          console.warn(`[Orders] Found ${expiredOrders.length} expired order(s) in cached active orders`);
        }
        
        setOrders(activeOrders);
      } else {
        const enrichedCached = cachedOrders.map(order => ({
          ...order,
          isExpired: isOrderExpired(order)
        }));
        setOrders(enrichedCached);
      }
      
      setLoadingOrders(false);
      setOrdersError(null);
      return; // Exit early, using cache
    }
    
    // No cache, fetch from backend
    setLoadingOrders(true);
    setOrdersError(null);

    try {
      const url = getFullApiUrl(`/api/trigger/orders?wallet=${walletAddress}&status=${statusFilter}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const result = await response.json();
      
      if (result.success) {
        let fetchedOrders = result.orders || [];
        
        // ENRICH ORDERS WITH STORED SIGNATURES FROM LOCALSTORAGE
        const { enrichOrderWithStoredSignatures } = await import('../utils/orderStorage.js');
        fetchedOrders = fetchedOrders.map(order => enrichOrderWithStoredSignatures(order));
        
        // Cache the fetched orders
        setCachedOrders(walletAddress, statusFilter, fetchedOrders);
        
        // CLIENT-SIDE EXPIRATION FILTERING:
        // If viewing "active" orders, filter out expired ones
        if (statusFilter === 'active') {
          const activeOrders = [];
          const expiredOrders = [];
          
          fetchedOrders.forEach(order => {
            if (isOrderExpired(order)) {
              expiredOrders.push(order);
            } else {
              activeOrders.push(order);
            }
          });
          
          // Log expired orders for debugging
          if (expiredOrders.length > 0) {
            console.warn(`[Orders] Found ${expiredOrders.length} expired order(s) in active orders:`, 
              expiredOrders.map(o => ({ orderId: o.orderId, expiresAt: o.expiresAt })));
          }
          
          // Only show non-expired orders in active tab
          setOrders(activeOrders);
        } else {
          // For history tab, mark expired orders with a flag
          fetchedOrders = fetchedOrders.map(order => ({
            ...order,
            isExpired: isOrderExpired(order)
          }));
          
          setOrders(fetchedOrders);
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrdersError(err.message);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Handle cancel order
  const handleCancelOrder = async (orderId) => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    setCancellingOrder(orderId);

    try {
      const walletAddress = publicKey.toString();
      
      // Step 1: Get cancel transaction from backend
      console.log('[Cancel Order] Step 1: Requesting cancel transaction from backend...');
      const response = await fetch(getFullApiUrl('/api/trigger/cancel-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maker: walletAddress,
          orderId
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create cancel transaction');
      }

      if (!result.transaction) {
        throw new Error('No transaction returned from backend');
      }

      console.log('[Cancel Order] Step 2: Transaction received, requesting wallet signature...');

      // Step 2: Import required Solana libraries and decode transaction
      const { Transaction, VersionedTransaction } = await import('@solana/web3.js');
      
      // Decode the transaction - try both formats
      let transaction;
      let isVersioned = false;
      
      try {
        // First, try to decode as versioned transaction (v0)
        const transactionBuffer = Buffer.from(result.transaction, 'base64');
        console.log('[Cancel Order] Attempting versioned transaction decode...');
        transaction = VersionedTransaction.deserialize(transactionBuffer);
        isVersioned = true;
        console.log('[Cancel Order] ✅ Decoded as versioned transaction');
      } catch (versionedError) {
        console.log('[Cancel Order] ❌ Versioned decode failed:', versionedError.message);
        console.log('[Cancel Order] Attempting legacy transaction decode...');
        
        // Fallback to legacy transaction
        try {
          const transactionBuffer = Buffer.from(result.transaction, 'base64');
          transaction = Transaction.from(transactionBuffer);
          console.log('[Cancel Order] ✅ Decoded as legacy transaction');
        } catch (legacyError) {
          console.error('[Cancel Order] ❌ Both decode methods failed:', {
            versionedError: versionedError.message,
            legacyError: legacyError.message
          });
          
          // Provide detailed error with Jupiter link
          const jupiterUrl = `https://jup.ag/limit/${publicKey.toString()}`;
          throw new Error(
            `Failed to decode transaction. This may be a Jupiter API issue.\n\n` +
            `You can cancel this order directly on Jupiter:\n${jupiterUrl}\n\n` +
            `Error details:\n- Versioned: ${versionedError.message}\n- Legacy: ${legacyError.message}`
          );
        }
      }

      // Step 3: Send transaction for signing
      console.log('[Cancel Order] Step 3: Sending transaction to wallet for signing...');
      
      const signedTransaction = await signTransaction(transaction);
      
      // Serialize the signed transaction
      const signedTransactionBase64 = Buffer.from(signedTransaction.serialize()).toString('base64');

      console.log('[Cancel Order] Step 4: Executing signed transaction...');

      // Step 4: Execute the signed transaction
      const executeResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTransactionBase64,
          requestId: result.requestId
        })
      });

      const executeResult = await executeResponse.json();

      if (!executeResult.success) {
        throw new Error(executeResult.error || 'Failed to execute cancel transaction');
      }

      console.log('[Cancel Order] ✅ Order cancelled successfully!', executeResult.signature);
      
      // Store cancel signature in localStorage
      if (executeResult.signature && orderId) {
        const { storeOrderSignature } = await import('../utils/orderStorage.js');
        storeOrderSignature({
          orderId,
          signature: executeResult.signature,
          maker: publicKey.toString(),
          orderType: 'cancel'
        });
      }
      
      // Invalidate order cache since we cancelled an order
      const { invalidateOrderCache } = await import('../utils/orderCache.js');
      invalidateOrderCache(publicKey.toString());
      
      // Show success message with transaction link
      const signature = executeResult.signature;
      if (confirm(`Order cancelled successfully!\n\nTransaction: ${signature}\n\nClick OK to view on Solscan`)) {
        window.open(`https://solscan.io/tx/${signature}`, '_blank');
      }

      // Refresh orders
      await fetchOrders();
    } catch (err) {
      console.error('[Cancel Order] ❌ Error:', err);
      
      // Generate Jupiter link for manual cancellation
      const jupiterUrl = `https://jup.ag/limit/${publicKey.toString()}`;
      
      // More detailed error message
      let errorMessage = 'Failed to cancel order: ' + err.message;
      let showJupiterOption = true;
      
      if (err.message.includes('User rejected')) {
        errorMessage = 'Order cancellation was rejected. Please approve the transaction in your wallet to cancel the order.';
        showJupiterOption = false;
      } else if (err.message.includes('Wallet does not support')) {
        errorMessage = 'Your wallet does not support transaction signing. Please use a compatible wallet or cancel on Jupiter.';
      } else if (err.message.includes('decode')) {
        errorMessage = 'Failed to decode the cancellation transaction. This may be a temporary Jupiter API issue.\n\n' +
                      'You can cancel this order directly on Jupiter instead.';
      }
      
      // Show error with option to open Jupiter
      if (showJupiterOption) {
        const openJupiter = confirm(
          errorMessage + '\n\n' +
          'Would you like to open Jupiter to cancel this order manually?\n\n' +
          'Click OK to open Jupiter, or Cancel to try again later.'
        );
        
        if (openJupiter) {
          window.open(jupiterUrl, '_blank');
        }
      } else {
        alert(errorMessage);
      }
    } finally {
      setCancellingOrder(null);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '0';
    const num = parseFloat(price);
    if (num < 0.01) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Invalid date';
      }
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      console.error('Error formatting date:', err, timestamp);
      return 'Invalid date';
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return 'Unknown';
    }
  };

  if (!connected) {
    return (
      <div className="orders-view">
        <div className="orders-container">
          {/* Header */}
          <div className="orders-page-header">
            <div className="orders-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1>Orders & Transactions</h1>
            <p className="orders-subtitle">Connect your wallet to view limit orders and transaction history</p>
          </div>

          {/* Wallet Connection Section */}
          <div className="wallet-connection-section">
            <div className="connection-card">
              <h3>Connect Wallet</h3>
              <p>Connect your Solana wallet to view limit orders and your recent meme coin purchases.</p>
              <div className="wallet-button-container">
                <WalletMultiButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-view">
      <div className="orders-container">
        {/* Header */}
        <div className="orders-page-header">
          <div className="orders-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1>Orders & Transactions</h1>
          <p className="orders-subtitle">Manage limit orders and view your recent buys</p>
        </div>

        {/* Section Tabs */}
        <div className="section-tabs">
          <button
            className={`section-tab ${activeSection === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveSection('orders')}
          >
            <span className="tab-icon">📋</span>
            <span className="tab-label">Limit Orders</span>
            {orders.length > 0 && <span className="tab-count">{orders.length}</span>}
          </button>
          <button
            className={`section-tab ${activeSection === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveSection('transactions')}
          >
            <span className="tab-icon">💸</span>
            <span className="tab-label">Transactions</span>
            {transactions.length > 0 && <span className="tab-count">{transactions.length}</span>}
          </button>
        </div>

        {/* Limit Orders Section */}
        {activeSection === 'orders' && (
          <div className="orders-section">
            <div className="orders-header">
              <h3>Limit Orders</h3>
              <div className="orders-header-right">
                <button 
                  className="what-are-limit-orders-link"
                  onClick={() => setShowLimitOrderInfo(true)}
                >
                  What are limit orders?
                </button>
                <div className="orders-filter">
                  <button
                    className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('active')}
                  >
                    Active
                  </button>
                  <button
                    className={`filter-btn ${statusFilter === 'history' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('history')}
                  >
                    History
                  </button>
                </div>
              </div>
            </div>

          {loadingOrders ? (
            <div className="orders-loading">
              <div className="loading-spinner"></div>
              <p>Loading orders...</p>
            </div>
          ) : ordersError ? (
            <div className="orders-error">
              <p>⚠️ {ordersError}</p>
              <button onClick={fetchOrders} className="retry-btn">Retry</button>
            </div>
          ) : orders.length === 0 ? (
            <div className="orders-empty">
              <div className="empty-icon">📋</div>
              <p>No {statusFilter} orders</p>
              <span className="empty-hint">
                {statusFilter === 'active' 
                  ? 'Create limit orders from any coin card' 
                  : 'Your order history will appear here'}
              </span>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => {
                // Safely extract order data with defaults and validation
                const tokenSymbol = order.tokenSymbol || order.symbol || 'TOKEN';
                const tokenName = order.tokenName || order.name || tokenSymbol;
                const orderType = order.type || 'buy';
                const status = order.status || 'active';
                const triggerPrice = order.triggerPrice || 0;
                const currentPrice = order.currentPrice || triggerPrice;
                const amount = order.amount || 0;
                
                // Safe timestamp handling
                let createdAt = order.createdAt;
                let expiresAt = order.expiresAt;
                let expiresAtRaw = order.expiresAt;
                
                // Validate createdAt
                try {
                  if (!createdAt) {
                    createdAt = new Date().toISOString();
                  } else {
                    const testDate = new Date(createdAt);
                    if (isNaN(testDate.getTime())) {
                      createdAt = new Date().toISOString();
                    } else {
                      createdAt = testDate.toISOString();
                    }
                  }
                } catch (err) {
                  createdAt = new Date().toISOString();
                }
                
                // Validate expiresAt
                if (expiresAt) {
                  try {
                    let parsedDate;
                    parsedDate = new Date(expiresAt);
                    
                    if (isNaN(parsedDate.getTime()) && typeof expiresAt === 'number') {
                      parsedDate = new Date(expiresAt * 1000);
                    }
                    
                    if (isNaN(parsedDate.getTime()) && typeof expiresAt === 'number') {
                      parsedDate = new Date(expiresAt);
                    }
                    
                    if (isNaN(parsedDate.getTime())) {
                      expiresAt = expiresAtRaw;
                    } else {
                      expiresAt = parsedDate.toISOString();
                    }
                  } catch (err) {
                    expiresAt = expiresAtRaw;
                  }
                }
                
                const orderId = order.orderId || order.id || 'unknown';
                const estimatedValue = order.estimatedValue || 0;
                
                // Calculate percentage difference between current and trigger price
                const priceDiffPercent = triggerPrice > 0 
                  ? ((currentPrice - triggerPrice) / triggerPrice * 100).toFixed(2)
                  : 0;
                const isPriceAboveTrigger = currentPrice > triggerPrice;
                
                // Calculate time since order creation
                const createdDate = new Date(createdAt);
                const now = new Date();
                const timeDiff = now - createdDate;
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const timeAgo = hours > 0 ? `${hours}h ${minutes}m ago` : `${minutes}m ago`;
                
                // Calculate expiration time
                let expiresAtDate = null;
                let expiryParseError = false;
                
                if (expiresAt) {
                  try {
                    expiresAtDate = new Date(expiresAt);
                    
                    if (isNaN(expiresAtDate.getTime())) {
                      expiryParseError = true;
                      expiresAtDate = null;
                    } else {
                      const yearsDiff = Math.abs(expiresAtDate.getFullYear() - now.getFullYear());
                      if (yearsDiff > 10) {
                        expiryParseError = true;
                        expiresAtDate = null;
                      }
                    }
                  } catch (err) {
                    expiryParseError = true;
                    expiresAtDate = null;
                  }
                }
                
                const isExpired = order.isExpired || isOrderExpired(order);
                const timeUntilExpiry = expiresAtDate && expiresAtDate > now && !isExpired ? expiresAtDate - now : null;
                const hoursUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60)) : null;
                const minutesUntilExpiry = timeUntilExpiry ? Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60)) : null;
                const daysUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24)) : null;
                
                let expiryText = 'No expiry';
                let expiryWarning = false;
                
                if (expiryParseError && expiresAtRaw) {
                  expiryText = '⚠️ Invalid format';
                  expiryWarning = true;
                } else if (isExpired) {
                  expiryText = '⚠️ EXPIRED';
                  expiryWarning = true;
                } else if (daysUntilExpiry !== null && daysUntilExpiry > 0) {
                  const remainingHours = hoursUntilExpiry % 24;
                  expiryText = remainingHours > 0 
                    ? `${daysUntilExpiry}d ${remainingHours}h` 
                    : `${daysUntilExpiry}d`;
                  expiryWarning = daysUntilExpiry === 0;
                } else if (hoursUntilExpiry !== null) {
                  expiryText = hoursUntilExpiry > 0 
                    ? `${hoursUntilExpiry}h ${minutesUntilExpiry}m` 
                    : `${minutesUntilExpiry}m`;
                  expiryWarning = hoursUntilExpiry === 0 && minutesUntilExpiry < 60;
                } else if (expiresAt && !expiresAtDate) {
                  expiryText = '⚠️ Parse error';
                  expiryWarning = true;
                }
                
                return (
                  <div key={orderId} className={`order-card ${status === 'active' ? 'active-order' : ''}`}>
                    {/* Order Header */}
                    <div className="order-header">
                      <div className="order-token">
                        <span className="token-symbol" title={tokenName}>{tokenSymbol}</span>
                        <span className={`order-type ${orderType}`}>
                          {orderType === 'buy' ? '🟢 Buy' : '🔴 Sell'}
                        </span>
                      </div>
                      <div className={`order-status ${status}`}>
                        {status}
                      </div>
                    </div>

                    {/* Detailed Active Order Info */}
                    {status === 'active' && (
                      <>
                        {/* EXPIRED ORDER WARNING */}
                        {isExpired && (
                          <div className="expired-order-warning">
                            <div className="warning-header">
                              <span className="warning-icon">⚠️</span>
                              <strong>ORDER EXPIRED - FUNDS LOCKED IN ESCROW</strong>
                            </div>
                            <p className="warning-text">
                              This order expired on <strong>{formatDate(expiresAt)}</strong>. Your <strong>{estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'}</strong> are currently held in Jupiter's escrow program and will NOT be returned automatically.
                            </p>
                            <div className="escrow-info">
                              <div>
                                <strong>🔒 Escrow Program:</strong>
                                <br />
                                <a 
                                  href="https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="escrow-link"
                                >
                                  jupoNjAx...Nrnu ↗
                                </a>
                              </div>
                              {orderId && orderId !== 'unknown' && (
                                <div>
                                  <strong>📦 Order Account:</strong>
                                  <br />
                                  <a 
                                    href={`https://solscan.io/account/${orderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="escrow-link"
                                  >
                                    {orderId.slice(0, 8)}...{orderId.slice(-6)} ↗
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="recovery-instructions">
                              <div className="instructions-title">
                                🔧 TO RECOVER YOUR FUNDS:
                              </div>
                              <div className="instruction-item">
                                <strong>Option 1:</strong> Click the "Cancel Order" button below
                              </div>
                              <div className="instruction-item">
                                <strong>Option 2:</strong> Visit Jupiter's interface
                                <div className="jupiter-link-container">
                                  <a 
                                    href="https://jup.ag/limit"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="jupiter-link"
                                  >
                                    🔗 Open Jupiter Limit Orders ↗
                                  </a>
                                </div>
                              </div>
                            </div>
                            <p className="warning-footer">
                              ⚡ Your {estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'} won't be returned automatically - you must cancel manually!
                            </p>
                          </div>
                        )}

                        {/* ESCROW INFO BADGE - Show for all active orders */}
                        {!isExpired && (
                          <div className="escrow-info-badge">
                            <div className="escrow-badge-icon">🔒</div>
                            <div className="escrow-badge-content">
                              <div className="escrow-badge-title">
                                Funds Held in Jupiter Escrow
                              </div>
                              <div className="escrow-badge-text">
                                Your <strong>{estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'}</strong> are securely held in a Program Derived Address (PDA) until the order executes or you cancel it.
                              </div>
                              <div className="escrow-badge-links">
                                <a 
                                  href="https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="badge-link"
                                >
                                  📋 View Escrow Program ↗
                                </a>
                                {orderId && orderId !== 'unknown' && (
                                  <a 
                                    href={`https://solscan.io/account/${orderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="badge-link"
                                  >
                                    📦 View Order Account ↗
                                  </a>
                                )}
                              </div>
                              <div className="escrow-badge-note">
                                <div>
                                  <strong>ℹ️ Important:</strong> If this order expires, your funds will remain in escrow. You must manually cancel the order to retrieve them.
                                </div>
                                <div className="cancel-options">
                                  <span>Cancel below or via</span>
                                  <a 
                                    href="https://jup.ag/limit"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="jupiter-inline-link"
                                  >
                                    🔗 Jupiter Interface ↗
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Price Progress Section */}
                        <div className="order-price-progress">
                          <div className="price-comparison">
                            <div className="price-box current-price">
                              <div className="price-label">Current Price</div>
                              <div className="price-amount" title={`Price in SOL per token${order.currentPriceSource ? `\nSource: ${order.currentPriceSource}` : ''}`}>
                                {formatPrice(currentPrice)} SOL
                              </div>
                              {order.currentPriceSource && order.currentPriceSource !== 'fallback-trigger' && (
                                <div className="price-source-badge live">
                                  ✓ Live Price
                                </div>
                              )}
                              {order.currentPriceSource === 'fallback-trigger' && (
                                <div className="price-source-badge fallback" title="Price API unavailable - showing trigger price">
                                  ⚠️ Using Trigger
                                </div>
                              )}
                            </div>
                            <div className="price-arrow">
                              {orderType === 'buy' ? (
                                isPriceAboveTrigger ? '↓' : '↑'
                              ) : (
                                isPriceAboveTrigger ? '↑' : '↓'
                              )}
                            </div>
                            <div className="price-box trigger-price">
                              <div className="price-label">Trigger Price</div>
                              <div className="price-amount" title="Price in SOL per token at which order will execute">
                                {formatPrice(triggerPrice)} SOL
                              </div>
                            </div>
                          </div>
                          
                          {/* Percentage Difference Badge */}
                          <div className={`price-diff-badge ${
                            orderType === 'buy' 
                              ? (isPriceAboveTrigger ? 'away' : 'close') 
                              : (isPriceAboveTrigger ? 'close' : 'away')
                          }`}>
                            {Math.abs(priceDiffPercent)}% {
                              orderType === 'buy'
                                ? (isPriceAboveTrigger ? 'above target' : 'below target')
                                : (isPriceAboveTrigger ? 'above target' : 'below target')
                            }
                          </div>
                        </div>

                        {/* Order Details Grid */}
                        <div className="order-details-grid">
                          <div className="detail-card">
                            <div className="detail-icon">💰</div>
                            <div className="detail-content">
                              <div className="detail-label">Amount</div>
                              <div className="detail-value-large">
                                {amount > 0 ? amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6
                                }) : '0.00'} {tokenSymbol}
                              </div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <div className="detail-icon">⏱️</div>
                            <div className="detail-content">
                              <div className="detail-label">Created</div>
                              <div className="detail-value-large">{timeAgo}</div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <div className="detail-icon">⏰</div>
                            <div className="detail-content">
                              <div className="detail-label">Expires In</div>
                              <div className={`detail-value-large ${expiryWarning ? 'expiry-warning' : ''}`}>
                                {expiryText}
                              </div>
                            </div>
                          </div>
                          
                          <div className="detail-card">
                            <div className="detail-icon">💵</div>
                            <div className="detail-content">
                              <div className="detail-label">Est. Value</div>
                              <div className="detail-value-large">
                                {estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : '0 SOL'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Additional Info */}
                        <div className="order-additional-info">
                          <div className="info-row">
                            <span className="info-icon">📅</span>
                            <span className="info-text">Created on {formatDate(createdAt)}</span>
                          </div>
                          {orderId && orderId !== 'unknown' && (
                            <div className="info-row">
                              <span className="info-icon">🔑</span>
                              <span className="info-text">Order ID: {orderId.slice(0, 8)}...{orderId.slice(-6)}</span>
                            </div>
                          )}
                          {/* Transaction Signatures with Solscan Links */}
                          {order.createTxSignature && (
                            <div className="info-row">
                              <span className="info-icon">📝</span>
                              <span className="info-text">
                                Create TX:{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.createTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                >
                                  {order.createTxSignature.slice(0, 8)}...{order.createTxSignature.slice(-6)} ↗
                                </a>
                              </span>
                            </div>
                          )}
                          {order.updateTxSignature && (
                            <div className="info-row">
                              <span className="info-icon">🔄</span>
                              <span className="info-text">
                                Update TX:{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.updateTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                >
                                  {order.updateTxSignature.slice(0, 8)}...{order.updateTxSignature.slice(-6)} ↗
                                </a>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Cancel Button */}
                        <div className="order-actions">
                          <button
                            className={`cancel-order-btn ${isExpired ? 'expired-urgent' : ''}`}
                            onClick={() => handleCancelOrder(orderId)}
                            disabled={cancellingOrder === orderId}
                          >
                            {cancellingOrder === orderId 
                              ? '⏳ Cancelling...' 
                              : isExpired 
                                ? '⚡ CANCEL & RETRIEVE FUNDS' 
                                : '🗑️ Cancel Order'}
                          </button>
                          
                          {/* Always show Jupiter link as backup option */}
                          <p className="cancel-note">
                            {isExpired ? (
                              <>
                                Click to return your funds from escrow<br/>
                                or{' '}
                              </>
                            ) : (
                              <>Having issues? Try{' '}</>
                            )}
                            <a
                              href={`https://jup.ag/limit/${publicKey?.toString() || ''}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="jupiter-cancel-link"
                            >
                              {isExpired ? 'manage on Jupiter ↗' : 'canceling on Jupiter ↗'}
                            </a>
                          </p>
                        </div>
                      </>
                    )}

                    {/* Simplified History Order Info */}
                    {status !== 'active' && (
                      <div className="order-details">
                        {/* EXPIRED BADGE for history orders with action buttons */}
                        {isExpired && order.status !== 'cancelled' && order.status !== 'executed' && (
                          <div className="expired-badge-history">
                            <div className="expired-badge-header">
                              <span>⚠️</span>
                              <span>This order expired - Retrieve your funds now!</span>
                            </div>
                            <div className="expired-badge-note">
                              Your funds are held in Jupiter's escrow. You must cancel this order to get them back.
                            </div>
                            <div className="expired-badge-actions">
                              <button
                                onClick={() => handleCancelOrder(orderId)}
                                disabled={cancellingOrder === orderId}
                                className="retrieve-btn-primary"
                              >
                                {cancellingOrder === orderId ? '⏳ Cancelling...' : '💰 Cancel & Retrieve'}
                              </button>
                              <a
                                href={`https://jup.ag/limit/${publicKey?.toString() || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="retrieve-btn-secondary"
                              >
                                <span>Or use Jupiter</span>
                                <span>↗</span>
                              </a>
                            </div>
                          </div>
                        )}
                        <div className="order-detail-row">
                          <span className="detail-label">Trigger Price:</span>
                          <span className="detail-value">${formatPrice(triggerPrice)}</span>
                        </div>
                        <div className="order-detail-row">
                          <span className="detail-label">Amount:</span>
                          <span className="detail-value">{amount.toFixed(2)} {tokenSymbol}</span>
                        </div>
                        <div className="order-detail-row">
                          <span className="detail-label">Created:</span>
                          <span className="detail-value">{formatDate(createdAt)}</span>
                        </div>
                        {status === 'executed' && order.executedAt && (
                          <div className="order-executed-info">
                            <span className="executed-label">✓ Executed:</span>
                            <span className="executed-date">{formatDate(order.executedAt)}</span>
                          </div>
                        )}
                        {status === 'cancelled' && order.cancelTxSignature && (
                          <div className="order-cancelled-info">
                            <span className="cancelled-label">✓ Cancelled:</span>
                            <a 
                              href={`https://solscan.io/tx/${order.cancelTxSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tx-link"
                            >
                              View TX ↗
                            </a>
                          </div>
                        )}
                        {/* Transaction Signatures */}
                        <div className="order-tx-signatures">
                          {order.createTxSignature && (
                            <div className="tx-sig-row">
                              <span className="tx-label">Create:</span>
                              <a 
                                href={`https://solscan.io/tx/${order.createTxSignature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx-link"
                              >
                                {order.createTxSignature.slice(0, 8)}...{order.createTxSignature.slice(-6)} ↗
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* Transactions Section */}
        {activeSection === 'transactions' && (
          <div className="transactions-section">
            <div className="transactions-header">
              <div className="transactions-header-top">
                <h3>Recent Transactions</h3>
                <div className="transactions-header-buttons">
                  <button 
                    className="sync-blockchain-btn"
                    onClick={fetchTransactions}
                    disabled={loadingTransactions}
                    title="Sync with blockchain"
                  >
                    {loadingTransactions ? '🔄' : '🔄 Sync'}
                  </button>
                  <button 
                    className="clear-refresh-btn"
                    onClick={handleClearAndRefresh}
                    disabled={loadingTransactions}
                    title="Clear cache and refresh from blockchain"
                  >
                    🗑️ Refresh
                  </button>
                </div>
              </div>
              <p className="transactions-subtitle">Your swap transactions on Solana</p>
            </div>

            {loadingTransactions ? (
              <div className="transactions-loading">
                <div className="loading-spinner"></div>
                <p>Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="transactions-empty">
                <div className="empty-icon">💸</div>
                <p>No transactions yet</p>
                <span className="empty-hint">
                  Your meme coin purchases will appear here when you buy through Moonfeed
                </span>
              </div>
            ) : (
              <div className="transactions-list">
                {transactions.map((tx) => {
                  const timeAgo = formatTimeAgo(tx.timestamp);
                  
                  return (
                    <div key={tx.id || tx.signature} className="transaction-card">
                      <div className="transaction-header">
                        <div className="transaction-token">
                          {tx.tokenImage ? (
                            <img 
                              src={tx.tokenImage} 
                              alt={tx.tokenSymbol}
                              className="transaction-token-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="transaction-token-placeholder" style={{ display: tx.tokenImage ? 'none' : 'flex' }}>
                            {tx.tokenSymbol?.charAt(0) || '?'}
                          </div>
                          <div className="transaction-token-info">
                            <span className="transaction-symbol">{tx.tokenSymbol || 'Unknown'}</span>
                            <span className="transaction-name">{tx.tokenName || tx.tokenSymbol}</span>
                          </div>
                        </div>
                        <div className={`transaction-type ${tx.type}`}>
                          {tx.type === 'buy' ? '🟢 Buy' : '🔴 Sell'}
                        </div>
                      </div>

                      <div className="transaction-details">
                        <div className="transaction-detail-row">
                          <span className="detail-label">Amount Spent:</span>
                          <span className="detail-value">{tx.inputAmount?.toFixed(4) || '0'} SOL</span>
                        </div>
                        <div className="transaction-detail-row">
                          <span className="detail-label">Tokens Received:</span>
                          <span className="detail-value">
                            {tx.outputAmount ? tx.outputAmount.toLocaleString(undefined, {
                              maximumFractionDigits: 2
                            }) : '0'} {tx.tokenSymbol}
                          </span>
                        </div>
                        {tx.pricePerToken > 0 && (
                          <div className="transaction-detail-row">
                            <span className="detail-label">Price per Token:</span>
                            <span className="detail-value">
                              {tx.pricePerToken < 0.000001 
                                ? tx.pricePerToken.toExponential(4) 
                                : tx.pricePerToken.toFixed(8)} SOL
                            </span>
                          </div>
                        )}
                        <div className="transaction-detail-row">
                          <span className="detail-label">Time:</span>
                          <span className="detail-value">{timeAgo}</span>
                        </div>
                      </div>

                      <div className="transaction-actions">
                        <a
                          href={`https://solscan.io/tx/${tx.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-tx-btn"
                        >
                          View on Solscan ↗
                        </a>
                        <button
                          className="delete-tx-btn"
                          onClick={() => handleDeleteTransaction(tx.signature)}
                          title="Remove from history"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Limit Order Info Modal */}
      {showLimitOrderInfo && (
        <div className="limit-order-info-modal" onClick={() => setShowLimitOrderInfo(false)}>
          <div className="limit-order-info-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="close-modal-btn"
              onClick={() => setShowLimitOrderInfo(false)}
            >
              ✕
            </button>
            
            <h2>What are Limit Orders?</h2>
            
            <div className="info-section">
              <h3>The Basics</h3>
              <p>
                A <strong>limit order</strong> lets you buy or sell a token at a specific price you set, 
                rather than the current market price. Your order sits on the blockchain and automatically 
                executes when the market reaches your target price.
              </p>
            </div>

            <div className="info-section">
              <h3>How It Works</h3>
              <ul>
                <li><strong>Set Your Price:</strong> Choose the exact price you want to buy or sell at</li>
                <li><strong>Wait for Match:</strong> Your order waits on-chain until the market hits your price</li>
                <li><strong>Auto Execute:</strong> When conditions are met, the trade happens automatically</li>
                <li><strong>Full Control:</strong> Cancel anytime before execution</li>
              </ul>
            </div>

            <div className="info-section">
              <h3>Benefits</h3>
              <ul>
                <li><strong>Price Control:</strong> You decide the exact price, no surprises</li>
                <li><strong>No Watching:</strong> Set it and forget it - trades happen automatically</li>
                <li><strong>Reduced Slippage:</strong> No more getting rekt by market orders</li>
                <li><strong>Smart Trading:</strong> Buy dips or sell peaks without being glued to charts</li>
              </ul>
            </div>

            <div className="info-section">
              <h3>Things to Know</h3>
              <ul>
                <li>Orders may not fill if the market doesn't reach your price</li>
                <li>You can set expiration times to auto-cancel orders</li>
                <li>Small fees apply for creating and canceling orders</li>
                <li>Orders are stored on-chain via Jupiter's DCA/Limit Order program</li>
              </ul>
            </div>

            <div className="info-section powered-by">
              <p>
                <strong>Powered by Jupiter Exchange</strong> - The leading DEX aggregator on Solana
              </p>
            </div>

            <button 
              className="got-it-btn"
              onClick={() => setShowLimitOrderInfo(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersView;
