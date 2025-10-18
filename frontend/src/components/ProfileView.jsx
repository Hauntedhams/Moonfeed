import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getFullApiUrl } from '../config/api';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import WalletPopup from './WalletPopup';
import './ProfileView.css';

const ProfileView = () => {
  const { publicKey, connected, disconnect, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const fileInputRef = useRef(null);
  const { trackedWallets, untrackWallet } = useTrackedWallets();
  const [selectedWallet, setSelectedWallet] = useState(null);

  // Fetch SOL balance when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
      fetchOrders();
      loadProfilePicture();
    } else {
      setBalance(null);
      setOrders([]);
      setProfilePicture(null);
    }
  }, [connected, publicKey, connection]);

  // Refresh orders when filter changes
  useEffect(() => {
    if (connected && publicKey) {
      fetchOrders();
    }
  }, [statusFilter]);

  const fetchBalance = async () => {
    if (!publicKey || !connection) return;
    
    setIsLoadingBalance(true);
    try {
      const balance = await connection.getBalance(publicKey);
      setBalance(balance / 1000000000); // Convert lamports to SOL
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    const str = address.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Fetch active orders
  const fetchOrders = async () => {
    if (!publicKey) return;
    
    setLoadingOrders(true);
    setOrdersError(null);

    try {
      const walletAddress = publicKey.toString();
      const url = getFullApiUrl(`/api/trigger/orders?wallet=${walletAddress}&status=${statusFilter}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const result = await response.json();
      
      if (result.success) {
        // Orders are now fully enriched by backend with all data
        setOrders(result.orders || []);
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
      const { Transaction, VersionedTransaction, Connection } = await import('@solana/web3.js');
      
      // Decode the transaction - try both formats
      let transaction;
      let isVersioned = false;
      
      try {
        // First, try to decode as versioned transaction (v0)
        const transactionBuffer = Buffer.from(result.transaction, 'base64');
        transaction = VersionedTransaction.deserialize(transactionBuffer);
        isVersioned = true;
        console.log('[Cancel Order] Decoded as versioned transaction');
      } catch (versionedError) {
        console.log('[Cancel Order] Not a versioned transaction, trying legacy format...');
        
        // Fallback to legacy transaction
        try {
          const transactionBuffer = Buffer.from(result.transaction, 'base64');
          transaction = Transaction.from(transactionBuffer);
          console.log('[Cancel Order] Decoded as legacy transaction');
        } catch (legacyError) {
          console.error('[Cancel Order] Failed to decode as both versioned and legacy:', {
            versionedError: versionedError.message,
            legacyError: legacyError.message
          });
          throw new Error('Failed to decode transaction. The order may need to be cancelled directly on Jupiter.ag/limit');
        }
      }
      
      // For versioned transactions, we need to populate recent blockhash
      if (isVersioned) {
        try {
          const recentBlockhash = await connection.getLatestBlockhash();
          transaction.message.recentBlockhash = recentBlockhash.blockhash;
          console.log('[Cancel Order] Updated versioned transaction with recent blockhash');
        } catch (blockHashError) {
          console.warn('[Cancel Order] Could not update blockhash:', blockHashError.message);
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
      
      // Show success message with transaction link
      const signature = executeResult.signature;
      if (confirm(`Order cancelled successfully!\n\nTransaction: ${signature}\n\nClick OK to view on Solscan`)) {
        window.open(`https://solscan.io/tx/${signature}`, '_blank');
      }

      // Refresh orders
      await fetchOrders();
    } catch (err) {
      console.error('[Cancel Order] ❌ Error:', err);
      
      // More detailed error message
      let errorMessage = 'Failed to cancel order: ' + err.message;
      
      if (err.message.includes('User rejected')) {
        errorMessage = 'Order cancellation was rejected. Please approve the transaction in your wallet to cancel the order.';
      } else if (err.message.includes('Wallet does not support')) {
        errorMessage = 'Your wallet does not support transaction signing. Please use a compatible wallet.';
      }
      
      alert(errorMessage);
    } finally {
      setCancellingOrder(null);
    }
  };

  // Profile picture management
  const loadProfilePicture = () => {
    if (!publicKey) return;
    const saved = localStorage.getItem(`profilePic_${publicKey.toString()}`);
    if (saved) {
      setProfilePicture(saved);
    }
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setProfilePicture(base64String);
      // Save to localStorage
      if (publicKey) {
        localStorage.setItem(`profilePic_${publicKey.toString()}`, base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    if (publicKey) {
      localStorage.removeItem(`profilePic_${publicKey.toString()}`);
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

  if (!connected) {
    return (
      <div className="profile-view">
        <div className="profile-container">
          {/* Header */}
          <div className="profile-header">
            <div className="profile-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h1>Profile</h1>
            <p className="profile-subtitle">Connect your wallet to access your Moonfeed profile</p>
          </div>

          {/* Wallet Connection Section */}
          <div className="wallet-connection-section">
            <div className="connection-card">
              <div className="connection-icon">🔗</div>
              <h3>Connect Wallet</h3>
              <p>Connect your Solana wallet to view transaction history, manage favorites, and access advanced features.</p>
              <div className="wallet-button-container">
                <WalletMultiButton />
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="features-preview">
            <h3>What you'll get access to:</h3>
            <div className="feature-grid">
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <div className="feature-content">
                  <h4>Transaction History</h4>
                  <p>View your complete Solana trading history</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">⭐</div>
                <div className="feature-content">
                  <h4>Synced Favorites</h4>
                  <p>Your favorites synced across devices</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎯</div>
                <div className="feature-content">
                  <h4>Portfolio Tracking</h4>
                  <p>Track your meme coin portfolio performance</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔔</div>
                <div className="feature-content">
                  <h4>Price Alerts</h4>
                  <p>Get notified when your coins hit target prices</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <div className="feature-content">
                  <h4>Quick Trading</h4>
                  <p>One-click trading with Jupiter integration</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📈</div>
                <div className="feature-content">
                  <h4>Advanced Analytics</h4>
                  <p>Detailed insights into your trading patterns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-view">
      <div className="profile-container">
        {/* Profile Picture at Top Center */}
        <div className="profile-picture-section">
          <div 
            className="profile-picture-wrapper"
            onClick={() => fileInputRef.current?.click()}
            title="Click to change profile picture"
          >
            {profilePicture ? (
              <img 
                src={profilePicture} 
                alt="Profile" 
                className="profile-picture"
              />
            ) : (
              <div className="profile-picture-placeholder">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
            )}
            <div className="connected-badge">✓</div>
          </div>
          
          {/* Hidden file input for profile picture upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfilePictureChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Active Limit Orders Section - DIRECTLY BELOW PROFILE PICTURE */}
        <div className="profile-features">
          <div className="feature-section orders-section">
            <div className="orders-header">
              <h3>📊 Limit Orders</h3>
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
                  
                  // Validate createdAt
                  try {
                    const testDate = new Date(createdAt);
                    if (isNaN(testDate.getTime())) {
                      console.warn('Invalid createdAt timestamp:', createdAt);
                      createdAt = new Date().toISOString();
                    }
                  } catch (err) {
                    console.error('Error parsing createdAt:', err);
                    createdAt = new Date().toISOString();
                  }
                  
                  // Validate expiresAt
                  if (expiresAt) {
                    try {
                      const testDate = new Date(expiresAt);
                      if (isNaN(testDate.getTime())) {
                        console.warn('Invalid expiresAt timestamp:', expiresAt);
                        expiresAt = null;
                      }
                    } catch (err) {
                      console.error('Error parsing expiresAt:', err);
                      expiresAt = null;
                    }
                  }
                  
                  const estimatedValue = order.estimatedValue || 0;
                  const orderId = order.orderId || order.id || 'unknown';
                  
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
                  
                  // Calculate expiration time if available
                  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
                  const timeUntilExpiry = expiresAtDate && expiresAtDate > now ? expiresAtDate - now : null;
                  const hoursUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60)) : null;
                  const minutesUntilExpiry = timeUntilExpiry ? Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60)) : null;
                  const expiryText = hoursUntilExpiry !== null 
                    ? (hoursUntilExpiry > 0 ? `${hoursUntilExpiry}h ${minutesUntilExpiry}m` : `${minutesUntilExpiry}m`)
                    : 'No expiry';
                  
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
                          {/* Price Progress Section */}
                          <div className="order-price-progress">
                            <div className="price-comparison">
                              <div className="price-box current-price">
                                <div className="price-label">Current Price</div>
                                <div className="price-amount">${formatPrice(currentPrice)}</div>
                              </div>
                              <div className="price-arrow">
                                {order.type === 'buy' ? (
                                  isPriceAboveTrigger ? '↓' : '↑'
                                ) : (
                                  isPriceAboveTrigger ? '↑' : '↓'
                                )}
                              </div>
                              <div className="price-box trigger-price">
                                <div className="price-label">Trigger Price</div>
                                <div className="price-amount">${formatPrice(triggerPrice)}</div>
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
                                <div className="detail-value-large">{expiryText}</div>
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
                                    style={{ color: '#4FC3F7', textDecoration: 'underline' }}
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
                                    style={{ color: '#4FC3F7', textDecoration: 'underline' }}
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
                              className="cancel-order-btn"
                              onClick={() => handleCancelOrder(orderId)}
                              disabled={cancellingOrder === orderId}
                            >
                              {cancellingOrder === orderId ? '⏳ Cancelling...' : '🗑️ Cancel Order'}
                            </button>
                          </div>
                        </>
                      )}

                      {/* Simplified History Order Info */}
                      {status !== 'active' && (
                        <div className="order-details">
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
                                style={{ color: '#4FC3F7', textDecoration: 'underline', marginLeft: '8px' }}
                              >
                                View TX ↗
                              </a>
                            </div>
                          )}
                          {/* Transaction Signatures */}
                          <div className="order-tx-signatures" style={{ marginTop: '12px', fontSize: '0.85rem', color: 'rgba(0,0,0,0.6)' }}>
                            {order.createTxSignature && (
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Create:</span>{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.createTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                  style={{ color: '#4FC3F7', textDecoration: 'underline' }}
                                >
                                  {order.createTxSignature.slice(0, 8)}...{order.createTxSignature.slice(-6)} ↗
                                </a>
                              </div>
                            )}
                            {order.executeTxSignature && (
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Execute:</span>{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.executeTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                  style={{ color: '#4FC3F7', textDecoration: 'underline' }}
                                >
                                  {order.executeTxSignature.slice(0, 8)}...{order.executeTxSignature.slice(-6)} ↗
                                </a>
                              </div>
                            )}
                            {order.cancelTxSignature && (
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Cancel:</span>{' '}
                                <a 
                                  href={`https://solscan.io/tx/${order.cancelTxSignature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                  style={{ color: '#4FC3F7', textDecoration: 'underline' }}
                                >
                                  {order.cancelTxSignature.slice(0, 8)}...{order.cancelTxSignature.slice(-6)} ↗
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

          {/* Wallet Info */}
          <div className="wallet-info-section">
            <div className="wallet-info-card">
              <div className="wallet-header">
                <h3>💼 Wallet Information</h3>
                <button 
                  className="disconnect-btn"
                  onClick={disconnect}
                  title="Disconnect wallet"
                >
                  Disconnect
                </button>
              </div>
              
              <div className="wallet-details">
                <div className="wallet-address-row">
                  <span className="label">Address:</span>
                  <div className="address-container">
                    <span className="address">{formatAddress(publicKey)}</span>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(publicKey?.toString())}
                      title="Copy full address"
                    >
                      📋
                    </button>
                  </div>
                </div>
                
                <div className="balance-row">
                  <span className="label">SOL Balance:</span>
                  <div className="balance-container">
                    {isLoadingBalance ? (
                      <span className="loading">Loading...</span>
                    ) : balance !== null ? (
                      <span className="balance">{balance.toFixed(4)} SOL</span>
                    ) : (
                      <span className="error">Unable to load</span>
                    )}
                    <button 
                      className="refresh-btn"
                      onClick={fetchBalance}
                      disabled={isLoadingBalance}
                      title="Refresh balance"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tracked Wallets Section */}
          <div className="feature-section">
            <h3>👀 Tracked Wallets ({trackedWallets.length})</h3>
            {trackedWallets.length === 0 ? (
              <div className="empty-state">
                <p>No tracked wallets yet</p>
                <p className="empty-state-hint">Click "Track" on any wallet to add it here</p>
              </div>
            ) : (
              <div className="tracked-wallets-list">
                {trackedWallets.map((wallet) => (
                  <div key={wallet.address} className="tracked-wallet-item">
                    <div className="tracked-wallet-info">
                      <div 
                        className="tracked-wallet-address"
                        onClick={() => setSelectedWallet(wallet.address)}
                        title="Click to view analytics"
                      >
                        <span className="wallet-icon">👛</span>
                        <span className="wallet-addr">{wallet.address.slice(0, 4)}...{wallet.address.slice(-4)}</span>
                      </div>
                      <div className="tracked-wallet-meta">
                        <span className="wallet-label">{wallet.label}</span>
                        <span className="wallet-date">Added {new Date(wallet.addedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="tracked-wallet-actions">
                      <button
                        className="view-wallet-btn"
                        onClick={() => setSelectedWallet(wallet.address)}
                        title="View analytics"
                      >
                        📊
                      </button>
                      <button
                        className="untrack-wallet-btn"
                        onClick={() => untrackWallet(wallet.address)}
                        title="Untrack wallet"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="feature-section">
            <h3>🎯 Portfolio Tracking</h3>
            <div className="coming-soon-feature">
              <p>Track your meme coin portfolio performance and P&L.</p>
              <span className="coming-soon-badge">Coming Soon</span>
            </div>
          </div>

          <div className="feature-section">
            <h3>⚙️ Settings</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <span>Network:</span>
                <span className="setting-value">Solana Mainnet</span>
              </div>
              <div className="setting-item">
                <span>Theme:</span>
                <span className="setting-value">Dark Mode</span>
              </div>
              <div className="setting-item">
                <span>Currency:</span>
                <span className="setting-value">USD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WalletPopup for viewing tracked wallet analytics */}
      {selectedWallet && (
        <WalletPopup
          walletAddress={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}
    </div>
  );
};

export default ProfileView;
