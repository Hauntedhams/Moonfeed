import { useEffect, useState, useRef, useCallback } from 'react';

export function useLiveData() {
  const [coins, setCoins] = useState(new Map());
  const [charts, setCharts] = useState(new Map());
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      // Use ws:// for local development, wss:// for production
      const wsUrl = import.meta.env.PROD 
        ? `wss://${window.location.host}/ws`
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
          
          console.log('📨 WebSocket message received:', message.type);
          
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
              
            default:
              console.log('❓ Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
      };

      wsRef.current.onclose = (event) => {
        console.log(`🔴 WebSocket disconnected (${event.code}: ${event.reason || 'No reason'})`);
        setConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          setConnectionStatus('reconnecting');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
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
