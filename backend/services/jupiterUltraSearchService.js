/**
 * Jupiter Ultra API Search Service
 * Enhanced token search with rich metadata and stats
 */

const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1';

class JupiterUltraSearchService {
  constructor() {
    this.apiUrl = JUPITER_ULTRA_API;
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

      console.log(`🔍 Searching Jupiter Ultra for: "${query}"`);

      const response = await fetch(`${this.apiUrl}/search?query=${encodeURIComponent(query)}`, {
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
      console.log(`✅ Found ${results.length} tokens`);

      // Transform results to Moonfeed format
      const transformedResults = results.map(token => this.transformTokenData(token));

      return {
        success: true,
        results: transformedResults,
        total: results.length
      };
    } catch (error) {
      console.error('❌ Error searching tokens:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
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
