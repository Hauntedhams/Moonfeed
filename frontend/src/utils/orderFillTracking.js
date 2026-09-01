// Computes realized profit stats for filled limit orders and dedupes push
// notifications so each fill is only ever announced once per device.
import { notifyOrderFilled } from './tradeNotifications';

let cachedSolUsd = 150; // sensible default until the first fetch resolves
let cachedAt = 0;
const SOL_PRICE_TTL = 5 * 60 * 1000;

// Cached SOL/USD price (CoinGecko), used to convert an order's SOL value to USD.
export async function getSolUsdPrice() {
  if (Date.now() - cachedAt < SOL_PRICE_TTL) return cachedSolUsd;
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await res.json();
    const price = Number(data?.solana?.usd);
    if (price > 0) {
      cachedSolUsd = price;
      cachedAt = Date.now();
    }
  } catch (_) {
    // keep last cached/default value
  }
  return cachedSolUsd;
}

// Realized round-trip stats for a mint from the wallet's actual transactions.
// costSol = total SOL spent buying; proceedsSol = total SOL received selling
// (falls back to the order's fill value for executed orders whose fill isn't in
// the wallet's swap list — Jupiter fills settle from escrow, not the wallet).
export function computeFillStats(order, transactions, solUsdPrice = cachedSolUsd) {
  const executed = order.status === 'executed' || order.status === 'completed';
  const txs = (transactions || []).filter((tx) => tx.tokenMint === order.tokenMint);

  const costSol = txs
    .filter((tx) => tx.type === 'buy' && Number(tx.inputAmount) > 0)
    .reduce((sum, tx) => sum + Number(tx.inputAmount), 0);

  let proceedsSol = txs
    .filter((tx) => tx.type === 'sell' && Number(tx.outputAmount) > 0)
    .reduce((sum, tx) => sum + Number(tx.outputAmount), 0);
  if (executed && proceedsSol <= 0) proceedsSol = Number(order.estimatedValue) || 0;

  let percent = null;
  if (costSol > 0 && proceedsSol > 0) {
    percent = ((proceedsSol - costSol) / costSol) * 100;
  }

  return {
    percent,
    usdAmount: proceedsSol * solUsdPrice,
    costUsd: costSol * solUsdPrice,
    proceedsSol,
    costSol,
  };
}

const NOTIFIED_KEY_PREFIX = 'moonfeed_notified_fills_';

function getNotifiedSet(walletAddress) {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY_PREFIX + walletAddress);
    return raw ? new Set(JSON.parse(raw)) : null; // null = never seeded for this wallet
  } catch (_) {
    return null;
  }
}

function saveNotifiedSet(walletAddress, set) {
  try {
    localStorage.setItem(NOTIFIED_KEY_PREFIX + walletAddress, JSON.stringify([...set]));
  } catch (_) {
    // ignore storage quota errors
  }
}

// Detects newly-filled orders (executed/completed) not yet notified and fires a
// local push notification for each, with realized % and USD amount when known.
// The first time it runs for a wallet it seeds the "seen" set without notifying,
// so pre-existing fill history doesn't trigger a notification storm.
export async function checkAndNotifyFilledOrders(walletAddress, orders, transactions) {
  if (!walletAddress || !orders?.length) return;

  const filled = orders.filter((o) => o.status === 'executed' || o.status === 'completed');
  if (!filled.length) return;

  let notified = getNotifiedSet(walletAddress);
  if (notified === null) {
    // First run for this wallet — mark everything currently filled as already-seen.
    notified = new Set(filled.map((o) => o.orderId || o.id).filter(Boolean));
    saveNotifiedSet(walletAddress, notified);
    return;
  }

  const solUsdPrice = await getSolUsdPrice();
  let changed = false;

  for (const order of filled) {
    const orderId = order.orderId || order.id;
    if (!orderId || notified.has(orderId)) continue;

    const stats = computeFillStats(order, transactions, solUsdPrice);
    notifyOrderFilled(order, stats);
    notified.add(orderId);
    changed = true;
  }

  if (changed) saveNotifiedSet(walletAddress, notified);
}
