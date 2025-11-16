#!/usr/bin/env node
/**
 * Test Hybrid Pool Monitor
 * Tests DEX → Pump.fun → Jupiter fallback
 */

const HybridPoolMonitor = require('./hybridPoolMonitor');
const WebSocket = require('ws');

// Test tokens
const TEST_TOKENS = {
  dex: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK (has DEX pool)
  pumpfun: '68juafUzrfoshWb2QFCkGHoPAErmhmxxn19BrTkPzHB6', // Probos (Pump.fun)
  // Add more test tokens here
};

console.log('🧪 Testing Hybrid Pool Monitor...\n');

async function test() {
  const monitor = new HybridPoolMonitor();
  
  try {
    // Connect
    console.log('📡 Connecting to Solana RPC...');
    await monitor.connect();
    console.log('✅ Connected\n');

    // Create mock WebSocket client
    const mockClient = {
      readyState: WebSocket.OPEN,
      send: (data) => {
        const message = JSON.parse(data);
        if (message.type === 'price_update') {
          console.log(`\n💰 Price Update for ${message.token.substring(0, 8)}...:`);
          console.log(`   Price: $${message.data.price.toFixed(8)}`);
          console.log(`   Source: ${message.data.source}`);
          console.log(`   Timestamp: ${new Date(message.data.timestamp).toLocaleTimeString()}`);
        }
      }
    };

    // Test DEX token
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 1: Token with DEX pool (BONK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      await monitor.subscribeToToken(TEST_TOKENS.dex, mockClient);
      console.log('✅ Subscribed to BONK');
    } catch (error) {
      console.error('❌ Failed to subscribe to BONK:', error.message);
    }

    // Wait for updates
    console.log('\n⏳ Waiting for price updates (15 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Test Pump.fun token
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Test 2: Pump.fun token (Probos)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    try {
      await monitor.subscribeToToken(TEST_TOKENS.pumpfun, mockClient);
      console.log('✅ Subscribed to Probos');
    } catch (error) {
      console.error('❌ Failed to subscribe to Probos:', error.message);
    }

    // Wait for updates
    console.log('\n⏳ Waiting for price updates (15 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    monitor.close();
    console.log('✅ Test complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    monitor.close();
    process.exit(1);
  }
}

test();
