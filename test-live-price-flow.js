#!/usr/bin/env node

/**
 * Live Price Flow Diagnostic
 * Tests the complete flow from Jupiter API → WebSocket → Frontend
 */

const WebSocket = require('ws');
const axios = require('axios');

console.log('🧪 LIVE PRICE FLOW DIAGNOSTIC\n');
console.log('This will test:');
console.log('1. Jupiter API response for a sample coin');
console.log('2. WebSocket connection to backend');
console.log('3. Live price broadcasts from backend\n');

// Test coin (use a popular one that's definitely in DEXtrending)
const TEST_COIN_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC for testing

async function testJupiterAPI() {
  console.log('📡 Step 1: Testing Jupiter API...');
  try {
    const response = await axios.get(
      `https://lite-api.jup.ag/price/v3?ids=${TEST_COIN_ADDRESS}`,
      {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MoonFeed/1.0'
        }
      }
    );

    if (response.data && response.data[TEST_COIN_ADDRESS]) {
      const price = response.data[TEST_COIN_ADDRESS].usdPrice;
      console.log(`✅ Jupiter API working: USDC = $${price}`);
      return true;
    } else {
      console.log('❌ No price data in Jupiter response');
      return false;
    }
  } catch (error) {
    console.log('❌ Jupiter API error:', error.message);
    return false;
  }
}

async function testWebSocket() {
  console.log('\n🔌 Step 2: Testing WebSocket connection...');
  
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    let receivedPriceUpdate = false;
    
    const timeout = setTimeout(() => {
      if (!receivedPriceUpdate) {
        console.log('⚠️  No Jupiter price update received in 15 seconds');
        console.log('   This could mean:');
        console.log('   - Backend is not broadcasting Jupiter prices');
        console.log('   - Jupiter Live Price Service is not running');
        console.log('   - No coins are being tracked');
      }
      ws.close();
      resolve(receivedPriceUpdate);
    }, 15000);

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`📨 Received message type: ${message.type}`);
        
        if (message.type === 'jupiter-prices-update') {
          receivedPriceUpdate = true;
          console.log(`✅ Jupiter price update received!`);
          console.log(`   Coins in update: ${message.data?.length || 0}`);
          if (message.data && message.data.length > 0) {
            const sample = message.data[0];
            console.log(`   Sample: ${sample.symbol} = $${sample.price}`);
          }
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      } catch (error) {
        console.error('Error parsing message:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      resolve(false);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket disconnected');
    });
  });
}

async function testBackendStatus() {
  console.log('\n📊 Step 3: Checking backend status...');
  try {
    const response = await axios.get('http://localhost:3001/api/trending', {
      timeout: 5000
    });
    
    console.log(`✅ Backend is running`);
    console.log(`   Trending coins: ${response.data.length}`);
    
    // Check if coins have proper data
    if (response.data.length > 0) {
      const sample = response.data[0];
      console.log(`   Sample coin: ${sample.symbol}`);
      console.log(`   Has price: ${!!sample.price_usd}`);
      console.log(`   Has mintAddress: ${!!sample.mintAddress}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ Backend error:', error.message);
    return false;
  }
}

async function main() {
  const jupiterOK = await testJupiterAPI();
  const backendOK = await testBackendStatus();
  const wsOK = await testWebSocket();
  
  console.log('\n📋 SUMMARY:');
  console.log(`Jupiter API: ${jupiterOK ? '✅' : '❌'}`);
  console.log(`Backend API: ${backendOK ? '✅' : '❌'}`);
  console.log(`WebSocket Prices: ${wsOK ? '✅' : '❌'}`);
  
  if (jupiterOK && backendOK && wsOK) {
    console.log('\n✅ All systems operational!');
    console.log('   Live prices should be updating in the frontend.');
    console.log('   If prices are not updating in the UI, check browser console for errors.');
  } else {
    console.log('\n⚠️  Some systems are not working correctly.');
    console.log('   Please check the logs above for details.');
  }
}

main().catch(console.error);
