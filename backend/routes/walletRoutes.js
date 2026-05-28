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
const router = express.Router();

// Initialize services
const birdeyeService = new BirdeyeWalletService();
const solscanService = new SolscanWalletService();
const heliusService = new HeliusWalletService();
const dexcheckService = new DexCheckWalletService();

// Wallet data cache to prevent duplicate API calls
const walletCache = new Map();
const WALLET_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// Helper function to call Solana Tracker API
const callSolanaTrackerAPI = async (endpoint, cacheKey) => {
  const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
  const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

  if (!SOLANA_TRACKER_API_KEY) {
    throw new Error('SOLANA_TRACKER_API_KEY not configured');
  }

  // Check cache first
  const cached = walletCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < WALLET_CACHE_TTL) {
    console.log(`💾 Returning cached data for: ${cacheKey} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return { data: cached.data, cached: true, timestamp: new Date(cached.timestamp).toISOString() };
  }

  // Fetch from API
  const apiUrl = `${SOLANA_TRACKER_BASE_URL}${endpoint}`;
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
      return { data: cached.data, cached: true, stale: true, timestamp: new Date(cached.timestamp).toISOString() };
    }
    
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  console.log(`✅ API Response status: ${response.status}`);
  console.log(`📊 Response data preview:`, JSON.stringify(data).substring(0, 300));
  console.log(`📊 Response keys:`, data ? Object.keys(data) : 'no data');
  
  // Cache the result
  walletCache.set(cacheKey, {
    data: data,
    timestamp: Date.now()
  });

  return { data, cached: false, timestamp: new Date().toISOString() };
};

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

    const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
    if (!SOLANA_TRACKER_API_KEY) {
      return res.status(500).json({ success: false, error: 'SOLANA_TRACKER_API_KEY not configured' });
    }

    console.log(`🔍 Fetching wallet analytics for: ${owner.slice(0, 4)}...${owner.slice(-4)}`);

    const cacheKey = `wallet-pnlv2-${owner}`;
    const cached = walletCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < WALLET_CACHE_TTL) {
      console.log(`💾 Returning cached wallet data`);
      return res.json(cached.data);
    }

    // Fetch Solana Tracker PnL V2 and DexCheck in parallel (DexCheck with 6s timeout)
    const stPnlPromise = fetch(`https://data.solanatracker.io/v2/pnl/wallets/${owner}`, {
      headers: { 'x-api-key': SOLANA_TRACKER_API_KEY, 'Content-Type': 'application/json' }
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    const dexcheckWithTimeout = Promise.race([
      dexcheckService.getComprehensiveAnalytics(owner),
      new Promise(resolve => setTimeout(() => resolve({ success: false, error: 'timeout' }), 6000))
    ]);

    const [stData, dexcheckData] = await Promise.all([stPnlPromise, dexcheckWithTimeout]);

    if (!stData) {
      return res.status(502).json({ success: false, error: 'Failed to fetch wallet data from Solana Tracker' });
    }

    const summary = stData.summary || {};
    const analysis = stData.analysis || {};
    const stats = stData.stats || {};

    const combinedData = {
      success: true,
      wallet: owner,
      timestamp: new Date().toISOString(),
      isSolanaTrackerData: true,
      isHeliusData: true, // kept for WalletPopup backward compat
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
      dexcheck: dexcheckData.success ? {
        trading: dexcheckData.trading,
        whale: dexcheckData.whale,
        topTrader: dexcheckData.topTrader,
        recentActivity: dexcheckData.recentActivity
      } : null,
      dataSources: {
        solanaTracker: true,
        dexcheck: dexcheckData.success
      }
    };

    walletCache.set(cacheKey, { data: combinedData, timestamp: Date.now() });

    console.log(`✅ Wallet analytics ready — winRate: ${combinedData.winRate}%, trades: ${combinedData.trading.totalTrades}`);
    res.json(combinedData);

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

    const result = await callSolanaTrackerAPI(`/wallet/${owner}/trades`, `wallet-trades-${owner}`);
    
    console.log(`✅ Successfully fetched wallet trades`);

    res.json({
      success: true,
      ...result
    });

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
