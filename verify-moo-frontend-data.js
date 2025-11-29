/**
 * Final verification - Show exactly what frontend receives for MOO
 */

const API_URL = 'http://localhost:3001';
const MOO_MINT = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';

async function verifyFrontendData() {
  console.log('🎯 Final Verification: What Frontend Receives for $MOO\n');
  console.log('='.repeat(60));

  try {
    const mooCoin = {
      mintAddress: MOO_MINT,
      symbol: 'MOO',
      name: 'Moonfeed',
      address: MOO_MINT
    };

    const response = await fetch(`${API_URL}/api/coins/enrich-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        mintAddress: MOO_MINT,
        coin: mooCoin 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const coin = data.coin;

    console.log('\n📊 PRICE & MARKET DATA:');
    console.log('   Price USD:', coin.price_usd ? `$${coin.price_usd}` : 'N/A');
    console.log('   Market Cap:', coin.marketCap ? `$${coin.marketCap.toLocaleString()}` : 'N/A');
    console.log('   Total Supply:', coin.totalSupply ? coin.totalSupply.toLocaleString() : 'N/A');
    console.log('   Pre-Launch:', coin.preLaunch ? '✅ (estimated price)' : '❌ (live price)');

    console.log('\n📈 CHART DATA:');
    if (coin.cleanChartData) {
      console.log('   ✅ Chart Available');
      console.log('   Current Price:', `$${coin.cleanChartData.currentPrice}`);
      console.log('   Data Points:', coin.cleanChartData.dataPoints?.length);
      console.log('   Is Moonfeed Native:', coin.cleanChartData.isMoonfeedNative ? '✅' : '❌');
      console.log('   Pre-Launch Mode:', coin.cleanChartData.preLaunch ? '✅' : '❌');
    } else {
      console.log('   ❌ No Chart Data');
    }

    console.log('\n🖼️  MEDIA:');
    console.log('   Profile Image:', coin.profileImage ? '✅ ' + coin.profileImage.substring(0, 50) + '...' : '❌');
    console.log('   Banner:', coin.banner ? '✅ ' + coin.banner : '❌');

    console.log('\n📝 METADATA:');
    console.log('   Symbol:', coin.symbol);
    console.log('   Name:', coin.name);
    console.log('   Description:', coin.description ? coin.description.substring(0, 80) + '...' : 'N/A');
    console.log('   Source:', coin.source);
    console.log('   Is Moonfeed Native:', coin.isMoonfeedNative ? '✅' : '❌');

    console.log('\n🔗 ADDRESSES:');
    console.log('   Mint:', coin.mintAddress);
    console.log('   Pool:', coin.poolAddress || coin.pairAddress || 'N/A (pre-DEX)');

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ FRONTEND RENDERING CAPABILITY CHECK:\n');

    const checks = {
      'Can show price': !!coin.price_usd,
      'Can show market cap': !!coin.marketCap,
      'Can render chart': !!(coin.cleanChartData && coin.cleanChartData.dataPoints?.length > 0),
      'Can show profile image': !!coin.profileImage,
      'Can show banner': !!coin.banner,
      'Can show description': !!coin.description,
      'Has RPC monitoring': coin.isMoonfeedNative,
      'Will update live': coin.isMoonfeedNative || !!coin.poolAddress
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });

    const allPassed = Object.values(checks).every(v => v);
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('\n🎉 SUCCESS! Frontend has everything it needs!');
      console.log('\n👉 Refresh your browser and click "Buy $MOO" to see it live!');
    } else {
      console.log('\n⚠️  Some features are missing - see above');
    }
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
  }
}

verifyFrontendData();
