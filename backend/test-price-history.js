const PriceHistoryService = require('./priceHistoryService');

async function testPriceHistory() {
  const tokenAddress = '9wK8yN6iz1ie5kEJkvZCTxyN1x5sTdNfx8yeMY8Ebonk';
  
  console.log('🚀 Testing Price History Service');
  console.log('Token Address:', tokenAddress);
  console.log('='.repeat(60));
  
  try {
    const chartData = await PriceHistoryService.getChartData(tokenAddress, '1h');
    
    console.log('\n📊 CHART DATA RESULTS:');
    console.log('='.repeat(40));
    
    console.log('\n🪙 Token Info:');
    console.log(`  Symbol: ${chartData.tokenInfo.symbol}`);
    console.log(`  Name: ${chartData.tokenInfo.name}`);
    console.log(`  Address: ${chartData.tokenInfo.address}`);
    
    console.log('\n💰 Price Data:');
    console.log(`  Current Price: $${chartData.current}`);
    console.log(`  24h Change: ${chartData.change24h > 0 ? '+' : ''}${chartData.change24h}%`);
    console.log(`  1h Change: ${chartData.change1h > 0 ? '+' : ''}${chartData.change1h}%`);
    console.log(`  6h Change: ${chartData.change6h > 0 ? '+' : ''}${chartData.change6h}%`);
    
    console.log('\n📈 Market Data:');
    console.log(`  24h Volume: $${chartData.volume24h.toLocaleString()}`);
    console.log(`  Market Cap: $${chartData.marketCap.toLocaleString()}`);
    
    console.log('\n📉 Chart Data Points:');
    console.log(`  Total Points: ${chartData.dataPoints.length}`);
    console.log(`  Time Range: ${new Date(chartData.dataPoints[0].time).toLocaleString()} to ${new Date(chartData.dataPoints[chartData.dataPoints.length - 1].time).toLocaleString()}`);
    
    // Show first and last few data points
    console.log('\n  First 3 points:');
    chartData.dataPoints.slice(0, 3).forEach((point, i) => {
      console.log(`    ${i + 1}. ${new Date(point.time).toLocaleString()}: $${point.price.toFixed(8)}`);
    });
    
    console.log('\n  Last 3 points:');
    chartData.dataPoints.slice(-3).forEach((point, i) => {
      const index = chartData.dataPoints.length - 3 + i + 1;
      console.log(`    ${index}. ${new Date(point.time).toLocaleString()}: $${point.price.toFixed(8)}`);
    });
    
    // Calculate some stats
    const prices = chartData.dataPoints.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    console.log('\n📊 Price Statistics:');
    console.log(`  Min Price: $${minPrice.toFixed(8)}`);
    console.log(`  Max Price: $${maxPrice.toFixed(8)}`);
    console.log(`  Avg Price: $${avgPrice.toFixed(8)}`);
    console.log(`  Price Range: ${((maxPrice - minPrice) / minPrice * 100).toFixed(2)}%`);
    
    // Test caching
    console.log('\n🔄 Testing Cache...');
    const startTime = Date.now();
    const cachedData = await PriceHistoryService.getChartData(tokenAddress, '1h');
    const cacheTime = Date.now() - startTime;
    console.log(`  Cache retrieval time: ${cacheTime}ms`);
    console.log(`  Cache working: ${cacheTime < 50 ? '✅ Yes' : '❌ No'}`);
    
    console.log('\n✅ Test completed successfully!');
    
    return chartData;
    
  } catch (error) {
    console.error('\n❌ Error testing price history:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testPriceHistory()
    .then(() => {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = testPriceHistory;
