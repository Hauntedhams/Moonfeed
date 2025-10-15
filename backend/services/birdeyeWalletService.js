/**
 * Birdeye Wallet Analytics Service
 * Provides comprehensive wallet statistics including PnL, net worth, and transaction history
 */

const fetch = require('node-fetch');

class BirdeyeWalletService {
  constructor() {
    this.apiKey = process.env.BIRDEYE_API_KEY || '29e047952f0d45ed8927939bbc08f09c';
    this.baseUrl = 'https://public-api.birdeye.so';
    this.headers = {
      'X-API-KEY': this.apiKey,
      'accept': 'application/json',
      'x-chain': 'solana'
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
   * Get overall wallet PnL across all tokens
   * Endpoint: GET /wallet/v2/pnl/multiple
   */
  async getWalletPnL(walletAddress) {
    const cacheKey = `pnl-${walletAddress}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/wallet/v2/pnl/multiple?wallet=${walletAddress}`;
        console.log(`📡 Birdeye PnL API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Birdeye PnL response:`, JSON.stringify(result).substring(0, 200));

        return {
          success: true,
          data: result.data || result
        };
      } catch (error) {
        console.error(`❌ Birdeye PnL error:`, error.message);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get current wallet net worth and holdings
   * Endpoint: GET /wallet/v2/current-net-worth
   */
  async getCurrentNetWorth(walletAddress) {
    const cacheKey = `networth-${walletAddress}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/wallet/v2/current-net-worth?wallet=${walletAddress}&sort_by=value&sort_type=desc&limit=20&offset=0`;
        console.log(`📡 Birdeye Net Worth API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Birdeye Net Worth response:`, JSON.stringify(result).substring(0, 200));

        return {
          success: true,
          data: result.data || result
        };
      } catch (error) {
        console.error(`❌ Birdeye Net Worth error:`, error.message);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get PnL per token for this wallet
   * Endpoint: GET /wallet/v2/pnl
   */
  async getPnLPerToken(walletAddress) {
    const cacheKey = `pnl-token-${walletAddress}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/wallet/v2/pnl?wallet=${walletAddress}`;
        console.log(`📡 Birdeye PnL Per Token API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Birdeye PnL Per Token response:`, JSON.stringify(result).substring(0, 200));

        return {
          success: true,
          data: result.data || result
        };
      } catch (error) {
        console.error(`❌ Birdeye PnL Per Token error:`, error.message);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get transaction history
   * Endpoint: GET /v1/wallet/tx_list
   */
  async getTransactionHistory(walletAddress, limit = 100) {
    const cacheKey = `txhistory-${walletAddress}-${limit}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/v1/wallet/tx_list?wallet=${walletAddress}&limit=${limit}&ui_amount_mode=scaled`;
        console.log(`📡 Birdeye Transaction History API: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Birdeye Transaction History response:`, JSON.stringify(result).substring(0, 200));

        return {
          success: true,
          data: result.data || result
        };
      } catch (error) {
        console.error(`❌ Birdeye Transaction History error:`, error.message);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Get comprehensive wallet analytics (all endpoints combined)
   */
  async getComprehensiveWalletData(walletAddress) {
    try {
      console.log(`\n🔍 Fetching comprehensive Birdeye data for: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);

      // Fetch all data in parallel
      const [pnlData, netWorthData, pnlPerTokenData, txHistoryData] = await Promise.all([
        this.getWalletPnL(walletAddress),
        this.getCurrentNetWorth(walletAddress),
        this.getPnLPerToken(walletAddress),
        this.getTransactionHistory(walletAddress, 20) // Limit to 20 recent transactions
      ]);

      // Combine all data
      const combinedData = {
        success: true,
        wallet: walletAddress,
        pnl: pnlData.success ? pnlData.data : null,
        netWorth: netWorthData.success ? netWorthData.data : null,
        pnlPerToken: pnlPerTokenData.success ? pnlPerTokenData.data : null,
        recentTransactions: txHistoryData.success ? txHistoryData.data : null,
        cached: pnlData.cached || netWorthData.cached || pnlPerTokenData.cached || txHistoryData.cached,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Comprehensive data compiled for ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);
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

module.exports = BirdeyeWalletService;
