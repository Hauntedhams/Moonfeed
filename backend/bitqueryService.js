/**
 * Bitquery Service - Fetch graduating Pump.fun tokens
 * Uses Bitquery API to get top 100 tokens about to graduate
 */

const fetch = require('node-fetch');

const BITQUERY_API_KEY = 'ory_at_gKoKZA-89yExtEMgVrhX_grcMluvaX8vuJMAFXuMKRY.kePtDroQeYcigC2xnb5wBuSGYxFI9MoJjUkusdgqwnU';
const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';

/**
 * GraphQL query to fetch top 100 graduating Pump.fun tokens
 * Returns tokens sorted by bonding curve progress (closest to graduating first)
 */
const GRADUATING_TOKENS_QUERY = `
query GraduatingTokens {
  Solana {
    DEXPools(
      limitBy: {by: Pool_Market_BaseCurrency_MintAddress, count: 1}
      limit: {count: 100}
      orderBy: {ascending: Pool_Base_PostAmount}
      where: {
        Pool: {
          Base: {PostAmount: {gt: "206900000"}}, 
          Dex: {ProgramAddress: {is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"}}, 
          Market: {
            QuoteCurrency: {
              MintAddress: {in: ["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"]}
            }
          }
        }, 
        Transaction: {Result: {Success: true}}, 
        Block: {Time: {since_relative: {minutes_ago: 5}}}
      }
    ) {
      Bonding_Curve_Progress_precentage: calculate(
        expression: "100 - ((($Pool_Base_Balance - 206900000) * 100) / 793100000)"
      )
      Pool {
        Market {
          BaseCurrency {
            MintAddress
            Name
            Symbol
          }
          MarketAddress
          QuoteCurrency {
            MintAddress
            Name
            Symbol
          }
        }
        Dex {
          ProtocolName
          ProtocolFamily
        }
        Base {
          Balance: PostAmount(maximum: Block_Time)
        }
        Quote {
          PostAmount
          PriceInUSD
          PostAmountInUSD
        }
      }
    }
  }
}
`;

/**
 * Fetch graduating tokens from Bitquery
 * @returns {Promise<Array>} Array of graduating tokens
 */
async function fetchGraduatingTokens() {
  try {
    console.log('🎓 Fetching graduating tokens from Bitquery...');
    
    const response = await fetch(BITQUERY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BITQUERY_API_KEY}`
      },
      body: JSON.stringify({
        query: GRADUATING_TOKENS_QUERY
      })
    });

    if (!response.ok) {
      throw new Error(`Bitquery API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ Bitquery GraphQL errors:', result.errors);
      throw new Error('Bitquery GraphQL query failed');
    }

    const pools = result.data?.Solana?.DEXPools || [];
    console.log(`✅ Fetched ${pools.length} graduating tokens from Bitquery`);

    // Transform Bitquery data to our coin format
    const coins = pools.map(pool => transformBitqueryData(pool));

    // Score and sort coins (best first)
    const scoredCoins = coins.map(coin => ({
      ...coin,
      graduatingScore: calculateGraduatingScore(coin)
    }));

    // Sort by score (highest first)
    scoredCoins.sort((a, b) => b.graduatingScore - a.graduatingScore);

    console.log(`🎯 Top 3 graduating tokens:`, scoredCoins.slice(0, 3).map(c => ({
      symbol: c.symbol,
      progress: c.bondingCurveProgress,
      score: c.graduatingScore
    })));

    return scoredCoins;

  } catch (error) {
    console.error('❌ Error fetching graduating tokens:', error.message);
    throw error;
  }
}

/**
 * Transform Bitquery data to our coin format
 */
function transformBitqueryData(pool) {
  const baseCurrency = pool.Pool.Market.BaseCurrency;
  const quote = pool.Pool.Quote;
  const bondingCurveProgress = parseFloat(pool.Bonding_Curve_Progress_precentage || 0);

  return {
    mintAddress: baseCurrency.MintAddress,
    symbol: baseCurrency.Symbol || 'UNKNOWN',
    name: baseCurrency.Name || baseCurrency.Symbol || 'Unknown Token',
    price: parseFloat(quote.PriceInUSD || 0),
    marketCap: parseFloat(quote.PostAmountInUSD || 0),
    liquidity: parseFloat(quote.PostAmountInUSD || 0),
    volume24h: 0, // Not available in this query
    priceChange24h: 0, // Not available in this query
    bondingCurveProgress: bondingCurveProgress.toFixed(2),
    status: 'graduating',
    isPumpFun: true,
    image: `https://img.fotofolio.xyz/?url=https://cf-ipfs.com/ipfs/${baseCurrency.MintAddress}`,
    
    // Additional metadata
    dexProtocol: pool.Pool.Dex.ProtocolName,
    marketAddress: pool.Pool.Market.MarketAddress,
    baseBalance: parseFloat(pool.Pool.Base.Balance || 0),
    
    // Timestamp
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Calculate graduating score based on multiple factors
 * Higher score = better token (shown first)
 */
function calculateGraduatingScore(coin) {
  let score = 0;

  // 1. Bonding curve progress (40 points max)
  // Higher progress = closer to graduating = higher score
  const progress = parseFloat(coin.bondingCurveProgress || 0);
  score += (progress / 100) * 40;

  // 2. Liquidity/Market Cap (30 points max)
  // Higher liquidity = more stable = higher score
  const liquidity = coin.liquidity || 0;
  if (liquidity > 100000) score += 30;
  else if (liquidity > 50000) score += 25;
  else if (liquidity > 20000) score += 20;
  else if (liquidity > 10000) score += 15;
  else if (liquidity > 5000) score += 10;
  else score += 5;

  // 3. Price (15 points max)
  // Reasonable price range gets higher score
  const price = coin.price || 0;
  if (price > 0.0001 && price < 1) score += 15;
  else if (price > 0.00001 && price < 10) score += 10;
  else score += 5;

  // 4. Recent activity bonus (15 points max)
  // Tokens that just appeared get a freshness bonus
  score += 15;

  return Math.round(score * 100) / 100; // Round to 2 decimals
}

/**
 * Get cached graduating tokens (with auto-refresh)
 */
let cachedGraduatingTokens = [];
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

async function getGraduatingTokens(forceRefresh = false) {
  const now = Date.now();
  
  // Return cache if still fresh
  if (!forceRefresh && cachedGraduatingTokens.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    console.log(`📦 Returning cached graduating tokens (${cachedGraduatingTokens.length} tokens)`);
    return cachedGraduatingTokens;
  }

  // Fetch fresh data
  try {
    const tokens = await fetchGraduatingTokens();
    cachedGraduatingTokens = tokens;
    lastFetchTime = now;
    return tokens;
  } catch (error) {
    // Return stale cache if fetch fails
    if (cachedGraduatingTokens.length > 0) {
      console.warn('⚠️ Using stale cache due to fetch error');
      return cachedGraduatingTokens;
    }
    throw error;
  }
}

module.exports = {
  fetchGraduatingTokens,
  getGraduatingTokens
};
