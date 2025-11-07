require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression'); // Add compression
const fetch = require('node-fetch');
const http = require('http');
const CoinStorage = require('./coin-storage');
const NewCoinStorage = require('./new-coin-storage');
const priceEngine = require('./services/priceEngine');
const WebSocketServer = require('./services/websocketServer');
const JupiterLivePriceService = require('./jupiterLivePriceService');
const dexscreenerService = require('./dexscreenerService');
const dexpaprikaService = require('./dexpaprikaService');
const heliusService = require('./heliusService');
const rugcheckService = require('./rugcheckService');
const RugcheckAutoProcessor = require('./rugcheckAutoProcessor');
const dexscreenerAutoEnricher = require('./dexscreenerAutoEnricher');
const trendingAutoRefresher = require('./trendingAutoRefresher');
const newFeedAutoRefresher = require('./newFeedAutoRefresher');
const dextrendingAutoRefresher = require('./dextrendingAutoRefresher');
const JupiterTokenService = require('./jupiterTokenService');
const JupiterDataService = require('./jupiterDataService');
const TokenMetadataService = require('./tokenMetadataService');
const walletRoutes = require('./routes/walletRoutes');
const triggerRoutes = require('./routes/trigger');
const searchRoutes = require('./routes/search');
const affiliateRoutes = require('./routes/affiliates');
const onDemandEnrichment = require('./services/OnDemandEnrichmentService');

const app = express();
const PORT = process.env.PORT || 3001;
const coinStorage = new CoinStorage();
const newCoinStorage = new NewCoinStorage();
const CustomCoinStorage = require('./custom-coin-storage');
const customCoinStorage = new CustomCoinStorage();

// Middleware
app.use(compression()); // Enable gzip compression for all responses
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:5175',  // Added for current frontend port
    'http://localhost:3000',
    'https://moonfeed.app',
    'https://www.moonfeed.app',
    'https://api.moonfeed.app',
    'https://moonfeed-frontend1.vercel.app'  // Vercel default domain
  ],
  credentials: true
}));
app.use(express.json());
app.use(compression()); // Enable compression

// Version endpoint to verify deployment
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.0',
    deploymentDate: '2025-10-14T07:30:00Z',
    features: {
      walletTracker: true,
      topTraders: true,
      enrichedCoins: true,
      jupiterLivePrices: true
    },
    commit: '95ed14d',
    timestamp: new Date().toISOString()
  });
});

// Mount wallet routes
app.use('/api/wallet', walletRoutes);

// Mount Jupiter Trigger routes
app.use('/api/trigger', triggerRoutes);

// Mount Jupiter Ultra Search routes
app.use('/api/search', searchRoutes);

// Mount Affiliate routes
app.use('/api/affiliates', affiliateRoutes);

// ⭐ On-demand enrichment endpoint for single coins
app.post('/api/coins/enrich-single', async (req, res) => {
  try {
    const { mintAddress, coin } = req.body;
    
    if (!mintAddress && !coin?.mintAddress) {
      return res.status(400).json({
        success: false,
        error: 'mintAddress or coin object is required'
      });
    }

    const targetAddress = mintAddress || coin.mintAddress;
    console.log(`🎯 Fast enrichment requested for ${targetAddress}`);

    // Find coin in cache or use provided coin object
    let baseCoin = coin;
    if (!baseCoin) {
      baseCoin = currentCoins.find(c => c.mintAddress === targetAddress) ||
                 newCoins.find(c => c.mintAddress === targetAddress) ||
                 customCoins.find(c => c.mintAddress === targetAddress);
      
      if (!baseCoin) {
        return res.status(404).json({
          success: false,
          error: 'Coin not found in cache'
        });
      }
    }

    // Use fast on-demand enrichment service
    const enrichedCoin = await onDemandEnrichment.enrichCoin(baseCoin, {
      skipCache: false, // Use cache if available
      timeout: 8000 // 8 second timeout for fast APIs + 5s rugcheck attempt
    });

    // 🔍 DEBUG: Log specific coin data
    if (targetAddress === 'BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump') {
      console.log('🔍 DEBUG - Backend Enriched Data for BwbZ992s...:', {
        symbol: enrichedCoin.symbol,
        name: enrichedCoin.name,
        mintAddress: enrichedCoin.mintAddress,
        holders_data: {
          holders: enrichedCoin.holders,
          holderCount: enrichedCoin.holderCount,
          holder_count: enrichedCoin.holder_count,
          'dexscreener.holders': enrichedCoin.dexscreener?.holders
        },
        age_data: {
          age: enrichedCoin.age,
          ageHours: enrichedCoin.ageHours,
          created_timestamp: enrichedCoin.created_timestamp,
          createdAt: enrichedCoin.createdAt,
          'dexscreener.pairCreatedAt': enrichedCoin.dexscreener?.pairCreatedAt
        },
        full_enriched_coin: enrichedCoin
      });
    }

    console.log(`✅ Fast enrichment complete for ${enrichedCoin.symbol} in ${enrichedCoin.enrichmentTime}ms`);

    res.json({
      success: true,
      coin: enrichedCoin,
      enrichmentTime: enrichedCoin.enrichmentTime,
      cached: enrichedCoin.enrichmentTime < 100,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in fast enrichment:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to enrich coin',
      details: error.message
    });
  }
});

// Get enrichment statistics
app.get('/api/enrichment/stats', (req, res) => {
  const stats = onDemandEnrichment.getStats();
  res.json({
    success: true,
    stats,
    timestamp: new Date().toISOString()
  });
});

// Solana Tracker API Configuration
const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

// Current serving cache (from latest batch)
let currentCoins = [];
let newCoins = []; // Separate cache for new feed
let customCoins = []; // Cache for custom filtered coins
let dextrendingCoins = []; // Cache for Dexscreener trending coins
let dextrendingLastFetch = 0; // Timestamp of last fetch
const DEXTRENDING_CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

// Top traders cache to prevent duplicate API calls
const topTradersCache = new Map();
const TOP_TRADERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Initialize Rugcheck auto-processor
const rugcheckAutoProcessor = new RugcheckAutoProcessor();

// Initialize Jupiter Token Service
const jupiterTokenService = new JupiterTokenService();

// Initialize Jupiter Live Price Service
const jupiterLivePriceService = new JupiterLivePriceService();

// Make Jupiter Live Price Service globally available for WebSocket integration
global.jupiterLivePriceService = jupiterLivePriceService;

// Initialize Jupiter Data Service for market data
const jupiterDataService = new JupiterDataService();

// Initialize Token Metadata Service for metadata enrichment
const tokenMetadataService = new TokenMetadataService();

// Initialize with latest batch
function initializeWithLatestBatch() {
  const latestBatch = coinStorage.getLatestBatch();
  if (latestBatch.length > 0) {
    currentCoins = latestBatch;
    
    // Make coins available to price engine
    global.coinsCache = currentCoins;
    
    // Update Jupiter Live Price Service with new coin list
    if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
      jupiterLivePriceService.updateCoinList(currentCoins);
    }
    
    console.log(`🚀 Initialized with latest batch: ${latestBatch.length} coins`);
    
    // Try to load saved NEW feed batch first
    const savedNewBatch = newCoinStorage.getCurrentBatch();
    if (savedNewBatch.length > 0) {
      newCoins = savedNewBatch;
      const batchInfo = newCoinStorage.getBatchInfo();
      console.log(`📂 Loaded saved NEW feed: ${savedNewBatch.length} coins (age: ${batchInfo.age} min) - on-demand enrichment only`);
    }
    
    // IMMEDIATE FETCH: Populate NEW feed immediately on startup (NO pre-enrichment)
    console.log('🆕 Fetching NEW feed immediately on startup...');
    fetchNewCoinBatch()
      .then(async freshNewBatch => {
        // NO PRE-ENRICHMENT - use on-demand enrichment only
        newCoins = freshNewBatch;
        newCoinStorage.saveBatch(freshNewBatch); // Save to disk
        console.log(`✅ NEW feed initialized with ${freshNewBatch.length} coins (on-demand enrichment only)`);
        
        // Update Jupiter Live Price Service with combined coin list (TRENDING + NEW)
        if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
          const allCoins = [...currentCoins, ...freshNewBatch];
          jupiterLivePriceService.updateCoinList(allCoins);
          console.log(`🪐 Updated Jupiter service with ${allCoins.length} coins (${currentCoins.length} trending + ${freshNewBatch.length} new)`);
        }
      })
      .catch(error => {
        console.error('❌ Failed to fetch initial NEW feed:', error.message);
      });
    
    // NO PRE-ENRICHMENT for TRENDING - use on-demand enrichment only
    console.log('🎯 TRENDING coins ready (on-demand enrichment only)');
    
    // Start background processors immediately (no enrichment needed)
    console.log('✅ Starting background processors...');
    // DISABLED: No auto-enrichment needed with on-demand approach
    // startDexscreenerAutoEnricher();
    // startRugcheckAutoProcessor();
    startTrendingAutoRefresher();     // Start 24-hour auto-refresh for trending coins
    startNewFeedAutoRefresher();      // Start 30-minute auto-refresh for new coins
    startDextrendingAutoRefresher();  // Start 1-hour auto-refresh for Dexscreener trending coins
    
  } else {
    console.log('📭 No saved batches found, using sample data');
    // Sample data as fallback
    currentCoins = [
      {
        mintAddress: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
        name: "dogwifhat",
        symbol: "WIF",
        image: "https://pump.fun/_next/image?url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmW8GFq&w=256&q=75",
        profileImage: "https://pump.fun/_next/image?url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmW8GFq&w=256&q=75",
        logo: "https://pump.fun/_next/image?url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmW8GFq&w=256&q=75",
        banner: dexscreenerService.generatePlaceholderBanner({ symbol: "WIF" }),
        price_usd: 0.00245,
        market_cap_usd: 2450000,
        volume_24h_usd: 1240000,
        liquidity_usd: 125000,
        description: "dogwifhat - the dog with a hat that everyone loves",
        socialLinks: {},
        socials: {}
      },
      {
        mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        name: "Bonk",
        symbol: "BONK", 
        image: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
        profileImage: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
        logo: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
        banner: dexscreenerService.generatePlaceholderBanner({ symbol: "BONK" }),
        price_usd: 0.0000189,
        market_cap_usd: 1890000,
        volume_24h_usd: 890000,
        liquidity_usd: 95000,
        description: "BONK - the community coin that bonks back",
        socialLinks: {},
        socials: {}
      }
    ];
    
    // Make coins available to price engine
    global.coinsCache = currentCoins;
  }
}

// Helper function to enrich priority coins SYNCHRONOUSLY before serving
async function enrichPriorityCoins(coins, count = 10, feedName = 'coins') {
  if (!coins || coins.length === 0) {
    return coins;
  }
  
  const priorityCount = Math.min(count, coins.length);
  const priorityCoins = coins.slice(0, priorityCount);
  
  console.log(`🎯 Enriching first ${priorityCount} ${feedName} synchronously before serving...`);
  
  try {
    // Step 1: DexScreener enrichment (parallel)
    const dexPromises = priorityCoins.map(async (coin) => {
      try {
        const enriched = await dexscreenerService.enrichCoin(coin, {
          forceBannerEnrichment: true
        });
        enriched.dexscreenerProcessedAt = new Date().toISOString();
        return enriched;
      } catch (error) {
        console.error(`❌ DexScreener enrichment failed for ${coin.symbol}:`, error.message);
        return coin;
      }
    });
    
    const dexEnriched = await Promise.all(dexPromises);
    
    // Step 2: Rugcheck enrichment (parallel, batch of 3 at a time)
    const mintAddresses = dexEnriched.map(coin => 
      coin.mintAddress || coin.tokenAddress || coin.address
    ).filter(Boolean);
    
    const rugcheckResults = await rugcheckService.checkMultipleTokens(mintAddresses, {
      maxConcurrent: 3,
      batchDelay: 1000,
      maxTokens: priorityCount
    });
    
    // Apply rugcheck data
    dexEnriched.forEach(coin => {
      const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
      const rugcheckData = rugcheckResults.find(r => r.address === mintAddress);
      
      if (rugcheckData && rugcheckData.rugcheckAvailable) {
        coin.liquidityLocked = rugcheckData.liquidityLocked;
        coin.lockPercentage = rugcheckData.lockPercentage;
        coin.burnPercentage = rugcheckData.burnPercentage;
        coin.rugcheckScore = rugcheckData.score;
        coin.riskLevel = rugcheckData.riskLevel;
        coin.freezeAuthority = rugcheckData.freezeAuthority;
        coin.mintAuthority = rugcheckData.mintAuthority;
        coin.topHolderPercent = rugcheckData.topHolderPercent;
        coin.isHoneypot = rugcheckData.isHoneypot;
        coin.rugcheckVerified = true;
        coin.rugcheckProcessedAt = new Date().toISOString();
      } else {
        coin.rugcheckVerified = false;
        coin.rugcheckProcessedAt = new Date().toISOString();
      }
    });
    
    // Replace priority coins in original array
    for (let i = 0; i < priorityCount; i++) {
      coins[i] = dexEnriched[i];
    }
    
    const enrichedCount = dexEnriched.filter(c => c.enriched).length;
    const rugcheckCount = dexEnriched.filter(c => c.rugcheckVerified).length;
    console.log(`✅ Priority enrichment complete: ${enrichedCount}/${priorityCount} enriched, ${rugcheckCount}/${priorityCount} rugchecked`);
    
  } catch (error) {
    console.error(`❌ Priority enrichment error:`, error.message);
  }
  
  return coins;
}

// Helper function to apply live Jupiter prices to coins
function applyLivePrices(coins) {
  if (!jupiterLivePriceService || !jupiterLivePriceService.isRunning) {
    return coins;
  }
  
  // Apply latest prices from Jupiter cache
  const updatedCoins = coins.map(coin => {
    const mintAddress = coin.mintAddress || coin.address || coin.tokenAddress;
    const cachedPrice = jupiterLivePriceService.priceCache.get(mintAddress);
    
    if (cachedPrice && cachedPrice.price) {
      return {
        ...coin,
        price_usd: cachedPrice.price,
        jupiterLive: true,
        lastPriceUpdate: cachedPrice.timestamp || Date.now()
      };
    }
    
    return coin;
  });
  
  return updatedCoins;
}

// Make Solana Tracker API request
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

// Fetch ALL coins from Solana Tracker (no limit)
// OPTIMIZED PARAMETERS - Target high-potential meme coins with 10-100x potential
async function fetchFreshCoinBatch() {
  const searchParams = {
    // Liquidity - Relaxed to get more coins
    minLiquidity: 50000,        // $50k minimum (lowered from $100k)
    maxLiquidity: 5000000,      // $5M maximum (increased from $2M)
    
    // Volume - Relaxed to get more coins
    minVolume: 50000,           // $50k minimum (lowered from $150k)
    maxVolume: 20000000,        // $20M maximum (increased from $10M)
    volumeTimeframe: "24h",     // 24 hour timeframe
    
    // Market Cap - Wider range to capture more opportunities
    minMarketCap: 100000,       // $100k minimum (lowered from $500k)
    maxMarketCap: 100000000,    // $100M maximum (increased from $50M)
    
    // 🆕 AGE FILTER - Relaxed for more variety
    minCreatedAt: Date.now() - (60 * 24 * 60 * 60 * 1000),  // 60 days ago (was 30)
    maxCreatedAt: Date.now() - (1 * 24 * 60 * 60 * 1000),   // 1 day ago (was 3 days)
    
    // Sorting - Show highest momentum first
    sortBy: 'volume_24h',       // Sort by 24h volume (momentum indicator)
    sortOrder: 'desc',          // Highest volume first
    
    // Request more results from API
    limit: 200,                 // Get up to 200 coins from API
    page: 1                     // First page
  };

  console.log(`🚨 OPTIMIZED TRENDING FEED - Fetching high-potential coins`);
  console.log(`📊 Filters: Liq $100k-$2M | Vol $150k-$10M | MC $500k-$50M | Age 3-30 days`);
  const response = await makeSolanaTrackerRequest('/search', searchParams);
  
  if (response.status !== 'success' || !response.data) {
    throw new Error('Invalid response from Solana Tracker');
  }

  const tokens = response.data;
  console.log(`🌙 Got ${tokens.length} tokens in this batch`);

  // 🐛 DEBUG: Log first token to see all available fields
  if (tokens.length > 0) {
    console.log('🔍 Sample token from Solana Tracker API:', {
      mint: tokens[0].mint,
      symbol: tokens[0].symbol,
      holders: tokens[0].holders,
      holderCount: tokens[0].holderCount,
      availableFields: Object.keys(tokens[0])
    });
  }

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
    liquidity: token.liquidity || 0,
    liquidity_usd: token.liquidityUsd || token.liquidity || 0,
    created_timestamp: token.createdAt ? new Date(token.createdAt).getTime() : Date.now(),
    holders: token.holders || token.holderCount, // 🆕 Add holder count
    holderCount: token.holderCount || token.holders, // 🆕 Alternative field name
    description: token.description || '',
    // Additional fields for compatibility
    buys_24h: token.buys_24h || 0,
    sells_24h: token.sells_24h || 0,
    transactions_24h: (token.buys_24h || 0) + (token.sells_24h || 0),
    priority: index + 1 // Simple priority based on API order
  }));
  
  // Apply priority scoring like in trending endpoint
  const coinsWithPriority = rugcheckService.sortCoinsByPriority(formattedTokens);

  console.log(`🔍 Final result: ${coinsWithPriority.length} coins after priority sorting`);
  
  return coinsWithPriority;
}

// NEW FEED - Separate API call for recently created coins with 5-minute volume
// Parameters: 1-96 hours age, $20k-$70k 5m volume
async function fetchNewCoinBatch() {
  // Calculate timestamps for 0-96 hour age range
  const now = Date.now();
  const minCreatedAt = now - (96 * 60 * 60 * 1000); // 96 hours ago (4 days)
  const maxCreatedAt = now;                         // Now (include brand new coins)
  
  const searchParams = {
    // Liquidity range - $5k to $200k
    minLiquidity: 5000,           // $5k minimum liquidity
    maxLiquidity: 200000,         // $200k maximum liquidity
    
    // Market cap range - $20k to $1M
    minMarketCap: 20000,          // $20k minimum market cap
    maxMarketCap: 1000000,        // $1M maximum market cap
    
    // 1H volume - $5k to Max
    minVolume_1h: 5000,           // $5k minimum 1-hour volume
    
    // 6H volume - $20k to Max
    minVolume_6h: 20000,          // $20k minimum 6-hour volume
    
    // Age - 0 to 96 hours old
    minCreatedAt: minCreatedAt,   // 96 hours ago
    maxCreatedAt: maxCreatedAt,   // Now
    
    // Sorting
    sortBy: 'createdAt',          // Sort by creation date
    sortOrder: 'desc',            // Newest first
    limit: 100,                   // Get 100 newest coins
    page: 1
  };

  console.log(`🆕 NEW FEED - Fetching recently created coins with updated parameters`);
  console.log(`📊 Filters: Liq $5k-$200k | MC $20k-$1M | 1H Vol $5k+ | 6H Vol $20k+ | Age 0-96h`);
  console.log(`📅 Time range: ${new Date(minCreatedAt).toISOString()} to ${new Date(maxCreatedAt).toISOString()}`);
  console.log(`⏰ Coins must be 0 to 96 hours old`);
  
  const response = await makeSolanaTrackerRequest('/search', searchParams);
  
  if (response.status !== 'success' || !response.data) {
    throw new Error('Invalid response from Solana Tracker');
  }

  const tokens = response.data;
  console.log(`🆕 Got ${tokens.length} NEW tokens (0-96 hours old)`);

  // 🐛 DEBUG: Log first token to see all available fields  
  if (tokens.length > 0) {
    console.log('🔍 Sample NEW token from Solana Tracker API:', {
      mint: tokens[0].mint,
      symbol: tokens[0].symbol,
      holders: tokens[0].holders,
      holderCount: tokens[0].holderCount,
      availableFields: Object.keys(tokens[0])
    });
  }

  // Format tokens for frontend with all available data
  const formattedTokens = tokens.map((token, index) => {
    const createdAt = token.createdAt || Date.now();
    const ageMs = Date.now() - createdAt;
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    
    return {
      mintAddress: token.mint,
      name: token.name || 'Unknown',
      symbol: token.symbol || 'UNKNOWN',
      image: token.image || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(token.symbol || 'T').charAt(0)}`,
      profileImage: token.image || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(token.symbol || 'T').charAt(0)}`,
      logo: token.image || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(token.symbol || 'T').charAt(0)}`,
      price_usd: token.priceUsd || 0,
      market_cap_usd: token.marketCapUsd || 0,
      volume_1h: token.volume_1h || 0,
      volume_5m: token.volume_5m || 0,
      volume_6h: token.volume_6h || 0,
      volume_24h_usd: token.volume_24h || 0,
      liquidity: token.liquidity || 0,
      liquidity_usd: token.liquidityUsd || token.liquidity || 0,
      created_timestamp: createdAt,
      age: ageHours,  // Age in hours - important for NEW feed filtering
      ageHours: ageHours,
      holders: token.holders || token.holderCount, // 🆕 Add holder count
      holderCount: token.holderCount || token.holders, // 🆕 Alternative field name
      description: token.description || '',
      hasSocials: token.hasSocials || false,
      lpBurn: token.lpBurn || 0,
      market: token.market || 'unknown',
      freezeAuthority: token.freezeAuthority,
      mintAuthority: token.mintAuthority,
      deployer: token.deployer,
      status: token.status || 'active',
      buys: token.buys || 0,
      sells: token.sells || 0,
      totalTransactions: token.totalTransactions || 0,
      buys_24h: token.buys || 0,
      sells_24h: token.sells || 0,
      transactions_24h: token.totalTransactions || 0,
      priority: index + 1,
      source: 'new-feed'
    };
  });
  
  // Apply priority scoring
  const coinsWithPriority = rugcheckService.sortCoinsByPriority(formattedTokens);

  console.log(`🔍 NEW feed final result: ${coinsWithPriority.length} coins after priority sorting`);
  
  return coinsWithPriority;
}

// Fetch trending coins from Dexscreener trending/boosted tokens API
// https://api.dexscreener.com/token-boosts/top/v1
async function fetchDexscreenerTrendingBatch() {
  try {
    // Check cache first
    const now = Date.now();
    if (dextrendingCoins.length > 0 && (now - dextrendingLastFetch) < DEXTRENDING_CACHE_TTL) {
      const cacheAge = Math.round((now - dextrendingLastFetch) / 1000 / 60);
      console.log(`📦 Using cached Dexscreener trending data (${cacheAge} min old, ${dextrendingCoins.length} coins)`);
      return dextrendingCoins;
    }
    
    console.log('🔥 Fetching fresh Dexscreener trending coins...');
    
    // Step 1: Get boosted token addresses
    const boostsResponse = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: {
        'User-Agent': 'Moonfeed/1.0'
      }
    });
    
    if (!boostsResponse.ok) {
      throw new Error(`Dexscreener API error: ${boostsResponse.status} ${boostsResponse.statusText}`);
    }
    
    const boostsData = await boostsResponse.json();
    
    // Filter for Solana tokens only
    const solanaBoosts = boostsData.filter(item => item.chainId === 'solana');
    console.log(`🌙 Got ${solanaBoosts.length} Solana boosted tokens (${boostsData.length} total)`);
    
    if (solanaBoosts.length === 0) {
      console.log('⚠️ No Solana tokens found in boosts');
      return [];
    }
    
    // Step 2: Fetch token details from Dexscreener in batches of 30
    const tokenAddresses = solanaBoosts.map(b => b.tokenAddress);
    const allTokenData = [];
    
    // Split into batches of 30 (Dexscreener API limit)
    for (let i = 0; i < tokenAddresses.length; i += 30) {
      const batch = tokenAddresses.slice(i, i + 30);
      const addressString = batch.join(',');
      
      console.log(`📡 Fetching details for batch ${Math.floor(i / 30) + 1} (${batch.length} tokens)...`);
      
      const detailsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addressString}`, {
        headers: {
          'User-Agent': 'Moonfeed/1.0'
        }
      });
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        if (detailsData.pairs) {
          allTokenData.push(...detailsData.pairs);
        }
      }
      
      // Rate limit: wait 300ms between batches
      if (i + 30 < tokenAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`✅ Got details for ${allTokenData.length} token pairs`);
    
    // Step 3: Merge boost data with token details
    const formattedTokens = solanaBoosts.map((boost, index) => {
      // Find matching pair data (prefer highest liquidity pair)
      const matchingPairs = allTokenData.filter(p => 
        p.baseToken?.address?.toLowerCase() === boost.tokenAddress?.toLowerCase()
      );
      
      const pair = matchingPairs.sort((a, b) => 
        (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0)
      )[0] || {};
      
      const baseToken = pair.baseToken || {};
      
      // Parse icon hash to full URL if needed
      let iconUrl = boost.icon;
      if (iconUrl && !iconUrl.startsWith('http')) {
        iconUrl = `https://dd.dexscreener.com/ds-data/tokens/solana/${boost.tokenAddress}.png`;
      }
      
      return {
        mintAddress: boost.tokenAddress,
        name: baseToken.name || 'Unknown',
        symbol: baseToken.symbol || 'UNKNOWN',
        image: iconUrl || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(baseToken.symbol || 'T').charAt(0)}`,
        profileImage: iconUrl || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(baseToken.symbol || 'T').charAt(0)}`,
        logo: iconUrl || `https://via.placeholder.com/64/00d4ff/ffffff?text=${(baseToken.symbol || 'T').charAt(0)}`,
        price_usd: parseFloat(pair.priceUsd) || 0,
        market_cap_usd: parseFloat(pair.marketCap) || 0,
        volume_24h_usd: parseFloat(pair.volume?.h24) || 0,
        liquidity_usd: parseFloat(pair.liquidity?.usd) || 0,
        price_change_24h: parseFloat(pair.priceChange?.h24) || 0,
        change_24h: parseFloat(pair.priceChange?.h24) || 0, // ✅ Frontend expects this field
        change24h: parseFloat(pair.priceChange?.h24) || 0,  // ✅ Alternative field name
        priceChange24h: parseFloat(pair.priceChange?.h24) || 0, // ✅ For consistency
        description: boost.description || '',
        
        // Dexscreener specific fields
        boostAmount: boost.amount || 0,
        totalAmount: boost.totalAmount || 0,
        dexscreenerUrl: boost.url,
        header: boost.header,
        links: boost.links || [],
        
        // Additional pair data
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        pairCreatedAt: pair.pairCreatedAt,
        
        // Position/priority (maintain boost order)
        priority: index + 1,
        source: 'dexscreener-trending'
      };
    });
    
    console.log(`✅ Formatted ${formattedTokens.length} Dexscreener trending tokens`);
    
    // Update cache
    dextrendingCoins = formattedTokens;
    dextrendingLastFetch = now;
    
    // ✅ ADD DEXtrending coins to Jupiter Live Price tracking
    if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
      const allCoins = [...currentCoins, ...newCoins, ...formattedTokens];
      jupiterLivePriceService.updateCoinList(allCoins);
      console.log(`🪐 Updated Jupiter service with ${allCoins.length} total coins (${currentCoins.length} trending + ${newCoins.length} new + ${formattedTokens.length} dextrending)`);
    }
    
    return formattedTokens;
    
  } catch (error) {
    console.error('❌ Error fetching Dexscreener trending:', error.message);
    // Return cached data if available, even if expired
    if (dextrendingCoins.length > 0) {
      console.log(`⚠️ Using stale cache (${dextrendingCoins.length} coins) due to fetch error`);
      return dextrendingCoins;
    }
    return [];
  }
}

// ========================================
// API ROUTES
// ========================================

// TOP TRADERS endpoint - Get top traders for a specific coin
app.get('/api/top-traders/:coinAddress', async (req, res) => {
  try {
    const { coinAddress } = req.params;
    
    if (!coinAddress) {
      return res.status(400).json({
        success: false,
        error: 'Coin address is required'
      });
    }

    // Validate that it looks like a Solana address (base58, typically 32-44 chars)
    if (coinAddress.length < 32 || coinAddress.length > 44) {
      console.warn(`⚠️ Suspicious coin address length: ${coinAddress.length}`);
    }

    // Check cache first
    const cached = topTradersCache.get(coinAddress);
    if (cached && (Date.now() - cached.timestamp) < TOP_TRADERS_CACHE_TTL) {
      console.log(`💾 Returning cached top traders for: ${coinAddress} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return res.json({
        success: true,
        data: cached.data,
        count: cached.data.length,
        cached: true,
        timestamp: new Date(cached.timestamp).toISOString()
      });
    }

    console.log(`🔍 Fetching top traders for: ${coinAddress}`);

    // Call Solana Tracker API for top traders
    // Use the correct /top-traders/{token} endpoint
    const apiUrl = `${SOLANA_TRACKER_BASE_URL}/top-traders/${coinAddress}`;
    console.log(`📡 API URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': SOLANA_TRACKER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Solana Tracker API error: ${response.status} ${response.statusText}`);
      console.error(`❌ Response body: ${errorText}`);
      
      // If we have stale cached data, return it rather than failing
      if (cached) {
        console.log(`⚠️ API error, returning stale cache (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
        return res.json({
          success: true,
          data: cached.data,
          count: cached.data.length,
          cached: true,
          stale: true,
          timestamp: new Date(cached.timestamp).toISOString()
        });
      }
      
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log(`✅ Raw API response:`, JSON.stringify(data).substring(0, 200));
    
    // Handle different response formats
    let traders = data;
    if (data.data) {
      traders = data.data;
    }
    
    const traderCount = Array.isArray(traders) ? traders.length : 0;
    console.log(`✅ Fetched ${traderCount} top traders for ${coinAddress}`);

    // Cache the result
    const tradersArray = Array.isArray(traders) ? traders : [];
    topTradersCache.set(coinAddress, {
      data: tradersArray,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: tradersArray,
      count: traderCount,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching top traders:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top traders',
      details: error.message
    });
  }
});

// NEW FEED endpoint - Returns coins that are 1-96 hours old with $15k-$30k 5m volume
app.get('/api/coins/new', async (req, res) => {
  try {
    console.log('🆕 /api/coins/new endpoint called');
    
    // If no limit specified, return ALL coins (with WebSocket singleton, frontend can handle it)
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 500) : 9999; // No limit by default
    
    // Return cached new coins (automatically refreshed every 30 minutes by auto-refresher)
    if (newCoins.length === 0) {
      console.log('⏳ NEW feed not yet loaded - returning empty array with loading indicator');
      // MOBILE FIX: Return empty array instead of 503 to prevent crashes
      return res.json({
        success: true,
        coins: [],
        count: 0,
        total: 0,
        loading: true,
        timestamp: new Date().toISOString(),
        message: 'NEW feed is loading, please refresh in a moment',
        criteria: {
          age: '0-96 hours',
          liquidity: '$5k-$200k',
          market_cap: '$20k-$1M',
          volume_1h: '$5k+',
          volume_6h: '$20k+'
        }
      });
    }
    
    const limitedCoins = newCoins.slice(0, limit);
    
    // 🆕 AUTO-ENRICH: Enrich top 20 new coins in the background for Age/Holders
    const TOP_COINS_TO_ENRICH = 20; // Increased from 10 for better UX
    if (limitedCoins.length > 0) {
      onDemandEnrichment.enrichCoins(
        limitedCoins.slice(0, TOP_COINS_TO_ENRICH),
        { maxConcurrent: 3, timeout: 2000 }
      ).then(enrichedCoins => {
        enrichedCoins.forEach((enriched, index) => {
          if (enriched.enriched && newCoins[index]) {
            Object.assign(newCoins[index], enriched);
          }
        });
        console.log(`✅ Auto-enriched top ${enrichedCoins.filter(c => c.enriched).length} new coins`);
      }).catch(err => {
        console.warn('⚠️ Background enrichment failed:', err.message);
      });
    }
    
    // Apply live Jupiter prices before returning
    const coinsWithLivePrices = applyLivePrices(limitedCoins);
    
    console.log(`✅ Returning ${coinsWithLivePrices.length}/${newCoins.length} new coins (limit: ${limit === 9999 ? 'ALL' : limit}, auto-refreshed every 30 min)`);
    
    res.json({
      success: true,
      coins: coinsWithLivePrices,
      count: coinsWithLivePrices.length,
      total: newCoins.length,
      timestamp: new Date().toISOString(),
      criteria: {
        age: '0-96 hours',
        liquidity: '$5k-$200k',
        market_cap: '$20k-$1M',
        volume_1h: '$5k+',
        volume_6h: '$20k+'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in /api/coins/new endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new coins',
      details: error.message
    });
  }
});

// DEXTRENDING endpoint - Returns trending coins from Dexscreener
app.get('/api/coins/dextrending', async (req, res) => {
  try {
    console.log('🔥 /api/coins/dextrending endpoint called');
    
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 30;
    
    // Fetch from Dexscreener trending API
    const dextrendingCoins = await fetchDexscreenerTrendingBatch();
    
    if (dextrendingCoins.length === 0) {
      return res.json({
        success: true,
        coins: [],
        count: 0,
        total: 0,
        message: 'No Dexscreener trending coins available',
        timestamp: new Date().toISOString()
      });
    }
    
    // Apply live prices from Jupiter before serving
    const coinsWithPrices = applyLivePrices(dextrendingCoins);
    
    const limitedCoins = coinsWithPrices.slice(0, limit);
    
    // 🚫 NO AUTO-ENRICHMENT for DEXtrending - only enrich on-scroll/on-expand
    // DEXtrending already has good metadata from Dexscreener, enrichment should be user-triggered
    // This reduces unnecessary API calls and improves overall feed performance
    
    console.log(`✅ Returning ${limitedCoins.length}/${dextrendingCoins.length} DEXtrending coins (limit: ${limit}, on-demand enrichment only)`);
    
    res.json({
      success: true,
      coins: limitedCoins,
      count: limitedCoins.length,
      total: dextrendingCoins.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in /api/coins/dextrending endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Dexscreener trending coins',
      details: error.message
    });
  }
});

// TRENDING endpoint - Returns trending coins
app.get('/api/coins/trending', async (req, res) => {
  try {
    console.log('🔥 /api/coins/trending endpoint called');
    
    // If no limit specified, return ALL coins (previously default was 100, max 500)
    // With WebSocket singleton, frontend can handle all coins safely
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 500) : 9999; // No limit by default
    
    // Return current cached coins or fetch fresh
    let trendingCoins = currentCoins;
    if (trendingCoins.length === 0) {
      console.log('⚠️ No cached coins, fetching fresh batch...');
      trendingCoins = await fetchFreshCoinBatch();
      currentCoins = trendingCoins;
      global.coinsCache = trendingCoins;
    }
    
    // Apply live prices from Jupiter before serving
    trendingCoins = applyLivePrices(trendingCoins);
    
    const limitedCoins = trendingCoins.slice(0, limit);
    
    // 🆕 AUTO-ENRICH: Enrich top 20 coins in the background for Age/Holders
    // This ensures holder data, age, and other enriched fields are available
    const TOP_COINS_TO_ENRICH = 20; // Increased from 10 for better UX
    if (limitedCoins.length > 0) {
      // Don't await - enrich in background to not block response
      onDemandEnrichment.enrichCoins(
        limitedCoins.slice(0, TOP_COINS_TO_ENRICH),
        { maxConcurrent: 3, timeout: 2000 }
      ).then(enrichedCoins => {
        // Update the cache with enriched data
        enrichedCoins.forEach((enriched, index) => {
          if (enriched.enriched && currentCoins[index]) {
            Object.assign(currentCoins[index], enriched);
          }
        });
        console.log(`✅ Auto-enriched top ${enrichedCoins.filter(c => c.enriched).length} trending coins`);
      }).catch(err => {
        console.warn('⚠️ Background enrichment failed:', err.message);
      });
    }
    
    // Apply live Jupiter prices before returning
    const coinsWithLivePrices = applyLivePrices(limitedCoins);
    
    console.log(`✅ Returning ${coinsWithLivePrices.length}/${trendingCoins.length} trending coins (limit: ${limit === 9999 ? 'ALL' : limit})`);
    
    res.json({
      success: true,
      coins: coinsWithLivePrices,
      count: coinsWithLivePrices.length,
      total: trendingCoins.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in /api/coins/trending endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending coins',
      details: error.message
    });
  }
});

// CUSTOM FILTER endpoint - Returns coins based on user-defined filters
app.get('/api/coins/custom', async (req, res) => {
  try {
    console.log('🎯 /api/coins/custom endpoint called with filters:', req.query);
    
    // Check if filters are provided
    const hasFilters = Object.keys(req.query).length > 0;
    
    // If no filters provided, return cached custom coins
    if (!hasFilters) {
      console.log('📦 No filters provided, returning cached custom coins');
      
      if (customCoins.length === 0) {
        // Try to load from storage
        const savedCoins = customCoinStorage.getCurrentBatch();
        if (savedCoins.length > 0) {
          customCoins = savedCoins;
          console.log(`📂 Loaded ${savedCoins.length} coins from storage`);
        }
      }
      
      if (customCoins.length === 0) {
        return res.json({
          success: true,
          coins: [],
          count: 0,
          total: 0,
          message: 'No custom filters applied yet',
          timestamp: new Date().toISOString()
        });
      }
      
      // Return cached coins (with any enrichment updates)
      return res.json({
        success: true,
        coins: customCoins,
        count: customCoins.length,
        total: customCoins.length,
        timestamp: new Date().toISOString(),
        cached: true
      });
    }
    
    // Build search params from query parameters
    const searchParams = {};
    
    // Liquidity filters
    if (req.query.minLiquidity) searchParams.minLiquidity = parseFloat(req.query.minLiquidity);
    if (req.query.maxLiquidity) searchParams.maxLiquidity = parseFloat(req.query.maxLiquidity);
    
    // Market cap filters
    if (req.query.minMarketCap) searchParams.minMarketCap = parseFloat(req.query.minMarketCap);
    if (req.query.maxMarketCap) searchParams.maxMarketCap = parseFloat(req.query.maxMarketCap);
    
    // Volume filters
    if (req.query.minVolume) {
      const timeframe = req.query.volumeTimeframe || '24h';
      const volumeKey = `minVolume_${timeframe}`;
      searchParams[volumeKey] = parseFloat(req.query.minVolume);
    }
    if (req.query.maxVolume) {
      const timeframe = req.query.volumeTimeframe || '24h';
      const volumeKey = `maxVolume_${timeframe}`;
      searchParams[volumeKey] = parseFloat(req.query.maxVolume);
    }
    
    // Creation date filters (convert dates to timestamps)
    if (req.query.minCreatedAt) {
      const date = new Date(req.query.minCreatedAt);
      searchParams.minCreatedAt = date.getTime();
    }
    if (req.query.maxCreatedAt) {
      const date = new Date(req.query.maxCreatedAt);
      date.setHours(23, 59, 59, 999); // End of day
      searchParams.maxCreatedAt = date.getTime();
    }
    
    // Trading activity filters
    if (req.query.minBuys) searchParams.minBuys = parseInt(req.query.minBuys);
    if (req.query.minSells) searchParams.minSells = parseInt(req.query.minSells);
    if (req.query.minTotalTransactions) searchParams.minTotalTransactions = parseInt(req.query.minTotalTransactions);
    
    // Default sorting and limit
    searchParams.sortBy = 'volume_24h';
    searchParams.sortOrder = 'desc';
    searchParams.limit = 200;
    searchParams.page = 1;
    
    console.log('📊 Solana Tracker search params:', searchParams);
    
    // Make API call to Solana Tracker
    const response = await makeSolanaTrackerRequest('/search', searchParams);
    
    if (response.status !== 'success' || !response.data) {
      throw new Error('Invalid response from Solana Tracker');
    }

    const tokens = response.data;
    console.log(`🔍 Got ${tokens.length} tokens from custom filters`);

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
      volume_5m: token.volume_5m || 0,
      liquidity: token.liquidity || 0,
      liquidity_usd: token.liquidityUsd || token.liquidity || 0,
      created_timestamp: token.createdAt ? new Date(token.createdAt).getTime() : Date.now(),
      description: token.description || '',
      buys_24h: token.buys_24h || 0,
      sells_24h: token.sells_24h || 0,
      transactions_24h: (token.buys_24h || 0) + (token.sells_24h || 0),
      priority: index + 1,
      source: 'custom-filter'
    }));
    
    // Apply priority scoring
    const coinsWithPriority = rugcheckService.sortCoinsByPriority(formattedTokens);

    // NO PRE-ENRICHMENT - use on-demand enrichment only
    console.log('🎯 Custom filtered coins ready (on-demand enrichment only)');
    
    // Cache the results (NO enrichment)
    customCoins = coinsWithPriority;
    
    // Save to storage with filters
    customCoinStorage.saveBatch(coinsWithPriority, req.query);

    // Apply live Jupiter prices before returning
    const coinsWithLivePrices = applyLivePrices(coinsWithPriority);

    console.log(`✅ Returning ${coinsWithLivePrices.length} custom filtered coins (on-demand enrichment only)`);
    
    res.json({
      success: true,
      coins: coinsWithLivePrices,
      count: coinsWithLivePrices.length,
      total: coinsWithPriority.length,
      timestamp: new Date().toISOString(),
      filters: req.query
    });
    
  } catch (error) {
    console.error('❌ Error in /api/coins/custom endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch custom filtered coins',
      details: error.message
    });
  }
});

// GRADUATING endpoint - Returns Pump.fun tokens about to graduate
// 🆕 NOW USING MORALIS API (replaced BitQuery on Nov 7, 2025)
// Returns tokens with 70-100% bonding curve progress, sorted by graduation score
app.get('/api/coins/graduating', async (req, res) => {
  try {
    console.log('🎓 /api/coins/graduating endpoint called (Moralis API)');
    
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 100;
    
    // Use Moralis service for graduating tokens
    const moralisService = require('./moralisService');
    
    // Fetch graduating tokens from Moralis
    const graduatingTokens = await moralisService.getGraduatingTokens();
    
    if (graduatingTokens.length === 0) {
      console.log('⚠️ No graduating tokens found');
      return res.json({
        success: true,
        coins: [],
        count: 0,
        total: 0,
        message: 'No graduating tokens available',
        timestamp: new Date().toISOString()
      });
    }
    
    const limitedCoins = graduatingTokens.slice(0, limit);
    
    // 🆕 AUTO-ENRICH: Enrich top 20 graduating coins in the background for Age/Holders
    const TOP_COINS_TO_ENRICH = 20;
    if (limitedCoins.length > 0) {
      onDemandEnrichment.enrichCoins(
        limitedCoins.slice(0, TOP_COINS_TO_ENRICH),
        { maxConcurrent: 3, timeout: 2000 }
      ).then(enrichedCoins => {
        enrichedCoins.forEach((enriched, index) => {
          if (enriched.enriched && graduatingTokens[index]) {
            Object.assign(graduatingTokens[index], enriched);
          }
        });
        console.log(`✅ Auto-enriched top ${enrichedCoins.filter(c => c.enriched).length} graduating coins`);
      }).catch(err => {
        console.warn('⚠️ Background enrichment failed:', err.message);
      });
    }
    
    // Apply live Jupiter prices before returning
    const coinsWithLivePrices = applyLivePrices(limitedCoins);
    
    console.log(`✅ Returning ${coinsWithLivePrices.length}/${graduatingTokens.length} graduating tokens (limit: ${limit})`);
    console.log(`📊 Top token: ${coinsWithLivePrices[0]?.symbol} (${coinsWithLivePrices[0]?.bondingCurveProgress}% complete)`);
    
    res.json({
      success: true,
      coins: coinsWithLivePrices,
      count: coinsWithLivePrices.length,
      total: graduatingTokens.length,
      timestamp: new Date().toISOString(),
      criteria: {
        source: 'Moralis Pump.fun',
        status: 'About to graduate (>70% bonding progress)',
        sorting: 'Best to worst (by graduation score)',
        updateFrequency: '2 minutes'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in /api/coins/graduating endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch graduating coins',
      details: error.message
    });
  }
});

// ADMIN endpoint - Manually trigger trending feed refresh
app.post('/api/admin/refresh-trending', async (req, res) => {
  try {
    console.log('🔧 Manual trending refresh requested');
    
    const result = await trendingAutoRefresher.triggerRefresh();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Trending feed refresh triggered successfully',
        status: trendingAutoRefresher.getStatus()
      });
    } else {
      res.status(429).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error triggering trending refresh:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger trending refresh',
      details: error.message
    });
  }
});

// ADMIN endpoint - Manually trigger NEW feed refresh
app.post('/api/admin/refresh-new', async (req, res) => {
  try {
    console.log('🔧 Manual NEW feed refresh requested');
    
    const result = await newFeedAutoRefresher.triggerRefresh();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'NEW feed refresh triggered successfully',
        status: newFeedAutoRefresher.getStatus()
      });
    } else {
      res.status(429).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error triggering NEW feed refresh:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger NEW feed refresh',
      details: error.message
    });
  }
});

// Admin endpoint: Check Dextrending auto-refresher status
app.get('/api/admin/dextrending-refresher-status', (req, res) => {
  try {
    const status = dextrendingAutoRefresher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      isRunning: false
    });
  }
});

// Admin endpoint: Manually trigger Dextrending refresh
app.post('/api/admin/dextrending-refresh-trigger', async (req, res) => {
  try {
    const result = await dextrendingAutoRefresher.triggerRefresh();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 🔍 DEBUG: Jupiter Live Price Service diagnostic endpoint
app.get('/api/debug/jupiter-status', (req, res) => {
  res.json({
    isRunning: jupiterLivePriceService?.isRunning || false,
    subscribers: jupiterLivePriceService?.subscribers?.size || 0,
    coinsTracked: jupiterLivePriceService?.coinList?.length || 0,
    lastUpdate: jupiterLivePriceService?.lastUpdate || null,
    lastFetchAttempt: jupiterLivePriceService?.lastFetchAttempt || null,
    priceCache: jupiterLivePriceService?.priceCache?.size || 0,
    updateFrequency: jupiterLivePriceService?.updateFrequency || 0,
    samplePrices: Array.from(jupiterLivePriceService?.priceCache?.entries() || []).slice(0, 3).map(([addr, data]) => ({
      address: addr.substring(0, 8) + '...',
      symbol: data.symbol,
      price: data.price
    }))
  });
});

// Health check endpoints (both /health and /api/health for Render compatibility)
// CRITICAL: These must respond immediately without any dependencies or slow operations
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Render specifically checks /api/health - keep this minimal for fast response
app.get('/api/health', (req, res) => {
  // Send immediate response - don't access complex objects that might not be ready
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Detailed status endpoint (not used for health checks)
app.get('/api/status', (req, res) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'moonfeed-batch-backend',
      uptime: process.uptime(),
      currentCoins: currentCoins.length,
      storage: batchStorage ? batchStorage.getStorageInfo() : { status: 'not initialized' },
      hasApiKey: !!process.env.DEXSCREENER_API_KEY,
      jupiterLivePrice: {
        isRunning: jupiterLivePriceService.isRunning,
        coinsTracked: jupiterLivePriceService.coinList?.length || 0,
        subscribers: jupiterLivePriceService.subscribers?.size || 0,
        updateFrequency: jupiterLivePriceService.updateFrequency || 5000,
        lastUpdate: jupiterLivePriceService.lastUpdate || null,
        lastSuccessfulFetch: jupiterLivePriceService.lastSuccessfulFetch || null
      },
      priceEngine: priceEngine ? {
        isRunning: priceEngine.isRunning,
        clientCount: priceEngine.activeClients ? priceEngine.activeClients.size : 0,
        coinsCount: priceEngine.coins ? priceEngine.coins.size : 0,
        chartsCount: priceEngine.charts ? priceEngine.charts.size : 0,
        lastUpdate: Date.now()
      } : { status: 'not initialized' },
      initialization: 'complete'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Admin endpoint: Check trending auto-refresher status
app.get('/api/admin/trending-refresher-status', (req, res) => {
  try {
    const status = trendingAutoRefresher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      isRunning: false
    });
  }
});

// Admin endpoint: Check new feed auto-refresher status
app.get('/api/admin/new-refresher-status', (req, res) => {
  try {
    const status = newFeedAutoRefresher.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      isRunning: false
    });
  }
});

// Admin endpoint: Manually trigger trending refresh
app.post('/api/admin/trending-refresh-trigger', async (req, res) => {
  try {
    const result = await trendingAutoRefresher.triggerRefresh();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Admin endpoint: Manually trigger new feed refresh
app.post('/api/admin/new-refresh-trigger', async (req, res) => {
  try {
    const result = await newFeedAutoRefresher.triggerRefresh();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start DexScreener auto-enricher for TRENDING feed
function startDexscreenerAutoEnricher() {
  if (currentCoins.length > 0) {
    console.log('🎨 Starting DexScreener enrichment for TRENDING feed (first 10 prioritized)');
    dexscreenerAutoEnricher.start(() => currentCoins, 'trending');
    
    // Start periodic re-enrichment (every 5 minutes)
    dexscreenerAutoEnricher.startPeriodicReEnrichment();
  }
}

// Start Rugcheck auto-processor for TRENDING feed
function startRugcheckAutoProcessor() {
  if (currentCoins.length > 0) {
    console.log('🔍 Starting Rugcheck for TRENDING feed (first 10 prioritized)');
    rugcheckAutoProcessor.start(() => currentCoins);
  }
}

// Start DexScreener auto-enricher for NEW feed
function startNewFeedDexscreenerEnricher() {
  if (newCoins.length > 0) {
    console.log('🎨 Starting DexScreener enrichment for NEW feed (first 10 prioritized)');
    dexscreenerAutoEnricher.start(() => newCoins, 'new');
  }
}

// Start Rugcheck auto-processor for NEW feed
function startNewFeedRugcheckProcessor() {
  if (newCoins.length > 0) {
    console.log('🔍 Starting Rugcheck for NEW feed (first 10 prioritized)');
    rugcheckAutoProcessor.startNewFeed(() => newCoins);
  }
}

// Start all enrichment for NEW feed
function startNewFeedEnrichment() {
  startNewFeedDexscreenerEnricher();
  startNewFeedRugcheckProcessor();
}

// Start trending auto-refresher (refreshes trending coins every 24 hours)
function startTrendingAutoRefresher() {
  if (currentCoins.length > 0) {
    trendingAutoRefresher.start(
      // Function to fetch fresh TRENDING coins
      fetchFreshCoinBatch,
      // Function to save batch to storage
      (freshBatch) => {
        coinStorage.saveBatch(freshBatch);
      },
      // Callback when refresh completes - update cache (NO enrichment)
      async (freshTrendingBatch) => {
        console.log(`🔄 Updating TRENDING feed cache with ${freshTrendingBatch.length} fresh coins`);
        currentCoins = freshTrendingBatch;
        global.coinsCache = freshTrendingBatch;
        
        // Update Jupiter Live Price Service with new coin list
        if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
          jupiterLivePriceService.updateCoinList(freshTrendingBatch);
        }
        
        console.log('✅ TRENDING feed cache updated (on-demand enrichment only)');
      }
    );
  }
}

// Start new feed auto-refresher (refreshes new coins every 30 minutes)
function startNewFeedAutoRefresher() {
  newFeedAutoRefresher.start(
    // Function to fetch fresh NEW coins
    fetchNewCoinBatch,
    // Callback when refresh completes - update cache (NO enrichment)
    async (freshNewBatch) => {
      console.log(`🔄 Updating NEW feed cache with ${freshNewBatch.length} fresh coins`);
      
      // NO PRE-ENRICHMENT - save directly
      newCoinStorage.saveBatch(freshNewBatch);
      
      // Update cache
      newCoins = freshNewBatch;
      
      // Update Jupiter Live Price Service with combined coin list (TRENDING + NEW)
      if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
        const allCoins = [...currentCoins, ...freshNewBatch];
        jupiterLivePriceService.updateCoinList(allCoins);
        console.log(`🪐 Updated Jupiter service with ${allCoins.length} coins after NEW feed refresh`);
      }
      
      console.log('✅ NEW feed cache updated (on-demand enrichment only)');
    }
  );
}

// Start Dextrending auto-refresher (refreshes Dexscreener trending coins every hour)
function startDextrendingAutoRefresher() {
  dextrendingAutoRefresher.start(
    // Function to fetch fresh DEXTRENDING coins
    fetchDexscreenerTrendingBatch,
    // Callback when refresh completes - update cache AND Jupiter tracking
    async (freshDextrendingBatch) => {
      console.log(`🔄 Updating DEXTRENDING feed cache with ${freshDextrendingBatch.length} fresh coins`);
      
      // Update cache
      dextrendingCoins = freshDextrendingBatch;
      dextrendingLastFetch = Date.now();
      
      // ✅ Update Jupiter Live Price Service with DEXtrending coins
      if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
        const allCoins = [...currentCoins, ...newCoins, ...freshDextrendingBatch];
        jupiterLivePriceService.updateCoinList(allCoins);
        console.log(`🪐 Updated Jupiter service with ${allCoins.length} total coins after DEXTRENDING refresh`);
      }
      
      console.log('✅ DEXTRENDING feed cache updated (on-demand enrichment only)');
    }
  );
}

// ═══════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);
console.log('✅ WebSocket server initialized');

server.listen(PORT, () => {
  console.log('\n🚀 ═══════════════════════════════════════════════════════════════');
  console.log(`🚀 MoonFeed Backend Server running on port ${PORT}`);
  console.log('🚀 ═══════════════════════════════════════════════════════════════\n');
  
  // Initialize feeds and start auto-refreshers
  initializeWithLatestBatch();
  
  // Start Jupiter Live Price Service (5-second intervals for real-time prices)
  console.log('🪐 Starting Jupiter Live Price Service...');
  if (currentCoins.length > 0) {
    jupiterLivePriceService.start(currentCoins);
    console.log(`✅ Jupiter Live Price Service started with ${currentCoins.length} coins`);
  } else {
    // Start with empty list, will be updated when coins are fetched
    jupiterLivePriceService.start([]);
    console.log('⚠️ Jupiter Live Price Service started with empty list (will update when coins are fetched)');
  }
});
