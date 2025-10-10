#!/usr/bin/env node

/**
 * Trigger Manual Trending Feed Refresh
 * 
 * This script sends an HTTP request to the backend to manually trigger
 * a trending feed refresh with the new optimized parameters.
 * 
 * The auto-refresh will continue running every 24 hours in the background.
 */

const http = require('http');

const PORT = process.env.PORT || 3001;

console.log('🚀 Triggering manual trending feed refresh...');
console.log(`📡 Sending request to localhost:${PORT}/api/admin/refresh-trending`);

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/api/admin/refresh-trending',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\n✅ Response Status: ${res.statusCode}`);
    console.log('📦 Response Body:', data);
    
    if (res.statusCode === 200) {
      console.log('\n🎉 Manual trending refresh triggered successfully!');
      console.log('⏰ Auto-refresh will continue every 24 hours');
    } else {
      console.log('\n❌ Failed to trigger refresh');
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Error:', error.message);
  console.log('\n💡 Make sure the backend server is running on port', PORT);
});

req.end();
