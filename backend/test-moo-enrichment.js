/**
 * TEST ENRICHMENT ENDPOINT WITH $MOO TOKEN
 * 
 * Tests the full enrichment pipeline including Moonshot metadata
 */

const fetch = require('node-fetch');

const MOO_ADDRESS = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';
const API_URL = 'http://localhost:3001';

async function testEnrichment() {
  console.log('🧪 TESTING ENRICHMENT ENDPOINT WITH $MOO\n');
  console.log('='.repeat(70));
  
  try {
    const startTime = Date.now();
    
    // Create a minimal coin object
    const coinToEnrich = {
      symbol: 'MOO',
      name: 'MoonFeed',
      mintAddress: MOO_ADDRESS
    };
    
    console.log('📤 Sending enrichment request...');
    console.log(`   URL: ${API_URL}/api/coins/enrich-single`);
    console.log(`   Token: ${MOO_ADDRESS}\n`);
    
    const response = await fetch(`${API_URL}/api/coins/enrich-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mintAddress: MOO_ADDRESS,
        coin: coinToEnrich
      })
    });
    
    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      console.error(`❌ API returned ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error:', errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log(`✅ Enrichment completed in ${duration}ms\n`);
    console.log('='.repeat(70));
    
    if (!result.success) {
      console.error('❌ Enrichment failed:', result.error);
      return;
    }
    
    const enrichedCoin = result.coin || result;
    
    // Check for Moonshot images
    console.log('\n📸 IMAGE DATA:');
    console.log('-'.repeat(70));
    console.log(`Profile Image: ${enrichedCoin.profileImage || 'N/A'}`);
    console.log(`Banner:        ${enrichedCoin.banner || 'N/A'}`);
    console.log(`Logo:          ${enrichedCoin.logo || 'N/A'}`);
    console.log(`Image:         ${enrichedCoin.image || 'N/A'}`);
    
    const hasMoonshotImages = [
      enrichedCoin.profileImage,
      enrichedCoin.banner,
      enrichedCoin.logo,
      enrichedCoin.image
    ].some(url => url && url.includes('moonshot.com'));
    
    if (hasMoonshotImages) {
      console.log('\n✅ SUCCESS: Found Moonshot CDN URLs!');
    } else {
      console.log('\n⚠️  WARNING: No Moonshot URLs found');
      console.log('   The token might not have Moonshot metadata,');
      console.log('   or the service might not be fetching it correctly.');
    }
    
    // Check other enrichment data
    console.log('\n📊 MARKET DATA:');
    console.log('-'.repeat(70));
    console.log(`Price USD:      $${enrichedCoin.price_usd || 'N/A'}`);
    console.log(`Market Cap:     $${enrichedCoin.market_cap_usd || enrichedCoin.marketCap || 'N/A'}`);
    console.log(`Liquidity:      $${enrichedCoin.liquidity_usd || 'N/A'}`);
    console.log(`24h Volume:     $${enrichedCoin.volume_24h_usd || 'N/A'}`);
    console.log(`Holder Count:   ${enrichedCoin.holders || enrichedCoin.holderCount || 'N/A'}`);
    
    console.log('\n📝 METADATA:');
    console.log('-'.repeat(70));
    console.log(`Description:    ${enrichedCoin.description ? enrichedCoin.description.substring(0, 80) + '...' : 'N/A'}`);
    console.log(`Desc Source:    ${enrichedCoin.descriptionSource || 'N/A'}`);
    console.log(`Twitter:        ${enrichedCoin.twitter || 'N/A'}`);
    console.log(`Telegram:       ${enrichedCoin.telegram || 'N/A'}`);
    console.log(`Website:        ${enrichedCoin.website || 'N/A'}`);
    
    console.log('\n🔐 SECURITY:');
    console.log('-'.repeat(70));
    console.log(`Risk Level:     ${enrichedCoin.riskLevel || 'N/A'}`);
    console.log(`Liquidity Lock: ${enrichedCoin.liquidityLocked ? 'Yes' : 'No'}`);
    console.log(`Lock %:         ${enrichedCoin.lockPercentage || 0}%`);
    
    console.log('\n⚙️  ENRICHMENT INFO:');
    console.log('-'.repeat(70));
    console.log(`Enriched:       ${enrichedCoin.enriched ? 'Yes' : 'No'}`);
    console.log(`Enriched At:    ${enrichedCoin.enrichedAt || 'N/A'}`);
    console.log(`Enrich Time:    ${enrichedCoin.enrichmentTime || 'N/A'}ms`);
    console.log(`Has Chart:      ${enrichedCoin.cleanChartData ? 'Yes' : 'No'}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETE\n');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error.stack);
  }
}

testEnrichment();
