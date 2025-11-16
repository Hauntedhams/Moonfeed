/**
 * Debug WebSocket Server compression settings
 */

const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();

const wss = new WebSocket.Server({ 
  server, 
  path: '/test',
  perMessageDeflate: false
});

console.log('Server compression config:', wss.options.perMessageDeflate);

wss.on('connection', (ws, req) => {
  console.log('✅ Client connected');
  console.log('Connection extensions:', req.headers['sec-websocket-extensions']);
  
  ws.send(JSON.stringify({ type: 'hello' }));
  
  ws.on('message', (data) => {
    console.log('📨 Received:', data.toString());
    ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
  });
  
  ws.on('error', (error) => {
    console.error('❌ WS Error:', error.message);
  });
});

server.listen(3002, () => {
  console.log('🚀 Test server running on port 3002');
});
