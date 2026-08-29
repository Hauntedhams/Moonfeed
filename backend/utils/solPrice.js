// Cached SOL/USD price (CoinGecko), shared by the affiliate ledger so every
// trade's SOL amounts can also be recorded in USD at the time of the trade.
let cachedPrice = 150; // sensible fallback until the first fetch resolves
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

async function getSolUsdPrice() {
  if (Date.now() - cachedAt < TTL_MS) return cachedPrice;
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await res.json();
    const price = Number(data?.solana?.usd);
    if (price > 0) {
      cachedPrice = price;
      cachedAt = Date.now();
    }
  } catch (err) {
    console.warn('⚠️ Failed to fetch SOL/USD price, using cached/fallback:', err.message);
  }
  return cachedPrice;
}

module.exports = { getSolUsdPrice };
