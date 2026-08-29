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
// Hot coins can push 10+ ticks/sec; cap UI re-renders at ~8/sec (leading +
// trailing edge) — visually identical, keeps the big CoinCard render cheap.
const PRICE_THROTTLE_MS = 120;

/**
 * mode:
 *   'full'  — tx history + live tx-new pushes + per-trade price ticks (default)
 *   'ticks' — per-trade price ticks only (log-decoded server-side, near-zero cost);
 *             no history fetch, no tx table. For collapsed mobile feed cards.
 */
export const useSolanaTransactions = (mintAddress, isActive, mode = 'full') => {
  const [transactions, setTransactions] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const isActiveRef = useRef(isActive);
  const mintRef = useRef(mintAddress);
  const modeRef = useRef(mode);

  // Keep refs in sync
  isActiveRef.current = isActive;
  mintRef.current = mintAddress;
  modeRef.current = mode;

  const lastPriceAtRef = useRef(0);
  const pendingPriceRef = useRef(null);
  const priceTimerRef = useRef(null);

  const pushLivePrice = useCallback((p) => {
    if (!(p > 0)) return;
    const now = Date.now();
    const since = now - lastPriceAtRef.current;
    if (since >= PRICE_THROTTLE_MS) {
      lastPriceAtRef.current = now;
      setLivePrice(p);
    } else {
      pendingPriceRef.current = p;
      if (!priceTimerRef.current) {
        priceTimerRef.current = setTimeout(() => {
          priceTimerRef.current = null;
          lastPriceAtRef.current = Date.now();
          if (pendingPriceRef.current > 0) {
            setLivePrice(pendingPriceRef.current);
            pendingPriceRef.current = null;
          }
        }, PRICE_THROTTLE_MS - since);
      }
    }
  }, []);

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
      ws.send(JSON.stringify({ type: 'subscribe', token: mint }));
      ws.send(JSON.stringify({ type: modeRef.current === 'ticks' ? 'subscribe-ticks' : 'subscribe-txs', token: mint }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'price-update': {
            const nextPrice = Number(msg.price);
            if (nextPrice > 0) pushLivePrice(nextPrice);
            break;
          }

          case 'tx-history':
            if (Array.isArray(msg.transactions)) {
              setTransactions(msg.transactions);
              setIsConnected(true);
              setHistoryLoaded(true);
              setError(null);
            }
            break;

          case 'txs-subscribed':
          case 'ticks-subscribed':
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
              // Tick the live price from the most recent priced trade — reflects
              // each buy/sell immediately instead of waiting for the ~1.5s poll.
              for (let i = msg.transactions.length - 1; i >= 0; i--) {
                const p = Number(msg.transactions[i].priceUsd);
                if (p > 0) { pushLivePrice(p); break; }
              }
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
      if (priceTimerRef.current) {
        clearTimeout(priceTimerRef.current);
        priceTimerRef.current = null;
        pendingPriceRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.onclose = null; // Prevent reconnect on intentional close
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe', token: mintAddress }));
          ws.send(JSON.stringify({ type: 'unsubscribe-txs', token: mintAddress }));
          ws.send(JSON.stringify({ type: 'unsubscribe-ticks', token: mintAddress }));
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
      if (priceTimerRef.current) {
        clearTimeout(priceTimerRef.current);
        priceTimerRef.current = null;
        pendingPriceRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null; // Prevent reconnect on cleanup
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe', token: mintAddress }));
          ws.send(JSON.stringify({ type: 'unsubscribe-txs', token: mintAddress }));
          ws.send(JSON.stringify({ type: 'unsubscribe-ticks', token: mintAddress }));
        }
        ws.close();
      }
    };
  }, [mintAddress, isActive, mode, connect]);

  return { transactions, livePrice, isConnected, historyLoaded, error, clearTransactions };
};
