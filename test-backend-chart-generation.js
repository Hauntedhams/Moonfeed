/**
 * Test Backend Chart Data Generation
 * Verifies that coins are enriched with pre-generated Clean chart data
 */

const fetch = require('node-fetch');

async function testChartDataGeneration() {
  console.log('🧪 Testing Backend Chart Data Generation\n');
  console.log('Waiting 3 seconds for enrichment to complete...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const response = await fetch('http://localhost:3001/api/coins/trending?limit=5');
    const data = await response.json();
    
    if (!data.coins || data.coins.length === 0) {
      console.log('❌ No coins returned from API');
      return;
    }
    
    console.log(`✅ Fetched ${data.coins.length} coins\n`);
    console.log('=' .repeat(70));
    
    data.coins.forEach((coin, index) => {
      console.log(`\n📊 Coin ${index + 1}: ${coin.symbol} (${coin.name})`);
      console.log(`Mint: ${coin.mintAddress}`);
      console.log(`Price: $${coin.price_usd || coin.priceUsd || 'N/A'}`);
      
      // Check for price changes (in nested dexscreener object)
      const priceChanges = coin.dexscreener?.priceChanges || coin.priceChanges || {};
      console.log(`\nPrice Changes:`);
      console.log(`  5m:  ${priceChanges.change5m !== undefined ? priceChanges.change5m + '%' : 'N/A'}`);
      console.log(`  1h:  ${priceChanges.change1h !== undefined ? priceChanges.change1h + '%' : 'N/A'}`);
      console.log(`  6h:  ${priceChanges.change6h !== undefined ? priceChanges.change6h + '%' : 'N/A'}`);
      console.log(`  24h: ${priceChanges.change24h !== undefined ? priceChanges.change24h + '%' : 'N/A'}`);
      
      // Check if dexscreener data exists
      if (coin.dexscreener) {
        console.log(`✅ Has dexscreener enrichment data`);
      }
      
      // Check for Clean chart data
      if (coin.cleanChartData) {
        console.log(`\n✅ HAS CLEAN CHART DATA:`);
        console.log(`  Data Points: ${coin.cleanChartData.dataPoints?.length || 0}`);
        console.log(`  Anchors: ${coin.cleanChartData.anchors?.length || 0}`);
        console.log(`  Timeframe: ${coin.cleanChartData.timeframe || 'N/A'}`);
        console.log(`  Generated: ${coin.cleanChartData.generated ? new Date(coin.cleanChartData.generated).toLocaleTimeString() : 'N/A'}`);
        
        if (coin.cleanChartData.dataPoints && coin.cleanChartData.dataPoints.length > 0) {
          const firstPrice = coin.cleanChartData.dataPoints[0].price;
          const lastPrice = coin.cleanChartData.dataPoints[coin.cleanChartData.dataPoints.length - 1].price;
          const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
          console.log(`  Price Range: $${firstPrice.toFixed(8)} → $${lastPrice.toFixed(8)} (${priceChange.toFixed(2)}%)`);
        }
        
        if (coin.cleanChartData.anchors && coin.cleanChartData.anchors.length > 0) {
          console.log(`  Anchor Times:`, coin.cleanChartData.anchors.map(a => `${a.hoursAgo}h`).join(', '));
        }
      } else {
        console.log(`\n⚠️  NO CLEAN CHART DATA - needs enrichment`);
      }
      
      console.log('\n' + '-'.repeat(70));
    });
    
    // Summary
    const enrichedCount = data.coins.filter(c => c.cleanChartData).length;
    const totalCount = data.coins.length;
    
    console.log(`\n\n📊 SUMMARY`);
    console.log('=' .repeat(70));
    console.log(`Total Coins: ${totalCount}`);
    console.log(`With Chart Data: ${enrichedCount}`);
    console.log(`Without Chart Data: ${totalCount - enrichedCount}`);
    console.log(`Enrichment Rate: ${((enrichedCount / totalCount) * 100).toFixed(1)}%`);
    
    if (enrichedCount === totalCount) {
      console.log(`\n✅ SUCCESS! All coins have pre-generated chart data!`);
    } else if (enrichedCount > 0) {
      console.log(`\n⚠️  PARTIAL: Some coins enriched, others still processing`);
    } else {
      console.log(`\n❌ FAILED: No coins have chart data yet - enrichment may not be working`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChartDataGeneration();
