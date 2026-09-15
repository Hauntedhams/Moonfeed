import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTrackedWallets } from './TrackedWalletsContext';
import { getFullApiUrl } from '../config/api';

const TrackedTradesContext = createContext({ getTradesForMint: () => [] });

export const useTrackedTrades = () => useContext(TrackedTradesContext);

const REFRESH_MS = 3 * 60 * 1000; // matches the backend's wallet-trades cache TTL
const MAX_WALLETS = 60; // matches the backend push-monitor ceiling
const MAX_TRADES_PER_WALLET = 200;
const TRADE_CACHE_PREFIX = 'moonfeed_tracked_trades_v1_';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const shortAddress = (address) => `${address.slice(0, 4)}…${address.slice(-4)}`;

const normalizeTimeMs = (value) => {
  const time = Number(value) || 0;
  return time > 0 && time < 1e12 ? time * 1000 : time;
};

const normalizeTrade = (trade, wallet) => {
  if (!trade) return null;
  if (trade.mint) {
    if (trade.mint === SOL_MINT) return null;
    return {
      mint: trade.mint,
      walletAddress: wallet.address,
      label: wallet.label || shortAddress(wallet.address),
      type: trade.type === 'sell' ? 'sell' : 'buy',
      priceUsd: Number(trade.priceUsd) || 0,
      solAmount: Number(trade.solAmount) || 0,
      usdAmount: Number(trade.usdAmount) || 0,
      symbol: trade.symbol || 'Unknown',
      image: trade.image || null,
      time: normalizeTimeMs(trade.time || trade.timestamp),
      signature: trade.tx || trade.signature,
    };
  }

  const from = trade.from || {};
  const to = trade.to || {};
  const fromIsSol = from.address === SOL_MINT;
  const toIsSol = to.address === SOL_MINT;
  const isBuy = fromIsSol && !toIsSol;
  const tokenSide = isBuy ? to : (toIsSol ? from : (to.token ? to : from));
  const mint = tokenSide?.address;
  if (!mint || mint === SOL_MINT) return null;
  const tokenAmount = Number(tokenSide.amount) || 0;
  const usdAmount = Number(trade.volume?.usd) || 0;
  return {
    mint,
    walletAddress: wallet.address,
    label: wallet.label || shortAddress(wallet.address),
    type: isBuy ? 'buy' : 'sell',
    priceUsd: Number(trade.price?.usd) || (tokenAmount > 0 && usdAmount > 0 ? usdAmount / tokenAmount : 0),
    solAmount: Number(trade.volume?.sol) || 0,
    usdAmount,
    symbol: tokenSide?.token?.symbol || 'Unknown',
    image: tokenSide?.token?.image || null,
    time: normalizeTimeMs(trade.time || trade.timestamp),
    signature: trade.tx || trade.signature,
  };
};

const readWalletTradeCache = (address) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${TRADE_CACHE_PREFIX}${address}`) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const mergeWalletTrades = (cached, fresh) => {
  const merged = new Map();
  [...cached, ...fresh].forEach((trade) => {
    if (!trade?.mint || !trade?.time) return;
    const key = trade.signature || `${trade.mint}:${trade.type}:${trade.time}`;
    merged.set(key, trade);
  });
  return [...merged.values()]
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_TRADES_PER_WALLET);
};

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

    const publish = (results) => {
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

    const initialWallets = walletsRef.current.slice(0, MAX_WALLETS);
    const cachedResults = initialWallets.map((wallet) => readWalletTradeCache(wallet.address));
    if (cachedResults.some((trades) => trades.length > 0)) publish(cachedResults);

    const load = async () => {
      const wallets = walletsRef.current.slice(0, MAX_WALLETS);
      const results = await Promise.all(wallets.map(async (w) => {
        const cached = readWalletTradeCache(w.address);
        try {
          const res = await fetch(getFullApiUrl(`/api/wallet/${w.address}/trades`));
          if (!res.ok) return cached;
          const json = await res.json();
          const trades = json?.data?.trades || json?.trades || [];
          const merged = mergeWalletTrades(cached, trades.map((trade) => normalizeTrade(trade, w)).filter(Boolean));
          try { localStorage.setItem(`${TRADE_CACHE_PREFIX}${w.address}`, JSON.stringify(merged)); } catch (_) { /* non-fatal */ }
          return merged;
        } catch (_) {
          return cached;
        }
      }));

      publish(results);
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
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
