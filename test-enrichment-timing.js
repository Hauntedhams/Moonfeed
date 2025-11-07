/**
 * Test enrichment timing to identify bottlenecks
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testEnrichmentTiming() {
  console.log('🧪 Testing enrichment timing breakdown\n');
  
  // Test with a popular token
  const testToken = {
    mintAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    symbol: 'Bonk'
  };
  
  console.log(`Testing with ${testToken.symbol} (${testToken.mintAddress})\n`);
  
  // Run 3 enrichment tests
  for (let i = 1; i <= 3; i++) {
    console.log(`\n🔄 Test ${i}/3:`);
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/api/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testToken)
      });
      
      const totalTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        
        console.log(`✅ Total enrichment time: ${totalTime}ms`);
        console.log(`   Backend reported time: ${data.enrichmentTime}ms`);
        console.log(`   Network overhead: ${totalTime - data.enrichmentTime}ms`);
        console.log(`   Cached: ${data.cached ? 'Yes' : 'No'}`);
        console.log(`   Has chart: ${data.coin.cleanChartData ? 'Yes' : 'No'}`);
        console.log(`   Has rugcheck: ${data.coin.liquidityLocked !== undefined ? 'Yes' : 'No'}`);
        console.log(`   Has description: ${data.coin.description ? 'Yes' : 'No'}`);
      } else {
        console.log(`❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait 100ms between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n✅ Timing test complete');
}

testEnrichmentTiming().catch(console.error);
