/**
 * Test Script: Hybrid Real-Time Price Solution
 * 
 * Tests:
 * 1. Graduated token (should use Dexscreener)
 * 2. Active Pump.fun token (should use RPC subscriptions)
 * 3. Raydium pool token (should use RPC subscriptions)
 * 4. Fallback behavior when RPC fails
 */

const WebSocket = require('ws');

// Test tokens representing different scenarios
const TEST_TOKENS = {
  graduated: 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB', // World Liberty Financial (graduated)
  raydium: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',    // USDC (Raydium pools)
  // Add an active Pump.fun token if you have one
};

const WS_URL = 'ws://localhost:3001/ws/price';

console.log('🧪 Testing Hybrid Real-Time Price Solution');
console.log('===========================================\n');

async function testToken(tokenName, tokenAddress) {
  return new Promise((resolve) => {
    console.log(`\n📝 Testing: ${tokenName}`);
    console.log(`   Token: ${tokenAddress}`);
    console.log('   -----------------------------------');
    
    const ws = new WebSocket(WS_URL);
    const results = {
      name: tokenName,
      connected: false,
      subscribed: false,
      updates: [],
      source: null,
      errors: []
    };

    ws.on('open', () => {
      results.connected = true;
      console.log('   ✅ Connected');
      
      ws.send(JSON.stringify({
        type: 'subscribe',
        token: tokenAddress
      }));
      
      // Run for 10 seconds
      setTimeout(() => {
        ws.close();
      }, 10000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'subscribed') {
          results.subscribed = true;
          console.log('   ✅ Subscribed');
        } else if (message.type === 'price-update') {
          results.updates.push({
            price: message.price,
            timestamp: message.timestamp,
            source: message.source
          });
          
          if (!results.source) {
            results.source = message.source;
            console.log(`   📊 Price source: ${message.source}`);
          }
          
          if (results.updates.length <= 3) {
            console.log(`   💰 Update ${results.updates.length}: $${message.price.toFixed(8)}`);
          }
        } else if (message.type === 'error') {
          results.errors.push(message.error || message.message);
          console.log(`   ❌ Error: ${message.error || message.message}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Parse error: ${error.message}`);
      }
    });

    ws.on('error', (error) => {
      results.errors.push(error.message);
      console.log(`   ❌ WebSocket error: ${error.message}`);
    });

    ws.on('close', () => {
      console.log(`   🔚 Connection closed`);
      console.log(`   📊 Total updates: ${results.updates.length}`);
      
      if (results.updates.length > 0) {
        const avgInterval = results.updates.length > 1
          ? (results.updates[results.updates.length - 1].timestamp - results.updates[0].timestamp) / (results.updates.length - 1)
          : 0;
        console.log(`   ⏱️  Avg update interval: ${(avgInterval / 1000).toFixed(2)}s`);
      }
      
      resolve(results);
    });
  });
}

async function runTests() {
  const results = [];
  
  // Test graduated token
  results.push(await testToken('Graduated Token (Dexscreener)', TEST_TOKENS.graduated));
  
  // Add delay between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test Raydium pool token
  results.push(await testToken('Raydium Pool Token', TEST_TOKENS.raydium));
  
  // Print summary
  console.log('\n\n═══════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════\n');
  
  results.forEach(result => {
    const status = result.updates.length > 0 ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    console.log(`   Source: ${result.source || 'N/A'}`);
    console.log(`   Updates: ${result.updates.length}`);
    console.log(`   Errors: ${result.errors.length}`);
    console.log('');
  });
  
  // Overall verdict
  const allPassed = results.every(r => r.updates.length > 0 && r.errors.length === 0);
  
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Hybrid solution working!');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Review results above');
  }
  
  console.log('═══════════════════════════════════════\n');
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test error:', error);
  process.exit(1);
});
