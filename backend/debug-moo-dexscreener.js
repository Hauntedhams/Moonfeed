/**
 * DEBUG DEXSCREENER DATA FOR $MOO
 * 
 * Check what data DexScreener actually has for the $MOO token
 */

require('dotenv').config();
const fetch = require('node-fetch');

const MOO_ADDRESS = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';

async function debugDexScreener() {
  console.log('🔍 DEBUGGING DEXSCREENER DATA FOR $MOO\n');
  console.log(`Token: ${MOO_ADDRESS}\n`);
  
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${MOO_ADDRESS}`;
    console.log(`Fetching: ${url}\n`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ DexScreener returned: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ DexScreener response received\n');
    console.log('='.repeat(70));
    
    if (!data.pairs || data.pairs.length === 0) {
      console.log('❌ No pairs found for this token!');
      return;
    }
    
    console.log(`Found ${data.pairs.length} pair(s)\n`);
    
    data.pairs.forEach((pair, index) => {
      console.log(`\n📍 PAIR ${index + 1}/${data.pairs.length}`);
      console.log('-'.repeat(70));
      
      // Basic info
      console.log('🔹 Basic Info:');
      console.log(`   DEX: ${pair.dexId || 'N/A'}`);
      console.log(`   Pair Address: ${pair.pairAddress || 'N/A'}`);
      console.log(`   URL: ${pair.url || 'N/A'}`);
      
      // Token info
      console.log('\n🔹 Base Token:');
      if (pair.baseToken) {
        console.log(`   Name: ${pair.baseToken.name || 'N/A'}`);
        console.log(`   Symbol: ${pair.baseToken.symbol || 'N/A'}`);
        console.log(`   Address: ${pair.baseToken.address || 'N/A'}`);
        console.log(`   Image: ${pair.baseToken.image || 'N/A'}`);
      } else {
        console.log('   No baseToken data');
      }
      
      // Info (socials, images, etc.)
      console.log('\n🔹 Info Object:');
      if (pair.info) {
        console.log(`   Image URL: ${pair.info.imageUrl || 'N/A'}`);
        console.log(`   Header: ${pair.info.header || 'N/A'}`);
        console.log(`   Description: ${pair.info.description ? pair.info.description.substring(0, 100) + '...' : 'N/A'}`);
        
        if (pair.info.websites && pair.info.websites.length > 0) {
          console.log('\n   Websites:');
          pair.info.websites.forEach(site => {
            console.log(`     - ${site.url || site}`);
          });
        }
        
        if (pair.info.socials && pair.info.socials.length > 0) {
          console.log('\n   Socials:');
          pair.info.socials.forEach(social => {
            console.log(`     - ${social.type || social.platform}: ${social.url}`);
          });
        }
      } else {
        console.log('   No info object');
      }
      
      // Check for Moonshot URLs
      console.log('\n🔹 Moonshot Detection:');
      const allUrls = [
        pair.baseToken?.image,
        pair.info?.imageUrl,
        pair.info?.header
      ].filter(Boolean);
      
      const moonshotUrls = allUrls.filter(url => url.includes('moonshot.com'));
      
      if (moonshotUrls.length > 0) {
        console.log('   ✅ Found Moonshot URLs:');
        moonshotUrls.forEach(url => console.log(`     - ${url}`));
      } else {
        console.log('   ❌ No Moonshot URLs found');
        if (allUrls.length > 0) {
          console.log('   Other image URLs:');
          allUrls.forEach(url => console.log(`     - ${url}`));
        }
      }
      
      // Market data
      console.log('\n🔹 Market Data:');
      console.log(`   Price USD: $${pair.priceUsd || 'N/A'}`);
      console.log(`   Liquidity: $${pair.liquidity?.usd || 'N/A'}`);
      console.log(`   24h Volume: $${pair.volume?.h24 || 'N/A'}`);
      console.log(`   FDV: $${pair.fdv || 'N/A'}`);
      
      console.log('='.repeat(70));
    });
    
    // Show full raw JSON for first pair
    console.log('\n\n📄 FULL RAW JSON (First Pair):');
    console.log('='.repeat(70));
    console.log(JSON.stringify(data.pairs[0], null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugDexScreener();
