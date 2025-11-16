/**
 * Test Script: Verify Real-Time Price Updates
 * 
 * This script connects to the backend WebSocket and subscribes to a token
 * to verify that price updates are being sent correctly.
 */

const WebSocket = require('ws');

// Test with a known active token (replace with an actual token from your feed)
const TEST_TOKEN = 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB'; // World Liberty Financial USD

const WS_URL = 'ws://localhost:3001/ws/price';

console.log('🧪 Testing Real-Time Price WebSocket');
console.log('=====================================\n');
console.log('📍 WebSocket URL:', WS_URL);
console.log('🎯 Test Token:', TEST_TOKEN);
console.log('\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('📤 Subscribing to token...\n');
  
  ws.send(JSON.stringify({
    type: 'subscribe',
    token: TEST_TOKEN
  }));
  
  console.log('⏳ Waiting for price updates (will run for 30 seconds)...\n');
  
  // Auto-close after 30 seconds
  setTimeout(() => {
    console.log('\n⏰ Test complete - closing connection');
    ws.close();
  }, 30000);
});

let updateCount = 0;
let firstPrice = null;
let lastPrice = null;
let lastTimestamp = null;

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    console.log(`📨 [${new Date().toLocaleTimeString()}] Received:`, message.type);
    
    switch (message.type) {
      case 'connected':
        console.log('   ℹ️  Message:', message.message);
        break;
        
      case 'subscribed':
        console.log('   ✅ Subscribed to:', message.token);
        break;
        
      case 'price-update':
        updateCount++;
        const price = message.price;
        const timestamp = message.timestamp;
        
        if (!firstPrice) firstPrice = price;
        lastPrice = price;
        lastTimestamp = timestamp;
        
        const change = firstPrice ? ((price - firstPrice) / firstPrice * 100).toFixed(4) : 0;
        
        console.log(`   💰 Update #${updateCount}: $${price.toFixed(8)}`);
        console.log(`      Change: ${change}%`);
        console.log(`      Time: ${new Date(timestamp).toLocaleTimeString()}`);
        console.log(`      Source: ${message.source || 'unknown'}`);
        console.log('');
        break;
        
      case 'error':
        console.log('   ❌ Error:', message.message);
        break;
        
      default:
        console.log('   ⚠️  Unknown message type:', message);
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n');
  console.log('═════════════════════════════════════');
  console.log('📊 TEST RESULTS');
  console.log('═════════════════════════════════════');
  console.log(`Updates received: ${updateCount}`);
  if (updateCount > 0) {
    console.log(`First price: $${firstPrice.toFixed(8)}`);
    console.log(`Last price: $${lastPrice.toFixed(8)}`);
    const change = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(4);
    console.log(`Total change: ${change}%`);
    console.log(`Last update: ${new Date(lastTimestamp).toLocaleTimeString()}`);
    
    if (updateCount >= 5) {
      console.log('\n✅ SUCCESS: WebSocket is sending price updates!');
    } else {
      console.log('\n⚠️  WARNING: Only received', updateCount, 'updates (expected more)');
    }
  } else {
    console.log('\n❌ FAILED: No price updates received!');
    console.log('   Possible issues:');
    console.log('   - Token may not have an active pool');
    console.log('   - Backend RPC monitor may not be working');
    console.log('   - Token address may be incorrect');
  }
  console.log('═════════════════════════════════════\n');
  
  process.exit(0);
});
