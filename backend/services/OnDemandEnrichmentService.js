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
        rug: this.fetchRugcheck(mintAddress)
      };

      // Wait for all APIs with timeout
      const results = await Promise.race([
        Promise.allSettled(Object.values(enrichmentPromises)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Enrichment timeout')), timeout)
        )
      ]);

      // Process results
      const [dexResult, rugResult] = results;
      
      const enrichedData = {
        ...coin,
        enriched: true,
        enrichedAt: new Date().toISOString(),
        enrichmentTime: Date.now() - startTime
      };

      // Apply DexScreener data (priority)
      if (dexResult.status === 'fulfilled' && dexResult.value) {
        Object.assign(enrichedData, this.processDexScreenerData(dexResult.value, coin));
      }

      // Apply Rugcheck data (optional)
      if (rugResult.status === 'fulfilled' && rugResult.value) {
        Object.assign(enrichedData, this.processRugcheckData(rugResult.value));
      }

      // NOTE: Birdeye removed - redundant price data already available from:
      // - Jupiter Ultra (initial search)
      // - DexScreener (enrichment)

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
      
      // Metadata
      description: info.description || `${baseToken.symbol} trading on ${pair.dexId}`,
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

    for (const market of markets) {
      const lp = market.lp || {};
      const lockedPct = lp.lpLockedPct || 0;
      const burnedPct = lp.lpBurned || 0;
      
      if (lockedPct > 80 || burnedPct > 90) {
        liquidityLocked = true;
      }
      
      lockPercentage = Math.max(lockPercentage, lockedPct, burnedPct);
    }

    return {
      liquidityLocked,
      lockPercentage: Math.round(lockPercentage),
      riskLevel: data.riskLevel || 'unknown',
      rugcheckScore: data.score || 0,
      freezeAuthority: data.tokenMeta?.freezeAuthority === null,
      mintAuthority: data.tokenMeta?.mintAuthority === null,
      topHolderPercent: data.topHolders?.[0]?.pct || 0,
      isHoneypot: data.risks?.includes('honeypot') || false
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
}

module.exports = new OnDemandEnrichmentService();
