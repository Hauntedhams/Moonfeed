import { useEffect, useState, useRef, useCallback } from 'react';

export function useLiveData() {
  const [coins, setCoins] = useState(new Map());
  const [charts, setCharts] = useState(new Map());
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  // MOBILE FIX: Reduce max attempts on mobile to prevent battery drain
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const maxReconnectAttempts = isMobile ? 2 : 5;

  const connect = useCallback(() => {
    try {
      // MOBILE FIX: Disable WebSocket on mobile to prevent crashes and battery drain
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && import.meta.env.PROD) {
        console.log('📱 Mobile device detected - WebSocket disabled for stability');
        setConnectionStatus('disabled');
        return;
      }

      // Use ws:// for local development, wss:// for production
      const wsUrl = import.meta.env.PROD 
        ? 'wss://api.moonfeed.app/ws'
        : 'ws://localhost:3001/ws';
      
      console.log('🔗 Connecting to WebSocket:', wsUrl);
      setConnectionStatus('connecting');
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('🟢 WebSocket connected - Live data stream active');
        setConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Only log essential messages to reduce console spam
          if (message.type === 'welcome' || message.type === 'initial' || Math.random() < 0.1) {
            console.log('📨 WebSocket message received:', message.type);
          }
          
          switch (message.type) {
            case 'welcome':
              console.log('👋 WebSocket welcome:', message.message);
              break;
              
            case 'initial':
              // Set initial snapshot
              console.log(`📊 Initial data received: ${message.data.coins?.length || 0} coins`);
              const coinsMap = new Map();
              if (message.data.coins) {
                message.data.coins.forEach(coin => {
                  const address = coin.address || coin.mintAddress;
                  if (address) {
                    coinsMap.set(address, coin);
                  }
                });
              }
              setCoins(coinsMap);
              
              const chartsMap = new Map();
              if (message.data.charts) {
                message.data.charts.forEach(({ address, chart }) => {
                  chartsMap.set(address, chart);
                });
              }
              setCharts(chartsMap);
              break;
              
            case 'price-update':
              // Live price updates - most frequent
              console.log(`💰 Price update: ${message.data?.length || 0} coins`);
              setCoins(prev => {
                const updated = new Map(prev);
                if (message.data) {
                  message.data.forEach(coin => {
                    const address = coin.address || coin.mintAddress;
                    if (address) {
                      const existing = updated.get(address) || {};
                      updated.set(address, { ...existing, ...coin });
                    }
                  });
                }
                return updated;
              });
              break;
              
            case 'market-update':
              // Market cap, volume updates - less frequent
              console.log(`📈 Market update: ${message.data?.length || 0} coins`);
              setCoins(prev => {
                const updated = new Map(prev);
                if (message.data) {
                  message.data.forEach(coin => {
                    const address = coin.address || coin.mintAddress;
                    if (address) {
                      const existing = updated.get(address) || {};
                      updated.set(address, { ...existing, ...coin });
                    }
                  });
                }
                return updated;
              });
              break;
              
            case 'chart-update':
              // Chart data updates
              console.log(`📊 Chart update: ${message.data?.length || 0} charts`);
              setCharts(prev => {
                const updated = new Map(prev);
                if (message.data) {
                  message.data.forEach(({ address, chart }) => {
                    if (address && chart) {
                      updated.set(address, chart);
                    }
                  });
                }
                return updated;
              });
              break;
              
            case 'status':
              console.log('📊 Server status:', message.data);
              break;
              
            case 'server-shutdown':
              console.log('🛑 Server shutting down:', message.message);
              setConnectionStatus('server-shutdown');
              break;
              
            case 'jupiter-prices-update':
              // Jupiter live price updates - high frequency - reduce logging
              if (Math.random() < 0.01) { // Only log 1% of Jupiter updates
                console.log(`🪐 Jupiter price update: ${message.data?.length || 0} coins`);
              }
              setCoins(prev => {
                const updated = new Map(prev);
                if (message.data) {
                  message.data.forEach(priceUpdate => {
                    const address = priceUpdate.address;
                    if (address) {
                      const existing = updated.get(address) || {};
                      // Update with live Jupiter price data
                      updated.set(address, { 
                        ...existing, 
                        price_usd: priceUpdate.price,
                        price: priceUpdate.price,
                        priceUsd: priceUpdate.price,
                        previousPrice: priceUpdate.previousPrice,
                        priceChangeInstant: priceUpdate.priceChangeInstant,
                        lastPriceUpdate: priceUpdate.timestamp,
                        livePrice: true, // Mark as having live price
                        jupiterLive: true, // Mark as Jupiter live data
                        source: 'jupiter-live'
                      });
                    }
                  });
                }
                return updated;
              });
              break;
              
            default:
              console.log('❓ Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        // Suppress error logging to prevent console spam (backend may be starting)
        setConnectionStatus('error');
      };

      wsRef.current.onclose = (event) => {
        // Only log disconnections occasionally
        setConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          // Suppress reconnection logs to prevent console spam
          setConnectionStatus('reconnecting');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          // Only log when giving up
          console.warn('WebSocket: Max reconnection attempts reached');
          setConnectionStatus('failed');
        }
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      setConnectionStatus('error');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback((coinAddresses) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('📋 Subscribing to coins:', coinAddresses);
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        coins: coinAddresses
      }));
    } else {
      console.warn('⚠️ Cannot subscribe - WebSocket not connected');
    }
  }, []);

  const unsubscribe = useCallback((coinAddresses) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('📋 Unsubscribing from coins:', coinAddresses);
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        coins: coinAddresses
      }));
    } else {
      console.warn('⚠️ Cannot unsubscribe - WebSocket not connected');
    }
  }, []);

  const requestStatus = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'status'
      }));
    }
  }, []);

  const getCoin = useCallback((address) => {
    return coins.get(address);
  }, [coins]);

  const getChart = useCallback((address) => {
    return charts.get(address);
  }, [charts]);

  const manualReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttempts.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
    }
    setTimeout(connect, 1000);
  }, [connect]);

  // Convert Map to Array for easier use in components
  const coinsArray = Array.from(coins.values());

  return {
    // Data
    coins: coinsArray,
    coinsMap: coins,
    chartsMap: charts,
    
    // Status
    connected,
    connectionStatus,
    isLive: connected,
    
    // Methods
    getCoin,
    getChart,
    subscribe,
    unsubscribe,
    requestStatus,
    manualReconnect,
    
    // Stats
    coinsCount: coins.size,
    chartsCount: charts.size,
    reconnectAttempts: reconnectAttempts.current
  };
}
