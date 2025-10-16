/**
 * ENRICHMENT PROCESS DIAGNOSTIC TOOL
 * 
 * This tool provides comprehensive timing analysis and bottleneck detection
 * for the entire coin enrichment pipeline including:
 * - DexScreener API calls
 * - Rugcheck API calls  
 * - Birdeye API calls
 * - Jupiter search
 * - Data processing overhead
 * 
 * Run with: node backend/diagnostics/enrichment-diagnostic.js <MINT_ADDRESS>
 */

const fetch = require('node-fetch');

class EnrichmentDiagnostic {
  constructor() {
    this.timings = {};
    this.errors = [];
    this.warnings = [];
    
    // API endpoints
    this.apis = {
      dexscreener: 'https://api.dexscreener.com/latest',
      rugcheck: 'https://api.rugcheck.xyz/v1',
      birdeye: 'https://public-api.birdeye.so',
      jupiter: 'https://cache.jup.ag'
    };
    
    // API keys from env
    this.birdeyeKey = process.env.BIRDEYE_API_KEY || '29e047952f0d45ed8927939bbc08f09c';
  }

  // Utility to measure time
  startTimer(label) {
    this.timings[label] = { start: Date.now() };
  }

  endTimer(label) {
    if (this.timings[label]) {
      this.timings[label].end = Date.now();
      this.timings[label].duration = this.timings[label].end - this.timings[label].start;
    }
  }

  // Test DexScreener API
  async testDexScreener(mintAddress) {
    console.log('\n🔍 Testing DexScreener API...');
    this.startTimer('dexscreener_total');
    
    try {
      this.startTimer('dexscreener_request');
      const response = await fetch(`${this.apis.dexscreener}/dex/tokens/${mintAddress}`, {
        headers: {
          'User-Agent': 'Moonfeed/1.0'
        }
      });
      this.endTimer('dexscreener_request');
      
      if (!response.ok) {
        this.errors.push(`DexScreener API returned ${response.status}`);
        return null;
      }

      this.startTimer('dexscreener_parse');
      const data = await response.json();
      this.endTimer('dexscreener_parse');
      
      this.startTimer('dexscreener_process');
      const pairs = data.pairs || [];
      const bestPair = pairs.length > 0 ? pairs.reduce((best, current) => {
        const currentLiq = parseFloat(current.liquidity?.usd || '0');
        const bestLiq = parseFloat(best.liquidity?.usd || '0');
        return currentLiq > bestLiq ? current : best;
      }) : null;
      this.endTimer('dexscreener_process');
      
      this.endTimer('dexscreener_total');
      
      console.log(`✅ DexScreener: ${this.timings.dexscreener_total.duration}ms total`);
      console.log(`   ├─ Network: ${this.timings.dexscreener_request.duration}ms`);
      console.log(`   ├─ Parse: ${this.timings.dexscreener_parse.duration}ms`);
      console.log(`   └─ Process: ${this.timings.dexscreener_process.duration}ms`);
      
      return {
        pairs: pairs.length,
        hasBanner: !!bestPair?.info?.header,
        hasImage: !!bestPair?.info?.imageUrl,
        hasSocials: !!(bestPair?.info?.socials || bestPair?.info?.websites),
        liquidity: bestPair?.liquidity?.usd,
        data: bestPair
      };
      
    } catch (error) {
      this.endTimer('dexscreener_total');
      this.errors.push(`DexScreener error: ${error.message}`);
      console.error('❌ DexScreener failed:', error.message);
      return null;
    }
  }

  // Test Rugcheck API
  async testRugcheck(mintAddress) {
    console.log('\n🔍 Testing Rugcheck API...');
    this.startTimer('rugcheck_total');
    
    try {
      this.startTimer('rugcheck_request');
      let response = await fetch(`${this.apis.rugcheck}/tokens/${mintAddress}/report`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MoonFeed/1.0'
        },
        timeout: 10000
      });
      
      // Try alternative endpoint if report fails
      if (!response.ok) {
        response = await fetch(`${this.apis.rugcheck}/tokens/${mintAddress}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MoonFeed/1.0'
          },
          timeout: 10000
        });
      }
      this.endTimer('rugcheck_request');
      
      if (response.status === 429) {
        this.warnings.push('Rugcheck rate limited');
        this.endTimer('rugcheck_total');
        return null;
      }
      
      if (!response.ok) {
        this.warnings.push(`Rugcheck returned ${response.status}`);
        this.endTimer('rugcheck_total');
        return null;
      }

      this.startTimer('rugcheck_parse');
      const data = await response.json();
      this.endTimer('rugcheck_parse');
      
      this.startTimer('rugcheck_process');
      const rugcheckData = {
        riskLevel: data.riskLevel || 'unknown',
        score: data.score || 0,
        liquidityLocked: this.determineLiquidityLock(data),
        topHolderPct: data.topHolders?.[0]?.pct || 0,
        freezeAuthority: data.tokenMeta?.freezeAuthority === null,
        mintAuthority: data.tokenMeta?.mintAuthority === null
      };
      this.endTimer('rugcheck_process');
      
      this.endTimer('rugcheck_total');
      
      console.log(`✅ Rugcheck: ${this.timings.rugcheck_total.duration}ms total`);
      console.log(`   ├─ Network: ${this.timings.rugcheck_request.duration}ms`);
      console.log(`   ├─ Parse: ${this.timings.rugcheck_parse.duration}ms`);
      console.log(`   └─ Process: ${this.timings.rugcheck_process.duration}ms`);
      
      return rugcheckData;
      
    } catch (error) {
      this.endTimer('rugcheck_total');
      this.warnings.push(`Rugcheck error: ${error.message}`);
      console.warn('⚠️ Rugcheck failed:', error.message);
      return null;
    }
  }

  determineLiquidityLock(data) {
    const markets = data.markets || [];
    for (const market of markets) {
      const lp = market.lp || {};
      const lockedPct = lp.lpLockedPct || 0;
      const burnedPct = lp.lpBurned || 0;
      if (lockedPct > 80 || burnedPct > 90) return true;
    }
    return false;
  }

  // Test Birdeye API
  async testBirdeye(mintAddress) {
    console.log('\n🔍 Testing Birdeye API...');
    this.startTimer('birdeye_total');
    
    try {
      // Test price API
      this.startTimer('birdeye_price_request');
      const priceUrl = `${this.apis.birdeye}/defi/price?address=${mintAddress}`;
      const priceResponse = await fetch(priceUrl, {
        headers: {
          'X-API-KEY': this.birdeyeKey,
          'x-chain': 'solana'
        }
      });
      this.endTimer('birdeye_price_request');
      
      if (!priceResponse.ok) {
        this.warnings.push(`Birdeye price API returned ${priceResponse.status}`);
      }
      
      this.startTimer('birdeye_price_parse');
      const priceData = priceResponse.ok ? await priceResponse.json() : null;
      this.endTimer('birdeye_price_parse');
      
      // Test historical price API
      this.startTimer('birdeye_history_request');
      const historyUrl = `${this.apis.birdeye}/defi/history_price?address=${mintAddress}&address_type=token&type=1H&time_from=${Math.floor(Date.now() / 1000) - 86400}&time_to=${Math.floor(Date.now() / 1000)}`;
      const historyResponse = await fetch(historyUrl, {
        headers: {
          'X-API-KEY': this.birdeyeKey,
          'x-chain': 'solana'
        }
      });
      this.endTimer('birdeye_history_request');
      
      if (!historyResponse.ok) {
        this.warnings.push(`Birdeye history API returned ${historyResponse.status}`);
      }
      
      this.startTimer('birdeye_history_parse');
      const historyData = historyResponse.ok ? await historyResponse.json() : null;
      this.endTimer('birdeye_history_parse');
      
      this.endTimer('birdeye_total');
      
      console.log(`✅ Birdeye: ${this.timings.birdeye_total.duration}ms total`);
      console.log(`   ├─ Price Request: ${this.timings.birdeye_price_request.duration}ms`);
      console.log(`   ├─ Price Parse: ${this.timings.birdeye_price_parse.duration}ms`);
      console.log(`   ├─ History Request: ${this.timings.birdeye_history_request.duration}ms`);
      console.log(`   └─ History Parse: ${this.timings.birdeye_history_parse.duration}ms`);
      
      return {
        hasPrice: !!priceData?.data?.value,
        hasHistory: !!historyData?.data?.items?.length,
        historyPoints: historyData?.data?.items?.length || 0
      };
      
    } catch (error) {
      this.endTimer('birdeye_total');
      this.warnings.push(`Birdeye error: ${error.message}`);
      console.warn('⚠️ Birdeye failed:', error.message);
      return null;
    }
  }

  // Test Jupiter Token List
  async testJupiter(mintAddress) {
    console.log('\n🔍 Testing Jupiter Token List...');
    this.startTimer('jupiter_total');
    
    try {
      this.startTimer('jupiter_request');
      const response = await fetch(`${this.apis.jupiter}/tokens/solana`);
      this.endTimer('jupiter_request');
      
      if (!response.ok) {
        this.warnings.push(`Jupiter API returned ${response.status}`);
        this.endTimer('jupiter_total');
        return null;
      }
      
      this.startTimer('jupiter_parse');
      const tokens = await response.json();
      this.endTimer('jupiter_parse');
      
      this.startTimer('jupiter_search');
      const token = tokens.find(t => t.address === mintAddress);
      this.endTimer('jupiter_search');
      
      this.endTimer('jupiter_total');
      
      console.log(`✅ Jupiter: ${this.timings.jupiter_total.duration}ms total`);
      console.log(`   ├─ Network: ${this.timings.jupiter_request.duration}ms`);
      console.log(`   ├─ Parse: ${this.timings.jupiter_parse.duration}ms`);
      console.log(`   └─ Search: ${this.timings.jupiter_search.duration}ms`);
      console.log(`   └─ Total tokens: ${tokens.length}`);
      
      return {
        found: !!token,
        totalTokens: tokens.length,
        token: token
      };
      
    } catch (error) {
      this.endTimer('jupiter_total');
      this.warnings.push(`Jupiter error: ${error.message}`);
      console.warn('⚠️ Jupiter failed:', error.message);
      return null;
    }
  }

  // Run complete diagnostic
  async runDiagnostic(mintAddress) {
    console.log('\n' + '='.repeat(60));
    console.log('🔬 ENRICHMENT DIAGNOSTIC TOOL');
    console.log('='.repeat(60));
    console.log(`\n📍 Analyzing: ${mintAddress}\n`);
    
    this.startTimer('total_enrichment');
    
    // Run all tests in parallel (how it might be optimized)
    console.log('🔄 Running API calls in PARALLEL...\n');
    const parallelStart = Date.now();
    const [dexResult, rugResult, birdeyeResult, jupiterResult] = await Promise.all([
      this.testDexScreener(mintAddress),
      this.testRugcheck(mintAddress),
      this.testBirdeye(mintAddress),
      this.testJupiter(mintAddress)
    ]);
    const parallelDuration = Date.now() - parallelStart;
    
    // Run tests sequentially (current implementation)
    console.log('\n🔄 Running API calls SEQUENTIALLY...\n');
    const sequentialStart = Date.now();
    await this.testDexScreener(mintAddress);
    await this.testRugcheck(mintAddress);
    await this.testBirdeye(mintAddress);
    await this.testJupiter(mintAddress);
    const sequentialDuration = Date.now() - sequentialStart;
    
    this.endTimer('total_enrichment');
    
    // Generate report
    this.generateReport(parallelDuration, sequentialDuration, {
      dexResult,
      rugResult,
      birdeyeResult,
      jupiterResult
    });
  }

  generateReport(parallelDuration, sequentialDuration, results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC REPORT');
    console.log('='.repeat(60));
    
    console.log('\n⏱️  TIMING ANALYSIS:');
    console.log('─'.repeat(60));
    
    const sortedTimings = Object.entries(this.timings)
      .filter(([key]) => key.includes('_total'))
      .sort((a, b) => b[1].duration - a[1].duration);
    
    sortedTimings.forEach(([key, timing]) => {
      const percentage = ((timing.duration / sequentialDuration) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(timing.duration / 50));
      console.log(`${key.padEnd(25)}: ${timing.duration}ms ${bar} (${percentage}%)`);
    });
    
    console.log('\n🔀 PARALLEL vs SEQUENTIAL:');
    console.log('─'.repeat(60));
    console.log(`Parallel execution:   ${parallelDuration}ms`);
    console.log(`Sequential execution: ${sequentialDuration}ms`);
    console.log(`Speed improvement:    ${((1 - parallelDuration / sequentialDuration) * 100).toFixed(1)}% faster`);
    console.log(`Time saved:           ${sequentialDuration - parallelDuration}ms`);
    
    console.log('\n✅ DATA QUALITY:');
    console.log('─'.repeat(60));
    console.log(`DexScreener:`);
    console.log(`  ├─ Pairs found: ${results.dexResult?.pairs || 0}`);
    console.log(`  ├─ Has banner: ${results.dexResult?.hasBanner ? '✓' : '✗'}`);
    console.log(`  ├─ Has image: ${results.dexResult?.hasImage ? '✓' : '✗'}`);
    console.log(`  └─ Has socials: ${results.dexResult?.hasSocials ? '✓' : '✗'}`);
    
    console.log(`Rugcheck:`);
    if (results.rugResult) {
      console.log(`  ├─ Risk level: ${results.rugResult.riskLevel}`);
      console.log(`  ├─ Score: ${results.rugResult.score}`);
      console.log(`  └─ Liquidity locked: ${results.rugResult.liquidityLocked ? '✓' : '✗'}`);
    } else {
      console.log(`  └─ No data available`);
    }
    
    console.log(`Birdeye:`);
    if (results.birdeyeResult) {
      console.log(`  ├─ Has price: ${results.birdeyeResult.hasPrice ? '✓' : '✗'}`);
      console.log(`  └─ History points: ${results.birdeyeResult.historyPoints}`);
    } else {
      console.log(`  └─ No data available`);
    }
    
    console.log(`Jupiter:`);
    console.log(`  ├─ Found in list: ${results.jupiterResult?.found ? '✓' : '✗'}`);
    console.log(`  └─ Total tokens: ${results.jupiterResult?.totalTokens || 0}`);
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      console.log('─'.repeat(60));
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      console.log('─'.repeat(60));
      this.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(60));
    
    // Analyze bottlenecks
    const slowestApi = sortedTimings[0];
    if (slowestApi && slowestApi[1].duration > 1000) {
      console.log(`  ⚡ ${slowestApi[0]} is the slowest (${slowestApi[1].duration}ms)`);
      console.log(`     Consider caching or using a faster alternative`);
    }
    
    if (parallelDuration < sequentialDuration * 0.7) {
      console.log(`  ⚡ Parallel execution saves ${sequentialDuration - parallelDuration}ms`);
      console.log(`     Implement Promise.all() for independent API calls`);
    }
    
    if (this.warnings.filter(w => w.includes('rate limit')).length > 0) {
      console.log(`  ⚡ Rate limiting detected - implement request queue`);
    }
    
    if (!results.dexResult?.hasBanner && !results.dexResult?.hasImage) {
      console.log(`  ⚡ No visual assets found - generate placeholder immediately`);
    }
    
    console.log(`  ⚡ Use on-demand enrichment: enrich when user views coin`);
    console.log(`  ⚡ Cache enriched data for 5-15 minutes to reduce API calls`);
    console.log(`  ⚡ Prioritize DexScreener (fastest, most reliable)`);
    console.log(`  ⚡ Make Rugcheck/Birdeye optional (slower, can fail)`);
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Run diagnostic
if (require.main === module) {
  const mintAddress = process.argv[2] || '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr'; // WIF as default
  
  const diagnostic = new EnrichmentDiagnostic();
  diagnostic.runDiagnostic(mintAddress)
    .then(() => {
      console.log('✅ Diagnostic complete\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Diagnostic failed:', error);
      process.exit(1);
    });
}

module.exports = EnrichmentDiagnostic;
