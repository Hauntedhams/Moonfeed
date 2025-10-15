import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import { useWallet } from '../contexts/WalletContext';
import './ActiveOrdersModal.css';

const ActiveOrdersModal = ({ isOpen, onClose }) => {
  const { walletAddress, signTransaction } = useWallet();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' or 'history'
  const [cancellingOrder, setCancellingOrder] = useState(null);

  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchOrders();
    }
  }, [isOpen, walletAddress, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    setCancellingOrder(orderId);

    try {
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

      console.log('📝 Cancellation transaction created, signing...');

      // Sign the cancellation transaction
      const signedTx = await signTransaction(result.transaction);
      console.log('✅ Transaction signed');

      // Execute the cancellation
      const executeResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTx
        })
      });

      const executeResult = await executeResponse.json();

      if (!executeResult.success) {
        throw new Error(executeResult.error || 'Failed to execute cancellation');
      }

      console.log('✅ Order cancelled');
      
      // Refresh orders
      fetchOrders();
    } catch (err) {
      console.error('Error canceling order:', err);
      alert(`Failed to cancel order: ${err.message}`);
    } finally {
      setCancellingOrder(null);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '0';
    const num = parseFloat(price);
    if (num < 0.00001) return num.toExponential(4);
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(6);
    return num.toFixed(4);
  };

  const formatAmount = (amount, decimals = 9) => {
    const num = parseFloat(amount) / Math.pow(10, decimals);
    if (num < 0.001) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return '-';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="active-orders-overlay" onClick={onClose}>
      <div className="active-orders-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="active-orders-header">
          <h2>📋 Your Limit Orders</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Status Filter */}
        <div className="status-filter">
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

        {/* Content */}
        <div className="active-orders-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading orders...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>❌ {error}</p>
              <button onClick={fetchOrders} className="retry-btn">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>No {statusFilter} orders</h3>
              <p>
                {statusFilter === 'active' 
                  ? 'Create a limit order to get started' 
                  : 'Your order history will appear here'}
              </p>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.orderId} className="order-card">
                  <div className="order-header">
                    <span className={`order-type ${order.orderType}`}>
                      {order.orderType === 'limit' ? '🎯' : '🛑'} {order.orderType}
                    </span>
                    <span className={`order-status ${order.status}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="order-details">
                    <div className="detail-row">
                      <span className="label">Pair</span>
                      <span className="value">
                        {order.inputMint?.slice(0, 6)}... → {order.outputMint?.slice(0, 6)}...
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Amount</span>
                      <span className="value">
                        {formatAmount(order.makingAmount)}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Trigger Price</span>
                      <span className="value price">
                        ${formatPrice(order.triggerPrice)}
                      </span>
                    </div>

                    {order.expiredAt && (
                      <div className="detail-row">
                        <span className="label">Expires</span>
                        <span className="value">
                          {formatDate(order.expiredAt)}
                        </span>
                      </div>
                    )}

                    <div className="detail-row">
                      <span className="label">Created</span>
                      <span className="value">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {statusFilter === 'active' && (
                    <button
                      className="cancel-order-btn"
                      onClick={() => handleCancelOrder(order.orderId)}
                      disabled={cancellingOrder === order.orderId}
                    >
                      {cancellingOrder === order.orderId ? (
                        <>
                          <span className="spinner-small"></span>
                          Cancelling...
                        </>
                      ) : (
                        '🗑️ Cancel Order'
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && walletAddress && (
          <div className="active-orders-footer">
            <p className="wallet-info">
              Wallet: {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveOrdersModal;
