import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSolanaTransactions — Simple hook for token transaction history.
 *
 * Strategy:
 *   1. On activate → fetch recent transactions via REST (fast, reliable).
 *   2. Optionally poll every 10s for new transactions.
 *   3. That's it. No extra WebSocket — keeps things simple.
 *
 * The REST endpoint hits the backend's solanaTransactionService which
 * caches results for 15s, so rapid re-fetches are cheap.
 */

const BACKEND_API = import.meta.env.PROD
  ? 'https://api.moonfeed.app'
  : 'http://localhost:3001';

export const useSolanaTransactions = (mintAddress, isActive) => {
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
  }, []);

  // Single fetch function — used on mount and for polling
  const fetchTransactions = useCallback(async (mint, isInitial = false) => {
    try {
      const res = await fetch(`${BACKEND_API}/api/transactions/${mint}?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.transactions)) {
        setTransactions(prev => {
          // On initial load, just set. On poll, merge new ones in front.
          if (isInitial || prev.length === 0) return data.transactions;

          // Merge: prepend any new txs (by signature) we don't already have
          const existingSigs = new Set(prev.map(t => t.signature));
          const newTxs = data.transactions.filter(t => !existingSigs.has(t.signature));
          if (newTxs.length === 0) return prev; // no change
          return [...newTxs, ...prev].slice(0, 50);
        });
        setIsConnected(true);
        setError(null);
      }
    } catch (err) {
      console.warn('[useSolanaTx] Fetch failed:', err.message);
      // Only set error on initial load, not polling hiccups
      if (isInitial) setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!mintAddress || !isActive) {
      setIsConnected(false);
      clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    // 1. Fetch immediately
    fetchTransactions(mintAddress, true);

    // 2. Poll every 5s for new transactions (faster for live feel)
    pollRef.current = setInterval(() => {
      fetchTransactions(mintAddress, false);
    }, 5000);

    return () => {
      clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [mintAddress, isActive, fetchTransactions, clearTransactions]);

  return { transactions, isConnected, error, clearTransactions };
};
