#!/usr/bin/env node

/**
 * Test script to verify frontend is receiving and displaying Jupiter live prices
 */

const WebSocket = require('ws');

console.log('🔍 Testing WebSocket connection to verify Jupiter live price updates...');

const ws = new WebSocket('ws://localhost:3001/ws');

let messageCount = 0;
let jupiterMessages = 0;

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket server');
});

ws.on('message', function message(data) {
  messageCount++;
  
  try {
    const parsed = JSON.parse(data);
    console.log(`📨 Message ${messageCount}: ${parsed.type}`);
    
    if (parsed.type === 'jupiter-prices-update') {
      jupiterMessages++;
      console.log(`🪐 Jupiter price update #${jupiterMessages}:`);
      console.log(`   - ${parsed.data?.length || 0} coins updated`);
      
      if (parsed.data && parsed.data.length > 0) {
        // Show first 3 price updates
        parsed.data.slice(0, 3).forEach((update, i) => {
          console.log(`   ${i+1}. ${update.symbol}: $${update.price} (${update.priceChangeInstant?.toFixed(2) || '0.00'}%)`);
        });
      }
    } else if (parsed.type === 'initial') {
      console.log(`📊 Initial data: ${parsed.data?.coins?.length || 0} coins`);
      
      // Check if initial coins have Jupiter live prices
      if (parsed.data?.coins) {
        const jupiterCoins = parsed.data.coins.filter(coin => coin.priceSource === 'jupiter-live');
        console.log(`🪐 Initial coins with Jupiter live prices: ${jupiterCoins.length}`);
        
        if (jupiterCoins.length > 0) {
          console.log('   Sample Jupiter live prices:');
          jupiterCoins.slice(0, 3).forEach((coin, i) => {
            console.log(`   ${i+1}. ${coin.symbol}: $${coin.price || coin.currentPrice} (source: ${coin.priceSource})`);
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error.message);
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
  console.log(`📊 Total messages received: ${messageCount}`);
  console.log(`🪐 Jupiter price updates: ${jupiterMessages}`);
  
  if (jupiterMessages > 0) {
    console.log('✅ SUCCESS: Frontend WebSocket is receiving Jupiter live price updates!');
  } else {
    console.log('❌ ISSUE: No Jupiter price updates received');
  }
});

// Test for 15 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout - closing connection...');
  ws.close();
}, 15000);
