/**
 * Test Direct DexScreener Enrichment
 * Directly tests the enrichment process for a single token
 */

const dexscreenerService = require('./backend/dexscreenerService');

async function testDirectEnrichment() {
  console.log('🧪 Testing Direct DexScreener Enrichment\n');
  
  // Test coin (PumpScreen)
  const testCoin = {
    mintAddress: '9LRTJXYpzu6B2VvDV5MMDsc9Hpdseps4hecJJcbdQknZ',
    symbol: 'PumpScreen',
    name: 'PumpScreener',
    price_usd: 0.007305025245290705
  };
  
  console.log(`📊 Original Coin:`, {
    symbol: testCoin.symbol,
    price: testCoin.price_usd,
    hasPriceChanges: !!testCoin.priceChanges,
    hasCleanChartData: !!testCoin.cleanChartData
  });
  
  console.log('\n🔄 Enriching with DexScreener...\n');
  
  try {
    const enrichedCoins = await dexscreenerService.enrichCoins([testCoin], {
      useBatchApi: true,
      batchSize: 1,
      maxToEnrich: 1,
      forceBannerEnrichment: true
    });
    
    const enriched = enrichedCoins[0];
    
    console.log('\n✅ Enrichment Complete!\n');
    console.log('=' .repeat(70));
    console.log(`📊 Enriched Coin: ${enriched.symbol}`);
    console.log(`Price: $${enriched.price_usd}`);
    console.log(`Enriched: ${enriched.enriched ? '✅' : '❌'}`);
    console.log(`Banner: ${enriched.banner ? '✅' : '❌'}`);
    
    // Check for dexscreener object
    if (enriched.dexscreener) {
      console.log(`\n📈 DexScreener Data:`, {
        hasPriceChanges: !!enriched.dexscreener.priceChanges,
        hasTransactions: !!enriched.dexscreener.transactions,
        hasVolumes: !!enriched.dexscreener.volumes
      });
      
      if (enriched.dexscreener.priceChanges) {
        console.log(`\nPrice Changes:`);
        console.log(`  5m:  ${enriched.dexscreener.priceChanges.change5m}%`);
        console.log(`  1h:  ${enriched.dexscreener.priceChanges.change1h}%`);
        console.log(`  6h:  ${enriched.dexscreener.priceChanges.change6h}%`);
        console.log(`  24h: ${enriched.dexscreener.priceChanges.change24h}%`);
      }
    } else {
      console.log(`\n❌ NO dexscreener object`);
    }
    
    // Check for cleanChartData
    if (enriched.cleanChartData) {
      console.log(`\n📊 Clean Chart Data:`);
      console.log(`  Data Points: ${enriched.cleanChartData.dataPoints?.length}`);
      console.log(`  Anchors: ${enriched.cleanChartData.anchors?.length}`);
      console.log(`  Timeframe: ${enriched.cleanChartData.timeframe}`);
      
      if (enriched.cleanChartData.dataPoints && enriched.cleanChartData.dataPoints.length > 0) {
        const firstPrice = enriched.cleanChartData.dataPoints[0].price;
        const lastPrice = enriched.cleanChartData.dataPoints[enriched.cleanChartData.dataPoints.length - 1].price;
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
        
        console.log(`\n  Price Trend:`);
        console.log(`    Start (24h ago): $${firstPrice.toFixed(8)}`);
        console.log(`    End (now):       $${lastPrice.toFixed(8)}`);
        console.log(`    Change:          ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);
        console.log(`    Direction:       ${priceChange > 0 ? '📈 UP' : '📉 DOWN'}`);
        
        // Show first few and last few points
        console.log(`\n  First 3 points:`);
        enriched.cleanChartData.dataPoints.slice(0, 3).forEach((point, i) => {
          console.log(`    ${i}: $${point.price.toFixed(8)}`);
        });
        
        console.log(`\n  Last 3 points:`);
        enriched.cleanChartData.dataPoints.slice(-3).forEach((point, i) => {
          const index = enriched.cleanChartData.dataPoints.length - 3 + i;
          console.log(`    ${index}: $${point.price.toFixed(8)}`);
        });
      }
    } else {
      console.log(`\n❌ NO cleanChartData`);
    }
    
    console.log('\n' + '='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testDirectEnrichment();
