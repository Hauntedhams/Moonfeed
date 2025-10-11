import React, { useState, useEffect } from 'react';
import { useLiveData } from '../hooks/useLiveDataContext';

const LivePriceStatus = ({ coin }) => {
  const { getCoin, connected, connectionStatus } = useLiveData();
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  
  const liveData = getCoin(coin?.mintAddress || coin?.address);
  
  useEffect(() => {
    if (liveData?.lastPriceUpdate) {
      setLastUpdate(new Date(liveData.lastPriceUpdate));
      setUpdateCount(prev => prev + 1);
    }
  }, [liveData?.lastPriceUpdate]);
  
  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString();
  };
  
  const getTimeSince = (date) => {
    if (!date) return 'N/A';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 1000,
      minWidth: '200px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        🪐 Live Price Status
      </div>
      <div>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      <div>Status: {connectionStatus}</div>
      <div>Token: {coin?.symbol || 'N/A'}</div>
      <div>Address: {(coin?.mintAddress || coin?.address || 'N/A').substring(0, 8)}...</div>
      <div>Current Price: ${liveData?.price?.toFixed(8) || coin?.price_usd?.toFixed(8) || 'N/A'}</div>
      <div>Live Data: {liveData ? '✅ Yes' : '❌ No'}</div>
      <div>Jupiter Live: {liveData?.jupiterLive ? '🪐 Active' : '❌ Inactive'}</div>
      <div>Last Update: {formatTime(lastUpdate)}</div>
      <div>Time Since: {getTimeSince(lastUpdate)}</div>
      <div>Updates: {updateCount}</div>
      <div>Price Change: {liveData?.priceChangeInstant?.toFixed(2) || '0.00'}%</div>
    </div>
  );
};

export default LivePriceStatus;
