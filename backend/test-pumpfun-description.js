/**
 * Quick test to verify Pump.fun description fetching
 */

const pumpFunService = require('./services/pumpFunService');

async function testPumpFun() {
  console.log('🧪 Testing Pump.fun description fetching...\n');
  
  // Test with a known Pump.fun token (you can replace with actual mint addresses from your feed)
  const testAddresses = [
    'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC', // Example - replace with real ones
    '6nR8wBnfsmXfcdDr1hovJKjvFQxNSidN6XFyfAFZpump', // From your trending feed
  ];

  for (const address of testAddresses) {
    console.log(`\n📋 Testing ${address}...`);
    
    try {
      const description = await pumpFunService.getDescription(address);
      
      if (description) {
        console.log(`✅ Description found: "${description}"`);
      } else {
        console.log(`ℹ️ No description (token may not be from Pump.fun)`);
      }
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
  }

  console.log('\n✅ Test complete!');
  process.exit(0);
}

testPumpFun();
