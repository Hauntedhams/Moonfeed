/**
 * Test script for Price WebSocket Server
 * 
 * This tests the complete flow:
 * 1. Connect to backend WebSocket server
 * 2. Subscribe to a token
 * 3. Receive price updates
 * 
 * Usage: node test-price-websocket.js [tokenAddress]
 */

const WebSocket = require('ws');

// Test token (BONK by default)
const TEST_TOKEN = process.argv[2] || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const WS_URL = 'ws://localhost:3001/ws/price';

console.log('🧪 Testing Price WebSocket Server');
console.log('================================\n');
console.log(`Token: ${TEST_TOKEN}`);
console.log(`Connecting to: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Subscribe to token
  console.log(`📊 Subscribing to token: ${TEST_TOKEN}\n`);
  ws.send(JSON.stringify({
    type: 'subscribe',
    token: TEST_TOKEN
  }));
  
  // Send ping every 10 seconds
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 10000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'connected':
        console.log('📡 Handshake:', message.message);
        break;
      
      case 'subscribed':
        console.log(`✅ Subscription confirmed for ${message.token}`);
        console.log('⏳ Waiting for price updates...\n');
        break;
      
      case 'price_update':
        console.log(`💰 Price Update:`, {
          token: message.token,
          price: message.data.price,
          timestamp: new Date(message.data.timestamp).toISOString(),
          volume: message.data.volume || 'N/A',
          liquidity: message.data.liquidity || 'N/A'
        });
        break;
      
      case 'pong':
        console.log('🏓 Pong received');
        break;
      
      case 'error':
        console.error('❌ Error:', message.message);
        if (message.token) {
          console.error(`   Token: ${message.token}`);
        }
        break;
      
      default:
        console.log('📨 Unknown message:', message);
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error.message);
    console.error('   Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('\n❌ WebSocket Error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket closed`);
  console.log(`   Code: ${code}`);
  console.log(`   Reason: ${reason || 'No reason provided'}`);
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping test...');
  
  if (ws.readyState === WebSocket.OPEN) {
    console.log('📤 Unsubscribing...');
    ws.send(JSON.stringify({
      type: 'unsubscribe',
      token: TEST_TOKEN
    }));
    
    setTimeout(() => {
      ws.close();
    }, 500);
  } else {
    ws.close();
  }
});

// Timeout after 30 seconds if no price updates
setTimeout(() => {
  console.log('\n⚠️  No price updates received after 30 seconds');
  console.log('   This may be normal if:');
  console.log('   - Token pool has no trading activity');
  console.log('   - Pool parser is not yet implemented (see REALTIME_PRICE_CHART_IMPLEMENTATION.md)');
  console.log('   - Token address is invalid\n');
  
  ws.close();
}, 30000);
