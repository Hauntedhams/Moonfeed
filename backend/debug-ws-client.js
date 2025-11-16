const WebSocket = require('ws');
const url = process.argv[2] || 'ws://localhost:3001/ws/price';
console.log('Connecting to', url);
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('OPEN');
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('error', (err) => {
  console.error('ERROR:', err && err.message ? err.message : err);
});

ws.on('close', (code, reason) => {
  console.log('CLOSE', code, reason && reason.toString());
  process.exit(0);
});

ws.on('message', (data) => {
  console.log('MSG', data.toString());
});
