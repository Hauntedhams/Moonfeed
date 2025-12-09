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

// Client-side cache for chart data (shared across all chart instances)
const chartDataCache = new Map();
const CHART_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased to reduce API calls)
const pendingFetches = new Map(); // Deduplicate concurrent fetches

// Debounce timer for timeframe changes
let timeframeChangeTimer = null;
const TIMEFRAME_DEBOUNCE_MS = 800; // Wait 800ms after last click before fetching (increased from 500ms)

const TwelveDataChart = ({ coin, isActive = false, isDesktopMode = false, onCrosshairMove, onFirstPriceUpdate }) => {
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
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m'); // Track selected timeframe
  const [isInView, setIsInView] = useState(isDesktopMode); // Track if chart is in viewport - start true if desktop
  const [shouldLoad, setShouldLoad] = useState(isDesktopMode); // Track if chart should load - start true if desktop  
  const [showAdvanced, setShowAdvanced] = useState(false); // Toggle between clean and advanced chart
  const [isLiveMode, setIsLiveMode] = useState(true); // Track if chart should auto-scroll to live data
  const isLiveModeRef = useRef(true); // Ref to track live mode for use in intervals
  const userInteractionTimeoutRef = useRef(null); // Track user interaction timeout
  const [chartInitialized, setChartInitialized] = useState(false); // Track when chart is fully initialized

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
  
  // 🔍 DEBUG: Log what we're working with (commented to reduce console spam)
  // useEffect(() => {
  //   console.log('🎯 TwelveDataChart received coin:', {
  //     symbol: coin?.symbol,
  //     name: coin?.name,
  //     pairAddress,
  //     tokenMint,
  //     hasChartData: !!coin?.chartData,
  //     chartDataLength: coin?.chartData?.length,
  //     allKeys: Object.keys(coin || {})
  //   });
  // }, [coin]);

  // Detect and track theme changes
  useEffect(() => {
    const detectTheme = () => {
      // Check if dark-mode class exists on documentElement
      // If the class exists, it's dark mode; otherwise it's light mode (the default)
      const isDark = document.documentElement.classList.contains('dark-mode');
      
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

  // Sync isLiveMode state with ref for use in intervals
  useEffect(() => {
    isLiveModeRef.current = isLiveMode;
  }, [isLiveMode]);

  // 🚀 LAZY LOADING: Only load chart when near viewport
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    // 🖥️ DESKTOP MODE FIX: If isDesktopMode prop is true, this chart is in the desktop right panel
    // It should load immediately without intersection observer
    if (isDesktopMode) {
      setIsInView(true);
      setShouldLoad(true);
      return; // Skip intersection observer setup
    }

    // 📱 MOBILE/TABLET: Check viewport width as fallback for responsive design
    const checkDesktopMode = () => {
      const isDesktopViewport = window.innerWidth >= 1200;
      
      if (isDesktopViewport && !shouldLoad) {
        setIsInView(true);
        setShouldLoad(true);
      }
      
      return isDesktopViewport;
    };
    
    // Check immediately
    const isDesktop = checkDesktopMode();
    
    if (isDesktop) {
      // In desktop mode, also listen for resize events in case user resizes window
      const handleResize = () => {
        checkDesktopMode();
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    // Mobile/Tablet: Create intersection observer with 200% rootMargin (load before visible)
    // This means charts load when they're within 2 screen heights of viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            setShouldLoad(true);
          } else {
            setIsInView(false);
            // Keep shouldLoad true once loaded - don't unload already loaded charts
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: '200% 0px', // Start loading 2 screen heights before visible
        threshold: 0.01 // Trigger when even 1% is visible
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [coin?.symbol, shouldLoad, isDesktopMode]);

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
        background: { type: 'solid', color: '#0a0a0a' }, // Changed from transparent to solid color
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
          
          // Smooth scroll to show latest data ONLY if in live mode
          if (chartRef.current && isLiveModeRef.current) {
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
          
          // Smooth scroll to show latest data ONLY if in live mode
          if (chartRef.current && isLiveModeRef.current) {
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

  // Check if this is a Moonfeed-native coin (not on DEX yet)
  const isMoonfeedNative = () => {
    // Moonfeed coins will have specific markers from backend enrichment
    return coin?.source === 'moonfeed' || 
           coin?.isMoonfeedNative || 
           coin?.mintAddress === 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon' || // $MOO token
           (!coin?.poolAddress && !coin?.pairAddress && coin?.mintAddress); // Has mint but no DEX pair
  };

  // Fetch historical OHLCV data from GeckoTerminal via backend proxy
  const fetchHistoricalData = async (poolAddress, timeframeKey = '5m') => {
    const config = TIMEFRAME_CONFIG[timeframeKey];
    if (!config) {
      throw new Error(`Invalid timeframe: ${timeframeKey}`);
    }

    const { timeframe, aggregate, limit } = config;
    const cacheKey = `${poolAddress}-${timeframeKey}`;
    const now = Date.now();
    
    // 🚀 OPTIMIZATION: Check if coin already has preloaded chart data from backend
    if (coin?.chartData && timeframeKey === '1m' && Array.isArray(coin.chartData)) {
      console.log(`📦 Using preloaded chart data for ${coin.symbol} (${coin.chartData.length} candles)`);
      
      // Convert preloaded OHLCV to chart format
      const chartData = coin.chartData.map(candle => ({
        time: candle[0],
        value: parseFloat(candle[4]) // Close price
      })).sort((a, b) => a.time - b.time);
      
      // Cache it for future timeframe changes
      chartDataCache.set(cacheKey, { data: chartData, timestamp: now });
      
      return chartData;
    }
    
    // 🌙 MOONFEED FALLBACK: For coins not on DEX yet, create chart from current price
    if (isMoonfeedNative()) {
      console.log('🌙 Moonfeed-native coin detected, using RPC price data');
      
      // Check if we have a current price from the coin object
      const currentPrice = coin?.priceUsd || coin?.price || coin?.baseTokenPrice;
      
      if (currentPrice && !isNaN(currentPrice)) {
        console.log(`💰 Using current price: $${currentPrice}`);
        
        // Create a simple flat chart showing current price over last hour
        // This will update live via WebSocket
        const currentTime = Math.floor(Date.now() / 1000);
        const intervalSeconds = config.intervalSeconds || 300;
        const numPoints = Math.min(limit, 12); // 12 points for 1 hour at 5min intervals
        
        const chartData = [];
        for (let i = numPoints - 1; i >= 0; i--) {
          chartData.push({
            time: currentTime - (i * intervalSeconds),
            value: parseFloat(currentPrice)
          });
        }
        
        console.log(`📊 Created ${chartData.length} data points from current price`);
        chartDataCache.set(cacheKey, { data: chartData, timestamp: now });
        
        return chartData;
      } else {
        console.warn('⚠️ No price data available for Moonfeed coin');
        // Return empty array to show placeholder
        return [];
      }
    }
    
    // Check cache first
    const cachedData = chartDataCache.get(cacheKey);
    if (cachedData && now - cachedData.timestamp < CHART_CACHE_DURATION) {
      console.log(`📊 ✅ Cache hit: ${cacheKey} (age: ${Math.round((now - cachedData.timestamp) / 1000)}s)`);
      return cachedData.data;
    }
    
    // Check if there's already a pending fetch for this data
    if (pendingFetches.has(cacheKey)) {
      console.log(`📊 � Deduplicating fetch: ${cacheKey}`);
      return pendingFetches.get(cacheKey);
    }
    
    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        // Use backend proxy to avoid CORS errors
        const url = `${BACKEND_API}/api/geckoterminal/ohlcv/solana/${poolAddress}/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
        
        console.log('📊 Fetching historical data:', { timeframeKey, timeframe, aggregate, limit });
        
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          // Special handling for 404 (coin not on DEX yet) - likely a Moonfeed coin
          if (response.status === 404 || errorData.status === 404 || errorData.error?.includes('404 Not Found')) {
            console.warn('⚠️ Coin not found on GeckoTerminal (likely pre-DEX Moonfeed coin)');
            
            // Try Moonfeed fallback
            const fallbackData = await fetchHistoricalData(poolAddress, timeframeKey);
            if (fallbackData && fallbackData.length > 0) {
              return fallbackData;
            }
            
            // Return empty to show friendly message
            console.log('💤 No data available yet for this coin');
            return [];
          }
          
          // Special handling for rate limiting or service unavailable
          if (response.status === 429 || response.status === 503 || errorData.status === 429 || errorData.status === 403) {
            console.warn('⚠️ API temporarily unavailable (status:', response.status, ')');
            
            // Check if we have cached data for this coin
            if (cachedData) {
              console.log('📦 Using stale cached data (age:', Math.round((now - cachedData.timestamp) / 60000), 'min)');
              return cachedData.data;
            }
            
            // No cache available - return empty array to show placeholder
            // Don't throw error, just defer loading
            console.log('💤 No cache available, chart will retry when scrolled to');
            return []; // Return empty array instead of throwing
          }
          
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
        
        console.log('✅ Historical data fetched:', chartData.length, 'candles');
        if (chartData.length > 0) {
          console.log('   Time range:', 
            new Date(chartData[0].time * 1000).toLocaleTimeString(), 
            '→', 
            new Date(chartData[chartData.length - 1].time * 1000).toLocaleTimeString()
          );
        }
        
        // Cache the fetched data
        chartDataCache.set(cacheKey, { data: chartData, timestamp: Date.now() });
        
        // Clean up old cache entries (keep last 100)
        if (chartDataCache.size > 100) {
          const firstKey = chartDataCache.keys().next().value;
          chartDataCache.delete(firstKey);
        }
        
        return chartData;
      } catch (err) {
        console.error('❌ Error fetching historical data:', err);
        throw err;
      } finally {
        // Always remove from pending fetches
        pendingFetches.delete(cacheKey);
      }
    })();
    
    // Store the promise to deduplicate concurrent requests
    pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
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
    // Skip initialization if in advanced mode or chart already exists
    if (!pairAddress || chartRef.current || showAdvanced) return;
    
    let mounted = true;
    
    const initialize = async () => {
      // Wait for DOM to be ready and retry if dimensions aren't available
      let retries = 0;
      const maxRetries = 10; // Reduced from 20 - fail faster for off-screen charts
      
      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 150ms
        
        if (!mounted || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        
        // Check if container is actually visible in the DOM using getBoundingClientRect
        const rect = container.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        
        // If container is not visible (off-screen, hidden, or collapsed), silently exit
        // This is expected for charts that are below the fold - not an error condition
        if (!isVisible) {
          retries++;
          if (retries >= maxRetries) {
            // Silently defer initialization - chart will load when visible
            setLoading(false);
            return;
          }
          continue;
        }
        
        const width = container.clientWidth || Math.floor(rect.width);
        const height = container.clientHeight || Math.floor(rect.height);
        
        if (width && height && width > 100 && height > 100) {
          break; // Dimensions are ready
        }
        
        retries++;
        if (retries >= maxRetries) {
          // Only show error if container is visible but has invalid dimensions
          setError('Chart container failed to initialize. Please try reopening the chart.');
          setLoading(false);
          return;
        }
      }
      
      if (!mounted || !chartContainerRef.current) return;

      const container = chartContainerRef.current;
      const rect = container.getBoundingClientRect();
      const width = container.clientWidth || Math.floor(rect.width);
      const height = container.clientHeight || Math.floor(rect.height);

      try {
        
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
            mode: 0, // Changed to Normal mode (0) instead of Magnet mode (1)
            vertLine: {
              color: colors.crosshair,
              width: 1,
              style: 2,
              visible: true,
              labelVisible: true,
              labelBackgroundColor: colors.crosshairLabel,
            },
            horzLine: {
              color: colors.crosshair,
              width: 1,
              style: 2,
              visible: true,
              labelVisible: true,
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

        // 🔍 DIAGNOSTIC: Check if canvas was created
        const canvasElements = container.querySelectorAll('canvas');
        if (canvasElements.length === 0) {
          console.warn('⚠️ No canvas elements found after chart creation!');
        } else {
          console.log(`✅ Chart created with ${canvasElements.length} canvas elements`);
        }

        // Get timeScale reference for all event listeners
        const timeScale = chart.timeScale();
        let isUserInteracting = false;

        // � NOTE: Crosshair subscription moved to separate useEffect to avoid stale closure
        // See the useEffect with [chartRef.current, lineSeriesRef.current, onCrosshairMove] dependencies

        // Subscribe to visible logical range changes to update first visible price
        timeScale.subscribeVisibleLogicalRangeChange(() => {
          if (!onFirstPriceUpdate) return;
          
          try {
            const logicalRange = timeScale.getVisibleLogicalRange();
            if (logicalRange) {
              // Get the first visible bar index (left edge of visible range)
              const firstVisibleIndex = Math.ceil(logicalRange.from);
              
              // Get all data from the series
              const allData = lineSeries.data();
              
              if (allData && allData.length > 0 && firstVisibleIndex >= 0 && firstVisibleIndex < allData.length) {
                const firstVisiblePrice = allData[firstVisibleIndex].value;
                onFirstPriceUpdate(firstVisiblePrice);
              }
            }
          } catch (error) {
            // Silently fail - not critical for functionality
            console.debug('Could not update first visible price:', error);
          }
        });
        
        // Track mouse/touch interactions on the chart
        container.addEventListener('mousedown', () => {
          isUserInteracting = true;
        });
        
        container.addEventListener('touchstart', () => {
          isUserInteracting = true;
        });
        
        container.addEventListener('wheel', () => {
          if (isLiveMode) {
            console.log('👤 User is scrolling chart - disabling live mode');
            setIsLiveMode(false);
          }
        });
        
        // Subscribe to visible logical range changes (user scrolling/panning)
        timeScale.subscribeVisibleLogicalRangeChange(() => {
          // Only disable live mode if user is interacting with the chart
          if (isUserInteracting && isLiveMode) {
            console.log('👤 User is panning chart - disabling live mode');
            setIsLiveMode(false);
            isUserInteracting = false;
          }
        });
        
        // Reset interaction flag when mouse/touch is released
        container.addEventListener('mouseup', () => {
          setTimeout(() => {
            isUserInteracting = false;
          }, 100);
        });
        
        container.addEventListener('touchend', () => {
          setTimeout(() => {
            isUserInteracting = false;
          }, 100);
        });

        console.log('✅ Chart created, fetching historical data...');
        
        // Fetch and set historical data
        setLoading(true);
        const historicalData = await fetchHistoricalData(pairAddress, selectedTimeframe);
        
        if (!mounted) return;
        
        // If no data available (API rate limited and no cache), show friendly message
        if (historicalData.length === 0) {
          console.log('📊 No data available yet');
          setLoading(false);
          
          // Check if this is a Moonfeed coin
          if (isMoonfeedNative()) {
            // Show a friendly pre-launch message for Moonfeed coins without price
            setError('🌙 Awaiting first trade - Chart will update live when trading begins');
          } else {
            setError('Chart data loading... Auto-retry in 5s');
            
            // Auto-retry after 5 seconds for regular DEX coins
            setTimeout(() => {
              if (mounted) {
                console.log('🔄 Auto-retrying chart load...');
                setError(null);
                setShouldLoad(false);
                // Re-trigger lazy load on next scroll
                setTimeout(() => {
                  if (mounted) {
                    setShouldLoad(true);
                  }
                }, 100);
              }
            }, 5000);
          }
          
          // Clean up chart since we can't display anything
          if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
          }
          lineSeriesRef.current = null;
          
          return;
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
        
        // Send first visible price to parent for percentage calculation
        if (onFirstPriceUpdate && historicalData.length > 0) {
          const firstDataPoint = historicalData[0];
          onFirstPriceUpdate(firstDataPoint.value);
        }
        
        setLoading(false);
        setError(null);
        setChartInitialized(true); // Mark chart as initialized for crosshair subscription

        console.log('✅ Chart initialized with', historicalData.length, 'data points');
        
        // Ensure chart is fully interactive
        chart.applyOptions({
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false, // Disable vertical drag to allow crosshair hover
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
          // Ensure crosshair is properly configured
          crosshair: {
            mode: 0, // Normal mode - crosshair appears everywhere
            vertLine: {
              width: 1,
              color: 'rgba(32, 226, 47, 0.5)',
              style: 2,
              visible: true,
              labelVisible: true,
            },
            horzLine: {
              width: 1,
              color: 'rgba(32, 226, 47, 0.5)',
              style: 2,
              visible: true,
              labelVisible: true,
            },
          },
        });

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

        // Handle resize with debouncing for better performance
        let resizeTimeout;
        const handleResize = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            if (chart && chartContainerRef.current) {
              const newWidth = chartContainerRef.current.clientWidth;
              const newHeight = chartContainerRef.current.clientHeight;
              
              console.log('📏 Resizing chart to:', { newWidth, newHeight });
              
              if (newWidth && newHeight && newWidth > 100 && newHeight > 100) {
                chart.applyOptions({
                  width: newWidth,
                  height: newHeight,
                });
                // Refit content after resize to ensure proper display
                chart.timeScale().fitContent();
              }
            }
          }, 150);
        };

        window.addEventListener('resize', handleResize);
        
        // Also trigger a resize check after a short delay to handle desktop layout
        setTimeout(() => {
          handleResize();
        }, 300);

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

    // 🚀 LAZY LOADING: Only initialize chart when shouldLoad is true AND not in advanced mode
    if (shouldLoad && !showAdvanced) {
      initialize();
    } else {
      setLoading(false); // Don't show loading spinner for deferred charts
    }

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
      setChartInitialized(false); // Reset initialization state
    };
  }, [pairAddress, selectedTimeframe, shouldLoad, showAdvanced]); // Re-initialize if pairAddress, timeframe, shouldLoad, or showAdvanced changes

  // 🔥 CRITICAL FIX: Separate effect for crosshair subscription to avoid stale callback
  // This effect runs whenever the chart is initialized or callback changes
  useEffect(() => {
    if (!chartInitialized) {
      console.log(`📊 [TwelveDataChart] Crosshair subscription skipped - chart not initialized yet`);
      return;
    }
    
    const chart = chartRef.current;
    const lineSeries = lineSeriesRef.current;
    
    if (!chart || !lineSeries) {
      console.log(`📊 [TwelveDataChart] Crosshair subscription skipped - chart or series not ready`);
      return;
    }
    
    if (!onCrosshairMove) {
      console.log(`📊 [TwelveDataChart] Crosshair subscription skipped - no callback provided`);
      return;
    }
    
    console.log(`📊 [TwelveDataChart] ✅ Setting up fresh crosshair subscription for ${coin?.symbol}`);
    console.log(`📊 [TwelveDataChart] Chart exists:`, !!chart, 'Series exists:', !!lineSeries, 'Callback exists:', !!onCrosshairMove);
    
    // Subscribe to crosshair move events
    const handler = (param) => {
      console.log(`📊 [TwelveDataChart] 🎯 CROSSHAIR EVENT FIRED!`, {
        hasParam: !!param,
        hasTime: !!param?.time,
        hasSeriesData: !!param?.seriesData,
        time: param?.time,
        point: param?.point
      });
      
      if (!param || !param.time || !param.seriesData) {
        // Crosshair moved away or no data - restore live price
        console.log(`📊 [TwelveDataChart] 🔄 Restoring live price (no data at crosshair)`);
        onCrosshairMove(null);
        return;
      }
      
      // Get the price at the crosshair position - use ref to avoid stale closure
      const currentLineSeries = lineSeriesRef.current;
      if (!currentLineSeries) {
        console.log(`📊 [TwelveDataChart] ⚠️ Line series ref is null`);
        return;
      }
      
      const priceData = param.seriesData.get(currentLineSeries);
      console.log(`📊 [TwelveDataChart] 💰 Price data at crosshair:`, priceData);
      
      if (priceData && priceData.value !== undefined) {
        // Send crosshair data to parent
        console.log(`📊 [TwelveDataChart] ✅ Calling onCrosshairMove with price: $${priceData.value}`);
        onCrosshairMove({
          price: priceData.value,
          time: param.time,
        });
      } else {
        console.log(`📊 [TwelveDataChart] ⚠️ No price data at this point`);
        onCrosshairMove(null);
      }
    };
    
    chart.subscribeCrosshairMove(handler);
    console.log(`📊 [TwelveDataChart] ✅ Crosshair subscription active for ${coin?.symbol}`);
    
    // Cleanup subscription when effect re-runs or unmounts
    return () => {
      console.log(`📊 [TwelveDataChart] 🧹 Cleaning up crosshair subscription for ${coin?.symbol}`);
      if (chart && handler) {
        chart.unsubscribeCrosshairMove(handler);
      }
    };
  }, [chartInitialized, onCrosshairMove, coin?.symbol]); // Re-subscribe when chart initializes or callback changes

  // Handle switching between clean and advanced modes
  useEffect(() => {
    if (showAdvanced) {
      // Switching to advanced mode - clean up chart to free resources
      console.log('🔄 Switching to advanced mode, cleaning up chart');
    } else if (shouldLoad && !chartRef.current) {
      // Returning to clean mode - chart needs to be reinitialized
      console.log('🔄 Returning to clean mode, chart will reinitialize');
    }
  }, [showAdvanced]);

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    console.log('🕐 Changing timeframe to:', newTimeframe);
    
    // Update UI immediately for better UX
    setSelectedTimeframe(newTimeframe);
    
    // Debounce the actual data fetch to avoid rate limiting
    if (timeframeChangeTimer) {
      clearTimeout(timeframeChangeTimer);
      console.log('⏳ Debouncing timeframe change...');
    }
    
    // Set loading state to show user we're processing
    setLoading(true);
    
    timeframeChangeTimer = setTimeout(() => {
      console.log('✅ Executing debounced timeframe change to:', newTimeframe);
      // Force re-render to trigger useEffect with new timeframe
      setSelectedTimeframe(newTimeframe + ''); // Ensure state update triggers
    }, TIMEFRAME_DEBOUNCE_MS);
  };

  // Handle "Go Live" button click
  const handleGoLive = () => {
    console.log('🔴 Returning to live mode');
    setIsLiveMode(true);
    
    // Restore live price in parent component
    if (onCrosshairMove) {
      onCrosshairMove(null);
    }
    
    // Scroll chart to the latest data
    if (chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  };


  return (
    <div 
      className="twelve-data-chart-wrapper" 
      style={{ 
        width: '100%', 
        height: isDesktopMode ? '100vh' : '100%', 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Lazy Load Placeholder - Show when chart hasn't loaded yet (but not in desktop mode) */}
      {!shouldLoad && !isDesktopMode && (
        <div className="chart-lazy-placeholder">
          <div className="placeholder-content">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="m19 9-5 5-4-4-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.6 }}>Chart loading soon...</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {shouldLoad && loading && (
        <div className="chart-loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading chart...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="chart-error-overlay">
          <p className="error-message">
            {error.includes('loading') ? '📊' : '⚠️'} {error}
          </p>
          {!error.includes('Scroll away') && (
            <button 
              className="retry-button"
              onClick={() => {
                setError(null);
                setShouldLoad(true); // Retry loading
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Chart Container - Show clean chart when not in advanced mode */}
      {!showAdvanced && (
        <div 
          ref={chartContainerRef} 
          className="chart-container"
          style={{ 
            width: '100%', 
            height: isDesktopMode ? '100vh' : '100%',
            flex: 1,
            position: 'relative',
            minHeight: isDesktopMode ? '100vh' : '400px',
            backgroundColor: '#0a0a0a', // Ensure visible background
            zIndex: 1, // Ensure proper stacking
          }} 
        />
      )}

      {/* Advanced Dexscreener Chart - Show when in advanced mode */}
      {showAdvanced && (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <iframe
            src={`https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&trades=0&info=0`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '12px',
            }}
            title="Dexscreener Advanced Chart"
          />
        </div>
      )}

      {/* Timeframe Selector - Only show when chart is loaded or loading */}
      {shouldLoad && (
        <div className="timeframe-selector">
          {!showAdvanced && Object.entries(TIMEFRAME_CONFIG).map(([key, { label }]) => (
            <button
              key={key}
              className={`timeframe-btn ${selectedTimeframe === key ? 'active' : ''}`}
              onClick={() => handleTimeframeChange(key)}
            >
              {label}
            </button>
          ))}
          <button
            className={`timeframe-btn ${showAdvanced ? 'clean-btn' : 'advanced-btn'}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
            title={showAdvanced ? "Switch to clean chart" : "Switch to advanced chart"}
          >
            {showAdvanced ? 'Clean' : 'Advanced'}
          </button>
        </div>
      )}

      {/* Live Indicator - Show when in live mode */}
      {isLiveConnected && isLiveMode && (
        <div className="live-indicator">
          <span className="live-dot"></span>
          LIVE
        </div>
      )}

      {/* Go Live Button - Show when user has scrolled away from live view */}
      {isLiveConnected && !isLiveMode && (
        <div className="go-live-button-container">
          <button className="go-live-button" onClick={handleGoLive}>
            <span className="live-icon">▶</span>
            Go Live
          </button>
        </div>
      )}
    </div>
  );
};

export default TwelveDataChart;
