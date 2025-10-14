// Diagnostic script to check ENSO coin enrichment and liquidity data
const fetch = require('node-fetch');
const dexscreenerService = require('./dexscreenerService');

const ENSO_ADDRESS = 'DRCWvketD3CBESseRMke5QaJ6GLQ4Xe1TMPT23zWbd4h';

async function diagnoseENSO() {
  console.log('\n🔍 ═══════════════════════════════════════════════════');
  console.log('🔍 ENSO LIQUIDITY DIAGNOSTIC');
  console.log('🔍 Token: ENSO (DRCWvketD3CBESseRMke5QaJ6GLQ4Xe1TMPT23zWbd4h)');
  console.log('🔍 ═══════════════════════════════════════════════════\n');

  try {
    // Step 1: Check what's in new-coins-batch.json
    console.log('📦 Step 1: Checking new-coins-batch.json...\n');
    const fs = require('fs');
    const newCoinsBatchData = JSON.parse(fs.readFileSync('./new-coins-batch.json', 'utf8'));
    const newCoinsBatch = newCoinsBatchData.coins || [];
    const ensoInBatch = newCoinsBatch.find(coin => coin.mintAddress === ENSO_ADDRESS);
    
    if (ensoInBatch) {
      console.log('✅ Found ENSO in new-coins-batch.json:');
      console.log({
        name: ensoInBatch.name,
        symbol: ensoInBatch.symbol,
        liquidity: ensoInBatch.liquidity,
        liquidityUsd: ensoInBatch.liquidityUsd,
        enriched: ensoInBatch.enriched,
        dexscreenerProcessedAt: ensoInBatch.dexscreenerProcessedAt,
        lastEnrichedAt: ensoInBatch.lastEnrichedAt
      });
    } else {
      console.log('❌ ENSO not found in new-coins-batch.json');
    }

    // Step 2: Fetch fresh data from DexScreener API directly
    console.log('\n\n🌐 Step 2: Fetching FRESH data from DexScreener API...\n');
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ENSO_ADDRESS}`, {
      headers: {
        'User-Agent': 'Moonfeed/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const freshData = await response.json();
    console.log('✅ Raw DexScreener response:', JSON.stringify(freshData, null, 2));

    if (freshData.pairs && freshData.pairs.length > 0) {
      console.log('\n\n📊 Step 3: Analyzing all pairs returned...\n');
      
      freshData.pairs.forEach((pair, index) => {
        console.log(`\nPair #${index + 1}:`);
        console.log({
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          baseToken: pair.baseToken?.symbol,
          quoteToken: pair.quoteToken?.symbol,
          priceUsd: pair.priceUsd,
          liquidity: pair.liquidity,
          liquidityUsd: pair.liquidity?.usd,
          volume24h: pair.volume?.h24,
          priceChange24h: pair.priceChange?.h24,
          pairCreatedAt: pair.pairCreatedAt,
          url: pair.url
        });
      });

      // Find the best pair (highest liquidity)
      console.log('\n\n🏆 Step 4: Finding best pair (highest liquidity)...\n');
      const bestPair = freshData.pairs.reduce((best, current) => {
        const currentLiquidity = parseFloat(current.liquidity?.usd || '0');
        const bestLiquidity = parseFloat(best.liquidity?.usd || '0');
        return currentLiquidity > bestLiquidity ? current : best;
      });

      console.log('✅ Best pair identified:');
      console.log({
        pairAddress: bestPair.pairAddress,
        dexId: bestPair.dexId,
        liquidityUsd: bestPair.liquidity?.usd,
        priceUsd: bestPair.priceUsd,
        volume24h: bestPair.volume?.h24,
        url: bestPair.url
      });

      // Step 5: Check what enrichCoin would return
      console.log('\n\n🎨 Step 5: Testing enrichCoin function...\n');
      const mockCoin = {
        mintAddress: ENSO_ADDRESS,
        name: 'Enso',
        symbol: 'ENSO',
        liquidity: 127000,
        liquidityUsd: 127000,
        volume_24h_usd: 999999, // Old stale volume
        market_cap_usd: 888888  // Old stale market cap
      };

      const enrichedCoin = await dexscreenerService.enrichCoin(mockCoin, {
        forceBannerEnrichment: true
      });

      console.log('✅ Enriched coin result:');
      console.log({
        liquidity: enrichedCoin.liquidity,
        liquidityUsd: enrichedCoin.liquidityUsd,
        volume24h: enrichedCoin.volume24h,
        marketCap: enrichedCoin.marketCap,
        priceChange24h: enrichedCoin.priceChange24h,
        enriched: enrichedCoin.enriched,
        dexscreenerUrl: enrichedCoin.dexscreenerUrl
      });

      // Step 6: Compare stored vs fresh data
      console.log('\n\n⚖️  Step 6: COMPARISON - Stored vs Fresh Data\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('LIQUIDITY:');
      console.log(`  Stored:   $${ensoInBatch?.liquidity || 'N/A'}`);
      console.log(`  Fresh:    $${bestPair.liquidity?.usd || 'N/A'}`);
      console.log(`  Enriched: $${enrichedCoin.liquidity || 'N/A'}`);
      console.log('');
      console.log('VOLUME 24H:');
      console.log(`  Stored:   $${ensoInBatch?.volume_24h_usd || 'N/A'}`);
      console.log(`  Fresh:    $${bestPair.volume?.h24 || 'N/A'}`);
      console.log(`  Enriched: $${enrichedCoin.volume24h || 'N/A'}`);
      console.log('');
      console.log('MARKET CAP:');
      console.log(`  Stored:   $${ensoInBatch?.market_cap_usd || 'N/A'}`);
      console.log(`  Fresh:    $${bestPair.marketCap || 'N/A'}`);
      console.log(`  Enriched: $${enrichedCoin.marketCap || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const storedLiq = parseFloat(ensoInBatch?.liquidity || '0');
      const freshLiq = parseFloat(bestPair.liquidity?.usd || '0');
      const enrichedLiq = parseFloat(enrichedCoin.liquidity || '0');
      
      const storedVol = parseFloat(ensoInBatch?.volume_24h_usd || '0');
      const freshVol = parseFloat(bestPair.volume?.h24 || '0');
      const enrichedVol = parseFloat(enrichedCoin.volume24h || '0');
      
      const storedMc = parseFloat(ensoInBatch?.market_cap_usd || '0');
      const freshMc = parseFloat(bestPair.marketCap || '0');
      const enrichedMc = parseFloat(enrichedCoin.marketCap || '0');

      console.log('\n📊 Enrichment Accuracy:');
      console.log(`  Liquidity:   ${Math.abs(enrichedLiq - freshLiq) < 1 ? '✅ CORRECT' : '❌ INCORRECT'}`);
      console.log(`  Volume 24h:  ${Math.abs(enrichedVol - freshVol) < 1 ? '✅ CORRECT' : '❌ INCORRECT'}`);
      console.log(`  Market Cap:  ${Math.abs(enrichedMc - freshMc) < 1 ? '✅ CORRECT' : '❌ INCORRECT'}`);

      // Step 7: Diagnosis
      console.log('\n\n🩺 Step 7: DIAGNOSIS\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const hasIssues = 
        Math.abs(enrichedLiq - freshLiq) >= 1 ||
        Math.abs(enrichedVol - freshVol) >= 1 ||
        Math.abs(enrichedMc - freshMc) >= 1;
      
      if (hasIssues) {
        console.log('❌ ISSUE FOUND: Enriched data does not match DexScreener!');
        console.log('\nPossible causes:');
        console.log('1. ❌ Coin was NOT re-enriched after initial fetch');
        console.log('2. ❌ Auto-enrichment is not updating NEW feed coins');
        console.log('3. ❌ enrichCoin is not updating fields properly');
        console.log('4. ❌ New feed refresh is not clearing old data');
        
        console.log('\nRecommended fixes:');
        console.log('1. ✅ Ensure enrichCoin ALWAYS updates market data from DexScreener');
        console.log('2. ✅ Check that NEW feed auto-enricher is running properly');
        console.log('3. ✅ Verify that all fields are being overwritten (not preserved)');
        console.log('4. ✅ Check newFeedAutoRefresher is clearing enrichment data');
      } else {
        console.log('✅ All market data matches DexScreener - system working correctly!');
        console.log('✅ Liquidity, Volume, and Market Cap are all accurate');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } else {
      console.log('⚠️  No pairs found on DexScreener for this token');
    }

  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
    console.error(error.stack);
  }

  console.log('\n🔍 ═══════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC COMPLETE');
  console.log('🔍 ═══════════════════════════════════════════════════\n');
}

// Run diagnostic
diagnoseENSO();
