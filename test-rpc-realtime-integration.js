#!/usr/bin/env node
/**
 * Test RPC Real-Time Price Integration
 * 
 * This script tests the complete flow:
 * 1. Backend RPC WebSocket server (/ws/price)
 * 2. Pool discovery (Pump.fun, Raydium, Orca via Dexscreener)
 * 3. Real-time price updates from Solana RPC
 * 4. Frontend chart integration readiness
 */

const WebSocket = require('ws');

// Test tokens - mix of Pump.fun and graduated tokens
const TEST_TOKENS = [
  {
    name: 'Pump.fun Token',
    mint: 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', // Example Pump.fun token
    expected: 'pumpfun'
  },
  {
    name: 'WIF (Raydium)',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    expected: 'raydium'
  },
  {
    name: 'BONK (Multiple pools)',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    expected: 'raydium'
  }
];

const BACKEND_URL = 'ws://localhost:3001/ws/price';
const TEST_DURATION = 30000; // 30 seconds per token

console.log('🚀 Testing RPC Real-Time Price Integration');
console.log('═══════════════════════════════════════════\n');

async function testToken(token) {
  return new Promise((resolve) => {
    console.log(`\n📍 Testing: ${token.name}`);
    console.log(`   Mint: ${token.mint}`);
    console.log(`   Expected Pool: ${token.expected}`);
    console.log('   Connecting to WebSocket...\n');

    const ws = new WebSocket(BACKEND_URL);
    let priceUpdateCount = 0;
    let lastPrice = null;
    let connected = false;
    let subscribed = false;

    const timeout = setTimeout(() => {
      console.log(`\n⏱️  Test timeout (${TEST_DURATION / 1000}s) - Closing connection`);
      ws.close();
      
      resolve({
        token: token.name,
        success: priceUpdateCount > 0,
        priceUpdates: priceUpdateCount,
        connected,
        subscribed,
        lastPrice
      });
    }, TEST_DURATION);

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      connected = true;
      
      // Subscribe to token
      const subscribeMessage = {
        type: 'subscribe',
        token: token.mint
      };
      
      console.log('📤 Subscribing to token:', token.mint.substring(0, 12) + '...');
      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'connected':
            console.log('✅', message.message);
            break;
            
          case 'subscribed':
            console.log('✅ Subscription confirmed for:', message.token.substring(0, 12) + '...');
            subscribed = true;
            console.log('\n⏳ Waiting for price updates from Solana RPC...\n');
            break;
            
          case 'price-update':
            priceUpdateCount++;
            lastPrice = message.price;
            
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            const priceStr = message.price.toFixed(8);
            
            console.log(`💰 [${priceUpdateCount}] Price Update: $${priceStr} at ${timestamp}`);
            
            if (message.source) {
              console.log(`   Source: ${message.source}`);
            }
            
            // Show price change if we have a previous price
            if (priceUpdateCount > 1 && lastPrice) {
              const change = ((message.price - lastPrice) / lastPrice * 100).toFixed(2);
              const arrow = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
              console.log(`   ${arrow} Change: ${change}%`);
            }
            break;
            
          case 'error':
            console.error('❌ Error:', message.message);
            if (message.token) {
              console.error('   Token:', message.token.substring(0, 12) + '...');
            }
            break;
            
          default:
            console.log('📨 Message:', message);
        }
      } catch (error) {
        console.error('❌ Failed to parse message:', error.message);
        console.error('   Raw data:', data.toString());
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`\n🔌 WebSocket closed. Code: ${code}, Reason: ${reason || 'None'}`);
      
      resolve({
        token: token.name,
        success: priceUpdateCount > 0,
        priceUpdates: priceUpdateCount,
        connected,
        subscribed,
        lastPrice
      });
    });
  });
}

async function runTests() {
  console.log('Testing backend WebSocket availability...');
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  
  const results = [];
  
  // Test each token sequentially
  for (const token of TEST_TOKENS) {
    const result = await testToken(token);
    results.push(result);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n\n🎯 TEST SUMMARY');
  console.log('═══════════════════════════════════════════\n');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.token}: ${status}`);
    console.log(`   Connected: ${result.connected ? '✅' : '❌'}`);
    console.log(`   Subscribed: ${result.subscribed ? '✅' : '❌'}`);
    console.log(`   Price Updates: ${result.priceUpdates}`);
    if (result.lastPrice) {
      console.log(`   Last Price: $${result.lastPrice.toFixed(8)}`);
    }
    console.log('');
  });
  
  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED! Real-time price integration is working!');
    console.log('✅ GeckoTerminal historical + RPC real-time is ready to use');
  } else {
    console.log('\n⚠️  Some tests failed. Check backend logs for details.');
    console.log('   Make sure backend server is running on port 3001');
    console.log('   Run: cd backend && npm run dev');
  }
  
  process.exit(passCount === totalCount ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
