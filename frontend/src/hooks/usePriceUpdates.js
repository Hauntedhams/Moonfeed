import { useEffect, useState, useRef, useCallback } from 'react';

export function usePriceUpdates() {
  const [prices, setPrices] = useState(new Map());
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    try {
      // Use ws:// for local development, wss:// for production
      const wsUrl = import.meta.env.PROD 
        ? `wss://${window.location.host}/ws`
        : 'ws://localhost:3001/ws';
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('💰 Price updates connected');
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'initial':
            case 'price-update':
              // Update prices map - lightweight price-only updates
              const newPrices = new Map();
              const coinsData = message.data?.coins || message.data || [];
              
              coinsData.forEach(coin => {
                const address = coin.address || coin.mintAddress;
                if (address) {
                  newPrices.set(address, {
                    address,
                    symbol: coin.symbol,
                    currentPrice: coin.currentPrice || coin.price_usd || coin.price,
                    lastPrice: coin.lastPrice,
                    priceChange24h: coin.priceChange24h || coin.price_change_24h,
                    priceChangeInstant: coin.priceChangeInstant,
                    volume24h: coin.volume24h || coin.volume_24h_usd,
                    marketCap: coin.marketCap || coin.market_cap_usd,
                    lastUpdate: coin.lastPriceUpdate || Date.now()
                  });
                }
              });
              
              setPrices(prev => {
                // Merge with existing data to avoid losing coins
                const merged = new Map(prev);
                newPrices.forEach((value, key) => {
                  merged.set(key, value);
                });
                return merged;
              });
              
              setLastUpdate(Date.now());
              break;
              
            case 'market-update':
              // Update market data for existing coins
              const marketData = message.data || [];
              setPrices(prev => {
                const updated = new Map(prev);
                marketData.forEach(coin => {
                  const address = coin.address || coin.mintAddress;
                  if (address && updated.has(address)) {
                    const existing = updated.get(address);
                    updated.set(address, {
                      ...existing,
                      volume24h: coin.volume24h || existing.volume24h,
                      marketCap: coin.marketCap || existing.marketCap,
                      priceChange24h: coin.priceChange24h || existing.priceChange24h
                    });
                  }
                });
                return updated;
              });
              break;
          }
        } catch (error) {
          console.error('Error parsing price update:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Price WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('💰 Price updates disconnected');
        setConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error creating price WebSocket:', error);
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
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        coins: coinAddresses
      }));
    }
  }, []);

  const unsubscribe = useCallback((coinAddresses) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        coins: coinAddresses
      }));
    }
  }, []);

  // Helper functions for easy price access
  const getPrice = useCallback((address) => {
    const priceData = prices.get(address);
    return priceData?.currentPrice || 0;
  }, [prices]);

  const getPriceChange = useCallback((address) => {
    const priceData = prices.get(address);
    return priceData?.priceChange24h || 0;
  }, [prices]);

  const getVolume = useCallback((address) => {
    const priceData = prices.get(address);
    return priceData?.volume24h || 0;
  }, [prices]);

  const getMarketCap = useCallback((address) => {
    const priceData = prices.get(address);
    return priceData?.marketCap || 0;
  }, [prices]);

  const getPriceData = useCallback((address) => {
    return prices.get(address);
  }, [prices]);

  // Get all prices as array for iteration
  const getAllPrices = useCallback(() => {
    return Array.from(prices.values());
  }, [prices]);

  // Check if a coin has live price data
  const hasLiveData = useCallback((address) => {
    return prices.has(address);
  }, [prices]);

  // Get price change direction for styling
  const getPriceDirection = useCallback((address) => {
    const priceData = prices.get(address);
    if (!priceData) return 'neutral';
    
    const change = priceData.priceChangeInstant || priceData.priceChange24h || 0;
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'neutral';
  }, [prices]);

  return {
    // Core data
    prices,
    connected,
    lastUpdate,
    
    // Helper functions
    getPrice,
    getPriceChange,
    getVolume,
    getMarketCap,
    getPriceData,
    getAllPrices,
    hasLiveData,
    getPriceDirection,
    
    // Subscription management
    subscribe,
    unsubscribe,
    
    // Status
    isLive: connected,
    priceCount: prices.size
  };
}
