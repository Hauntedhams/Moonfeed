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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestPrice, setLatestPrice] = useState(null);
  const [usePolling, setUsePolling] = useState(false);

  // Extract pairAddress for historical data and tokenMint for real-time subscription
  const pairAddress = coin?.pairAddress || 
                      coin?.poolAddress || 
                      coin?.address || 
                      coin?.ammAccount ||
                      null;
  
  const tokenMint = coin?.mintAddress || 
                    coin?.address || 
                    coin?.baseToken?.address ||
                    null;

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
    if (!pairAddress || chartRef.current) return;
    
    let mounted = true;
    
    const initialize = async () => {
      // Wait for DOM to be ready and retry if dimensions aren't available
      let retries = 0;
      const maxRetries = 10;
      
      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mounted || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        if (width && height) {
          break; // Dimensions are ready
        }
        
        retries++;
        if (retries >= maxRetries) {
          console.warn('⚠️ Chart container has no dimensions after retries');
          return;
        }
      }
      
      if (!mounted || !chartContainerRef.current) return;

      const container = chartContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      try {
        console.log('📊 Initializing chart for:', pairAddress);
        
        // Create chart
        const chart = createChart(container, {
          layout: {
            background: { color: '#000000' },
            textColor: '#DDD',
          },
          grid: {
            vertLines: { color: '#1a1a1a' },
            horzLines: { color: '#1a1a1a' },
          },
          width: width,
          height: height,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: '#333',
          },
          rightPriceScale: {
            borderColor: '#333',
          },
          crosshair: {
            mode: 1,
          },
        });

        // Create line series
        const lineSeries = chart.addSeries(LineSeries, {
          color: '#2962FF',
          lineWidth: 2,
          priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
          },
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
        const wsConnected = await setupWebSocket(tokenMint, lineSeries);
        
        if (!wsConnected) {
          console.log('⚠️ WebSocket failed, using polling fallback');
          setUsePolling(true);
          setupPricePolling(pairAddress, lineSeries);
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

          console.log('🔌 Attempting WebSocket connection for token mint:', tokenMint);
          
          const ws = new WebSocket(SOLANASTREAM_WS);
          wsRef.current = ws;
          
          let connectionTimeout = setTimeout(() => {
            console.log('⏱️ WebSocket connection timeout');
            ws.close();
            resolve(false);
          }, 5000); // 5 second timeout

          ws.onopen = () => {
            clearTimeout(connectionTimeout);
            console.log('🔌 SolanaStream WebSocket connected');
            
            const subscribeMessage = {
              jsonrpc: '2.0',
              id: 1,
              method: 'swapSubscribe',
              params: {
                include: {
                  baseTokenMint: [tokenMint]  // Subscribe to token mint, not pool
                }
              }
            };
            
            console.log('📤 Sending subscription message:', subscribeMessage);
            ws.send(JSON.stringify(subscribeMessage));
            resolve(true);
          };

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log('📨 Received WebSocket message:', message);
              
              // Check for subscription confirmation (has jsonrpc and result)
              if (message.jsonrpc && message.result !== undefined) {
                console.log('✅ Subscription confirmed:', message.result);
                return;
              }
              
              // Check for error response
              if (message.error) {
                console.error('❌ WebSocket subscription error:', message.error);
                return;
              }
              
              // Handle swap notification (from documentation: has slot, signature, blockTime, swap)
              if (message.swap && message.blockTime) {
                const swap = message.swap;
                console.log('💱 Swap notification received:', swap);
                
                // Extract price from quotePrice field (string format, may be in e-notation)
                const price = parseFloat(swap.quotePrice);
                const timestamp = message.blockTime;
                
                console.log('💰 Extracted price:', price, 'timestamp:', timestamp);
                
                if (price && !isNaN(price) && timestamp && lineSeries) {
                  lineSeries.update({ 
                    time: timestamp, 
                    value: price 
                  });
                  
                  setLatestPrice(price);
                  console.log('✅ Chart updated with live price:', price);
                } else {
                  console.warn('⚠️ Invalid price data:', { price, timestamp });
                }
                return;
              }
              
              // Log unhandled message types
              console.log('ℹ️ Unhandled message type:', message);
            } catch (err) {
              console.error('❌ WebSocket message parsing error:', err);
              console.error('Raw message:', event.data);
            }
          };

          ws.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.error('❌ WebSocket connection error:', error);
            resolve(false);
          };

          ws.onclose = (event) => {
            clearTimeout(connectionTimeout);
            console.log('🔌 WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
            if (event.code === 1006) {
              console.log('⚠️ WebSocket failed to connect (Code 1006 - Network error)');
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
  }, [pairAddress]); // Only re-initialize if pairAddress changes

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="twelve-data-chart">
      <div className="chart-container" ref={chartContainerRef}>
        {loading && <div className="loading-overlay">Loading chart data...</div>}
      </div>
      <div className="latest-price">
        Latest Price: {latestPrice !== null ? `$${latestPrice.toFixed(2)}` : 'N/A'}
      </div>
    </div>
  );
};

export default TwelveDataChart;
