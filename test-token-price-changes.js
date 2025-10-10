/**
 * Test DexScreener Price Changes for Specific Token
 * 
 * Fetches and displays all price change percentages from DexScreener
 * for token: EzmNUv969FgxWegnyrqUb5AcNY9hoQZoyaSekH1trift
 */

const fetch = require('node-fetch');

const TOKEN_ADDRESS = '9LRTJXYpzu6B2VvDV5MMDsc9Hpdseps4hecJJcbdQknZ';
const DEXSCREENER_API_BASE = 'https://api.dexscreener.com/latest';

console.log('🔍 Testing DexScreener Price Changes API\n');
console.log('Token Address:', TOKEN_ADDRESS);
console.log('=' .repeat(70));

async function fetchTokenData() {
  try {
    console.log('\n📡 Fetching data from DexScreener...');
    
    const response = await fetch(`${DEXSCREENER_API_BASE}/dex/tokens/${TOKEN_ADDRESS}`, {
      headers: {
        'User-Agent': 'Moonfeed/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      console.log('❌ No trading pairs found for this token');
      return;
    }

    // Find best pair (highest liquidity)
    const bestPair = data.pairs.reduce((best, current) => {
      const currentLiquidity = parseFloat(current.liquidity?.usd || '0');
      const bestLiquidity = parseFloat(best.liquidity?.usd || '0');
      return currentLiquidity > bestLiquidity ? current : best;
    });

    console.log('✅ Found trading pair data\n');
    
    // LOG RAW PRICE CHANGE OBJECT TO SEE ALL AVAILABLE TIMEFRAMES
    console.log('🔍 RAW PRICE CHANGE DATA (all available timeframes)');
    console.log('=' .repeat(70));
    console.log(JSON.stringify(bestPair.priceChange, null, 2));
    console.log('');
    
    // Display token info
    console.log('📊 TOKEN INFORMATION');
    console.log('=' .repeat(70));
    console.log(`Name:           ${bestPair.baseToken?.name || 'Unknown'}`);
    console.log(`Symbol:         ${bestPair.baseToken?.symbol || 'Unknown'}`);
    console.log(`DEX:            ${bestPair.dexId || 'Unknown'}`);
    console.log(`Pair Address:   ${bestPair.pairAddress || 'Unknown'}`);
    console.log(`Chain:          ${bestPair.chainId || 'solana'}`);
    
    // Display current price
    console.log('\n💰 CURRENT PRICE');
    console.log('=' .repeat(70));
    const currentPrice = parseFloat(bestPair.priceUsd || '0');
    console.log(`Price USD:      $${currentPrice.toFixed(currentPrice < 0.01 ? 8 : 6)}`);
    console.log(`Price Native:   ${bestPair.priceNative || 'N/A'}`);
    
    // Display price changes - THIS IS WHAT THE CLEAN CHART USES
    console.log('\n📈 PRICE CHANGES (used by Clean Chart)');
    console.log('=' .repeat(70));
    
    const priceChange = bestPair.priceChange || {};
    
    // Display ALL available timeframes
    console.log('1-Minute:       ' + (priceChange.m1 ? `${priceChange.m1 > 0 ? '+' : ''}${priceChange.m1.toFixed(2)}%` : 'N/A'));
    console.log('5-Minute:       ' + (priceChange.m5 ? `${priceChange.m5 > 0 ? '+' : ''}${priceChange.m5.toFixed(2)}%` : 'N/A'));
    console.log('15-Minute:      ' + (priceChange.m15 ? `${priceChange.m15 > 0 ? '+' : ''}${priceChange.m15.toFixed(2)}%` : 'N/A'));
    console.log('30-Minute:      ' + (priceChange.m30 ? `${priceChange.m30 > 0 ? '+' : ''}${priceChange.m30.toFixed(2)}%` : 'N/A'));
    console.log('1-Hour:         ' + (priceChange.h1 ? `${priceChange.h1 > 0 ? '+' : ''}${priceChange.h1.toFixed(2)}%` : 'N/A'));
    console.log('2-Hour:         ' + (priceChange.h2 ? `${priceChange.h2 > 0 ? '+' : ''}${priceChange.h2.toFixed(2)}%` : 'N/A'));
    console.log('4-Hour:         ' + (priceChange.h4 ? `${priceChange.h4 > 0 ? '+' : ''}${priceChange.h4.toFixed(2)}%` : 'N/A'));
    console.log('6-Hour:         ' + (priceChange.h6 ? `${priceChange.h6 > 0 ? '+' : ''}${priceChange.h6.toFixed(2)}%` : 'N/A'));
    console.log('8-Hour:         ' + (priceChange.h8 ? `${priceChange.h8 > 0 ? '+' : ''}${priceChange.h8.toFixed(2)}%` : 'N/A'));
    console.log('12-Hour:        ' + (priceChange.h12 ? `${priceChange.h12 > 0 ? '+' : ''}${priceChange.h12.toFixed(2)}%` : 'N/A'));
    console.log('24-Hour:        ' + (priceChange.h24 ? `${priceChange.h24 > 0 ? '+' : ''}${priceChange.h24.toFixed(2)}%` : 'N/A'));
    
    // Calculate anchor prices for Clean Chart
    console.log('\n🎯 CALCULATED ANCHOR PRICES (for Chart)');
    console.log('=' .repeat(70));
    
    if (priceChange.m5) {
      const price5mAgo = currentPrice / (1 + priceChange.m5 / 100);
      console.log(`5m ago:         $${price5mAgo.toFixed(price5mAgo < 0.01 ? 8 : 6)}`);
    }
    
    if (priceChange.h1) {
      const price1hAgo = currentPrice / (1 + priceChange.h1 / 100);
      console.log(`1h ago:         $${price1hAgo.toFixed(price1hAgo < 0.01 ? 8 : 6)}`);
    }
    
    if (priceChange.h6) {
      const price6hAgo = currentPrice / (1 + priceChange.h6 / 100);
      console.log(`6h ago:         $${price6hAgo.toFixed(price6hAgo < 0.01 ? 8 : 6)}`);
    }
    
    if (priceChange.h24) {
      const price24hAgo = currentPrice / (1 + priceChange.h24 / 100);
      console.log(`24h ago:        $${price24hAgo.toFixed(price24hAgo < 0.01 ? 8 : 6)}`);
    }
    
    console.log(`Current:        $${currentPrice.toFixed(currentPrice < 0.01 ? 8 : 6)}`);
    
    // Display volume data
    console.log('\n📊 VOLUME DATA');
    console.log('=' .repeat(70));
    
    const volume = bestPair.volume || {};
    
    console.log('5-Minute:       ' + (volume.m5 ? `$${parseFloat(volume.m5).toLocaleString()}` : 'N/A'));
    console.log('1-Hour:         ' + (volume.h1 ? `$${parseFloat(volume.h1).toLocaleString()}` : 'N/A'));
    console.log('6-Hour:         ' + (volume.h6 ? `$${parseFloat(volume.h6).toLocaleString()}` : 'N/A'));
    console.log('24-Hour:        ' + (volume.h24 ? `$${parseFloat(volume.h24).toLocaleString()}` : 'N/A'));
    
    // Display transaction data
    console.log('\n💼 TRANSACTION DATA');
    console.log('=' .repeat(70));
    
    const txns = bestPair.txns || {};
    
    if (txns.m5) {
      console.log(`5-Minute:       ${txns.m5.buys || 0} buys, ${txns.m5.sells || 0} sells`);
    }
    if (txns.h1) {
      console.log(`1-Hour:         ${txns.h1.buys || 0} buys, ${txns.h1.sells || 0} sells`);
    }
    if (txns.h6) {
      console.log(`6-Hour:         ${txns.h6.buys || 0} buys, ${txns.h6.sells || 0} sells`);
    }
    if (txns.h24) {
      console.log(`24-Hour:        ${txns.h24.buys || 0} buys, ${txns.h24.sells || 0} sells`);
    }
    
    // Display liquidity
    console.log('\n💧 LIQUIDITY & MARKET DATA');
    console.log('=' .repeat(70));
    console.log(`Liquidity:      $${parseFloat(bestPair.liquidity?.usd || '0').toLocaleString()}`);
    console.log(`Market Cap:     $${parseFloat(bestPair.marketCap || '0').toLocaleString()}`);
    console.log(`FDV:            $${parseFloat(bestPair.fdv || '0').toLocaleString()}`);
    
    // Show how the Clean Chart uses this data
    console.log('\n📊 HOW THE CLEAN CHART USES THIS DATA');
    console.log('=' .repeat(70));
    console.log('1. Creates anchor points from price changes (5m, 1h, 6h, 24h)');
    console.log('2. Back-calculates prices at each anchor time');
    console.log('3. Interpolates 25 hourly points between anchors');
    console.log('4. Adds realistic volatility (8% of local range)');
    console.log('5. Renders smooth 24-hour price curve');
    console.log('\nResult: Realistic price chart without needing historical tick data!');
    
    // Display API URL for reference
    console.log('\n🔗 API ENDPOINT');
    console.log('=' .repeat(70));
    console.log(`${DEXSCREENER_API_BASE}/dex/tokens/${TOKEN_ADDRESS}`);
    
    console.log('\n✅ Test complete! This is the data used by the Clean Chart.');
    
  } catch (error) {
    console.error('❌ Error fetching data:', error.message);
  }
}

// Run the test
fetchTokenData();
