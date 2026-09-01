import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTrackedWallets } from './TrackedWalletsContext';
import { getFullApiUrl } from '../config/api';

const TrackedTradesContext = createContext({ getTradesForMint: () => [] });

export const useTrackedTrades = () => useContext(TrackedTradesContext);

const REFRESH_MS = 3 * 60 * 1000; // matches the backend's wallet-trades cache TTL
const MAX_WALLETS = 20;
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const shortAddress = (address) => `${address.slice(0, 4)}…${address.slice(-4)}`;

/**
 * Fetches recent trades for every tracked wallet once (not once per coin) and
 * indexes them by mint, so any coin card can show what the wallets you follow did.
 */
export const TrackedTradesProvider = ({ children }) => {
  const { trackedWallets } = useTrackedWallets();
  const [tradesByMint, setTradesByMint] = useState(new Map());
  const [tradesLoaded, setTradesLoaded] = useState(false);
  const walletsKey = trackedWallets.map((w) => w.address).sort().join(',');
  const walletsRef = useRef(trackedWallets);
  walletsRef.current = trackedWallets;

  useEffect(() => {
    if (!walletsKey) {
      setTradesByMint(new Map());
      setTradesLoaded(true);
      return undefined;
    }
    let cancelled = false;

    const load = async () => {
      const wallets = walletsRef.current.slice(0, MAX_WALLETS);
      const results = await Promise.all(wallets.map(async (w) => {
        try {
          const res = await fetch(getFullApiUrl(`/api/wallet/${w.address}/trades`));
          if (!res.ok) return [];
          const json = await res.json();
          const trades = json?.data?.trades || json?.trades || [];
          return trades.map((t) => {
            const isBuy = t.from?.address === SOL_MINT;
            const mint = isBuy ? t.to?.address : t.from?.address;
            if (!mint || mint === SOL_MINT) return null;
            const tokenSide = isBuy ? t.to : t.from;
            return {
              mint,
              walletAddress: w.address,
              label: w.label || shortAddress(w.address),
              type: isBuy ? 'buy' : 'sell',
              priceUsd: Number(t.price?.usd) || 0,
              solAmount: Number(t.volume?.sol) || 0,
              usdAmount: Number(t.volume?.usd) || 0,
              symbol: tokenSide?.token?.symbol || 'Unknown',
              image: tokenSide?.token?.image || null,
              time: Number(t.time) || 0, // ms
              signature: t.tx,
            };
          }).filter(Boolean);
        } catch (_) {
          return [];
        }
      }));

      if (cancelled) return;
      const index = new Map();
      for (const trade of results.flat()) {
        if (!index.has(trade.mint)) index.set(trade.mint, []);
        index.get(trade.mint).push(trade);
      }
      for (const list of index.values()) list.sort((a, b) => a.time - b.time);
      setTradesByMint(index);
      setTradesLoaded(true);
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [walletsKey]);

  const getTradesForMint = useCallback(
    (mint) => (mint ? tradesByMint.get(mint) || [] : []),
    [tradesByMint]
  );

  return (
    <TrackedTradesContext.Provider value={{ tradesByMint, tradesLoaded, getTradesForMint }}>
      {children}
    </TrackedTradesContext.Provider>
  );
};
