/**
 * Test Solana Pool Monitor with real token
 */

const WebSocket = require('ws');

// Use BONK token (definitely has a pool)
const TEST_TOKEN = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK

console.log('🧪 Testing Solana Pool Monitor with BONK...\n');

const ws = new WebSocket('ws://localhost:3001/ws/price', {
  perMessageDeflate: false
});

let updateCount = 0;

ws.on('open', () => {
  console.log('✅ Connected to /ws/price');
  
  // Subscribe to BONK
  console.log(`📤 Subscribing to ${TEST_TOKEN}...\n`);
  ws.send(JSON.stringify({
    type: 'subscribe',
    token: TEST_TOKEN
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  switch (msg.type) {
    case 'connected':
      console.log('✅ Handshake complete');
      break;
      
    case 'subscribed':
      console.log(`✅ Subscribed to ${msg.token}`);
      console.log('⏳ Waiting for price updates (swap activity)...\n');
      break;
      
    case 'price_update':
      updateCount++;
      console.log(`📊 Price Update #${updateCount}:`);
      console.log(`   Token: ${msg.token.substring(0, 8)}...`);
      console.log(`   Price: $${msg.data.price.toFixed(8)}`);
      console.log(`   Liquidity: $${msg.data.liquidity.toLocaleString()}`);
      console.log(`   DEX: ${msg.data.dex}`);
      console.log(`   Time: ${new Date(msg.data.timestamp).toLocaleTimeString()}\n`);
      
      if (updateCount >= 3) {
        console.log('✅ Received 3 price updates - TEST PASSED!');
        ws.close();
      }
      break;
      
    case 'error':
      console.error('❌ Error:', msg.message);
      break;
      
    default:
      console.log('📨 Unknown message:', msg.type);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 Disconnected');
  process.exit(updateCount >= 1 ? 0 : 1);
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('\n⏱️  Test timeout (60s)');
  if (updateCount > 0) {
    console.log(`✅ Received ${updateCount} price updates - partial success`);
    process.exit(0);
  } else {
    console.log('❌ No price updates received');
    process.exit(1);
  }
}, 60000);
