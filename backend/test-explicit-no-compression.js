/**
 * Test with explicit compression headers
 */

const WebSocket = require('ws');

// Connect WITHOUT any compression negotiation
const ws = new WebSocket('ws://localhost:3001/ws/price');

let isConnected = false;

ws.on('open', () => {
  console.log('✅ Connected!');
  console.log('Extensions negotiated:', ws.extensions);
  isConnected = true;
  
  // Send simple ping first
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 Received:', msg.type);
  
  if (msg.type === 'connected' && isConnected) {
    console.log('Sending subscribe message...');
    ws.send(JSON.stringify({
      type: 'subscribe',
      token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    }));
  }
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Disconnected: ${code} - ${reason}`);
  process.exit(0);
});

setTimeout(() => {
  console.log('\n⏱️  Test timeout');
  ws.close();
}, 10000);
