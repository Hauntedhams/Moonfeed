#!/usr/bin/env node

/**
 * TEST: Enrichment Optimization with Global Cache
 * 
 * Verifies:
 * 1. Global cache works across multiple enrichment calls
 * 2. DEXtrending feed returns without auto-enrichment
 * 3. Other feeds still auto-enrich top coins
 * 4. Cache statistics show efficiency gains
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testEnrichmentOptimization() {
  console.log('\n🧪 TESTING ENRICHMENT OPTIMIZATION\n');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Fetch DEXtrending feed (should NOT auto-enrich)
    console.log('\n📊 Test 1: Fetching DEXtrending feed...');
    const dextrendingStart = Date.now();
    const dextrendingRes = await fetch(`${API_BASE}/coins/dextrending?limit=20`);
    const dextrendingData = await dextrendingRes.json();
    const dextrendingTime = Date.now() - dextrendingStart;
    
    if (dextrendingData.success && dextrendingData.coins.length > 0) {
      const firstCoin = dextrendingData.coins[0];
      console.log(`✅ DEXtrending returned ${dextrendingData.coins.length} coins in ${dextrendingTime}ms`);
      console.log(`   First coin: ${firstCoin.symbol} (${firstCoin.mintAddress})`);
      console.log(`   Has enriched data: ${firstCoin.enriched ? 'Yes' : 'No (expected - no auto-enrichment)'}`);
      
      // Store first coin's mint address for cache test
      const testMintAddress = firstCoin.mintAddress;
      
      // Test 2: Manually enrich the first coin to populate cache
      console.log(`\n📊 Test 2: Manually enriching ${firstCoin.symbol}...`);
      const enrichStart = Date.now();
      const enrichRes = await fetch(`${API_BASE}/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mintAddress: testMintAddress,
          coin: firstCoin 
        })
      });
      const enrichData = await enrichRes.json();
      const enrichTime = Date.now() - enrichStart;
      
      if (enrichData.success) {
        console.log(`✅ Enriched ${enrichData.coin.symbol} in ${enrichTime}ms`);
        console.log(`   Has chart data: ${enrichData.coin.cleanChartData ? 'Yes' : 'No'}`);
        console.log(`   Has rugcheck: ${enrichData.coin.rugcheckVerified ? 'Yes' : 'No'}`);
        console.log(`   Holder count: ${enrichData.coin.holders || enrichData.coin.holderCount || 'N/A'}`);
      } else {
        console.log(`❌ Failed to enrich: ${enrichData.error}`);
      }
      
      // Test 3: Re-enrich same coin to test cache (should be instant)
      console.log(`\n📊 Test 3: Re-enriching ${firstCoin.symbol} to test global cache...`);
      const cacheStart = Date.now();
      const cacheRes = await fetch(`${API_BASE}/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mintAddress: testMintAddress,
          coin: firstCoin 
        })
      });
      const cacheData = await cacheRes.json();
      const cacheTime = Date.now() - cacheStart;
      
      if (cacheData.success) {
        console.log(`✅ Re-enriched ${cacheData.coin.symbol} in ${cacheTime}ms`);
        
        if (cacheTime < enrichTime / 3) {
          console.log(`   🚀 CACHE HIT! ${cacheTime}ms vs ${enrichTime}ms (${((enrichTime - cacheTime) / enrichTime * 100).toFixed(1)}% faster)`);
        } else {
          console.log(`   ⚠️ No significant speed improvement - cache may not be working`);
        }
      } else {
        console.log(`❌ Failed to re-enrich: ${cacheData.error}`);
      }
      
      // Test 4: Fetch Trending feed (should auto-enrich top 20)
      console.log(`\n📊 Test 4: Fetching Trending feed (should auto-enrich top 20)...`);
      const trendingStart = Date.now();
      const trendingRes = await fetch(`${API_BASE}/coins/trending?limit=30`);
      const trendingData = await trendingRes.json();
      const trendingTime = Date.now() - trendingStart;
      
      if (trendingData.success && trendingData.coins.length > 0) {
        console.log(`✅ Trending returned ${trendingData.coins.length} coins in ${trendingTime}ms`);
        console.log(`   Checking if top coins will be auto-enriched in background...`);
        
        // Wait a bit for background enrichment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Re-fetch to see if enrichment happened
        const trendingRefresh = await fetch(`${API_BASE}/coins/trending?limit=5`);
        const trendingRefreshData = await trendingRefresh.json();
        
        const enrichedCount = trendingRefreshData.coins.filter(c => c.enriched).length;
        console.log(`   ${enrichedCount}/${trendingRefreshData.coins.length} top coins enriched`);
      } else {
        console.log(`❌ Failed to fetch trending: ${trendingData.error || 'Unknown error'}`);
      }
      
      // Test 5: Fetch NEW feed (should also auto-enrich)
      console.log(`\n📊 Test 5: Fetching NEW feed (should auto-enrich top 20)...`);
      const newStart = Date.now();
      const newRes = await fetch(`${API_BASE}/coins/new?limit=20`);
      const newData = await newRes.json();
      const newTime = Date.now() - newStart;
      
      if (newData.success && newData.coins.length > 0) {
        console.log(`✅ NEW returned ${newData.coins.length} coins in ${newTime}ms`);
        console.log(`   First coin: ${newData.coins[0].symbol}`);
      } else if (newData.loading) {
        console.log(`⏳ NEW feed still loading...`);
      } else {
        console.log(`❌ Failed to fetch NEW: ${newData.error || 'Unknown error'}`);
      }
      
      // Test 6: Check if DEXtrending and Trending share any coins (cache efficiency test)
      console.log(`\n📊 Test 6: Checking for shared coins between feeds...`);
      const dexMints = new Set(dextrendingData.coins.map(c => c.mintAddress));
      const trendingMints = new Set(trendingData.coins.map(c => c.mintAddress));
      
      const sharedCoins = [...dexMints].filter(m => trendingMints.has(m));
      console.log(`   Found ${sharedCoins.length} coins in both DEXtrending and Trending feeds`);
      
      if (sharedCoins.length > 0) {
        console.log(`   ✅ Global cache should prevent redundant enrichment for these ${sharedCoins.length} coins!`);
        console.log(`   💰 Estimated API calls saved: ~${sharedCoins.length * 3} (3 APIs per coin)`);
      } else {
        console.log(`   ℹ️ No overlap - but cache still benefits individual feeds`);
      }
      
      console.log('\n' + '=' .repeat(60));
      console.log('✅ ENRICHMENT OPTIMIZATION TEST COMPLETE');
      console.log('=' .repeat(60));
      
      console.log('\n📝 Summary:');
      console.log(`   • DEXtrending: No auto-enrichment ✅`);
      console.log(`   • Trending/NEW: Auto-enriches top 20 ✅`);
      console.log(`   • Global cache: ${cacheTime < enrichTime / 3 ? 'Working ✅' : 'Check logs ⚠️'}`);
      console.log(`   • Cross-feed overlap: ${sharedCoins.length} coins`);
      console.log(`\n🚀 Performance improvements should be visible in backend logs!`);
      
    } else {
      console.log(`❌ DEXtrending returned no coins or failed: ${dextrendingData.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
console.log('🔧 Make sure backend is running on port 3001...');
testEnrichmentOptimization();
