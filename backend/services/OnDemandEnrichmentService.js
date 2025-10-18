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
 */

const fetch = require('node-fetch');
const pumpFunService = require('./pumpFunService');

class OnDemandEnrichmentService {
  constructor() {
    // API endpoints
    this.apis = {
      dexscreener: 'https://api.dexscreener.com/latest',
      rugcheck: 'https://api.rugcheck.xyz/v1',
      birdeye: 'https://public-api.birdeye.so'
    };
    
    // Cache configuration
    this.cache = new Map();
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes (was 5, increased for better performance)
    
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
   * @param {Object} coin - Base coin object with at least mintAddress
   * @param {Object} options - Enrichment options
   * @returns {Object} Enriched coin object
   */
  async enrichCoin(coin, options = {}) {
    const {
      skipCache = false,
      priorityApis = ['dexscreener'], // APIs to wait for
      optionalApis = ['rugcheck'], // APIs that can fail (removed birdeye)
      timeout = 3000 // Reduced from 5000ms for faster response
    } = options;

    const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
    if (!mintAddress) {
      console.warn('⚠️ No mint address provided for enrichment');
      return coin;
    }

    // Check cache first
    if (!skipCache) {
      const cached = this.getFromCache(mintAddress);
      if (cached) {
        console.log(`✅ Cache hit for ${coin.symbol || mintAddress}`);
        this.stats.cacheHits++;
        return { ...coin, ...cached };
      }
    }

    this.stats.cacheMisses++;
    const startTime = Date.now();

    console.log(`🔄 Enriching ${coin.symbol || mintAddress} on-demand...`);

    try {
      // Run ONLY essential enrichment APIs in parallel for maximum speed
      // REMOVED: Birdeye (redundant - we already have price from Jupiter Ultra + DexScreener)
      const enrichmentPromises = {
        dex: this.fetchDexScreener(mintAddress),
        rug: this.fetchRugcheck(mintAddress),
        pumpfun: this.fetchPumpFunDescription(mintAddress)
      };

      // Wait for all APIs with timeout
      const results = await Promise.race([
        Promise.allSettled(Object.values(enrichmentPromises)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Enrichment timeout')), timeout)
        )
      ]);

      // Process results
      const [dexResult, rugResult, pumpfunResult] = results;
      
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
      }

      // Apply Rugcheck data (optional)
      if (rugResult.status === 'fulfilled' && rugResult.value) {
        const rugcheckData = this.processRugcheckData(rugResult.value);
        Object.assign(enrichedData, rugcheckData);
        console.log(`🔐 Rugcheck data applied for ${coin.symbol}:`, {
          liquidityLocked: rugcheckData.liquidityLocked,
          lockPercentage: rugcheckData.lockPercentage,
          burnPercentage: rugcheckData.burnPercentage,
          riskLevel: rugcheckData.riskLevel,
          rugcheckScore: rugcheckData.rugcheckScore,
          rugcheckVerified: rugcheckData.rugcheckVerified,
          freezeAuthority: rugcheckData.freezeAuthority,
          mintAuthority: rugcheckData.mintAuthority
        });
      } else {
        console.warn(`⚠️ Rugcheck data not available for ${coin.symbol}:`, 
          rugResult.status === 'rejected' ? rugResult.reason?.message : 'No data returned');
        // Set rugcheckVerified to false when rugcheck fails
        enrichedData.rugcheckVerified = false;
      }

      // Apply Pump.fun description (if available, replaces generic description)
      if (pumpfunResult.status === 'fulfilled' && pumpfunResult.value) {
        enrichedData.description = pumpfunResult.value;
        enrichedData.descriptionSource = 'pump.fun';
        console.log(`🚀 Pump.fun description applied for ${coin.symbol}: "${pumpfunResult.value.substring(0, 50)}..."`);
      } else {
        // Remove description entirely if no Pump.fun description (don't use generic fallback)
        delete enrichedData.description;
        console.log(`ℹ️ No Pump.fun description for ${coin.symbol}, leaving blank`);
      }

      // ✨ ALWAYS GENERATE CHART with LIVE JUPITER PRICE
      // Priority: coin.price_usd (Jupiter) > enrichedData.price_usd (DexScreener)
      const livePrice = coin.price_usd || coin.priceUsd || coin.price || enrichedData.price_usd;
      
      if (livePrice && hasDexScreenerData) {
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

      // Cache the enriched data
      this.saveToCache(mintAddress, enrichedData);

      // Update stats
      this.stats.totalEnrichments++;
      this.stats.averageTime = 
        (this.stats.averageTime * (this.stats.totalEnrichments - 1) + enrichedData.enrichmentTime) / 
        this.stats.totalEnrichments;

      console.log(`✅ Enriched ${coin.symbol} in ${enrichedData.enrichmentTime}ms`);
      
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
   */
  async enrichCoins(coins, options = {}) {
    const { 
      maxConcurrent = 5,
      ...enrichOptions 
    } = options;

    console.log(`🚀 Batch enriching ${coins.length} coins...`);
    const startTime = Date.now();

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
    
    console.log(`✅ Batch enrichment complete: ${enrichedCount}/${coins.length} in ${duration}ms`);
    
    return results;
  }

  /**
   * Fetch DexScreener data (fastest, most reliable)
   */
  async fetchDexScreener(mintAddress) {
    try {
      const response = await fetch(`${this.apis.dexscreener}/dex/tokens/${mintAddress}`, {
        headers: { 'User-Agent': 'Moonfeed/1.0' },
        timeout: 3000
      });

      if (!response.ok) {
        throw new Error(`DexScreener API returned ${response.status}`);
      }

      const data = await response.json();
      
      // Find best pair (highest liquidity)
      if (data.pairs && data.pairs.length > 0) {
        return data.pairs.reduce((best, current) => {
          const currentLiq = parseFloat(current.liquidity?.usd || '0');
          const bestLiq = parseFloat(best.liquidity?.usd || '0');
          return currentLiq > bestLiq ? current : best;
        });
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
      let response = await fetch(`${this.apis.rugcheck}/tokens/${mintAddress}/report`, {
        headers: { 'Accept': 'application/json' },
        timeout: 3000
      });

      if (!response.ok) {
        response = await fetch(`${this.apis.rugcheck}/tokens/${mintAddress}`, {
          headers: { 'Accept': 'application/json' },
          timeout: 3000
        });
      }

      if (response.status === 429) {
        console.warn(`⏰ Rugcheck rate limited for ${mintAddress}`);
        return null;
      }

      if (!response.ok) {
        throw new Error(`Rugcheck API returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`⚠️ Rugcheck failed for ${mintAddress}:`, error.message);
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
      const response = await fetch(
        `${this.apis.birdeye}/defi/price?address=${mintAddress}`,
        {
          headers: {
            'X-API-KEY': this.birdeyeKey,
            'x-chain': 'solana'
          },
          timeout: 3000
        }
      );

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
      fdv: parseFloat(pair.fdv || '0'),
      marketCap: parseFloat(pair.marketCap || '0'),
      
      // Price changes for chart (full DexScreener priceChange object)
      priceChange: pair.priceChange || {},
      priceChanges: pair.priceChange || {}, // Alternative field name for compatibility
      
      // Transaction data
      buys24h: pair.txns?.h24?.buys || 0,
      sells24h: pair.txns?.h24?.sells || 0,
      
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

    return {
      liquidityLocked,
      lockPercentage: Math.round(lockPercentage),
      burnPercentage: Math.round(burnPercentage),
      riskLevel: data.riskLevel || 'unknown',
      rugcheckScore: data.score || 0,
      freezeAuthority: data.tokenMeta?.freezeAuthority !== null,
      mintAuthority: data.tokenMeta?.mintAuthority !== null,
      topHolderPercent: data.topHolders?.[0]?.pct || 0,
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
   * Cache management
   */
  getFromCache(mintAddress) {
    const cached = this.cache.get(mintAddress);
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(mintAddress);
      return null;
    }
    
    return cached.data;
  }

  saveToCache(mintAddress, data) {
    this.cache.set(mintAddress, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(mintAddress = null) {
    if (mintAddress) {
      this.cache.delete(mintAddress);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100
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
}

module.exports = new OnDemandEnrichmentService();
