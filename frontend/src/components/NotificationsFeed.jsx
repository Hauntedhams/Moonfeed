import React, { useState, useEffect } from 'react';
import './NotificationsFeed.css';

function NotificationsFeed({ favorites = [] }) {
  const [notifications, setNotifications] = useState([]);

  // Generate notifications from favorite coins
  useEffect(() => {
    if (favorites.length === 0) return;

    const generateNotifications = () => {
      const notifs = [];
      const now = Date.now();

      favorites.forEach((coin) => {
        // Price change notification
        const changePct = coin.change_24h || coin.priceChange24h || coin.change24h || 0;
        if (Math.abs(changePct) > 5) {
          notifs.push({
            id: `price-${coin.mintAddress}-${now}`,
            type: 'price_change',
            coin: coin,
            message: changePct > 0 
              ? `is up ${Math.abs(changePct).toFixed(1)}% in the last 24h`
              : `is down ${Math.abs(changePct).toFixed(1)}% in the last 24h`,
            icon: changePct > 0 ? '📈' : '📉',
            color: changePct > 0 ? '#22c55e' : '#ef4444',
            timestamp: now - Math.random() * 3600000, // Random time in last hour
            value: changePct
          });
        }

        // Volume spike notification
        const volume = coin.volume_24h_usd || coin.volume24h || 0;
        if (volume > 100000) {
          notifs.push({
            id: `volume-${coin.mintAddress}-${now}`,
            type: 'volume_spike',
            coin: coin,
            message: `24h volume reached $${formatCompact(volume)}`,
            icon: '💧',
            color: '#3b82f6',
            timestamp: now - Math.random() * 7200000,
            value: volume
          });
        }

        // Liquidity update
        const liquidity = coin.liquidity_usd || coin.liquidity || coin.liquidityUsd || 0;
        if (liquidity > 50000) {
          notifs.push({
            id: `liquidity-${coin.mintAddress}-${now}`,
            type: 'liquidity',
            coin: coin,
            message: `liquidity pool now at $${formatCompact(liquidity)}`,
            icon: '💎',
            color: '#8b5cf6',
            timestamp: now - Math.random() * 10800000,
            value: liquidity
          });
        }

        // Holders milestone
        const holders = coin.holders || coin.holderCount || 0;
        if (holders > 100) {
          notifs.push({
            id: `holders-${coin.mintAddress}-${now}`,
            type: 'holders',
            coin: coin,
            message: `reached ${formatCompact(holders)} holders`,
            icon: '👥',
            color: '#f59e0b',
            timestamp: now - Math.random() * 14400000,
            value: holders
          });
        }

        // Market cap milestone
        const marketCap = coin.market_cap_usd || coin.marketCap || 0;
        if (marketCap > 100000) {
          notifs.push({
            id: `mcap-${coin.mintAddress}-${now}`,
            type: 'market_cap',
            coin: coin,
            message: `market cap reached $${formatCompact(marketCap)}`,
            icon: '🎯',
            color: '#ec4899',
            timestamp: now - Math.random() * 18000000,
            value: marketCap
          });
        }

        // Graduation progress for pump.fun tokens
        if (coin.isPumpFun || coin.status === 'graduating') {
          const baseBalance = coin.baseBalance || 0;
          if (baseBalance > 0) {
            const graduationPct = (baseBalance / 85) * 100;
            if (graduationPct > 50) {
              notifs.push({
                id: `graduation-${coin.mintAddress}-${now}`,
                type: 'graduation',
                coin: coin,
                message: `graduation progress: ${graduationPct.toFixed(1)}%`,
                icon: '🎓',
                color: '#10b981',
                timestamp: now - Math.random() * 21600000,
                value: graduationPct
              });
            }
          }
        }
      });

      // Sort by timestamp (most recent first) and limit to 50
      notifs.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(notifs.slice(0, 50));
    };

    generateNotifications();
  }, [favorites]);

  const formatCompact = (num) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  if (notifications.length === 0) {
    return (
      <div className="notifications-feed">
        <div className="notifications-empty-state">
          <div className="empty-icon">🔔</div>
          <h3>No notifications yet</h3>
          <p>Follow more coins to see updates here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-feed">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification-item">
          <div className="notification-icon" style={{ background: `${notification.color}15`, color: notification.color }}>
            {notification.icon}
          </div>
          
          <div className="notification-content">
            <div className="notification-header">
              <div className="notification-coin-info">
                {notification.coin.profileImage && (
                  <img 
                    src={notification.coin.profileImage} 
                    alt={notification.coin.symbol}
                    className="notification-coin-image"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span className="notification-coin-name">{notification.coin.name}</span>
                <span className="notification-coin-symbol">${notification.coin.symbol}</span>
              </div>
              <span className="notification-time">{formatTimeAgo(notification.timestamp)}</span>
            </div>
            
            <div className="notification-message">
              {notification.message}
            </div>
            
            {notification.type === 'price_change' && (
              <div className="notification-stats">
                <div className="stat-badge" style={{ background: `${notification.color}10`, color: notification.color }}>
                  {notification.value > 0 ? '+' : ''}{notification.value.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationsFeed;
