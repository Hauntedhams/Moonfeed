/**
 * LIGHTWEIGHT ENRICHMENT DIAGNOSTIC
 * 
 * Shows exactly what APIs are called, what data is used, and how long it takes.
 * This helps identify unnecessary API calls that can be removed for better performance.
 */

const fetch = require('node-fetch');

async function diagnoseEnrichment(mintAddress = '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr') {
  console.log('\n🔬 LIGHTWEIGHT ENRICHMENT DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`📍 Testing: ${mintAddress}\n`);

  const results = {
    apis: {},
    totalTime: 0,
    usedInUI: {},
    unnecessaryCalls: []
  };

  const startTime = Date.now();

  // Test DexScreener (CRITICAL - banner, socials, market data)
  console.log('🔍 1. DexScreener API...');
  const dexStart = Date.now();
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    const data = await response.json();
    const dexTime = Date.now() - dexStart;
    
    const bestPair = data.pairs?.[0];
    const banner = bestPair?.info?.header;
    const socials = bestPair?.info?.socials || [];
    const websites = bestPair?.info?.websites || [];
    
    results.apis.dexscreener = {
      time: dexTime,
      status: response.ok ? '✅' : '❌',
      dataReturned: {
        banner: !!banner,
        socials: socials.length,
        websites: websites.length,
        price: !!bestPair?.priceUsd,
        liquidity: !!bestPair?.liquidity?.usd
      }
    };

    results.usedInUI.banner = banner ? '✅ Banner image' : '❌ No banner';
    results.usedInUI.socials = socials.length > 0 ? `✅ ${socials.length} social links` : '❌ No socials';
    results.usedInUI.dexPrice = bestPair?.priceUsd ? `✅ $${bestPair.priceUsd}` : '❌ No price';
    
    console.log(`   ${results.apis.dexscreener.status} Completed in ${dexTime}ms`);
    console.log(`   📊 Banner: ${banner ? 'YES' : 'NO'}`);
    console.log(`   📊 Socials: ${socials.length}`);
    console.log(`   📊 Price: ${bestPair?.priceUsd ? 'YES' : 'NO'}`);
  } catch (error) {
    results.apis.dexscreener = { time: Date.now() - dexStart, status: '❌', error: error.message };
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test Rugcheck (OPTIONAL - security info)
  console.log('\n🔍 2. Rugcheck API...');
  const rugStart = Date.now();
  try {
    let response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report`);
    if (!response.ok) {
      response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}`);
    }
    
    const rugTime = Date.now() - rugStart;
    
    if (response.status === 429) {
      results.apis.rugcheck = { time: rugTime, status: '⏰', error: 'Rate limited' };
      console.log(`   ⏰ Rate limited (${rugTime}ms)`);
    } else if (response.ok) {
      const data = await response.json();
      results.apis.rugcheck = {
        time: rugTime,
        status: '✅',
        dataReturned: {
          riskLevel: data.riskLevel,
          score: data.score,
          liquidityLocked: !!data.markets?.some(m => (m.lp?.lpLockedPct || 0) > 80)
        }
      };
      
      results.usedInUI.rugcheck = data.riskLevel ? `✅ Risk: ${data.riskLevel}` : '⚠️ No risk data';
      
      console.log(`   ✅ Completed in ${rugTime}ms`);
      console.log(`   📊 Risk Level: ${data.riskLevel || 'unknown'}`);
      console.log(`   📊 Score: ${data.score || 'N/A'}`);
    } else {
      results.apis.rugcheck = { time: rugTime, status: '❌', error: `HTTP ${response.status}` };
      console.log(`   ❌ Failed: HTTP ${response.status} (${rugTime}ms)`);
    }
  } catch (error) {
    results.apis.rugcheck = { time: Date.now() - rugStart, status: '❌', error: error.message };
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test Birdeye (QUESTIONABLE - price only, already have from Jupiter/DexScreener)
  console.log('\n🔍 3. Birdeye API...');
  const birdeyeStart = Date.now();
  try {
    const response = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${mintAddress}`,
      {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || '29e047952f0d45ed8927939bbc08f09c',
          'x-chain': 'solana'
        }
      }
    );
    
    const birdeyeTime = Date.now() - birdeyeStart;
    
    if (response.status === 429) {
      results.apis.birdeye = { time: birdeyeTime, status: '⏰', error: 'Rate limited' };
      console.log(`   ⏰ Rate limited (${birdeyeTime}ms)`);
    } else if (response.ok) {
      const data = await response.json();
      const price = data.data?.value;
      
      results.apis.birdeye = {
        time: birdeyeTime,
        status: '✅',
        dataReturned: { price }
      };
      
      results.usedInUI.birdeyePrice = price ? `⚠️ $${price} (redundant?)` : '❌ No price';
      
      console.log(`   ✅ Completed in ${birdeyeTime}ms`);
      console.log(`   📊 Price: ${price ? '$' + price : 'N/A'}`);
      console.log(`   ⚠️  NOTE: Price already available from DexScreener AND Jupiter Ultra!`);
    } else {
      results.apis.birdeye = { time: birdeyeTime, status: '❌', error: `HTTP ${response.status}` };
      console.log(`   ❌ Failed: HTTP ${response.status} (${birdeyeTime}ms)`);
    }
  } catch (error) {
    results.apis.birdeye = { time: Date.now() - birdeyeStart, status: '❌', error: error.message };
    console.log(`   ❌ Failed: ${error.message}`);
  }

  results.totalTime = Date.now() - startTime;

  // Analysis
  console.log('\n' + '='.repeat(70));
  console.log('📊 ANALYSIS');
  console.log('='.repeat(70));
  
  console.log('\n⏱️  TIMING:');
  console.log(`   Total enrichment time: ${results.totalTime}ms`);
  Object.entries(results.apis).forEach(([api, data]) => {
    const percent = ((data.time / results.totalTime) * 100).toFixed(1);
    console.log(`   ${api.padEnd(15)}: ${data.time}ms (${percent}%)`);
  });

  console.log('\n✅ DATA USED IN UI:');
  Object.entries(results.usedInUI).forEach(([key, value]) => {
    console.log(`   ${key.padEnd(15)}: ${value}`);
  });

  console.log('\n🔥 OPTIMIZATION OPPORTUNITIES:');
  console.log('─'.repeat(70));
  
  // Check if Birdeye is redundant
  if (results.apis.birdeye && results.apis.dexscreener?.dataReturned?.price) {
    console.log('   ⚡ REMOVE BIRDEYE: Price already available from DexScreener');
    console.log('      - Jupiter Ultra provides initial price');
    console.log('      - DexScreener provides updated price');
    console.log('      - Birdeye is redundant and adds latency');
    console.log(`      - Savings: ~${results.apis.birdeye.time}ms per enrichment`);
    results.unnecessaryCalls.push('birdeye');
  }

  // Check for rate limiting
  const rateLimited = Object.entries(results.apis).filter(([_, data]) => data.status === '⏰');
  if (rateLimited.length > 0) {
    console.log(`   ⚠️  RATE LIMITING detected on: ${rateLimited.map(([api]) => api).join(', ')}`);
    console.log('      - Implement request queue with delays');
    console.log('      - Cache aggressively (5-10 min TTL)');
    console.log('      - Make these APIs optional/background');
  }

  // Check for failed APIs
  const failed = Object.entries(results.apis).filter(([_, data]) => data.status === '❌');
  if (failed.length > 0) {
    console.log(`   ⚠️  FAILED APIs: ${failed.map(([api]) => api).join(', ')}`);
    console.log('      - These should be optional (graceful degradation)');
    console.log('      - Don\'t block enrichment on failures');
  }

  console.log('\n💡 RECOMMENDATIONS:');
  console.log('─'.repeat(70));
  console.log('   1. ✅ KEEP DexScreener (banner, socials, price, liquidity)');
  console.log('   2. ✅ KEEP Rugcheck (security info) - but make optional');
  console.log('   3. ❌ REMOVE Birdeye (redundant price data)');
  console.log('   4. ⚡ Use Promise.allSettled() to not fail on errors');
  console.log('   5. ⚡ Set timeout to 3000ms max (current: 5000ms)');
  console.log('   6. ⚡ Cache enriched data for 10 minutes');
  
  const potentialSavings = results.unnecessaryCalls.reduce((sum, api) => {
    return sum + (results.apis[api]?.time || 0);
  }, 0);
  
  if (potentialSavings > 0) {
    console.log(`\n   💰 Total time savings: ~${potentialSavings}ms per enrichment`);
    console.log(`   📈 New enrichment time: ~${results.totalTime - potentialSavings}ms`);
    console.log(`   🚀 Speed improvement: ${((potentialSavings / results.totalTime) * 100).toFixed(1)}% faster`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Diagnostic complete\n');

  return results;
}

// Run diagnostic
if (require.main === module) {
  const mintAddress = process.argv[2] || '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
  diagnoseEnrichment(mintAddress)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Diagnostic failed:', error);
      process.exit(1);
    });
}

module.exports = diagnoseEnrichment;
