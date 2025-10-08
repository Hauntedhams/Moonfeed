const axios = require('axios');

async function testJupiterAPI() {
  try {
    console.log('🧪 Testing Jupiter Price API...');
    
    // Test with your AOL token
    const aolAddress = '2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk';
    const solAddress = 'So11111111111111111111111111111111111111112';
    
    console.log(`🔍 Testing with AOL: ${aolAddress}`);
    
    // Try multiple approaches
    const endpoints = [
      `https://price.jup.ag/v6/price?ids=${aolAddress}`,
      `https://api.jup.ag/price/v2?ids=${aolAddress}`,
      `https://quote-api.jup.ag/v6/price?ids=${aolAddress}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔗 Trying endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, { 
          timeout: 15000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MoonFeed/1.0'
          }
        });
        
        console.log('✅ SUCCESS! Jupiter API Response:');
        console.log('Status:', response.status);
        console.log('Full Response Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data?.data) {
          Object.entries(response.data.data).forEach(([address, priceData]) => {
            console.log(`\n💰 AOL CURRENT PRICE DETAILS:`);
            console.log(`Address: ${address}`);
            console.log(`Price: $${priceData.price}`);
            console.log(`Full Price Data:`, JSON.stringify(priceData, null, 2));
          });
        } else if (response.data[aolAddress]) {
          console.log(`\n💰 AOL CURRENT PRICE DETAILS:`);
          console.log(`Address: ${aolAddress}`);
          console.log(`Price: $${response.data[aolAddress].price || response.data[aolAddress]}`);
          console.log(`Full Price Data:`, JSON.stringify(response.data[aolAddress], null, 2));
        } else {
          console.log('Response data structure:', Object.keys(response.data));
        }
        
        return; // Exit on first success
        
      } catch (endpointError) {
        console.error(`❌ Endpoint ${endpoint} failed:`, endpointError.message);
      }
    }
    
    console.log('\n❌ All endpoints failed');
    
  } catch (error) {
    console.error('❌ General error:', error.message);
  }
}

// Also test with curl-like approach
async function testWithAlternativeMethod() {
  try {
    console.log('\n🔄 Trying alternative approach...');
    
    const aolAddress = '2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk';
    
    // Try the exact endpoint format from Jupiter docs
    const response = await axios({
      method: 'GET',
      url: 'https://price.jup.ag/v6/price',
      params: {
        ids: aolAddress
      },
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MoonFeed/1.0',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Alternative method SUCCESS!');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Full Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Alternative method failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function runTests() {
  await testJupiterAPI();
  await testWithAlternativeMethod();
}

runTests();
