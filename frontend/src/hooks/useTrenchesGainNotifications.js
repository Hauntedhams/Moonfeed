// Background watcher for Trenches feed tokens: fires a notification when a fresh
// coin discovered in the Trenches starts surging fast (+20% in the last hour or +15% in 5m).
import { useEffect, useRef } from 'react';
import { getFullApiUrl } from '../config/api';
import { initTradeNotifications, notifyTrenchesGain } from '../utils/tradeNotifications';
import { addNotification } from '../utils/alertStorage';

const POLL_INTERVAL_MS = 60000;
const TRENCHES_GAIN_H1_PCT = 20;
const TRENCHES_GAIN_M5_PCT = 15;
const TRENCHES_REARM_H1_PCT = 8;
const STATE_KEY = 'moonfeed_trenches_gain_alerts';

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

export default function useTrenchesGainNotifications() {
  const pollTimerRef = useRef(null);

  useEffect(() => {
    initTradeNotifications();

    const poll = async () => {
      try {
        const res = await fetch(getFullApiUrl('/api/coins/trenches?limit=30'));
        if (!res.ok) return;
        const data = await res.json();
        const coins = Array.isArray(data) ? data : (data?.coins || data?.data || []);
        if (!coins.length) return;

        const state = readState();
        let changed = false;

        for (const coin of coins) {
          const mint = coin.mintAddress || coin.mint || coin.address;
          if (!mint) continue;

          // Check 1-hour or 5-minute price changes
          const h1 = Number(coin.priceChange?.h1 ?? coin.h1 ?? coin.price_change_h1);
          const m5 = Number(coin.priceChange?.m5 ?? coin.m5 ?? coin.price_change_m5);

          const isH1 = Number.isFinite(h1) && h1 >= TRENCHES_GAIN_H1_PCT;
          const isM5 = Number.isFinite(m5) && m5 >= TRENCHES_GAIN_M5_PCT;
          const isSurging = isH1 || isM5;
          const isCooled = (!Number.isFinite(h1) || h1 < TRENCHES_REARM_H1_PCT) && (!Number.isFinite(m5) || m5 < 5);

          const entry = state[mint] || { armed: false, lastAlertAt: 0 };

          if (isCooled && entry.armed) {
            entry.armed = false;
            changed = true;
          } else if (isSurging && !entry.armed) {
            entry.armed = true;
            entry.lastAlertAt = Date.now();
            changed = true;

            const pct = isH1 ? h1 : m5;
            const timeLabel = isH1 ? 'in the last hour' : 'in the last 5 mins';
            const symbol = coin.symbol || coin.name || mint.slice(0, 6);
            const image = coin.image || coin.profileImage || coin.logo || null;
            const price = Number(coin.priceUsd || coin.price_usd || coin.price) || 0;

            await notifyTrenchesGain({
              mint,
              symbol,
              gainPct: pct,
              timeLabel,
              image,
            });

            addNotification({
              id: `trenches-gain-${mint}-${Date.now()}`,
              target: 'coins',
              mint,
              coin: { symbol, name: coin.name || symbol, image },
              level: 'gain',
              price,
              message: `${symbol} is up +${Math.round(pct)}% ${timeLabel} from Trenches!`,
            });
          }
        }

        if (changed) {
          writeState(state);
        }
      } catch (err) {
        console.debug('[TrenchesNotifications] poll error:', err?.message);
      }
    };

    // Initial check after 5s then periodic poll
    const initialTimer = setTimeout(poll, 5000);
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);
}
