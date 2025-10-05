const fs = require('fs');

async function testFilterEndpoint() {
  try {
    console.log('🧪 Testing filter endpoint...');
    
    // Test 1: Health check
    console.log('\n1. Health check:');
    const healthResponse = await fetch('http://localhost:3001/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Backend is running:', healthData);
    } else {
      console.log('❌ Backend health check failed');
      return;
    }
    
    // Test 2: Test filtered endpoint
    console.log('\n2. Testing filtered endpoint:');
    const filterData = {
      minLiquidity: 1000,
      maxLiquidity: 50000,
      minMarketCap: 10000,
      volumeTimeframe: '24h'
    };
    
    console.log('🔍 Sending filter request:', filterData);
    
    const response = await fetch('http://localhost:3001/api/coins/filtered', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(filterData)
    });
    
    console.log('📥 Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Filter endpoint success:');
      console.log('- Success:', data.success);
      console.log('- Coins count:', data.count);
      console.log('- Total available:', data.total);
      console.log('- Source:', data.source);
      console.log('- Applied filters:', data.appliedFilters);
      console.log('- Sample coin:', data.coins?.[0]?.symbol || 'No coins');
    } else {
      const errorData = await response.text();
      console.log('❌ Filter endpoint failed:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFilterEndpoint();
