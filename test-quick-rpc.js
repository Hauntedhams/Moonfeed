#!/usr/bin/env node
/**
 * Quick Test: Check if RPC WebSocket is working
 * Run this while your backend is running to test the connection
 */

const WebSocket = require('ws');

const TEST_TOKEN = {
  name: 'Test Token',
  // Use a well-known token that definitely has a pool
  mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF - definitely has pools
};

console.log('🧪 Quick RPC WebSocket Test\n');
console.log('Token:', TEST_TOKEN.name);
console.log('Mint:', TEST_TOKEN.mint);
console.log('\nConnecting to ws://localhost:3001/ws/price...\n');

const ws = new WebSocket('ws://localhost:3001/ws/price');
let priceUpdateCount = 0;

const timeout = setTimeout(() => {
  console.log('\n⏱️  30 second timeout - closing connection');
  console.log(`\n📊 Results: Received ${priceUpdateCount} price updates`);
  
  if (priceUpdateCount > 0) {
    console.log('✅ SUCCESS: RPC WebSocket is working!');
  } else {
    console.log('❌ FAILED: No price updates received');
    console.log('\nPossible issues:');
    console.log('1. Backend not finding the pool');
    console.log('2. RPC subscription not working');
    console.log('3. Token has no trading activity');
  }
  
  ws.close();
  process.exit(priceUpdateCount > 0 ? 0 : 1);
}, 30000);

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  console.log('📤 Subscribing to token...\n');
  
  ws.send(JSON.stringify({
    type: 'subscribe',
    token: TEST_TOKEN.mint
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  switch (message.type) {
    case 'connected':
      console.log('✅', message.message);
      break;
      
    case 'subscribed':
      console.log('✅ Subscribed successfully!');
      console.log('⏳ Waiting for price updates...\n');
      break;
      
    case 'price-update':
      priceUpdateCount++;
      console.log('📨 Received price update message:', JSON.stringify(message, null, 2));
      
      if (message.price && !isNaN(message.price)) {
        const time = new Date(message.timestamp).toLocaleTimeString();
        console.log(`💰 [${priceUpdateCount}] Price: $${message.price.toFixed(8)} at ${time}`);
        
        if (priceUpdateCount === 1) {
          console.log('   🎉 FIRST UPDATE RECEIVED! Real-time is working!\n');
        }
      } else {
        console.log('⚠️  Price update received but price is invalid:', message.price);
      }
      break;
      
    case 'error':
      console.error('❌ Error:', message.message);
      break;
      
    default:
      console.log('📨', message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  console.log('\nMake sure backend is running: cd backend && npm run dev');
  clearTimeout(timeout);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 Connection closed');
  clearTimeout(timeout);
});
