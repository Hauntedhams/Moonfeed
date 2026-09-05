// Background watcher for coins the user bought normally (spot swaps recorded in
// transactionStorage). Polls Dexscreener and fires a local notification when one
// of those positions starts crashing, regardless of which screen is open.
import { useEffect, useRef } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { getTransactions } from '../utils/transactionStorage';
import { initTradeNotifications, notifyHoldingCrash } from '../utils/tradeNotifications';
import { addNotification } from '../utils/alertStorage';

const POLL_INTERVAL_MS = 45000;
const MAX_MINTS = 30;
// A position counts as "crashing" when either window drops past these.
const CRASH_M5_PCT = -10;
const CRASH_H1_PCT = -15;
// Don't re-alert the same coin more often than this.
const COOLDOWN_MS = 30 * 60 * 1000;

const cooldownKey = (wallet) => `moonfeed_crash_alerts_${wallet}`;

function readCooldowns(wallet) {
  try {
    return JSON.parse(localStorage.getItem(cooldownKey(wallet))) || {};
  } catch (_) {
    return {};
  }
}

function writeCooldowns(wallet, map) {
  try {
    localStorage.setItem(cooldownKey(wallet), JSON.stringify(map));
  } catch (_) { /* quota — non-fatal */ }
}

// Net token balance per mint from locally recorded Moonfeed swaps.
function heldMintsFromTransactions(walletAddress) {
  const txs = getTransactions(walletAddress) || [];
  const byMint = new Map();
  for (const tx of txs) {
    if (!tx?.tokenMint) continue;
    const entry = byMint.get(tx.tokenMint) || { mint: tx.tokenMint, amount: 0, symbol: tx.tokenSymbol };
    const qty = Number(tx.outputAmount) || 0;
    if (!tx.type || tx.type === 'buy') {
      entry.amount += qty;
    } else if (tx.type === 'sell') {
      entry.amount -= Number(tx.inputAmount) || qty;
    }
    if (tx.tokenSymbol) entry.symbol = tx.tokenSymbol;
    byMint.set(tx.tokenMint, entry);
  }
  return Array.from(byMint.values()).filter((e) => e.amount > 0).slice(0, MAX_MINTS);
}

export default function useHoldingsCrashNotifications() {
  const { publicKey, connected } = useWallet();
  const pollRef = useRef(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      clearInterval(pollRef.current);
      return;
    }

    const walletAddress = publicKey.toString();
    initTradeNotifications();

    const poll = async () => {
      try {
        const held = heldMintsFromTransactions(walletAddress);
        if (!held.length) return;

        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${held.map((h) => h.mint).join(',')}`
        );
        if (!res.ok) return;
        const pairs = (await res.json())?.pairs || [];
        if (!pairs.length) return;

        const cooldowns = readCooldowns(walletAddress);
        const now = Date.now();
        let changed = false;

        for (const holding of held) {
          // Deepest-liquidity pair is the most reliable price source.
          const pair = pairs
            .filter((p) => p.baseToken?.address === holding.mint)
            .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          if (!pair) continue;

          const m5 = Number(pair.priceChange?.m5);
          const h1 = Number(pair.priceChange?.h1);
          const crashedM5 = Number.isFinite(m5) && m5 <= CRASH_M5_PCT;
          const crashedH1 = Number.isFinite(h1) && h1 <= CRASH_H1_PCT;
          if (!crashedM5 && !crashedH1) continue;

          if (now - (cooldowns[holding.mint] || 0) < COOLDOWN_MS) continue;
          cooldowns[holding.mint] = now;
          changed = true;

          const symbol = pair.baseToken?.symbol || holding.symbol || holding.mint.slice(0, 6);
          const dropPct = crashedM5 ? m5 : h1;
          const windowLabel = crashedM5 ? 'last 5 minutes' : 'last hour';
          const valueUsd = holding.amount * (parseFloat(pair.priceUsd) || 0);

          await notifyHoldingCrash({ mint: holding.mint, symbol, dropPct, windowLabel, valueUsd, image: pair.info?.imageUrl || null });
          addNotification({
            id: `crash-${holding.mint}-${now}`,
            target: 'coins',
            mint: holding.mint,
            coin: { symbol, name: pair.baseToken?.name || symbol, image: pair.info?.imageUrl || null },
            level: 'crash',
            price: parseFloat(pair.priceUsd) || 0,
            message: `${symbol} is down ${Math.abs(dropPct).toFixed(1)}% in the ${windowLabel}`,
            timestamp: now,
          });
        }

        if (changed) writeCooldowns(walletAddress, cooldowns);
      } catch (_) {
        // silent — best-effort background check
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [connected, publicKey]);
}
