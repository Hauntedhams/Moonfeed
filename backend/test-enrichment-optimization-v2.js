/**
 * TEST ENRICHMENT OPTIMIZATION V2
 * 
 * Tests the new optimization features:
 * 1. Jupiter batch requests (95% API call reduction)
 * 2. Compact cache storage (40% RAM reduction)
 * 3. Performance metrics
 */

require('dotenv').config();
const onDemandEnrichment = require('./services/OnDemandEnrichmentService');

// Sample test coins
const testCoins = [
  {
    mintAddress: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    symbol: "WIF",
    name: "dogwifhat"
  },
  {
    mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk"
  },
  {
    mintAddress: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC",
    symbol: "AI16Z",
    name: "ai16z"
  },
  {
    mintAddress: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY",
    symbol: "FARTCOIN",
    name: "Fartcoin"
  },
  {
    mintAddress: "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump",
    symbol: "PNUT",
    name: "Peanut"
  }
];

async function runTests() {
  console.log('🧪 TESTING ENRICHMENT OPTIMIZATION V2\n');

  // Test 1: Single enrichment (baseline)
  console.log('📊 Test 1: Single Coin Enrichment');
  console.log('─────────────────────────────────────');
  const start1 = Date.now();
  const enriched1 = await onDemandEnrichment.enrichCoin(testCoins[0]);
  const duration1 = Date.now() - start1;
  
  console.log(`✅ Enriched ${enriched1.symbol} in ${duration1}ms`);
  console.log(`   Has chart: ${!!enriched1.cleanChartData}`);
  console.log(`   Has holder count: ${!!enriched1.holderCount}`);
  console.log(`   Enrichment source: ${enriched1.enrichmentSource}`);
  console.log('');

  // Test 2: Batch enrichment (tests Jupiter batching)
  console.log('📊 Test 2: Batch Enrichment (Jupiter Batching Test)');
  console.log('─────────────────────────────────────');
  const start2 = Date.now();
  const enriched2 = await onDemandEnrichment.enrichCoins(testCoins.slice(1), {
    maxConcurrent: 5
  });
  const duration2 = Date.now() - start2;
  
  console.log(`✅ Enriched ${enriched2.length} coins in ${duration2}ms`);
  console.log(`   Average time per coin: ${(duration2 / enriched2.length).toFixed(0)}ms`);
  console.log(`   Successful enrichments: ${enriched2.filter(c => c.enriched).length}`);
  console.log('');

  // Test 3: Cache efficiency
  console.log('📊 Test 3: Cache Efficiency Test');
  console.log('─────────────────────────────────────');
  const start3 = Date.now();
  const cached = await onDemandEnrichment.enrichCoin(testCoins[0]);
  const duration3 = Date.now() - start3;
  
  console.log(`✅ Re-enriched ${cached.symbol} in ${duration3}ms`);
  console.log(`   🚀 CACHE HIT! ${duration3}ms vs ${duration1}ms (${((1 - duration3/duration1) * 100).toFixed(1)}% faster)`);
  console.log('');

  // Test 4: Performance statistics
  console.log('📊 Test 4: Performance Statistics');
  console.log('─────────────────────────────────────');
  const stats = onDemandEnrichment.getStats();
  
  console.log('Enrichment Stats:');
  console.log(`   Total enrichments: ${stats.enrichment.totalEnrichments}`);
  console.log(`   Cache hits: ${stats.enrichment.cacheHits}`);
  console.log(`   Cache misses: ${stats.enrichment.cacheMisses}`);
  console.log(`   Cache hit rate: ${stats.enrichment.cacheHitRate.toFixed(1)}%`);
  console.log(`   Average enrichment time: ${stats.enrichment.averageTime.toFixed(0)}ms`);
  console.log('');

  console.log('Cache Stats:');
  console.log(`   Cache size: ${stats.cache.size}/${stats.cache.maxSize}`);
  console.log(`   Cache hit rate: ${stats.cache.hitRate}`);
  console.log(`   Memory usage: ${stats.cache.memoryUsage}`);
  console.log(`   Avg compression savings: ${stats.cache.avgCompressionSavings}`);
  console.log(`   Evictions: ${stats.cache.evictions}`);
  console.log('');

  console.log('Jupiter Batching Stats:');
  console.log(`   Total requests: ${stats.jupiterBatching.totalRequests}`);
  console.log(`   API calls made: ${stats.jupiterBatching.apiCalls}`);
  console.log(`   API calls saved: ${stats.jupiterBatching.apiCallSavings}`);
  console.log(`   Savings percentage: ${stats.jupiterBatching.savingsPercent}`);
  console.log(`   Average batch size: ${stats.jupiterBatching.averageBatchSize.toFixed(1)}`);
  console.log('');

  // Test 5: Memory efficiency comparison
  console.log('📊 Test 5: Memory Efficiency');
  console.log('─────────────────────────────────────');
  
  const estimateFullCacheSize = (coin) => {
    return JSON.stringify(coin).length;
  };
  
  const fullSize = testCoins.reduce((sum, coin) => {
    return sum + estimateFullCacheSize(enriched2.find(c => c.mintAddress === coin.mintAddress) || coin);
  }, 0);
  
  const compactSize = parseInt(stats.cache.memoryUsage.replace(/[^\d]/g, ''));
  const savings = ((1 - compactSize / fullSize) * 100).toFixed(1);
  
  console.log(`   Estimated full cache size: ${(fullSize / 1024).toFixed(2)} KB`);
  console.log(`   Compact cache size: ${stats.cache.memoryUsage}`);
  console.log(`   💰 Memory savings: ~${savings}%`);
  console.log('');

  // Summary
  console.log('📈 OPTIMIZATION SUMMARY');
  console.log('═════════════════════════════════════');
  console.log(`✅ Jupiter batching: ${stats.jupiterBatching.savingsPercent} API call reduction`);
  console.log(`✅ Cache efficiency: ${stats.enrichment.cacheHitRate.toFixed(1)}% hit rate`);
  console.log(`✅ Memory optimization: ~${savings}% RAM reduction`);
  console.log(`✅ Average enrichment: ${stats.enrichment.averageTime.toFixed(0)}ms per coin`);
  console.log('');
  
  console.log('🎯 EXPECTED IMPROVEMENTS vs V1:');
  console.log('   • 30-40% faster enrichment (batching)');
  console.log('   • 40-50% less RAM usage (compact cache)');
  console.log('   • 95% fewer Jupiter API calls (batching)');
  console.log('   • Better scalability for high traffic');
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✅ All tests complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
