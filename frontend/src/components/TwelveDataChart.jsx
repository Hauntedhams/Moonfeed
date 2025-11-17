import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import './TwelveDataChart.css';

const GECKOTERMINAL_API = 'https://api.geckoterminal.com/api/v2';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [usePolling, setUsePolling] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false); // Track RPC WebSocket status
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize based on actual DOM state
    return document.documentElement.classList.contains('dark-mode');
  }); // Track theme mode

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
   * Smooth price animation function
   * Interpolates between current and target price over a duration
   */
  const animatePriceUpdate = (lineSeries, fromPrice, toPrice, timestamp, duration = 400) => {
    if (!lineSeries || !chartRef.current) return;
    
    const startTime = performance.now();
    const priceDiff = toPrice - fromPrice;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out function for smooth deceleration
      const easeOutQuad = (t) => t * (2 - t);
      const easedProgress = easeOutQuad(progress);
      
      // Calculate interpolated price
      const currentPrice = fromPrice + (priceDiff * easedProgress);
      
      try {
        // Update chart with interpolated value
        lineSeries.update({
          time: timestamp,
          value: currentPrice
        });
        
        // Continue animation if not complete
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete, ensure final value is set
          lineSeries.update({
            time: timestamp,
            value: toPrice
          });
          setLatestPrice(toPrice);
          
          // Auto-scroll smoothly to show new data
          if (chartRef.current) {
            const timeScale = chartRef.current.timeScale();
            timeScale.scrollToRealTime();
          }
        }
      } catch (error) {
        console.error('❌ Animation error:', error);
      }
    };
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Fetch historical OHLCV data from GeckoTerminal
  const fetchHistoricalData = async (poolAddress) => {
    try {
      const timeframe = 'minute';
      const aggregate = 5;
      const limit = 100;
      
      const url = `${GECKOTERMINAL_API}/networks/solana/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data?.data?.attributes?.ohlcv_list) {
        throw new Error('Invalid OHLCV data format');
      }
      
      // Convert OHLCV to line chart data (using close prices)
      const chartData = data.data.attributes.ohlcv_list.map(candle => ({
        time: candle[0], // Unix timestamp
        value: candle[4], // Close price
      })).reverse(); // Reverse to get chronological order
      
      return chartData;
    } catch (err) {
      console.error('Error fetching historical data:', err);
      throw err;
    }
  };

  // Fetch latest price from GeckoTerminal
  const fetchLatestPrice = async (poolAddress) => {
    try {
      const url = `${GECKOTERMINAL_API}/networks/solana/pools/${poolAddress}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
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
            rightOffset: 12, // More space on the right for smooth scrolling
            barSpacing: 12, // Slightly wider spacing for smoother animation
            minBarSpacing: 8,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            shiftVisibleRangeOnNewBar: true, // Auto-scroll to show new data
            fixLeftEdge: false, // Allow smooth scrolling
            fixRightEdge: false, // Allow smooth scrolling
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
        const historicalData = await fetchHistoricalData(pairAddress);
        
        if (!mounted) return;
        
        if (historicalData.length === 0) {
          throw new Error('No historical data available');
        }

        lineSeries.setData(historicalData);
        
        const lastPrice = historicalData[historicalData.length - 1].value;
        setLatestPrice(lastPrice);
        
        chart.timeScale().fitContent();
        
        setLoading(false);
        setError(null);

        console.log('✅ Chart initialized with', historicalData.length, 'data points');

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
                    
                    console.log('📊 Adding point to chart:', { 
                      time: timeInSeconds, 
                      value: price,
                      source,
                      readableTime: new Date(timeInSeconds * 1000).toLocaleTimeString()
                    });
                    
                    // Determine if price went up or down for animation
                    const previousPrice = latestPrice || price;
                    const priceDirection = previousPrice ? (price > previousPrice ? 'up' : (price < previousPrice ? 'down' : 'same')) : null;
                    
                    // Smooth animated update
                    try {
                      // Calculate animation duration based on price change magnitude
                      const priceDiffPercent = Math.abs((price - previousPrice) / previousPrice) * 100;
                      // Shorter duration for small changes, longer for big moves (200-600ms range)
                      const animDuration = Math.min(Math.max(priceDiffPercent * 50, 200), 600);
                      
                      console.log('🎬 Animating price change:', {
                        from: previousPrice,
                        to: price,
                        change: priceDiffPercent.toFixed(2) + '%',
                        duration: animDuration + 'ms'
                      });
                      
                      // Animate the price update smoothly
                      animatePriceUpdate(lineSeries, previousPrice, price, timeInSeconds, animDuration);
                      
                      console.log('✅ Chart animation started! New price: $' + price.toFixed(8) + ' (source: ' + source + ')');
                    } catch (error) {
                      console.error('❌ Error updating chart:', error);
                      // Fallback to immediate update if animation fails
                      lineSeries.update({ 
                        time: timeInSeconds, 
                        value: price 
                      });
                      setLatestPrice(price);
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
          
          console.log('🔄 Polling update - Price:', price, 'at', new Date(timestamp * 1000).toLocaleTimeString());
          
          lineSeries.update({
            time: timestamp,
            value: price,
          });
          
          setLatestPrice(price);
        }
      };
      
      // Poll immediately
      pollPrice();
      
      // Then poll at regular intervals
      pollingIntervalRef.current = setInterval(pollPrice, PRICE_UPDATE_INTERVAL);
    };

    initialize();

    // Cleanup only on unmount or pair change
    return () => {
      mounted = false;
      
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
  }, [pairAddress]); // Re-initialize if pairAddress changes (removed isActive dependency)

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="twelve-data-chart">
      <div 
        className="chart-container" 
        ref={chartContainerRef}
        style={{ 
          minHeight: '380px',
          width: '100%',
          position: 'relative',
          flex: 1
        }}
      >
        {loading && <div className="loading-overlay">Loading chart data...</div>}
        {error && <div className="chart-error">{error}</div>}
        {isLiveConnected && !loading && !error && (
          <div className="live-indicator">
            <span className="live-dot"></span>
            LIVE
          </div>
        )}
      </div>
      {latestPrice !== null && (
        <div className="latest-price">
          Latest Price: ${latestPrice.toFixed(8)}
          {isLiveConnected && <span className="live-badge"> • Real-Time</span>}
        </div>
      )}
    </div>
  );
};

export default TwelveDataChart;
