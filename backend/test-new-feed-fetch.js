require('dotenv').config();
const fetch = require('node-fetch');

const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

async function makeSolanaTrackerRequest(endpoint, params = {}) {
  if (!SOLANA_TRACKER_API_KEY) {
    throw new Error('SOLANA_TRACKER_API_KEY not configured');
  }

  const url = new URL(endpoint, SOLANA_TRACKER_BASE_URL);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  console.log('🔗 Solana Tracker API call:', url.toString().replace(SOLANA_TRACKER_API_KEY, '[HIDDEN]'));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': SOLANA_TRACKER_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Solana Tracker API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`✅ Solana Tracker response: ${data.status}, ${data.data?.length || 0} tokens`);
  
  return data;
}

async function fetchNewCoinBatch() {
  // Calculate timestamps for 1-96 hour age range
  const now = Date.now();
  const minCreatedAt = now - (96 * 60 * 60 * 1000); // 96 hours ago (4 days)
  const maxCreatedAt = now - (1 * 60 * 60 * 1000);  // 1 hour ago (coins need time to settle)
  
  const searchParams = {
    // 5-minute volume - Shows immediate interest
    minVolume_5m: 20000,          // $20k minimum 5-minute volume
    maxVolume_5m: 70000,          // $70k maximum 5-minute volume
    
    // Age - 1 to 96 hours old
    minCreatedAt: minCreatedAt,   // 96 hours ago
    maxCreatedAt: maxCreatedAt,   // 1 hour ago
    
    // Safety filters
    minLiquidity: 10000,          // $10k minimum liquidity
    minMarketCap: 50000,          // $50k minimum market cap
    
    // Sorting
    sortBy: 'createdAt',          // Sort by creation date
    sortOrder: 'desc',            // Newest first
    limit: 100,                   // Get 100 newest coins
    page: 1
  };

  console.log(`🆕 NEW FEED - Fetching recently created coins with 5m volume activity`);
  console.log(`📊 Filters: 5m Vol $20k-$70k | Liq $10k+ | MC $50k+ | Age 1-96h`);
  console.log(`📅 Time range: ${new Date(minCreatedAt).toISOString()} to ${new Date(maxCreatedAt).toISOString()}`);
  console.log(`⏰ Coins must be 1 to 96 hours old`);
  
  const response = await makeSolanaTrackerRequest('/search', searchParams);
  
  if (response.status !== 'success' || !response.data) {
    throw new Error('Invalid response from Solana Tracker');
  }

  const tokens = response.data;
  console.log(`🌙 Got ${tokens.length} tokens in this batch`);

  // Format tokens for frontend
  const formattedTokens = tokens.map((token, index) => ({
    mintAddress: token.mint,
    name: token.name || 'Unknown',
    symbol: token.symbol || 'UNKNOWN',
    image: token.image || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(token.symbol || 'T').charAt(0)}`,
    profileImage: token.image || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(token.symbol || 'T').charAt(0)}`,
    logo: token.image || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(token.symbol || 'T').charAt(0)}`,
    price_usd: token.priceUsd || 0,
    market_cap_usd: token.marketCapUsd || 0,
    volume_24h_usd: token.volume_24h || 0,
    volume_5m_usd: token.volume_5m || 0,
    liquidity: token.liquidity || 0,
    liquidity_usd: token.liquidityUsd || token.liquidity || 0,
    created_timestamp: token.createdAt ? new Date(token.createdAt).getTime() : Date.now(),
    description: token.description || '',
    // Additional fields for compatibility
    buys_24h: token.buys_24h || 0,
    sells_24h: token.sells_24h || 0,
    transactions_24h: (token.buys_24h || 0) + (token.sells_24h || 0),
    priority: index + 1 // Simple priority based on API order
  }));

  console.log(`🔍 Final result: ${formattedTokens.length} coins`);
  console.log(`📝 Sample coin:`, JSON.stringify(formattedTokens[0], null, 2));
  
  return formattedTokens;
}

// Run test
fetchNewCoinBatch()
  .then(coins => {
    console.log(`\n✅ SUCCESS: Fetched ${coins.length} coins for NEW feed`);
  })
  .catch(error => {
    console.error(`\n❌ ERROR:`, error.message);
    console.error(error.stack);
  });
