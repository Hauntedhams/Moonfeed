/**
 * Test the /api/coins/graduating endpoint with Moralis integration
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testGraduatingEndpoint() {
  console.log('\n🧪 Testing /api/coins/graduating endpoint\n');
  console.log('=' .repeat(80));
  
  try {
    console.log(`\n📡 Calling ${API_BASE}/api/coins/graduating\n`);
    
    const response = await fetch(`${API_BASE}/api/coins/graduating?limit=10`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received\n');
    console.log('Response structure:');
    console.log(`  success: ${data.success}`);
    console.log(`  count: ${data.count}`);
    console.log(`  total: ${data.total}`);
    console.log(`  timestamp: ${data.timestamp}`);
    
    console.log('\nCriteria:');
    console.log(`  source: ${data.criteria?.source}`);
    console.log(`  status: ${data.criteria?.status}`);
    console.log(`  sorting: ${data.criteria?.sorting}`);
    console.log(`  updateFrequency: ${data.criteria?.updateFrequency}`);
    
    if (data.coins && data.coins.length > 0) {
      console.log(`\n✅ Received ${data.coins.length} coins\n`);
      console.log('-'.repeat(80));
      console.log('\n🏆 Top 3 Graduating Coins:\n');
      
      data.coins.slice(0, 3).forEach((coin, i) => {
        console.log(`${i + 1}. ${coin.symbol} (${coin.name})`);
        console.log(`   Address: ${coin.mint || coin.address}`);
        console.log(`   Progress: ${coin.bondingCurveProgress?.toFixed(2) || coin.bondingProgress?.toFixed(2)}%`);
        console.log(`   Price: $${coin.price?.toFixed(8) || 'N/A'}`);
        console.log(`   Liquidity: $${coin.liquidity?.toLocaleString() || 'N/A'}`);
        console.log(`   Source: ${coin.source || coin.apiProvider}`);
        console.log('');
      });
      
      // Check data quality
      console.log('-'.repeat(80));
      console.log('\n📊 Data Quality Check:\n');
      
      const firstCoin = data.coins[0];
      const checks = {
        'Has mint/address': !!(firstCoin.mint || firstCoin.address),
        'Has symbol': !!firstCoin.symbol,
        'Has name': !!firstCoin.name,
        'Has price': firstCoin.price !== undefined,
        'Has bonding progress': !!(firstCoin.bondingCurveProgress || firstCoin.bondingProgress),
        'Has liquidity': firstCoin.liquidity !== undefined,
        'Is Pump.fun': firstCoin.isPumpFun === true,
        'Has status': firstCoin.status === 'graduating'
      };
      
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`);
      });
      
      const allPassed = Object.values(checks).every(v => v);
      
      console.log('\n' + '='.repeat(80));
      if (allPassed) {
        console.log('\n✅ ENDPOINT TEST PASSED!\n');
        console.log('The Moralis integration is working correctly.');
        console.log('The graduating feed will now use Moralis instead of BitQuery.');
      } else {
        console.log('\n⚠️ ENDPOINT TEST INCOMPLETE\n');
        console.log('Some data fields are missing. Check the output above.');
      }
      console.log('\n' + '='.repeat(80));
      
    } else {
      console.log('\n⚠️ No coins returned from endpoint');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the backend server is running on port 3001');
      console.log('   Run: npm run dev (in backend folder)');
    }
  }
}

console.log('\n🚀 GRADUATING ENDPOINT TEST (Moralis Integration)');
console.log('=' .repeat(80));
console.log(`Test Date: ${new Date().toISOString()}`);
console.log(`Target: ${API_BASE}/api/coins/graduating`);
console.log('=' .repeat(80));

testGraduatingEndpoint().then(() => {
  console.log('\n✅ Test complete!\n');
}).catch(err => {
  console.error('\n❌ Test failed:', err);
});
