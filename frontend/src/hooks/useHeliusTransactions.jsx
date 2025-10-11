import { useState, useEffect, useRef, useCallback } from 'react';

const HELIUS_API_KEY = '26240c3d-8cce-414e-95f7-5c0c75c1a2cb';
const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const useHeliusTransactions = (mintAddress, isActive) => {
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const subscriptionIdRef = useRef(null);

  const addTransaction = useCallback((tx) => {
    setTransactions(prev => {
      // Keep only the last 50 transactions to prevent memory issues
      const newTxs = [tx, ...prev].slice(0, 50);
      return newTxs;
    });
  }, []);

  const connect = useCallback(() => {
    if (!mintAddress || !isActive) return;

    console.log('🔌 Connecting to Helius WebSocket for:', mintAddress);
    
    try {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(HELIUS_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Helius WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to logs mentioning this coin
        const subscribeRequest = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "logsSubscribe",
          params: [{
            mentions: [mintAddress]
          }, {
            commitment: "confirmed"
          }]
        };

        ws.send(JSON.stringify(subscribeRequest));
        console.log('📡 Subscribed to logs for:', mintAddress);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle subscription confirmation
          if (data.result && typeof data.result === 'number') {
            subscriptionIdRef.current = data.result;
            console.log('✅ Subscription confirmed, ID:', data.result);
            return;
          }

          // Handle log notifications (actual transactions)
          if (data.params?.result?.value) {
            const logData = data.params.result.value;
            const signature = logData.signature;
            const logs = logData.logs || [];
            
            // Parse transaction type from logs
            let txType = 'UNKNOWN';
            let amount = null;
            
            // Try to determine if it's a swap
            if (logs.some(log => log.includes('Instruction: Swap'))) {
              txType = 'SWAP';
            } else if (logs.some(log => log.includes('Transfer'))) {
              txType = 'TRANSFER';
            }

            const transaction = {
              signature,
              timestamp: new Date().toISOString(),
              type: txType,
              logs: logs.slice(0, 5), // Keep first 5 logs for display
              err: logData.err,
              slot: logData.context?.slot
            };

            console.log('⚡ New transaction detected:', signature.substring(0, 8));
            addTransaction(transaction);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setError('Connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        subscriptionIdRef.current = null;
      };

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err.message);
    }
  }, [mintAddress, isActive, addTransaction]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting Helius WebSocket');
    
    if (wsRef.current) {
      // Unsubscribe if we have a subscription ID
      if (subscriptionIdRef.current) {
        try {
          wsRef.current.send(JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "logsUnsubscribe",
            params: [subscriptionIdRef.current]
          }));
        } catch (err) {
          console.error('Error unsubscribing:', err);
        }
      }
      
      wsRef.current.close();
      wsRef.current = null;
      subscriptionIdRef.current = null;
    }
    
    setIsConnected(false);
    setTransactions([]);
  }, []);

  // Effect to manage connection
  useEffect(() => {
    if (isActive && mintAddress) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [isActive, mintAddress, connect, disconnect]);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  return {
    transactions,
    isConnected,
    error,
    clearTransactions
  };
};
