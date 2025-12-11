/**
 * ON-DEMAND ENRICHMENT SERVICE
 * 
 * Provides fast, intelligent enrichment that prioritizes what the user is viewing.
 * Features:
 * - Parallel API calls for maximum speed
 * - Smart caching with TTL
 * - Priority queue for active coins
 * - Graceful degradation if APIs fail
 * - Minimal code, maximum efficiency
 * 
 * Performance Optimizations:
 * - HTTP connection pooling for faster requests
 * - Parallel rugcheck start (no blocking)
 * - Aggressive timeouts (2s rugcheck wait, 3s fetch)
 */

const fetch = require('node-fetch');
const http = require('http');
const https = require('https');
const pumpFunService = require('./pumpFunService');
const jupiterBatchService = require('./JupiterBatchService');
const CompactCacheStorage = require('./CompactCacheStorage');
const moonshotMetadataService = require('./moonshotMetadataService');

// 🚀 PERFORMANCE: HTTP connection pooling for faster requests
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveMsecs: 30000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveMsecs: 30000
});

// Helper to get appropriate agent for URL
const getAgent = (url) => url.startsWith('https:') ? httpsAgent : httpAgent;

class OnDemandEnrichmentService {
  constructor() {
    // API endpoints
    this.apis = {
      dexscreener: 'https://api.dexscreener.com/latest',
      rugcheck: 'https://api.rugcheck.xyz/v1',
      birdeye: 'https://public-api.birdeye.so'
    };
    
    // 🚀 OPTIMIZED CACHE - Using compact storage (40% less RAM)
    this.cache = new CompactCacheStorage({
      maxSize: 500,
      ttl: 10 * 60 * 1000 // 10 minutes
    });
    
    // Legacy cache support
    this.cacheTTL = 10 * 60 * 1000;
    
    // Priority queue for enrichment
    this.enrichmentQueue = new Set();
    this.activeEnrichments = new Map();
    
    // API keys
    this.birdeyeKey = process.env.BIRDEYE_API_KEY || '29e047952f0d45ed8927939bbc08f09c';
    
    // Pump.fun service
    this.pumpFunService = pumpFunService;
    
    // Performance tracking
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalEnrichments: 0,
      averageTime: 0
    };
  }

  /**
   * Main enrichment method - enriches a coin with ALL data sources in parallel
   * Uses PROGRESSIVE LOADING for instant UI updates
   * @param {Object} coin - Base coin object with at least mintAddress
   * @param {Object} options - Enrichment options
   * @returns {Object} Enriched coin object
   */
  async enrichCoin(coin, options = {}) {
    const {
      skipCache = false,
      priorityApis = ['dexscreener'], // APIs to wait for
      optionalApis = ['rugcheck'], // APIs that can fail (removed birdeye)
      timeout = 8000, // 8s for fast APIs (dex, jupiter, pumpfun)
      progressCallback = null // 🆕 Callback for progressive updates
    } = options;

    const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
    if (!mintAddress) {
      console.warn('⚠️ No mint address provided for enrichment');
      return coin;
    }

    // Check GLOBAL cache first - prevents redundant enrichment across all feeds
    if (!skipCache) {
      const cached = this.cache.get(mintAddress);
      if (cached) {
        console.log(`✅ [GLOBAL CACHE HIT] ${coin.symbol || mintAddress} - saved enrichment API calls`);
        this.stats.cacheHits++;
        
        // 🔑 KEY FIX: If rugcheck was pending, check if it's now available in batch processor cache
        if (cached.rugcheckPending || !cached.rugcheckVerified) {
          try {
            const rugcheckBatchProcessor = require('./RugcheckBatchProcessor');
            const freshRugcheck = rugcheckBatchProcessor.getCached(mintAddress);
            
            if (freshRugcheck && freshRugcheck.rugcheckAvailable) {
              console.log(`🔒 [RUGCHECK UPDATE] ${coin.symbol || mintAddress} - applying fresh rugcheck data`);
              // Merge fresh rugcheck data with cached data
              const updatedData = {
                ...cached,
                liquidityLocked: freshRugcheck.liquidityLocked,
                lockPercentage: freshRugcheck.lockPercentage,
                burnPercentage: freshRugcheck.burnPercentage,
                rugcheckScore: freshRugcheck.score,
                riskLevel: freshRugcheck.riskLevel,
                freezeAuthority: freshRugcheck.freezeAuthority,
                mintAuthority: freshRugcheck.mintAuthority,
                topHolderPercent: freshRugcheck.topHolderPercent,
                isHoneypot: freshRugcheck.isHoneypot,
                rugcheckVerified: true,
                rugcheckFromCache: true,
                rugcheckPending: false
              };
              // Update the cache with the complete data
              this.cache.set(mintAddress, coin, updatedData);
              return { ...coin, ...updatedData };
            } else {
              // Still not in batch processor cache - fetch immediately
              console.log(`⚡ [IMMEDIATE FETCH] ${coin.symbol || mintAddress} - fetching rugcheck now...`);
              try {
                const immediateRugcheck = await rugcheckBatchProcessor.fetchImmediately(mintAddress, coin.symbol);
                
                if (immediateRugcheck && immediateRugcheck.rugcheckAvailable) {
                  const updatedData = {
                    ...cached,
                    liquidityLocked: immediateRugcheck.liquidityLocked,
                    lockPercentage: immediateRugcheck.lockPercentage,
                    burnPercentage: immediateRugcheck.burnPercentage,
                    rugcheckScore: immediateRugcheck.score,
                    riskLevel: immediateRugcheck.riskLevel,
                    freezeAuthority: immediateRugcheck.freezeAuthority,
                    mintAuthority: immediateRugcheck.mintAuthority,
                    topHolderPercent: immediateRugcheck.topHolderPercent,
                    isHoneypot: immediateRugcheck.isHoneypot,
                    rugcheckVerified: true,
                    rugcheckImmediate: true,
                    rugcheckPending: false
                  };
                  this.cache.set(mintAddress, coin, updatedData);
                  return { ...coin, ...updatedData };
                }
              } catch (immErr) {
                console.warn(`⚠️ Immediate rugcheck failed for ${coin.symbol}:`, immErr.message);
              }
            }
          } catch (err) {
            console.warn(`⚠️ Error checking rugcheck cache for ${coin.symbol}:`, err.message);
          }
        }
        
        return { ...coin, ...cached };
      }
    }

    this.stats.cacheMisses++;
    const startTime = Date.now();

    console.log(`🔄 Enriching ${coin.symbol || mintAddress} on-demand (PARALLEL MODE)...`);

    try {
      // 🚀 PHASE 1: Fast APIs (DexScreener, Jupiter, Pump.fun, Moonshot)
      // Rugcheck is handled separately via batch processor cache
      const fastApis = {
        dex: this.fetchDexScreener(mintAddress),
        jupiter: jupiterBatchService.getTokenData(mintAddress),
        pumpfun: this.fetchPumpFunDescription(mintAddress),
        moonshot: moonshotMetadataService.getMetadata(mintAddress) // 🌙 Fetch Moonshot metadata
      };

      // Wait for fast APIs only
      const fastResults = await Promise.race([
        Promise.allSettled(Object.values(fastApis)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fast API timeout')), timeout)
        )
      ]);

      const [dexResult, jupiterResult, pumpfunResult, moonshotResult] = fastResults;
      
      const enrichedData = {
        ...coin,
        enriched: true,
        enrichedAt: new Date().toISOString(),
        enrichmentTime: Date.now() - startTime
      };

      // Apply DexScreener data (priority)
      let hasDexScreenerData = false;
      if (dexResult.status === 'fulfilled' && dexResult.value) {
        Object.assign(enrichedData, this.processDexScreenerData(dexResult.value, coin));
        hasDexScreenerData = true;
        console.log(`✅ Phase 1: DexScreener applied (${Date.now() - startTime}ms)`);
      }

      // 🌙 Apply Moonshot metadata (high priority for images)
      if (moonshotResult.status === 'fulfilled' && moonshotResult.value) {
        const moonshotData = moonshotResult.value;
        
        // Override with Moonshot images if available (they're usually higher quality)
        if (moonshotData.profileImage) {
          enrichedData.profileImage = moonshotData.profileImage;
          enrichedData.image = moonshotData.profileImage;
          enrichedData.logo = moonshotData.profileImage;
        }
        
        if (moonshotData.banner) {
          enrichedData.banner = moonshotData.banner;
        }
        
        // Add Moonshot socials if not already present
        if (moonshotData.socials) {
          if (moonshotData.socials.twitter && !enrichedData.twitter) {
            enrichedData.twitter = moonshotData.socials.twitter;
          }
          if (moonshotData.socials.telegram && !enrichedData.telegram) {
            enrichedData.telegram = moonshotData.socials.telegram;
          }
          if (moonshotData.socials.website && !enrichedData.website) {
            enrichedData.website = moonshotData.socials.website;
          }
        }
        
        // Add Moonshot description if available and no Pump.fun description
        if (moonshotData.description && !enrichedData.description) {
          enrichedData.description = moonshotData.description;
          enrichedData.descriptionSource = 'moonshot';
        }
        
        console.log(`✅ Phase 1: Moonshot metadata applied (${Date.now() - startTime}ms)`);
      }

      // ✅ Apply Jupiter Ultra data for holderCount
      if (jupiterResult.status === 'fulfilled' && jupiterResult.value) {
        enrichedData.holderCount = jupiterResult.value.holderCount;
        enrichedData.holders = jupiterResult.value.holderCount;
        console.log(`✅ Phase 1: Jupiter holders applied (${Date.now() - startTime}ms)`);
      } else {
        console.warn(`⚠️ Jupiter Ultra data not available for ${coin.symbol}:`,
          jupiterResult.status === 'rejected' ? jupiterResult.reason?.message : 'No data returned');
      }

      // 🆕 Preserve original holder data if enrichment didn't provide it
      if (!enrichedData.holders && !enrichedData.holderCount) {
        if (coin.holders) {
          enrichedData.holders = coin.holders;
        } else if (coin.holderCount) {
          enrichedData.holderCount = coin.holderCount;
        }
      }

      // Apply Pump.fun description (highest priority for descriptions)
      if (pumpfunResult.status === 'fulfilled' && pumpfunResult.value) {
        enrichedData.description = pumpfunResult.value;
        enrichedData.descriptionSource = 'pump.fun';
        console.log(`✅ Phase 1: Pump.fun description applied (${Date.now() - startTime}ms)`);
      } else if (!enrichedData.description) {
        // Remove description entirely if no Pump.fun or Moonshot description
        delete enrichedData.description;
        console.log(`ℹ️ No description for ${coin.symbol}, leaving blank`);
      }

      // ✨ ALWAYS GENERATE CHART with LIVE JUPITER PRICE
      // Priority: coin.price_usd (Jupiter) > enrichedData.price_usd (DexScreener)
      const livePrice = coin.price_usd || coin.priceUsd || coin.price || enrichedData.price_usd;
      
      // 🌙 MOONFEED SPECIAL HANDLING: For coins without DEX data (pre-bonding curve)
      const isMoonfeedNative = !hasDexScreenerData && (
        coin.source === 'moonfeed' || 
        coin.isMoonfeedNative ||
        mintAddress === 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon' // $MOO token
      );
      
      if (isMoonfeedNative) {
        console.log(`🌙 Moonfeed-native coin detected: ${coin.symbol || mintAddress}`);
        
        // Mark as Moonfeed native for frontend handling
        enrichedData.isMoonfeedNative = true;
        enrichedData.source = 'moonfeed';
        
        // Try to get token info from Solana RPC
        let rpcInfo = null;
        try {
          rpcInfo = await this.fetchTokenInfoFromRPC(mintAddress);
        } catch (error) {
          console.warn(`⚠️ Could not fetch RPC info for ${coin.symbol}:`, error.message);
        }
        
        // Determine price to use (priority: livePrice > lastTradePrice > estimatedPrice)
        let priceToUse = livePrice;
        
        if (!priceToUse && rpcInfo?.lastTradePrice) {
          priceToUse = rpcInfo.lastTradePrice;
          console.log(`💰 Using last trade price for ${coin.symbol}: $${priceToUse}`);
        } else if (!priceToUse && rpcInfo?.estimatedPrice) {
          priceToUse = rpcInfo.estimatedPrice;
          console.log(`💰 Using estimated starting price for ${coin.symbol}: $${priceToUse}`);
        }
        
        if (priceToUse) {
          enrichedData.price_usd = priceToUse;
          enrichedData.priceUsd = priceToUse;
          enrichedData.baseTokenPrice = priceToUse;
          enrichedData.preLaunch = !livePrice && rpcInfo?.isEstimate; // True only if truly estimated
          
          // Use RPC data for supply and market cap
          if (rpcInfo?.supply) {
            enrichedData.totalSupply = rpcInfo.supply;
            enrichedData.marketCap = rpcInfo.marketCap || (priceToUse * rpcInfo.supply);
            enrichedData.market_cap_usd = enrichedData.marketCap;
            console.log(`📊 Market cap: $${enrichedData.marketCap.toLocaleString()}`);
          }
          
          // Use RPC volume if available
          if (rpcInfo?.volume24h !== undefined) {
            enrichedData.volume24h = rpcInfo.volume24h;
            enrichedData.volume_24h_usd = rpcInfo.volume24h;
            console.log(`📊 24h volume: $${rpcInfo.volume24h.toLocaleString()}`);
          }
          
          console.log(`💰 Using ${livePrice ? 'live' : (rpcInfo?.lastTradePrice ? 'last trade' : 'estimated')} price: $${priceToUse}`);
        } else {
          // Absolutely no price available
          enrichedData.price_usd = null;
          enrichedData.priceUsd = null;
          enrichedData.preLaunch = true;
          console.log(`⏳ No price yet for ${coin.symbol} - awaiting first trade`);
        }
        
        // Set default values for missing data (don't override RPC data)
        if (!enrichedData.liquidity) {
          enrichedData.liquidity = coin.liquidity || null;
        }
        if (!enrichedData.volume24h) {
          enrichedData.volume24h = coin.volume24h || null;
        }
        
        // Generate chart if we have any price
        if (priceToUse) {
          enrichedData.cleanChartData = {
            currentPrice: priceToUse,
            change24h: enrichedData.priceChange?.h24 || 0,
            dataPoints: this.generateMoonfeedChart(priceToUse),
            isMoonfeedNative: true,
            preLaunch: !livePrice // Flag to show "waiting for live price"
          };
          console.log(`✅ Generated Moonfeed chart with ${livePrice ? 'live' : 'estimated'} price: $${priceToUse}`);
        }
      } else if (livePrice && hasDexScreenerData) {
        // Override DexScreener price with live Jupiter price for accuracy
        if (coin.price_usd && enrichedData.price_usd && coin.price_usd !== enrichedData.price_usd) {
          console.log(`🔄 Overriding DexScreener price $${enrichedData.price_usd} with live Jupiter price $${livePrice}`);
        }
        enrichedData.price_usd = livePrice; // Always use live price
        
        // Generate clean chart with live price and DexScreener price changes
        const priceChanges = enrichedData.priceChange || enrichedData.priceChanges || {};
        enrichedData.cleanChartData = this.generateCleanChart(livePrice, priceChanges);
        
        if (enrichedData.cleanChartData) {
          console.log(`✅ Generated clean chart with ${enrichedData.cleanChartData.dataPoints?.length || 0} points`);
        } else {
          console.warn(`⚠️ Failed to generate clean chart for ${coin.symbol}`);
        }
      } else if (!hasDexScreenerData) {
        console.warn(`⚠️ No DexScreener data for ${coin.symbol}, cannot generate chart`);
      } else {
        console.warn(`⚠️ No valid price for ${coin.symbol}, cannot generate chart`);
      }

      // 🚀 PHASE 2: Get rugcheck data from batch processor cache
      // The batch processor pre-fetches rugcheck data in the background when feeds are updated
      // This eliminates on-demand rugcheck API calls and prevents rate limiting at scale
      console.log(`🔐 Phase 2: Checking rugcheck cache for ${coin.symbol}...`);
      
      try {
        // Import batch processor (lazy load to avoid circular dependency)
        const rugcheckBatchProcessor = require('./RugcheckBatchProcessor');
        
        // Try to get from cache first (instant, no API call)
        const cachedRugcheck = rugcheckBatchProcessor.getCached(mintAddress);
        
        if (cachedRugcheck && cachedRugcheck.rugcheckAvailable) {
          // Apply cached rugcheck data
          enrichedData.liquidityLocked = cachedRugcheck.liquidityLocked;
          enrichedData.lockPercentage = cachedRugcheck.lockPercentage;
          enrichedData.burnPercentage = cachedRugcheck.burnPercentage;
          enrichedData.rugcheckScore = cachedRugcheck.score;
          enrichedData.riskLevel = cachedRugcheck.riskLevel;
          enrichedData.freezeAuthority = cachedRugcheck.freezeAuthority;
          enrichedData.mintAuthority = cachedRugcheck.mintAuthority;
          enrichedData.topHolderPercent = cachedRugcheck.topHolderPercent;
          enrichedData.isHoneypot = cachedRugcheck.isHoneypot;
          enrichedData.rugcheckVerified = true;
          enrichedData.rugcheckFromCache = true;
          
          console.log(`✅ Phase 2: Rugcheck from cache in ${Date.now() - startTime}ms`);
          console.log(`🔐 Rugcheck data:`, {
            liquidityLocked: cachedRugcheck.liquidityLocked,
            lockPercentage: cachedRugcheck.lockPercentage,
            riskLevel: cachedRugcheck.riskLevel
          });
        } else {
          // Not in cache - fetch immediately for on-demand requests (user is actively viewing)
          console.log(`⚡ Fetching rugcheck IMMEDIATELY for ${coin.symbol} (on-demand)...`);
          try {
            const immediateRugcheck = await rugcheckBatchProcessor.fetchImmediately(mintAddress, coin.symbol);
            
            if (immediateRugcheck && immediateRugcheck.rugcheckAvailable) {
              enrichedData.liquidityLocked = immediateRugcheck.liquidityLocked;
              enrichedData.lockPercentage = immediateRugcheck.lockPercentage;
              enrichedData.burnPercentage = immediateRugcheck.burnPercentage;
              enrichedData.rugcheckScore = immediateRugcheck.score;
              enrichedData.riskLevel = immediateRugcheck.riskLevel;
              enrichedData.freezeAuthority = immediateRugcheck.freezeAuthority;
              enrichedData.mintAuthority = immediateRugcheck.mintAuthority;
              enrichedData.topHolderPercent = immediateRugcheck.topHolderPercent;
              enrichedData.isHoneypot = immediateRugcheck.isHoneypot;
              enrichedData.rugcheckVerified = true;
              enrichedData.rugcheckImmediate = true;
              console.log(`✅ Immediate rugcheck complete for ${coin.symbol}: ${immediateRugcheck.liquidityLocked ? 'LOCKED 🔒' : 'unlocked'}`);
            } else {
              // Fallback returned - API may have failed
              enrichedData.riskLevel = 'unknown';
              enrichedData.rugcheckUnavailable = true;
              console.log(`⚠️ Immediate rugcheck returned fallback for ${coin.symbol}`);
            }
          } catch (immError) {
            console.warn(`⚠️ Immediate rugcheck failed for ${coin.symbol}:`, immError.message);
            enrichedData.riskLevel = 'unknown';
            enrichedData.rugcheckUnavailable = true;
          }
        }
      } catch (rugError) {
        console.warn(`⚠️ Rugcheck cache error for ${coin.symbol}:`, rugError.message);
        // DON'T set liquidityLocked to false - leave it undefined so UI shows "unavailable" 
        // instead of incorrectly showing "UNLOCKED" for coins that ARE locked
        enrichedData.riskLevel = 'unknown';
        enrichedData.rugcheckUnavailable = true;
      }

      // Update enrichment time to include rugcheck attempt
      enrichedData.enrichmentTime = Date.now() - startTime;

      // Cache complete data (with or without rugcheck)
      this.cache.set(mintAddress, coin, enrichedData);
      console.log(`✅ Cached ${coin.symbol} in ${enrichedData.enrichmentTime}ms`);

      // Update stats
      this.stats.totalEnrichments++;
      this.stats.averageTime = 
        (this.stats.averageTime * (this.stats.totalEnrichments - 1) + enrichedData.enrichmentTime) / 
        this.stats.totalEnrichments;

      return enrichedData;

    } catch (error) {
      console.error(`❌ Enrichment failed for ${coin.symbol}:`, error.message);
      
      // Return coin with minimal enrichment
      return {
        ...coin,
        enriched: false,
        enrichmentError: error.message,
        enrichmentTime: Date.now() - startTime
      };
    }
  }

  /**
   * Batch enrich multiple coins efficiently
   * 🆕 Now benefits from GLOBAL CACHE - tokens enriched in one feed won't be re-enriched in another
   */
  async enrichCoins(coins, options = {}) {
    const { 
      maxConcurrent = 5,
      ...enrichOptions 
    } = options;

    console.log(`🚀 Batch enriching ${coins.length} coins...`);
    const startTime = Date.now();
    const initialCacheHits = this.stats.cacheHits;

    const results = [];
    
    // Process in batches to avoid overwhelming APIs
    for (let i = 0; i < coins.length; i += maxConcurrent) {
      const batch = coins.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(coin => this.enrichCoin(coin, enrichOptions))
      );
      results.push(...batchResults);
    }

    const duration = Date.now() - startTime;
    const enrichedCount = results.filter(c => c.enriched).length;
    const cacheHitsInBatch = this.stats.cacheHits - initialCacheHits;
    
    console.log(`✅ Batch enrichment complete: ${enrichedCount}/${coins.length} enriched in ${duration}ms (${cacheHitsInBatch} cache hits saved ${(cacheHitsInBatch * 3).toFixed(1)}s)`);
    
    return results;
  }

  /**
   * 🆕 PHASE 2: Background Rugcheck Processing
   * Runs rugcheck async without blocking Phase 1 return
   * Updates cache when complete for future lookups
   */
  async startBackgroundRugcheck(mintAddress, originalCoin, fastEnrichedData) {
    try {
      console.log(`🔐 Phase 2: Starting background rugcheck for ${originalCoin.symbol}...`);
      const rugcheckStartTime = Date.now();
      
      // Fetch rugcheck data (5-8 seconds)
      const rugData = await this.fetchRugcheck(mintAddress);
      
      if (rugData) {
        const rugcheckData = this.processRugcheckData(rugData);
        
        // Merge with fast data
        const fullyEnrichedData = {
          ...fastEnrichedData,
          ...rugcheckData,
          phase: 'complete', // Mark as fully enriched
          rugcheckTime: Date.now() - rugcheckStartTime
        };
        
        console.log(`✅ Phase 2 complete for ${originalCoin.symbol} in ${fullyEnrichedData.rugcheckTime}ms`);
        console.log(`🔐 Rugcheck data:`, {
          liquidityLocked: rugcheckData.liquidityLocked,
          lockPercentage: rugcheckData.lockPercentage,
          riskLevel: rugcheckData.riskLevel,
          verified: rugcheckData.rugcheckVerified
        });
        
        // Update cache with complete data
        this.cache.set(mintAddress, originalCoin, fullyEnrichedData);
        console.log(`✅ Cache updated with Phase 2 (complete) data for ${originalCoin.symbol}`);
        
        return fullyEnrichedData;
      } else {
        console.warn(`⚠️ Phase 2: Rugcheck returned no data for ${originalCoin.symbol}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Phase 2: Background rugcheck error for ${originalCoin.symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch DexScreener data (fastest, most reliable)
   */
  async fetchDexScreener(mintAddress) {
    try {
      const response = await fetch(`${this.apis.dexscreener}/dex/tokens/${mintAddress}`, {
        headers: { 'User-Agent': 'Moonfeed/1.0' },
        timeout: 3000,
        agent: getAgent(`${this.apis.dexscreener}/dex/tokens/${mintAddress}`)
      });

      if (!response.ok) {
        throw new Error(`DexScreener API returned ${response.status}`);
      }

      const data = await response.json();
      
      // Find best pair (highest liquidity)
      if (data.pairs && data.pairs.length > 0) {
        const bestPair = data.pairs.reduce((best, current) => {
          const currentLiq = parseFloat(current.liquidity?.usd || '0');
          const bestLiq = parseFloat(best.liquidity?.usd || '0');
          return currentLiq > bestLiq ? current : best;
        });
        
        // 🐛 DEBUG: Log available fields to check for holder data
        console.log(`🔍 DexScreener data for ${mintAddress}:`, {
          hasHolders: !!bestPair.holders,
          hasHolderCount: !!bestPair.holderCount,
          hasTokenSupply: !!bestPair.tokenSupply,
          availableFields: Object.keys(bestPair).filter(k => k.toLowerCase().includes('hold'))
        });
        
        return bestPair;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ DexScreener failed for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch Rugcheck data (security info)
   */
  async fetchRugcheck(mintAddress) {
    try {
      console.log(`🔐 Fetching rugcheck for ${mintAddress}...`);
      
      // 🆕 OPTIMIZATION: Reduced timeout from 5s to 3s for faster failure
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout (down from 5s)
      
      let response = await fetch(`${this.apis.rugcheck}/tokens/${mintAddress}/report`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        agent: getAgent(`${this.apis.rugcheck}/tokens/${mintAddress}/report`)
      });

      clearTimeout(timeoutId);
      
      console.log(`🔐 Rugcheck primary endpoint response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        // Fallback to alternative endpoint
        console.log(`🔐 Trying rugcheck fallback endpoint...`);
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 3000); // 3s timeout (down from 5s)
        
        response = await fetch(`${this.apis.rugcheck}/tokens/${mintAddress}`, {
          headers: { 'Accept': 'application/json' },
          signal: controller2.signal,
          agent: getAgent(`${this.apis.rugcheck}/tokens/${mintAddress}`)
        });
        
        clearTimeout(timeoutId2);
        console.log(`🔐 Rugcheck fallback endpoint response: ${response.status} ${response.statusText}`);
      }

      if (response.status === 429) {
        console.warn(`⏰ Rugcheck rate limited for ${mintAddress}`);
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Rugcheck API returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log(`✅ Rugcheck success for ${mintAddress}:`, {
        hasScore: !!data.score,
        hasRiskLevel: !!data.riskLevel,
        hasMarkets: !!data.markets?.length,
        hasTopHolders: !!data.topHolders?.length
      });
      
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`⏰ Rugcheck timeout for ${mintAddress} (took > 3s)`);
      } else {
        console.warn(`⚠️ Rugcheck failed for ${mintAddress}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Fetch Pump.fun description
   */
  async fetchPumpFunDescription(mintAddress) {
    try {
      const description = await this.pumpFunService.getDescription(mintAddress);
      return description;
    } catch (error) {
      console.warn(`⚠️ Pump.fun description fetch failed for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch Birdeye price data
   */
  async fetchBirdeyePrice(mintAddress) {
    try {
      const url = `${this.apis.birdeye}/defi/price?address=${mintAddress}`;
      const response = await fetch(url, {
        headers: {
          'X-API-KEY': this.birdeyeKey,
          'x-chain': 'solana'
        },
        timeout: 3000,
        agent: getAgent(url)
      });

      if (!response.ok) {
        throw new Error(`Birdeye API returned ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.warn(`⚠️ Birdeye failed for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch Jupiter Ultra data for holderCount
   * Same API used in search - provides accurate holder count
   */
  async fetchJupiterUltra(mintAddress) {
    try {
      const url = `https://lite-api.jup.ag/ultra/v1/search?query=${mintAddress}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000,
        agent: getAgent(url)
      });

      if (!response.ok) {
        throw new Error(`Jupiter Ultra API returned ${response.status}`);
      }

      const results = await response.json();
      
      // Find exact match by mint address
      if (results && results.length > 0) {
        const exactMatch = results.find(t => t.id === mintAddress);
        return exactMatch || results[0]; // Return exact match or first result
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ Jupiter Ultra failed for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Process DexScreener data into enrichment fields
   */
  processDexScreenerData(pair, coin) {
    if (!pair) return {};

    const baseToken = pair.baseToken || {};
    const info = pair.info || {};

    // Extract banner (priority: header > imageUrl > baseToken.image)
    const banner = info.header || info.imageUrl || baseToken.image || null;

    // Extract socials
    const socials = {};
    if (info.socials) {
      info.socials.forEach(s => {
        const platform = (s.platform || s.type || '').toLowerCase();
        if (platform === 'twitter' || platform === 'x') {
          socials.twitter = s.url || `https://twitter.com/${s.handle?.replace('@', '')}`;
        } else if (platform === 'telegram') {
          socials.telegram = s.url || `https://t.me/${s.handle?.replace('@', '')}`;
        } else if (platform === 'discord') {
          socials.discord = s.url;
        }
      });
    }

    if (info.websites?.[0]) {
      socials.website = info.websites[0].url || info.websites[0];
    }

    // Log price change data for debugging
    if (pair.priceChange) {
      console.log(`📊 DexScreener price changes for ${coin.symbol}:`, {
        m5: pair.priceChange.m5,
        h1: pair.priceChange.h1,
        h6: pair.priceChange.h6,
        h24: pair.priceChange.h24
      });
    }

    // 🆕 Calculate age from pairCreatedAt timestamp
    let ageHours = null;
    if (pair.pairCreatedAt) {
      const createdTime = new Date(pair.pairCreatedAt).getTime();
      const now = Date.now();
      const ageMs = now - createdTime;
      ageHours = Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
      console.log(`⏰ Calculated age for ${coin.symbol}: ${ageHours}h from ${pair.pairCreatedAt}`);
    }

    return {
      // Visual assets
      banner,
      profileImage: info.imageUrl || baseToken.image,
      logo: baseToken.image,
      
      // Metadata (NO generic description - will be replaced by Pump.fun or left blank)
      dexscreenerUrl: pair.url || `https://dexscreener.com/solana/${coin.mintAddress}`,
      pairAddress: pair.pairAddress,
      
      // Market data
      price_usd: parseFloat(pair.priceUsd || '0'),
      liquidity_usd: parseFloat(pair.liquidity?.usd || '0'),
      volume_24h_usd: parseFloat(pair.volume?.h24 || '0'),
      priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
      change_24h: parseFloat(pair.priceChange?.h24 || '0'), // ✅ Frontend expects this field
      change24h: parseFloat(pair.priceChange?.h24 || '0'),  // ✅ Alternative field name
      fdv: parseFloat(pair.fdv || '0'),
      marketCap: parseFloat(pair.marketCap || '0'),
      
      // Price changes for chart (full DexScreener priceChange object)
      priceChange: pair.priceChange || {},
      priceChanges: pair.priceChange || {}, // Alternative field name for compatibility
      
      // Transaction data
      buys24h: pair.txns?.h24?.buys || 0,
      sells24h: pair.txns?.h24?.sells || 0,
      
      // 🆕 Age data
      ageHours,
      created_timestamp: pair.pairCreatedAt,
      
      // Social links
      socialLinks: socials,
      
      // Source
      enrichmentSource: 'dexscreener'
    };
  }

  /**
   * Process Rugcheck data into enrichment fields
   */
  processRugcheckData(data) {
    if (!data) return {};

    const markets = data.markets || [];
    let liquidityLocked = false;
    let lockPercentage = 0;
    let burnPercentage = 0;

    for (const market of markets) {
      const lp = market.lp || {};
      const lockedPct = lp.lpLockedPct || 0;
      const burnedPct = lp.lpBurned || 0;
      
      if (lockedPct > 80 || burnedPct > 90) {
        liquidityLocked = true;
      }
      
      lockPercentage = Math.max(lockPercentage, lockedPct);
      burnPercentage = Math.max(burnPercentage, burnedPct);
    }

    // 🐛 DEBUG: Check for holder data in Rugcheck response
    console.log(`🔍 Rugcheck data fields:`, {
      hasHolders: !!data.holders,
      hasHolderCount: !!data.holderCount,
      topHoldersLength: data.topHolders?.length || 0,
      availableFields: Object.keys(data).filter(k => k.toLowerCase().includes('hold'))
    });

    return {
      liquidityLocked,
      lockPercentage: Math.round(lockPercentage),
      burnPercentage: Math.round(burnPercentage),
      riskLevel: data.riskLevel || 'unknown',
      rugcheckScore: data.score || 0,
      freezeAuthority: data.tokenMeta?.freezeAuthority !== null,
      mintAuthority: data.tokenMeta?.mintAuthority !== null,
      topHolderPercent: data.topHolders?.[0]?.pct || 0,
      holders: data.holders || data.holderCount, // 🆕 Add holder count if available
      isHoneypot: data.risks?.includes('honeypot') || false,
      rugcheckVerified: true, // Mark that rugcheck data is available
      rugcheckProcessedAt: new Date().toISOString()
    };
  }

  /**
   * Process Birdeye data into enrichment fields
   */
  processBirdeyeData(data) {
    if (!data) return {};

    return {
      birdeyePrice: data.value,
      birdeyePriceUpdatedAt: data.updateUnixTime
    };
  }

  /**
   * Legacy cache methods (kept for backward compatibility)
   * Now use CompactCacheStorage internally
   */
  getFromCache(mintAddress) {
    return this.cache.get(mintAddress);
  }

  saveToCache(mintAddress, data) {
    // For legacy compatibility, pass empty base coin
    this.cache.set(mintAddress, {}, data);
  }

  clearCache(mintAddress = null) {
    if (mintAddress) {
      this.cache.delete(mintAddress);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get performance statistics (includes cache and batching stats)
   */
  getStats() {
    const cacheStats = this.cache.getStats();
    const jupiterStats = jupiterBatchService.getStats();
    
    return {
      enrichment: {
        ...this.stats,
        cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100
      },
      cache: cacheStats,
      jupiterBatching: jupiterStats
    };
  }

  /**
   * Generate clean chart data from current price and price changes
   * Uses the LIVE price to ensure the chart always reflects current reality
   * @param {number} currentPrice - The current live price (from Jupiter)
   * @param {object} priceChanges - DexScreener price change percentages (m5, h1, h6, h24)
   * @returns {object} Chart data with dataPoints array
   */
  generateCleanChart(currentPrice, priceChanges = {}) {
    if (!currentPrice || typeof currentPrice !== 'number' || currentPrice <= 0) {
      console.warn('⚠️ Invalid currentPrice for chart generation:', currentPrice);
      return null;
    }

    // Extract price change percentages from DexScreener
    // Handle both formats: {m5, h1, h6, h24} and {change5m, change1h, change6h, change24h}
    const change5m = priceChanges.m5 || priceChanges.change5m || 0;
    const change1h = priceChanges.h1 || priceChanges.change1h || 0;
    const change6h = priceChanges.h6 || priceChanges.change6h || 0;
    const change24h = priceChanges.h24 || priceChanges.change24h || 0;

    // Calculate prices at each time point by working BACKWARDS from current price
    // Formula: oldPrice = currentPrice / (1 + (changePercent / 100))
    const price5mAgo = currentPrice / (1 + (change5m / 100));
    const price1hAgo = currentPrice / (1 + (change1h / 100));
    const price6hAgo = currentPrice / (1 + (change6h / 100));
    const price24hAgo = currentPrice / (1 + (change24h / 100));

    // Create 5-point chart showing the key anchor times
    const now = Date.now();
    const dataPoints = [];
    
    // Point 1: 24h ago (leftmost)
    dataPoints.push({
      timestamp: now - 24 * 60 * 60 * 1000,
      time: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      price: price24hAgo,
      label: '24h'
    });
    
    // Point 2: 6h ago
    dataPoints.push({
      timestamp: now - 6 * 60 * 60 * 1000,
      time: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      price: price6hAgo,
      label: '6h'
    });
    
    // Point 3: 1h ago
    dataPoints.push({
      timestamp: now - 1 * 60 * 60 * 1000,
      time: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      price: price1hAgo,
      label: '1h'
    });
    
    // Point 4: 5m ago
    dataPoints.push({
      timestamp: now - 5 * 60 * 1000,
      time: new Date(now - 5 * 60 * 1000).toISOString(),
      price: price5mAgo,
      label: '5m'
    });
    
    // Point 5: Now (rightmost) - LIVE PRICE from Jupiter
    dataPoints.push({
      timestamp: now,
      time: new Date(now).toISOString(),
      price: currentPrice,
      label: 'now'
    });

    console.log(`✅ Generated clean chart with live price $${currentPrice.toFixed(8)}:`);
    console.log(`   24h ago: $${price24hAgo.toFixed(8)} (${change24h.toFixed(2)}%)`);
    console.log(`   6h ago: $${price6hAgo.toFixed(8)} (${change6h.toFixed(2)}%)`);
    console.log(`   1h ago: $${price1hAgo.toFixed(8)} (${change1h.toFixed(2)}%)`);
    console.log(`   5m ago: $${price5mAgo.toFixed(8)} (${change5m.toFixed(2)}%)`);
    console.log(`   NOW: $${currentPrice.toFixed(8)} ← LIVE JUPITER PRICE`);
    
    return {
      dataPoints,
      metadata: {
        timeframe: '24H',
        source: 'Live Jupiter price + DexScreener changes',
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Generate a simple flat chart for Moonfeed-native coins (no DEX data yet)
   * Shows current price across time until trading begins
   */
  generateMoonfeedChart(currentPrice) {
    if (!currentPrice || typeof currentPrice !== 'number' || currentPrice <= 0) {
      console.warn('⚠️ Invalid currentPrice for Moonfeed chart generation:', currentPrice);
      return [];
    }

    const now = Date.now();
    const dataPoints = [];
    
    // Create 5 data points showing flat price (pre-trading)
    const timePoints = [
      { offset: 24 * 60 * 60 * 1000, label: '24h' },
      { offset: 6 * 60 * 60 * 1000, label: '6h' },
      { offset: 1 * 60 * 60 * 1000, label: '1h' },
      { offset: 5 * 60 * 1000, label: '5m' },
      { offset: 0, label: 'now' }
    ];
    
    timePoints.forEach(point => {
      dataPoints.push({
        timestamp: now - point.offset,
        time: new Date(now - point.offset).toISOString(),
        price: currentPrice,
        label: point.label
      });
    });

    console.log(`✅ Generated Moonfeed chart with flat price $${currentPrice.toFixed(8)}`);
    
    return dataPoints;
  }

  /**
   * Fetch basic token info from Solana RPC
   * Used for Moonfeed-native coins that don't have DEX data yet
   */
  async fetchTokenInfoFromRPC(mintAddress) {
    try {
      const { Connection, PublicKey } = require('@solana/web3.js');
      const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '26240c3d-8cce-414e-95f7-5c0c75c1a2cb';
      const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, 'confirmed');
      
      console.log(`🔍 Fetching REAL token info from Helius RPC for ${mintAddress}`);
      
      // Get mint account info to get token supply
      const mintPubkey = new PublicKey(mintAddress);
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
      
      if (!mintInfo || !mintInfo.value) {
        console.warn(`⚠️ No mint info found for ${mintAddress}`);
        return null;
      }
      
      const tokenData = mintInfo.value.data.parsed?.info;
      if (!tokenData) {
        console.warn(`⚠️ Could not parse token data for ${mintAddress}`);
        return null;
      }
      
      // Extract token supply
      const supply = parseFloat(tokenData.supply) / Math.pow(10, tokenData.decimals);
      const decimals = tokenData.decimals;
      
      console.log(`✅ Token supply: ${supply.toLocaleString()} (${decimals} decimals)`);
      
      // 🔍 Try to get REAL last trade price from recent transactions
      let lastTradePrice = null;
      let volume24h = 0;
      
      try {
        const signatures = await connection.getSignaturesForAddress(mintPubkey, { limit: 20 });
        console.log(`📜 Found ${signatures.length} recent transactions for ${mintAddress}`);
        
        if (signatures.length > 0) {
          // Get the most recent transaction to extract price
          const lastSig = signatures[0];
          const tx = await connection.getParsedTransaction(lastSig.signature, {
            maxSupportedTransactionVersion: 0
          });
          
          if (tx && tx.meta && tx.meta.postTokenBalances && tx.meta.preTokenBalances) {
            // Try to calculate price from token balance changes
            const postBalances = tx.meta.postTokenBalances;
            const preBalances = tx.meta.preTokenBalances;
            
            if (postBalances.length > 0 && preBalances.length > 0) {
              // Find balance changes
              const tokenChange = postBalances.find(b => b.mint === mintAddress);
              const preTokenBalance = preBalances.find(b => b.mint === mintAddress);
              
              if (tokenChange && preTokenBalance) {
                const tokenDelta = parseFloat(tokenChange.uiTokenAmount.uiAmount || 0) - 
                                  parseFloat(preTokenBalance.uiTokenAmount.uiAmount || 0);
                
                // Check for SOL balance change to calculate price
                if (tx.meta.preBalances && tx.meta.postBalances && Math.abs(tokenDelta) > 0) {
                  const solDelta = (tx.meta.postBalances[0] - tx.meta.preBalances[0]) / 1e9; // Convert lamports to SOL
                  
                  if (solDelta !== 0) {
                    // Calculate price per token (SOL/token)
                    const priceInSol = Math.abs(solDelta / tokenDelta);
                    // Assume SOL = $150 (you can fetch real SOL price from Jupiter if needed)
                    const solPrice = 150;
                    lastTradePrice = priceInSol * solPrice;
                    
                    console.log(`💰 Calculated last trade price: $${lastTradePrice.toFixed(8)} (${priceInSol.toFixed(8)} SOL)`);
                  }
                }
              }
            }
          }
          
          // Calculate 24h volume from recent transactions
          const oneDayAgo = Date.now() / 1000 - 86400;
          const recentTxs = signatures.filter(sig => sig.blockTime > oneDayAgo);
          volume24h = recentTxs.length * (lastTradePrice || 0) * 1000; // Rough estimate
          
          console.log(`📊 24h volume (estimate): $${volume24h.toLocaleString()}`);
        }
      } catch (txError) {
        console.warn(`⚠️ Could not parse transactions for price:`, txError.message);
      }
      
      // If we couldn't get real price, use a reasonable estimate based on supply
      if (!lastTradePrice) {
        // For small supply tokens, use higher starting price
        if (supply < 10000000) {
          lastTradePrice = 0.001; // $0.001 for low supply
        } else if (supply < 100000000) {
          lastTradePrice = 0.0001; // $0.0001 for medium supply
        } else {
          lastTradePrice = 0.00001; // $0.00001 for high supply
        }
        console.log(`⚠️ Using estimated starting price: $${lastTradePrice}`);
      }
      
      return {
        supply,
        decimals,
        lastTradePrice,
        estimatedPrice: lastTradePrice,
        marketCap: supply * lastTradePrice,
        volume24h,
        isEstimate: !lastTradePrice || volume24h === 0
      };
    } catch (error) {
      console.error(`❌ Error fetching token info from RPC:`, error.message);
      return null;
    }
  }
}

module.exports = new OnDemandEnrichmentService();
