/**
 * ENRICHMENT INFRASTRUCTURE DIAGNOSTIC
 * Analyzes the current enrichment system and identifies issues
 */

const fetch = require('node-fetch');

async function runDiagnostic() {
  console.log('\n🔍 ENRICHMENT INFRASTRUCTURE DIAGNOSTIC\n');
  console.log('=' .repeat(80));
  
  try {
    // 1. Check both feeds
    console.log('\n📊 STEP 1: Checking Feed Data\n');
    
    const trendingResponse = await fetch('http://localhost:3001/api/coins/trending?limit=10');
    const trendingData = await trendingResponse.json();
    
    const newResponse = await fetch('http://localhost:3001/api/coins/new?limit=10');
    const newData = await newResponse.json();
    
    console.log(`✅ TRENDING Feed: ${trendingData.coins?.length || 0} coins`);
    console.log(`✅ NEW Feed: ${newData.coins?.length || 0} coins`);
    
    // 2. Analyze enrichment status for each feed
    console.log('\n📊 STEP 2: Enrichment Status Analysis\n');
    
    analyzeFeed('TRENDING', trendingData.coins || []);
    analyzeFeed('NEW', newData.coins || []);
    
    // 3. Check what data is being enriched
    console.log('\n📊 STEP 3: Enriched Data Fields Check\n');
    
    const trendingSample = trendingData.coins?.[0];
    const newSample = newData.coins?.[0];
    
    console.log('TRENDING Feed Sample (first coin):');
    checkEnrichedFields(trendingSample);
    
    console.log('\nNEW Feed Sample (first coin):');
    checkEnrichedFields(newSample);
    
    // 4. Check rate limiting and timing
    console.log('\n📊 STEP 4: Rate Limiting & Timing Issues\n');
    
    checkRateLimiting(trendingData.coins || [], newData.coins || []);
    
    // 5. Identify overlaps and conflicts
    console.log('\n📊 STEP 5: Overlap & Conflict Detection\n');
    
    checkOverlaps(trendingData.coins || [], newData.coins || []);
    
    // 6. Summary and recommendations
    console.log('\n📊 STEP 6: Summary & Recommendations\n');
    
    provideSummary(trendingData.coins || [], newData.coins || []);
    
  } catch (error) {
    console.error('❌ Diagnostic Error:', error.message);
  }
}

function analyzeFeed(feedName, coins) {
  console.log(`\n${feedName} Feed Analysis:`);
  console.log('-'.repeat(80));
  
  const total = coins.length;
  const withDexscreener = coins.filter(c => c.dexscreener).length;
  const withCleanChart = coins.filter(c => c.cleanChartData).length;
  const withProcessedTimestamp = coins.filter(c => c.dexscreenerProcessedAt).length;
  const withBanner = coins.filter(c => c.banner).length;
  const withPriceChanges = coins.filter(c => c.dexscreener?.priceChanges).length;
  
  console.log(`  Total Coins: ${total}`);
  console.log(`  With dexscreener object: ${withDexscreener} (${(withDexscreener/total*100).toFixed(0)}%)`);
  console.log(`  With cleanChartData: ${withCleanChart} (${(withCleanChart/total*100).toFixed(0)}%)`);
  console.log(`  With dexscreenerProcessedAt: ${withProcessedTimestamp} (${(withProcessedTimestamp/total*100).toFixed(0)}%)`);
  console.log(`  With banner: ${withBanner} (${(withBanner/total*100).toFixed(0)}%)`);
  console.log(`  With price changes: ${withPriceChanges} (${(withPriceChanges/total*100).toFixed(0)}%)`);
  
  // Check if marked as processed but missing data
  const processedButMissingData = coins.filter(c => 
    c.dexscreenerProcessedAt && (!c.dexscreener || !c.cleanChartData)
  ).length;
  
  if (processedButMissingData > 0) {
    console.log(`  ⚠️  ISSUE: ${processedButMissingData} coins marked as processed but missing enrichment data!`);
  }
  
  // Check processing times
  const timestamps = coins
    .filter(c => c.dexscreenerProcessedAt)
    .map(c => new Date(c.dexscreenerProcessedAt).getTime());
  
  if (timestamps.length > 0) {
    const oldest = new Date(Math.min(...timestamps));
    const newest = new Date(Math.max(...timestamps));
    const ageMinutes = (Date.now() - Math.min(...timestamps)) / 60000;
    
    console.log(`  Last processed: ${newest.toLocaleTimeString()} (${ageMinutes.toFixed(1)} min ago)`);
  }
}

function checkEnrichedFields(coin) {
  if (!coin) {
    console.log('  ❌ No coin data available');
    return;
  }
  
  console.log(`  Coin: ${coin.symbol} (${coin.name})`);
  console.log(`  Fields Present:`);
  console.log(`    ✓ dexscreener: ${!!coin.dexscreener ? '✅' : '❌'}`);
  console.log(`    ✓ dexscreener.priceChanges: ${!!coin.dexscreener?.priceChanges ? '✅' : '❌'}`);
  console.log(`    ✓ cleanChartData: ${!!coin.cleanChartData ? '✅' : '❌'}`);
  console.log(`    ✓ banner: ${!!coin.banner ? '✅' : '❌'}`);
  console.log(`    ✓ dexscreenerUrl: ${!!coin.dexscreenerUrl ? '✅' : '❌'}`);
  console.log(`    ✓ pairAddress: ${!!coin.pairAddress ? '✅' : '❌'}`);
  console.log(`    ✓ dexscreenerProcessedAt: ${!!coin.dexscreenerProcessedAt ? '✅' : '❌'}`);
  
  if (coin.cleanChartData) {
    console.log(`    ✓ cleanChartData points: ${coin.cleanChartData.dataPoints?.length || 0}`);
  }
  
  if (coin.dexscreener?.priceChanges) {
    const pc = coin.dexscreener.priceChanges;
    console.log(`    ✓ Price changes: 5m=${pc.change5m}%, 1h=${pc.change1h}%, 6h=${pc.change6h}%, 24h=${pc.change24h}%`);
  }
}

function checkRateLimiting(trendingCoins, newCoins) {
  const allProcessedTimes = [
    ...trendingCoins.filter(c => c.dexscreenerProcessedAt).map(c => ({
      time: new Date(c.dexscreenerProcessedAt).getTime(),
      feed: 'TRENDING',
      symbol: c.symbol
    })),
    ...newCoins.filter(c => c.dexscreenerProcessedAt).map(c => ({
      time: new Date(c.dexscreenerProcessedAt).getTime(),
      feed: 'NEW',
      symbol: c.symbol
    }))
  ].sort((a, b) => a.time - b.time);
  
  if (allProcessedTimes.length < 2) {
    console.log('  ⚠️  Not enough processed coins to analyze timing');
    return;
  }
  
  // Check if processing happened simultaneously (within 1 second)
  const simultaneousGroups = [];
  let currentGroup = [allProcessedTimes[0]];
  
  for (let i = 1; i < allProcessedTimes.length; i++) {
    const timeDiff = allProcessedTimes[i].time - allProcessedTimes[i-1].time;
    if (timeDiff < 1000) {
      currentGroup.push(allProcessedTimes[i]);
    } else {
      if (currentGroup.length > 1) {
        simultaneousGroups.push(currentGroup);
      }
      currentGroup = [allProcessedTimes[i]];
    }
  }
  
  if (currentGroup.length > 1) {
    simultaneousGroups.push(currentGroup);
  }
  
  console.log(`  Processed coins: ${allProcessedTimes.length}`);
  console.log(`  Simultaneous processing groups: ${simultaneousGroups.length}`);
  
  simultaneousGroups.forEach((group, i) => {
    const feeds = [...new Set(group.map(g => g.feed))];
    console.log(`    Group ${i+1}: ${group.length} coins processed together (feeds: ${feeds.join(', ')})`);
  });
  
  // Check for potential rate limiting (too many requests in short time)
  const recentProcessing = allProcessedTimes.filter(t => Date.now() - t.time < 60000);
  if (recentProcessing.length > 30) {
    console.log(`  ⚠️  WARNING: ${recentProcessing.length} coins processed in last minute - potential rate limiting risk!`);
  }
}

function checkOverlaps(trendingCoins, newCoins) {
  // Check if same coins appear in both feeds
  const trendingAddresses = new Set(trendingCoins.map(c => c.mintAddress));
  const newAddresses = new Set(newCoins.map(c => c.mintAddress));
  
  const overlap = [...trendingAddresses].filter(addr => newAddresses.has(addr));
  
  console.log(`  TRENDING coins: ${trendingAddresses.size}`);
  console.log(`  NEW coins: ${newAddresses.size}`);
  console.log(`  Overlapping coins: ${overlap.length}`);
  
  if (overlap.length > 0) {
    console.log(`  ⚠️  ${overlap.length} coins appear in BOTH feeds - may cause duplicate enrichment!`);
  }
  
  // Check for duplicate processing
  const allCoins = [...trendingCoins, ...newCoins];
  const processedAddresses = new Map();
  
  allCoins.forEach(coin => {
    if (coin.dexscreenerProcessedAt) {
      if (processedAddresses.has(coin.mintAddress)) {
        processedAddresses.get(coin.mintAddress).push({
          symbol: coin.symbol,
          time: coin.dexscreenerProcessedAt
        });
      } else {
        processedAddresses.set(coin.mintAddress, [{
          symbol: coin.symbol,
          time: coin.dexscreenerProcessedAt
        }]);
      }
    }
  });
  
  const duplicates = [...processedAddresses.entries()].filter(([addr, entries]) => entries.length > 1);
  if (duplicates.length > 0) {
    console.log(`  ⚠️  ${duplicates.length} coins processed multiple times!`);
  }
}

function provideSummary(trendingCoins, newCoins) {
  console.log('=' .repeat(80));
  console.log('SUMMARY OF ISSUES:\n');
  
  const issues = [];
  const recommendations = [];
  
  // Issue 1: Check if coins marked as processed but missing data
  const trendingMissing = trendingCoins.filter(c => 
    c.dexscreenerProcessedAt && (!c.dexscreener || !c.cleanChartData)
  ).length;
  const newMissing = newCoins.filter(c => 
    c.dexscreenerProcessedAt && (!c.dexscreener || !c.cleanChartData)
  ).length;
  
  if (trendingMissing > 0 || newMissing > 0) {
    issues.push(`❌ Coins marked as processed but missing enrichment data (TRENDING: ${trendingMissing}, NEW: ${newMissing})`);
    recommendations.push('✓ Don\'t mark coins as processed if enrichment fails');
    recommendations.push('✓ Retry failed enrichments on next cycle');
  }
  
  // Issue 2: Low enrichment rate
  const trendingRate = trendingCoins.filter(c => c.cleanChartData).length / trendingCoins.length;
  const newRate = newCoins.filter(c => c.cleanChartData).length / newCoins.length;
  
  if (trendingRate < 0.8 || newRate < 0.8) {
    issues.push(`❌ Low enrichment rate (TRENDING: ${(trendingRate*100).toFixed(0)}%, NEW: ${(newRate*100).toFixed(0)}%)`);
    recommendations.push('✓ Increase priority enrichment batch size to 10 coins per feed');
    recommendations.push('✓ Run enrichment immediately on startup for first 10 of each feed');
  }
  
  // Issue 3: Stale data
  const trendingProcessedTimes = trendingCoins
    .filter(c => c.dexscreenerProcessedAt)
    .map(c => new Date(c.dexscreenerProcessedAt).getTime());
  
  if (trendingProcessedTimes.length > 0) {
    const oldestAge = (Date.now() - Math.min(...trendingProcessedTimes)) / 60000;
    if (oldestAge > 10) {
      issues.push(`❌ Stale enrichment data (oldest: ${oldestAge.toFixed(1)} minutes old)`);
      recommendations.push('✓ Re-enrich coins every 5-10 minutes');
      recommendations.push('✓ Clear dexscreenerProcessedAt timestamps periodically');
    }
  }
  
  console.log('ISSUES FOUND:');
  if (issues.length === 0) {
    console.log('  ✅ No major issues detected!');
  } else {
    issues.forEach(issue => console.log(`  ${issue}`));
  }
  
  console.log('\nRECOMMENDATIONS:');
  if (recommendations.length === 0) {
    console.log('  ✅ System working as expected!');
  } else {
    recommendations.forEach(rec => console.log(`  ${rec}`));
  }
  
  console.log('\nIDEAL ENRICHMENT FLOW:');
  console.log('  1. Solana Tracker API call returns fresh coins (TRENDING: 1/day, NEW: every 30min)');
  console.log('  2. Immediately enrich first 5-10 coins per feed (priority)');
  console.log('  3. Continue enriching remaining coins in batches of 5');
  console.log('  4. Re-enrich ALL coins every 5-10 minutes (fresh price changes, banner, etc.)');
  console.log('  5. Live price updates happen independently via Jupiter API');
  console.log('  6. Clear old enrichment data ONLY after new Solana Tracker API call');
  
  console.log('\n' + '=' .repeat(80));
}

// Run diagnostic
runDiagnostic();
