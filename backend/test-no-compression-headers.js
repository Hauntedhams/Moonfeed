/**
 * Test WebSocket client with NO compression request
 */

const http = require('http');
const crypto = require('crypto');

// Create WebSocket upgrade request WITHOUT compression extension
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/ws/price',
  headers: {
    'Connection': 'Upgrade',
    'Upgrade': 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
    // Explicitly NO Sec-WebSocket-Extensions header
  }
};

const req = http.request(options);

req.on('upgrade', (res, socket, head) => {
  console.log('✅ Upgraded to WebSocket');
  console.log('Server extensions:', res.headers['sec-websocket-extensions'] || 'none');
  
  // Send a simple ping frame
  const payload = JSON.stringify({ type: 'ping' });
  const frame = Buffer.alloc(6 + payload.length);
  
  // FIN + opcode 1 (text)
  frame[0] = 0x81;
  
  // Mask bit + payload length
  frame[1] = 0x80 | payload.length;
  
  // Masking key
  const mask = crypto.randomBytes(4);
  mask.copy(frame, 2);
  
  // Masked payload
  for (let i = 0; i < payload.length; i++) {
    frame[6 + i] = payload.charCodeAt(i) ^ mask[i % 4];
  }
  
  console.log('📤 Sending ping frame');
  socket.write(frame);
  
  socket.on('data', (data) => {
    console.log('📨 Received data:', data.length, 'bytes');
    // Parse WebSocket frame
    const opcode = data[0] & 0x0F;
    const length = data[1] & 0x7F;
    const payload = data.slice(2, 2 + length);
    console.log('Message:', payload.toString());
  });
  
  socket.on('error', (err) => {
    console.error('❌ Socket error:', err.message);
  });
  
  socket.on('close', () => {
    console.log('🔌 Socket closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.log('⏱️  Timeout, closing');
    socket.end();
  }, 5000);
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
  process.exit(1);
});

req.end();
