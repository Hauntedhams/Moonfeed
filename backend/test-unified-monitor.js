#!/usr/bin/env node
/**
 * Test the unified Solana token monitor
 * Tests both Pump.fun and Birdeye fallback
 */

const WebSocket = require('ws');

const TEST_TOKEN_GRADUATED = 'G6z381aCFjKMzt6SbNXMVFZrzK1cjCuQnQBVEZH23nQ3'; // Should use Birdeye
const TEST_TOKEN_PUMPFUN = '68juafUzrfoshWb2QFCkGHoPAErmhmxxn19BrTkPzHB6'; // Should use Pump.fun (if still active)

console.log('🧪 Testing Unified Solana Token Monitor\n');

function testToken(tokenAddress, expectedMonitor) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${tokenAddress}`);
    console.log(`Expected monitor: ${expectedMonitor}`);
    console.log(`${'='.repeat(60)}\n`);

    const ws = new WebSocket('ws://localhost:3001/ws/price');
    let messageCount = 0;

    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      
      // Subscribe to token
      ws.send(JSON.stringify({
        type: 'subscribe',
        token: tokenAddress
      }));
      
      console.log(`📤 Sent subscription request for ${tokenAddress.substring(0, 8)}...`);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messageCount++;
        
        console.log(`\n📨 Message ${messageCount}:`);
        console.log(`   Type: ${message.type}`);
        
        if (message.type === 'error') {
          console.log(`   ❌ Error: ${message.message}`);
          ws.close();
          resolve({ success: false, error: message.message });
        }
        
        if (message.type === 'connected') {
          console.log(`   ✅ WebSocket handshake complete`);
        }
        
        if (message.type === 'subscribed') {
          console.log(`   ✅ Subscribed to ${message.token.substring(0, 8)}...`);
          console.log(`   ⏳ Waiting for price updates...`);
        }
        
        if (message.type === 'price_update') {
          console.log(`   💰 Price Update Received!`);
          console.log(`   Token: ${message.token.substring(0, 8)}...`);
          console.log(`   Price: $${message.data.price.toFixed(8)}`);
          console.log(`   Source: ${message.data.source}`);
          console.log(`   DEX: ${message.data.dex}`);
          
          console.log(`\n✅ SUCCESS! Received price data from ${message.data.source}`);
          
          if (message.data.source === expectedMonitor) {
            console.log(`   ✅ Correct monitor used: ${expectedMonitor}`);
          } else {
            console.log(`   ⚠️  Different monitor: expected ${expectedMonitor}, got ${message.data.source}`);
          }
          
          ws.close();
          resolve({ success: true, source: message.data.source });
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve({ success: false, error: error.message });
    });

    ws.on('close', () => {
      console.log('\n🔌 Connection closed');
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('\n⏱️  Timeout - no price updates received');
        console.log('   This might mean:');
        console.log('   1. Token has no trading activity');
        console.log('   2. Monitor connection issue');
        console.log('   3. Token is invalid');
        ws.close();
        resolve({ success: false, error: 'Timeout' });
      }
    }, 15000);
  });
}

async function runTests() {
  console.log('Test 1: Graduated Token (should use Birdeye)');
  const result1 = await testToken(TEST_TOKEN_GRADUATED, 'birdeye');
  
  console.log('\n\n⏳ Waiting 3 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('Test 2: Pump.fun Token (should use Pump.fun or Birdeye)');
  const result2 = await testToken(TEST_TOKEN_PUMPFUN, 'pumpfun');
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Test 1 (Graduated): ${result1.success ? '✅ PASS' : '❌ FAIL'} ${result1.source ? `(${result1.source})` : ''}`);
  console.log(`Test 2 (Pump.fun): ${result2.success ? '✅ PASS' : '❌ FAIL'} ${result2.source ? `(${result2.source})` : ''}`);
  console.log('='.repeat(60));
  
  process.exit(0);
}

runTests().catch(console.error);
