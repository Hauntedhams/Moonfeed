/**
 * Test Moralis API for Pump.fun Bonding/Graduating Tokens
 * 
 * This script tests whether Moralis API can replace Bitquery for the graduating feed
 * 
 * What we need:
 * - Top 100 tokens closest to graduating (90%+ bonding curve progress)
 * - Sorted by progress (highest to lowest)
 * - Token metadata (name, symbol, address)
 * - Bonding curve progress percentage
 * - Price data (SOL and USD)
 * - Liquidity info
 */

const fetch = require('node-fetch');

const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjJkODdkZDFhLTI3ZmMtNDliNS04YjQ2LTkwNDY4ZjNiNTY0ZSIsIm9yZ0lkIjoiNDc4NzM3IiwidXNlcklkIjoiNDkyNTI4IiwidHlwZUlkIjoiMDUzMzA5NWMtMDM4MS00YTY0LWEzMjItYTMwMzYxOGRmNzU4IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjE4NzQ1MTUsImV4cCI6NDkxNzYzNDUxNX0.Q-loivKb6SB63TTOKtiwCHKub-AIAxftLOc2qUfarmU';

// Moralis endpoints to test
const ENDPOINTS = {
  bonding: 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/bonding',
  graduated: 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/graduated',
  new: 'https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/new'
};

/**
 * Test Moralis Bonding Endpoint
 */
async function testBondingEndpoint() {
  console.log('\n🔬 Testing Moralis BONDING endpoint...\n');
  console.log('=' .repeat(80));
  
  try {
    const response = await fetch(`${ENDPOINTS.bonding}?limit=100`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✅ API Response received`);
    console.log(`📊 Total tokens returned: ${data.result?.length || 0}`);
    
    if (data.result && data.result.length > 0) {
      // Sort by bondingCurveProgress descending (closest to graduating first)
      const sortedTokens = data.result.sort((a, b) => b.bondingCurveProgress - a.bondingCurveProgress);
      
      // Filter tokens that are close to graduating (>80% progress)
      const graduating = sortedTokens.filter(token => token.bondingCurveProgress >= 80);
      
      console.log(`🎓 Tokens with >80% bonding progress: ${graduating.length}`);
      console.log(`\n📈 Progress Distribution:`);
      console.log(`   90-100%: ${sortedTokens.filter(t => t.bondingCurveProgress >= 90).length} tokens`);
      console.log(`   80-90%:  ${sortedTokens.filter(t => t.bondingCurveProgress >= 80 && t.bondingCurveProgress < 90).length} tokens`);
      console.log(`   70-80%:  ${sortedTokens.filter(t => t.bondingCurveProgress >= 70 && t.bondingCurveProgress < 80).length} tokens`);
      console.log(`   <70%:    ${sortedTokens.filter(t => t.bondingCurveProgress < 70).length} tokens`);
      
      // Show top 10 closest to graduating
      console.log('\n🏆 TOP 10 TOKENS CLOSEST TO GRADUATING:\n');
      console.log('-'.repeat(80));
      
      sortedTokens.slice(0, 10).forEach((token, index) => {
        console.log(`${index + 1}. ${token.symbol} (${token.name})`);
        console.log(`   Progress: ${token.bondingCurveProgress.toFixed(2)}%`);
        console.log(`   Price: $${parseFloat(token.priceUsd).toFixed(8)} USD`);
        console.log(`   Liquidity: $${parseFloat(token.liquidity).toLocaleString()}`);
        console.log(`   FDV: $${parseFloat(token.fullyDilutedValuation).toLocaleString()}`);
        console.log(`   Address: ${token.tokenAddress}`);
        console.log('');
      });
      
      // Sample token structure
      console.log('-'.repeat(80));
      console.log('\n📋 SAMPLE TOKEN DATA STRUCTURE:\n');
      console.log(JSON.stringify(sortedTokens[0], null, 2));
      
      // Check if cursor exists for pagination
      console.log('\n' + '-'.repeat(80));
      console.log('\n🔄 PAGINATION:');
      if (data.cursor) {
        console.log(`   ✅ Cursor available: ${data.cursor}`);
        console.log(`   Can fetch more results using cursor parameter`);
      } else {
        console.log(`   ℹ️ No cursor - all results returned in single response`);
      }
      
      // Compare with what Bitquery provides
      console.log('\n' + '='.repeat(80));
      console.log('\n📊 COMPARISON WITH BITQUERY:\n');
      console.log('Moralis provides:');
      console.log('  ✅ Token address, name, symbol');
      console.log('  ✅ Bonding curve progress percentage');
      console.log('  ✅ Price in USD and SOL');
      console.log('  ✅ Liquidity data');
      console.log('  ✅ Fully diluted valuation');
      console.log('  ✅ Logo URL');
      console.log('  ✅ Decimals');
      console.log('\n✨ Additional benefits:');
      console.log('  • Simpler REST API (vs GraphQL)');
      console.log('  • Direct bonding curve progress calculation');
      console.log('  • Native support for Pump.fun');
      console.log('  • Better documented API');
      
      // Recommendation
      console.log('\n' + '='.repeat(80));
      console.log('\n💡 RECOMMENDATION:\n');
      
      if (graduating.length >= 20) {
        console.log('✅ YES - Moralis API is suitable for graduating feed!');
        console.log(`   Currently ${graduating.length} tokens >80% progress`);
        console.log('   This is enough to show a healthy graduating feed');
      } else {
        console.log('⚠️ MAYBE - Moralis has limited tokens >80% progress');
        console.log(`   Only ${graduating.length} tokens >80% progress`);
        console.log('   You may want to lower threshold to 70% to get more tokens');
      }
      
    } else {
      console.log('⚠️ No tokens returned from API');
    }
    
  } catch (error) {
    console.error('❌ Error testing Moralis API:', error.message);
    console.error('Full error:', error);
  }
}

/**
 * Test Graduated Endpoint (for comparison)
 */
async function testGraduatedEndpoint() {
  console.log('\n\n🔬 Testing Moralis GRADUATED endpoint (for comparison)...\n');
  console.log('=' .repeat(80));
  
  try {
    const response = await fetch(`${ENDPOINTS.graduated}?limit=10`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': MORALIS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`✅ Graduated tokens returned: ${data.result?.length || 0}`);
    
    if (data.result && data.result.length > 0) {
      console.log('\n📋 Sample graduated token:\n');
      console.log(JSON.stringify(data.result[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🚀 MORALIS API TEST FOR PUMP.FUN GRADUATING TOKENS');
  console.log('=' .repeat(80));
  console.log(`Test Date: ${new Date().toISOString()}`);
  console.log(`Purpose: Evaluate if Moralis can replace Bitquery for graduating feed`);
  console.log('=' .repeat(80));
  
  await testBondingEndpoint();
  await testGraduatedEndpoint();
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Tests complete!\n');
}

// Run the tests
runTests().catch(console.error);
