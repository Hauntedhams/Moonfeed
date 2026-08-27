/**
 * Wallet Tracker Routes
 * Handles wallet information and analytics from Solana Tracker API
 * 
 * Available Endpoints:
 * - GET /api/wallet/:owner - Full wallet data (portfolio, PnL, stats)
 * - GET /api/wallet/:owner/basic - Basic info only (faster, lighter)
 * - GET /api/wallet/:owner/chart - Historical portfolio value chart data
 * - GET /api/wallet/:owner/trades - Recent trades list
 * - GET /api/wallet/:owner/page/:page - Paginated holdings/trades
 */

const express = require('express');
const fetch = require('node-fetch');
const BirdeyeWalletService = require('../services/birdeyeWalletService');
const SolscanWalletService = require('../services/solscanWalletService');
const HeliusWalletService = require('../services/heliusWalletService');
const DexCheckWalletService = require('../services/dexcheckWalletService');
const WalletCacheStore = require('../services/walletCacheStore');
const router = express.Router();

// Initialize services
const birdeyeService = new BirdeyeWalletService();
const solscanService = new SolscanWalletService();
const heliusService = new HeliusWalletService();
const dexcheckService = new DexCheckWalletService();

// Wallet data cache to prevent duplicate API calls
const walletCache = new Map();
const WALLET_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const WALLET_STALE_CACHE_MAX = 24 * 60 * 60 * 1000;
const walletCacheStore = new WalletCacheStore();

walletCacheStore.initialize()
  .then((persisted) => {
    for (const [key, value] of persisted.entries()) walletCache.set(key, value);
  })
  .catch((error) => console.warn('⚠️ Wallet cache hydrate failed:', error.message));

const setWalletCache = (key, value) => {
  walletCache.set(key, value);
  walletCacheStore.scheduleSave(walletCache);
};

const getFreshWalletCache = (key, ttl = WALLET_CACHE_TTL) => {
  const cached = walletCache.get(key);
  if (!cached || (Date.now() - cached.timestamp) >= ttl) return null;
  return cached;
};

const getUsableWalletCache = (key) => {
  const cached = walletCache.get(key);
  if (!cached || !cached.timestamp || (Date.now() - cached.timestamp) >= WALLET_STALE_CACHE_MAX) return null;
  return cached;
};

// Upstream calls must never hang the request indefinitely — bound every fetch.
const FETCH_TIMEOUT_MS = 5000;
const fetchWithTimeout = (url, options = {}, ms = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const pendingWalletAnalytics = new Map();
const warmQueue = [];
const warmingWallets = new Set();
let warmQueueActive = false;

const buildHeliusAnalyticsResponse = (owner, heliusData) => {
  const trading = heliusData.trading || {};
  const solActivity = heliusData.solActivity || {};
  const tokens = heliusData.tokens || [];
  const closedPositions = trading.closedTrades ?? 0;
  const totalTrades = trading.totalTrades ?? 0;

  return {
    success: true,
    wallet: owner,
    timestamp: new Date().toISOString(),
    isHeliusData: true,
    hasData: heliusData.hasData !== false,
    winRate: 0,
    totalProfit: 0,
    roi: 0,
    avgHoldTimeSecs: null,
    trading: {
      totalTrades,
      uniqueTokens: trading.uniqueTokens ?? tokens.length,
      activePositions: trading.activeTrades ?? 0,
      closedPositions,
      winningPositions: 0,
      losingPositions: 0
    },
    pnl: {
      realized: 0,
      unrealized: 0,
      total: 0,
      invested: Number(solActivity.totalSpent) || 0,
      proceeds: Number(solActivity.totalReceived) || 0
    },
    recentActivity: heliusData.recentActivity || [],
    dataSources: { solanaTracker: false, helius: true },
    partial: true,
    partialReason: 'Solana Tracker analytics unavailable; PnL and win rate require a price-valued history.'
  };
};

const fetchWalletAnalyticsData = async (owner, { allowStale = true } = {}) => {
  const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
  const cacheKey = `wallet-pnlv2-${owner}`;
  const freshCached = getFreshWalletCache(cacheKey);
  if (freshCached) return freshCached.data;

  const staleCached = allowStale ? getUsableWalletCache(cacheKey) : null;
  if (staleCached) {
    setTimeout(() => {
      fetchWalletAnalyticsData(owner, { allowStale: false }).catch((error) => {
        console.warn(`⚠️ Stale wallet refresh failed for ${owner.slice(0, 4)}...: ${error.details || error.message}`);
      });
    }, 0);
    return { ...staleCached.data, cached: true, stale: true };
  }

  const existing = pendingWalletAnalytics.get(owner);
  if (existing) return existing;

  const promise = (async () => {
    console.log(`🔍 Fetching wallet analytics for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const stData = SOLANA_TRACKER_API_KEY
      ? await fetchWithTimeout(`https://data.solanatracker.io/v2/pnl/wallets/${owner}`, {
          headers: { 'x-api-key': SOLANA_TRACKER_API_KEY, 'Content-Type': 'application/json' }
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      : null;

    if (!stData) {
      console.warn(`⚠️ Solana Tracker unavailable; using Helius fallback for wallet ${owner.slice(0, 4)}...`);
      const heliusData = await heliusService.getWalletAnalytics(owner);
      if (!heliusData.success) {
        const error = new Error('Failed to fetch wallet analytics');
        error.details = heliusData.error;
        throw error;
      }

      const fallbackData = buildHeliusAnalyticsResponse(owner, heliusData);
      setWalletCache(cacheKey, { data: fallbackData, timestamp: Date.now() });
      return fallbackData;
    }

    const summary = stData.summary || {};
    const analysis = stData.analysis || {};
    const stats = stData.stats || {};

    const combinedData = {
      success: true,
      wallet: owner,
      timestamp: new Date().toISOString(),
      isSolanaTrackerData: true,
      isHeliusData: true,
      hasData: true,
      identity: stData.identity || null,
      winRate: analysis.winRate ?? 0,
      totalProfit: summary.pnl?.realized ?? 0,
      roi: summary.roi ?? 0,
      avgHoldTimeSecs: summary.timing?.avgHoldTimeSecs ?? null,
      trading: {
        totalTrades: summary.counts?.trades ?? 0,
        uniqueTokens: summary.counts?.tokensTraded ?? 0,
        activePositions: stats.holding ?? 0,
        closedPositions: stats.sold ?? 0,
        winningPositions: analysis.tokens?.winning ?? 0,
        losingPositions: analysis.tokens?.losing ?? 0,
      },
      pnl: {
        realized: summary.pnl?.realized ?? 0,
        unrealized: summary.pnl?.unrealized ?? 0,
        total: summary.pnl?.total ?? 0,
        invested: summary.invested ?? 0,
        proceeds: summary.proceeds ?? 0,
      },
      dexcheck: null,
      dataSources: {
        solanaTracker: true,
        dexcheck: false
      }
    };

    setWalletCache(cacheKey, { data: combinedData, timestamp: Date.now() });
    console.log(`✅ Wallet analytics ready — winRate: ${combinedData.winRate}%, trades: ${combinedData.trading.totalTrades}`);
    return combinedData;
  })();

  pendingWalletAnalytics.set(owner, promise);
  promise.catch(() => {}).finally(() => pendingWalletAnalytics.delete(owner));
  return promise;
};

const processWarmQueue = async () => {
  if (warmQueueActive) return;
  warmQueueActive = true;

  while (warmQueue.length) {
    const item = warmQueue.shift();
    const owner = item?.address;
    if (!owner || warmingWallets.has(owner)) continue;

    warmingWallets.add(owner);
    try {
      await fetchWalletAnalyticsData(owner, { allowStale: false });
      if (item.includeTrades !== false) {
        await callSolanaTrackerAPI(`/wallet/${owner}/trades`, `wallet-trades-${owner}`).catch((error) => {
          console.warn(`⚠️ Warm wallet trades failed for ${owner.slice(0, 4)}...: ${error.message}`);
        });
      }
    } catch (error) {
      console.warn(`⚠️ Warm wallet analytics failed for ${owner.slice(0, 4)}...: ${error.details || error.message}`);
    } finally {
      warmingWallets.delete(owner);
    }
  }

  warmQueueActive = false;
};

// Helper function to call Solana Tracker API
const callSolanaTrackerAPI = async (endpoint, cacheKey) => {
  const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
  const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

  if (!SOLANA_TRACKER_API_KEY) {
    throw new Error('SOLANA_TRACKER_API_KEY not configured');
  }

  // Check cache first
  const cached = walletCache.get(cacheKey);
  const freshCached = getFreshWalletCache(cacheKey);
  if (freshCached) {
    console.log(`💾 Returning cached data for: ${cacheKey} (age: ${Math.round((Date.now() - freshCached.timestamp) / 1000)}s)`);
    return { data: freshCached.data, cached: true, timestamp: new Date(freshCached.timestamp).toISOString() };
  }

  // Fetch from API
  const apiUrl = `${SOLANA_TRACKER_BASE_URL}${endpoint}`;
  console.log(`📡 API URL: ${apiUrl}`);

  const response = await fetchWithTimeout(apiUrl, {
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
      return { data: cached.data, cached: true, stale: true, timestamp: new Date(cached.timestamp).toISOString() };
    }
    
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  console.log(`✅ API Response status: ${response.status}`);
  console.log(`📊 Response data preview:`, JSON.stringify(data).substring(0, 300));
  console.log(`📊 Response keys:`, data ? Object.keys(data) : 'no data');
  
  // Cache the result
  setWalletCache(cacheKey, {
    data: data,
    timestamp: Date.now()
  });

  return { data, cached: false, timestamp: new Date().toISOString() };
};

const POSITION_CACHE_TTL = 60 * 1000; // 1 minute — position value moves with live price

/**
 * POST /api/wallet/warm
 * Background-warm tracked wallets so repeat profile/trade loads come from the
 * persistent cache instead of cold upstream wallet history calls.
 */
router.post('/warm', (req, res) => {
  const wallets = Array.isArray(req.body?.wallets) ? req.body.wallets : [];
  const includeTrades = req.body?.includeTrades !== false;

  const queued = [];
  for (const wallet of wallets.slice(0, 20)) {
    const address = typeof wallet === 'string' ? wallet : wallet?.address;
    if (!address || address.length < 32 || address.length > 60) continue;
    if (warmingWallets.has(address) || warmQueue.some((item) => item.address === address)) continue;

    const analyticsFresh = getFreshWalletCache(`wallet-pnlv2-${address}`);
    const tradesFresh = getFreshWalletCache(`wallet-trades-${address}`);
    if (analyticsFresh && (!includeTrades || tradesFresh)) continue;

    warmQueue.push({ address, includeTrades });
    queued.push(address);
  }

  processWarmQueue();
  res.json({ success: true, queued: queued.length, pending: warmQueue.length, warming: warmingWallets.size });
});

/**
 * GET /api/wallet/:owner/position/:mint
 * Single wallet+token position (entry/exit price & market cap, PnL) — used for the
 * FOMO-style "most recent trade" detail view. One lightweight upstream call, no
 * need to fetch/parse the wallet's whole trade history.
 */
router.get('/:owner/position/:mint', async (req, res) => {
  try {
    const { owner, mint } = req.params;
    if (!owner || !mint) {
      return res.status(400).json({ success: false, error: 'Wallet address and token mint are required' });
    }

    const cacheKey = `wallet-position-${owner}-${mint}`;
    const cached = walletCache.get(cacheKey);
    const freshCached = getFreshWalletCache(cacheKey, POSITION_CACHE_TTL);
    if (freshCached) {
      return res.json(freshCached.data);
    }

    const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
    if (!SOLANA_TRACKER_API_KEY) {
      return res.status(502).json({ success: false, error: 'SOLANA_TRACKER_API_KEY not configured' });
    }

    const response = await fetchWithTimeout(
      `https://data.solanatracker.io/v2/pnl/wallets/${owner}/tokens/${mint}`,
      { headers: { 'x-api-key': SOLANA_TRACKER_API_KEY, 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      if (cached) return res.json(cached.data);
      return res.status(response.status === 404 ? 404 : 502).json({
        success: false,
        error: response.status === 404 ? 'No position found for this wallet/token' : 'Failed to fetch position data'
      });
    }

    const d = await response.json();
    const meta = d.meta || {};
    const volume = d.volume || {};
    const timing = d.timing || {};
    const current = d.current || {};

    // Derive per-token entry/exit price from $ volume, then scale to market cap
    // using the current price:marketCap ratio (supply is constant).
    const avgEntryPrice = volume.tokensBought ? volume.buyUsd / volume.tokensBought : null;
    const avgExitPrice = volume.tokensSold ? volume.sellUsd / volume.tokensSold : null;
    const supply = current.price ? meta.marketCap / current.price : null;
    const avgEntryMarketCap = supply && avgEntryPrice ? avgEntryPrice * supply : null;
    const avgExitMarketCap = supply && avgExitPrice ? avgExitPrice * supply : null;

    const data = {
      success: true,
      wallet: owner,
      mint,
      symbol: meta.symbol || 'Unknown',
      name: meta.name || meta.symbol || 'Unknown',
      image: meta.image || null,
      currentPrice: current.price ?? meta.price ?? null,
      currentMarketCap: meta.marketCap ?? null,
      pnl: d.pnl || { realized: 0, unrealized: 0, total: 0 },
      invested: d.invested ?? 0,
      proceeds: d.proceeds ?? 0,
      roi: d.roi ?? 0,
      avgEntryPrice,
      avgExitPrice,
      avgEntryMarketCap,
      avgExitMarketCap,
      counts: d.counts || { buys: 0, sells: 0, total: 0 },
      timing,
      timestamp: new Date().toISOString()
    };

    setWalletCache(cacheKey, { data, timestamp: Date.now() });
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching wallet position:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch wallet position', details: error.message });
  }
});

/**
 * GET /api/wallet/:owner
 * Fetch wallet analytics using Solana Tracker PnL V2 API (single HTTP call, all-time accurate data)
 */
router.get('/:owner', async (req, res) => {
  try {
    const { owner } = req.params;

    if (!owner) {
      return res.status(400).json({ success: false, error: 'Wallet address is required' });
    }
    res.json(await fetchWalletAnalyticsData(owner));

  } catch (error) {
    console.error('❌ Error fetching wallet data:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch wallet data', details: error.message });
  }
});

/**
 * GET /api/wallet/:owner/basic
 * Fetch basic wallet information (lighter/faster than full endpoint)
 * Returns: Essential stats without detailed holdings
 */
router.get('/:owner/basic', async (req, res) => {
  try {
    const { owner } = req.params;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    console.log(`🔍 Fetching basic wallet data for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const result = await callSolanaTrackerAPI(`/wallet/${owner}/basic`, `wallet-basic-${owner}`);
    
    console.log(`✅ Successfully fetched basic wallet data`);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error fetching basic wallet data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch basic wallet data',
      details: error.message
    });
  }
});

/**
 * GET /api/wallet/:owner/chart
 * Fetch historical portfolio value chart data
 * Returns: Time-series data of portfolio value for charting
 */
router.get('/:owner/chart', async (req, res) => {
  try {
    const { owner } = req.params;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    console.log(`🔍 Fetching wallet chart data for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const result = await callSolanaTrackerAPI(`/wallet/${owner}/chart`, `wallet-chart-${owner}`);
    
    console.log(`✅ Successfully fetched wallet chart data`);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Error fetching wallet chart data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet chart data',
      details: error.message
    });
  }
});

/**
 * GET /api/wallet/:owner/trades
 * Fetch recent trades for a wallet
 * Returns: List of recent buy/sell transactions with details
 */
router.get('/:owner/trades', async (req, res) => {
  try {
    const { owner } = req.params;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    console.log(`🔍 Fetching wallet trades for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    try {
      const result = await callSolanaTrackerAPI(`/wallet/${owner}/trades`, `wallet-trades-${owner}`);
      console.log(`✅ Successfully fetched wallet trades from Solana Tracker`);
      return res.json({ success: true, ...result });
    } catch (trackerError) {
      console.warn(`⚠️ Solana Tracker trades unavailable; using Helius fallback: ${trackerError.message}`);
      const heliusResult = await heliusService.getSwapTransactions(owner, 50);
      if (!heliusResult.success) {
        return res.status(502).json({ success: false, error: 'Failed to fetch wallet trades', details: heliusResult.error });
      }

      const trades = (heliusResult.transactions || []).map((swap) => ({
        tx: swap.signature || swap.id,
        type: swap.type,
        mint: swap.tokenMint,
        symbol: swap.tokenSymbol || 'Unknown',
        name: swap.tokenName || swap.tokenSymbol || 'Unknown',
        image: swap.tokenImage || null,
        solAmount: swap.type === 'buy' ? swap.inputAmount : swap.outputAmount,
        time: swap.timestamp
      }));

      return res.json({
        success: true,
        data: { trades },
        trades,
        count: trades.length,
        cached: heliusResult.cached || false,
        fallback: 'helius'
      });
    }

  } catch (error) {
    console.error('❌ Error fetching wallet trades:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet trades',
      details: error.message
    });
  }
});

/**
 * GET /api/wallet/:owner/swaps
 * Fetch swap/trade transaction history for a wallet
 * Returns: List of swap transactions (buys/sells) from Helius
 */
router.get('/:owner/swaps', async (req, res) => {
  try {
    const { owner } = req.params;
    const { limit = 50 } = req.query;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    console.log(`🔍 Fetching swap transactions for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const result = await heliusService.getSwapTransactions(owner, parseInt(limit));
    
    console.log(`✅ Successfully fetched ${result.transactions?.length || 0} swap transactions`);

    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching swap transactions:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swap transactions',
      details: error.message
    });
  }
});

/**
 * GET /api/wallet/:owner/page/:page
 * Fetch paginated wallet data (holdings/trades)
 * Returns: Paginated list of positions or transactions
 */
router.get('/:owner/page/:page', async (req, res) => {
  try {
    const { owner, page } = req.params;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const pageNum = parseInt(page) || 1;
    
    if (pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page number must be >= 1'
      });
    }

    console.log(`🔍 Fetching wallet page ${pageNum} for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const result = await callSolanaTrackerAPI(
      `/wallet/${owner}/page/${pageNum}`, 
      `wallet-page-${owner}-${pageNum}`
    );
    
    console.log(`✅ Successfully fetched wallet page ${pageNum}`);

    res.json({
      success: true,
      page: pageNum,
      ...result
    });

  } catch (error) {
    console.error('❌ Error fetching wallet page:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet page',
      details: error.message
    });
  }
});

/**
 * GET /api/wallet/:owner/analytics
 * Fetch comprehensive wallet analytics using Birdeye API
 * Returns: PnL, net worth, trading stats, transaction history
 */
router.get('/:owner/analytics', async (req, res) => {
  try {
    const { owner } = req.params;
    
    if (!owner) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    console.log(`🔍 Fetching Birdeye analytics for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const analyticsData = await birdeyeService.getComprehensiveWalletData(owner);
    
    if (!analyticsData.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet analytics',
        details: analyticsData.error
      });
    }

    console.log(`✅ Successfully fetched Birdeye analytics`);

    res.json(analyticsData);

  } catch (error) {
    console.error('❌ Error fetching wallet analytics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet analytics',
      details: error.message
    });
  }
});

module.exports = router;
