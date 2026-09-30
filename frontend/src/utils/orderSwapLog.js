// Device-local log of swaps that were executed BY an order (auto-executed
// instant-wallet targets, filled Jupiter orders). Drives the History tab's
// "new swap" badge and the executed state on history cards — an auto-executed
// soft order is cancelled server-side afterwards, so the order alone can't tell.

const LOG_KEY = 'moonfeed_order_swaps_v1';
const SEEN_KEY = 'moonfeed_history_seen_ts';
const MAX_ENTRIES = 200;
export const ORDER_SWAPS_CHANGED = 'moonfeed:order-swaps-changed';

const read = () => {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '{}') || {}; } catch (_) { return {}; }
};

const emit = () => window.dispatchEvent(new CustomEvent(ORDER_SWAPS_CHANGED));

export function getOrderSwaps() {
  return read();
}

export function recordOrderSwap(entry) {
  if (!entry?.orderId) return;
  const log = read();
  if (log[entry.orderId]) return;
  log[entry.orderId] = { ts: Date.now(), ...entry };
  const ids = Object.keys(log).sort((a, b) => log[b].ts - log[a].ts);
  for (const id of ids.slice(MAX_ENTRIES)) delete log[id];
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (_) {}
  emit();
}

export function getHistorySeenTs() {
  const v = Number(localStorage.getItem(SEEN_KEY));
  return Number.isFinite(v) ? v : 0;
}

export function markHistorySeen() {
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (_) {}
  emit();
}

export function countUnseenOrderSwaps(wallets = null) {
  const seen = getHistorySeenTs();
  return Object.values(read()).filter((e) =>
    !e.error && e.ts > seen && (!wallets || !e.wallet || wallets.includes(e.wallet))
  ).length;
}

export function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
