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

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export const useSolanaTransactions = (mintAddress, isActive) => {
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const isActiveRef = useRef(isActive);
  const mintRef = useRef(mintAddress);

  // Keep refs in sync
  isActiveRef.current = isActive;
  mintRef.current = mintAddress;

  const clearTransactions = useCallback(() => {
    setTransactions([]);
    setHistoryLoaded(false);
  }, []);

  const connect = useCallback((mint) => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(BACKEND_WS);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({ type: 'subscribe-txs', token: mint }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'tx-history':
            if (Array.isArray(msg.transactions)) {
              setTransactions(msg.transactions);
              setIsConnected(true);
              setHistoryLoaded(true);
              setError(null);
            }
            break;

          case 'txs-subscribed':
            setIsConnected(true);
            break;

          case 'tx-new':
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
      wsRef.current = null;

      // Reconnect if still active
      if (isActiveRef.current && mintRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          if (isActiveRef.current && mintRef.current) {
            connect(mintRef.current);
          }
        }, RECONNECT_DELAY_MS);
      }
    };
  }, []);

  useEffect(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (!mintAddress || !isActive) {
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.onclose = null; // Prevent reconnect on intentional close
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe-txs', token: mintAddress }));
        }
        ws.close();
      }
      setIsConnected(false);
      setHistoryLoaded(false);
      reconnectAttemptsRef.current = 0;
      return;
    }

    reconnectAttemptsRef.current = 0;
    setHistoryLoaded(false);
    connect(mintAddress);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null; // Prevent reconnect on cleanup
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe-txs', token: mintAddress }));
        }
        ws.close();
      }
    };
  }, [mintAddress, isActive, connect]);

  return { transactions, isConnected, historyLoaded, error, clearTransactions };
};
