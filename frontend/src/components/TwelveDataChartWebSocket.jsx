import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

// Twelve Data WebSocket Configuration
const TWELVE_API_KEY = '5bbbe353245a4b0795eed57ad93e72cc';
const TWELVE_WS_URL = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${TWELVE_API_KEY}`;

/**
 * Twelve Data WebSocket Chart - REAL-TIME price updates
 * 
 * IMPORTANT: Uses WebSocket for instant price updates (< 1 second latency)
 * No REST API polling = No rate limits!
 * 
 * Supports: BTC, ETH, SOL, USDT, USDC, BNB, ADA, DOGE, MATIC, XRP, DOT, AVAX
 * Note: Most Solana meme coins are NOT supported by Twelve Data
 */
const TwelveDataChart = ({ coin, isActive = false }) => {
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

  // Get trading symbol for Twelve Data
  const getTwelveSymbol = useCallback(() => {
    const symbol = coin?.symbol || 'SOL';
    
    // Twelve Data supported symbols (major tokens only)
    const supportedTokens = {
      'SOL': 'SOL/USD',
      'BTC': 'BTC/USD',
      'ETH': 'ETH/USD',
      'USDT': 'USDT/USD',
      'USDC': 'USDC/USD',
      'BNB': 'BNB/USD',
      'ADA': 'ADA/USD',
      'DOGE': 'DOGE/USD',
      'MATIC': 'MATIC/USD',
      'XRP': 'XRP/USD',
      'DOT': 'DOT/USD',
      'AVAX': 'AVAX/USD'
    };
    
    const upperSymbol = symbol.toUpperCase();
    return supportedTokens[upperSymbol] || null;
  }, [coin?.symbol]);

  // Check if token is supported
  const isSupported = useCallback(() => {
    return getTwelveSymbol() !== null;
  }, [getTwelveSymbol]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Twelve: Cleaning up');
    
    // Close WebSocket connection
    if (wsRef.current) {
      console.log('🧹 Twelve: Closing WebSocket');
      try {
        wsRef.current.close();
      } catch (err) {
        console.error('Error closing WebSocket:', err);
      }
      wsRef.current = null;
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    // Reset refs
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

    // Calculate min/max
    const prices = data.map(d => d.value);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || maxPrice * 0.01;

    // Draw grid lines
    ctx.strokeStyle = isDarkMode ? '#2a2e39' : '#e1e3e8';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw area chart
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

    // Gradient fill
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
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = isPositive ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Y-axis labels
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

    // Draw X-axis labels (time)
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

  // Connect to Twelve Data WebSocket for REAL-TIME updates
  const connectWebSocket = useCallback((symbol) => {
    if (wsRef.current) {
      console.log('⚠️ Twelve: WebSocket already connected');
      return;
    }

    console.log(`🔌 Twelve: Connecting WebSocket for ${symbol}`);
    setStatus('loading');
    setError(null);

    try {
      const ws = new WebSocket(TWELVE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ Twelve: WebSocket CONNECTED for ${symbol}`);
        
        // Subscribe to the symbol
        const subscribeMessage = {
          action: 'subscribe',
          params: {
            symbols: symbol
          }
        };
        
        console.log('📤 Twelve: Subscribing:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          console.log('📨 Twelve: Message received:', data);

          // Handle subscription status
          if (data.event === 'subscribe-status') {
            console.log('📊 Twelve: Subscription status:', data.status);
            if (data.status === 'ok') {
              setStatus('connected');
              setError(null);
            } else {
              setStatus('error');
              setError(data.message || 'Subscription failed');
            }
            return;
          }

          // Handle heartbeat
          if (data.event === 'heartbeat') {
            console.log('💓 Twelve: Heartbeat');
            ws.send(JSON.stringify({ action: 'heartbeat' }));
            return;
          }

          // Handle price update - THIS IS THE REAL-TIME DATA!
          if (data.event === 'price' && data.price) {
            const price = parseFloat(data.price);
            const timestamp = Math.floor(Date.now() / 1000);

            console.log(`💰 Twelve: ⚡ REAL-TIME PRICE: $${price}`);
            
            // Set initial price for change calculation
            if (initialPriceRef.current === null) {
              initialPriceRef.current = price;
              console.log(`📍 Twelve: Initial price set: $${price}`);
            }

            // Calculate price change from initial
            const changePercent = ((price - initialPriceRef.current) / initialPriceRef.current) * 100;
            
            setCurrentPrice(price);
            setPriceChange(changePercent);
            setStatus('connected');

            // Add to chart data
            chartDataRef.current = [
              ...chartDataRef.current,
              { time: timestamp, value: price }
            ];

            // Keep last 360 points (about 30 minutes of real-time data)
            if (chartDataRef.current.length > 360) {
              chartDataRef.current = chartDataRef.current.slice(-360);
              // Update initial price reference to oldest point
              initialPriceRef.current = chartDataRef.current[0].value;
            }

            console.log(`📈 Twelve: Chart now has ${chartDataRef.current.length} points`);

            // Redraw chart
            requestAnimationFrame(() => {
              if (mountedRef.current) {
                drawChart();
              }
            });
          }
        } catch (err) {
          console.error('❌ Twelve: Error parsing message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Twelve: WebSocket error:', error);
        if (mountedRef.current) {
          setStatus('error');
          setError('Connection error');
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 Twelve: WebSocket closed:', event.code, event.reason);
        if (mountedRef.current) {
          setStatus('error');
          setError('Connection closed');
        }
        wsRef.current = null;
      };

    } catch (err) {
      console.error('❌ Twelve: Failed to create WebSocket:', err);
      if (mountedRef.current) {
        setStatus('error');
        setError('Failed to connect');
      }
    }
  }, [drawChart]);

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return '$0.00';
    if (price < 0.000001) return `$${price.toExponential(2)}`;
    if (price < 0.001) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 100) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(0)}`;
  };

  // Main initialization effect
  useEffect(() => {
    console.log(`🔄 Twelve: Effect triggered - isActive: ${isActive}, coin: ${coin?.symbol}`);
    
    if (!isActive) {
      console.log('⏸️  Twelve: Not active, cleaning up');
      cleanup();
      return;
    }

    mountedRef.current = true;

    // Check if token is supported
    if (!isSupported()) {
      console.log(`❌ Twelve: Token ${coin?.symbol} not supported`);
      setStatus('error');
      setError(`${coin?.symbol || 'This token'} is not supported by Twelve Data. Only major tokens like BTC, ETH, SOL are available.`);
      return;
    }

    const symbol = getTwelveSymbol();
    console.log(`🚀 Twelve: Initializing for symbol: ${symbol}`);
    
    // Connect WebSocket
    connectWebSocket(symbol);

    return () => {
      console.log('🧹 Twelve: Cleanup from effect');
      mountedRef.current = false;
      cleanup();
    };
  }, [isActive, coin, isSupported, getTwelveSymbol, connectWebSocket, cleanup]);

  // Redraw chart when theme changes
  useEffect(() => {
    if (chartDataRef.current.length > 0 && canvasRef.current) {
      requestAnimationFrame(() => {
        if (mountedRef.current) {
          drawChart();
        }
      });
    }
  }, [isDarkMode, drawChart]);

  // Render unsupported token message
  if (!isSupported()) {
    return (
      <div className="twelve-data-chart">
        <div className="twelve-chart-header">
          <div className="price-info">
            <div className="token-symbol">{coin?.symbol || 'Unknown'}</div>
          </div>
        </div>
        <div className="twelve-chart-container">
          <div className="twelve-chart-overlay error">
            <div className="twelve-chart-error-icon">ℹ️</div>
            <div className="twelve-chart-error-title">Not Available</div>
            <div className="twelve-chart-error-message">
              Twelve Data only supports major tokens like BTC, ETH, SOL, USDT, USDC, BNB, etc.
              <br /><br />
              <strong>{coin?.symbol}</strong> is not available on this service.
              <br /><br />
              Try the <strong>TradingView</strong> or <strong>Advanced</strong> tabs instead.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="twelve-data-chart">
      {/* Price Header */}
      <div className="twelve-chart-header">
        <div className="price-info">
          <div className="token-symbol">{getTwelveSymbol()}</div>
          <div className="current-price">
            {currentPrice ? formatPrice(currentPrice) : '—'}
          </div>
          {priceChange !== null && (
            <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              <span className="timeframe">since start</span>
            </div>
          )}
        </div>
        <div className="chart-info">
          {status === 'connected' && (
            <>
              <span className="live-indicator">⚡ LIVE</span>
              <span className="update-text">Real-time WebSocket</span>
            </>
          )}
          {status === 'loading' && (
            <span className="update-text">Connecting...</span>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="twelve-chart-container">
        <canvas
          ref={canvasRef}
          className="twelve-chart-canvas"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Loading Overlay */}
        {status === 'loading' && (
          <div className="twelve-chart-overlay">
            <div className="twelve-chart-spinner"></div>
            <div className="twelve-chart-message">Connecting to WebSocket...</div>
            <div className="twelve-chart-submessage">Real-time data streaming</div>
          </div>
        )}

        {/* Error Overlay */}
        {status === 'error' && error && !error.includes('not supported') && (
          <div className="twelve-chart-overlay error">
            <div className="twelve-chart-error-icon">⚠️</div>
            <div className="twelve-chart-error-title">Connection Error</div>
            <div className="twelve-chart-error-message">{error}</div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      {status === 'connected' && (
        <div style={{
          padding: '8px 12px',
          fontSize: '11px',
          color: isDarkMode ? '#888' : '#666',
          borderTop: isDarkMode ? '1px solid #2a2e39' : '1px solid #e1e3e8',
          textAlign: 'center'
        }}>
          ⚡ WebSocket connected • Data updates instantly • No API rate limits
        </div>
      )}
    </div>
  );
};

export default TwelveDataChart;
