#!/usr/bin/env node
/**
 * Test Birdeye WebSocket connection directly from backend
 * This verifies Birdeye is working independently
 */

const WebSocket = require('ws');

const BIRDEYE_API_KEY = '29e047952f0d45ed8927939bbc08f09c';
const BIRDEYE_WS_URL = 'wss://public-api.birdeye.so/socket/solana';
const TEST_TOKEN = 'G6z381aCFjKMzt6SbNXMVFZrzK1cjCuQnQBVEZH23nQ3';

console.log('🧪 Testing Birdeye WebSocket connection directly\n');

const ws = new WebSocket(
  `${BIRDEYE_WS_URL}?x-api-key=${BIRDEYE_API_KEY}`,
  {
    headers: {
      'Origin': 'https://birdeye.so',
      'User-Agent': 'Mozilla/5.0'
    },
    protocol: 'echo-protocol'
  }
);

let messageCount = 0;

ws.on('open', () => {
  console.log('✅ Connected to Birdeye WebSocket\n');
  
  // Subscribe to price updates
  const subMsg = {
    type: 'SUBSCRIBE_PRICE',
    data: {
      address: TEST_TOKEN,
      chainId: 'solana'
    }
  };
  
  console.log('📤 Subscribing to price updates:');
  console.log(JSON.stringify(subMsg, null, 2));
  ws.send(JSON.stringify(subMsg));
  
  // Request current price
  setTimeout(() => {
    const priceMsg = {
      type: 'PRICE',
      data: {
        address: TEST_TOKEN
      }
    };
    
    console.log('\n📤 Requesting current price:');
    console.log(JSON.stringify(priceMsg, null, 2));
    ws.send(JSON.stringify(priceMsg));
  }, 1000);
});

ws.on('message', (data) => {
  messageCount++;
  console.log(`\n📨 Message ${messageCount}:`);
  
  try {
    const message = JSON.parse(data.toString());
    console.log(JSON.stringify(message, null, 2));
    
    if (message.type === 'PRICE' || message.type === 'PRICE_UPDATE') {
      console.log('\n✅ SUCCESS! Received price data from Birdeye');
      console.log(`   Price: $${message.data?.value || 'N/A'}`);
      
      // Close after first price update
      setTimeout(() => {
        console.log('\n🔌 Closing connection');
        ws.close();
        process.exit(0);
      }, 1000);
    }
  } catch (error) {
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('\n❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 Connection closed: ${code} ${reason}`);
  if (messageCount === 0) {
    console.log('⚠️  No messages received');
    process.exit(1);
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('\n⏱️  Timeout - closing connection');
    console.log(`   Received ${messageCount} messages total`);
    ws.close();
    process.exit(messageCount > 0 ? 0 : 1);
  }
}, 10000);
