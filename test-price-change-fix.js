/**
 * TEST: Price Change & Rugcheck Fix Verification
 * 
 * This script verifies that:
 * 1. DEXtrending coins have correct price change fields
 * 2. On-demand enrichment sets all required price change fields
 * 3. Rugcheck enrichment is consistent and properly marked
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testDextrendingPriceChanges() {
  console.log('\n🔥 TEST 1: DEXtrending Price Change Fields');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE}/coins/dextrending?limit=5`);
    const data = await response.json();
    
    if (!data.success || !data.coins || data.coins.length === 0) {
      console.log('❌ No DEXtrending coins available');
      return false;
    }
    
    console.log(`✅ Got ${data.coins.length} DEXtrending coins\n`);
    
    let allFieldsPresent = true;
    
    for (const coin of data.coins) {
      const hasFields = {
        price_change_24h: coin.price_change_24h !== undefined,
        change_24h: coin.change_24h !== undefined,
        change24h: coin.change24h !== undefined,
        priceChange24h: coin.priceChange24h !== undefined
      };
      
      const fieldCount = Object.values(hasFields).filter(v => v).length;
      const allPresent = fieldCount >= 3; // At least 3 of 4 fields
      
      console.log(`${allPresent ? '✅' : '❌'} ${coin.symbol}:`);
      console.log(`   price_change_24h: ${hasFields.price_change_24h ? coin.price_change_24h?.toFixed(2) + '%' : 'MISSING'}`);
      console.log(`   change_24h: ${hasFields.change_24h ? coin.change_24h?.toFixed(2) + '%' : 'MISSING'}`);
      console.log(`   change24h: ${hasFields.change24h ? coin.change24h?.toFixed(2) + '%' : 'MISSING'}`);
      console.log(`   priceChange24h: ${hasFields.priceChange24h ? coin.priceChange24h?.toFixed(2) + '%' : 'MISSING'}`);
      console.log('');
      
      if (!allPresent) allFieldsPresent = false;
    }
    
    return allFieldsPresent;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testEnrichedPriceChanges() {
  console.log('\n🎯 TEST 2: On-Demand Enrichment Price Change Fields');
  console.log('='.repeat(60));
  
  try {
    // Get a trending coin to test enrichment
    const trendingResponse = await fetch(`${API_BASE}/coins/trending?limit=1`);
    const trendingData = await trendingResponse.json();
    
    if (!trendingData.success || !trendingData.coins || trendingData.coins.length === 0) {
      console.log('❌ No trending coins available for testing');
      return false;
    }
    
    const testCoin = trendingData.coins[0];
    console.log(`Testing enrichment for: ${testCoin.symbol} (${testCoin.mintAddress})\n`);
    
    // Call enrichment endpoint
    const enrichResponse = await fetch(`${API_BASE}/coins/enrich-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        mintAddress: testCoin.mintAddress,
        coin: testCoin
      })
    });
    
    const enrichData = await enrichResponse.json();
    
    if (!enrichData.success || !enrichData.coin) {
      console.log('❌ Enrichment failed');
      return false;
    }
    
    const enrichedCoin = enrichData.coin;
    
    const hasFields = {
      price_change_24h: enrichedCoin.price_change_24h !== undefined,
      change_24h: enrichedCoin.change_24h !== undefined,
      change24h: enrichedCoin.change24h !== undefined,
      priceChange24h: enrichedCoin.priceChange24h !== undefined
    };
    
    const fieldCount = Object.values(hasFields).filter(v => v).length;
    const allPresent = fieldCount >= 3; // At least 3 of 4 fields
    
    console.log(`${allPresent ? '✅' : '❌'} Enriched ${enrichedCoin.symbol}:`);
    console.log(`   Enrichment time: ${enrichData.enrichmentTime}ms`);
    console.log(`   Cached: ${enrichData.cached ? 'Yes' : 'No'}`);
    console.log(`   price_change_24h: ${hasFields.price_change_24h ? enrichedCoin.price_change_24h?.toFixed(2) + '%' : 'MISSING'}`);
    console.log(`   change_24h: ${hasFields.change_24h ? enrichedCoin.change_24h?.toFixed(2) + '%' : 'MISSING'}`);
    console.log(`   change24h: ${hasFields.change24h ? enrichedCoin.change24h?.toFixed(2) + '%' : 'MISSING'}`);
    console.log(`   priceChange24h: ${hasFields.priceChange24h ? enrichedCoin.priceChange24h?.toFixed(2) + '%' : 'MISSING'}`);
    console.log('');
    
    return allPresent;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testRugcheckConsistency() {
  console.log('\n🔐 TEST 3: Rugcheck Enrichment Consistency');
  console.log('='.repeat(60));
  
  try {
    // Get multiple coins and enrich them
    const trendingResponse = await fetch(`${API_BASE}/coins/trending?limit=5`);
    const trendingData = await trendingResponse.json();
    
    if (!trendingData.success || !trendingData.coins || trendingData.coins.length === 0) {
      console.log('❌ No trending coins available for testing');
      return false;
    }
    
    console.log(`Testing rugcheck enrichment for ${trendingData.coins.length} coins\n`);
    
    let successCount = 0;
    let verifiedCount = 0;
    let failedCount = 0;
    
    for (const coin of trendingData.coins) {
      const enrichResponse = await fetch(`${API_BASE}/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mintAddress: coin.mintAddress,
          coin: coin
        })
      });
      
      const enrichData = await enrichResponse.json();
      
      if (enrichData.success && enrichData.coin) {
        successCount++;
        const enrichedCoin = enrichData.coin;
        
        if (enrichedCoin.rugcheckVerified === true) {
          verifiedCount++;
          console.log(`✅ ${enrichedCoin.symbol}: Rugcheck verified`);
          console.log(`   Liquidity Locked: ${enrichedCoin.liquidityLocked ? 'Yes' : 'No'} (${enrichedCoin.lockPercentage}%)`);
          console.log(`   Burn Percentage: ${enrichedCoin.burnPercentage}%`);
          console.log(`   Risk Level: ${enrichedCoin.riskLevel}`);
        } else if (enrichedCoin.rugcheckVerified === false) {
          failedCount++;
          console.log(`⚠️ ${enrichedCoin.symbol}: Rugcheck not available`);
          console.log(`   Error: ${enrichedCoin.rugcheckError || 'Unknown'}`);
        } else {
          console.log(`❓ ${enrichedCoin.symbol}: Rugcheck status undefined`);
        }
        console.log('');
      }
      
      // Rate limit: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n📊 Rugcheck Summary:`);
    console.log(`   Total enriched: ${successCount}`);
    console.log(`   Verified: ${verifiedCount}`);
    console.log(`   Failed/Not available: ${failedCount}`);
    console.log(`   Success rate: ${((verifiedCount / successCount) * 100).toFixed(1)}%`);
    
    // Pass test if rugcheckVerified field is always set (either true or false)
    return (verifiedCount + failedCount) === successCount;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🧪 PRICE CHANGE & RUGCHECK FIX VERIFICATION');
  console.log('='.repeat(60));
  
  const results = {
    dextrending: await testDextrendingPriceChanges(),
    enrichment: await testEnrichedPriceChanges(),
    rugcheck: await testRugcheckConsistency()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 FINAL RESULTS:');
  console.log('='.repeat(60));
  console.log(`${results.dextrending ? '✅' : '❌'} DEXtrending price changes`);
  console.log(`${results.enrichment ? '✅' : '❌'} On-demand enrichment price changes`);
  console.log(`${results.rugcheck ? '✅' : '❌'} Rugcheck consistency`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'));
  console.log('='.repeat(60) + '\n');
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
