// Background watcher for tracked (favorited) coins: fires a local notification
// when one is up +10% or down -10% from the price it was tracked at.
import { useEffect, useRef } from 'react';
import { initTradeNotifications, notifyTrackedGain, notifyTrackedDrop } from '../utils/tradeNotifications';
import { addNotification } from '../utils/alertStorage';

const POLL_INTERVAL_MS = 60000;
const CHUNK = 30;
const GAIN_PCT = 10;
const DROP_PCT = -10;
const GAIN_REARM_PCT = 5;
const DROP_REARM_PCT = -5;
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
        const entry = state[coin.mint] || { gainNotified: false, dropNotified: false };

        // ── GAIN ALERT (+10%) ──
        if (gainPct < GAIN_REARM_PCT && entry.gainNotified) {
          entry.gainNotified = false;
          changed = true;
        } else if (gainPct >= GAIN_PCT && !entry.gainNotified) {
          entry.gainNotified = true;
          entry.gainAt = Date.now();
          changed = true;

          const symbol = live.symbol || coin.symbol || coin.mint.slice(0, 6);
          await notifyTrackedGain({
            mint: coin.mint,
            symbol,
            gainPct,
            trackedAtPrice: coin.trackedAtPrice,
            price: live.price,
            image: live.image || null,
          });
          addNotification({
            id: `gain-${coin.mint}-${Date.now()}`,
            target: 'coins',
            mint: coin.mint,
            coin: { symbol, name: symbol, image: live.image || null },
            level: 'gain',
            price: live.price,
            message: `${symbol} is up ${gainPct.toFixed(1)}% since you tracked it`,
            timestamp: Date.now(),
          });
        }

        // ── DROP ALERT (-10%) ──
        if (gainPct > DROP_REARM_PCT && entry.dropNotified) {
          entry.dropNotified = false;
          changed = true;
        } else if (gainPct <= DROP_PCT && !entry.dropNotified) {
          entry.dropNotified = true;
          entry.dropAt = Date.now();
          changed = true;

          const symbol = live.symbol || coin.symbol || coin.mint.slice(0, 6);
          await notifyTrackedDrop({
            mint: coin.mint,
            symbol,
            dropPct: gainPct,
            trackedAtPrice: coin.trackedAtPrice,
            price: live.price,
            image: live.image || null,
          });
          addNotification({
            id: `drop-${coin.mint}-${Date.now()}`,
            target: 'coins',
            mint: coin.mint,
            coin: { symbol, name: symbol, image: live.image || null },
            level: 'crash',
            price: live.price,
            message: `${symbol} dropped ${Math.abs(gainPct).toFixed(1)}% since you tracked it`,
            timestamp: Date.now(),
          });
        }

        state[coin.mint] = entry;
      }

      if (changed) writeState(state);
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
