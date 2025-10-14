#!/usr/bin/env node

/**
 * BACKEND DETAILED MONITORING
 * 
 * Monitors the backend over time to observe:
 * - Initial coin fetch from Solana Tracker
 * - Enrichment progression (DexScreener + Rugcheck)
 * - Jupiter live price updates
 * - 5-minute periodic metric refresh
 * 
 * This will run for 6 minutes to capture at least one full refresh cycle.
 */

require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatNumber(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}k`;
  return `$${num.toFixed(4)}`;
}

// Storage for tracking changes
const coinTracker = new Map();
const enrichmentHistory = [];
const priceHistory = [];

async function fetchCoins() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/coins/trending`, { timeout: 10000 });
    if (response.data.success && response.data.coins) {
      return response.data.coins;
    }
    return [];
  } catch (error) {
    log(`Error fetching coins: ${error.message}`, 'red');
    return [];
  }
}

async function monitorSnapshot() {
  const coins = await fetchCoins();
  
  if (coins.length === 0) {
    log('⚠️  No coins returned', 'yellow');
    return;
  }

  // Track first 5 coins for detailed monitoring
  const monitoredCoins = coins.slice(0, 5);
  
  // Enrichment stats
  const enriched = coins.filter(c => c.enriched || c.banner || c.socialLinks).length;
  const withBanners = coins.filter(c => c.banner && !c.banner.includes('placeholder')).length;
  const withSocials = coins.filter(c => c.socialLinks && Object.keys(c.socialLinks).length > 0).length;
  const withRugcheck = coins.filter(c => c.rugcheckVerified).length;
  
  const enrichmentPercent = ((enriched / coins.length) * 100).toFixed(1);
  
  log(`📊 Total: ${coins.length} | Enriched: ${enriched} (${enrichmentPercent}%) | Banners: ${withBanners} | Socials: ${withSocials} | Rugcheck: ${withRugcheck}`, 'cyan');
  
  // Track changes in monitored coins
  monitoredCoins.forEach((coin, idx) => {
    const key = coin.mintAddress;
    const previous = coinTracker.get(key);
    
    if (!previous) {
      // First time seeing this coin
      coinTracker.set(key, {
        symbol: coin.symbol,
        price: coin.price_usd,
        enriched: coin.enriched || false,
        banner: !!coin.banner,
        socials: !!(coin.socialLinks && Object.keys(coin.socialLinks).length > 0),
        rugcheck: coin.rugcheckVerified || false,
        dexTimestamp: coin.dexscreenerProcessedAt,
        rugTimestamp: coin.rugcheckProcessedAt,
        lastSeen: Date.now()
      });
      log(`  ${idx + 1}. ${coin.symbol}: $${formatNumber(coin.price_usd)} [NEW]`, 'blue');
    } else {
      // Check for changes
      const changes = [];
      
      // Price change
      if (Math.abs(coin.price_usd - previous.price) > 0.000001) {
        const priceDiff = coin.price_usd - previous.price;
        const pricePct = ((priceDiff / previous.price) * 100).toFixed(2);
        changes.push(`Price: ${pricePct > 0 ? '+' : ''}${pricePct}%`);
      }
      
      // Enrichment changes
      if ((coin.enriched || coin.banner) && !previous.enriched) {
        changes.push('✨ ENRICHED');
      }
      if (coin.banner && !previous.banner) {
        changes.push('🖼️ BANNER');
      }
      if (coin.socialLinks && Object.keys(coin.socialLinks).length > 0 && !previous.socials) {
        changes.push('🔗 SOCIALS');
      }
      if (coin.rugcheckVerified && !previous.rugcheck) {
        changes.push('✅ RUGCHECK');
      }
      
      // Timestamp changes (re-enrichment)
      if (coin.dexscreenerProcessedAt && coin.dexscreenerProcessedAt !== previous.dexTimestamp) {
        changes.push('🔄 DEX RE-ENRICHED');
      }
      if (coin.rugcheckProcessedAt && coin.rugcheckProcessedAt !== previous.rugTimestamp) {
        changes.push('🔄 RUG RE-CHECKED');
      }
      
      // Update tracker
      coinTracker.set(key, {
        symbol: coin.symbol,
        price: coin.price_usd,
        enriched: coin.enriched || previous.enriched,
        banner: coin.banner || previous.banner,
        socials: (coin.socialLinks && Object.keys(coin.socialLinks).length > 0) || previous.socials,
        rugcheck: coin.rugcheckVerified || previous.rugcheck,
        dexTimestamp: coin.dexscreenerProcessedAt || previous.dexTimestamp,
        rugTimestamp: coin.rugcheckProcessedAt || previous.rugTimestamp,
        lastSeen: Date.now()
      });
      
      if (changes.length > 0) {
        log(`  ${idx + 1}. ${coin.symbol}: $${formatNumber(coin.price_usd)} | ${changes.join(' | ')}`, 'green');
      } else {
        log(`  ${idx + 1}. ${coin.symbol}: $${formatNumber(coin.price_usd)}`, 'reset');
      }
    }
    
    // Show enrichment timestamps if available
    if (coin.dexscreenerProcessedAt || coin.rugcheckProcessedAt) {
      const timestamps = [];
      if (coin.dexscreenerProcessedAt) {
        const age = Date.now() - new Date(coin.dexscreenerProcessedAt).getTime();
        timestamps.push(`Dex: ${formatTime(age)} ago`);
      }
      if (coin.rugcheckProcessedAt) {
        const age = Date.now() - new Date(coin.rugcheckProcessedAt).getTime();
        timestamps.push(`Rug: ${formatTime(age)} ago`);
      }
      if (timestamps.length > 0) {
        log(`     ⏱️  ${timestamps.join(' | ')}`, 'magenta');
      }
    }
  });
  
  // Store history
  enrichmentHistory.push({
    timestamp: Date.now(),
    total: coins.length,
    enriched,
    withBanners,
    withSocials,
    withRugcheck
  });
  
  priceHistory.push({
    timestamp: Date.now(),
    prices: monitoredCoins.map(c => ({ symbol: c.symbol, price: c.price_usd }))
  });
}

async function checkBackendLogs() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    if (response.data && response.data.autoRefreshers) {
      log('\n📊 Auto-Refresher Status:', 'cyan');
      
      const refreshers = response.data.autoRefreshers;
      if (refreshers.dexscreener) {
        log(`   DexScreener: ${refreshers.dexscreener.isRunning ? '✅ Running' : '❌ Stopped'}`, 'reset');
        if (refreshers.dexscreener.stats) {
          log(`      Enriched: ${refreshers.dexscreener.stats.totalEnriched}, Errors: ${refreshers.dexscreener.stats.errors}`, 'reset');
        }
      }
      
      if (refreshers.rugcheck) {
        log(`   Rugcheck: ${refreshers.rugcheck.isRunning ? '✅ Running' : '❌ Stopped'}`, 'reset');
      }
      
      if (refreshers.trending) {
        log(`   Trending Feed: ${refreshers.trending.isRunning ? '✅ Running' : '❌ Stopped'}`, 'reset');
      }
      
      if (refreshers.jupiter) {
        log(`   Jupiter Prices: ${refreshers.jupiter.isRunning ? '✅ Running' : '❌ Stopped'}`, 'reset');
      }
    }
  } catch (error) {
    // Health endpoint might not have all this data
  }
}

async function showSummary() {
  log('\n' + '='.repeat(70), 'bright');
  log('📊 MONITORING SUMMARY', 'bright');
  log('='.repeat(70), 'bright');
  
  if (enrichmentHistory.length > 0) {
    log('\n📈 Enrichment Progression:', 'cyan');
    
    const first = enrichmentHistory[0];
    const last = enrichmentHistory[enrichmentHistory.length - 1];
    const duration = last.timestamp - first.timestamp;
    
    log(`   Duration: ${formatTime(duration)}`, 'reset');
    log(`   Snapshots: ${enrichmentHistory.length}`, 'reset');
    log(`\n   Enrichment growth:`, 'reset');
    log(`      Start: ${first.enriched}/${first.total} (${((first.enriched/first.total)*100).toFixed(1)}%)`, 'yellow');
    log(`      End:   ${last.enriched}/${last.total} (${((last.enriched/last.total)*100).toFixed(1)}%)`, 'green');
    log(`      Gain:  +${last.enriched - first.enriched} coins enriched`, 'green');
    
    log(`\n   Banner growth:`, 'reset');
    log(`      Start: ${first.withBanners}/${first.total}`, 'yellow');
    log(`      End:   ${last.withBanners}/${last.total}`, 'green');
    log(`      Gain:  +${last.withBanners - first.withBanners} banners`, 'green');
    
    log(`\n   Rugcheck growth:`, 'reset');
    log(`      Start: ${first.withRugcheck}/${first.total}`, 'yellow');
    log(`      End:   ${last.withRugcheck}/${last.total}`, 'green');
    log(`      Gain:  +${last.withRugcheck - first.withRugcheck} rugchecked`, 'green');
  }
  
  if (priceHistory.length > 1) {
    log('\n💰 Price Movement Analysis:', 'cyan');
    
    const first = priceHistory[0];
    const last = priceHistory[priceHistory.length - 1];
    
    // Compare prices for each tracked coin
    first.prices.forEach((firstPrice, idx) => {
      const lastPrice = last.prices.find(p => p.symbol === firstPrice.symbol);
      if (lastPrice) {
        const change = lastPrice.price - firstPrice.price;
        const changePct = ((change / firstPrice.price) * 100).toFixed(2);
        const color = change > 0 ? 'green' : change < 0 ? 'red' : 'yellow';
        log(`   ${firstPrice.symbol}: ${formatNumber(firstPrice.price)} → ${formatNumber(lastPrice.price)} (${changePct > 0 ? '+' : ''}${changePct}%)`, color);
      }
    });
    
    // Count how many prices changed
    let changedCount = 0;
    first.prices.forEach(firstPrice => {
      const lastPrice = last.prices.find(p => p.symbol === firstPrice.symbol);
      if (lastPrice && Math.abs(lastPrice.price - firstPrice.price) > 0.000001) {
        changedCount++;
      }
    });
    
    log(`\n   ${changedCount}/${first.prices.length} coins had price changes`, 'cyan');
  }
  
  log('\n💡 Key Findings:', 'cyan');
  
  const reEnrichments = Array.from(coinTracker.values()).filter(c => c.dexTimestamp || c.rugTimestamp);
  log(`   - Tracked ${coinTracker.size} unique coins`, 'reset');
  log(`   - ${reEnrichments.length} coins have enrichment timestamps`, 'reset');
  
  if (enrichmentHistory.length > 0) {
    const first = enrichmentHistory[0];
    const last = enrichmentHistory[enrichmentHistory.length - 1];
    const enrichmentGain = last.enriched - first.enriched;
    
    if (enrichmentGain > 0) {
      log(`   ✅ Enrichment is progressing (+${enrichmentGain} coins)`, 'green');
    } else {
      log(`   ⚠️  No enrichment progress detected`, 'yellow');
    }
  }
  
  const duration = enrichmentHistory.length > 0 ? 
    enrichmentHistory[enrichmentHistory.length - 1].timestamp - enrichmentHistory[0].timestamp : 0;
  
  if (duration >= 300000) {
    log(`   ✅ Monitored for ${formatTime(duration)} (captured 5-min cycle)`, 'green');
  } else {
    log(`   ⚠️  Only monitored for ${formatTime(duration)} (need 5+ min for full cycle)`, 'yellow');
  }
  
  log('\n✅ Monitoring complete!', 'green');
}

async function runMonitoring() {
  log('='.repeat(70), 'bright');
  log('🔬 BACKEND DETAILED MONITORING', 'bright');
  log('='.repeat(70), 'bright');
  log(`Backend: ${BACKEND_URL}`, 'cyan');
  log(`Duration: 6 minutes (to capture 5-minute refresh cycle)`, 'cyan');
  log(`Check interval: Every 30 seconds`, 'cyan');
  log('='.repeat(70), 'bright');
  
  // Check backend connectivity
  try {
    await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    log('✅ Backend is online\n', 'green');
  } catch (error) {
    log('❌ Backend is offline or not responding', 'red');
    log('   Please start the backend with: npm run dev', 'yellow');
    return;
  }
  
  // Initial snapshot
  log('📸 Taking initial snapshot...', 'cyan');
  await monitorSnapshot();
  await checkBackendLogs();
  
  // Monitor every 30 seconds for 6 minutes (12 snapshots)
  const totalSnapshots = 12;
  let currentSnapshot = 1;
  
  const monitorInterval = setInterval(async () => {
    currentSnapshot++;
    log(`\n${'─'.repeat(70)}`, 'bright');
    log(`📸 Snapshot ${currentSnapshot}/${totalSnapshots} (${currentSnapshot * 30}s elapsed)`, 'cyan');
    log('─'.repeat(70), 'bright');
    
    await monitorSnapshot();
    
    if (currentSnapshot % 4 === 0) {
      await checkBackendLogs();
    }
    
    if (currentSnapshot >= totalSnapshots) {
      clearInterval(monitorInterval);
      log('\n⏹️  Monitoring period complete', 'yellow');
      await showSummary();
    }
  }, 30000); // 30 seconds
  
  // Show progress indicator
  log(`\n⏳ Monitoring in progress... (${totalSnapshots * 30} seconds total)`, 'yellow');
  log('   Press Ctrl+C to stop early\n', 'yellow');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  log('\n\n⏹️  Monitoring stopped by user', 'yellow');
  await showSummary();
  process.exit(0);
});

// Run the monitoring
runMonitoring().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
