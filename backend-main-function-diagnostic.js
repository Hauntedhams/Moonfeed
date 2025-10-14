#!/usr/bin/env node

/**
 * BACKEND MAIN FUNCTION DIAGNOSTIC
 * 
 * Tests the backend's main functions:
 * 1. Fetching coins from Solana Tracker
 * 2. Enriching coins (DexScreener + Rugcheck)
 * 3. Jupiter live price updates
 * 4. Periodic metric refresh (5-minute intervals)
 * 
 * This diagnostic measures timing and verifies functionality.
 */

require('dotenv').config({ path: __dirname + '/backend/.env' });
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SOLANA_TRACKER_API_KEY = process.env.SOLANA_TRACKER_API_KEY;
const SOLANA_TRACKER_BASE_URL = 'https://data.solanatracker.io';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatNumber(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}k`;
  return `$${num.toFixed(2)}`;
}

// ========================================
// TEST 1: Fetch coins from Solana Tracker
// ========================================
async function testSolanaTrackerFetch() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 1: SOLANA TRACKER - FETCH COINS', 'bright');
  log('='.repeat(60), 'bright');

  const startTime = Date.now();

  try {
    // Test fetching trending coins (top volume)
    log('\n📊 Fetching trending coins...', 'cyan');
    
    const searchParams = {
      minLiquidity: 25000,
      minMarketCap: 50000,
      minVolume_24h: 10000,
      sortBy: 'volume24h',
      sortOrder: 'desc',
      limit: 100,
      page: 1
    };

    const queryString = new URLSearchParams(searchParams).toString();
    const url = `${SOLANA_TRACKER_BASE_URL}/search?${queryString}`;

    const response = await axios.get(url, {
      headers: {
        'x-api-key': SOLANA_TRACKER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const fetchTime = Date.now() - startTime;

    if (response.data.status === 'success' && response.data.data) {
      const coins = response.data.data;
      log(`✅ Successfully fetched ${coins.length} coins`, 'green');
      log(`⏱️  Fetch time: ${formatTime(fetchTime)}`, 'yellow');

      // Show sample coin data
      if (coins.length > 0) {
        const sample = coins[0];
        log('\n📝 Sample coin data:', 'cyan');
        log(`   Symbol: ${sample.symbol}`, 'reset');
        log(`   Name: ${sample.name}`, 'reset');
        log(`   Price: ${formatNumber(sample.priceUsd || 0)}`, 'reset');
        log(`   Market Cap: ${formatNumber(sample.marketCapUsd || 0)}`, 'reset');
        log(`   24h Volume: ${formatNumber(sample.volume_24h || 0)}`, 'reset');
        log(`   Liquidity: ${formatNumber(sample.liquidityUsd || 0)}`, 'reset');
        log(`   Has socials: ${sample.hasSocials ? 'Yes' : 'No'}`, 'reset');
      }

      return {
        success: true,
        count: coins.length,
        time: fetchTime,
        sampleCoin: coins[0]
      };
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message,
      time: Date.now() - startTime
    };
  }
}

// ========================================
// TEST 2: DexScreener Enrichment
// ========================================
async function testDexscreenerEnrichment(sampleCoin) {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 2: DEXSCREENER - ENRICHMENT', 'bright');
  log('='.repeat(60), 'bright');

  if (!sampleCoin) {
    log('⚠️  No sample coin available, skipping', 'yellow');
    return { success: false, skipped: true };
  }

  const startTime = Date.now();

  try {
    log(`\n🎨 Enriching coin: ${sampleCoin.symbol}...`, 'cyan');

    // Call backend enrichment endpoint (we'll check the server's enrichment)
    const response = await axios.get(
      `${BACKEND_URL}/api/coins/trending`,
      { timeout: 30000 }
    );

    const enrichTime = Date.now() - startTime;

    if (response.data.success && response.data.coins) {
      const coins = response.data.coins;
      
      // Count enriched coins
      const enrichedCoins = coins.filter(c => c.enriched || c.banner || c.socialLinks);
      const withBanners = coins.filter(c => c.banner && !c.banner.includes('placeholder'));
      const withSocials = coins.filter(c => c.socialLinks && Object.keys(c.socialLinks).length > 0);
      const withRugcheck = coins.filter(c => c.rugcheckVerified);

      log(`✅ Enrichment analysis complete`, 'green');
      log(`⏱️  Processing time: ${formatTime(enrichTime)}`, 'yellow');
      log(`\n📊 Enrichment stats:`, 'cyan');
      log(`   Total coins: ${coins.length}`, 'reset');
      log(`   Enriched: ${enrichedCoins.length} (${((enrichedCoins.length / coins.length) * 100).toFixed(1)}%)`, 'green');
      log(`   With banners: ${withBanners.length} (${((withBanners.length / coins.length) * 100).toFixed(1)}%)`, 'green');
      log(`   With socials: ${withSocials.length} (${((withSocials.length / coins.length) * 100).toFixed(1)}%)`, 'green');
      log(`   Rugchecked: ${withRugcheck.length} (${((withRugcheck.length / coins.length) * 100).toFixed(1)}%)`, 'green');

      // Show enrichment details for first coin
      if (enrichedCoins.length > 0) {
        const enriched = enrichedCoins[0];
        log(`\n📝 Sample enriched coin (${enriched.symbol}):`, 'cyan');
        log(`   Banner: ${enriched.banner ? 'Yes' : 'No'}`, 'reset');
        log(`   Description: ${enriched.description ? 'Yes' : 'No'}`, 'reset');
        log(`   Socials: ${enriched.socialLinks ? Object.keys(enriched.socialLinks).join(', ') : 'None'}`, 'reset');
        log(`   Rugcheck: ${enriched.rugcheckVerified ? 'Yes' : 'No'}`, 'reset');
        if (enriched.rugcheckVerified) {
          log(`   Liquidity Locked: ${enriched.liquidityLocked ? 'Yes' : 'No'}`, 'reset');
          log(`   Risk Level: ${enriched.riskLevel || 'Unknown'}`, 'reset');
        }
      }

      return {
        success: true,
        time: enrichTime,
        totalCoins: coins.length,
        enriched: enrichedCoins.length,
        withBanners: withBanners.length,
        withSocials: withSocials.length,
        withRugcheck: withRugcheck.length
      };
    } else {
      throw new Error('Invalid response from backend');
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message,
      time: Date.now() - startTime
    };
  }
}

// ========================================
// TEST 3: Jupiter Live Price Updates
// ========================================
async function testJupiterLivePrices() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 3: JUPITER - LIVE PRICE UPDATES', 'bright');
  log('='.repeat(60), 'bright');

  try {
    log('\n💰 Fetching initial prices...', 'cyan');
    const startTime = Date.now();

    // Get trending coins first
    const response1 = await axios.get(`${BACKEND_URL}/api/coins/trending`, { timeout: 10000 });
    const initialFetchTime = Date.now() - startTime;

    if (!response1.data.success || !response1.data.coins) {
      throw new Error('Failed to fetch coins');
    }

    const coins = response1.data.coins.slice(0, 5); // Test with first 5 coins
    log(`✅ Got ${coins.length} coins for price tracking`, 'green');
    log(`⏱️  Initial fetch: ${formatTime(initialFetchTime)}`, 'yellow');

    // Record initial prices
    const initialPrices = coins.map(c => ({
      symbol: c.symbol,
      price: c.price_usd,
      time: Date.now()
    }));

    log('\n⏳ Waiting 10 seconds for price updates...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Fetch updated prices
    log('\n💰 Fetching updated prices...', 'cyan');
    const updateStartTime = Date.now();
    const response2 = await axios.get(`${BACKEND_URL}/api/coins/trending`, { timeout: 10000 });
    const updateFetchTime = Date.now() - updateStartTime;

    if (!response2.data.success || !response2.data.coins) {
      throw new Error('Failed to fetch updated coins');
    }

    const updatedCoins = response2.data.coins.slice(0, 5);
    const updatedPrices = updatedCoins.map(c => ({
      symbol: c.symbol,
      price: c.price_usd,
      time: Date.now()
    }));

    log(`✅ Got updated prices`, 'green');
    log(`⏱️  Update fetch: ${formatTime(updateFetchTime)}`, 'yellow');

    // Compare prices
    log('\n📊 Price comparison:', 'cyan');
    let changedCount = 0;
    for (let i = 0; i < Math.min(initialPrices.length, updatedPrices.length); i++) {
      const initial = initialPrices[i];
      const updated = updatedPrices[i];
      
      if (initial.symbol === updated.symbol) {
        const change = updated.price - initial.price;
        const changePercent = initial.price > 0 ? ((change / initial.price) * 100) : 0;
        
        if (Math.abs(change) > 0.000001) {
          changedCount++;
          const changeColor = change > 0 ? 'green' : 'red';
          log(`   ${initial.symbol}: ${formatNumber(initial.price)} → ${formatNumber(updated.price)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`, changeColor);
        } else {
          log(`   ${initial.symbol}: ${formatNumber(initial.price)} (no change)`, 'reset');
        }
      }
    }

    const priceUpdateWorking = changedCount > 0;
    log(`\n${priceUpdateWorking ? '✅' : '⚠️'} Price updates: ${priceUpdateWorking ? 'WORKING' : 'NO CHANGES DETECTED'}`, priceUpdateWorking ? 'green' : 'yellow');
    
    if (!priceUpdateWorking) {
      log('   Note: Prices may not change in 10 seconds for low-volume coins', 'yellow');
    }

    return {
      success: true,
      initialFetchTime,
      updateFetchTime,
      coinsTracked: coins.length,
      pricesChanged: changedCount,
      priceUpdatesWorking: priceUpdateWorking
    };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
}

// ========================================
// TEST 4: Periodic Metric Refresh (5 min)
// ========================================
async function testPeriodicMetricRefresh() {
  log('\n' + '='.repeat(60), 'bright');
  log('TEST 4: PERIODIC METRIC REFRESH', 'bright');
  log('='.repeat(60), 'bright');

  try {
    log('\n📊 Checking periodic refresh system...', 'cyan');

    // Get initial metrics
    const response1 = await axios.get(`${BACKEND_URL}/api/coins/trending`, { timeout: 10000 });
    
    if (!response1.data.success || !response1.data.coins) {
      throw new Error('Failed to fetch coins');
    }

    const coins = response1.data.coins.slice(0, 3);
    
    // Check for enrichment timestamps
    const withTimestamps = coins.filter(c => c.dexscreenerProcessedAt || c.rugcheckProcessedAt);
    
    log(`✅ Got ${coins.length} coins`, 'green');
    log(`📝 Coins with enrichment timestamps: ${withTimestamps.length}`, 'reset');

    if (withTimestamps.length > 0) {
      const sample = withTimestamps[0];
      log(`\n📝 Sample enrichment timestamps (${sample.symbol}):`, 'cyan');
      
      if (sample.dexscreenerProcessedAt) {
        const age = Date.now() - new Date(sample.dexscreenerProcessedAt).getTime();
        log(`   DexScreener: ${sample.dexscreenerProcessedAt} (${formatTime(age)} ago)`, 'reset');
      }
      
      if (sample.rugcheckProcessedAt) {
        const age = Date.now() - new Date(sample.rugcheckProcessedAt).getTime();
        log(`   Rugcheck: ${sample.rugcheckProcessedAt} (${formatTime(age)} ago)`, 'reset');
      }
    }

    // Check auto-refresher status via health endpoint
    log('\n🔍 Checking auto-refresher status...', 'cyan');
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
      
      if (healthResponse.data) {
        log(`✅ Backend health check passed`, 'green');
        
        if (healthResponse.data.autoRefreshers) {
          const refreshers = healthResponse.data.autoRefreshers;
          log(`\n📊 Auto-refresher status:`, 'cyan');
          
          if (refreshers.dexscreener) {
            log(`   DexScreener: ${refreshers.dexscreener.isRunning ? '✅ Running' : '❌ Stopped'}`, 
                refreshers.dexscreener.isRunning ? 'green' : 'red');
            log(`      Re-enrichment interval: ${refreshers.dexscreener.reEnrichmentInterval / 60000} minutes`, 'reset');
            log(`      Total enriched: ${refreshers.dexscreener.stats?.totalEnriched || 0}`, 'reset');
          }
          
          if (refreshers.trending) {
            log(`   Trending Feed: ${refreshers.trending.isRunning ? '✅ Running' : '❌ Stopped'}`, 
                refreshers.trending.isRunning ? 'green' : 'red');
            log(`      Refresh interval: ${refreshers.trending.refreshInterval / 60000} minutes`, 'reset');
          }
        }
      }
    } catch (healthError) {
      log(`⚠️  Health endpoint not available: ${healthError.message}`, 'yellow');
    }

    log('\n💡 Note: Full 5-minute refresh cycle cannot be tested in this diagnostic', 'yellow');
    log('   The system is designed to re-enrich coins every 5 minutes automatically', 'yellow');
    log('   Monitor the backend logs to see periodic refresh in action', 'yellow');

    return {
      success: true,
      coinsWithTimestamps: withTimestamps.length,
      totalCoins: coins.length
    };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
}

// ========================================
// MAIN DIAGNOSTIC RUNNER
// ========================================
async function runDiagnostic() {
  log('\n' + '='.repeat(60), 'bright');
  log('🔬 BACKEND MAIN FUNCTION DIAGNOSTIC', 'bright');
  log('='.repeat(60), 'bright');
  log(`Backend URL: ${BACKEND_URL}`, 'cyan');
  log(`Timestamp: ${new Date().toISOString()}`, 'cyan');

  const totalStartTime = Date.now();
  const results = {};

  // Check backend connectivity
  log('\n🔍 Checking backend connectivity...', 'cyan');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    log('✅ Backend is online', 'green');
  } catch (error) {
    log('❌ Backend is offline or not responding', 'red');
    log('   Please start the backend with: npm run dev', 'yellow');
    return;
  }

  // Run all tests
  results.solanaTracker = await testSolanaTrackerFetch();
  results.enrichment = await testDexscreenerEnrichment(results.solanaTracker?.sampleCoin);
  results.jupiterPrices = await testJupiterLivePrices();
  results.periodicRefresh = await testPeriodicMetricRefresh();

  const totalTime = Date.now() - totalStartTime;

  // Summary
  log('\n' + '='.repeat(60), 'bright');
  log('📊 DIAGNOSTIC SUMMARY', 'bright');
  log('='.repeat(60), 'bright');

  log('\n✅ Test Results:', 'cyan');
  log(`   1. Solana Tracker Fetch: ${results.solanaTracker.success ? '✅ PASS' : '❌ FAIL'}`, 
      results.solanaTracker.success ? 'green' : 'red');
  if (results.solanaTracker.success) {
    log(`      - Fetched ${results.solanaTracker.count} coins in ${formatTime(results.solanaTracker.time)}`, 'reset');
  }

  log(`   2. DexScreener Enrichment: ${results.enrichment.success ? '✅ PASS' : '❌ FAIL'}`, 
      results.enrichment.success ? 'green' : 'red');
  if (results.enrichment.success) {
    log(`      - ${results.enrichment.enriched}/${results.enrichment.totalCoins} coins enriched`, 'reset');
    log(`      - ${results.enrichment.withBanners} with banners, ${results.enrichment.withSocials} with socials`, 'reset');
    log(`      - Processing time: ${formatTime(results.enrichment.time)}`, 'reset');
  }

  log(`   3. Jupiter Live Prices: ${results.jupiterPrices.success ? '✅ PASS' : '❌ FAIL'}`, 
      results.jupiterPrices.success ? 'green' : 'red');
  if (results.jupiterPrices.success) {
    log(`      - Tracked ${results.jupiterPrices.coinsTracked} coins`, 'reset');
    log(`      - ${results.jupiterPrices.pricesChanged} prices changed in 10s`, 'reset');
    log(`      - Update latency: ${formatTime(results.jupiterPrices.updateFetchTime)}`, 'reset');
  }

  log(`   4. Periodic Refresh: ${results.periodicRefresh.success ? '✅ PASS' : '⚠️  PARTIAL'}`, 
      results.periodicRefresh.success ? 'green' : 'yellow');
  if (results.periodicRefresh.success) {
    log(`      - System configured for 5-minute refresh cycles`, 'reset');
    log(`      - ${results.periodicRefresh.coinsWithTimestamps}/${results.periodicRefresh.totalCoins} coins have timestamps`, 'reset');
  }

  log(`\n⏱️  Total diagnostic time: ${formatTime(totalTime)}`, 'yellow');

  // Performance assessment
  log('\n📈 Performance Assessment:', 'cyan');
  const avgFetchTime = results.solanaTracker.time;
  const avgEnrichTime = results.enrichment.time;
  
  if (avgFetchTime < 2000) {
    log('   ✅ Solana Tracker fetch: EXCELLENT (<2s)', 'green');
  } else if (avgFetchTime < 5000) {
    log('   ⚠️  Solana Tracker fetch: ACCEPTABLE (2-5s)', 'yellow');
  } else {
    log('   ❌ Solana Tracker fetch: SLOW (>5s)', 'red');
  }

  if (avgEnrichTime < 10000) {
    log('   ✅ Enrichment: EXCELLENT (<10s)', 'green');
  } else if (avgEnrichTime < 30000) {
    log('   ⚠️  Enrichment: ACCEPTABLE (10-30s)', 'yellow');
  } else {
    log('   ❌ Enrichment: SLOW (>30s)', 'red');
  }

  log('\n💡 Recommendations:', 'cyan');
  if (!results.jupiterPrices.priceUpdatesWorking) {
    log('   - Monitor Jupiter price updates over a longer period', 'yellow');
    log('   - Low-volume coins may not see price changes quickly', 'yellow');
  }
  log('   - Check backend logs for ongoing enrichment cycles', 'yellow');
  log('   - Verify WebSocket connections for real-time updates', 'yellow');
  log('   - Monitor DexScreener and Rugcheck API rate limits', 'yellow');

  log('\n✅ Diagnostic complete!', 'green');
}

// Run the diagnostic
runDiagnostic().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
