#!/usr/bin/env node

/**
 * Test Jupiter API V3 directly to see if it's working
 */

const axios = require('axios');

async function testJupiterAPI() {
  console.log('🧪 Testing Jupiter Price API V3...\n');
  
  // Test with a known token (SOL)
  const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
  
  try {
    console.log(`📡 Fetching price for SOL: ${SOL_ADDRESS}`);
    const response = await axios.get(
      `https://lite-api.jup.ag/price/v3?ids=${SOL_ADDRESS}`,
      {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MoonFeed/1.0'
        }
      }
    );
    
    console.log('✅ Response received');
    console.log('📊 Status:', response.status);
    console.log('📊 Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data[SOL_ADDRESS]) {
      const price = response.data[SOL_ADDRESS].usdPrice;
      console.log(`\n💰 SOL Price: $${price}`);
      console.log('✅ Jupiter API V3 is working correctly!\n');
    } else {
      console.log('❌ Unexpected response format');
      console.log('Full response:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testJupiterAPI();
