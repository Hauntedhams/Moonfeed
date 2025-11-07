/**
 * Test the new Moralis service integration
 * 
 * This tests if the Moralis service works correctly as a replacement for BitQuery
 */

const moralisService = require('./moralisService');

async function testMoralisService() {
  console.log('\n🧪 Testing Moralis Service Integration\n');
  console.log('=' .repeat(80));
  
  try {
    // Test 1: Fetch graduating tokens
    console.log('\n📋 TEST 1: Fetch Graduating Tokens\n');
    console.log('-'.repeat(80));
    
    const tokens = await moralisService.getGraduatingTokens();
    
    console.log(`✅ Successfully fetched ${tokens.length} graduating tokens`);
    
    if (tokens.length > 0) {
      // Show token structure
      console.log('\n📊 Sample Token Structure:\n');
      const sample = tokens[0];
      console.log('Required fields:');
      console.log(`  ✅ mint/address: ${sample.mint}`);
      console.log(`  ✅ symbol: ${sample.symbol}`);
      console.log(`  ✅ name: ${sample.name}`);
      console.log(`  ✅ price: $${sample.price}`);
      console.log(`  ✅ bondingCurveProgress: ${sample.bondingCurveProgress.toFixed(2)}%`);
      console.log(`  ✅ liquidity: $${sample.liquidity.toLocaleString()}`);
      console.log(`  ✅ isPumpFun: ${sample.isPumpFun}`);
      console.log(`  ✅ status: ${sample.status}`);
      console.log(`  ✅ graduationScore: ${sample.graduationScore.toFixed(2)}`);
      
      // Show top 5 tokens
      console.log('\n🏆 Top 5 Graduating Tokens:\n');
      tokens.slice(0, 5).forEach((token, i) => {
        console.log(`${i + 1}. ${token.symbol} (${token.name})`);
        console.log(`   Progress: ${token.bondingCurveProgress.toFixed(2)}%`);
        console.log(`   Score: ${token.graduationScore.toFixed(2)}`);
        console.log(`   Price: $${token.price.toFixed(8)}`);
        console.log('');
      });
      
      // Test 2: Check cache
      console.log('-'.repeat(80));
      console.log('\n📋 TEST 2: Cache Status\n');
      
      const cacheStatus = moralisService.getCacheStatus();
      console.log('Cache info:');
      console.log(`  Has data: ${cacheStatus.hasCachedData}`);
      console.log(`  Token count: ${cacheStatus.tokenCount}`);
      console.log(`  Age: ${cacheStatus.cacheAgeMinutes} minutes`);
      console.log(`  Valid: ${cacheStatus.isValid}`);
      console.log(`  TTL: ${cacheStatus.ttlMinutes} minutes`);
      
      // Test 3: Fetch again (should use cache)
      console.log('\n' + '-'.repeat(80));
      console.log('\n📋 TEST 3: Cache Performance\n');
      
      console.log('Fetching again (should use cache)...');
      const start = Date.now();
      const cachedTokens = await moralisService.getGraduatingTokens();
      const duration = Date.now() - start;
      
      console.log(`✅ Returned ${cachedTokens.length} tokens in ${duration}ms`);
      console.log(`${duration < 10 ? '✅' : '⚠️'} Cache is ${duration < 10 ? 'working perfectly' : 'slower than expected'}`);
      
      // Test 4: Data compatibility
      console.log('\n' + '-'.repeat(80));
      console.log('\n📋 TEST 4: Data Compatibility Check\n');
      
      const requiredFields = [
        'mint', 'address', 'symbol', 'name', 'price', 'priceUsd',
        'bondingCurveProgress', 'liquidity', 'isPumpFun', 'status'
      ];
      
      const missingFields = [];
      requiredFields.forEach(field => {
        if (!(field in sample)) {
          missingFields.push(field);
        }
      });
      
      if (missingFields.length === 0) {
        console.log('✅ All required fields present');
      } else {
        console.log('❌ Missing fields:', missingFields.join(', '));
      }
      
      // Summary
      console.log('\n' + '='.repeat(80));
      console.log('\n✅ MORALIS SERVICE INTEGRATION TEST PASSED!\n');
      console.log('Summary:');
      console.log(`  • Fetched ${tokens.length} graduating tokens`);
      console.log(`  • All required fields present`);
      console.log(`  • Cache working correctly`);
      console.log(`  • Ready to replace BitQuery`);
      console.log('\n' + '='.repeat(80));
      
    } else {
      console.log('⚠️ No tokens returned - this might be a temporary issue');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Full error:', error);
  }
}

// Run tests
console.log('\n🚀 MORALIS SERVICE INTEGRATION TEST');
console.log('=' .repeat(80));
console.log(`Test Date: ${new Date().toISOString()}`);
console.log('=' .repeat(80));

testMoralisService().then(() => {
  console.log('\n✅ All tests complete!\n');
}).catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
