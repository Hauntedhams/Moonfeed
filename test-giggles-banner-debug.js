const dexscreenerService = require('./backend/dexscreenerService');

async function testGigglesBanner() {
  const tokenAddress = 'Bsow2wFkVzy1itJnhLke6VRTqoEkYQZp7kbwPtS87FyN';
  
  console.log('🔍 Testing Giggles banner extraction...');
  console.log('Token address:', tokenAddress);
  
  try {
    // First, let's see what raw data we get from DexScreener
    const dexData = await dexscreenerService.fetchTokenFromDexScreener(tokenAddress);
    
    console.log('\n📊 Raw DexScreener response:');
    console.log('Pairs found:', dexData?.pairs?.length || 0);
    
    if (dexData?.pairs?.length > 0) {
      const pair = dexData.pairs[0];
      console.log('\n🔍 First pair data:');
      console.log('Pair address:', pair.pairAddress);
      console.log('DEX:', pair.dexId);
      console.log('Base token:', pair.baseToken?.symbol);
      
      console.log('\n🖼️ Banner/Image fields in pair.info:');
      console.log('header:', pair.info?.header);
      console.log('imageUrl:', pair.info?.imageUrl);
      console.log('websites[0].imageUrl:', pair.info?.websites?.[0]?.imageUrl);
      console.log('baseToken.image:', pair.baseToken?.image);
    }
    
    // Test full enrichment process
    console.log('\n🚀 Testing full enrichCoin process...');
    const mockCoin = {
      symbol: 'GIGGLES',
      mintAddress: tokenAddress,
      banner: 'placeholder-banner-url'
    };
    
    console.log('Input coin banner:', mockCoin.banner);
    
    const enrichedCoin = await dexscreenerService.enrichCoin(mockCoin);
    console.log('\n🎯 Final enriched coin banner:', enrichedCoin.banner);
    console.log('Banner changed from placeholder?', enrichedCoin.banner !== mockCoin.banner);
    
    if (enrichedCoin.banner === mockCoin.banner) {
      console.log('❌ Banner was NOT updated - still showing placeholder');
    } else {
      console.log('✅ Banner was successfully updated from DexScreener');
    }
    
  } catch (error) {
    console.error('❌ Error testing Giggles banner:', error);
  }
}

testGigglesBanner();
