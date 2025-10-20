import React, { useState, useEffect, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getFullApiUrl } from '../config/api';
import { useTrackedWallets } from '../contexts/TrackedWalletsContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import WalletPopup from './WalletPopup';
import './ProfileView.css';

const ProfileView = () => {
  const { publicKey, connected, disconnect, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
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
    const setupWallet = async () => {
      if (connected && publicKey) {
        fetchBalance();
        fetchOrders();
        loadProfilePicture();
      } else {
        setBalance(null);
        setOrders([]);
        setProfilePicture(null);
        
        // Clear order caches on disconnect
        const { clearAllOrderCaches } = await import('../utils/orderCache.js');
        clearAllOrderCaches();
      }
    };
    
    setupWallet();
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
          console.warn(`[Profile] Found ${expiredOrders.length} expired order(s) in cached active orders`);
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
            console.warn(`[Profile] Found ${expiredOrders.length} expired order(s) in active orders:`, 
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
      console.log('[Cancel Order] Transaction data:', {
        hasTransaction: !!result.transaction,
        transactionLength: result.transaction?.length,
        requestId: result.requestId
      });

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
            legacyError: legacyError.message,
            transactionPreview: result.transaction?.substring(0, 100)
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
          {/* Dark Mode Toggle Switch - Top Left */}
          <div className="dark-mode-toggle-container" title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                id="darkModeToggle" 
                checked={isDarkMode}
                onChange={toggleDarkMode}
              />
              <label htmlFor="darkModeToggle" className="toggle-slider">
                <span className="toggle-icon sun">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                <span className="toggle-icon moon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </label>
            </div>
          </div>

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
                <div className="feature-content">
                  <h4>Transaction History</h4>
                  <p>View your complete Solana trading history</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-content">
                  <h4>Synced Favorites</h4>
                  <p>Your favorites synced across devices</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-content">
                  <h4>Portfolio Tracking</h4>
                  <p>Track your meme coin portfolio performance</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-content">
                  <h4>Price Alerts</h4>
                  <p>Get notified when your coins hit target prices</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-content">
                  <h4>Quick Trading</h4>
                  <p>One-click trading with Jupiter integration</p>
                </div>
              </div>
              <div className="feature-item">
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
        {/* Dark Mode Toggle Switch - Top Left */}
        <div className="dark-mode-toggle-container" title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
          <div className="toggle-switch">
            <input 
              type="checkbox" 
              id="darkModeToggleConnected" 
              checked={isDarkMode}
              onChange={toggleDarkMode}
            />
            <label htmlFor="darkModeToggleConnected" className="toggle-slider">
              <span className="toggle-icon sun">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="toggle-icon moon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </label>
          </div>
        </div>

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
                  
                  // Safe timestamp handling with improved validation
                  let createdAt = order.createdAt;
                  let expiresAt = order.expiresAt;
                  let expiresAtRaw = order.expiresAt; // Keep raw value for debugging
                  
                  // Validate createdAt
                  try {
                    if (!createdAt) {
                      console.warn('[Order] No createdAt provided, using current time');
                      createdAt = new Date().toISOString();
                    } else {
                      const testDate = new Date(createdAt);
                      if (isNaN(testDate.getTime())) {
                        console.warn('[Order] Invalid createdAt timestamp:', createdAt, 'using current time');
                        createdAt = new Date().toISOString();
                      } else {
                        // Valid date - ensure ISO format
                        createdAt = testDate.toISOString();
                      }
                    }
                  } catch (err) {
                    console.error('[Order] Error parsing createdAt:', err, 'raw value:', createdAt);
                    createdAt = new Date().toISOString();
                  }
                  
                  // Validate expiresAt with more lenient parsing
                  if (expiresAt) {
                    try {
                      // Handle different timestamp formats
                      let parsedDate;
                      
                      // Try parsing as-is (ISO string or timestamp)
                      parsedDate = new Date(expiresAt);
                      
                      // If that failed, try parsing as Unix timestamp (seconds)
                      if (isNaN(parsedDate.getTime()) && typeof expiresAt === 'number') {
                        parsedDate = new Date(expiresAt * 1000);
                      }
                      
                      // If still invalid, try parsing as Unix timestamp (milliseconds)
                      if (isNaN(parsedDate.getTime()) && typeof expiresAt === 'number') {
                        parsedDate = new Date(expiresAt);
                      }
                      
                      // Validate the parsed date
                      if (isNaN(parsedDate.getTime())) {
                        console.warn('[Order] Could not parse expiresAt:', expiresAtRaw, 'type:', typeof expiresAt);
                        // DON'T set to null - keep the raw value for debugging
                        expiresAt = expiresAtRaw;
                      } else {
                        // Valid date - normalize to ISO format
                        expiresAt = parsedDate.toISOString();
                        if (!import.meta.env.PROD) {
                          console.log('[Order] ✅ Parsed expiry:', expiresAtRaw, '→', expiresAt);
                        }
                      }
                    } catch (err) {
                      console.error('[Order] Error parsing expiresAt:', err, 'raw value:', expiresAtRaw);
                      // DON'T set to null - keep the raw value
                      expiresAt = expiresAtRaw;
                    }
                  }
                  
                  // Extract order ID and value EARLY (before any usage)
                  const orderId = order.orderId || order.id || 'unknown';
                  const estimatedValue = order.estimatedValue || 0;
                  
                  // Log if no expiry is set (now orderId is defined)
                  if (!expiresAt && !import.meta.env.PROD) {
                    console.log('[Order] No expiry set for order:', orderId);
                  }
                  
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
                  
                  // Calculate expiration time if available with better error handling
                  let expiresAtDate = null;
                  let expiryParseError = false;
                  
                  if (expiresAt) {
                    try {
                      expiresAtDate = new Date(expiresAt);
                      
                      // Final validation check
                      if (isNaN(expiresAtDate.getTime())) {
                        console.warn('[Order] Expiry date is invalid after parsing:', expiresAt);
                        expiryParseError = true;
                        expiresAtDate = null;
                      } else {
                        // Sanity check: expiry should be in the future or recent past (not decades ago/ahead)
                        const yearsDiff = Math.abs(expiresAtDate.getFullYear() - now.getFullYear());
                        if (yearsDiff > 10) {
                          console.warn('[Order] Expiry date seems unrealistic:', expiresAtDate, '(years diff:', yearsDiff, ')');
                          expiryParseError = true;
                          expiresAtDate = null;
                        }
                      }
                    } catch (err) {
                      console.error('[Order] Exception parsing expiresAt for display:', err);
                      expiryParseError = true;
                      expiresAtDate = null;
                    }
                  }
                  
                  const isExpired = order.isExpired || isOrderExpired(order);
                  const timeUntilExpiry = expiresAtDate && expiresAtDate > now && !isExpired ? expiresAtDate - now : null;
                  const hoursUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60)) : null;
                  const minutesUntilExpiry = timeUntilExpiry ? Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60)) : null;
                  
                  // Calculate days if expiry is far in the future
                  const daysUntilExpiry = timeUntilExpiry ? Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24)) : null;
                  
                  let expiryText = 'No expiry';
                  let expiryWarning = false;
                  
                  if (expiryParseError && expiresAtRaw) {
                    // Show that we received expiry data but couldn't parse it
                    expiryText = '⚠️ Invalid format';
                    expiryWarning = true;
                  } else if (isExpired) {
                    expiryText = '⚠️ EXPIRED';
                    expiryWarning = true;
                  } else if (daysUntilExpiry !== null && daysUntilExpiry > 0) {
                    // Show days for expiry > 24 hours
                    const remainingHours = hoursUntilExpiry % 24;
                    expiryText = remainingHours > 0 
                      ? `${daysUntilExpiry}d ${remainingHours}h` 
                      : `${daysUntilExpiry}d`;
                    // Warning if less than 1 day remaining
                    expiryWarning = daysUntilExpiry === 0;
                  } else if (hoursUntilExpiry !== null) {
                    // Show hours/minutes for expiry < 24 hours
                    expiryText = hoursUntilExpiry > 0 
                      ? `${hoursUntilExpiry}h ${minutesUntilExpiry}m` 
                      : `${minutesUntilExpiry}m`;
                    // Warning if less than 1 hour remaining
                    expiryWarning = hoursUntilExpiry === 0 && minutesUntilExpiry < 60;
                  } else if (expiresAt && !expiresAtDate) {
                    // We have expiry data but couldn't parse it
                    expiryText = '⚠️ Parse error';
                    expiryWarning = true;
                  }
                  // else: expiryText stays as 'No expiry' (genuinely no expiry set)
                  
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
                          {/* EXPIRED ORDER WARNING - Show prominently if order is expired */}
                          {isExpired && (
                            <div className="expired-order-warning" style={{
                              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                              border: '2px solid #ff4757',
                              borderRadius: '12px',
                              padding: '16px',
                              marginBottom: '16px',
                              color: 'white',
                              boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '24px', marginRight: '10px' }}>⚠️</span>
                                <strong style={{ fontSize: '16px' }}>ORDER EXPIRED - FUNDS LOCKED IN ESCROW</strong>
                              </div>
                              <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: '1.4' }}>
                                This order expired on <strong>{formatDate(expiresAt)}</strong>. Your <strong>{estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'}</strong> are currently held in Jupiter's escrow program and will NOT be returned automatically.
                              </p>
                              <div style={{ 
                                background: 'rgba(0,0,0,0.2)', 
                                padding: '10px', 
                                borderRadius: '8px',
                                marginBottom: '12px',
                                fontSize: '13px',
                                fontFamily: 'monospace'
                              }}>
                                <div style={{ marginBottom: '6px' }}>
                                  <strong>🔒 Escrow Program:</strong>
                                  <br />
                                  <a 
                                    href="https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#4FC3F7', textDecoration: 'underline' }}
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
                                      style={{ color: '#4FC3F7', textDecoration: 'underline' }}
                                    >
                                      {orderId.slice(0, 8)}...{orderId.slice(-6)} ↗
                                    </a>
                                  </div>
                                )}
                              </div>
                              <div style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: 'rgba(0, 0, 0, 0.15)',
                                borderRadius: '8px',
                                fontSize: '13px'
                              }}>
                                <div style={{ fontWeight: '700', marginBottom: '8px' }}>
                                  🔧 TO RECOVER YOUR FUNDS:
                                </div>
                                <div style={{ marginBottom: '10px', lineHeight: '1.5' }}>
                                  <strong>Option 1:</strong> Click the "Cancel Order" button below
                                </div>
                                <div style={{ lineHeight: '1.5' }}>
                                  <strong>Option 2:</strong> Visit Jupiter's interface
                                  <div style={{ marginTop: '6px' }}>
                                    <a 
                                      href="https://jup.ag/limit"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ 
                                        color: '#ffffff', 
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        textDecoration: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontWeight: '600',
                                        fontSize: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.3)'
                                      }}
                                    >
                                      🔗 Open Jupiter Limit Orders ↗
                                    </a>
                                  </div>
                                </div>
                              </div>
                              <p style={{ margin: '12px 0 0 0', fontSize: '14px', fontWeight: '700', lineHeight: '1.4', textAlign: 'center' }}>
                                ⚡ Your {estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'} won't be returned automatically - you must cancel manually!
                              </p>
                            </div>
                          )}

                          {/* ESCROW INFO BADGE - Show for all active orders */}
                          {!isExpired && (
                            <div className="escrow-info-badge" style={{
                              background: 'linear-gradient(135deg, rgba(66, 153, 225, 0.15) 0%, rgba(49, 130, 206, 0.15) 100%)',
                              border: '2px solid rgba(66, 153, 225, 0.3)',
                              borderRadius: '12px',
                              padding: '14px',
                              marginBottom: '16px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px'
                            }}>
                              <div style={{ fontSize: '24px', flexShrink: 0 }}>🔒</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontSize: '14px', 
                                  fontWeight: '600', 
                                  marginBottom: '8px',
                                  color: '#2D3748'
                                }}>
                                  Funds Held in Jupiter Escrow
                                </div>
                                <div style={{ 
                                  fontSize: '13px', 
                                  lineHeight: '1.5',
                                  color: '#4A5568',
                                  marginBottom: '8px'
                                }}>
                                  Your <strong>{estimatedValue > 0 ? `${estimatedValue.toFixed(4)} SOL` : 'funds'}</strong> are securely held in a Program Derived Address (PDA) until the order executes or you cancel it.
                                </div>
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                  fontSize: '12px'
                                }}>
                                  <a 
                                    href="https://solscan.io/account/jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ 
                                      color: '#4FC3F7', 
                                      textDecoration: 'none',
                                      padding: '4px 8px',
                                      background: 'rgba(79, 195, 247, 0.1)',
                                      borderRadius: '6px',
                                      fontWeight: '500'
                                    }}
                                  >
                                    📋 View Escrow Program ↗
                                  </a>
                                  {orderId && orderId !== 'unknown' && (
                                    <a 
                                      href={`https://solscan.io/account/${orderId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ 
                                        color: '#4FC3F7', 
                                        textDecoration: 'none',
                                        padding: '4px 8px',
                                        background: 'rgba(79, 195, 247, 0.1)',
                                        borderRadius: '6px',
                                        fontWeight: '500'
                                      }}
                                    >
                                      📦 View Order Account ↗
                                    </a>
                                  )}
                                </div>
                                <div style={{
                                  marginTop: '10px',
                                  padding: '10px',
                                  background: 'rgba(237, 242, 247, 0.8)',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#2D3748',
                                  lineHeight: '1.6'
                                }}>
                                  <div style={{ marginBottom: '6px' }}>
                                    <strong>ℹ️ Important:</strong> If this order expires, your funds will remain in escrow. You must manually cancel the order to retrieve them.
                                  </div>
                                  <div style={{ 
                                    display: 'flex', 
                                    gap: '8px', 
                                    alignItems: 'center',
                                    marginTop: '8px'
                                  }}>
                                    <span style={{ fontSize: '11px', color: '#718096' }}>
                                      Cancel below or via
                                    </span>
                                    <a 
                                      href="https://jup.ag/limit"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ 
                                        color: '#3182ce', 
                                        textDecoration: 'none',
                                        fontWeight: '600',
                                        fontSize: '11px',
                                        padding: '3px 8px',
                                        background: 'rgba(49, 130, 206, 0.1)',
                                        borderRadius: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
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
                                  <div style={{ 
                                    fontSize: '10px', 
                                    color: '#10b981', 
                                    marginTop: '2px',
                                    fontWeight: '600'
                                  }}>
                                    ✓ Live Price
                                  </div>
                                )}
                                {order.currentPriceSource === 'fallback-trigger' && (
                                  <div style={{ 
                                    fontSize: '10px', 
                                    color: '#f59e0b', 
                                    marginTop: '2px',
                                    fontWeight: '600'
                                  }} title="Price API unavailable - showing trigger price">
                                    ⚠️ Using Trigger
                                  </div>
                                )}
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
                                <div className={`detail-value-large ${expiryWarning ? 'expiry-warning' : ''}`} style={{
                                  color: expiryWarning ? '#ff4757' : 'inherit',
                                  fontWeight: expiryWarning ? '700' : 'inherit'
                                }}>
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
                              className={`cancel-order-btn ${isExpired ? 'expired-urgent' : ''}`}
                              onClick={() => handleCancelOrder(orderId)}
                              disabled={cancellingOrder === orderId}
                              style={isExpired ? {
                                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '16px',
                                padding: '14px 24px',
                                boxShadow: '0 4px 15px rgba(255, 107, 107, 0.4)',
                                border: '2px solid #ff4757',
                                animation: 'pulse 2s infinite'
                              } : {}}
                            >
                              {cancellingOrder === orderId 
                                ? '⏳ Cancelling...' 
                                : isExpired 
                                  ? '⚡ CANCEL & RETRIEVE FUNDS' 
                                  : '🗑️ Cancel Order'}
                            </button>
                            
                            {/* Always show Jupiter link as backup option */}
                            <p style={{
                              margin: '8px 0 0 0',
                              fontSize: '12px',
                              color: isExpired ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.5)',
                              textAlign: 'center'
                            }}>
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
                                style={{
                                  color: '#4FC3F7',
                                  textDecoration: 'underline',
                                  fontWeight: '600'
                                }}
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
                            <div className="expired-badge-enhanced" style={{
                              background: 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)',
                              color: 'white',
                              padding: '14px',
                              borderRadius: '12px',
                              marginBottom: '12px',
                              fontSize: '13px',
                              fontWeight: '600',
                              border: '2px solid #ff5252',
                              boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
                            }}>
                              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '16px' }}>⚠️</span>
                                <span>This order expired - Retrieve your funds now!</span>
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '12px', lineHeight: '1.4' }}>
                                Your funds are held in Jupiter's escrow. You must cancel this order to get them back.
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleCancelOrder(orderId)}
                                  disabled={cancellingOrder === orderId}
                                  className="retrieve-funds-btn-primary"
                                  style={{
                                    background: 'white',
                                    color: '#ff6b6b',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: cancellingOrder === orderId ? 'not-allowed' : 'pointer',
                                    opacity: cancellingOrder === orderId ? 0.6 : 1,
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    flex: '1 1 auto',
                                    minWidth: '140px',
                                    maxWidth: '200px'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (cancellingOrder !== orderId) {
                                      e.target.style.transform = 'translateY(-2px)';
                                      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                  }}
                                >
                                  {cancellingOrder === orderId ? '⏳ Cancelling...' : '💰 Cancel & Retrieve'}
                                </button>
                                <a
                                  href={`https://jup.ag/limit/${publicKey?.toString() || ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="retrieve-funds-btn-secondary"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    color: 'white',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s ease',
                                    flex: '1 1 auto',
                                    minWidth: '140px',
                                    maxWidth: '200px',
                                    justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                                  }}
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
                      </svg>
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tracked Wallets Section */}
          <div className="feature-section">
            <h3>Tracked Wallets ({trackedWallets.length})</h3>
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
                        <span className="wallet-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            <circle cx="17" cy="17" r="4" stroke="currentColor" strokeWidth="2"/>
                            <path d="M19 17h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </span>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="m19 9-5 5-4-4-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
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
            <h3>Portfolio Tracking</h3>
            <div className="coming-soon-feature">
              <p>Track your meme coin portfolio performance and P&L.</p>
              <span className="coming-soon-badge">Coming Soon</span>
            </div>
          </div>

          <div className="feature-section">
            <h3>Settings</h3>
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
