// Quick frontend test for custom filters
async function testCustomFilters() {
  console.log('🧪 Testing Custom Filters Frontend Integration');
  
  try {
    // Test the custom filter endpoint directly
    const testFilters = {
      minLiquidity: 50000,
      minMarketCap: 500000
    };
    
    console.log('🔍 Testing filter request:', testFilters);
    
    const response = await fetch('http://localhost:3001/api/coins/filtered', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testFilters)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Response received:', {
      success: data.success,
      count: data.count,
      firstCoin: data.coins?.[0] ? {
        symbol: data.coins[0].symbol,
        name: data.coins[0].name,
        liquidity: data.coins[0].liquidity_usd,
        marketCap: data.coins[0].market_cap_usd,
        price: data.coins[0].price_usd
      } : 'No coins'
    });
    
    // Test if coins have all required fields for display
    if (data.coins && data.coins.length > 0) {
      const testCoin = data.coins[0];
      const requiredFields = [
        'mintAddress', 'symbol', 'name', 'price_usd', 
        'market_cap_usd', 'liquidity_usd', 'volume_24h_usd'
      ];
      
      const missingFields = requiredFields.filter(field => 
        testCoin[field] === undefined || testCoin[field] === null
      );
      
      if (missingFields.length === 0) {
        console.log('✅ All required fields present for coin display');
      } else {
        console.log('⚠️ Missing fields:', missingFields);
      }
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Run the test
testCustomFilters();
