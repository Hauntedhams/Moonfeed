const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3002/test', {
  perMessageDeflate: false
});

ws.on('open', () => {
  console.log('✅ Connected to debug server!');
  ws.send(JSON.stringify({ type: 'test', message: 'hello' }));
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 1000);
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('�� Disconnected');
  process.exit(0);
});

setTimeout(() => {
  console.log('⏱️  Timeout');
  ws.close();
  process.exit(0);
}, 5000);
