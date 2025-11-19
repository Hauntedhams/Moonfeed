/**
 * Jupiter Ultra API Search Service
 * Enhanced token search with rich metadata and stats
 */

const fetch = require('node-fetch');
const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1';

class JupiterUltraSearchService {
  constructor() {
    this.apiUrl = JUPITER_ULTRA_API;
    this.searchCache = new Map(); // Cache search results
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
    this.lastRequestTime = 0;
    this.MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests
  }

  /**
   * Get cached search results
   */
  getCachedSearch(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const cached = this.searchCache.get(normalizedQuery);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`📦 Using cached results for "${query}"`);
      return cached.results;
    }
    
    return null;
  }

  /**
   * Store search results in cache
   */
  setCachedSearch(query, results) {
    const normalizedQuery = query.toLowerCase().trim();
    this.searchCache.set(normalizedQuery, {
      results,
      timestamp: Date.now()
    });
    
    // Limit cache size to 100 entries
    if (this.searchCache.size > 100) {
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
  }

  /**
   * Rate limit requests
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Fallback search using DexScreener API (reliable, no rate limits for search)
   */
  async searchDexScreener(query) {
    try {
      console.log(`🔍 Fallback: Searching DexScreener for "${query}"`);
      
      // Use DexScreener's search endpoint
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return {
          success: true,
          results: [],
          total: 0,
          source: 'dexscreener-fallback'
        };
      }
      
      // Filter for Solana tokens only and deduplicate by base token
      const solanaTokens = new Map();
      
      data.pairs.forEach(pair => {
        if (pair.chainId === 'solana' && pair.baseToken) {
          const address = pair.baseToken.address;
          // Only add if we haven't seen this token or if this pair has more liquidity
          if (!solanaTokens.has(address) || 
              (pair.liquidity?.usd || 0) > (solanaTokens.get(address).liquidity || 0)) {
            solanaTokens.set(address, {
              mintAddress: address,
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              image: pair.info?.imageUrl,
              priceUsd: parseFloat(pair.priceUsd) || null,
              marketCap: pair.fdv || pair.marketCap || null,
              liquidity: pair.liquidity?.usd || null,
              priceChange24h: pair.priceChange?.h24 || null,
              volume24h: pair.volume?.h24 || null,
              source: 'dexscreener',
              pairAddress: pair.pairAddress,
              dexId: pair.dexId
            });
          }
        }
      });
      
      const transformedResults = Array.from(solanaTokens.values()).slice(0, 20);
      
      console.log(`✅ Found ${transformedResults.length} Solana tokens from DexScreener`);
      
      return {
        success: true,
        results: transformedResults,
        total: transformedResults.length,
        source: 'dexscreener-fallback'
      };
    } catch (error) {
      console.error('❌ Error with DexScreener fallback:', error);
      return {
        success: false,
        error: 'Search temporarily unavailable. Please try again.',
        results: []
      };
    }
  }

  /**
   * Search for tokens by symbol, name, or mint address
   * @param {string} query - Search query (symbol, name, or mint)
   * @param {number} limit - Maximum results (default 20)
   * @returns {Promise<Object>} - Search results with rich metadata
   */
  async searchTokens(query) {
    try {
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: 'Search query is required',
          results: []
        };
      }

      // Check cache first
      const cached = this.getCachedSearch(query);
      if (cached) {
        return cached;
      }

      console.log(`🔍 Searching Jupiter Ultra for: "${query}"`);

      // Rate limit requests
      await this.waitForRateLimit();

      const response = await fetch(`${this.apiUrl}/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if rate limited
        if (response.status === 429 || errorText.includes('Rate limit')) {
          console.log('⚠️ Jupiter Ultra rate limited, falling back to DexScreener...');
          return await this.searchDexScreener(query);
        }
        
        throw new Error(`Jupiter Ultra API error: ${errorText}`);
      }

      const results = await response.json();
      console.log(`✅ Found ${results.length} tokens from Jupiter Ultra`);

      // Transform results to Moonfeed format
      const transformedResults = results.map(token => this.transformTokenData(token));

      const successResult = {
        success: true,
        results: transformedResults,
        total: results.length,
        source: 'jupiter-ultra'
      };

      // Cache successful results
      this.setCachedSearch(query, successResult);

      return successResult;
    } catch (error) {
      console.error('❌ Error searching tokens:', error);
      
      // Try DexScreener fallback on any error
      console.log('⚠️ Falling back to DexScreener search...');
      return await this.searchDexScreener(query);
    }
  }

  /**
   * Search for multiple tokens at once (up to 100)
   * @param {string[]} queries - Array of symbols, names, or mints
   * @returns {Promise<Object>} - Search results
   */
  async searchMultipleTokens(queries) {
    try {
      if (!queries || queries.length === 0) {
        return { success: false, error: 'No queries provided', results: [] };
      }

      // Limit to 100 as per API docs
      const limitedQueries = queries.slice(0, 100);
      const queryString = limitedQueries.join(',');

      console.log(`🔍 Searching for ${limitedQueries.length} tokens...`);

      const response = await fetch(`${this.apiUrl}/search?query=${encodeURIComponent(queryString)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jupiter Ultra API error: ${error}`);
      }

      const results = await response.json();
      const transformedResults = results.map(token => this.transformTokenData(token));

      return {
        success: true,
        results: transformedResults,
        total: results.length
      };
    } catch (error) {
      console.error('❌ Error searching multiple tokens:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Transform Jupiter Ultra token data to Moonfeed format
   * @param {Object} token - Raw Jupiter token data
   * @returns {Object} - Transformed token data
   */
  transformTokenData(token) {
    return {
      // Basic Info
      mintAddress: token.id,
      symbol: token.symbol,
      name: token.name,
      image: token.icon,
      
      // Price Data
      priceUsd: token.usdPrice,
      marketCap: token.mcap,
      fdv: token.fdv,
      liquidity: token.liquidity,
      
      // Supply Data
      circulatingSupply: token.circSupply,
      totalSupply: token.totalSupply,
      holderCount: token.holderCount,
      
      // Stats
      stats5m: token.stats5m,
      stats1h: token.stats1h,
      stats6h: token.stats6h,
      stats24h: token.stats24h,
      
      // Price Changes (for quick access)
      priceChange5m: token.stats5m?.priceChange,
      priceChange1h: token.stats1h?.priceChange,
      priceChange6h: token.stats6h?.priceChange,
      priceChange24h: token.stats24h?.priceChange,
      
      // Volume
      volume24h: token.stats24h?.buyVolume + token.stats24h?.sellVolume,
      buyVolume24h: token.stats24h?.buyVolume,
      sellVolume24h: token.stats24h?.sellVolume,
      
      // Social Links
      twitter: token.twitter,
      telegram: token.telegram,
      website: token.website,
      
      // Launch Info
      launchpad: token.launchpad,
      graduatedPool: token.graduatedPool,
      graduatedAt: token.graduatedAt,
      firstPoolCreatedAt: token.firstPool?.createdAt,
      
      // Audit/Safety Info
      audit: token.audit,
      isSus: token.audit?.isSus,
      mintAuthorityDisabled: token.audit?.mintAuthorityDisabled,
      freezeAuthorityDisabled: token.audit?.freezeAuthorityDisabled,
      topHoldersPercentage: token.audit?.topHoldersPercentage,
      devBalancePercentage: token.audit?.devBalancePercentage,
      
      // Organic Score
      organicScore: token.organicScore,
      organicScoreLabel: token.organicScoreLabel, // 'high', 'medium', 'low'
      
      // Verification
      isVerified: token.isVerified,
      
      // CEX Listings
      cexes: token.cexes,
      
      // Tags
      tags: token.tags,
      
      // Metadata
      decimals: token.decimals,
      tokenProgram: token.tokenProgram,
      dev: token.dev,
      updatedAt: token.updatedAt,
      
      // Source
      source: 'jupiter-ultra'
    };
  }

  /**
   * Get safety score for a token (0-100)
   * @param {Object} token - Token data
   * @returns {number} - Safety score
   */
  calculateSafetyScore(token) {
    let score = 50; // Base score

    // Positive factors
    if (token.audit?.mintAuthorityDisabled) score += 15;
    if (token.audit?.freezeAuthorityDisabled) score += 15;
    if (token.isVerified) score += 10;
    if (token.organicScoreLabel === 'high') score += 10;
    if (token.organicScoreLabel === 'medium') score += 5;
    
    // Negative factors
    if (token.audit?.isSus) score -= 30;
    if (token.audit?.topHoldersPercentage > 50) score -= 10;
    if (token.audit?.devBalancePercentage > 20) score -= 10;
    if (token.audit?.devMigrations > 0) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Filter tokens by criteria
   * @param {Array} tokens - Array of tokens
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered tokens
   */
  filterTokens(tokens, filters = {}) {
    return tokens.filter(token => {
      // Min liquidity
      if (filters.minLiquidity && token.liquidity < filters.minLiquidity) {
        return false;
      }

      // Min market cap
      if (filters.minMarketCap && token.marketCap < filters.minMarketCap) {
        return false;
      }

      // Verified only
      if (filters.verifiedOnly && !token.isVerified) {
        return false;
      }

      // Min organic score
      if (filters.minOrganicScore && token.organicScore < filters.minOrganicScore) {
        return false;
      }

      // Exclude suspicious
      if (filters.excludeSuspicious && token.isSus) {
        return false;
      }

      // Min safety score
      if (filters.minSafetyScore) {
        const safetyScore = this.calculateSafetyScore(token);
        if (safetyScore < filters.minSafetyScore) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort tokens by various criteria
   * @param {Array} tokens - Array of tokens
   * @param {string} sortBy - Sort criteria
   * @returns {Array} - Sorted tokens
   */
  sortTokens(tokens, sortBy = 'relevance') {
    const sorted = [...tokens];

    switch (sortBy) {
      case 'price_high':
        return sorted.sort((a, b) => (b.priceUsd || 0) - (a.priceUsd || 0));
      
      case 'price_low':
        return sorted.sort((a, b) => (a.priceUsd || 0) - (b.priceUsd || 0));
      
      case 'marketcap':
        return sorted.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
      
      case 'volume':
        return sorted.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      
      case 'liquidity':
        return sorted.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
      
      case 'holders':
        return sorted.sort((a, b) => (b.holderCount || 0) - (a.holderCount || 0));
      
      case 'price_change':
        return sorted.sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0));
      
      case 'organic_score':
        return sorted.sort((a, b) => (b.organicScore || 0) - (a.organicScore || 0));
      
      case 'safety':
        return sorted.sort((a, b) => 
          this.calculateSafetyScore(b) - this.calculateSafetyScore(a)
        );
      
      default: // relevance
        return sorted;
    }
  }
}

module.exports = new JupiterUltraSearchService();
