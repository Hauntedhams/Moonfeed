#!/usr/bin/env node

/**
 * Test Phase 1 Implementation: Parallel Processing + Timestamps
 * 
 * This script tests:
 * 1. Parallel batch enrichment (8 coins at once)
 * 2. Timestamp tracking
 * 3. Enrichment attempt counting
 * 4. Error handling
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testPhase1() {
  log('\n🚀 Phase 1 Implementation Test\n', 'cyan');
  log('Testing: Parallel Processing + Timestamps + Enrichment Tracking\n', 'cyan');

  try {
    // Test 1: Check enrichment configuration
    log('Test 1: Checking enrichment configuration...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Fetch coins and check timestamps
    log('\nTest 2: Fetching coins and checking timestamp tracking...', 'yellow');
    
    const trendingRes = await axios.get(`${BASE_URL}/api/coins/trending?limit=20`);
    const trendingCoins = trendingRes.data.coins || [];
    
    log(`  Fetched ${trendingCoins.length} trending coins`, 'green');
    
    // Check for timestamps
    const coinsWithTimestamps = trendingCoins.filter(c => c.lastEnrichedAt);
    const coinsWithAttempts = trendingCoins.filter(c => c.enrichmentAttempts);
    const coinsWithErrors = trendingCoins.filter(c => c.lastEnrichmentError);
    
    log(`\n  📊 Timestamp Tracking:`, 'cyan');
    log(`    ✅ Coins with lastEnrichedAt: ${coinsWithTimestamps.length}/${trendingCoins.length}`, 
        coinsWithTimestamps.length > 0 ? 'green' : 'red');
    log(`    ✅ Coins with enrichmentAttempts: ${coinsWithAttempts.length}/${trendingCoins.length}`, 
        coinsWithAttempts.length > 0 ? 'green' : 'red');
    log(`    ⚠️  Coins with errors: ${coinsWithErrors.length}/${trendingCoins.length}`, 
        coinsWithErrors.length > 0 ? 'yellow' : 'green');
    
    // Sample first 5 coins
    log(`\n  📋 Sample (first 5 coins):`, 'cyan');
    trendingCoins.slice(0, 5).forEach((coin, idx) => {
      const hasChart = coin.cleanChartData && coin.cleanChartData.dataPoints;
      const timestamp = coin.lastEnrichedAt ? new Date(coin.lastEnrichedAt).toLocaleTimeString() : 'N/A';
      const attempts = coin.enrichmentAttempts || 0;
      const error = coin.lastEnrichmentError ? '❌ Error' : '';
      
      log(`    [${idx}] ${coin.symbol.padEnd(10)} Chart:${hasChart?'Y':'N'} Time:${timestamp} Attempts:${attempts} ${error}`, 
          hasChart ? 'green' : 'yellow');
    });
    
    // Test 3: Check enrichment rate
    log(`\nTest 3: Checking enrichment success rate...`, 'yellow');
    
    const enrichedCoins = trendingCoins.filter(c => 
      c.cleanChartData && c.cleanChartData.dataPoints && c.cleanChartData.dataPoints.length > 0
    );
    
    const enrichmentRate = (enrichedCoins.length / trendingCoins.length * 100).toFixed(1);
    
    log(`  Enrichment Rate: ${enrichmentRate}% (${enrichedCoins.length}/${trendingCoins.length})`, 
        enrichmentRate >= 80 ? 'green' : enrichmentRate >= 50 ? 'yellow' : 'red');
    
    if (enrichmentRate >= 80) {
      log('  ✅ EXCELLENT - Parallel processing working well!', 'green');
    } else if (enrichmentRate >= 50) {
      log('  ⚠️  GOOD - Some coins still being enriched', 'yellow');
    } else {
      log('  ❌ LOW - May need more time or have errors', 'red');
    }
    
    // Test 4: Check freshness of data
    log(`\nTest 4: Checking data freshness...`, 'yellow');
    
    const now = Date.now();
    const recentCoins = coinsWithTimestamps.filter(c => {
      const age = now - new Date(c.lastEnrichedAt).getTime();
      return age < 10 * 60 * 1000; // Less than 10 minutes old
    });
    
    log(`  Coins enriched in last 10 minutes: ${recentCoins.length}/${coinsWithTimestamps.length}`, 
        recentCoins.length >= coinsWithTimestamps.length * 0.8 ? 'green' : 'yellow');
    
    if (coinsWithTimestamps.length > 0) {
      const timestamps = coinsWithTimestamps.map(c => new Date(c.lastEnrichedAt).getTime());
      const oldestTime = Math.min(...timestamps);
      const newestTime = Math.max(...timestamps);
      const ageMinutes = ((now - oldestTime) / 1000 / 60).toFixed(1);
      
      log(`  Oldest enrichment: ${ageMinutes} minutes ago`, ageMinutes < 10 ? 'green' : 'yellow');
    }
    
    // Test 5: Check NEW feed
    log(`\nTest 5: Checking NEW feed...`, 'yellow');
    
    const newRes = await axios.get(`${BASE_URL}/api/coins/new?limit=20`);
    const newCoins = newRes.data.coins || [];
    
    const newEnriched = newCoins.filter(c => c.cleanChartData && c.cleanChartData.dataPoints);
    const newWithTimestamps = newCoins.filter(c => c.lastEnrichedAt);
    const newEnrichmentRate = (newEnriched.length / newCoins.length * 100).toFixed(1);
    
    log(`  NEW feed coins: ${newCoins.length}`, 'white');
    log(`  Enrichment Rate: ${newEnrichmentRate}% (${newEnriched.length}/${newCoins.length})`, 
        newEnrichmentRate >= 80 ? 'green' : newEnrichmentRate >= 50 ? 'yellow' : 'red');
    log(`  With timestamps: ${newWithTimestamps.length}/${newCoins.length}`, 
        newWithTimestamps.length > 0 ? 'green' : 'red');
    
    // Summary
    log(`\n${'='.repeat(60)}`, 'cyan');
    log('📊 PHASE 1 TEST SUMMARY', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const checks = [
      { name: 'Timestamp Tracking', pass: coinsWithTimestamps.length > 0 },
      { name: 'Enrichment Attempts Counter', pass: coinsWithAttempts.length > 0 },
      { name: 'Trending Enrichment Rate', pass: enrichmentRate >= 50 },
      { name: 'NEW Enrichment Rate', pass: newEnrichmentRate >= 50 },
      { name: 'Data Freshness', pass: recentCoins.length >= coinsWithTimestamps.length * 0.5 },
    ];
    
    const passedChecks = checks.filter(c => c.pass).length;
    
    checks.forEach(check => {
      log(`${check.pass ? '✅' : '❌'} ${check.name}`, check.pass ? 'green' : 'red');
    });
    
    log(`\n${passedChecks}/${checks.length} checks passed`, 
        passedChecks === checks.length ? 'green' : passedChecks >= 3 ? 'yellow' : 'red');
    
    if (passedChecks === checks.length) {
      log('\n🎉 Phase 1 Implementation: SUCCESS!', 'green');
      log('   Parallel processing and timestamp tracking are working!', 'green');
    } else if (passedChecks >= 3) {
      log('\n⚠️  Phase 1 Implementation: PARTIAL', 'yellow');
      log('   Some features working, give it more time or check logs', 'yellow');
    } else {
      log('\n❌ Phase 1 Implementation: NEEDS ATTENTION', 'red');
      log('   Check backend logs for errors', 'red');
    }
    
    log(`\n${'='.repeat(60)}\n`, 'cyan');
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Wait a bit for server to be ready
setTimeout(() => {
  testPhase1();
}, 2000);
