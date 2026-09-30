// Soft limit orders — server-monitored buy-at / sell-at / stop-loss alerts.
// No escrow or wallet signing at creation: the backend watches the price and
// pushes a notification that deep-links into a prefilled instant swap. Works
// with every wallet (Jupiter Trigger V2 deposits get broken by the Lighthouse
// instructions Phantom/Solflare inject on mobile).
import { getFullApiUrl } from '../config/api';
import { track } from './analytics';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function createSoftOrder({
  walletAddress,
  mint,
  tokenSymbol = null,
  tokenName = null,
  tokenImage = null,
  side,                 // 'buy' | 'sell'
  triggerPriceUsd,
  currentPriceUsd = null,
  amountSol = null,     // buys: SOL to spend when triggered
  amountTokens = null,  // sells: tokens to sell when triggered
  expiresAt = null,     // ms timestamp
}) {
  const res = await fetch(getFullApiUrl('/api/soft-orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress, mint, tokenSymbol, tokenName, tokenImage,
      side, triggerPriceUsd, currentPriceUsd, amountSol, amountTokens, expiresAt,
    }),
  });
  const data = await parseJson(res);
  track('order_created', { mint, symbol: tokenSymbol, label: side, value: triggerPriceUsd });
  return data.order;
}

// status: 'active' | 'past' (triggered/cancelled/expired)
export async function fetchSoftOrders(walletAddress, status = 'active') {
  const res = await fetch(
    getFullApiUrl(`/api/soft-orders?wallet=${encodeURIComponent(walletAddress)}&status=${status}`)
  );
  const data = await parseJson(res);
  return data.orders || [];
}

export async function cancelSoftOrder(orderId, walletAddress) {
  const res = await fetch(getFullApiUrl(`/api/soft-orders/${orderId}/cancel`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  await parseJson(res);
  return true;
}

// Shared short-lived cache so every mounted coin card doesn't refetch the
// wallet's active orders on each scroll step.
let activeOrdersCache = { key: '', ts: 0, promise: null };

export function fetchActiveSoftOrdersCached(wallets, maxAgeMs = 30000) {
  const key = [...new Set(wallets)].filter(Boolean).sort().join(',');
  if (!key) return Promise.resolve([]);
  if (activeOrdersCache.promise && activeOrdersCache.key === key && Date.now() - activeOrdersCache.ts < maxAgeMs) {
    return activeOrdersCache.promise;
  }
  const promise = Promise.all(
    key.split(',').map((w) => fetchSoftOrders(w, 'active').catch(() => []))
  ).then((lists) => lists.flat());
  activeOrdersCache = { key, ts: Date.now(), promise };
  return promise;
}

export function bustActiveSoftOrdersCache() {
  activeOrdersCache = { key: '', ts: 0, promise: null };
}
