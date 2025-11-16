import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

/**
 * Real-Time Price Chart using Solana RPC WebSocket
 * 
 * ✅ FREE - No API keys required
 * ✅ REAL-TIME - Sub-second updates from Solana blockchain
 * ✅ UNIVERSAL - Works for ALL Solana tokens (including meme coins)
 * ✅ RELIABLE - Uses native Solana RPC WebSocket (accountSubscribe)
 * 
 * Instead of polling a REST API or using paid WebSocket services,
 * this monitors the Raydium pool account directly via Solana RPC.
 * Every swap transaction triggers an update, giving true real-time prices.
 */
const RealTimePriceChart = ({ coin, isActive = false }) => {
  const { isDarkMode } = useDarkMode();
  const canvasRef = useRef(null);
  const chartDataRef = useRef([]);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const mountedRef = useRef(true);
  const initialPriceRef = useRef(null);

  // WebSocket server URL (our backend proxy)
  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws/price';

  // Get token address
  const getTokenAddress = useCallback(() => {
    return coin?.pairAddress || 
           coin?.tokenAddress || 
           coin?.baseToken?.address ||
           coin?.mintAddress ||
           null;
  }, [coin]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    const tokenAddress = getTokenAddress();
    if (!tokenAddress) {
      setError('No token address found');
      setStatus('error');
      return;
    }

    try {
      console.log('📡 Connecting to price WebSocket server...');
      setStatus('connecting');
      setError(null);

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Connected to price WebSocket server');
        setStatus('connected');
        
        // Subscribe to token price updates
        console.log(`📊 Subscribing to price updates for ${tokenAddress}`);
        ws.send(JSON.stringify({
          type: 'subscribe',
          token: tokenAddress
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              console.log('✅ WebSocket handshake complete');
              break;

            case 'subscribed':
              console.log(`✅ Subscribed to ${message.token}`);
              setStatus('subscribed');
              break;

            case 'price_update':
              handlePriceUpdate(message.data);
              break;

            case 'error':
              console.error('❌ WebSocket error:', message.message);
              setError(message.message);
              setStatus('error');
              break;

            case 'pong':
              // Heartbeat response
              break;

            default:
              console.warn('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ WebSocket connection error:', event);
        setError('WebSocket connection failed');
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed (code: ${event.code})`);
        setStatus('disconnected');
        
        // Auto-reconnect if component is still mounted
        if (mountedRef.current && isActive) {
          console.log('🔄 Reconnecting in 3 seconds...');
          setTimeout(() => {
            if (mountedRef.current && isActive) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setError(err.message);
      setStatus('error');
    }
  }, [getTokenAddress, isActive, WS_URL]);

  // Handle incoming price updates
  const handlePriceUpdate = useCallback((data) => {
    if (!mountedRef.current) return;

    const { price, timestamp } = data;
    
    // Set initial price for % change calculation
    if (initialPriceRef.current === null) {
      initialPriceRef.current = price;
    }

    // Update current price
    setCurrentPrice(price);

    // Calculate price change
    const change = ((price - initialPriceRef.current) / initialPriceRef.current) * 100;
    setPriceChange(change);

    // Add to chart data
    const dataPoint = {
      timestamp,
      price,
      value: price
    };

    chartDataRef.current.push(dataPoint);

    // Keep only last 100 data points (or adjust as needed)
    if (chartDataRef.current.length > 100) {
      chartDataRef.current.shift();
    }

    // Redraw chart
    drawChart();
  }, []);

  // Draw chart on canvas
  const drawChart = useCallback(() => {
    if (!canvasRef.current || chartDataRef.current.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 50, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const data = chartDataRef.current;
    if (data.length < 2) return;

    // Find min/max for scaling
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Draw grid lines
    ctx.strokeStyle = isDarkMode ? '#333' : '#e0e0e0';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = isDarkMode ? '#888' : '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (priceRange * i / 5);
      const y = padding.top + (chartHeight * i / 5);
      ctx.fillText(price.toFixed(6), padding.left - 10, y + 4);
    }

    // Draw price line
    const isPositive = (data[data.length - 1].price - data[0].price) >= 0;
    ctx.strokeStyle = isPositive ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw gradient fill under line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, isPositive ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw current price indicator
    const lastPoint = data[data.length - 1];
    const lastX = padding.left + chartWidth;
    const lastY = padding.top + chartHeight - ((lastPoint.price - minPrice) / priceRange) * chartHeight;
    
    ctx.fillStyle = isPositive ? '#00ff00' : '#ff0000';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [isDarkMode]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up chart');
    
    if (wsRef.current) {
      try {
        const tokenAddress = getTokenAddress();
        if (tokenAddress) {
          // Unsubscribe before closing
          wsRef.current.send(JSON.stringify({
            type: 'unsubscribe',
            token: tokenAddress
          }));
        }
        wsRef.current.close();
      } catch (err) {
        console.error('Error during cleanup:', err);
      }
      wsRef.current = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    chartDataRef.current = [];
    initialPriceRef.current = null;
  }, [getTokenAddress]);

  // Effect: Connect when active, disconnect when inactive
  useEffect(() => {
    mountedRef.current = true;

    if (isActive) {
      connectWebSocket();
    } else {
      cleanup();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [isActive, connectWebSocket, cleanup]);

  // Effect: Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartDataRef.current.length > 0) {
        drawChart();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  // Render status message
  const renderStatus = () => {
    switch (status) {
      case 'connecting':
        return (
          <div className="chart-status">
            <div className="loading-spinner" />
            <span>Connecting to price stream...</span>
          </div>
        );
      
      case 'connected':
        return (
          <div className="chart-status">
            <div className="loading-spinner" />
            <span>Loading pool data...</span>
          </div>
        );
      
      case 'subscribed':
        if (chartDataRef.current.length === 0) {
          return (
            <div className="chart-status">
              <div className="loading-spinner" />
              <span>Waiting for first price update...</span>
            </div>
          );
        }
        return null;
      
      case 'error':
        return (
          <div className="chart-error">
            <span>⚠️ {error || 'Failed to load price data'}</span>
            <button onClick={connectWebSocket} className="retry-button">
              Retry
            </button>
          </div>
        );
      
      case 'disconnected':
        return (
          <div className="chart-status">
            <span>Disconnected - Reconnecting...</span>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="twelve-data-chart">
      {/* Price Info Header */}
      {currentPrice !== null && (
        <div className="chart-header">
          <div className="price-info">
            <div className="current-price">
              ${currentPrice.toFixed(6)}
            </div>
            {priceChange !== null && (
              <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
          </div>
          <div className="status-badge" data-status={status}>
            <span className="status-dot" />
            {status === 'subscribed' && chartDataRef.current.length > 0 ? 'LIVE' : status.toUpperCase()}
          </div>
        </div>
      )}

      {/* Canvas Chart */}
      <div className="chart-container">
        {renderStatus()}
        <canvas ref={canvasRef} className="price-chart-canvas" />
      </div>

      {/* Chart Legend */}
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#00ff00' }} />
          <span>Price Up</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#ff0000' }} />
          <span>Price Down</span>
        </div>
        <div className="legend-info">
          <span>Real-time via Solana RPC</span>
        </div>
      </div>
    </div>
  );
};

export default RealTimePriceChart;
