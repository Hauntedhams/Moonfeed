#!/usr/bin/env node
/**
 * Test script to verify search-to-view enrichment flow
 * 
 * This script:
 * 1. Searches for a coin using Jupiter Ultra
 * 2. Enriches the coin using the backend
 * 3. Verifies that enrichment data is present
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function testSearchEnrichmentFlow() {
  console.log('🧪 Testing Search-to-View Enrichment Flow\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Search for a coin
    console.log('\n📍 Step 1: Search for a coin');
    const searchQuery = 'POPCAT';
    console.log(`   Query: ${searchQuery}`);
    
    const searchResponse = await fetch(`${API_BASE}/api/search?query=${searchQuery}`);
    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    console.log(`   ✅ Found ${searchData.results.length} results`);
    
    if (searchData.results.length === 0) {
      console.log('   ⚠️ No results found, cannot continue test');
      return;
    }
    
    const firstCoin = searchData.results[0];
    console.log(`   Selected: ${firstCoin.symbol} (${firstCoin.name})`);
    console.log(`   Mint: ${firstCoin.mintAddress}`);
    console.log(`   Price: $${firstCoin.priceUsd}`);
    
    // Step 2: Transform to Moonfeed format (simulate frontend)
    console.log('\n📍 Step 2: Transform to Moonfeed format');
    const coinData = {
      ...firstCoin,
      id: firstCoin.mintAddress || firstCoin.mint || firstCoin.id,
      tokenAddress: firstCoin.mintAddress || firstCoin.mint || firstCoin.tokenAddress,
      mintAddress: firstCoin.mintAddress || firstCoin.mint,
      symbol: firstCoin.symbol,
      name: firstCoin.name,
      image: firstCoin.image || firstCoin.profilePic,
      priceUsd: firstCoin.priceUsd || firstCoin.price,
      marketCap: firstCoin.marketCap,
      description: firstCoin.description
    };
    console.log('   ✅ Transformed coin data');
    
    // Step 3: Check basic data (no enrichment yet)
    console.log('\n📍 Step 3: Check basic data (before enrichment)');
    console.log(`   Has banner: ${!!(coinData.banner || coinData.bannerImage)}`);
    console.log(`   Has website: ${!!coinData.website}`);
    console.log(`   Has twitter: ${!!coinData.twitter}`);
    console.log(`   Has rugcheck: ${!!(coinData.rugcheck && Object.keys(coinData.rugcheck).length > 0)}`);
    
    // Step 4: Enrich the coin
    console.log('\n📍 Step 4: Enrich the coin');
    const enrichStartTime = Date.now();
    
    const enrichResponse = await fetch(`${API_BASE}/api/coins/enrich-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coin: coinData })
    });
    
    if (!enrichResponse.ok) {
      throw new Error(`Enrichment failed: ${enrichResponse.status}`);
    }
    
    const enrichData = await enrichResponse.json();
    const enrichDuration = Date.now() - enrichStartTime;
    
    console.log(`   ✅ Enrichment complete in ${enrichDuration}ms`);
    console.log(`   Backend enrichment time: ${enrichData.enrichmentTime}ms`);
    console.log(`   Cached: ${enrichData.cached}`);
    
    // Step 5: Verify enriched data
    console.log('\n📍 Step 5: Verify enriched data');
    const enrichedCoin = enrichData.coin;
    
    const hasBanner = !!(enrichedCoin.banner || enrichedCoin.bannerImage || enrichedCoin.header || enrichedCoin.bannerUrl);
    const hasWebsite = !!(enrichedCoin.socialLinks?.website || enrichedCoin.website);
    const hasTwitter = !!(enrichedCoin.socialLinks?.twitter || enrichedCoin.twitter);
    const hasTelegram = !!(enrichedCoin.socialLinks?.telegram || enrichedCoin.telegram);
    const hasRugcheck = !!(
      enrichedCoin.liquidityLocked !== undefined || 
      enrichedCoin.rugcheckScore || 
      enrichedCoin.riskLevel || 
      (enrichedCoin.rugcheck && Object.keys(enrichedCoin.rugcheck).length > 0)
    );
    const hasLivePrice = !!(enrichedCoin.priceUsd && enrichedCoin.priceUsd > 0);
    const hasMarketCap = !!(enrichedCoin.marketCap && enrichedCoin.marketCap > 0);
    const hasLiquidity = !!(
      (enrichedCoin.liquidity_usd && enrichedCoin.liquidity_usd > 0) ||
      (enrichedCoin.liquidity && enrichedCoin.liquidity > 0)
    );
    
    console.log(`   Banner: ${hasBanner ? '✅' : '❌'}`);
    if (hasBanner) {
      console.log(`      URL: ${enrichedCoin.banner || enrichedCoin.bannerImage || enrichedCoin.header || enrichedCoin.bannerUrl}`);
    }
    console.log(`   Website: ${hasWebsite ? '✅' : '❌'} ${hasWebsite ? (enrichedCoin.socialLinks?.website || enrichedCoin.website) : ''}`);
    console.log(`   Twitter: ${hasTwitter ? '✅' : '❌'} ${hasTwitter ? (enrichedCoin.socialLinks?.twitter || enrichedCoin.twitter) : ''}`);
    console.log(`   Telegram: ${hasTelegram ? '✅' : '❌'} ${hasTelegram ? (enrichedCoin.socialLinks?.telegram || enrichedCoin.telegram) : ''}`);
    console.log(`   Rugcheck: ${hasRugcheck ? '✅' : '❌'}`);
    if (hasRugcheck) {
      console.log(`      Score: ${enrichedCoin.rugcheckScore || enrichedCoin.rugcheck?.score || 'N/A'}`);
      console.log(`      Risk: ${enrichedCoin.riskLevel || enrichedCoin.rugcheck?.risk || 'N/A'}`);
      console.log(`      Liquidity Locked: ${enrichedCoin.liquidityLocked ? 'Yes' : 'No'}`);
    }
    console.log(`   Live Price: ${hasLivePrice ? '✅' : '❌'} ${hasLivePrice ? '$' + enrichedCoin.priceUsd : ''}`);
    console.log(`   Market Cap: ${hasMarketCap ? '✅' : '❌'} ${hasMarketCap ? '$' + formatNumber(enrichedCoin.marketCap) : ''}`);
    console.log(`   Liquidity: ${hasLiquidity ? '✅' : '❌'} ${hasLiquidity ? '$' + formatNumber(enrichedCoin.liquidity_usd || enrichedCoin.liquidity) : ''}`);
    
    // Step 6: Summary
    console.log('\n📍 Step 6: Enrichment Summary');
    const enrichmentScore = [hasBanner, hasWebsite, hasTwitter, hasRugcheck, hasLivePrice, hasMarketCap, hasLiquidity].filter(Boolean).length;
    const totalChecks = 7;
    const percentage = Math.round((enrichmentScore / totalChecks) * 100);
    
    console.log(`   Enrichment score: ${enrichmentScore}/${totalChecks} (${percentage}%)`);
    
    if (percentage >= 70) {
      console.log('   🎉 PASS - Coin is well enriched!');
    } else if (percentage >= 50) {
      console.log('   ⚠️ PARTIAL - Some enrichment data is missing');
    } else {
      console.log('   ❌ FAIL - Enrichment is incomplete');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Helper function to format numbers
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// Run the test
testSearchEnrichmentFlow();
