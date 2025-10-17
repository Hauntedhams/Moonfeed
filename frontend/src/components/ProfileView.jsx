import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getFullApiUrl } from '../config/api';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import WalletPopup from './WalletPopup';
import './ProfileView.css';

const ProfileView = () => {
  const { publicKey, connected, disconnect } = useWallet();
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
    setCancellingOrder(orderId);

    try {
      const walletAddress = publicKey.toString();
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
        throw new Error(result.error || 'Failed to cancel order');
      }

      // Refresh orders
      await fetchOrders();
    } catch (err) {
      console.error('Error canceling order:', err);
      alert(`Failed to cancel order: ${err.message}`);
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
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        {/* Connected Header with Profile Picture */}
        <div className="profile-header connected">
          <div className="profile-picture-section">
            <div className="profile-picture-container">
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt="Profile" 
                  className="profile-picture"
                />
              ) : (
                <div className="profile-picture-placeholder">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              )}
              <div className="connected-indicator">✓</div>
            </div>
            <div className="profile-picture-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
              />
              <button 
                className="change-picture-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                {profilePicture ? 'Change Photo' : 'Add Photo'}
              </button>
              {profilePicture && (
                <button 
                  className="remove-picture-btn"
                  onClick={removeProfilePicture}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <h1>Welcome Back!</h1>
          <p className="profile-subtitle">Your Moonfeed profile is ready</p>
        </div>

        {/* Wallet Info */}
        <div className="wallet-info-section">
          <div className="wallet-info-card">
            <div className="wallet-header">
              <h3>Wallet Information</h3>
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

        {/* Active Limit Orders Section */}
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
                {orders.map((order) => (
                  <div key={order.id} className="order-card">
                    <div className="order-header">
                      <div className="order-token">
                        <span className="token-symbol">{order.tokenSymbol || 'Unknown'}</span>
                        <span className={`order-type ${order.type}`}>
                          {order.type === 'buy' ? '🟢 Buy' : '🔴 Sell'}
                        </span>
                      </div>
                      <div className={`order-status ${order.status}`}>
                        {order.status}
                      </div>
                    </div>

                    <div className="order-details">
                      <div className="order-detail-row">
                        <span className="detail-label">Trigger Price:</span>
                        <span className="detail-value">${formatPrice(order.triggerPrice)}</span>
                      </div>
                      <div className="order-detail-row">
                        <span className="detail-label">Amount:</span>
                        <span className="detail-value">{order.amount} {order.tokenSymbol}</span>
                      </div>
                      {order.currentPrice && (
                        <div className="order-detail-row">
                          <span className="detail-label">Current Price:</span>
                          <span className="detail-value">${formatPrice(order.currentPrice)}</span>
                        </div>
                      )}
                      <div className="order-detail-row">
                        <span className="detail-label">Created:</span>
                        <span className="detail-value">{formatDate(order.createdAt)}</span>
                      </div>
                    </div>

                    {order.status === 'active' && (
                      <div className="order-actions">
                        <button
                          className="cancel-order-btn"
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancellingOrder === order.id}
                        >
                          {cancellingOrder === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      </div>
                    )}

                    {order.status === 'executed' && order.executedAt && (
                      <div className="order-executed-info">
                        <span className="executed-label">✓ Executed:</span>
                        <span className="executed-date">{formatDate(order.executedAt)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
