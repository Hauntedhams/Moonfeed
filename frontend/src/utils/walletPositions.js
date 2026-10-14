// Per-token PnL for a wallet from one backend call (/api/wallet/:w/positions).
// Shared by the own-profile history grid and the other-wallet feed so both
// show the same realized / theoretical numbers without per-coin fan-out.
import { getFullApiUrl, fetchJsonWithTimeout } from '../config/api';

const TTL_MS = 60 * 1000;
const cache = new Map(); // wallet -> { ts, promise }

/**
 * Resolves { positions: [...], byMint: Map, stats, total, hasMore }.
 * Cached per wallet for 60s (shared across components); `force` bypasses.
 */
export function fetchWalletPositions(wallet, { force = false, limit = 100 } = {}) {
  if (!wallet) return Promise.resolve({ positions: [], byMint: new Map(), stats: null, total: 0, hasMore: false });
  const hit = cache.get(wallet);
  if (!force && hit && Date.now() - hit.ts < TTL_MS) return hit.promise;

  const promise = fetchJsonWithTimeout(getFullApiUrl(`/api/wallet/${wallet}/positions?limit=${limit}`), { timeoutMs: 12000 })
    .then((d) => {
      const positions = Array.isArray(d?.positions) ? d.positions : [];
      const byMint = new Map(positions.map((p) => [p.mint, p]));
      return { positions, byMint, stats: d?.stats || null, total: d?.total ?? positions.length, hasMore: Boolean(d?.hasMore) };
    })
    .catch((err) => {
      cache.delete(wallet);
      throw err;
    });
  cache.set(wallet, { ts: Date.now(), promise });
  return promise;
}

export function invalidateWalletPositions(wallet) {
  if (wallet) cache.delete(wallet); else cache.clear();
}

/** Time-ago in TikTok/IG shorthand: 5m, 3h, 2d, 3w. */
export function shortAgo(ts) {
  if (!ts) return '';
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 9) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

/** Signed USD PnL: +$1.2K, −$45.10, +$0.32. Null for non-finite input. */
export function formatUsdPnl(n) {
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  return `${sign}$${abs.toFixed(2)}`;
}
