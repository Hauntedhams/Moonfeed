// Background watcher for tracked (favorited) coins: fires a local notification
// when one is up +10% from the price it was tracked at.
import { useEffect, useRef } from 'react';
import { initTradeNotifications, notifyTrackedGain } from '../utils/tradeNotifications';
import { addNotification } from '../utils/alertStorage';

const POLL_INTERVAL_MS = 90000;
const CHUNK = 30;
const GAIN_PCT = 10;
// Re-arm once the coin falls back under this, so a coin hovering at +10%
// can't fire repeatedly.
const REARM_PCT = 5;
const STATE_KEY = 'moonfeed_tracked_gain_alerts';

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (_) { /* quota — non-fatal */ }
}

export default function useTrackedGainNotifications(favorites = []) {
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  useEffect(() => {
    initTradeNotifications();

    const poll = async () => {
      const tracked = (favoritesRef.current || [])
        .map((c) => ({
          mint: c.mintAddress || c.address,
          symbol: c.symbol || c.name,
          trackedAtPrice: Number(c.trackedAtPrice) || 0,
        }))
        .filter((c) => c.mint && c.trackedAtPrice > 0);
      if (!tracked.length) return;

      const prices = new Map();
      for (let i = 0; i < tracked.length; i += CHUNK) {
        try {
          const chunk = tracked.slice(i, i + CHUNK).map((c) => c.mint);
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
          if (!res.ok) continue;
          const data = await res.json();
          for (const pair of data.pairs || []) {
            const mint = pair.baseToken?.address;
            const price = Number(pair.priceUsd);
            if (!mint || !(price > 0)) continue;
            const liq = Number(pair.liquidity?.usd) || 0;
            const prev = prices.get(mint);
            if (!prev || liq > prev.liq) prices.set(mint, { price, liq, symbol: pair.baseToken?.symbol, image: pair.info?.imageUrl });
          }
        } catch (_) { /* keep whatever we have */ }
      }
      if (!prices.size) return;

      const state = readState();
      let changed = false;

      for (const coin of tracked) {
        const live = prices.get(coin.mint);
        if (!live) continue;
        const gainPct = ((live.price - coin.trackedAtPrice) / coin.trackedAtPrice) * 100;
        const entry = state[coin.mint] || { notified: false };

        if (gainPct < REARM_PCT && entry.notified) {
          state[coin.mint] = { notified: false };
          changed = true;
          continue;
        }
        if (gainPct < GAIN_PCT || entry.notified) continue;

        state[coin.mint] = { notified: true, at: Date.now() };
        changed = true;

        const symbol = live.symbol || coin.symbol || coin.mint.slice(0, 6);
        await notifyTrackedGain({
          mint: coin.mint,
          symbol,
          gainPct,
          trackedAtPrice: coin.trackedAtPrice,
          price: live.price,
        });
        addNotification({
          id: `gain-${coin.mint}-${Date.now()}`,
          mint: coin.mint,
          coin: { symbol, name: symbol, image: live.image || null },
          level: 'gain',
          price: live.price,
          message: `${symbol} is up ${gainPct.toFixed(1)}% since you tracked it`,
          timestamp: Date.now(),
        });
      }

      if (changed) writeState(state);
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
