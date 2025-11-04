import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

// Create a singleton WebSocket context
const LiveDataContext = createContext(null);

// WebSocket singleton instance
let wsInstance = null;
let wsListeners = new Set();
let coinsState = new Map();
let chartsState = new Map();
let connectionState = 'disconnected';

export function LiveDataProvider({ children }) {
  const [coins, setCoins] = useState(new Map());
  const [charts, setCharts] = useState(new Map());
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  
  // MOBILE FIX: Reduce max attempts on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const maxReconnectAttempts = isMobile ? 2 : 5;

  const updateCoins = useCallback((updater) => {
    coinsState = typeof updater === 'function' ? updater(coinsState) : updater;
    setCoins(new Map(coinsState));
  }, []);

  const updateCharts = useCallback((updater) => {
    chartsState = typeof updater === 'function' ? updater(chartsState) : updater;
    setCharts(new Map(chartsState));
  }, []);

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('🔗 WebSocket already connected/connecting');
      return;
    }

    try {
      // MOBILE FIX: Disable WebSocket on mobile in production
      if (isMobile && import.meta.env.PROD) {
        console.log('📱 Mobile device - WebSocket disabled for stability');
        setConnectionStatus('disabled');
        connectionState = 'disabled';
        return;
      }

      const wsUrl = import.meta.env.PROD 
        ? 'wss://api.moonfeed.app/ws'
        : 'ws://localhost:3001/ws';
      
      console.log('🔗 Connecting to WebSocket:', wsUrl);
      setConnectionStatus('connecting');
      connectionState = 'connecting';
      
      wsRef.current = new WebSocket(wsUrl);
      wsInstance = wsRef.current;

      wsRef.current.onopen = () => {
        console.log('🟢 WebSocket connected');
        setConnected(true);
        setConnectionStatus('connected');
        connectionState = 'connected';
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'price-update':
              updateCoins(prev => {
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
              
            case 'jupiter-prices-update':
              updateCoins(prev => {
                const updated = new Map(prev);
                if (message.data) {
                  message.data.forEach(priceUpdate => {
                    const address = priceUpdate.address;
                    if (address) {
                      const existing = updated.get(address) || {};
                      updated.set(address, { 
                        ...existing, 
                        price_usd: priceUpdate.price,
                        livePrice: true,
                        jupiterLive: true
                      });
                    }
                  });
                }
                return updated;
              });
              break;
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      wsRef.current.onerror = () => {
        setConnectionStatus('error');
        connectionState = 'error';
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        setConnectionStatus('disconnected');
        connectionState = 'disconnected';
        wsRef.current = null;
        wsInstance = null;
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          setConnectionStatus('reconnecting');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.warn('WebSocket: Max reconnection attempts reached');
          setConnectionStatus('failed');
          connectionState = 'failed';
        }
      };
    } catch (error) {
      console.error('WebSocket creation error:', error);
      setConnectionStatus('error');
      connectionState = 'error';
    }
  }, [isMobile, maxReconnectAttempts, updateCoins]);

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

  const getCoin = useCallback((address) => {
    return coins.get(address);
  }, [coins]);

  const getChart = useCallback((address) => {
    return charts.get(address);
  }, [charts]);

  const value = {
    coins,
    charts,
    connected,
    connectionStatus,
    getCoin,
    getChart
  };

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  );
}

// Hook to use the WebSocket data (safe to call multiple times)
export function useLiveData() {
  const context = useContext(LiveDataContext);
  if (!context) {
    // Fallback for components not wrapped in provider
    return {
      coins: new Map(),
      charts: new Map(),
      connected: false,
      connectionStatus: 'disconnected',
      getCoin: () => null,
      getChart: () => null
    };
  }
  return context;
}
