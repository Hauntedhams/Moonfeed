#!/usr/bin/env node

/**
 * Quick test to verify server starts and health endpoint responds
 * Run: node backend/test-health-check.js
 */

const http = require('http');

const PORT = process.env.PORT || 10000;
const MAX_WAIT = 30000; // 30 seconds max
const CHECK_INTERVAL = 1000; // Check every second

console.log('🧪 Testing server health check...\n');
console.log(`Testing on port ${PORT}`);
console.log(`Max wait time: ${MAX_WAIT}ms`);
console.log(`Check interval: ${CHECK_INTERVAL}ms\n`);

// Start the server
console.log('🚀 Starting server...');
const server = require('./server');

let attempts = 0;
const maxAttempts = MAX_WAIT / CHECK_INTERVAL;

const checkHealth = () => {
  attempts++;
  console.log(`📊 Health check attempt ${attempts}/${maxAttempts}...`);
  
  const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS! Health check passed!');
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Response Time: ${attempts * CHECK_INTERVAL}ms`);
        console.log(`Response:`, JSON.parse(data));
        process.exit(0);
      } else {
        console.log(`❌ Failed with status: ${res.statusCode}`);
        if (attempts >= maxAttempts) {
          console.log('\n❌ TIMEOUT! Server did not respond within 30 seconds');
          process.exit(1);
        }
        setTimeout(checkHealth, CHECK_INTERVAL);
      }
    });
  });
  
  req.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      console.log(`⏳ Server not ready yet... (${err.code})`);
    } else {
      console.log(`❌ Error: ${err.message}`);
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n❌ TIMEOUT! Server did not start within 30 seconds');
      process.exit(1);
    }
    
    setTimeout(checkHealth, CHECK_INTERVAL);
  });
  
  req.end();
};

// Wait 1 second for server to start, then begin checking
setTimeout(() => {
  console.log('\n🔍 Starting health checks...\n');
  checkHealth();
}, 1000);
