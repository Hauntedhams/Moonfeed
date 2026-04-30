import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSolanaTransactions — Live transaction stream via backend WebSocket.
 *
 * Strategy:
 *   1. Connect to backend /ws/price WebSocket.
 *   2. Send `subscribe-txs` → backend replies with `tx-history` (recent swaps)
 *      and registers the client on a shared Helius logsSubscribe stream.
 *   3. Backend pushes `tx-new` whenever new confirmed swaps arrive (~200ms latency).
 *   4. On deactivate → send `unsubscribe-txs` and close the WS.
 *
 * Cost: ONE persistent Helius WS per unique token on the backend (shared across
 * all clients watching the same token). No polling.
 */

const BACKEND_WS = import.meta.env.PROD
  ? 'wss://api.moonfeed.app/ws/price'
  : 'ws://localhost:3001/ws/price';

export const useSolanaTransactions = (mintAddress, isActive) => {
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  useEffect(() => {
    if (!mintAddress || !isActive) {
      // Deactivate: send unsubscribe and close
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe-txs', token: mintAddress }));
        }
        ws.close();
      }
      setIsConnected(false);
      return;
    }

    const ws = new WebSocket(BACKEND_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe-txs', token: mintAddress }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'tx-history':
            // Initial batch of recent swaps
            if (Array.isArray(msg.transactions)) {
              setTransactions(msg.transactions);
              setIsConnected(true);
              setError(null);
            }
            break;

          case 'txs-subscribed':
            // Confirmed live subscription (no history yet = token is very new)
            setIsConnected(true);
            break;

          case 'tx-new':
            // Live swaps pushed from Helius logsSubscribe
            if (Array.isArray(msg.transactions) && msg.transactions.length > 0) {
              setTransactions(prev => {
                const existingSigs = new Set(prev.map(t => t.signature));
                const newTxs = msg.transactions.filter(t => !existingSigs.has(t.signature));
                if (!newTxs.length) return prev;
                return [...newTxs, ...prev].slice(0, 50);
              });
            }
            break;

          case 'error':
            setError(msg.message);
            break;

          default:
            break;
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      setError('Connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      wsRef.current = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe-txs', token: mintAddress }));
      }
      ws.close();
    };
  }, [mintAddress, isActive]);

  return { transactions, isConnected, error, clearTransactions };
};
