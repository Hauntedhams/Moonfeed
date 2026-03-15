import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

// Use backend proxy to avoid CORS errors
const BACKEND_API = import.meta.env.PROD 
  ? 'https://api.moonfeed.app'
  : 'http://localhost:3001';
const PRICE_UPDATE_INTERVAL = 3000; // Poll for price updates every 3 seconds (fallback only — WebSocket is primary)

// Client-side cache for chart data (shared across all chart instances)
const chartDataCache = new Map();
const CHART_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased to reduce API calls)
const pendingFetches = new Map(); // Deduplicate concurrent fetches

// Debounce timer for timeframe changes
let timeframeChangeTimer = null;
const TIMEFRAME_DEBOUNCE_MS = 800; // Wait 800ms after last click before fetching (increased from 500ms)

const TwelveDataChart = ({ coin, isActive = false, isDesktopMode = false, showPriceScale, onCrosshairMove, onFirstPriceUpdate }) => {
  // Get dark mode from context - this is the source of truth
  const { isDarkMode: contextDarkMode } = useDarkMode();
  
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
  const [selectedTimeframe, setSelectedTimeframe] = useState('tick'); // Default to tick for Pump.fun-style live chart
  const [isInView, setIsInView] = useState(isDesktopMode); // Track if chart is in viewport - start true if desktop
  const [shouldLoad, setShouldLoad] = useState(isDesktopMode); // Track if chart should load - start true if desktop  
  const [showAdvanced, setShowAdvanced] = useState(false); // Toggle between clean and advanced chart
  const [isLiveMode, setIsLiveMode] = useState(true); // Track if chart should auto-scroll to live data
  const isLiveModeRef = useRef(true); // Ref to track live mode for use in intervals
  const userInteractionTimeoutRef = useRef(null); // Track user interaction timeout
  const [chartInitialized, setChartInitialized] = useState(false); // Track when chart is fully initialized
  const [tooltipData, setTooltipData] = useState(null); // Track tooltip data for click/hover display

  // Extract pairAddress for advanced Dexscreener embed, and tokenMint for chart data + real-time subscription
  // Our chart data now comes from Helius RPC via /api/chart-data/:mintAddress — no GeckoTerminal needed.
  const pairAddress = coin?.pairAddress || 
                      coin?.poolAddress || 
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

  // Update chart when theme changes from context
  useEffect(() => {
    // Update chart colors if chart exists when context dark mode changes
    if (chartRef.current) {
      updateChartTheme(contextDarkMode);
    }
  }, [contextDarkMode]);

  // Dynamically show/hide the right price scale when the info layer is expanded.
  // On mobile, the price scale is hidden by default to avoid overlap with action buttons.
  // When the info layer slides up (expanded), the buttons scroll out of view so we show prices.
  // Depends on chartInitialized so it also fires after a late chart creation.
  useEffect(() => {
    if (!chartRef.current || isDesktopMode) return; // Desktop always shows it
    const shouldShow = showPriceScale === true;
    console.log(`📊 [Chart] Price scale visibility → ${shouldShow} (chartInit: ${chartInitialized})`);
    try {
      chartRef.current.applyOptions({
        rightPriceScale: { visible: shouldShow },
      });
      // Resize to reclaim/give space for the price axis
      if (chartContainerRef.current) {
        const w = chartContainerRef.current.clientWidth;
        const h = chartContainerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          chartRef.current.resize(w, h);
          chartRef.current.timeScale().fitContent();
        }
      }
    } catch (e) {
      console.warn('📊 [Chart] Failed to update price scale:', e.message);
    }
  }, [showPriceScale, isDesktopMode, chartInitialized]);

  // Sync isLiveMode state with ref for use in intervals
  useEffect(() => {
    isLiveModeRef.current = isLiveMode;
  }, [isLiveMode]);

  // 🔧 FIX: Listen for window resize to properly resize the chart
  // Simplified since we now use React conditional rendering instead of CSS display:none
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;
    
    const resizeChart = () => {
      if (!chartRef.current || !chartContainerRef.current) return;
      
      const container = chartContainerRef.current;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      
      if (width > 50 && height > 50) {
        try {
          chartRef.current.resize(width, height);
          chartRef.current.timeScale().fitContent();
        } catch (err) {
          console.warn('Chart resize error:', err);
        }
      }
    };
    
    // Debounced resize handler
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeChart, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [chartRef.current, chartContainerRef.current]);

  // � FIX: Resize chart when switching between desktop and mobile modes
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;
    
    // Small delay to let CSS layout settle after mode change
    const timer = setTimeout(() => {
      if (!chartRef.current || !chartContainerRef.current) return;
      
      const container = chartContainerRef.current;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      
      if (width > 50 && height > 50) {
        try {
          console.log('📐 Resizing chart for mode change:', { isDesktopMode, width, height });
          chartRef.current.resize(width, height);
          chartRef.current.timeScale().fitContent();
        } catch (err) {
          console.warn('Mode change resize error:', err);
        }
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [isDesktopMode]);

  // �🚀 LAZY LOADING: Only load chart when near viewport
  // Simplified since we now use React conditional rendering for desktop/mobile
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Desktop mode: Load immediately - chart is in the right panel via portal
    if (isDesktopMode) {
      setIsInView(true);
      setShouldLoad(true);
      return;
    }

    // Mobile mode: Use intersection observer for lazy loading
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
    
    console.log('🎨 updateChartTheme called with isDark:', isDark);

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
        borderVisible: false, // Hide border line to avoid black bar
        textColor: colors.text,
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
    
    // Force resize to trigger full redraw including price scale background
    if (chartContainerRef.current) {
      const width = chartContainerRef.current.clientWidth;
      const height = chartContainerRef.current.clientHeight;
      if (width > 0 && height > 0) {
        chartRef.current.resize(width, height);
      }
    }
  };

  // Get theme-specific colors
  const getThemeColors = (isDark) => {
    // Use the exact same background color for both chart and price scale
    const bgColor = isDark ? '#0a0e1a' : '#ffffff';
    
    console.log('🎨 getThemeColors called with isDark:', isDark, '-> bgColor:', bgColor);
    
    if (isDark) {
      return {
        // Use proper object format for solid background
        background: { type: 'solid', color: bgColor },
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
        background: { type: 'solid', color: bgColor },
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
   * Start live heartbeat animation - keeps the chart flowing to the right
   * Only fires if no real price update has come in recently
   */
  const startLiveHeartbeat = (lineSeries) => {
    if (!lineSeries || heartbeatIntervalRef.current) return;
    
    console.log('💓 Starting live heartbeat animation');
    
    // Heartbeat checks every 2 seconds — only acts if no real updates are coming in
    heartbeatIntervalRef.current = setInterval(() => {
      if (!lineSeries || !chartRef.current) return;
      
      const currentPrice = latestPriceRef.current;
      if (!currentPrice) return;
      
      const currentTime = Math.floor(Date.now() / 1000);
      const lastUpdate = lastUpdateTimeRef.current || 0;
      const timeSinceUpdate = currentTime - lastUpdate;
      
      // Only heartbeat if no real price update in last 3 seconds
      if (timeSinceUpdate >= 3) {
        try {
          const currentInterval = roundToInterval(currentTime);
          lineSeries.update({
            time: currentInterval,
            value: currentPrice
          });
          lastUpdateTimeRef.current = currentTime;
          
          if (chartRef.current && isLiveModeRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
          }
        } catch (error) {
          // Silently fail
        }
      }
    }, 2000);
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
   * Ultra-fast price update function — Pump.fun-style real-time chart
   * 
   * Instead of slow 1-second easing animations, this:
   * 1. Immediately plots the new price on the chart (instant visual update)
   * 2. Uses requestAnimationFrame only for batching (not for slow interpolation)
   * 3. Tracks the current candle interval and creates new points on interval crossings
   * 
   * This gives the effect of the chart line moving in real-time, 
   * multiple times per second, just like Pump.fun's app.
   */
  const latestPriceRef = useRef(null); // Track price without React re-renders
  const pendingPriceRef = useRef(null); // Buffer for next frame
  const rafScheduledRef = useRef(false); // Prevent multiple rAF calls
  
  const animatePriceUpdate = (lineSeries, fromPrice, toPrice, actualTime) => {
    if (!lineSeries || !chartRef.current) return;
    
    // Round to current interval based on selected timeframe
    const currentInterval = roundToInterval(actualTime);
    
    // Check if we've moved to a new interval
    const previousInterval = currentIntervalRef.current;
    if (previousInterval !== null && currentInterval > previousInterval) {
      // Lock in the previous interval's final price before moving on
      try {
        lineSeries.update({
          time: previousInterval,
          value: latestPriceRef.current || fromPrice
        });
      } catch (e) { /* ignore */ }
    }
    
    // Update the current interval tracker
    currentIntervalRef.current = currentInterval;
    
    // Store the target price for batched update
    pendingPriceRef.current = { interval: currentInterval, price: toPrice, time: actualTime };
    latestPriceRef.current = toPrice;
    
    // Schedule a single rAF to flush the update (batches rapid updates within the same frame)
    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true;
      requestAnimationFrame(() => {
        rafScheduledRef.current = false;
        
        const pending = pendingPriceRef.current;
        if (!pending || !lineSeries || !chartRef.current) return;
        
        try {
          // INSTANT update — no interpolation, no easing
          // This is what makes the chart feel "alive" like Pump.fun
          lineSeries.update({
            time: pending.interval,
            value: pending.price
          });
          
          lastUpdateTimeRef.current = pending.time;
          
          // Auto-scroll to keep the live edge visible
          if (chartRef.current && isLiveModeRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
          }
        } catch (error) {
          // Silently fail — next update will fix it
        }
      });
    }
    
    // Update React state sparingly (throttled) to avoid re-render overhead
    // Only update state every ~500ms, not on every tick
    const now = Date.now();
    if (!animatePriceUpdate._lastStateUpdate || now - animatePriceUpdate._lastStateUpdate > 500) {
      animatePriceUpdate._lastStateUpdate = now;
      setLatestPrice(toPrice);
    }
  };

  // Timeframe configuration — used for bucket intervals and UI labels
  // Backend handles the actual data bucketing via Helius RPC
  const TIMEFRAME_CONFIG = {
    'tick': { timeframe: 'minute', aggregate: 1, limit: 100, label: 'Tick', intervalSeconds: 5 }, // 5-second "tick" buckets — every trade creates visible movement
    '1m': { timeframe: 'minute', aggregate: 1, limit: 100, label: '1m', intervalSeconds: 60 },
    '5m': { timeframe: 'minute', aggregate: 5, limit: 100, label: '5m', intervalSeconds: 300 },
    '15m': { timeframe: 'minute', aggregate: 15, limit: 100, label: '15m', intervalSeconds: 900 },
    '1h': { timeframe: 'hour', aggregate: 1, limit: 100, label: '1h', intervalSeconds: 3600 },
    '4h': { timeframe: 'hour', aggregate: 4, limit: 100, label: '4h', intervalSeconds: 14400 },
    '1d': { timeframe: 'day', aggregate: 1, limit: 100, label: '1D', intervalSeconds: 86400 },
  };

  // Check if this is a Moonfeed-native coin (not on DEX yet)
  // NOTE: With the unified Helius RPC backend, this is mainly used for UI messaging.
  // All coins with a mint address get chart data from on-chain swaps.
  const isMoonfeedNative = () => {
    if (coin?.pairAddress || coin?.poolAddress) return false;
    return coin?.source === 'moonfeed' || 
           coin?.isMoonfeedNative || 
           (!coin?.poolAddress && !coin?.pairAddress && coin?.mintAddress);
  };

  // Fetch chart data from our unified backend endpoint (Helius RPC — no GeckoTerminal)
  const fetchHistoricalData = async (_unused, timeframeKey = '5m') => {
    const config = TIMEFRAME_CONFIG[timeframeKey];
    if (!config) {
      throw new Error(`Invalid timeframe: ${timeframeKey}`);
    }

    // Use tokenMint (mint address) — our backend works with ANY mint, no pool address needed
    const mint = tokenMint;
    if (!mint) {
      console.warn('⚠️ No mint address available for chart data fetch');
      return [];
    }

    const cacheKey = `${mint}-${timeframeKey}`;
    const now = Date.now();

    // 🚀 OPTIMIZATION: Check if coin already has preloaded chart data from backend
    if (coin?.chartData && timeframeKey === '1m' && Array.isArray(coin.chartData)) {
      console.log(`📦 Using preloaded chart data for ${coin.symbol} (${coin.chartData.length} candles)`);

      const chartData = coin.chartData.map(candle => ({
        time: candle[0],
        value: parseFloat(candle[4]) // Close price
      })).sort((a, b) => a.time - b.time);

      chartDataCache.set(cacheKey, { data: chartData, timestamp: now });
      return chartData;
    }

    // Check client-side cache first
    const cachedData = chartDataCache.get(cacheKey);
    if (cachedData && now - cachedData.timestamp < CHART_CACHE_DURATION) {
      console.log(`📊 ✅ Cache hit: ${cacheKey} (age: ${Math.round((now - cachedData.timestamp) / 1000)}s)`);
      return cachedData.data;
    }

    // Check if there's already a pending fetch for this data
    if (pendingFetches.has(cacheKey)) {
      console.log(`📊 Deduplicating fetch: ${cacheKey}`);
      return pendingFetches.get(cacheKey);
    }

    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        const url = `${BACKEND_API}/api/chart-data/${mint}?timeframe=${timeframeKey}`;

        console.log('📊 Fetching chart data from Helius RPC:', { mint: mint.substring(0, 8), timeframeKey });

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

          if (response.status === 404) {
            console.log('💤 No chart data available yet for this token');
            return [];
          }

          if (response.status === 429 || response.status === 503) {
            console.warn('⚠️ Backend temporarily unavailable (status:', response.status, ')');
            // Return stale cache if available
            if (cachedData) {
              console.log('📦 Using stale cached data (age:', Math.round((now - cachedData.timestamp) / 60000), 'min)');
              return cachedData.data;
            }
            return [];
          }

          // For 500 errors, log but don't throw — treat as "no data yet"
          if (response.status === 500) {
            console.warn('⚠️ Backend error (500) — will retry:', errorData.details || errorData.error);
            if (cachedData) return cachedData.data;
            return [];
          }

          console.error('❌ Chart data error:', response.status, errorData);
          throw new Error(`Chart data error: ${response.status} - ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        if (!data?.success || !Array.isArray(data.data) || data.data.length === 0) {
          console.warn('⚠️ No chart data in response');
          return [];
        }

        // Data comes pre-sorted from backend as { time, value } — exactly what lightweight-charts needs
        const chartData = data.data;

        // Remove duplicate timestamps (safety check)
        for (let i = 1; i < chartData.length; i++) {
          if (chartData[i].time <= chartData[i - 1].time) {
            chartData.splice(i, 1);
            i--;
          }
        }

        console.log('✅ Chart data fetched:', chartData.length, 'candles from', data.source);
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
        console.error('❌ Error fetching chart data:', err);
        throw err;
      } finally {
        pendingFetches.delete(cacheKey);
      }
    })();

    // Store the promise to deduplicate concurrent requests
    pendingFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  };

  // Fetch latest price from our unified backend (Helius RPC — no GeckoTerminal)
  const fetchLatestPrice = async () => {
    try {
      const mint = tokenMint;
      if (!mint) return null;

      const url = `${BACKEND_API}/api/chart-data/${mint}?timeframe=tick`;

      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();

      if (!data?.success || !Array.isArray(data.data) || data.data.length === 0) return null;

      // Use the last candle's value as the current price
      const lastCandle = data.data[data.data.length - 1];
      return { price: lastCandle.value, timestamp: lastCandle.time };
    } catch (err) {
      console.error('Error fetching latest price:', err);
      return null;
    }
  };

  // Initialize chart and load data (only once)
  useEffect(() => {
    // Initialize chart when tokenMint is available (works for ALL coins — no pairAddress needed)
    // Our backend uses Helius RPC directly with mint addresses
    const canInitialize = tokenMint || pairAddress || isMoonfeedNative();
    if (!canInitialize || chartRef.current || showAdvanced) return;
    
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
        
        // Get theme colors - use contextDarkMode from React context as single source of truth
        const colors = getThemeColors(contextDarkMode);
        
        console.log('🎨 Creating chart with theme:', { isDark: contextDarkMode, bgColor: colors.background.color });
        
        // Create chart with theme-aware styling
        const chart = createChart(container, {
          layout: {
            background: colors.background,
            textColor: colors.text,
            // Ensure the font color is visible
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
              top: 0.02,
              bottom: 0.02,
            },
            visible: true, // Always create with price scale visible; useEffect toggles it for mobile when not expanded
            autoScale: true,
            alignLabels: true,
            borderVisible: false,
            mode: 0,
            minimumWidth: 85,
            textColor: colors.text,
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

        // 🎨 CRITICAL: Force theme update immediately after chart creation
        // This ensures the price scale gets the correct background color
        // even if contextDarkMode was stale during initial creation
        // Force resize after chart creation to ensure proper rendering
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            const containerWidth = chartContainerRef.current.clientWidth;
            const containerHeight = chartContainerRef.current.clientHeight;
            if (containerWidth > 0 && containerHeight > 0) {
              chartRef.current.resize(containerWidth, containerHeight);
            }
          }
        }, 50);

        // Get timeScale reference for all event listeners
        const timeScale = chart.timeScale();
        let isUserInteracting = false;

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

        console.log('✅ Chart created, fetching chart data from Helius RPC...');
        
        // Fetch and set historical data (uses tokenMint via backend — no pairAddress needed)
        setLoading(true);
        let historicalData = await fetchHistoricalData(null, selectedTimeframe);
        
        if (!mounted) return;
        
        // 🔄 AUTO-ESCALATE TIMEFRAME: If insufficient data (< 3 candles), try larger timeframes
        // This handles low-volume coins (like Moonshot-launched tokens) where minute data is sparse
        if (historicalData.length < 3) {
          // Skip intermediate timeframes — jump to 1d first (most likely to have data for low-volume coins)
          // then fall back to 4h if 1d somehow fails
          const escalationOrder = ['1d', '4h', '1h'];
          
          console.log(`📊 Only ${historicalData.length} candles at ${selectedTimeframe}, escalating timeframes...`);
          
          for (const fallbackTf of escalationOrder) {
            if (!mounted) return;
            if (fallbackTf === selectedTimeframe) continue; // Skip if already tried
            try {
              console.log(`📊 Trying ${fallbackTf} timeframe...`);
              const fallbackData = await fetchHistoricalData(null, fallbackTf);
              if (fallbackData.length >= 3) {
                console.log(`✅ Found ${fallbackData.length} candles at ${fallbackTf} timeframe`);
                historicalData = fallbackData;
                break;
              }
            } catch (e) {
              console.warn(`⚠️ ${fallbackTf} timeframe failed:`, e.message);
            }
          }
        }
        
        if (!mounted) return;
        
        // If no data available, show friendly message
        if (historicalData.length === 0) {
          console.log('📊 No data available yet');
          setLoading(false);
          setError('📊 No trade data yet — chart will appear after first trades');
          
          // Auto-retry after 10 seconds
          setTimeout(() => {
            if (mounted) {
              console.log('🔄 Auto-retrying chart load...');
              setError(null);
              setShouldLoad(false);
              setTimeout(() => {
                if (mounted) {
                  setShouldLoad(true);
                }
              }, 100);
            }
          }, 10000);
          
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
        latestPriceRef.current = lastDataPoint.value; // Keep ref in sync for fast path
        lastUpdateTimeRef.current = lastDataPoint.time; // Track last timestamp
        
        // Initialize current interval tracker with the last historical data point's interval
        currentIntervalRef.current = roundToInterval(lastDataPoint.time);
        
        chart.timeScale().fitContent();
        
        // Force chart resize after a brief delay to ensure proper rendering
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            const container = chartContainerRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;
            
            if (width > 0 && height > 0) {
              chartRef.current.resize(width, height);
              chartRef.current.timeScale().fitContent();
            }
          }
        }, 100);
        
        // Send first visible price to parent for percentage calculation
        if (onFirstPriceUpdate && historicalData.length > 0) {
          const firstDataPoint = historicalData[0];
          onFirstPriceUpdate(firstDataPoint.value);
        }
        
        setLoading(false);
        setError(null);
        console.log('🎯 [INIT] Setting chartInitialized to TRUE');
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
          setupPricePolling(lineSeries);
        } else {
          console.log('✅ RPC WebSocket connected successfully!');
        }

        // Handle resize with debouncing for better performance
        let resizeTimeout;
        const handleResize = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            if (chart && chartContainerRef.current) {
              const rect = chartContainerRef.current.getBoundingClientRect();
              const newWidth = Math.floor(rect.width);
              const newHeight = Math.floor(rect.height);
              
              if (newWidth > 50 && newHeight > 50) {
                console.log('📏 Window resize - resizing chart to:', { newWidth, newHeight });
                try {
                  chart.resize(newWidth, newHeight);
                  chart.timeScale().fitContent();
                } catch (err) {
                  console.warn('Resize error:', err);
                }
              }
            }
          }, 100);
        };

        window.addEventListener('resize', handleResize);
        
        // 🔧 ResizeObserver for container size changes
        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
          resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              
              // Only resize if dimensions are valid
              if (width > 50 && height > 50 && chartRef.current) {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                  if (chartRef.current && chartContainerRef.current) {
                    const rect = chartContainerRef.current.getBoundingClientRect();
                    const containerWidth = Math.floor(rect.width);
                    const containerHeight = Math.floor(rect.height);
                    
                    if (containerWidth > 50 && containerHeight > 50) {
                      console.log('� ResizeObserver - resizing chart to:', { containerWidth, containerHeight });
                      try {
                        chartRef.current.resize(containerWidth, containerHeight);
                        chartRef.current.timeScale().fitContent();
                      } catch (err) {
                        console.warn('ResizeObserver resize error:', err);
                      }
                    }
                  }
                }, 50);
              }
            }
          });
          
          resizeObserver.observe(chartContainerRef.current);
        }
        
        // Initial resize after chart creation
        setTimeout(handleResize, 100);

        // Store cleanup function
        chart.cleanup = () => {
          window.removeEventListener('resize', handleResize);
          if (resizeObserver) {
            resizeObserver.disconnect();
          }
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
              
              // Handle different message types
              switch (message.type) {
                case 'connected':
                  console.log('✅ RPC WebSocket connected:', message.message);
                  break;
                  
                case 'subscribed':
                  console.log('✅ Subscribed to token:', message.token);
                  break;
                  
                case 'price-update': {
                  // 🚀 FAST PATH: Real-time price update from Solana RPC
                  // Minimal processing — every millisecond counts for Pump.fun-style responsiveness
                  const { price, timestamp } = message;
                  
                  if (price && !isNaN(price) && timestamp && lineSeries) {
                    const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
                    const previousPrice = latestPriceRef.current || price;
                    
                    // Instant chart update — no slow animation, no easing
                    animatePriceUpdate(lineSeries, previousPrice, price, timeInSeconds);
                    
                    // Throttled visual flash feedback (max once per 300ms to avoid jank)
                    if (chartContainerRef.current) {
                      const now = performance.now();
                      if (!ws._lastFlash || now - ws._lastFlash > 300) {
                        ws._lastFlash = now;
                        const direction = price > previousPrice ? 'up' : (price < previousPrice ? 'down' : null);
                        if (direction) {
                          const container = chartContainerRef.current;
                          container.classList.remove('price-flash-up', 'price-flash-down');
                          void container.offsetWidth;
                          container.classList.add(`price-flash-${direction}`);
                          setTimeout(() => {
                            container.classList.remove('price-flash-up', 'price-flash-down');
                          }, 300);
                        }
                      }
                    }
                  }
                  break;
                }
                  
                case 'error':
                  console.error('❌ RPC WebSocket error:', message.message);
                  break;
                  
                default:
                  break;
              }
            } catch (err) {
              // Silently fail on parse errors to avoid blocking the next message
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

    const setupPricePolling = (lineSeries) => {
      console.log('🔄 Starting price polling (every', PRICE_UPDATE_INTERVAL / 1000, 'seconds)');
      
      const pollPrice = async () => {
        const priceData = await fetchLatestPrice();
        
        if (priceData && lineSeries) {
          const { price, timestamp } = priceData;
          const previousPrice = latestPriceRef.current || price;
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
  }, [tokenMint, pairAddress, selectedTimeframe, shouldLoad, showAdvanced]); // Re-initialize if tokenMint, pairAddress, timeframe, shouldLoad, or showAdvanced changes

  // 🔥 CRITICAL FIX: Separate effect for crosshair subscription to avoid stale callback
  // This effect runs whenever the chart is initialized or callback changes
  useEffect(() => {
    console.log(`🎯 [CROSSHAIR-SETUP] Effect triggered - chartInitialized: ${chartInitialized}, showAdvanced: ${showAdvanced}`);
    
    if (!chartInitialized) {
      console.log(`🎯 [CROSSHAIR-SETUP] Skipped - chart not initialized yet`);
      return;
    }
    
    if (showAdvanced) {
      console.log(`🎯 [CROSSHAIR-SETUP] Skipped - advanced mode active`);
      return;
    }
    
    const chart = chartRef.current;
    const lineSeries = lineSeriesRef.current;
    
    console.log(`🎯 [CROSSHAIR-SETUP] Chart ref exists:`, !!chart, 'LineSeries ref exists:', !!lineSeries);
    
    if (!chart || !lineSeries) {
      console.log(`🎯 [CROSSHAIR-SETUP] Skipped - chart or series not ready`);
      return;
    }
    
    console.log(`🎯 [CROSSHAIR-SETUP] ✅ Setting up crosshair subscription for ${coin?.symbol}`);
    
    // Subscribe to crosshair move events
    const handler = (param) => {
      // Log crosshair events (throttle to avoid spam)
      const now = Date.now();
      if (!window._lastCrosshairLog || now - window._lastCrosshairLog > 500) {
        console.log(`🎯 [CROSSHAIR] Event fired!`, {
          hasPoint: !!param?.point,
          hasTime: !!param?.time,
          point: param?.point,
          time: param?.time
        });
        window._lastCrosshairLog = now;
      }
      
      if (!param || !param.point) {
        // Crosshair moved away - restore live price and hide tooltip
        setTooltipData(null);
        if (onCrosshairMove) onCrosshairMove(null);
        return;
      }
      
      // Check if we have series data
      if (!param.time || !param.seriesData) {
        return;
      }
      
      // Get the price at the crosshair position
      const currentLineSeries = lineSeriesRef.current;
      if (!currentLineSeries) {
        return;
      }
      
      const priceData = param.seriesData.get(currentLineSeries);
      
      if (priceData && priceData.value !== undefined) {
        // Format the time for display
        const date = new Date(param.time * 1000);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        // Format price for display
        const price = priceData.value;
        let formattedPrice;
        if (price < 0.00001) {
          formattedPrice = `$${price.toFixed(8)}`;
        } else if (price < 0.01) {
          formattedPrice = `$${price.toFixed(6)}`;
        } else if (price < 1) {
          formattedPrice = `$${price.toFixed(4)}`;
        } else {
          formattedPrice = `$${price.toFixed(2)}`;
        }
        
        console.log(`🎯 [CROSSHAIR] Showing tooltip: ${formattedPrice} at (${param.point.x}, ${param.point.y})`);
        
        // Set tooltip data with position from crosshair point
        setTooltipData({
          price: formattedPrice,
          rawPrice: price,
          time: `${timeStr} • ${dateStr}`,
          x: param.point?.x || 0,
          y: param.point?.y || 0
        });
        
        // Send crosshair data to parent
        if (onCrosshairMove) {
          onCrosshairMove({
            price: priceData.value,
            time: param.time,
          });
        }
      } else {
        setTooltipData(null);
        if (onCrosshairMove) onCrosshairMove(null);
      }
    };
    
    // Subscribe to crosshair
    try {
      chart.subscribeCrosshairMove(handler);
      console.log(`🎯 [CROSSHAIR-SETUP] ✅ Successfully subscribed to crosshair for ${coin?.symbol}`);
    } catch (err) {
      console.error(`🎯 [CROSSHAIR-SETUP] ❌ Failed to subscribe:`, err);
    }
    
    // Cleanup subscription when effect re-runs or unmounts
    return () => {
      console.log(`🎯 [CROSSHAIR-SETUP] 🧹 Cleaning up for ${coin?.symbol}`);
      setTooltipData(null);
      try {
        if (chart && handler) {
          chart.unsubscribeCrosshairMove(handler);
        }
      } catch (err) {
        console.error(`🎯 [CROSSHAIR-SETUP] Cleanup error:`, err);
      }
    };
  }, [chartInitialized, showAdvanced, onCrosshairMove, coin?.symbol]);

  // 📱 FALLBACK: Manual click/touch/hover handler for chart interaction
  // This uses the chart's coordinate conversion to get price at position
  const lastHoverTimeRef = useRef(0);
  const HOVER_THROTTLE_MS = 16; // ~60fps throttle for smooth updates
  
  const handleChartClick = (clientX, clientY, forceUpdate = false) => {
    const chart = chartRef.current;
    const lineSeries = lineSeriesRef.current;
    const container = chartContainerRef.current;
    
    if (!chart || !lineSeries || !container) {
      return;
    }
    
    // Throttle hover updates for performance (but not forced/click events)
    const now = Date.now();
    if (!forceUpdate && now - lastHoverTimeRef.current < HOVER_THROTTLE_MS) {
      return;
    }
    lastHoverTimeRef.current = now;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    try {
      // Use lightweight-charts coordinate conversion
      const timeScale = chart.timeScale();
      
      // Get time at x position
      const time = timeScale.coordinateToTime(x);
      
      if (time) {
        // Get the price value at this time
        const data = lineSeries.data ? lineSeries.data() : [];
        let price = null;
        
        // Find the data point at or nearest to this time
        for (let i = 0; i < data.length; i++) {
          if (data[i].time === time) {
            price = data[i].value;
            break;
          } else if (data[i].time > time && i > 0) {
            // Use the previous point's price (closest match)
            price = data[i - 1].value;
            break;
          }
        }
        
        if (price === null && data.length > 0) {
          price = data[data.length - 1].value;
        }
        
        if (price !== null) {
          const date = new Date(time * 1000);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          
          let formattedPrice;
          if (price < 0.00001) {
            formattedPrice = `$${price.toFixed(8)}`;
          } else if (price < 0.01) {
            formattedPrice = `$${price.toFixed(6)}`;
          } else if (price < 1) {
            formattedPrice = `$${price.toFixed(4)}`;
          } else {
            formattedPrice = `$${price.toFixed(2)}`;
          }
          
          setTooltipData({
            price: formattedPrice,
            rawPrice: price,
            time: `${timeStr} • ${dateStr}`,
            x: x,
            y: y
          });
          
          if (onCrosshairMove) {
            onCrosshairMove({ price, time });
          }
        }
      }
    } catch (err) {
      // Silently handle errors during hover
    }
  };

  // Clear tooltip when switching modes or when chart is hidden
  useEffect(() => {
    if (showAdvanced || !chartInitialized) {
      setTooltipData(null);
    }
  }, [showAdvanced, chartInitialized]);

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
      className={`twelve-data-chart-wrapper ${isDesktopMode ? 'desktop-mode' : ''}`}
      style={isDesktopMode ? { 
        width: '100%', 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      } : { 
        width: '100%', 
        height: 'auto', 
        minHeight: '380px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
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
          onClick={(e) => {
            handleChartClick(e.clientX, e.clientY, true); // Force update on click
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              const touch = e.touches[0];
              handleChartClick(touch.clientX, touch.clientY, true); // Force update on touch
            }
          }}
          onTouchMove={(e) => {
            // Handle touch drag to show price at different points
            if (e.touches.length === 1) {
              const touch = e.touches[0];
              handleChartClick(touch.clientX, touch.clientY);
            }
          }}
          onMouseMove={(e) => {
            // Show price tooltip on hover
            handleChartClick(e.clientX, e.clientY);
          }}
          onMouseLeave={() => {
            // Clear tooltip when mouse leaves chart
            setTooltipData(null);
            if (onCrosshairMove) {
              onCrosshairMove(null);
            }
          }}
          style={{ 
            width: '100%', 
            height: isDesktopMode ? '100%' : '320px',
            minHeight: isDesktopMode ? '400px' : '280px',
            flex: isDesktopMode ? '1' : 'none',
            cursor: 'crosshair',
          }} 
        >
          {/* Historical Price Tooltip - Shows when user hovers/clicks on chart */}
          {tooltipData && (
            <div 
              className="chart-price-tooltip"
              style={{
                left: `${Math.min(Math.max(tooltipData.x + 15, 10), (chartContainerRef.current?.offsetWidth || 300) - 160)}px`,
                top: `${Math.max(tooltipData.y - 70, 10)}px`,
              }}
            >
              <div className="tooltip-price">{tooltipData.price}</div>
              <div className="tooltip-time">{tooltipData.time}</div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Dexscreener Chart - Show when in advanced mode */}
      {showAdvanced && (
        <div className="dexscreener-advanced-container" style={{ width: '100%', height: isDesktopMode ? '100%' : '380px', minHeight: isDesktopMode ? '100vh' : '380px', position: 'relative' }}>
          <iframe
            src={`https://dexscreener.com/solana/${pairAddress}?embed=1&theme=${contextDarkMode ? 'dark' : 'light'}&trades=0&info=0`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: isDesktopMode ? '0' : '12px',
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

    </div>
  );
};

export default TwelveDataChart;
