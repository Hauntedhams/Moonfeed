/**
 * Graduating Service - Solana Tracker
 *
 * Fetches the top 100 Pump.fun tokens currently on their bonding curve
 * (about to graduate) using Solana Tracker's /tokens/multi/graduating endpoint.
 * Each pool carries a real `curvePercentage`, so no scraping or RPC scanning.
 * Uses the same SOLANA_TRACKER_API_KEY already used for the Top Traders feed.
 */

const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';
const GRADUATING_ENDPOINT = '/tokens/multi/graduating';

let graduatingCache = {
  data: [],
  timestamp: null,
  ttl: 2 * 60 * 1000 // 2 minutes
};

// Pick the Pump.fun bonding pool (the one carrying curvePercentage).
function pickBondingPool(pools = []) {
  return (
    pools.find(p => typeof p.curvePercentage === 'number' && /pump/i.test(p.market || '')) ||
    pools.find(p => typeof p.curvePercentage === 'number') ||
    pools[0] ||
    {}
  );
}

function transformToken(item) {
  const token = item.token || {};
  const pool = pickBondingPool(item.pools);

  const mint = token.mint || pool.tokenAddress;
  const bondingProgress = typeof pool.curvePercentage === 'number' ? pool.curvePercentage : 0;
  const priceUsd = parseFloat(pool.price?.usd) || 0;
  const priceNative = parseFloat(pool.price?.quote) || 0;
  const liquidity = parseFloat(pool.liquidity?.usd) || 0;
  const marketCap = parseFloat(pool.marketCap?.usd) || 0;

  return {
    // Core token info - include ALL address field variations for compatibility
    mint,
    address: mint,
    mintAddress: mint,
    tokenAddress: mint,
    symbol: token.symbol || 'UNKNOWN',
    name: token.name || token.symbol || 'Unknown Token',
    description: token.description || null,

    // Metadata
    image: token.image || null,
    logo: token.image || null,
    profileImage: token.image || null,
    decimals: parseInt(token.decimals) || 6,

    // Price info
    price: priceUsd,
    priceUsd,
    price_usd: priceUsd,
    priceNative,
    priceSOL: priceNative,

    // Pump.fun bonding-curve status
    isPumpFun: true,
    status: bondingProgress < 100 ? 'graduating' : 'graduated',
    bondingCurveProgress: bondingProgress,
    bondingProgress,

    // Financial metrics
    liquidity,
    liquidityUsd: liquidity,
    liquidity_usd: liquidity,
    marketCap,
    market_cap: marketCap,
    market_cap_usd: marketCap,
    fdv: marketCap,

    // Socials (enrichment can still add more)
    twitter: token.twitter || null,
    website: token.website || null,

    // Mark as NOT enriched so CoinCard triggers on-view enrichment
    enriched: false,

    // Source metadata
    source: 'SolanaTracker Pump.fun',
    apiProvider: 'solanatracker',
    fetchedAt: new Date().toISOString(),

    // Links
    dexscreenerUrl: `https://dexscreener.com/solana/${mint}`,
    birdeyeUrl: `https://birdeye.so/token/${mint}`,
    solscanUrl: `https://solscan.io/token/${mint}`,
    pumpfunUrl: `https://pump.fun/${mint}`
  };
}

async function fetchGraduatingTokens() {
  const apiKey = process.env.SOLANA_TRACKER_API_KEY;
  if (!apiKey) {
    throw new Error('SOLANA_TRACKER_API_KEY not configured');
  }

  console.log('🎓 Fetching graduating tokens from Solana Tracker...');

  const response = await fetch(`${SOLANA_TRACKER_BASE_URL}${GRADUATING_ENDPOINT}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Solana Tracker API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from Solana Tracker API');
  }

  // Keep genuine bonding-curve tokens that have not fully graduated yet.
  const tokens = data
    .map(transformToken)
    .filter(t => t.mint && t.bondingCurveProgress > 0 && t.bondingCurveProgress < 100)
    .sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress);

  console.log(`✅ Fetched ${tokens.length} graduating tokens from Solana Tracker`);
  return tokens;
}

/**
 * Get graduating tokens (cached, sorted by bonding-curve progress descending).
 */
async function getGraduatingTokens() {
  try {
    const now = Date.now();
    if (
      graduatingCache.data.length > 0 &&
      graduatingCache.timestamp &&
      now - graduatingCache.timestamp < graduatingCache.ttl
    ) {
      console.log(`🎓 Returning ${graduatingCache.data.length} graduating tokens from cache`);
      return graduatingCache.data;
    }

    const tokens = await fetchGraduatingTokens();
    graduatingCache = { ...graduatingCache, data: tokens, timestamp: now };

    console.log(
      `📊 Progress buckets — 90-100%: ${tokens.filter(t => t.bondingCurveProgress >= 90).length}, ` +
      `75-90%: ${tokens.filter(t => t.bondingCurveProgress >= 75 && t.bondingCurveProgress < 90).length}, ` +
      `50-75%: ${tokens.filter(t => t.bondingCurveProgress >= 50 && t.bondingCurveProgress < 75).length}`
    );

    return tokens;
  } catch (error) {
    console.error('❌ Error in getGraduatingTokens:', error.message);
    if (graduatingCache.data.length > 0) {
      console.log(`⚠️ Returning stale cache (${graduatingCache.data.length} tokens) due to error`);
      return graduatingCache.data;
    }
    throw error;
  }
}

function clearCache() {
  graduatingCache = { data: [], timestamp: null, ttl: 2 * 60 * 1000 };
}

function getCacheStatus() {
  const now = Date.now();
  const age = graduatingCache.timestamp ? now - graduatingCache.timestamp : null;
  return {
    hasCachedData: graduatingCache.data.length > 0,
    tokenCount: graduatingCache.data.length,
    cacheAgeMinutes: age ? (age / 60000).toFixed(2) : null,
    isValid: age !== null && age < graduatingCache.ttl
  };
}

module.exports = {
  getGraduatingTokens,
  fetchGraduatingTokens,
  clearCache,
  getCacheStatus
};
