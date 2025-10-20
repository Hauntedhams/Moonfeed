/**
 * Test Script: Dexscreener Trending API
 * Tests the new DEXtrending feed functionality
 */

const fetch = require('node-fetch');

async function testDexscreenerTrendingAPI() {
  console.log('🔥 Testing Dexscreener Trending API...\n');
  
  try {
    console.log('📡 Fetching from: https://api.dexscreener.com/token-boosts/top/v1');
    
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: {
        'User-Agent': 'Moonfeed/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ API Response received: ${data.length} tokens\n`);
    
    // Filter for Solana tokens
    const solanaTokens = data.filter(item => item.chainId === 'solana');
    console.log(`🌙 Solana tokens: ${solanaTokens.length}/${data.length}\n`);
    
    // Show first 5 Solana tokens
    console.log('📊 First 5 Solana Trending Tokens:\n');
    solanaTokens.slice(0, 5).forEach((item, index) => {
      const token = item.token || {};
      const pair = item.pairs?.[0] || {};
      
      console.log(`${index + 1}. ${token.symbol || 'UNKNOWN'}`);
      console.log(`   Name: ${token.name || 'Unknown'}`);
      console.log(`   Address: ${item.tokenAddress || token.address}`);
      console.log(`   Price: $${pair.priceUsd || '0'}`);
      console.log(`   Market Cap: $${pair.marketCap ? Number(pair.marketCap).toLocaleString() : '0'}`);
      console.log(`   Liquidity: $${pair.liquidity?.usd ? Number(pair.liquidity.usd).toLocaleString() : '0'}`);
      console.log(`   24h Volume: $${pair.volume?.h24 ? Number(pair.volume.h24).toLocaleString() : '0'}`);
      console.log(`   Boost Amount: ${item.amount || 0}`);
      console.log('');
    });
    
    console.log('✅ Dexscreener Trending API test successful!');
    console.log(`\n📌 Summary:`);
    console.log(`   Total tokens: ${data.length}`);
    console.log(`   Solana tokens: ${solanaTokens.length}`);
    console.log(`   Expected in feed: ~${solanaTokens.length} tokens`);
    
  } catch (error) {
    console.error('❌ Error testing Dexscreener API:', error.message);
    console.error('\nFull error:', error);
  }
}

async function testBackendEndpoint() {
  console.log('\n\n🔧 Testing Backend DEXtrending Endpoint...\n');
  
  try {
    console.log('📡 Fetching from: http://localhost:3001/api/coins/dextrending');
    
    const response = await fetch('http://localhost:3001/api/coins/dextrending');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ Backend Response:`, {
      success: data.success,
      count: data.count,
      total: data.total,
      firstCoin: data.coins?.[0]?.symbol
    });
    
    console.log('\n📊 First 3 coins from backend:');
    data.coins?.slice(0, 3).forEach((coin, index) => {
      console.log(`${index + 1}. ${coin.symbol}`);
      console.log(`   Name: ${coin.name}`);
      console.log(`   Price: $${coin.price_usd}`);
      console.log(`   Market Cap: $${coin.market_cap_usd?.toLocaleString()}`);
      console.log('');
    });
    
    console.log('✅ Backend endpoint test successful!');
    
  } catch (error) {
    console.error('❌ Error testing backend endpoint:', error.message);
    console.error('Make sure backend server is running on port 3001');
  }
}

// Run tests
async function runTests() {
  await testDexscreenerTrendingAPI();
  await testBackendEndpoint();
}

runTests();
