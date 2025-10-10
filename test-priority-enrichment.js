/**
 * Test script to verify that the first 10 coins in both "trending" and "new" feeds
 * are enriched with DexScreener data (banners, socials) and Rugcheck status
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function checkEnrichment(feedType, limit = 10) {
  console.log(`\n========================================`);
  console.log(`Testing ${feedType.toUpperCase()} feed enrichment`);
  console.log(`========================================`);
  
  const response = await fetch(`${API_BASE}/api/coins/${feedType}?limit=${limit}`);
  const data = await response.json();
  
  if (!data.success) {
    console.error(`❌ Failed to fetch ${feedType} coins:`, data.error);
    return;
  }
  
  const coins = data.coins;
  console.log(`\n📊 Total coins returned: ${coins.length}`);
  console.log(`\nChecking first ${Math.min(10, coins.length)} coins for enrichment:\n`);
  
  let enrichedCount = 0;
  let bannersCount = 0;
  let socialsCount = 0;
  let rugcheckCount = 0;
  
  for (let i = 0; i < Math.min(10, coins.length); i++) {
    const coin = coins[i];
    const hasBanner = !!coin.banner && !coin.banner.includes('placeholder');
    const hasSocials = !!(coin.twitter || coin.telegram || coin.website);
    const hasRugcheck = !!coin.rugcheckProcessedAt;
    const isDexscreenerEnriched = !!coin.dexscreenerProcessedAt;
    
    console.log(`${i + 1}. ${coin.symbol} (${coin.name})`);
    console.log(`   Mint: ${coin.mintAddress}`);
    console.log(`   ${isDexscreenerEnriched ? '✅' : '⏳'} DexScreener: ${isDexscreenerEnriched ? 'Enriched' : 'Pending'}`);
    console.log(`   ${hasBanner ? '🎨' : '⚪'} Banner: ${hasBanner ? 'Yes' : 'No'}`);
    console.log(`   ${hasSocials ? '📱' : '⚪'} Socials: ${hasSocials ? 'Yes' : 'No'}`);
    console.log(`   ${hasRugcheck ? '🔍' : '⏳'} Rugcheck: ${hasRugcheck ? (coin.rugcheckVerified ? 'Verified' : 'Processed') : 'Pending'}`);
    
    if (hasRugcheck && coin.rugcheckVerified) {
      console.log(`      🔒 Liquidity Locked: ${coin.liquidityLocked ? 'Yes' : 'No'}`);
      console.log(`      ⚠️  Risk Level: ${coin.riskLevel || 'Unknown'}`);
    }
    
    console.log('');
    
    if (isDexscreenerEnriched) enrichedCount++;
    if (hasBanner) bannersCount++;
    if (hasSocials) socialsCount++;
    if (hasRugcheck) rugcheckCount++;
  }
  
  console.log(`\n📊 Summary for first 10 ${feedType.toUpperCase()} coins:`);
  console.log(`   ✅ DexScreener enriched: ${enrichedCount}/10 (${Math.round(enrichedCount/10 * 100)}%)`);
  console.log(`   🎨 With banners: ${bannersCount}/10 (${Math.round(bannersCount/10 * 100)}%)`);
  console.log(`   📱 With socials: ${socialsCount}/10 (${Math.round(socialsCount/10 * 100)}%)`);
  console.log(`   🔍 Rugcheck processed: ${rugcheckCount}/10 (${Math.round(rugcheckCount/10 * 100)}%)`);
  
  const allEnriched = enrichedCount === 10 && rugcheckCount === 10;
  
  if (allEnriched) {
    console.log(`\n🎉 SUCCESS! All first 10 ${feedType} coins are fully enriched!`);
  } else {
    console.log(`\n⏳ PARTIAL: Some ${feedType} coins still being enriched...`);
    console.log(`   (This is expected if the server just started)`);
  }
  
  return {
    feedType,
    total: coins.length,
    enrichedCount,
    bannersCount,
    socialsCount,
    rugcheckCount,
    allEnriched
  };
}

async function main() {
  console.log('\n🚀 Testing Priority Enrichment for Both Feeds');
  console.log('==============================================\n');
  console.log('This test verifies that the first 10 coins in each feed');
  console.log('(trending and new) are enriched with DexScreener data');
  console.log('(banners, socials) and Rugcheck status.\n');
  
  try {
    // Test TRENDING feed
    const trendingResults = await checkEnrichment('trending', 10);
    
    // Wait a bit before testing NEW feed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test NEW feed
    const newResults = await checkEnrichment('new', 10);
    
    console.log('\n========================================');
    console.log('FINAL SUMMARY');
    console.log('========================================\n');
    
    console.log('TRENDING feed:');
    console.log(`  DexScreener: ${trendingResults.enrichedCount}/10 enriched`);
    console.log(`  Rugcheck: ${trendingResults.rugcheckCount}/10 processed`);
    console.log(`  Status: ${trendingResults.allEnriched ? '✅ Complete' : '⏳ In Progress'}\n`);
    
    console.log('NEW feed:');
    console.log(`  DexScreener: ${newResults.enrichedCount}/10 enriched`);
    console.log(`  Rugcheck: ${newResults.rugcheckCount}/10 processed`);
    console.log(`  Status: ${newResults.allEnriched ? '✅ Complete' : '⏳ In Progress'}\n`);
    
    if (trendingResults.allEnriched && newResults.allEnriched) {
      console.log('🎉 SUCCESS! Both feeds have fully enriched first 10 coins!');
    } else {
      console.log('⏳ Enrichment is still in progress. Run this test again in 30-60 seconds.');
    }
    
  } catch (error) {
    console.error('\n❌ Error running test:', error.message);
    console.error('Make sure the backend server is running on port 3001');
  }
}

main();
