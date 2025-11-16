/**
 * Test WebSocket client - force no compression by using different approach
 */

const WebSocket = require('ws');

// Create client with explicit options that prevent compression
const ws = new WebSocket('ws://localhost:3001/ws/price', {
  perMessageDeflate: false,
  maxPayload: 100 * 1024 * 1024,
  skipUTF8Validation: false
});

// Verify extensions after connection
ws.on('open', () => {
  console.log('✅ Connected!');
  console.log('Client extensions:', ws.extensions);
  console.log('Compression enabled:', ws._isServer ? 'N/A' : ws._extensions);
  
  // Try sending a ping first
  console.log('\n📤 Sending ping...');
  ws.send(JSON.stringify({ type: 'ping' }), { compress: false });
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 Received:', msg.type);
  
  if (msg.type === 'pong') {
    console.log('✅ Ping/pong successful!');
    console.log('\n📤 Sending subscribe...');
    ws.send(JSON.stringify({
      type: 'subscribe',
      token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    }), { compress: false });
  } else if (msg.type === 'subscribed') {
    console.log('✅ Successfully subscribed!');
    setTimeout(() => {
      ws.close();
    }, 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Disconnected: ${code} - ${reason}`);
  process.exit(code === 1000 ? 0 : 1);
});

setTimeout(() => {
  console.log('\n⏱️  Test timeout');
  ws.close();
}, 10000);
