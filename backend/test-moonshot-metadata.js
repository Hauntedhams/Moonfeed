/**
 * TEST MOONSHOT METADATA SERVICE
 * 
 * Tests the Moonshot metadata fetching for $MOO and other tokens
 */

require('dotenv').config();
const moonshotMetadataService = require('./services/moonshotMetadataService');

// Test tokens
const testTokens = [
  {
    name: '$MOO (Moonfeed token)',
    mintAddress: 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon',
    expectedToHaveMoonshot: true
  },
  // Add other known Moonshot tokens here
];

async function testMoonshotMetadata() {
  console.log('🌙 TESTING MOONSHOT METADATA SERVICE\n');
  console.log('='.repeat(70));
  
  for (const token of testTokens) {
    console.log(`\n📍 Testing: ${token.name}`);
    console.log(`   Address: ${token.mintAddress}`);
    console.log('-'.repeat(70));
    
    try {
      const startTime = Date.now();
      const metadata = await moonshotMetadataService.getMetadata(token.mintAddress);
      const duration = Date.now() - startTime;
      
      if (metadata) {
        console.log(`✅ Moonshot metadata found! (${duration}ms)`);
        console.log('\n📸 Images:');
        console.log(`   Profile: ${metadata.profileImage || 'N/A'}`);
        console.log(`   Banner:  ${metadata.banner || 'N/A'}`);
        console.log(`   Logo:    ${metadata.logo || 'N/A'}`);
        
        console.log('\n📝 Description:');
        console.log(`   ${metadata.description ? metadata.description.substring(0, 100) + '...' : 'N/A'}`);
        
        console.log('\n🔗 Socials:');
        if (metadata.socials && Object.keys(metadata.socials).length > 0) {
          Object.entries(metadata.socials).forEach(([platform, url]) => {
            console.log(`   ${platform}: ${url}`);
          });
        } else {
          console.log('   None found');
        }
        
        console.log(`\n🎯 Source: ${metadata.source}`);
        
        // Verify it's actually Moonshot
        const hasMoonshotUrls = [
          metadata.profileImage,
          metadata.banner,
          metadata.logo
        ].some(url => url && url.includes('moonshot.com'));
        
        if (hasMoonshotUrls) {
          console.log('✅ Confirmed: Contains Moonshot CDN URLs');
        } else {
          console.log('⚠️  Warning: No Moonshot CDN URLs found (might be from other source)');
        }
        
      } else {
        console.log(`❌ No Moonshot metadata found (${duration}ms)`);
        
        if (token.expectedToHaveMoonshot) {
          console.log('⚠️  WARNING: Expected to find Moonshot data but didn\'t!');
          console.log('   This might indicate:');
          console.log('   - Token not on Moonshot');
          console.log('   - API endpoint issue');
          console.log('   - DexScreener doesn\'t have the data yet');
        }
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${token.name}:`, error.message);
      console.error(error.stack);
    }
    
    console.log('='.repeat(70));
  }
  
  // Show cache stats
  console.log('\n📊 CACHE STATISTICS');
  console.log('-'.repeat(70));
  const stats = moonshotMetadataService.getCacheStats();
  console.log(`Cached tokens: ${stats.cached_tokens}`);
  console.log(`Cache hits:    ${stats.hits}`);
  console.log(`Cache misses:  ${stats.misses}`);
  console.log(`Hit rate:      ${stats.hits + stats.misses > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) : 0}%`);
  console.log('='.repeat(70));
  
  console.log('\n✅ Test complete!\n');
}

// Run test
testMoonshotMetadata()
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
