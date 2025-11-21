// Diagnostic script to check chart preloading behavior
const fetch = require('node-fetch');

async function checkChartPreloading() {
  console.log('🔍 CHART PRELOADING DIAGNOSTIC\n');
  console.log('=' .repeat(60));
  
  // Test trending endpoint
  console.log('\n📊 Testing /api/coins/trending endpoint...\n');
  
  const response = await fetch('http://localhost:3001/api/coins/trending?limit=5');
  const data = await response.json();
  
  console.log(`✅ Response received: ${data.coins.length} coins\n`);
  
  // Analyze each coin
  data.coins.forEach((coin, index) => {
    console.log(`\n🪙 Coin #${index + 1}: ${coin.symbol} (${coin.name})`);
    console.log(`   ├─ Has chartData: ${!!coin.chartData ? '✅ YES' : '❌ NO'}`);
    
    if (coin.chartData) {
      console.log(`   ├─ chartData length: ${coin.chartData.length} candles`);
      if (coin.chartData.length > 0) {
        const firstCandle = coin.chartData[0];
        const lastCandle = coin.chartData[coin.chartData.length - 1];
        console.log(`   ├─ First candle time: ${new Date(firstCandle[0] * 1000).toLocaleString()}`);
        console.log(`   ├─ Last candle time: ${new Date(lastCandle[0] * 1000).toLocaleString()}`);
        console.log(`   ├─ Price range: $${firstCandle[4]} → $${lastCandle[4]}`);
      }
    }
    
    console.log(`   ├─ Has pairAddress: ${!!coin.pairAddress ? '✅ YES' : '❌ NO'}`);
    console.log(`   ├─ Has poolAddress: ${!!coin.poolAddress ? '✅ YES' : '❌ NO'}`);
    
    const poolAddr = coin.pairAddress || coin.poolAddress || coin.address || 'N/A';
    console.log(`   └─ Pool/Pair Address: ${poolAddr.substring(0, 20)}...`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📈 SUMMARY:');
  const withChartData = data.coins.filter(c => c.chartData && c.chartData.length > 0).length;
  const withoutChartData = data.coins.length - withChartData;
  
  console.log(`   ✅ Coins WITH preloaded chartData: ${withChartData}/${data.coins.length}`);
  console.log(`   ❌ Coins WITHOUT chartData: ${withoutChartData}/${data.coins.length}`);
  
  if (withChartData === data.coins.length) {
    console.log('\n   🎉 ALL COINS HAVE PRELOADED CHART DATA!');
    console.log('   → Frontend should render charts instantly without API calls');
  } else if (withChartData > 0) {
    console.log('\n   ⚠️  PARTIAL SUCCESS - Some coins are missing chart data');
    console.log('   → Frontend will need to fetch data for coins without chartData');
  } else {
    console.log('\n   ❌ NO PRELOADED DATA - Backend preloading may not be working');
    console.log('   → Frontend will fetch all chart data individually (rate limiting risk)');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

checkChartPreloading().catch(console.error);
