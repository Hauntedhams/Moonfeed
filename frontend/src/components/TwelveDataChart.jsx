import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import './TwelveDataChart.css';

// Use backend proxy to avoid CORS errors
const BACKEND_API = import.meta.env.PROD 
  ? 'https://api.moonfeed.app'
  : 'http://localhost:3001';
const SOLANASTREAM_API_KEY = '011b8a15bb61a3cd81bfa19fd7a52ea3';
const SOLANASTREAM_WS = `wss://api.solanastreaming.com/v1/stream?apiKey=${SOLANASTREAM_API_KEY}`;
const PRICE_UPDATE_INTERVAL = 10000; // Poll for price updates every 10 seconds (fallback only)

const TwelveDataChart = ({ coin, isActive = false }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastUpdateTimeRef = useRef(null);
  const heartbeatIntervalRef = useRef(null); // For live timeline animation
  const currentIntervalRef = useRef(null); // Track current 5-minute interval
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [usePolling, setUsePolling] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false); // Track RPC WebSocket status
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize based on actual DOM state
    return document.documentElement.classList.contains('dark-mode');
  }); // Track theme mode
  const [selectedTimeframe, setSelectedTimeframe] = useState('5m'); // Track selected timeframe

  // Extract pairAddress for historical data and tokenMint for real-time subscription
  const pairAddress = coin?.pairAddress || 
                      coin?.poolAddress || 
                      coin?.address || 
                      coin?.ammAccount ||
                      null;
  
  const tokenMint = coin?.mintAddress || 
                    coin?.mint ||
                    coin?.address || 
                    coin?.baseToken?.address ||
                    null;
  
  // 🔍 DEBUG: Log what we're working with
  useEffect(() => {
    console.log('🎯 TwelveDataChart received coin:', {
      symbol: coin?.symbol,
      name: coin?.name,
      pairAddress,
      tokenMint,
      allKeys: Object.keys(coin || {})
    });
  }, [coin]);

  // Detect and track theme changes
  useEffect(() => {
    const detectTheme = () => {
      // Check if dark-mode class exists on documentElement
      // If the class exists, it's dark mode; otherwise it's light mode (the default)
      const isDark = document.documentElement.classList.contains('dark-mode');
      
      console.log('🎨 Theme detected:', isDark ? 'dark' : 'light');
      console.log('   documentElement classes:', document.documentElement.className);
      setIsDarkMode(isDark);
      
      // Update chart colors if chart exists
      if (chartRef.current) {
        updateChartTheme(isDark);
      }
    };

    // Initial detection
    detectTheme();

    // Watch for theme changes on documentElement
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Function to update chart theme dynamically
  const updateChartTheme = (isDark) => {
    if (!chartRef.current || !lineSeriesRef.current) return;

    const colors = getThemeColors(isDark);

    chartRef.current.applyOptions({
      layout: {
        background: colors.background,
        textColor: colors.text,
      },
      grid: {
        vertLines: { 
          color: colors.gridLines,
          style: 1,
        },
        horzLines: { 
          color: colors.gridLines,
          style: 1,
        },
      },
      timeScale: {
        borderColor: colors.border,
      },
      rightPriceScale: {
        borderColor: colors.border,
      },
      crosshair: {
        vertLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.crosshairLabel,
        },
        horzLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.crosshairLabel,
        },
      },
    });

    lineSeriesRef.current.applyOptions({
      color: colors.lineColor,
      priceLineColor: colors.priceLine,
      topColor: colors.areaTop,
      bottomColor: colors.areaBottom,
      crosshairMarkerBorderColor: colors.lineColor,
      crosshairMarkerBackgroundColor: colors.lineColor,
    });
  };

  // Get theme-specific colors
  const getThemeColors = (isDark) => {
    if (isDark) {
      return {
        background: { type: 'solid', color: 'transparent' },
        text: 'rgba(255, 255, 255, 0.6)',
        gridLines: 'rgba(255, 255, 255, 0.05)',
        border: 'rgba(255, 255, 255, 0.1)',
        crosshair: 'rgba(0, 255, 65, 0.3)',
        crosshairLabel: 'rgba(0, 255, 65, 0.8)',
        lineColor: '#00ff41',
        priceLine: 'rgba(0, 255, 65, 0.5)',
        areaTop: 'rgba(0, 255, 65, 0.3)',
        areaBottom: 'rgba(0, 255, 65, 0.01)',
      };
    } else {
      return {
        background: { type: 'solid', color: '#ffffff' },
        text: 'rgba(0, 0, 0, 0.7)',
        gridLines: 'rgba(0, 0, 0, 0.08)',
        border: 'rgba(0, 0, 0, 0.15)',
        crosshair: 'rgba(0, 150, 40, 0.4)',
        crosshairLabel: 'rgba(0, 150, 40, 0.9)',
        lineColor: '#00cc33',
        priceLine: 'rgba(0, 150, 40, 0.6)',
        areaTop: 'rgba(0, 150, 40, 0.2)',
        areaBottom: 'rgba(0, 150, 40, 0.01)',
      };
    }
  };

  /**
   * Round timestamp to nearest interval based on selected timeframe
   */
  const roundToInterval = (timestamp, timeframeKey = selectedTimeframe) => {
    const config = TIMEFRAME_CONFIG[timeframeKey];
    const intervalSeconds = config?.intervalSeconds || 300; // Default to 5 minutes
    return Math.floor(timestamp / intervalSeconds) * intervalSeconds;
  };

  /**
   * Start live heartbeat animation - makes chart flow to the right immediately
   * Updates the current 5-minute interval point instead of adding new points
   */
  const startLiveHeartbeat = (lineSeries) => {
    if (!lineSeries || heartbeatIntervalRef.current) return;
    
    console.log('💓 Starting live heartbeat animation');
    
    // Update the current interval point every second to keep the chart alive
    heartbeatIntervalRef.current = setInterval(() => {
      if (!lineSeries || !chartRef.current) return;
      
      const currentPrice = latestPrice;
      if (!currentPrice) return;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const currentInterval = roundToInterval(currentTime);
      
      // Check if we have a recent update (within last 2 seconds)
      const lastUpdateTime = lastUpdateTimeRef.current || 0;
      const timeSinceUpdate = currentTime - lastUpdateTime;
      
      // If no recent price update, update the current interval point to keep chart alive
      if (timeSinceUpdate >= 2) {
        try {
          // Update the current interval point (not add a new one)
          lineSeries.update({
            time: currentInterval,
            value: currentPrice
          });
          lastUpdateTimeRef.current = currentTime;
          
          // Smooth scroll to show latest data
          if (chartRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
          }
          
          console.log('💓 Heartbeat: keeping chart alive at $' + currentPrice.toFixed(8));
        } catch (error) {
          console.error('❌ Heartbeat error:', error);
        }
      }
    }, 1000); // Every second
  };
  
  /**
   * Stop live heartbeat animation
   */
  const stopLiveHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log('💓 Stopped live heartbeat');
    }
  };

  /**
   * Smooth price animation function
   * Updates the current interval point with smooth interpolation
   * Only adds a new point when crossing into a new interval
   */
  const animatePriceUpdate = (lineSeries, fromPrice, toPrice, actualTime) => {
    if (!lineSeries || !chartRef.current) return;
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Round to current interval based on selected timeframe
    const currentInterval = roundToInterval(actualTime);
    
    // Check if we've moved to a new interval
    const previousInterval = currentIntervalRef.current;
    const isNewInterval = previousInterval !== null && currentInterval > previousInterval;
    
    if (isNewInterval) {
      const config = TIMEFRAME_CONFIG[selectedTimeframe];
      console.log(`🆕 New ${config?.label || 'interval'} detected:`, {
        previous: new Date(previousInterval * 1000).toLocaleTimeString(),
        current: new Date(currentInterval * 1000).toLocaleTimeString()
      });
    }
    
    // Update the current interval tracker
    currentIntervalRef.current = currentInterval;
    
    const now = performance.now();
    const duration = 1000; // 1 second smooth animation
    const frameRate = 60; // 60fps for ultra smooth
    const totalFrames = Math.ceil((duration / 1000) * frameRate);
    let currentFrame = 0;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - now;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out function for natural deceleration
      const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
      const easedProgress = easeOutQuart(progress);        try {
          // Calculate interpolated price
          const interpolatedPrice = fromPrice + ((toPrice - fromPrice) * easedProgress);
          
          // Update the current interval point (not add a new one)
          // This keeps historical data in place while smoothly animating the current price
          lineSeries.update({
            time: currentInterval,
            value: interpolatedPrice
          });
        
        currentFrame++;
        
        // Continue animation if not complete
        if (progress < 1 && currentFrame < totalFrames) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - set final price for current interval
          lineSeries.update({
            time: currentInterval,
            value: toPrice
          });
          setLatestPrice(toPrice);
          lastUpdateTimeRef.current = actualTime;
          
          // Smooth scroll to show latest data
          if (chartRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
          }
        }
      } catch (error) {
        console.error('❌ Animation error:', error);
        // Fallback: just update the current interval point
        lineSeries.update({
          time: currentInterval,
          value: toPrice
        });
        setLatestPrice(toPrice);
        lastUpdateTimeRef.current = actualTime;
      }
    };
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Timeframe configuration for GeckoTerminal API
  const TIMEFRAME_CONFIG = {
    '1m': { timeframe: 'minute', aggregate: 1, limit: 100, label: '1m', intervalSeconds: 60 },
    '5m': { timeframe: 'minute', aggregate: 5, limit: 100, label: '5m', intervalSeconds: 300 },
    '15m': { timeframe: 'minute', aggregate: 15, limit: 100, label: '15m', intervalSeconds: 900 },
    '1h': { timeframe: 'hour', aggregate: 1, limit: 100, label: '1h', intervalSeconds: 3600 },
    '4h': { timeframe: 'hour', aggregate: 4, limit: 100, label: '4h', intervalSeconds: 14400 },
    '1d': { timeframe: 'day', aggregate: 1, limit: 100, label: '1D', intervalSeconds: 86400 },
  };

  // Fetch historical OHLCV data from GeckoTerminal via backend proxy
  const fetchHistoricalData = async (poolAddress, timeframeKey = '5m') => {
    try {
      const config = TIMEFRAME_CONFIG[timeframeKey];
      if (!config) {
        throw new Error(`Invalid timeframe: ${timeframeKey}`);
      }

      const { timeframe, aggregate, limit } = config;
      
      // Use backend proxy to avoid CORS errors
      const url = `${BACKEND_API}/api/geckoterminal/ohlcv/solana/${poolAddress}/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
      
      console.log('📊 Fetching historical data via proxy:', { timeframeKey, timeframe, aggregate, limit, url });
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Backend proxy error:', response.status, errorData);
        throw new Error(`Backend proxy error: ${response.status} - ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      // Enhanced validation with better error messages
      if (!data) {
        throw new Error('No data received from backend');
      }
      
      if (!data.data) {
        console.error('❌ Missing data.data in response:', data);
        throw new Error('Invalid response structure: missing data object');
      }
      
      if (!data.data.attributes) {
        console.error('❌ Missing data.data.attributes in response:', data);
        throw new Error('Invalid response structure: missing attributes');
      }
      
      if (!data.data.attributes.ohlcv_list || !Array.isArray(data.data.attributes.ohlcv_list)) {
        console.error('❌ Missing or invalid ohlcv_list in response:', data.data.attributes);
        throw new Error('Invalid response structure: missing or invalid ohlcv_list');
      }
      
      if (data.data.attributes.ohlcv_list.length === 0) {
        throw new Error('No OHLCV data available for this pool');
      }
      
      // Convert OHLCV to line chart data (using close prices)
      const chartData = data.data.attributes.ohlcv_list.map((candle, index) => {
        if (!Array.isArray(candle) || candle.length < 5) {
          console.error(`❌ Invalid candle format at index ${index}:`, candle);
          throw new Error(`Invalid candle data at index ${index}`);
        }
        
        return {
          time: candle[0], // Unix timestamp
          value: parseFloat(candle[4]), // Close price
        };
      });
      
      // CRITICAL: Ensure data is sorted in ascending order by timestamp
      // The chart library requires strictly ascending time order
      chartData.sort((a, b) => a.time - b.time);
      
      // Validate that data is now properly sorted
      for (let i = 1; i < chartData.length; i++) {
        if (chartData[i].time <= chartData[i - 1].time) {
          console.error('❌ Duplicate or out-of-order timestamps detected:', {
            index: i,
            prev: { time: chartData[i - 1].time, date: new Date(chartData[i - 1].time * 1000).toISOString() },
            current: { time: chartData[i].time, date: new Date(chartData[i].time * 1000).toISOString() }
          });
          // Remove duplicate timestamp entries
          chartData.splice(i, 1);
          i--; // Recheck this index
        }
      }
      
      console.log('✅ Historical data fetched:', chartData.length, 'candles (sorted ascending)');
      if (chartData.length > 0) {
        console.log('   First candle time:', new Date(chartData[0].time * 1000).toISOString());
        console.log('   Last candle time:', new Date(chartData[chartData.length - 1].time * 1000).toISOString());
      }
      
      return chartData;
    } catch (err) {
      console.error('❌ Error fetching historical data:', err);
      throw err;
    }
  };

  // Fetch latest price from GeckoTerminal via backend proxy
  const fetchLatestPrice = async (poolAddress) => {
    try {
      // Use backend proxy to avoid CORS errors
      const url = `${BACKEND_API}/api/geckoterminal/pool/solana/${poolAddress}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Backend proxy error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data?.data?.attributes?.base_token_price_usd) {
        console.warn('No price data in response');
        return null;
      }
      
      const price = parseFloat(data.data.attributes.base_token_price_usd);
      const timestamp = Math.floor(Date.now() / 1000);
      
      return { price, timestamp };
    } catch (err) {
      console.error('Error fetching latest price:', err);
      return null;
    }
  };

  // Initialize chart and load data (only once)
  useEffect(() => {
    // Initialize chart when pairAddress is available (works in both collapsed and expanded views)
    if (!pairAddress || chartRef.current) return;
    
    let mounted = true;
    
    const initialize = async () => {
      console.log('🎯 Starting chart initialization...');
      
      // Wait for DOM to be ready and retry if dimensions aren't available
      let retries = 0;
      const maxRetries = 20; // Increased retries
      
      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 150)); // Longer wait
        
        if (!mounted || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        console.log(`🔍 [Retry ${retries + 1}/${maxRetries}] Container dimensions: ${width}x${height}`);
        
        if (width && height && width > 100 && height > 100) {
          console.log(`✅ Container ready with dimensions: ${width}x${height}`);
          break; // Dimensions are ready
        }
        
        retries++;
        if (retries >= maxRetries) {
          console.error('❌ Chart container has no dimensions after retries');
          console.error('   Container:', container);
          console.error('   Parent:', container?.parentElement);
          console.error('   Computed style:', window.getComputedStyle(container));
          setError('Chart container failed to initialize. Please try reopening the chart.');
          setLoading(false);
          return;
        }
      }
      
      if (!mounted || !chartContainerRef.current) return;

      const container = chartContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      try {
        console.log('📊 Initializing chart for:', pairAddress);
        
        // Get theme colors
        const colors = getThemeColors(isDarkMode);
        
        // Create chart with theme-aware styling
        const chart = createChart(container, {
          layout: {
            background: colors.background,
            textColor: colors.text,
          },
          grid: {
            vertLines: { 
              color: colors.gridLines,
              style: 1,
            },
            horzLines: { 
              color: colors.gridLines,
              style: 1,
            },
          },
          width: width,
          height: height,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: colors.border,
            rightOffset: 15, // More space on the right for smooth scrolling
            barSpacing: 15, // Wider spacing for smoother flowing animation
            minBarSpacing: 10,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: false, // Allow smooth auto-scroll
            shiftVisibleRangeOnNewBar: true, // Auto-scroll to show new data
            fixLeftEdge: false, // Allow smooth scrolling
            fixRightEdge: false, // Allow smooth scrolling
            // Enable smooth scrolling animations
            animateTime: true,
          },
          rightPriceScale: {
            borderColor: colors.border,
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: colors.crosshair,
              width: 1,
              style: 2,
              labelBackgroundColor: colors.crosshairLabel,
            },
            horzLine: {
              color: colors.crosshair,
              width: 1,
              style: 2,
              labelBackgroundColor: colors.crosshairLabel,
            },
          },
          // Enable smooth animations
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
        });

        // Create line series with glowing effect and theme-aware colors
        const lineSeries = chart.addSeries(LineSeries, {
          color: colors.lineColor,
          lineWidth: 3,
          lineStyle: 0,
          lineType: 2, // Curved line for smooth appearance
          priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
          },
          lastValueVisible: true,
          priceLineVisible: true,
          priceLineWidth: 2,
          priceLineColor: colors.priceLine,
          priceLineStyle: 2,
          // Area under the line with gradient
          topColor: colors.areaTop,
          bottomColor: colors.areaBottom,
          lineVisible: true,
          // Enable smooth crosshair movement
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: colors.lineColor,
          crosshairMarkerBackgroundColor: colors.lineColor,
        });

        chartRef.current = chart;
        lineSeriesRef.current = lineSeries;

        console.log('✅ Chart created, fetching historical data...');
        
        // Fetch and set historical data
        setLoading(true);
        const historicalData = await fetchHistoricalData(pairAddress, selectedTimeframe);
        
        if (!mounted) return;
        
        if (historicalData.length === 0) {
          throw new Error('No historical data available');
        }
        
        // CRITICAL: Validate data is in ascending order before passing to chart
        for (let i = 1; i < historicalData.length; i++) {
          if (historicalData[i].time <= historicalData[i - 1].time) {
            console.error('❌ Data not in ascending order!', {
              index: i,
              prev: historicalData[i - 1].time,
              current: historicalData[i].time
            });
            throw new Error('Historical data is not properly sorted');
          }
        }

        lineSeries.setData(historicalData);
        
        const lastDataPoint = historicalData[historicalData.length - 1];
        setLatestPrice(lastDataPoint.value);
        lastUpdateTimeRef.current = lastDataPoint.time; // Track last timestamp
        
        // Initialize current interval tracker with the last historical data point's interval
        currentIntervalRef.current = roundToInterval(lastDataPoint.time);
        
        chart.timeScale().fitContent();
        
        setLoading(false);
        setError(null);

        console.log('✅ Chart initialized with', historicalData.length, 'data points');

        // 🚀 START LIVE HEARTBEAT IMMEDIATELY - Chart will flow to the right!
        startLiveHeartbeat(lineSeries);
        setIsLiveConnected(true); // Show LIVE indicator immediately
        
        // Try WebSocket first, fall back to polling if it fails
        // Use tokenMint for real-time subscription (baseTokenMint parameter)
        console.log('🔌 Attempting RPC WebSocket connection...');
        console.log('   Token Mint:', tokenMint);
        console.log('   Pair Address:', pairAddress);
        
        const wsConnected = await setupWebSocket(tokenMint, lineSeries);
        
        if (!wsConnected) {
          console.log('⚠️ WebSocket failed, using polling fallback');
          setUsePolling(true);
          setupPricePolling(pairAddress, lineSeries);
        } else {
          console.log('✅ RPC WebSocket connected successfully!');
        }

        // Handle resize
        const handleResize = () => {
          if (chart && chartContainerRef.current) {
            const newWidth = chartContainerRef.current.clientWidth;
            const newHeight = chartContainerRef.current.clientHeight;
            
            if (newWidth && newHeight) {
              chart.applyOptions({
                width: newWidth,
                height: newHeight,
              });
            }
          }
        };

        window.addEventListener('resize', handleResize);

        // Store cleanup function
        chart.cleanup = () => {
          window.removeEventListener('resize', handleResize);
        };

      } catch (error) {
        console.error('❌ Error initializing chart:', error);
        setError(error.message || 'Failed to load chart data');
        setLoading(false);
      }
    };

    const setupWebSocket = (tokenMint, lineSeries) => {
      return new Promise((resolve) => {
        try {
          if (wsRef.current) {
            wsRef.current.close();
          }

          if (!tokenMint) {
            console.log('⚠️ No token mint provided, skipping WebSocket');
            resolve(false);
            return;
          }

          // Use our backend's RPC price WebSocket
          const wsUrl = import.meta.env.PROD 
            ? 'wss://api.moonfeed.app/ws/price'
            : 'ws://localhost:3001/ws/price';

          console.log('🔌 Connecting to RPC Price WebSocket:', wsUrl);
          console.log('🎯 Subscribing to token:', tokenMint);
          
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;
          
          let connectionTimeout = setTimeout(() => {
            console.log('⏱️ WebSocket connection timeout');
            ws.close();
            resolve(false);
          }, 5000); // 5 second timeout

          ws.onopen = () => {
            clearTimeout(connectionTimeout);
            console.log('✅ RPC Price WebSocket connected');
            setIsLiveConnected(true);
            
            // Subscribe to token price updates
            const subscribeMessage = {
              type: 'subscribe',
              token: tokenMint
            };
            
            console.log('📤 Subscribing to token:', tokenMint);
            ws.send(JSON.stringify(subscribeMessage));
            resolve(true);
          };

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              
              console.log('🔔 [Chart] Received WebSocket message:', message.type, message);
              
              // Handle different message types
              switch (message.type) {
                case 'connected':
                  console.log('✅ RPC WebSocket connected:', message.message);
                  break;
                  
                case 'subscribed':
                  console.log('✅ Subscribed to token:', message.token);
                  break;
                  
                case 'price-update':
                  // Real-time price update from Solana RPC!
                  const { price, timestamp, source } = message;
                  
                  console.log('📨 Received price-update:', { 
                    token: message.token,
                    price, 
                    timestamp,
                    source,
                    hasLineSeries: !!lineSeries,
                    chartExists: !!chartRef.current
                  });
                  
                  if (price && !isNaN(price) && timestamp && lineSeries) {
                    // Convert timestamp to seconds if needed
                    const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
                    const currentInterval = roundToInterval(timeInSeconds);
                    const config = TIMEFRAME_CONFIG[selectedTimeframe];
                    
                    console.log(`📊 Updating chart for current ${config?.label || 'interval'}:`, { 
                      actualTime: new Date(timeInSeconds * 1000).toLocaleTimeString(),
                      intervalTime: new Date(currentInterval * 1000).toLocaleTimeString(),
                      value: price,
                      source
                    });
                    
                    // Determine if price went up or down for animation
                    const previousPrice = latestPrice || price;
                    const priceDirection = previousPrice ? (price > previousPrice ? 'up' : (price < previousPrice ? 'down' : 'same')) : null;
                    
                    // Smooth animated update within current 5-minute interval
                    try {
                      console.log('🎬 Animating price change within current interval:', {
                        from: previousPrice,
                        to: price,
                        interval: new Date(currentInterval * 1000).toLocaleTimeString(),
                        change: (((price - previousPrice) / previousPrice) * 100).toFixed(2) + '%'
                      });
                      
                      // Animate price update within the current 5-minute interval
                      animatePriceUpdate(lineSeries, previousPrice, price, timeInSeconds);
                      
                      console.log('✅ Chart animation started! New price: $' + price.toFixed(8) + ' (source: ' + source + ')');
                    } catch (error) {
                      console.error('❌ Error updating chart:', error);
                      // Fallback to immediate update if animation fails
                      lineSeries.update({ 
                        time: currentInterval, 
                        value: price 
                      });
                      setLatestPrice(price);
                      lastUpdateTimeRef.current = timeInSeconds;
                      currentIntervalRef.current = currentInterval;
                    }
                    
                    // Trigger visual feedback animation
                    if (priceDirection && priceDirection !== 'same' && chartContainerRef.current) {
                      const container = chartContainerRef.current;
                      // Remove existing animation classes
                      container.classList.remove('price-flash-up', 'price-flash-down');
                      // Trigger reflow to restart animation
                      void container.offsetWidth;
                      // Add animation class based on direction
                      container.classList.add(`price-flash-${priceDirection}`);
                      
                      // Remove class after animation completes
                      setTimeout(() => {
                        container.classList.remove('price-flash-up', 'price-flash-down');
                      }, 600);
                    }
                    
                    console.log(`💰 LIVE Price Update: $${price.toFixed(8)} ${priceDirection && priceDirection !== 'same' ? `(${priceDirection === 'up' ? '📈' : '📉'})` : ''} [${source}]`);
                  }
                  break;
                  
                case 'error':
                  console.error('❌ RPC WebSocket error:', message.message);
                  break;
                  
                default:
                  console.log('📨 RPC message:', message);
              }
            } catch (err) {
              console.error('❌ WebSocket message parsing error:', err);
              console.error('Raw message:', event.data);
            }
          };

          ws.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.error('❌ RPC WebSocket connection error:', error);
            resolve(false);
          };

          ws.onclose = (event) => {
            clearTimeout(connectionTimeout);
            setIsLiveConnected(false);
            console.log('🔌 RPC WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
            
            if (event.code === 1006) {
              console.log('⚠️ WebSocket failed to connect - falling back to polling');
            }
          };
        } catch (err) {
          console.error('❌ WebSocket setup error:', err);
          resolve(false);
        }
      });
    };

    const setupPricePolling = (poolAddress, lineSeries) => {
      console.log('🔄 Starting price polling (every', PRICE_UPDATE_INTERVAL / 1000, 'seconds)');
      
      const pollPrice = async () => {
        const priceData = await fetchLatestPrice(poolAddress);
        
        if (priceData && lineSeries) {
          const { price, timestamp } = priceData;
          const currentInterval = roundToInterval(timestamp);
          
          console.log('🔄 Polling update - Price:', price, 'at', new Date(timestamp * 1000).toLocaleTimeString(), 'interval:', new Date(currentInterval * 1000).toLocaleTimeString());
          
          // Update the current 5-minute interval point
          const previousPrice = latestPrice || price;
          animatePriceUpdate(lineSeries, previousPrice, price, timestamp);
        }
      };
      
      // Poll immediately
      pollPrice();
      
      // Then poll at regular intervals
      pollingIntervalRef.current = setInterval(pollPrice, PRICE_UPDATE_INTERVAL);
    };

    initialize();

    // Cleanup only on unmount, pair change, or timeframe change
    return () => {
      mounted = false;
      
      // Stop heartbeat animation
      stopLiveHeartbeat();
      
      // Cancel any ongoing animations
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      if (chartRef.current) {
        if (chartRef.current.cleanup) {
          chartRef.current.cleanup();
        }
        chartRef.current.remove();
        chartRef.current = null;
      }
      
      lineSeriesRef.current = null;
    };
  }, [pairAddress, selectedTimeframe]); // Re-initialize if pairAddress or timeframe changes

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    console.log('🕐 Changing timeframe to:', newTimeframe);
    setSelectedTimeframe(newTimeframe);
    // The useEffect will handle re-initialization
  };


  return (
    <div className="twelve-data-chart-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Loading State */}
      {loading && (
        <div className="chart-loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading chart...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="chart-error-overlay">
          <p className="error-message">⚠️ {error}</p>
          <button 
            className="retry-button"
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Timeframe Selector */}
      <div className="timeframe-selector">
        {Object.entries(TIMEFRAME_CONFIG).map(([key, { label }]) => (
          <button
            key={key}
            className={`timeframe-btn ${selectedTimeframe === key ? 'active' : ''}`}
            onClick={() => handleTimeframeChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Live Indicator */}
      {isLiveConnected && (
        <div className="live-indicator">
          <span className="live-dot"></span>
          LIVE
        </div>
      )}
    </div>
  );
};

export default TwelveDataChart;
