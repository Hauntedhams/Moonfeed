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

// Average per-token buy price for a mint, from the wallet's locally stored trade history.
function avgBuyPrice(tokenMint, transactions) {
  const buys = (transactions || []).filter(
    (tx) => tx.tokenMint === tokenMint && tx.type === 'buy' && Number(tx.pricePerToken) > 0
  );
  if (!buys.length) return null;
  const sum = buys.reduce((acc, tx) => acc + Number(tx.pricePerToken), 0);
  return sum / buys.length;
}

// Computes { percent, usdAmount } for a filled order.
// percent = realized gain vs the wallet's own average buy price (sell orders only,
// requires matching local buy history) — null when it can't be determined.
// usdAmount = the SOL value that changed hands, converted to USD.
export function computeFillStats(order, transactions, solUsdPrice = cachedSolUsd) {
  const triggerPrice = Number(order.triggerPrice) || 0;
  const estimatedValue = Number(order.estimatedValue) || 0;
  const usdAmount = estimatedValue * solUsdPrice;

  let percent = null;
  if (order.type === 'sell' && triggerPrice > 0) {
    const basis = avgBuyPrice(order.tokenMint, transactions);
    // A basis orders of magnitude away from the fill price means the stored trade
    // was recorded with bad decimals — better to show no % than a nonsense one.
    if (basis > 0 && triggerPrice / basis < 100 && triggerPrice / basis > 0.01) {
      percent = ((triggerPrice - basis) / basis) * 100;
    }
  }

  return { percent, usdAmount };
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
