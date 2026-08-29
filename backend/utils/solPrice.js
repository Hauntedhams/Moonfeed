// Cached SOL/USD price, shared by the affiliate ledger so every trade's SOL
// amounts can also be recorded in USD at the time of the trade.
// Uses the CoinGecko Pro key when available (keyless gets rate-limited on Render),
// with Dexscreener as a free fallback before giving up on the cached value.
let cachedPrice = 150; // sensible fallback until the first fetch resolves
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';
const WSOL = 'So11111111111111111111111111111111111111112';

async function fetchCoinGecko() {
  const url = COINGECKO_API_KEY
    ? 'https://pro-api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    : 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
  const headers = COINGECKO_API_KEY ? { 'x-cg-pro-api-key': COINGECKO_API_KEY } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  return Number(data?.solana?.usd);
}

async function fetchDexscreener() {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${WSOL}`);
  if (!res.ok) throw new Error(`Dexscreener HTTP ${res.status}`);
  const data = await res.json();
  const pair = (data?.pairs || []).find(p => Number(p?.priceUsd) > 0);
  return Number(pair?.priceUsd);
}

async function getSolUsdPrice() {
  if (Date.now() - cachedAt < TTL_MS) return cachedPrice;
  for (const source of [fetchCoinGecko, fetchDexscreener]) {
    try {
      const price = await source();
      if (price > 0) {
        cachedPrice = price;
        cachedAt = Date.now();
        return cachedPrice;
      }
    } catch (err) {
      console.warn(`⚠️ SOL/USD source ${source.name} failed:`, err.message);
    }
  }
  console.warn('⚠️ All SOL/USD sources failed, using cached/fallback:', cachedPrice);
  return cachedPrice;
}

module.exports = { getSolUsdPrice };
