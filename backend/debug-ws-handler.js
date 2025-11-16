/**
 * Debug - check which server handles /ws/price
 */

const http = require('http');
const express = require('express');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// Track upgrade events
server.on('upgrade', (req, socket, head) => {
  console.log('🔧 SERVER.upgrade event:', req.url);
});

// Create WebSocket server with noServer
const wss1 = new WebSocket.Server({ noServer: true });

wss1.on('connection', (ws) => {
  console.log('WSS1: Client connected');
  ws.send(JSON.stringify({ from: 'wss1' }));
  
  ws.on('message', (data) => {
    console.log('WSS1: Received:', data.toString());
  });
});

// Handle upgrade manually for /test1
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  console.log('Upgrade request for:', pathname);
  
  if (pathname === '/test1') {
    console.log('Handling /test1 with WSS1');
    delete req.headers['sec-websocket-extensions'];
    wss1.handleUpgrade(req, socket, head, (ws) => {
      wss1.emit('connection', ws, req);
    });
  }
});

// Create second WebSocket server with path
const wss2 = new WebSocket.Server({
  server,
  path: '/test2',
  perMessageDeflate: false
});

wss2.on('connection', (ws) => {
  console.log('WSS2: Client connected');
  ws.send(JSON.stringify({ from: 'wss2' }));
  
  ws.on('message', (data) => {
    console.log('WSS2: Received:', data.toString());
  });
});

server.listen(3003, () => {
  console.log('Debug server on port 3003');
  console.log('Connect to ws://localhost:3003/test1 or ws://localhost:3003/test2');
});
