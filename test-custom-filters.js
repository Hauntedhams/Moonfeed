#!/usr/bin/env node

// Quick test script to verify custom filters work end-to-end
const { exec } = require('child_process');

console.log('🧪 Testing Custom Filters End-to-End\n');

async function testEndpoint(testName, filters) {
  return new Promise((resolve, reject) => {
    const filterJson = JSON.stringify(filters);
    const curlCommand = `curl -s -X POST http://localhost:3001/api/coins/filtered -H "Content-Type: application/json" -d '${filterJson}'`;
    
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${testName}: FAILED`);
        console.log(`   Error: ${error.message}\n`);
        reject(error);
        return;
      }
      
      try {
        const response = JSON.parse(stdout);
        if (response.success && response.coins && response.coins.length > 0) {
          console.log(`✅ ${testName}: PASSED`);
          console.log(`   Returned ${response.coins.length} coins`);
          console.log(`   First coin: ${response.coins[0].symbol} (${response.coins[0].name})`);
          console.log(`   Liquidity: $${response.coins[0].liquidity_usd?.toLocaleString() || 'N/A'}`);
          console.log(`   Market Cap: $${response.coins[0].market_cap_usd?.toLocaleString() || 'N/A'}\n`);
        } else {
          console.log(`⚠️  ${testName}: NO RESULTS`);
          console.log(`   Response: ${response.success ? 'Success but no coins' : 'Failed'}\n`);
        }
        resolve(response);
      } catch (parseError) {
        console.log(`❌ ${testName}: PARSE ERROR`);
        console.log(`   Could not parse response: ${parseError.message}\n`);
        reject(parseError);
      }
    });
  });
}

async function runTests() {
  try {
    // Test 1: Empty filters (should return default results)
    await testEndpoint('Empty filters', {});
    
    // Test 2: Liquidity filter
    await testEndpoint('Liquidity filter (min $50K)', { minLiquidity: 50000 });
    
    // Test 3: Market cap filter
    await testEndpoint('Market cap filter (min $1M)', { minMarketCap: 1000000 });
    
    // Test 4: Volume filter
    await testEndpoint('Volume filter (min $25K)', { minVolume: 25000 });
    
    // Test 5: Multiple filters
    await testEndpoint('Combined filters', {
      minLiquidity: 30000,
      minMarketCap: 500000,
      minVolume: 20000
    });
    
    console.log('🎉 All tests completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Open http://localhost:5173 in your browser');
    console.log('2. Click the "Filters" button in the top-right corner');
    console.log('3. Set some filter values and click "Apply Filters"');
    console.log('4. Verify that it switches to the "Custom" tab');
    console.log('5. Check that filtered coins are displayed with all data (price, chart, banner, etc.)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
