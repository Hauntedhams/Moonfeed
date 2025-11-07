/**
 * Moralis Service - Fetch graduating Pump.fun tokens
 * 
 * Replaces BitQuery service with Moralis API for better reliability
 * and simpler REST API calls
 */

const fetch = require('node-fetch');

const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjJkODdkZDFhLTI3ZmMtNDliNS04YjQ2LTkwNDY4ZjNiNTY0ZSIsIm9yZ0lkIjoiNDc4NzM3IiwidXNlcklkIjoiNDkyNTI4IiwidHlwZUlkIjoiMDUzMzA5NWMtMDM4MS00YTY0LWEzMjItYTMwMzYxOGRmNzU4IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjE4NzQ1MTUsImV4cCI6NDkxNzYzNDUxNX0.Q-loivKb6SB63TTOKtiwCHKub-AIAxftLOc2qUfarmU';
const MORALIS_BONDING_ENDPOINT = 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/bonding';
const MORALIS_GRADUATED_ENDPOINT = 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/graduated';

// Cache configuration
let graduatingCache = {
  data: [],
  timestamp: null,
  ttl: 2 * 60 * 1000 // 2 minutes cache (same as BitQuery)
};

/**
 * Calculate a graduation score for ranking tokens
 * Higher score = closer to graduating & better metrics
 */
function calculateGraduationScore(token) {
  const progress = parseFloat(token.bondingCurveProgress) || 0;
  const liquidity = parseFloat(token.liquidity) || 0;
  const fdv = parseFloat(token.fullyDilutedValuation) || 0;
  
  // Weight bonding progress heavily (90%), with liquidity (5%) and FDV (5%)
  const score = (progress * 0.9) + 
                (Math.min(liquidity / 1000, 50) * 0.05) + 
                (Math.min(fdv / 1000, 50) * 0.05);
  
  return score;
}

/**
 * Transform Moralis token to our app format
 */
function transformToken(moralisToken) {
  const priceUsd = parseFloat(moralisToken.priceUsd) || 0;
  const priceNative = parseFloat(moralisToken.priceNative) || 0;
  const liquidity = parseFloat(moralisToken.liquidity) || 0;
  const fdv = parseFloat(moralisToken.fullyDilutedValuation) || 0;
  const bondingProgress = parseFloat(moralisToken.bondingCurveProgress) || 0;
  
  return {
    // Core token info
    mint: moralisToken.tokenAddress,
    address: moralisToken.tokenAddress,
    symbol: moralisToken.symbol || 'UNKNOWN',
    name: moralisToken.name || moralisToken.symbol || 'Unknown Token',
    
    // Metadata
    image: moralisToken.logo || null,
    logo: moralisToken.logo || null,
    decimals: parseInt(moralisToken.decimals) || 6,
    
    // Price info
    price: priceUsd,
    priceUsd: priceUsd,
    priceNative: priceNative,
    priceSOL: priceNative,
    
    // Pump.fun specific
    isPumpFun: true,
    status: 'graduating',
    bondingCurveProgress: bondingProgress,
    bondingProgress: bondingProgress, // Alias for compatibility
    
    // Financial metrics
    liquidity: liquidity,
    liquidityUsd: liquidity,
    fdv: fdv,
    fullyDilutedValuation: fdv,
    marketCap: fdv, // For compatibility
    
    // Graduation score
    graduationScore: calculateGraduationScore(moralisToken),
    
    // Source metadata
    source: 'Moralis Pump.fun',
    apiProvider: 'moralis',
    
    // Timestamps
    fetchedAt: new Date().toISOString(),
    
    // Links
    dexscreenerUrl: `https://dexscreener.com/solana/${moralisToken.tokenAddress}`,
    birdeyeUrl: `https://birdeye.so/token/${moralisToken.tokenAddress}`,
    solscanUrl: `https://solscan.io/token/${moralisToken.tokenAddress}`,
    pumpfunUrl: `https://pump.fun/${moralisToken.tokenAddress}`
  };
}

/**
 * Fetch bonding tokens from Moralis API
 * @param {number} limit - Maximum number of tokens to fetch (default: 100)
 * @param {number} minProgress - Minimum bonding progress % (default: 70)
 */
async function fetchBondingTokens(limit = 100, minProgress = 70) {
  try {
    console.log(`🔍 Fetching bonding tokens from Moralis (limit: ${limit}, min progress: ${minProgress}%)...`);
    
    const response = await fetch(`${MORALIS_BONDING_ENDPOINT}?limit=${limit}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.result || !Array.isArray(data.result)) {
      throw new Error('Invalid response format from Moralis API');
    }

    console.log(`✅ Fetched ${data.result.length} bonding tokens from Moralis`);
    
    // Filter tokens above minimum progress threshold
    const filtered = data.result.filter(token => 
      (parseFloat(token.bondingCurveProgress) || 0) >= minProgress
    );
    
    console.log(`📊 ${filtered.length} tokens have >=${minProgress}% bonding progress`);
    
    // Transform and sort by graduation score
    const transformed = filtered.map(transformToken);
    transformed.sort((a, b) => b.graduationScore - a.graduationScore);
    
    return transformed;
    
  } catch (error) {
    console.error('❌ Error fetching from Moralis API:', error.message);
    throw error;
  }
}

/**
 * Get graduating tokens (cached)
 * Returns tokens sorted by graduation score (best to worst)
 */
async function getGraduatingTokens() {
  try {
    // Check cache
    const now = Date.now();
    if (graduatingCache.data.length > 0 && 
        graduatingCache.timestamp && 
        (now - graduatingCache.timestamp) < graduatingCache.ttl) {
      console.log(`🎓 Returning ${graduatingCache.data.length} graduating tokens from cache`);
      return graduatingCache.data;
    }

    console.log('🎓 Cache expired or empty, fetching fresh graduating tokens...');
    
    // Fetch tokens with >70% progress (good balance of quantity and relevance)
    const tokens = await fetchBondingTokens(100, 70);
    
    // Update cache
    graduatingCache.data = tokens;
    graduatingCache.timestamp = now;
    
    console.log(`✅ Cached ${tokens.length} graduating tokens`);
    console.log(`📊 Progress distribution: 90-100%: ${tokens.filter(t => t.bondingCurveProgress >= 90).length}, 80-90%: ${tokens.filter(t => t.bondingCurveProgress >= 80 && t.bondingCurveProgress < 90).length}, 70-80%: ${tokens.filter(t => t.bondingCurveProgress >= 70 && t.bondingCurveProgress < 80).length}`);
    
    return tokens;
    
  } catch (error) {
    console.error('❌ Error in getGraduatingTokens:', error.message);
    
    // Return cached data if available, even if expired
    if (graduatingCache.data.length > 0) {
      console.log(`⚠️ Returning stale cache (${graduatingCache.data.length} tokens) due to error`);
      return graduatingCache.data;
    }
    
    throw error;
  }
}

/**
 * Clear the graduating tokens cache (useful for testing)
 */
function clearCache() {
  console.log('🗑️ Clearing Moralis graduating tokens cache');
  graduatingCache = {
    data: [],
    timestamp: null,
    ttl: 2 * 60 * 1000
  };
}

/**
 * Get cache status for debugging
 */
function getCacheStatus() {
  const now = Date.now();
  const age = graduatingCache.timestamp ? now - graduatingCache.timestamp : null;
  const isValid = age !== null && age < graduatingCache.ttl;
  
  return {
    hasCachedData: graduatingCache.data.length > 0,
    tokenCount: graduatingCache.data.length,
    cacheAge: age,
    cacheAgeMinutes: age ? (age / 60000).toFixed(2) : null,
    isValid: isValid,
    ttlMinutes: (graduatingCache.ttl / 60000).toFixed(2)
  };
}

module.exports = {
  getGraduatingTokens,
  fetchBondingTokens,
  clearCache,
  getCacheStatus
};
