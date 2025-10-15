/**
 * Solscan Wallet Analytics Service
 * Provides comprehensive wallet statistics by analyzing portfolio and transaction data
 */

const fetch = require('node-fetch');

class SolscanWalletService {
  constructor() {
    this.apiKey = process.env.SOLSCAN_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NjA0Njk0NjQ5MjIsImVtYWlsIjoibW9vb25mZWVkQGdtYWlsLmNvbSIsImFjdGlvbiI6InRva2VuLWFwaSIsImFwaVZlcnNpb24iOiJ2MiIsImlhdCI6MTc2MDQ2OTQ2NH0.HC3YGmxWRwcBy3UW9bKCgeAyxFcEPd_Q5C4qbN-6CY8';
    this.baseUrl = 'https://pro-api.solscan.io/v2.0';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'accept': 'application/json'
    };
    this.cache = new Map();
    this.cacheTTL = 3 * 60 * 1000; // 3 minutes
  }

  /**
   * Get cached data or fetch from API
   */
  async getCached(cacheKey, fetchFn) {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      console.log(`💾 Cache hit: ${cacheKey}`);
      return { ...cached.data, cached: true };
    }

    const data = await fetchFn();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return { ...data, cached: false };
  }

  /**
   * Get account portfolio (current holdings and net worth)
   */
  async getAccountPortfolio(walletAddress) {
    const cacheKey = `portfolio-${walletAddress}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/account/portfolio?address=${walletAddress}`;
        console.log(`📡 Solscan Portfolio API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Solscan Portfolio response:`, JSON.stringify(result).substring(0, 200));

        return {
          success: true,
          data: result.data || result
        };
      } catch (error) {
        console.error(`❌ Solscan Portfolio error:`, error.message);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get account DeFi activities (trades, swaps)
   */
  async getDefiActivities(walletAddress, limit = 100) {
    const cacheKey = `defi-${walletAddress}-${limit}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/account/defi/activities?address=${walletAddress}&page_size=${limit}&sort_by=block_time&sort_order=desc`;
        console.log(`📡 Solscan DeFi API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Solscan DeFi response: ${result.data?.length || 0} activities`);

        return {
          success: true,
          data: result.data || []
        };
      } catch (error) {
        console.error(`❌ Solscan DeFi error:`, error.message);
        return { success: false, error: error.message, data: [] };
      }
    });
  }

  /**
   * Get account transfers (token movements)
   */
  async getAccountTransfers(walletAddress, limit = 100) {
    const cacheKey = `transfers-${walletAddress}-${limit}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/account/transfer?address=${walletAddress}&page_size=${limit}&sort_by=block_time&sort_order=desc`;
        console.log(`📡 Solscan Transfer API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Solscan Transfer response: ${result.data?.length || 0} transfers`);

        return {
          success: true,
          data: result.data || []
        };
      } catch (error) {
        console.error(`❌ Solscan Transfer error:`, error.message);
        return { success: false, error: error.message, data: [] };
      }
    });
  }

  /**
   * Calculate trading statistics from DeFi activities
   */
  calculateTradingStats(activities, walletAddress) {
    if (!activities || activities.length === 0) {
      return null;
    }

    const stats = {
      totalTrades: 0,
      buyCount: 0,
      sellCount: 0,
      totalInvested: 0,
      totalRealized: 0,
      firstTradeDate: null,
      lastTradeDate: null,
      tokenTrades: {}
    };

    activities.forEach(activity => {
      if (!activity || !activity.block_time) return;

      stats.totalTrades++;
      
      // Determine if it's a buy or sell based on token flow
      const isBuy = activity.from_address?.toLowerCase() !== walletAddress.toLowerCase();
      const isSell = activity.to_address?.toLowerCase() !== walletAddress.toLowerCase();

      if (isBuy) {
        stats.buyCount++;
        if (activity.amount_in_usd) {
          stats.totalInvested += parseFloat(activity.amount_in_usd) || 0;
        }
      }
      
      if (isSell) {
        stats.sellCount++;
        if (activity.amount_out_usd) {
          stats.totalRealized += parseFloat(activity.amount_out_usd) || 0;
        }
      }

      // Track first and last trade dates
      const tradeTime = activity.block_time * 1000; // Convert to ms
      if (!stats.firstTradeDate || tradeTime < stats.firstTradeDate) {
        stats.firstTradeDate = tradeTime;
      }
      if (!stats.lastTradeDate || tradeTime > stats.lastTradeDate) {
        stats.lastTradeDate = tradeTime;
      }

      // Track per-token statistics
      const tokenAddress = activity.token_address;
      if (tokenAddress) {
        if (!stats.tokenTrades[tokenAddress]) {
          stats.tokenTrades[tokenAddress] = {
            symbol: activity.token_symbol || 'Unknown',
            buys: 0,
            sells: 0,
            invested: 0,
            realized: 0
          };
        }

        if (isBuy) {
          stats.tokenTrades[tokenAddress].buys++;
          stats.tokenTrades[tokenAddress].invested += parseFloat(activity.amount_in_usd) || 0;
        }
        if (isSell) {
          stats.tokenTrades[tokenAddress].sells++;
          stats.tokenTrades[tokenAddress].realized += parseFloat(activity.amount_out_usd) || 0;
        }
      }
    });

    // Calculate PnL
    stats.totalPnL = stats.totalRealized - stats.totalInvested;
    stats.pnlPercentage = stats.totalInvested > 0 
      ? ((stats.totalPnL / stats.totalInvested) * 100) 
      : 0;

    // Calculate win rate (tokens with profit)
    const tokenTradesArray = Object.values(stats.tokenTrades);
    const profitableTokens = tokenTradesArray.filter(t => t.realized > t.invested).length;
    stats.winRate = tokenTradesArray.length > 0 
      ? (profitableTokens / tokenTradesArray.length) * 100 
      : 0;

    // Calculate average hold time (if we have both buys and sells)
    if (stats.firstTradeDate && stats.lastTradeDate && stats.totalTrades > 1) {
      const totalTime = stats.lastTradeDate - stats.firstTradeDate;
      const avgHoldTimeMs = totalTime / stats.totalTrades;
      const days = Math.floor(avgHoldTimeMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((avgHoldTimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      stats.avgHoldTime = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    }

    return stats;
  }

  /**
   * Get comprehensive wallet analytics
   */
  async getComprehensiveAnalytics(walletAddress) {
    try {
      console.log(`\n🔍 Fetching comprehensive Solscan data for: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);

      // Fetch all data in parallel
      const [portfolioData, defiData, transferData] = await Promise.all([
        this.getAccountPortfolio(walletAddress),
        this.getDefiActivities(walletAddress, 200),
        this.getAccountTransfers(walletAddress, 100)
      ]);

      // Calculate trading statistics from DeFi activities
      const tradingStats = portfolioData.success && defiData.success
        ? this.calculateTradingStats(defiData.data, walletAddress)
        : null;

      // Combine all data
      const combinedData = {
        success: true,
        wallet: walletAddress,
        
        // Portfolio data
        portfolio: portfolioData.success ? portfolioData.data : null,
        
        // Trading statistics (calculated)
        trading: tradingStats,
        
        // Raw activity data
        recentActivities: defiData.success ? defiData.data.slice(0, 20) : [],
        recentTransfers: transferData.success ? transferData.data.slice(0, 20) : [],
        
        // Metadata
        cached: portfolioData.cached || defiData.cached || transferData.cached,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Comprehensive Solscan analytics compiled`);
      if (tradingStats) {
        console.log(`📊 Stats: ${tradingStats.totalTrades} trades, ${tradingStats.winRate.toFixed(1)}% win rate, $${tradingStats.totalPnL.toFixed(2)} PnL`);
      }

      return combinedData;

    } catch (error) {
      console.error(`❌ Error fetching comprehensive wallet data:`, error);
      return {
        success: false,
        error: error.message,
        wallet: walletAddress
      };
    }
  }
}

module.exports = SolscanWalletService;
