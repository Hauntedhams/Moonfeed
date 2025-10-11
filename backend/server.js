require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
const JupiterTokenService = require('./jupiterTokenService');
const JupiterDataService = require('./jupiterDataService');
const TokenMetadataService = require('./tokenMetadataService');

const app = express();
const PORT = process.env.PORT || 3001;
const coinStorage = new CoinStorage();
const newCoinStorage = new NewCoinStorage();
const CustomCoinStorage = require('./custom-coin-storage');
const customCoinStorage = new CustomCoinStorage();

// Middleware
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
app.use(express.json());

// Solana Tracker API Configuration
const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

// Current serving cache (from latest batch)
let currentCoins = [];
let newCoins = []; // Separate cache for new feed
let customCoins = []; // Cache for custom filtered coins

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
      console.log(`📂 Loaded saved NEW feed: ${savedNewBatch.length} coins (age: ${batchInfo.age} min)`);
      // Start enrichment for loaded coins
      startNewFeedEnrichment();
    }
    
    // IMMEDIATE FETCH: Populate NEW feed immediately on startup (or refresh if old)
    console.log('🆕 Fetching NEW feed immediately on startup...');
    fetchNewCoinBatch()
      .then(async freshNewBatch => {
        // Enrich first 10 coins BEFORE making them available
        await enrichPriorityCoins(freshNewBatch, 10, 'NEW feed coins');
        
        newCoins = freshNewBatch;
        newCoinStorage.saveBatch(freshNewBatch); // Save to disk
        console.log(`✅ NEW feed initialized with ${freshNewBatch.length} coins (first 10 fully enriched)`);
        // Start enrichment for remaining coins
        startNewFeedEnrichment();
      })
      .catch(error => {
        console.error('❌ Failed to fetch initial NEW feed:', error.message);
      });
    
    // Enrich first 10 trending coins BEFORE starting background enrichment
    console.log('🎯 Enriching first 10 TRENDING coins synchronously...');
    enrichPriorityCoins(currentCoins, 10, 'TRENDING feed coins')
      .then(() => {
        console.log('✅ Priority TRENDING coins enriched');
        // Start auto-processors for the loaded batch
        startDexscreenerAutoEnricher();  // Start DexScreener enrichment first
        startRugcheckAutoProcessor();     // Then start Rugcheck verification
        startTrendingAutoRefresher();     // Start 24-hour auto-refresh for trending coins
        startNewFeedAutoRefresher();      // Start 30-minute auto-refresh for new coins
      })
      .catch(error => {
        console.error('❌ Priority enrichment failed:', error.message);
        // Start background processors anyway
        startDexscreenerAutoEnricher();
        startRugcheckAutoProcessor();
        startTrendingAutoRefresher();
        startNewFeedAutoRefresher();
      });
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
  console.log(`🆕 Got ${tokens.length} NEW tokens (1-96 hours old)`);

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
      volume_5m: token.volume_5m || 0,
      volume_24h_usd: token.volume_24h || 0,
      liquidity: token.liquidity || 0,
      liquidity_usd: token.liquidityUsd || token.liquidity || 0,
      created_timestamp: createdAt,
      age: ageHours,  // Age in hours - important for NEW feed filtering
      ageHours: ageHours,
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

// ========================================
// API ROUTES
// ========================================

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
          age: '1-96 hours',
          volume_5m: '$20k-$70k',
          liquidity: '$10k+',
          market_cap: '$50k+'
        }
      });
    }
    
    const limitedCoins = newCoins.slice(0, limit);
    
    console.log(`✅ Returning ${limitedCoins.length}/${newCoins.length} new coins (limit: ${limit === 9999 ? 'ALL' : limit}, auto-refreshed every 30 min)`);
    
    res.json({
      success: true,
      coins: limitedCoins,
      count: limitedCoins.length,
      total: newCoins.length,
      timestamp: new Date().toISOString(),
      criteria: {
        age: '1-96 hours',
        volume_5m: '$20k-$70k'
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
    
    const limitedCoins = trendingCoins.slice(0, limit);
    
    console.log(`✅ Returning ${limitedCoins.length}/${trendingCoins.length} trending coins (limit: ${limit === 9999 ? 'ALL' : limit})`);
    
    res.json({
      success: true,
      coins: limitedCoins,
      count: limitedCoins.length,
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

    // Stop previous custom feed enrichment before starting new one
    console.log('🛑 Stopping previous custom feed enrichment...');
    dexscreenerAutoEnricher.stopCustomFeed();
    rugcheckAutoProcessor.stopCustomFeed();
    
    // Enrich first 10 coins SYNCHRONOUSLY before returning to user
    console.log('🎯 Enriching first 10 custom filtered coins synchronously...');
    await enrichPriorityCoins(coinsWithPriority, 10, 'custom filtered coins');
    
    // Cache the results (with first 10 already enriched)
    customCoins = coinsWithPriority;
    
    // Save to storage with filters
    customCoinStorage.saveBatch(coinsWithPriority, req.query);
    
    // Start enrichment for REMAINING custom filtered coins
    if (coinsWithPriority.length > 10) {
      console.log(`🎨 Starting background enrichment for remaining ${coinsWithPriority.length - 10} coins`);
      // Start DexScreener enrichment (first 10 already done)
      dexscreenerAutoEnricher.startCustomFeed(() => customCoins);
      // Start Rugcheck verification (first 10 already done)
      rugcheckAutoProcessor.startCustomFeed(() => customCoins);
    }

    console.log(`✅ Returning ${coinsWithPriority.length} custom filtered coins (first 10 fully enriched)`);
    
    res.json({
      success: true,
      coins: coinsWithPriority,
      count: coinsWithPriority.length,
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

// Start DexScreener auto-enricher for TRENDING feed
function startDexscreenerAutoEnricher() {
  if (currentCoins.length > 0) {
    console.log('🎨 Starting DexScreener enrichment for TRENDING feed (first 10 prioritized)');
    dexscreenerAutoEnricher.start(() => currentCoins, 'trending');
    
    // Start periodic re-enrichment (every 5 minutes)
    dexscreenerAutoEnricher.startPeriodicReEnrichment();
  }
}

// Start DexScreener auto-enricher for NEW feed
function startNewFeedDexscreenerEnricher() {
  if (newCoins.length > 0) {
    console.log('🎨 Starting DexScreener enrichment for NEW feed (first 10 prioritized)');
    dexscreenerAutoEnricher.startNewFeed(() => newCoins);
  }
}

// Start Rugcheck auto-processor for TRENDING feed
function startRugcheckAutoProcessor() {
  if (currentCoins.length > 0) {
    console.log('🔍 Starting Rugcheck for TRENDING feed (first 10 prioritized)');
    rugcheckAutoProcessor.start(() => currentCoins, 'trending');
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
      // Callback when refresh completes - update cache and restart enrichment
      async (freshTrendingBatch) => {
        console.log(`🔄 Updating TRENDING feed cache with ${freshTrendingBatch.length} fresh coins`);
        currentCoins = freshTrendingBatch;
        global.coinsCache = freshTrendingBatch;
        
        // Update Jupiter Live Price Service with new coin list
        if (jupiterLivePriceService && jupiterLivePriceService.isRunning) {
          jupiterLivePriceService.updateCoinList(freshTrendingBatch);
        }
        
        // Restart enrichment processes for the new batch
        console.log('🚀 Restarting enrichment for TRENDING feed...');
        
        // Stop existing enrichment processes for trending feed ONLY
        dexscreenerAutoEnricher.stopTrending();
        rugcheckAutoProcessor.stopTrending();
        
        // Start fresh enrichment with priority for first 10 coins
        startDexscreenerAutoEnricher();
        startRugcheckAutoProcessor();
        
        console.log('✅ TRENDING feed cache updated and enrichment restarted');
      }
    );
  }
}

// Start new feed auto-refresher (refreshes new coins every 30 minutes)
function startNewFeedAutoRefresher() {
  newFeedAutoRefresher.start(
    // Function to fetch fresh NEW coins
    fetchNewCoinBatch,
    // Callback when refresh completes - update cache and restart enrichment
    async (freshNewBatch) => {
      console.log(`🔄 Updating NEW feed cache with ${freshNewBatch.length} fresh coins`);
      
      // Enrich first 10 coins SYNCHRONOUSLY before making them available
      await enrichPriorityCoins(freshNewBatch, 10, 'refreshed NEW coins');
      
      newCoins = freshNewBatch;
      
      // Save to disk (overwrites old batch)
      newCoinStorage.saveBatch(freshNewBatch);
      
      // Restart enrichment processes for the remaining new coins
      console.log('🚀 Restarting enrichment for remaining NEW feed coins...');
      
      // Stop existing enrichment processes for new feed ONLY
      dexscreenerAutoEnricher.stopNewFeed();
      rugcheckAutoProcessor.stopNewFeed();
      
      // Start fresh enrichment (priority coins already done)
      startNewFeedEnrichment();
      
      console.log('✅ NEW feed cache updated and enrichment restarted');
    }
  );
}

// ========================================
// SERVER INITIALIZATION
// ========================================

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Start server FIRST (critical for Render health checks)
server.listen(PORT, () => {
  console.log(`🚀 MoonFeed Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Health check (Render): http://localhost:${PORT}/api/health`);
  console.log(`🔥 Trending coins: http://localhost:${PORT}/api/coins/trending`);
  console.log(`🆕 New coins: http://localhost:${PORT}/api/coins/new`);
  console.log(`🌐 WebSocket server ready for connections`);
  console.log(`💾 Server initialization complete - ready for health checks`);
  
  // Defer ALL initialization by 3 seconds to ensure health checks respond first
  // This gives Render time to verify the server is up before any heavy operations
  console.log('⏳ Will initialize coin data in 3 seconds...');
  setTimeout(() => {
    console.log('🔄 Starting background initialization...');
    initializeWithLatestBatch();
    console.log(`✅ Background initialization complete: ${currentCoins.length} coins cached`);
  }, 3000);
});

module.exports = app;
