import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

// Birdeye WebSocket Configuration
const BIRDEYE_API_KEY = 'YOUR_BIRDEYE_API_KEY'; // Get free key at https://birdeye.so
const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket';

/**
 * Birdeye WebSocket Chart - REAL-TIME price updates for ALL Solana tokens
 * 
 * IMPORTANT: Uses Birdeye WebSocket for instant price updates
 * Supports ALL Solana tokens including meme coins!
 * 
 * Free tier: 100 requests/day + WebSocket streaming
 * Get API key: https://docs.birdeye.so/docs/authentication-api-keys
 */
const BirdeyeWebSocketChart = ({ coin, isActive = false }) => {
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

  // Get token address
  const getTokenAddress = useCallback(() => {
    return coin?.tokenAddress || 
           coin?.baseToken?.address || 
           coin?.pairAddress ||
           null;
  }, [coin]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Birdeye: Cleaning up');
    
    if (wsRef.current) {
      console.log('🧹 Birdeye: Closing WebSocket');
      try {
        wsRef.current.close();
      } catch (err) {
        console.error('Error closing WebSocket:', err);
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
  }, []);

  // Draw chart on canvas
  const drawChart = useCallback(() => {
    if (!canvasRef.current || chartDataRef.current.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 50, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const data = chartDataRef.current;
    if (data.length < 2) return;

    const prices = data.map(d => d.value);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || maxPrice * 0.01;

    // Draw grid
    ctx.strokeStyle = isDarkMode ? '#2a2e39' : '#e1e3e8';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw area
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const normalizedValue = (point.value - minPrice) / priceRange;
      const y = padding.top + chartHeight * (1 - normalizedValue);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.closePath();

    // Gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    const isPositive = priceChange !== null ? priceChange >= 0 : true;
    if (isPositive) {
      gradient.addColorStop(0, isDarkMode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)');
      gradient.addColorStop(1, isDarkMode ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.1)');
    } else {
      gradient.addColorStop(0, isDarkMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)');
      gradient.addColorStop(1, isDarkMode ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.1)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const normalizedValue = (point.value - minPrice) / priceRange;
      const y = padding.top + chartHeight * (1 - normalizedValue);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isPositive ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = isDarkMode ? '#d1d4dc' : '#191919';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const price = minPrice + (priceRange / 4) * (4 - i);
      const y = padding.top + (chartHeight / 4) * i;
      let priceText;
      if (price < 0.000001) priceText = price.toExponential(2);
      else if (price < 0.001) priceText = price.toFixed(6);
      else if (price < 1) priceText = price.toFixed(4);
      else if (price < 100) priceText = price.toFixed(2);
      else priceText = price.toFixed(0);
      ctx.fillText(`$${priceText}`, padding.left - 5, y + 4);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    const timeLabels = [0, Math.floor(data.length / 2), data.length - 1];
    timeLabels.forEach(i => {
      if (data[i]) {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const date = new Date(data[i].time * 1000);
        const timeText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(timeText, x, height - padding.bottom + 20);
      }
    });
  }, [isDarkMode, priceChange]);

  // Connect to Birdeye WebSocket
  const connectWebSocket = useCallback((tokenAddress) => {
    if (wsRef.current) {
      console.log('⚠️ Birdeye: WebSocket already connected');
      return;
    }

    console.log(`🔌 Birdeye: Connecting WebSocket for token ${tokenAddress}`);
    setStatus('loading');
    setError(null);

    try {
      const ws = new WebSocket(`${BIRDEYE_WS_URL}?x-api-key=${BIRDEYE_API_KEY}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ Birdeye: WebSocket CONNECTED`);
        
        // Subscribe to token price updates
        const subscribeMessage = {
          type: 'SUBSCRIBE_PRICE',
          data: {
            address: tokenAddress,
            currency: 'usd'
          }
        };
        
        console.log('📤 Birdeye: Subscribing:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          console.log('📨 Birdeye: Message received:', data);

          // Handle price update
          if (data.type === 'PRICE_UPDATE' && data.data?.value) {
            const price = parseFloat(data.data.value);
            const timestamp = Math.floor(Date.now() / 1000);

            console.log(`💰 Birdeye: ⚡ REAL-TIME PRICE: $${price}`);
            
            if (initialPriceRef.current === null) {
              initialPriceRef.current = price;
              console.log(`📍 Birdeye: Initial price set: $${price}`);
            }

            const changePercent = ((price - initialPriceRef.current) / initialPriceRef.current) * 100;
            
            setCurrentPrice(price);
            setPriceChange(changePercent);
            setStatus('connected');

            chartDataRef.current = [
              ...chartDataRef.current,
              { time: timestamp, value: price }
            ];

            if (chartDataRef.current.length > 360) {
              chartDataRef.current = chartDataRef.current.slice(-360);
              initialPriceRef.current = chartDataRef.current[0].value;
            }

            console.log(`📈 Birdeye: Chart now has ${chartDataRef.current.length} points`);

            requestAnimationFrame(() => {
              if (mountedRef.current) {
                drawChart();
              }
            });
          }

          // Handle subscription confirmation
          if (data.type === 'SUBSCRIBE_SUCCESS') {
            console.log('✅ Birdeye: Subscription confirmed');
            setStatus('connected');
          }

          // Handle errors
          if (data.type === 'ERROR') {
            console.error('❌ Birdeye: Error from server:', data.message);
            setStatus('error');
            setError(data.message || 'Subscription error');
          }
        } catch (err) {
          console.error('❌ Birdeye: Error parsing message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Birdeye: WebSocket error:', error);
        if (mountedRef.current) {
          setStatus('error');
          setError('Connection error');
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 Birdeye: WebSocket closed:', event.code, event.reason);
        if (mountedRef.current) {
          setStatus('error');
          setError('Connection closed');
        }
        wsRef.current = null;
      };

    } catch (err) {
      console.error('❌ Birdeye: Failed to create WebSocket:', err);
      if (mountedRef.current) {
        setStatus('error');
        setError('Failed to connect');
      }
    }
  }, [drawChart]);

  // Format price
  const formatPrice = (price) => {
    if (!price) return '$0.00';
    if (price < 0.000001) return `$${price.toExponential(2)}`;
    if (price < 0.001) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 100) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(0)}`;
  };

  // Main effect
  useEffect(() => {
    console.log(`🔄 Birdeye: Effect triggered - isActive: ${isActive}, coin: ${coin?.symbol}`);
    
    if (!isActive) {
      console.log('⏸️  Birdeye: Not active, cleaning up');
      cleanup();
      return;
    }

    mountedRef.current = true;

    const tokenAddress = getTokenAddress();
    if (!tokenAddress) {
      console.log('❌ Birdeye: No token address found');
      setStatus('error');
      setError('Token address not found');
      return;
    }

    console.log(`🚀 Birdeye: Initializing for token: ${tokenAddress}`);
    connectWebSocket(tokenAddress);

    return () => {
      console.log('🧹 Birdeye: Cleanup from effect');
      mountedRef.current = false;
      cleanup();
    };
  }, [isActive, coin, getTokenAddress, connectWebSocket, cleanup]);

  // Redraw on theme change
  useEffect(() => {
    if (chartDataRef.current.length > 0 && canvasRef.current) {
      requestAnimationFrame(() => {
        if (mountedRef.current) {
          drawChart();
        }
      });
    }
  }, [isDarkMode, drawChart]);

  return (
    <div className="twelve-data-chart">
      <div className="twelve-chart-header">
        <div className="price-info">
          <div className="token-symbol">{coin?.symbol || 'Token'}</div>
          <div className="current-price">
            {currentPrice ? formatPrice(currentPrice) : '—'}
          </div>
          {priceChange !== null && (
            <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              <span className="timeframe">live</span>
            </div>
          )}
        </div>
        <div className="chart-info">
          {status === 'connected' && (
            <>
              <span className="live-indicator">⚡ LIVE</span>
              <span className="update-text">Birdeye WebSocket</span>
            </>
          )}
          {status === 'loading' && (
            <span className="update-text">Connecting...</span>
          )}
        </div>
      </div>

      <div className="twelve-chart-container">
        <canvas
          ref={canvasRef}
          className="twelve-chart-canvas"
          style={{ width: '100%', height: '100%' }}
        />

        {status === 'loading' && (
          <div className="twelve-chart-overlay">
            <div className="twelve-chart-spinner"></div>
            <div className="twelve-chart-message">Connecting to Birdeye...</div>
            <div className="twelve-chart-submessage">Real-time WebSocket streaming</div>
          </div>
        )}

        {status === 'error' && (
          <div className="twelve-chart-overlay error">
            <div className="twelve-chart-error-icon">⚠️</div>
            <div className="twelve-chart-error-title">Connection Error</div>
            <div className="twelve-chart-error-message">
              {error}
              <br /><br />
              <small>Note: Birdeye API key required. Get free key at birdeye.so</small>
            </div>
          </div>
        )}
      </div>

      {status === 'connected' && (
        <div style={{
          padding: '8px 12px',
          fontSize: '11px',
          color: isDarkMode ? '#888' : '#666',
          borderTop: isDarkMode ? '1px solid #2a2e39' : '1px solid #e1e3e8',
          textAlign: 'center'
        }}>
          ⚡ Birdeye WebSocket • Real-time for ALL Solana tokens • Supports meme coins
        </div>
      )}
    </div>
  );
};

export default BirdeyeWebSocketChart;
