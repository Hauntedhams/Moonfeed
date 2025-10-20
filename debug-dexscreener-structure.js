/**
 * Debug Script: Check actual Dexscreener API response structure
 */

const fetch = require('node-fetch');

async function debugDexscreenerAPI() {
  console.log('🔍 Debugging Dexscreener API Response Structure...\n');
  
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: {
        'User-Agent': 'Moonfeed/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Get first Solana token
    const firstSolana = data.find(item => item.chainId === 'solana');
    
    if (!firstSolana) {
      console.log('❌ No Solana tokens found');
      return;
    }
    
    console.log('📦 Full structure of first Solana token:\n');
    console.log(JSON.stringify(firstSolana, null, 2));
    
    console.log('\n\n📊 Available top-level fields:');
    console.log(Object.keys(firstSolana));
    
    console.log('\n\n📊 Token object fields (if exists):');
    if (firstSolana.token) {
      console.log(Object.keys(firstSolana.token));
    } else {
      console.log('❌ No token object');
    }
    
    console.log('\n\n📊 Pairs array (if exists):');
    if (firstSolana.pairs && firstSolana.pairs.length > 0) {
      console.log('First pair fields:', Object.keys(firstSolana.pairs[0]));
      console.log('\nFirst pair data:');
      console.log(JSON.stringify(firstSolana.pairs[0], null, 2));
    } else {
      console.log('❌ No pairs array');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDexscreenerAPI();
