/**
 * PUMP.FUN SERVICE
 * 
 * Fetches token metadata and descriptions from Pump.fun
 */

const fetch = require('node-fetch');

class PumpFunService {
  constructor() {
    this.apiBase = 'https://frontend-api.pump.fun';
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
    
    console.log('🚀 Pump.fun Service initialized');
  }

  /**
   * Get token data from Pump.fun including description
   * @param {string} mintAddress - Token mint address
   * @returns {Object|null} Token data with description
   */
  async getTokenData(mintAddress) {
    try {
      // Check cache first
      const cacheKey = `pumpfun_${mintAddress}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        console.log(`✅ Pump.fun cache hit for ${mintAddress}`);
        return cached.data;
      }

      console.log(`🔍 Fetching Pump.fun data for ${mintAddress}...`);

      const response = await fetch(`${this.apiBase}/coins/${mintAddress}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        timeout: 5000
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`ℹ️ Token ${mintAddress} not found on Pump.fun (not a Pump.fun token)`);
        } else if (response.status === 530 || response.status === 503) {
          console.log(`⚠️ Pump.fun API temporarily unavailable (${response.status}) for ${mintAddress}`);
        } else {
          console.warn(`⚠️ Pump.fun API returned ${response.status} for ${mintAddress}`);
        }
        return null;
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      // Clean up old cache entries
      this.cleanCache();

      return data;

    } catch (error) {
      console.warn(`⚠️ Pump.fun fetch failed for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Get description from Pump.fun token data
   * @param {string} mintAddress - Token mint address
   * @returns {string|null} Token description
   */
  async getDescription(mintAddress) {
    try {
      const tokenData = await this.getTokenData(mintAddress);
      
      if (!tokenData) {
        return null;
      }

      // Pump.fun stores description in the 'description' field
      const description = tokenData.description || tokenData.desc || null;

      if (description && description.trim().length > 0) {
        console.log(`✅ Found Pump.fun description for ${mintAddress}: "${description.substring(0, 50)}..."`);
        return description.trim();
      }

      console.log(`ℹ️ No description found on Pump.fun for ${mintAddress}`);
      return null;

    } catch (error) {
      console.warn(`⚠️ Error getting Pump.fun description for ${mintAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Get social links from Pump.fun
   * @param {string} mintAddress - Token mint address
   * @returns {Object} Social links object
   */
  async getSocialLinks(mintAddress) {
    try {
      const tokenData = await this.getTokenData(mintAddress);
      
      if (!tokenData) {
        return {};
      }

      const socials = {};

      if (tokenData.twitter) {
        socials.twitter = tokenData.twitter.startsWith('http') 
          ? tokenData.twitter 
          : `https://twitter.com/${tokenData.twitter.replace('@', '')}`;
      }

      if (tokenData.telegram) {
        socials.telegram = tokenData.telegram.startsWith('http') 
          ? tokenData.telegram 
          : `https://t.me/${tokenData.telegram.replace('@', '')}`;
      }

      if (tokenData.website) {
        socials.website = tokenData.website;
      }

      return socials;

    } catch (error) {
      console.warn(`⚠️ Error getting Pump.fun socials for ${mintAddress}:`, error.message);
      return {};
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Pump.fun cache cleared');
  }
}

// Export singleton instance
module.exports = new PumpFunService();
