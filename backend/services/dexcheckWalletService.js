/**
 * DexCheck Wallet Analytics Service
 * Comprehensive wallet intelligence using DexCheck free APIs
 * 
 * Features:
 * - Maker trades history
 * - Whale transaction detection
 * - Top trader rankings
 * - Transaction history
 * - KOL (Key Opinion Leader) status
 * 
 * API Documentation: https://docs.dexcheck.io/
 */

const fetch = require('node-fetch');

class DexCheckWalletService {
  constructor() {
    this.apiKey = process.env.DEXCHECK_API_KEY || 'Qu5gsYWuzXLusFjWl1ICv5nI0CK3DnYX';
    this.baseUrl = 'https://api.dexcheck.ai/api/v1';
    this.chain = 'solana';
    
    // Cache for rate limit management
    this.cache = new Map();
    this.cacheTTL = 2 * 60 * 1000; // 2 minutes cache
  }

  /**
   * Make API request with caching
   */
  async makeRequest(endpoint, params = {}) {
    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      console.log(`💾 [DexCheck] Cache hit: ${endpoint}`);
      return cached.data;
    }

    // Build URL with query params
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    try {
      console.log(`📡 [DexCheck] Fetching: ${endpoint}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [DexCheck] API error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      
      // Cache successful response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error(`❌ [DexCheck] Request failed:`, error.message);
      return null;
    }
  }

  /**
   * Fetch maker trades for a wallet
   * Shows all trades made by this wallet
   */
  async getMakerTrades(walletAddress, limit = 50) {
    const data = await this.makeRequest('/blockchain/maker-trades', {
      chain: this.chain,
      maker: walletAddress
    });

    if (!data || !data.maker_trades) {
      return { trades: [], totalTrades: 0 };
    }

    const trades = data.maker_trades.slice(0, limit);

    return {
      trades: trades.map(trade => ({
        pair: trade.pair,
        side: trade.side,
        amountUsd: trade.amount_usd,
        usdPrice: trade.usd_price,
        timestamp: trade.timestamp,
        amount0In: trade.amount_0_in,
        amount0Out: trade.amount_0_out,
        amount1In: trade.amount_1_in,
        amount1Out: trade.amount_1_out
      })),
      totalTrades: data.maker_trades.length,
      recentActivity: trades.slice(0, 10)
    };
  }

  /**
   * Check if wallet is a whale (large trader)
   * Returns recent large transactions
   */
  async getWhaleStatus(walletAddress, minUsd = 10000) {
    const data = await this.makeRequest('/blockchain/whale-tracker', {
      chain: this.chain,
      min_usd: minUsd,
      page: 1
    });

    if (!data || !data.transactions) {
      return { isWhale: false, largeTrades: [], whaleScore: 0 };
    }

    // Filter transactions by this wallet
    const walletTransactions = data.transactions.filter(
      tx => tx.maker === walletAddress
    );

    const totalVolume = walletTransactions.reduce(
      (sum, tx) => sum + (tx.amount_usd || 0), 0
    );

    const avgTradeSize = walletTransactions.length > 0 
      ? totalVolume / walletTransactions.length 
      : 0;

    return {
      isWhale: walletTransactions.length > 0,
      whaleScore: Math.min(100, Math.floor(walletTransactions.length * 10)),
      largeTrades: walletTransactions.slice(0, 10).map(tx => ({
        side: tx.side,
        amountUsd: tx.amount_usd,
        pair: tx.pair,
        tokenSymbol: tx.quote_symbol,
        tokenName: tx.quote_name,
        timestamp: tx.epoch_time,
        txHash: tx.tx_hash
      })),
      totalVolume,
      avgTradeSize,
      largeTradeCount: walletTransactions.length
    };
  }

  /**
   * Get top trader rankings for tokens this wallet trades
   * Shows if wallet is a top performer on any pairs
   */
  async getTopTraderRankings(pairIds, walletAddress) {
    const rankings = [];

    // Query up to 5 pairs to avoid rate limits
    const pairsToCheck = pairIds.slice(0, 5);

    for (const pairId of pairsToCheck) {
      const data = await this.makeRequest('/blockchain/top-traders-for-pair', {
        chain: this.chain,
        pair_id: pairId,
        duration: '30d',
        page: 1
      });

      if (data && data.traders) {
        // Find wallet in rankings
        const rank = data.traders.findIndex(t => t.maker === walletAddress);
        
        if (rank !== -1) {
          const traderData = data.traders[rank];
          rankings.push({
            pairId,
            rank: rank + 1,
            totalRanked: data.traders.length,
            overallProfit: traderData.overall_profit,
            roi: traderData.roi,
            totalTrades: traderData.total_trades,
            winRate: traderData.sell_total_trades > 0 
              ? ((traderData.sell_total_trades / traderData.total_trades) * 100).toFixed(1)
              : 0
          });
        }
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return {
      rankings,
      isTopTrader: rankings.length > 0,
      topRankings: rankings.filter(r => r.rank <= 10),
      avgRank: rankings.length > 0 
        ? Math.round(rankings.reduce((sum, r) => sum + r.rank, 0) / rankings.length)
        : null
    };
  }

  /**
   * Get transaction history for pairs
   */
  async getTransactionHistory(pairId, limit = 20) {
    const data = await this.makeRequest('/blockchain/tx-history', {
      chain: this.chain,
      pair_id: pairId,
      page: 1
    });

    if (!data || !data.transactions) {
      return { transactions: [] };
    }

    return {
      transactions: data.transactions.slice(0, limit).map(tx => ({
        pair: tx.pair,
        timestamp: tx.timestamp,
        maker: tx.maker,
        side: tx.side,
        amountUsd: tx.amount_usd,
        usdPrice: tx.usd_price,
        amount0In: tx.amount_0_in,
        amount0Out: tx.amount_0_out,
        amount1In: tx.amount_1_in,
        amount1Out: tx.amount_1_out
      }))
    };
  }

  /**
   * Check if wallet belongs to a KOL (Key Opinion Leader)
   */
  async getKOLStatus(walletAddress) {
    // Note: KOL endpoint returns general rankings, not wallet-specific
    // We'd need to match wallet to known KOLs in our database
    // For now, return structure for future implementation
    
    return {
      isKOL: false,
      kolData: null,
      message: 'KOL detection requires Twitter handle mapping'
    };
  }

  /**
   * Get comprehensive wallet analytics combining all endpoints
   */
  async getComprehensiveAnalytics(walletAddress, activePairIds = []) {
    console.log(`🔍 [DexCheck] Fetching comprehensive analytics for: ${walletAddress.slice(0, 8)}...`);

    try {
      // Fetch all data in parallel for speed
      const [
        makerTrades,
        whaleStatus,
        topTraderRankings
      ] = await Promise.all([
        this.getMakerTrades(walletAddress),
        this.getWhaleStatus(walletAddress),
        activePairIds.length > 0 
          ? this.getTopTraderRankings(activePairIds, walletAddress)
          : Promise.resolve({ rankings: [], isTopTrader: false })
      ]);

      // Calculate aggregate metrics
      const totalProfit = makerTrades.trades.reduce((sum, trade) => {
        const profit = trade.side === 'sell' 
          ? trade.amountUsd 
          : -trade.amountUsd;
        return sum + profit;
      }, 0);

      const buyTrades = makerTrades.trades.filter(t => t.side === 'buy').length;
      const sellTrades = makerTrades.trades.filter(t => t.side === 'sell').length;
      const winRate = sellTrades > 0 
        ? Math.round((sellTrades / (buyTrades + sellTrades)) * 100)
        : 0;

      // Recent activity (last 24h)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentTrades = makerTrades.trades.filter(trade => {
        const tradeTime = new Date(trade.timestamp).getTime();
        return tradeTime >= oneDayAgo;
      });

      return {
        success: true,
        wallet: walletAddress,
        source: 'dexcheck',
        timestamp: new Date().toISOString(),
        
        // Trading overview
        trading: {
          totalTrades: makerTrades.totalTrades,
          recentTrades24h: recentTrades.length,
          buyTrades,
          sellTrades,
          winRate,
          estimatedProfit: totalProfit
        },

        // Whale status
        whale: {
          isWhale: whaleStatus.isWhale,
          whaleScore: whaleStatus.whaleScore,
          largeTradeCount: whaleStatus.largeTradeCount,
          totalVolume: whaleStatus.totalVolume,
          avgTradeSize: whaleStatus.avgTradeSize,
          recentLargeTrades: whaleStatus.largeTrades
        },

        // Top trader status
        topTrader: {
          isTopTrader: topTraderRankings.isTopTrader,
          rankings: topTraderRankings.rankings,
          topRankings: topTraderRankings.topRankings,
          avgRank: topTraderRankings.avgRank
        },

        // Recent activity
        recentActivity: makerTrades.recentActivity,

        // Metadata
        dataQuality: {
          hasMakerTrades: makerTrades.totalTrades > 0,
          hasWhaleData: whaleStatus.isWhale,
          hasRankings: topTraderRankings.isTopTrader
        }
      };
    } catch (error) {
      console.error(`❌ [DexCheck] Error fetching analytics:`, error);
      return {
        success: false,
        error: error.message,
        wallet: walletAddress
      };
    }
  }
}

module.exports = DexCheckWalletService;
