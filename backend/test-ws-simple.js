/**
 * Simple WebSocket test - no compression
 */

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001/ws/price', {
  perMessageDeflate: false // Explicitly disable compression on client too
});

ws.on('open', () => {
  console.log('✅ Connected!');
  
  // Subscribe to BONK
  const msg = {
    type: 'subscribe',
    token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  };
  
  console.log('📤 Sending:', msg);
  ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Disconnected');
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Test timeout');
  ws.close();
}, 30000);
