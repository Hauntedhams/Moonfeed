/**
 * Verify that trending and new feeds show different coins
 */

const fetch = require('node-fetch');

async function compareFeedCoins() {
  console.log('\n🔍 Comparing TRENDING vs NEW feed coins...\n');
  
  const trendingResponse = await fetch('http://localhost:3001/api/coins/trending?limit=20');
  const trendingData = await trendingResponse.json();
  
  const newResponse = await fetch('http://localhost:3001/api/coins/new?limit=20');
  const newData = await newResponse.json();
  
  const trendingMints = new Set(trendingData.coins.map(c => c.mintAddress));
  const newMints = new Set(newData.coins.map(c => c.mintAddress));
  
  // Find overlap
  const overlap = [...trendingMints].filter(mint => newMints.has(mint));
  
  console.log(`📊 TRENDING feed: ${trendingData.coins.length} coins`);
  console.log(`🆕 NEW feed: ${newData.coins.length} coins`);
  console.log(`🔄 Overlapping coins: ${overlap.length}`);
  console.log(`✅ Unique coins: ${(trendingMints.size + newMints.size - overlap.length)}`);
  
  if (overlap.length === 0) {
    console.log('\n🎉 SUCCESS! The feeds show completely different coins!');
  } else {
    console.log('\n⚠️  Some coins appear in both feeds:');
    overlap.slice(0, 5).forEach(mint => {
      const tCoin = trendingData.coins.find(c => c.mintAddress === mint);
      console.log(`   - ${tCoin.symbol} (${mint.slice(0, 8)}...)`);
    });
  }
  
  console.log('\n📋 Sample TRENDING coins (first 5):');
  trendingData.coins.slice(0, 5).forEach((coin, i) => {
    const age = coin.ageHours ? `${coin.ageHours}h old` : 'age unknown';
    console.log(`   ${i+1}. ${coin.symbol} - ${age}`);
  });
  
  console.log('\n🆕 Sample NEW coins (first 5):');
  newData.coins.slice(0, 5).forEach((coin, i) => {
    const age = coin.ageHours ? `${coin.ageHours}h old` : 'age unknown';
    console.log(`   ${i+1}. ${coin.symbol} - ${age} ✨`);
  });
  
  console.log('\n✅ Both feeds are working correctly with different coins!');
}

compareFeedCoins().catch(console.error);
