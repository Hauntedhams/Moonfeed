const axios = require('axios');

async function getAOLPrice() {
  try {
    // Get the Jupiter live price service status
    const statusResponse = await axios.get('http://localhost:3001/api/jupiter/live-price/status');
    console.log('🪐 Jupiter Live Price Service Status:');
    console.log(JSON.stringify(statusResponse.data, null, 2));
    
    // Get all cached prices to find AOL
    const coinsResponse = await axios.get('http://localhost:3001/api/coins/trending?limit=10');
    const aolCoin = coinsResponse.data.coins.find(coin => 
      coin.mintAddress === '2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk'
    );
    
    if (aolCoin) {
      console.log('\n🪙 AOL COIN FROM FEED:');
      console.log(`💰 Cached Price: $${aolCoin.price_usd}`);
      console.log(`📊 24h Change: ${aolCoin.priceChange24h || aolCoin.change_24h || 0}%`);
      console.log(`🏗️ Market Cap: $${aolCoin.market_cap_usd?.toLocaleString()}`);
      console.log(`📈 Volume 24h: $${aolCoin.volume_24h_usd?.toLocaleString()}`);
    }
    
    // Also get direct Jupiter price for comparison
    const directResponse = await axios.get(
      'https://lite-api.jup.ag/price/v3?ids=2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk'
    );
    
    const aolData = directResponse.data['2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk'];
    console.log('\n🚀 LIVE JUPITER V3 PRICE:');
    console.log(`💰 Live Price: $${aolData.usdPrice}`);
    console.log(`📊 24h Change: ${aolData.priceChange24h?.toFixed(2)}%`);
    console.log(`🧮 Decimals: ${aolData.decimals}`);
    console.log(`🏗️ Block ID: ${aolData.blockId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getAOLPrice();
