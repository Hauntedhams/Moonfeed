#!/usr/bin/env node

/**
 * ENRICHMENT INFRASTRUCTURE DIAGNOSTIC
 * 
 * Analyzes the enrichment process for multiple feeds to verify:
 * 1. Batch enrichment (5-10 coins per feed)
 * 2. Multi-feed support (trending, new, etc.)
 * 3. Periodic re-enrichment (every 5-10 minutes)
 * 4. Live price updates vs static enrichment data
 * 5. Cleanup of old data when new Solana Tracker data arrives
 * 6. Rate limiting and error handling
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const FEEDS = ['trending', 'new'];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function fetchFeedData(feed) {
  try {
    const response = await axios.get(`${BASE_URL}/api/coins/${feed}?limit=50`);
    return response.data;
  } catch (error) {
    log(`❌ Error fetching ${feed}: ${error.message}`, 'red');
    return null;
  }
}

async function analyzeEnrichmentCoverage() {
  section('📊 ENRICHMENT COVERAGE ANALYSIS');
  
  const results = {};
  
  for (const feed of FEEDS) {
    log(`\nAnalyzing ${feed.toUpperCase()} feed...`, 'yellow');
    
    const data = await fetchFeedData(feed);
    if (!data || !data.coins) {
      log(`  ❌ No data for ${feed}`, 'red');
      continue;
    }
    
    const coins = data.coins;
    const total = coins.length;
    
    // Analyze enrichment status
    const enriched = coins.filter(c => c.cleanChartData && c.cleanChartData.dataPoints);
    const hasPrice = coins.filter(c => c.priceUsd);
    const hasBanner = coins.filter(c => c.imageUrl || c.image);
    const hasMarketCap = coins.filter(c => c.marketCapUsd || c.marketCap);
    const hasLiquidity = coins.filter(c => c.liquidityUsd || c.liquidity);
    const hasVolume = coins.filter(c => c.volume24h || c.volume);
    
    results[feed] = {
      total,
      enriched: enriched.length,
      hasPrice: hasPrice.length,
      hasBanner: hasBanner.length,
      hasMarketCap: hasMarketCap.length,
      hasLiquidity: hasLiquidity.length,
      hasVolume: hasVolume.length,
      coins: coins
    };
    
    log(`  Total coins: ${total}`, 'white');
    log(`  ✅ With Clean Chart: ${enriched.length} (${(enriched.length / total * 100).toFixed(1)}%)`, 
        enriched.length > 0 ? 'green' : 'red');
    log(`  💰 With Price: ${hasPrice.length} (${(hasPrice.length / total * 100).toFixed(1)}%)`, 
        hasPrice.length > 0 ? 'green' : 'yellow');
    log(`  🖼️  With Banner: ${hasBanner.length} (${(hasBanner.length / total * 100).toFixed(1)}%)`, 
        hasBanner.length > 0 ? 'green' : 'yellow');
    log(`  📈 With Market Cap: ${hasMarketCap.length} (${(hasMarketCap.length / total * 100).toFixed(1)}%)`, 
        hasMarketCap.length > 0 ? 'green' : 'yellow');
    log(`  💧 With Liquidity: ${hasLiquidity.length} (${(hasLiquidity.length / total * 100).toFixed(1)}%)`, 
        hasLiquidity.length > 0 ? 'green' : 'yellow');
    log(`  📊 With Volume: ${hasVolume.length} (${(hasVolume.length / total * 100).toFixed(1)}%)`, 
        hasVolume.length > 0 ? 'green' : 'yellow');
    
    // Show sample of first 10 coins
    log(`\n  First 10 coins enrichment status:`, 'cyan');
    coins.slice(0, 10).forEach((coin, idx) => {
      const hasChart = coin.cleanChartData && coin.cleanChartData.dataPoints;
      const hasAllData = hasChart && coin.priceUsd && (coin.imageUrl || coin.image);
      const symbol = (coin.symbol || 'UNKNOWN').padEnd(10);
      const status = hasAllData ? '✅' : hasChart ? '⚠️' : '❌';
      log(`    [${idx}] ${symbol} ${status} Chart:${hasChart ? 'Y' : 'N'} Price:${coin.priceUsd ? 'Y' : 'N'} Banner:${coin.imageUrl || coin.image ? 'Y' : 'N'}`, 
          hasAllData ? 'green' : hasChart ? 'yellow' : 'red');
    });
  }
  
  return results;
}

async function checkBatchProcessing() {
  section('🔄 BATCH PROCESSING ANALYSIS');
  
  log('Checking backend auto-enrichment service configuration...', 'yellow');
  
  // We'll need to check the actual backend files
  const fs = require('fs');
  const path = require('path');
  
  const enricherPath = path.join(__dirname, 'backend', 'dexscreenerAutoEnricher.js');
  
  if (!fs.existsSync(enricherPath)) {
    log('❌ Auto-enricher file not found!', 'red');
    return;
  }
  
  const enricherContent = fs.readFileSync(enricherPath, 'utf-8');
  
  // Check batch size
  const batchSizeMatch = enricherContent.match(/BATCH_SIZE\s*=\s*(\d+)/);
  const batchSize = batchSizeMatch ? parseInt(batchSizeMatch[1]) : 'NOT FOUND';
  
  // Check interval
  const intervalMatch = enricherContent.match(/ENRICH_INTERVAL\s*=\s*(\d+)/);
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : 'NOT FOUND';
  
  // Check refresh interval
  const refreshMatch = enricherContent.match(/REFRESH_INTERVAL\s*=\s*(\d+)/);
  const refreshInterval = refreshMatch ? parseInt(refreshMatch[1]) : 'NOT FOUND';
  
  // Check which feeds are being processed
  const feedsMatch = enricherContent.match(/feeds\s*=\s*\[(.*?)\]/s);
  const feeds = feedsMatch ? feedsMatch[1].match(/'([^']+)'/g) : [];
  
  log(`\n📋 Configuration:`, 'cyan');
  log(`  Batch Size: ${batchSize}`, batchSize >= 5 && batchSize <= 10 ? 'green' : 'yellow');
  log(`  Enrich Interval: ${interval}ms (${interval / 1000}s)`, 'white');
  log(`  Refresh Interval: ${refreshInterval}ms (${refreshInterval / 1000 / 60}min)`, 
      refreshInterval >= 300000 && refreshInterval <= 600000 ? 'green' : 'yellow');
  log(`  Feeds: ${feeds.join(', ') || 'NOT FOUND'}`, feeds.length > 0 ? 'green' : 'red');
  
  // Check if simultaneous processing is implemented
  const hasPromiseAll = enricherContent.includes('Promise.all') || enricherContent.includes('Promise.allSettled');
  log(`  Simultaneous processing: ${hasPromiseAll ? '✅ Yes' : '❌ No'}`, hasPromiseAll ? 'green' : 'red');
  
  // Check for rate limiting handling
  const hasRateLimitHandling = enricherContent.includes('429') || enricherContent.includes('rate limit');
  log(`  Rate limit handling: ${hasRateLimitHandling ? '✅ Yes' : '⚠️  Unknown'}`, hasRateLimitHandling ? 'green' : 'yellow');
  
  return {
    batchSize,
    interval,
    refreshInterval,
    feeds,
    hasPromiseAll,
    hasRateLimitHandling
  };
}

async function checkLivePriceUpdates() {
  section('💰 LIVE PRICE UPDATE ANALYSIS');
  
  log('Checking if Jupiter price service is active...', 'yellow');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/coins/trending?limit=5`);
    const coins = response.data.coins || [];
    
    if (coins.length === 0) {
      log('❌ No coins to test', 'red');
      return;
    }
    
    const firstCoin = coins[0];
    log(`\nTesting with coin: ${firstCoin.symbol}`, 'cyan');
    log(`  Initial price: $${firstCoin.priceUsd}`, 'white');
    
    // Wait 5 seconds and check again
    log('\n⏳ Waiting 5 seconds for price update...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const response2 = await axios.get(`${BASE_URL}/api/coins/trending?limit=5`);
    const coins2 = response2.data.coins || [];
    const updatedCoin = coins2.find(c => c.address === firstCoin.address);
    
    if (!updatedCoin) {
      log('❌ Could not find same coin in second request', 'red');
      return;
    }
    
    log(`  Updated price: $${updatedCoin.priceUsd}`, 'white');
    
    if (updatedCoin.priceUsd !== firstCoin.priceUsd) {
      log('✅ Price is updating live!', 'green');
    } else {
      log('⚠️  Price did not change (may be correct if market is stable)', 'yellow');
    }
    
    // Check if there's a Jupiter service running
    const fs = require('fs');
    const path = require('path');
    const jupiterServicePath = path.join(__dirname, 'backend', 'jupiterService.js');
    
    if (fs.existsSync(jupiterServicePath)) {
      log('\n✅ Jupiter service file exists', 'green');
      const content = fs.readFileSync(jupiterServicePath, 'utf-8');
      const hasWebSocket = content.includes('WebSocket') || content.includes('ws://');
      log(`  WebSocket implementation: ${hasWebSocket ? '✅ Yes' : '❌ No'}`, hasWebSocket ? 'green' : 'red');
    } else {
      log('\n❌ Jupiter service file not found', 'red');
    }
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }
}

async function checkDataCleanup() {
  section('🗑️  DATA CLEANUP & REFRESH ANALYSIS');
  
  log('Checking Solana Tracker API call frequency...', 'yellow');
  
  const fs = require('fs');
  const path = require('path');
  
  // Check server.js for Solana Tracker integration
  const serverPath = path.join(__dirname, 'backend', 'server.js');
  
  if (!fs.existsSync(serverPath)) {
    log('❌ Server file not found!', 'red');
    return;
  }
  
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  
  // Check for Solana Tracker caching
  const hasCaching = serverContent.includes('CACHE_DURATION') || serverContent.includes('cache');
  log(`\n💾 Caching implemented: ${hasCaching ? '✅ Yes' : '❌ No'}`, hasCaching ? 'green' : 'red');
  
  // Check cache durations
  const trendingCacheMatch = serverContent.match(/trending.*?(\d+)\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  const newCacheMatch = serverContent.match(/new.*?(\d+)\s*\*\s*60\s*\*\s*1000/);
  
  if (trendingCacheMatch) {
    const hours = parseInt(trendingCacheMatch[1]);
    log(`  Trending cache: ${hours} hours`, hours === 24 ? 'green' : 'yellow');
  } else {
    log(`  Trending cache: ❌ Not found or not 24h`, 'red');
  }
  
  if (newCacheMatch) {
    const minutes = parseInt(newCacheMatch[1]);
    log(`  New cache: ${minutes} minutes`, minutes === 30 ? 'green' : 'yellow');
  } else {
    log(`  New cache: ❌ Not found or not 30min`, 'red');
  }
  
  // Check if old enriched data is cleared when cache expires
  const hasClearOnExpiry = serverContent.includes('clear') && serverContent.includes('cache');
  log(`\n🧹 Clear enriched data on cache expiry: ${hasClearOnExpiry ? '✅ Yes' : '❌ No'}`, 
      hasClearOnExpiry ? 'green' : 'red');
  
  if (!hasClearOnExpiry) {
    log(`  ⚠️  WARNING: Old enriched data may persist after new Solana Tracker data arrives!`, 'yellow');
  }
}

async function checkForIssues(coverageData, configData) {
  section('🔍 ISSUES & RECOMMENDATIONS');
  
  const issues = [];
  const recommendations = [];
  
  // Check enrichment coverage
  for (const [feed, data] of Object.entries(coverageData)) {
    const enrichmentRate = (data.enriched / data.total) * 100;
    
    if (enrichmentRate < 50) {
      issues.push(`❌ ${feed.toUpperCase()}: Low enrichment rate (${enrichmentRate.toFixed(1)}%)`);
      recommendations.push(`  → Increase batch size or reduce interval for ${feed}`);
    } else if (enrichmentRate < 90) {
      issues.push(`⚠️  ${feed.toUpperCase()}: Partial enrichment (${enrichmentRate.toFixed(1)}%)`);
      recommendations.push(`  → Monitor rate limits and errors for ${feed}`);
    } else {
      log(`✅ ${feed.toUpperCase()}: Good enrichment rate (${enrichmentRate.toFixed(1)}%)`, 'green');
    }
  }
  
  // Check configuration
  if (configData.batchSize < 5) {
    issues.push(`⚠️  Batch size too small (${configData.batchSize})`);
    recommendations.push(`  → Increase to 5-10 for better throughput`);
  } else if (configData.batchSize > 10) {
    issues.push(`⚠️  Batch size may be too large (${configData.batchSize})`);
    recommendations.push(`  → Reduce to 5-10 to avoid rate limits`);
  } else {
    log(`✅ Batch size is appropriate (${configData.batchSize})`, 'green');
  }
  
  if (!configData.hasPromiseAll) {
    issues.push(`❌ No simultaneous batch processing detected`);
    recommendations.push(`  → Implement Promise.allSettled() for parallel enrichment`);
  } else {
    log(`✅ Simultaneous batch processing implemented`, 'green');
  }
  
  const refreshMinutes = configData.refreshInterval / 1000 / 60;
  if (refreshMinutes < 5 || refreshMinutes > 10) {
    issues.push(`⚠️  Refresh interval outside optimal range (${refreshMinutes.toFixed(1)}min)`);
    recommendations.push(`  → Set to 5-10 minutes for optimal freshness`);
  } else {
    log(`✅ Refresh interval is optimal (${refreshMinutes.toFixed(1)}min)`, 'green');
  }
  
  // Display issues
  if (issues.length > 0) {
    log('\n🚨 Issues Found:', 'red');
    issues.forEach(issue => log(issue, 'yellow'));
    
    log('\n💡 Recommendations:', 'cyan');
    recommendations.forEach(rec => log(rec, 'white'));
  } else {
    log('\n🎉 No critical issues found!', 'green');
  }
}

async function checkEnrichmentTimestamps() {
  section('⏰ ENRICHMENT TIMESTAMP ANALYSIS');
  
  log('Checking when coins were last enriched...', 'yellow');
  
  for (const feed of FEEDS) {
    const data = await fetchFeedData(feed);
    if (!data || !data.coins) continue;
    
    log(`\n${feed.toUpperCase()} feed:`, 'cyan');
    
    const coinsWithTimestamps = data.coins.filter(c => c.lastEnriched || c.enrichedAt);
    
    if (coinsWithTimestamps.length === 0) {
      log('  ❌ No enrichment timestamps found!', 'red');
      log('  → Recommendation: Add timestamp tracking to enrichment process', 'yellow');
      continue;
    }
    
    const now = Date.now();
    const timestamps = coinsWithTimestamps.map(c => {
      const timestamp = c.lastEnriched || c.enrichedAt;
      const age = now - timestamp;
      return { symbol: c.symbol, age, timestamp };
    });
    
    timestamps.sort((a, b) => a.age - b.age);
    
    log(`  Most recent: ${timestamps[0].symbol} (${(timestamps[0].age / 1000 / 60).toFixed(1)}min ago)`, 'green');
    log(`  Oldest: ${timestamps[timestamps.length - 1].symbol} (${(timestamps[timestamps.length - 1].age / 1000 / 60).toFixed(1)}min ago)`, 'yellow');
    
    const staleCoins = timestamps.filter(t => t.age > 10 * 60 * 1000);
    if (staleCoins.length > 0) {
      log(`  ⚠️  ${staleCoins.length} coins haven't been refreshed in 10+ minutes`, 'yellow');
    }
  }
}

async function runDiagnostic() {
  log('\n🚀 Starting Enrichment Infrastructure Diagnostic\n', 'cyan');
  log(`Target: ${BASE_URL}`, 'white');
  log(`Feeds: ${FEEDS.join(', ')}\n`, 'white');
  
  try {
    // Run all diagnostics
    const coverageData = await analyzeEnrichmentCoverage();
    const configData = await checkBatchProcessing();
    await checkLivePriceUpdates();
    await checkDataCleanup();
    await checkEnrichmentTimestamps();
    await checkForIssues(coverageData, configData);
    
    section('✅ DIAGNOSTIC COMPLETE');
    log('Review the results above to identify issues and improvements.', 'green');
    
  } catch (error) {
    log(`\n❌ Diagnostic failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run diagnostic
runDiagnostic();
