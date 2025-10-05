// Simple test to verify the filter endpoint is working

async function testFilterEndpoint() {
  console.log('🧪 Testing custom filter endpoint...');
  
  const testFilters = {
    minLiquidity: 1000,
    maxLiquidity: 100000,
    minMarketCap: 50000,
    volumeTimeframe: '24h'
  };
  
  try {
    const response = await fetch('http://localhost:3001/api/coins/filtered', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testFilters)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Filter endpoint working!');
      console.log('- Coins returned:', data.count);
      console.log('- Source:', data.source);
      console.log('- Applied filters:', data.appliedFilters);
      
      if (data.coins && data.coins[0]) {
        console.log('- Sample coin:', {
          symbol: data.coins[0].symbol,
          liquidity: data.coins[0].liquidity_usd,
          marketCap: data.coins[0].market_cap_usd,
          volume: data.coins[0].volume_24h_usd
        });
      }
    } else {
      console.log('❌ Filter endpoint failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFilterEndpoint();
