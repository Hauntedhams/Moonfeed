const axios = require('axios');

async function testJupiterV3API() {
  try {
    console.log('🧪 Testing Jupiter Price API V3...');
    
    // Test with your AOL token using the correct V3 endpoint
    const aolAddress = '2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk';
    const solAddress = 'So11111111111111111111111111111111111111112';
    
    console.log(`🔍 Testing AOL token: ${aolAddress}`);
    console.log(`📡 Using Jupiter V3 API: https://lite-api.jup.ag/price/v3`);
    
    const response = await axios.get(
      `https://lite-api.jup.ag/price/v3?ids=${aolAddress},${solAddress}`,
      { 
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MoonFeed/1.0'
        }
      }
    );
    
    console.log('✅ Jupiter V3 API Response:');
    console.log('Status:', response.status);
    console.log('Raw Response:', JSON.stringify(response.data, null, 2));
    
    // Parse the AOL price specifically
    if (response.data[aolAddress]) {
      const aolData = response.data[aolAddress];
      console.log('\n🪙 AOL TOKEN DETAILS:');
      console.log(`💰 Price: $${aolData.usdPrice}`);
      console.log(`📊 24h Change: ${aolData.priceChange24h?.toFixed(2)}%`);
      console.log(`🧮 Decimals: ${aolData.decimals}`);
      console.log(`🏗️ Block ID: ${aolData.blockId}`);
    } else {
      console.log('❌ AOL token not found in response');
    }
    
    // Parse SOL for comparison
    if (response.data[solAddress]) {
      const solData = response.data[solAddress];
      console.log('\n☀️ SOL TOKEN DETAILS:');
      console.log(`💰 Price: $${solData.usdPrice}`);
      console.log(`📊 24h Change: ${solData.priceChange24h?.toFixed(2)}%`);
    }
    
  } catch (error) {
    console.error('❌ Jupiter V3 API Test Failed:');
    console.error('Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Response:', error.response?.data);
  }
}

testJupiterV3API();
