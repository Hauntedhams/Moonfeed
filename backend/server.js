require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const http = require('http');
const CoinStorage = require('./coin-storage');
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
    
    // Start auto-processors for the loaded batch
    startDexscreenerAutoEnricher();  // Start DexScreener enrichment first
    startRugcheckAutoProcessor();     // Then start Rugcheck verification
    startTrendingAutoRefresher();     // Start 24-hour auto-refresh for trending coins
    startNewFeedAutoRefresher();      // Start 30-minute auto-refresh for new coins
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
// Parameters: 1-96 hours age, $15k-$30k 5m volume
async function fetchNewCoinBatch() {
  // Calculate timestamps for 1-96 hour age range
  const now = Date.now();
  const minCreatedAt = now - (96 * 60 * 60 * 1000); // 96 hours ago (4 days)
  const maxCreatedAt = now - (1 * 60 * 60 * 1000);  // 1 hour ago (coins need time to settle)
  
  const searchParams = {
    // 5-minute volume - Shows immediate interest
    minVolume_5m: 15000,          // $15k minimum 5-minute volume
    maxVolume_5m: 30000,          // $30k maximum 5-minute volume
    
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
  console.log(`📊 Filters: 5m Vol $15k-$30k | Liq $10k+ | MC $50k+ | Age 1-96h`);
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
          volume_5m: '$15k-$30k',
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
        volume_5m: '$15k-$30k'
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
        
        // Stop existing enrichment processes for trending feed
        if (dexscreenerAutoEnricher.intervalId) {
          dexscreenerAutoEnricher.stop();
        }
        if (rugcheckAutoProcessor.intervalId) {
          rugcheckAutoProcessor.stop();
        }
        
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
      newCoins = freshNewBatch;
      
      // Restart enrichment processes for the new batch
      console.log('🚀 Restarting enrichment for NEW feed...');
      
      // Stop existing enrichment processes for new feed
      if (dexscreenerAutoEnricher.newFeedIntervalId) {
        dexscreenerAutoEnricher.stop();
      }
      if (rugcheckAutoProcessor.newFeedIntervalId) {
        rugcheckAutoProcessor.stop();
      }
      
      // Start fresh enrichment with priority for first 10 coins
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
