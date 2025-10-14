// Diagnostic script to check feed refresh system status
// Verifies that both new feed (30 min) and trending feed (24 hrs) are working correctly

const fetch = require('node-fetch');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

async function checkEndpoint(url, name) {
  try {
    log(`📡 Testing ${name}: ${url}`, 'cyan');
    const startTime = Date.now();
    const response = await fetch(url);
    const elapsed = Date.now() - startTime;
    
    if (!response.ok) {
      log(`  ❌ HTTP ${response.status} - ${response.statusText}`, 'red');
      return null;
    }
    
    const data = await response.json();
    log(`  ✅ Response received (${elapsed}ms)`, 'green');
    return data;
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'red');
    return null;
  }
}

async function runDiagnostic() {
  log('\n🔍 FEED REFRESH DIAGNOSTIC', 'bright');
  log('Checking periodic refresh system for NEW and TRENDING feeds\n', 'cyan');
  
  const timestamp = new Date().toISOString();
  log(`⏰ Diagnostic started at: ${timestamp}`, 'yellow');
  
  // Test both localhost and production
  const environments = [
    { name: 'Localhost', baseUrl: 'http://localhost:3001' },
    { name: 'Production', baseUrl: 'https://api.moonfeed.app' }
  ];
  
  for (const env of environments) {
    section(`${env.name} Environment - ${env.baseUrl}`);
    
    // 1. Check server health
    log('1️⃣ Server Health Check', 'magenta');
    const health = await checkEndpoint(`${env.baseUrl}/api/health`, 'Health');
    if (health) {
      log(`   Status: ${health.status || 'unknown'}`, 'green');
      log(`   Uptime: ${health.uptime ? (health.uptime / 1000 / 60).toFixed(1) + ' minutes' : 'N/A'}`, 'green');
    }
    
    // 2. Check trending auto-refresher status
    log('\n2️⃣ Trending Auto-Refresher Status (24 hour cycle)', 'magenta');
    const trendingStatus = await checkEndpoint(`${env.baseUrl}/api/admin/trending-refresher-status`, 'Trending Status');
    if (trendingStatus) {
      log(`   Running: ${trendingStatus.isRunning ? '✅ YES' : '❌ NO'}`, trendingStatus.isRunning ? 'green' : 'red');
      log(`   Currently Refreshing: ${trendingStatus.isRefreshing ? '🔄 YES' : 'No'}`, trendingStatus.isRefreshing ? 'yellow' : 'green');
      
      if (trendingStatus.stats) {
        log(`   Total Refreshes: ${trendingStatus.stats.totalRefreshes}`, 'cyan');
        log(`   Last Refresh: ${trendingStatus.stats.lastRefreshAt || 'Never'}`, 'cyan');
        log(`   Last Count: ${trendingStatus.stats.lastRefreshCount || 0} coins`, 'cyan');
        log(`   Next Refresh: ${trendingStatus.stats.nextRefreshAt || 'Not scheduled'}`, 'cyan');
        log(`   Errors: ${trendingStatus.stats.errors || 0}`, trendingStatus.stats.errors > 0 ? 'red' : 'green');
        
        // Calculate time until next refresh
        if (trendingStatus.stats.nextRefreshAt) {
          const nextRefresh = new Date(trendingStatus.stats.nextRefreshAt);
          const now = new Date();
          const hoursUntil = (nextRefresh - now) / 1000 / 60 / 60;
          log(`   Time Until Next: ${hoursUntil.toFixed(1)} hours`, 'yellow');
        }
        
        // Check if last refresh was recent enough (should be within 24 hours + buffer)
        if (trendingStatus.stats.lastRefreshAt) {
          const lastRefresh = new Date(trendingStatus.stats.lastRefreshAt);
          const now = new Date();
          const hoursAgo = (now - lastRefresh) / 1000 / 60 / 60;
          
          if (hoursAgo > 25) {
            log(`   ⚠️  WARNING: Last refresh was ${hoursAgo.toFixed(1)} hours ago (should be < 24h)`, 'red');
          } else {
            log(`   ✅ Last refresh was ${hoursAgo.toFixed(1)} hours ago (healthy)`, 'green');
          }
        }
      }
    }
    
    // 3. Check new feed auto-refresher status
    log('\n3️⃣ New Feed Auto-Refresher Status (30 minute cycle)', 'magenta');
    const newStatus = await checkEndpoint(`${env.baseUrl}/api/admin/new-refresher-status`, 'New Feed Status');
    if (newStatus) {
      log(`   Running: ${newStatus.isRunning ? '✅ YES' : '❌ NO'}`, newStatus.isRunning ? 'green' : 'red');
      log(`   Currently Refreshing: ${newStatus.isRefreshing ? '🔄 YES' : 'No'}`, newStatus.isRefreshing ? 'yellow' : 'green');
      
      if (newStatus.stats) {
        log(`   Total Refreshes: ${newStatus.stats.totalRefreshes}`, 'cyan');
        log(`   Last Refresh: ${newStatus.stats.lastRefreshAt || 'Never'}`, 'cyan');
        log(`   Last Count: ${newStatus.stats.lastRefreshCount || 0} coins`, 'cyan');
        log(`   Next Refresh: ${newStatus.stats.nextRefreshAt || 'Not scheduled'}`, 'cyan');
        log(`   Errors: ${newStatus.stats.errors || 0}`, newStatus.stats.errors > 0 ? 'red' : 'green');
        
        // Calculate time until next refresh
        if (newStatus.stats.nextRefreshAt) {
          const nextRefresh = new Date(newStatus.stats.nextRefreshAt);
          const now = new Date();
          const minutesUntil = (nextRefresh - now) / 1000 / 60;
          log(`   Time Until Next: ${minutesUntil.toFixed(1)} minutes`, 'yellow');
        }
        
        // Check if last refresh was recent enough (should be within 30 minutes + buffer)
        if (newStatus.stats.lastRefreshAt) {
          const lastRefresh = new Date(newStatus.stats.lastRefreshAt);
          const now = new Date();
          const minutesAgo = (now - lastRefresh) / 1000 / 60;
          
          if (minutesAgo > 35) {
            log(`   ⚠️  WARNING: Last refresh was ${minutesAgo.toFixed(1)} minutes ago (should be < 30min)`, 'red');
          } else {
            log(`   ✅ Last refresh was ${minutesAgo.toFixed(1)} minutes ago (healthy)`, 'green');
          }
        }
      }
    }
    
    // 4. Check actual feed data
    log('\n4️⃣ Trending Feed Data', 'magenta');
    const trendingData = await checkEndpoint(`${env.baseUrl}/api/coins/trending?limit=5`, 'Trending Feed');
    if (trendingData) {
      // Handle both array and object responses
      const coins = Array.isArray(trendingData) ? trendingData : (trendingData.coins || []);
      log(`   Coins Returned: ${coins.length}`, 'cyan');
      
      // Check coin ages
      if (coins.length > 0) {
        const firstCoin = coins[0];
        log(`   First Coin: ${firstCoin.symbol || firstCoin.name || 'Unknown'}`, 'cyan');
        log(`   Address: ${(firstCoin.mintAddress || firstCoin.address || 'N/A').substring(0, 20)}...`, 'cyan');
        
        // Check if coins have enrichment data
        const enriched = coins.filter(c => c.enriched || c.dexscreener).length;
        log(`   Enriched: ${enriched}/${coins.length}`, enriched > 0 ? 'green' : 'yellow');
      }
    }
    
    log('\n5️⃣ New Feed Data', 'magenta');
    const newData = await checkEndpoint(`${env.baseUrl}/api/coins/new?limit=5`, 'New Feed');
    if (newData) {
      // Handle both array and object responses
      const coins = Array.isArray(newData) ? newData : (newData.coins || []);
      log(`   Coins Returned: ${coins.length}`, 'cyan');
      
      // Check coin ages
      if (coins.length > 0) {
        const firstCoin = coins[0];
        log(`   First Coin: ${firstCoin.symbol || firstCoin.name || 'Unknown'}`, 'cyan');
        log(`   Address: ${(firstCoin.mintAddress || firstCoin.address || 'N/A').substring(0, 20)}...`, 'cyan');
        
        // Check token ages
        const ages = coins
          .filter(c => c.ageHours || c.age)
          .map(c => c.ageHours || c.age)
          .filter(age => age > 0);
        
        if (ages.length > 0) {
          const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
          log(`   Average Age: ${avgAge.toFixed(1)} hours`, 'cyan');
          
          if (avgAge > 48) {
            log(`   ⚠️  WARNING: Coins seem old (avg ${avgAge.toFixed(1)}h)`, 'red');
          } else {
            log(`   ✅ Coins are fresh (avg ${avgAge.toFixed(1)}h)`, 'green');
          }
        }
        
        // Check if coins have enrichment data
        const enriched = coins.filter(c => c.enriched || c.dexscreener).length;
        log(`   Enriched: ${enriched}/${coins.length}`, enriched > 0 ? 'green' : 'yellow');
      }
    }
  }
  
  // Summary
  section('DIAGNOSTIC SUMMARY');
  log('✅ Check the results above for any red warnings', 'yellow');
  log('🔍 Key things to verify:', 'cyan');
  log('   1. Both auto-refreshers should be RUNNING', 'white');
  log('   2. Last refresh times should be within expected intervals', 'white');
  log('   3. New feed coins should have low average age (<48h)', 'white');
  log('   4. Production and localhost should behave similarly', 'white');
  log('   5. If production shows old data, check if auto-refreshers are running\n', 'white');
}

// Run the diagnostic
runDiagnostic().catch(error => {
  log(`\n❌ Diagnostic failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
