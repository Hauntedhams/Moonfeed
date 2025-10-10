/**
 * Debug Clean Chart Generation for PumpScreen Token
 * Check if chart data points match expected price progression
 */

const fetch = require('node-fetch');

const TOKEN_ADDRESS = '9LRTJXYpzu6B2VvDV5MMDsc9Hpdseps4hecJJcbdQknZ';

async function debugChartGeneration() {
  console.log('🔍 Debugging Clean Chart Generation for PumpScreen\n');
  
  // Fetch from backend API
  const response = await fetch('http://localhost:3001/api/coins/trending?limit=50');
  const data = await response.json();
  
  const coin = data.coins.find(c => c.mintAddress === TOKEN_ADDRESS);
  
  if (!coin) {
    console.log('❌ Token not found in trending feed');
    return;
  }
  
  console.log('📊 Token:', coin.symbol);
  console.log('💰 Current Price:', coin.price_usd || coin.priceUsd);
  console.log('\n📈 DexScreener Price Changes:');
  console.log('  5m:  ', coin.priceChanges?.change5m || 'N/A');
  console.log('  1h:  ', coin.priceChanges?.change1h || 'N/A');
  console.log('  6h:  ', coin.priceChanges?.change6h || 'N/A');
  console.log('  24h: ', coin.priceChanges?.change24h || 'N/A');
  
  if (!coin.cleanChartData) {
    console.log('\n❌ No cleanChartData found - enrichment not complete');
    return;
  }
  
  console.log('\n🎯 Generated Anchors:');
  coin.cleanChartData.anchors.forEach((anchor, i) => {
    console.log(`  ${i + 1}. ${anchor.hoursAgo}h ago: $${anchor.price.toFixed(8)}`);
  });
  
  console.log('\n📊 Chart Data Points (sample):');
  const points = coin.cleanChartData.dataPoints;
  console.log(`  Total points: ${points.length}`);
  console.log(`\n  First 5 points (24h ago → 20h ago):`);
  points.slice(0, 5).forEach((p, i) => {
    const hoursAgo = 24 - i;
    console.log(`    ${hoursAgo}h ago: $${p.price.toFixed(8)}`);
  });
  
  console.log(`\n  Middle points (around 6h-1h ago):`);
  points.slice(18, 23).forEach((p, i) => {
    const hoursAgo = 6 - i;
    console.log(`    ${hoursAgo}h ago: $${p.price.toFixed(8)}`);
  });
  
  console.log(`\n  Last 5 points (4h ago → now):`);
  points.slice(-5).forEach((p, i) => {
    const hoursAgo = 4 - i;
    console.log(`    ${hoursAgo}h ago: $${p.price.toFixed(8)}`);
  });
  
  // Calculate trend
  const firstPrice = points[0].price;
  const lastPrice = points[points.length - 1].price;
  const change = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  console.log(`\n📈 Chart Trend:`);
  console.log(`  Start (24h ago):  $${firstPrice.toFixed(8)}`);
  console.log(`  End (now):        $${lastPrice.toFixed(8)}`);
  console.log(`  Change:           ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
  console.log(`  Expected Change:  +${coin.priceChanges?.change24h}%`);
  
  if (Math.abs(change - coin.priceChanges?.change24h) < 1) {
    console.log(`\n✅ Chart trend matches expected 24h change!`);
  } else {
    console.log(`\n⚠️  Chart trend DIFFERS from expected 24h change`);
  }
  
  // Check for spike at 1h
  const oneHourIndex = 23; // Should be index 23 (24h - 1h = 23)
  const oneHourPoint = points[oneHourIndex];
  console.log(`\n🔍 Checking for 1h spike:`);
  console.log(`  Expected 1h price: $${(coin.price_usd || coin.priceUsd) / (1 + coin.priceChanges?.change1h / 100).toFixed(8)}`);
  console.log(`  Chart at 1h ago:   $${oneHourPoint?.price.toFixed(8)}`);
}

debugChartGeneration().catch(e => console.error('Error:', e.message));
