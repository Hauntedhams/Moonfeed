// Pure helpers for choosing which pool to chart when the provider has no candles
// for a token's top-liquidity pool (e.g. a PumpSwap pool quoted in an exotic token
// that GeckoTerminal does not price). Kept free of I/O so it can be unit-tested.

const MIN_ALTERNATE_LIQUIDITY_USD = 1000;
const MAX_ALTERNATES = 2;
const MAX_STALE_INTERVALS = 3;
const MIN_STALE_WINDOW_SEC = 30 * 60;

/**
 * Alternate pools worth trying after `primaryPool` returned no candles, best first.
 * Thin pools are skipped: their candles exist but misprice the coin by tens of
 * percent, which is worse than the swap-history fallback the client has.
 */
function rankAlternatePools(pairs, primaryPool) {
  return (pairs || [])
    .filter((p) => p && p.chainId === 'solana' && p.pairAddress && p.pairAddress !== primaryPool)
    .filter((p) => (parseFloat(p.liquidity?.usd) || 0) >= MIN_ALTERNATE_LIQUIDITY_USD)
    .sort((a, b) => (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0))
    .slice(0, MAX_ALTERNATES)
    .map((p) => p.pairAddress);
}

/**
 * Whether an OHLCV list is usable as a live chart: non-empty and its latest
 * candle is recent relative to the bar size (a graduated bonding curve has
 * candles that simply stop hours ago — showing them would be misleading).
 */
function isUsableOhlcv(ohlcvList, intervalSec, nowSec = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(ohlcvList) || ohlcvList.length === 0) return false;
  let latest = 0;
  for (const row of ohlcvList) {
    const t = Number(row?.[0]);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!(latest > 0)) return false;
  const window = Math.max(MIN_STALE_WINDOW_SEC, MAX_STALE_INTERVALS * (Number(intervalSec) || 0));
  return nowSec - latest <= window;
}

/** Seconds per bar for a GeckoTerminal timeframe + aggregate. */
function intervalSeconds(timeframe, aggregate) {
  const base = timeframe === 'day' ? 86400 : timeframe === 'hour' ? 3600 : 60;
  return base * (Math.max(1, parseInt(aggregate, 10) || 1));
}

module.exports = {
  rankAlternatePools,
  isUsableOhlcv,
  intervalSeconds,
  MIN_ALTERNATE_LIQUIDITY_USD,
  MAX_ALTERNATES,
};
