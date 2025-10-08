const PriceHistoryService = require('./priceHistoryService');

async function testAllTimeframes() {
  const tokenAddress = 'KounQV6YhTgWFHbs4wNjyRp2VoY4ghoysveNQeGuBLV';
  const timeframes = ['1m', '15m', '1h', '4h', '24h'];
  
  console.log('🚀 Testing All Timeframes for Token');
  console.log('Token Address:', tokenAddress);
  console.log('Timeframes:', timeframes.join(', '));
  console.log('='.repeat(80));
  
  for (const timeframe of timeframes) {
    try {
      console.log(`\n📊 TESTING TIMEFRAME: ${timeframe.toUpperCase()}`);
      console.log('='.repeat(50));
      
      const startTime = Date.now();
      const chartData = await PriceHistoryService.getChartData(tokenAddress, timeframe);
      const fetchTime = Date.now() - startTime;
      
      console.log(`\n🪙 Token: ${chartData.tokenInfo.symbol} (${chartData.tokenInfo.name})`);
      console.log(`💰 Current Price: $${chartData.current}`);
      console.log(`📈 24h Change: ${chartData.change24h > 0 ? '+' : ''}${chartData.change24h}%`);
      console.log(`🔄 Fetch Time: ${fetchTime}ms`);
      
      console.log(`\n📉 Data Points: ${chartData.dataPoints.length}`);
      
      if (chartData.dataPoints.length >= 10) {
        console.log('\n✅ First 10 Price Points:');
        chartData.dataPoints.slice(0, 10).forEach((point, i) => {
          const date = new Date(point.time);
          const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          console.log(`    ${(i + 1).toString().padStart(2, '0')}. ${timeStr}: $${point.price.toFixed(8)}`);
        });
        
        if (chartData.dataPoints.length > 10) {
          console.log(`\n📊 Additional ${chartData.dataPoints.length - 10} points available...`);
          
          // Show last few points too
          console.log('\n🔚 Last 3 Price Points:');
          chartData.dataPoints.slice(-3).forEach((point, i) => {
            const date = new Date(point.time);
            const timeStr = date.toLocaleString('en-US', {
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            const index = chartData.dataPoints.length - 3 + i + 1;
            console.log(`    ${index.toString().padStart(2, '0')}. ${timeStr}: $${point.price.toFixed(8)}`);
          });
        }
        
        // Price statistics
        const prices = chartData.dataPoints.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const priceRange = ((maxPrice - minPrice) / minPrice * 100);
        
        console.log('\n📊 Price Statistics:');
        console.log(`    Min: $${minPrice.toFixed(8)}`);
        console.log(`    Max: $${maxPrice.toFixed(8)}`);
        console.log(`    Avg: $${avgPrice.toFixed(8)}`);
        console.log(`    Range: ${priceRange.toFixed(2)}%`);
        
        // Time range
        const firstTime = new Date(chartData.dataPoints[0].time);
        const lastTime = new Date(chartData.dataPoints[chartData.dataPoints.length - 1].time);
        console.log(`\n⏱️  Time Range: ${firstTime.toLocaleString()} to ${lastTime.toLocaleString()}`);
        
      } else {
        console.log(`\n❌ Only ${chartData.dataPoints.length} data points available (need at least 10)`);
        
        if (chartData.dataPoints.length > 0) {
          console.log('\nAvailable points:');
          chartData.dataPoints.forEach((point, i) => {
            const date = new Date(point.time);
            const timeStr = date.toLocaleString();
            console.log(`    ${i + 1}. ${timeStr}: $${point.price.toFixed(8)}`);
          });
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error testing timeframe ${timeframe}:`, error.message);
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
    }
    
    console.log('\n' + '-'.repeat(50));
  }
  
  console.log('\n🎉 All timeframe tests completed!');
}

// Test cache performance
async function testCachePerformance() {
  const tokenAddress = 'KounQV6YhTgWFHbs4wNjyRp2VoY4ghoysveNQeGuBLV';
  
  console.log('\n🔄 Testing Cache Performance...');
  console.log('='.repeat(40));
  
  // First call (should fetch from API)
  console.log('First call (API fetch):');
  const start1 = Date.now();
  await PriceHistoryService.getChartData(tokenAddress, '1h');
  const time1 = Date.now() - start1;
  console.log(`  Time: ${time1}ms`);
  
  // Second call (should use cache)
  console.log('Second call (cache):');
  const start2 = Date.now();
  await PriceHistoryService.getChartData(tokenAddress, '1h');
  const time2 = Date.now() - start2;
  console.log(`  Time: ${time2}ms`);
  
  console.log(`Cache speedup: ${(time1 / time2).toFixed(1)}x faster`);
}

// Run all tests
if (require.main === module) {
  testAllTimeframes()
    .then(() => testCachePerformance())
    .then(() => {
      console.log('\n✅ All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Tests failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testAllTimeframes, testCachePerformance };
