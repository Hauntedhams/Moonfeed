const axios = require('axios');

/**
 * Unified Chart Data Service
 * 
 * Builds chart OHLCV data directly from Solana blockchain via Helius RPC.
 * No GeckoTerminal dependency — works for ANY token with a mint address.
 * 
 * Strategy:
 *   1. Fetch recent swap transactions via Helius enhanced API
 *   2. Extract real prices from token transfers (SOL/token ratio)
 *   3. Bucket into time intervals to build OHLCV candles
 *   4. Cache aggressively (5 min for recent, 30 min for older timeframes)
 *   5. Use live SOL price from Jupiter for accurate USD conversion
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || process.env.HELIUS_KEY || '';
const HELIUS_RPC = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// SOL price cache — refreshed every 60 seconds
let solPriceUsd = 150; // sensible default
let solPriceLastFetch = 0;
const SOL_PRICE_TTL = 60_000; // 60 seconds

// Chart data cache — mintAddress:timeframe → { data, timestamp }
const chartCache = new Map();
const CACHE_TTL = {
  tick: 30_000,    // 30s for tick (very fresh)
  '1m': 60_000,    // 1 min
  '5m': 5 * 60_000, // 5 min
  '15m': 10 * 60_000,
  '1h': 30 * 60_000,
  '4h': 60 * 60_000,
  '1d': 60 * 60_000,
};

// Interval durations in seconds
const INTERVAL_SECONDS = {
  tick: 5,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

// How many transactions to fetch per timeframe (more for longer timeframes)
const TX_FETCH_LIMITS = {
  tick: 80,
  '1m': 100,
  '5m': 150,
  '15m': 150,
  '1h': 150,
  '4h': 150,
  '1d': 150,
};

/**
 * Fetch current SOL price in USD from Jupiter Price API (free, no key needed)
 */
async function fetchSolPrice() {
  if (Date.now() - solPriceLastFetch < SOL_PRICE_TTL) {
    return solPriceUsd;
  }

  try {
    // Try CoinGecko (free, no key needed, reliable)
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { timeout: 5000 }
    );
    const price = parseFloat(response.data?.solana?.usd);
    if (price && price > 0) {
      solPriceUsd = price;
      solPriceLastFetch = Date.now();
      console.log(`[ChartData] SOL price updated: $${price.toFixed(2)}`);
    }
  } catch (e) {
    console.warn('[ChartData] Failed to fetch SOL price, using cached:', solPriceUsd);
  }

  return solPriceUsd;
}

/**
 * Fetch swap transactions for a token via Helius enhanced API.
 * Returns raw price points: { timestamp (seconds), priceUsd, solAmount, tokenAmount }
 */
async function fetchSwapPricePoints(mintAddress, limit = 100) {
  if (!HELIUS_API_KEY) {
    throw new Error('No Helius API key configured');
  }

  const solPrice = await fetchSolPrice();
  const pricePoints = [];
  let beforeSig = undefined;
  const MAX_PAGES = 3;

  for (let page = 0; page < MAX_PAGES && pricePoints.length < limit; page++) {
    const fetchCount = Math.min((limit - pricePoints.length) * 2, 100);

    // Get signatures
    const sigParams = { limit: fetchCount };
    if (beforeSig) sigParams.before = beforeSig;

    const sigResponse = await axios.post(HELIUS_RPC, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [mintAddress, sigParams],
    }, { timeout: 8000 });

    const signatures = sigResponse.data?.result;
    if (!signatures || signatures.length === 0) break;

    beforeSig = signatures[signatures.length - 1].signature;
    const sigList = signatures.map(s => s.signature);

    // Parse via Helius enhanced API
    const parseResponse = await axios.post(
      `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
      { transactions: sigList },
      { timeout: 12000 }
    );

    if (!Array.isArray(parseResponse.data)) break;

    for (const tx of parseResponse.data) {
      const point = extractPriceFromTx(tx, mintAddress, solPrice);
      if (point) {
        pricePoints.push(point);
        if (pricePoints.length >= limit) break;
      }
    }

    if (signatures.length < fetchCount) break;
  }

  // Sort oldest → newest
  pricePoints.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`[ChartData] Extracted ${pricePoints.length} price points for ${mintAddress.substring(0, 8)}`);
  return pricePoints;
}

/**
 * Extract a USD price from a Helius-parsed transaction.
 * Looks for token ↔ SOL transfers to calculate price.
 */
function extractPriceFromTx(tx, mintAddress, solPrice) {
  try {
    // Skip non-swap types
    const SKIP_TYPES = new Set([
      'INITIALIZE_ACCOUNT', 'CREATE_ACCOUNT', 'CLOSE_ACCOUNT',
      'TOKEN_MINT', 'BURN', 'BURN_NFT', 'NFT_SALE', 'NFT_MINT',
      'STAKE', 'UNSTAKE', 'COMPRESSED_NFT_MINT',
    ]);
    if (SKIP_TYPES.has(tx.type)) return null;
    if (tx.transactionError) return null;

    const timestamp = tx.timestamp || Math.floor(Date.now() / 1000);

    let tokenAmount = 0;
    let solAmount = 0;

    // Check token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        if (transfer.mint === mintAddress) {
          const amt = Math.abs(transfer.tokenAmount || 0);
          if (amt > tokenAmount) tokenAmount = amt;
        }
        if (transfer.mint === SOL_MINT) {
          const amt = Math.abs(transfer.tokenAmount || 0);
          if (amt > solAmount) solAmount = amt;
        }
      }
    }

    // Fallback: check native SOL transfers
    if (solAmount === 0 && tx.nativeTransfers) {
      const wallet = tx.feePayer || '';
      for (const nt of tx.nativeTransfers) {
        if (nt.fromUserAccount === wallet || nt.toUserAccount === wallet) {
          const amt = Math.abs(nt.amount || 0) / 1e9;
          if (amt > solAmount && amt < 100000) solAmount = amt; // cap at 100k SOL to filter noise
        }
      }
    }

    // Need both token and SOL amounts to calculate price
    if (tokenAmount <= 0 || solAmount <= 0) return null;

    // Price per token in SOL, then convert to USD
    const priceInSol = solAmount / tokenAmount;
    const priceUsd = priceInSol * solPrice;

    // Sanity check — filter extreme outliers
    if (priceUsd <= 0 || !isFinite(priceUsd)) return null;

    return {
      timestamp,
      priceUsd,
      solAmount,
      tokenAmount,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Bucket price points into OHLCV-style intervals for charting.
 * Returns array of { time, value } sorted ascending.
 */
function bucketPricePoints(pricePoints, intervalSeconds, maxCandles = 100) {
  if (pricePoints.length === 0) return [];

  // Group by interval
  const buckets = new Map(); // intervalStart → [prices]

  for (const point of pricePoints) {
    const bucketStart = Math.floor(point.timestamp / intervalSeconds) * intervalSeconds;
    if (!buckets.has(bucketStart)) {
      buckets.set(bucketStart, []);
    }
    buckets.get(bucketStart).push(point.priceUsd);
  }

  // Convert to chart data (use close price = last price in bucket)
  const chartData = [];
  for (const [time, prices] of buckets) {
    // Use the last price in the bucket as the "close" — most recent trade in that interval
    chartData.push({
      time,
      value: prices[prices.length - 1],
    });
  }

  // Sort ascending
  chartData.sort((a, b) => a.time - b.time);

  // If we have gaps, fill them with the previous price (carry forward)
  if (chartData.length >= 2) {
    const filled = [chartData[0]];
    for (let i = 1; i < chartData.length; i++) {
      const prev = filled[filled.length - 1];
      const curr = chartData[i];
      const gap = curr.time - prev.time;

      // Fill gaps up to 10 intervals wide
      if (gap > intervalSeconds && gap <= intervalSeconds * 10) {
        let fillTime = prev.time + intervalSeconds;
        while (fillTime < curr.time) {
          filled.push({ time: fillTime, value: prev.value });
          fillTime += intervalSeconds;
        }
      }

      filled.push(curr);
    }
    return filled.slice(-maxCandles); // Keep last N candles
  }

  return chartData.slice(-maxCandles);
}

/**
 * Main entry point: Get chart data for a token by mint address.
 * 
 * @param {string} mintAddress - Token mint address
 * @param {string} timeframe - 'tick', '1m', '5m', '15m', '1h', '4h', '1d'
 * @returns {{ data: Array<{time: number, value: number}>, source: string }}
 */
async function getChartData(mintAddress, timeframe = '5m') {
  if (!mintAddress) {
    throw new Error('mintAddress is required');
  }

  const cacheKey = `${mintAddress}:${timeframe}`;
  const ttl = CACHE_TTL[timeframe] || 5 * 60_000;

  // Check cache
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return { data: cached.data, source: 'cache', cacheAge: Date.now() - cached.timestamp };
  }

  const intervalSeconds = INTERVAL_SECONDS[timeframe] || 300;
  const txLimit = TX_FETCH_LIMITS[timeframe] || 100;

  console.log(`[ChartData] Fetching ${timeframe} chart for ${mintAddress.substring(0, 8)}... (${txLimit} tx limit)`);

  // Fetch swap price points from Helius
  const pricePoints = await fetchSwapPricePoints(mintAddress, txLimit);

  if (pricePoints.length === 0) {
    console.log(`[ChartData] No swap data found for ${mintAddress.substring(0, 8)}`);
    return { data: [], source: 'helius-rpc', pricePoints: 0 };
  }

  // Bucket into chart intervals
  const chartData = bucketPricePoints(pricePoints, intervalSeconds, 150);

  console.log(`[ChartData] Built ${chartData.length} candles from ${pricePoints.length} swaps for ${mintAddress.substring(0, 8)}`);

  // Cache the result
  chartCache.set(cacheKey, { data: chartData, timestamp: Date.now() });

  // Evict old cache entries
  if (chartCache.size > 500) {
    const oldest = chartCache.keys().next().value;
    chartCache.delete(oldest);
  }

  return {
    data: chartData,
    source: 'helius-rpc',
    pricePoints: pricePoints.length,
    solPriceUsd: solPriceUsd,
  };
}

/**
 * Get current live price for a token via a single recent swap.
 * Useful for getting the current price without full chart data.
 */
async function getLivePrice(mintAddress) {
  const solPrice = await fetchSolPrice();

  try {
    // Fetch just a few recent transactions
    const sigResponse = await axios.post(HELIUS_RPC, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [mintAddress, { limit: 10 }],
    }, { timeout: 5000 });

    const signatures = sigResponse.data?.result;
    if (!signatures || signatures.length === 0) return null;

    const sigList = signatures.map(s => s.signature);

    const parseResponse = await axios.post(
      `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
      { transactions: sigList },
      { timeout: 8000 }
    );

    if (!Array.isArray(parseResponse.data)) return null;

    // Find the most recent swap with a valid price
    for (const tx of parseResponse.data) {
      const point = extractPriceFromTx(tx, mintAddress, solPrice);
      if (point) {
        return {
          price: point.priceUsd,
          timestamp: point.timestamp,
          source: 'helius-rpc',
        };
      }
    }

    return null;
  } catch (e) {
    console.warn(`[ChartData] getLivePrice failed for ${mintAddress.substring(0, 8)}:`, e.message);
    return null;
  }
}

module.exports = {
  getChartData,
  getLivePrice,
  fetchSolPrice,
};
