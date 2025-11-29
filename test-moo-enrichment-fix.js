/**
 * Test MOO coin enrichment after Moonfeed-native fixes
 */

const API_URL = 'http://localhost:3001';
const MOO_MINT = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';

async function testMooEnrichment() {
  console.log('🐄 Testing $MOO enrichment with Moonfeed-native fixes...\n');

  try {
    // Create minimal MOO coin object (like frontend does)
    const mooCoin = {
      mintAddress: MOO_MINT,
      symbol: 'MOO',
      name: 'Moonfeed',
      address: MOO_MINT
    };

    console.log('📤 Requesting enrichment for $MOO...');
    const response = await fetch(`${API_URL}/api/coins/enrich-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        mintAddress: MOO_MINT,
        coin: mooCoin 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('\n✅ Enrichment Response:');
    console.log('   Success:', data.success);
    console.log('   Enrichment Time:', data.enrichmentTime, 'ms');
    console.log('   Cached:', data.cached);

    if (data.coin) {
      const coin = data.coin;
      
      console.log('\n📊 Enriched Coin Data:');
      console.log('   Symbol:', coin.symbol);
      console.log('   Name:', coin.name);
      console.log('   Mint:', coin.mintAddress);
      console.log('   Source:', coin.source);
      console.log('   Is Moonfeed Native:', coin.isMoonfeedNative);
      
      console.log('\n💰 Price Data:');
      console.log('   Price USD:', coin.price_usd || coin.priceUsd || coin.price || 'N/A');
      console.log('   Market Cap:', coin.marketCap || coin.market_cap_usd || 'N/A');
      console.log('   Liquidity:', coin.liquidity || coin.liquidity_usd || 'N/A');
      console.log('   Volume 24h:', coin.volume24h || coin.volume_24h_usd || 'N/A');
      
      console.log('\n📈 Chart Data:');
      if (coin.cleanChartData) {
        console.log('   Has Chart:', '✅');
        console.log('   Is Moonfeed Chart:', coin.cleanChartData.isMoonfeedNative ? '✅' : '❌');
        console.log('   Current Price:', coin.cleanChartData.currentPrice);
        console.log('   Data Points:', coin.cleanChartData.dataPoints?.length || 0);
        
        if (coin.cleanChartData.dataPoints && coin.cleanChartData.dataPoints.length > 0) {
          const firstPoint = coin.cleanChartData.dataPoints[0];
          const lastPoint = coin.cleanChartData.dataPoints[coin.cleanChartData.dataPoints.length - 1];
          console.log('   First Point:', firstPoint.label, '-', firstPoint.price);
          console.log('   Last Point:', lastPoint.label, '-', lastPoint.price);
        }
      } else {
        console.log('   Has Chart:', '❌');
      }
      
      console.log('\n🖼️ Media:');
      console.log('   Profile Image:', coin.profileImage || coin.image || coin.logo || 'N/A');
      console.log('   Banner:', coin.banner || 'N/A');
      
      console.log('\n🔗 Socials:');
      console.log('   Website:', coin.website || 'N/A');
      console.log('   Twitter:', coin.twitter || 'N/A');
      console.log('   Telegram:', coin.telegram || 'N/A');
      
      console.log('\n📝 Description:');
      console.log('   ' + (coin.description || 'No description') );
      console.log('   Source:', coin.descriptionSource || 'N/A');
      
      // Check if it will work in the frontend
      console.log('\n✨ Frontend Compatibility Check:');
      const hasPrice = !!(coin.price_usd || coin.priceUsd || coin.price);
      const hasChart = !!coin.cleanChartData;
      const isMoonfeed = coin.isMoonfeedNative || coin.source === 'moonfeed';
      
      console.log('   Has Price:', hasPrice ? '✅' : '❌');
      console.log('   Has Chart Data:', hasChart ? '✅' : '❌');
      console.log('   Is Moonfeed Native:', isMoonfeed ? '✅' : '❌');
      console.log('   Will Show Chart:', hasChart ? '✅' : '❌');
      console.log('   Will Show Live Updates:', isMoonfeed ? '✅ (RPC)' : '✅ (WebSocket)');
      
      if (hasPrice && hasChart && isMoonfeed) {
        console.log('\n✅ SUCCESS! $MOO is ready to display in the frontend! 🎉');
      } else {
        console.log('\n⚠️ WARNING: Some data is missing:');
        if (!hasPrice) console.log('   - No price data');
        if (!hasChart) console.log('   - No chart data');
        if (!isMoonfeed) console.log('   - Not marked as Moonfeed native');
      }
    } else {
      console.error('❌ No coin data in response');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Backend is running on port 3001');
    console.error('2. OnDemandEnrichmentService.js has the Moonfeed fixes');
    console.error('3. Solana RPC is accessible for price data');
  }
}

// Run test
testMooEnrichment();
