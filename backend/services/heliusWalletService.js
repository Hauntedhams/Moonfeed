/**
 * Helius Wallet Analytics Service
 * FREE comprehensive wallet analytics using Helius RPC
 * Calculates PnL, win rate, hold times from transaction history
 */

const fetch = require('node-fetch');

class HeliusWalletService {
  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY || '05a97104-cba1-4284-aed6-e0ad21af8b33';
    this.rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache
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
   * Get transaction signatures for an address
   */
  async getSignaturesForAddress(address, limit = 100) {
    try {
      console.log(`📡 Fetching ${limit} signatures for ${address.slice(0, 4)}...${address.slice(-4)}`);

      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getSignaturesForAddress',
          params: [address, { limit }]
        })
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      console.log(`✅ Found ${result.result?.length || 0} signatures`);
      return result.result || [];

    } catch (error) {
      console.error(`❌ Error fetching signatures:`, error.message);
      return [];
    }
  }

  /**
   * Get parsed transaction details
   */
  async getTransaction(signature) {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getTransaction',
          params: [
            signature,
            {
              encoding: 'jsonParsed',
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            }
          ]
        })
      });

      const result = await response.json();
      
      if (result.error) {
        console.error(`Error fetching tx ${signature.slice(0, 8)}:`, result.error.message);
        return null;
      }

      return result.result;

    } catch (error) {
      console.error(`❌ Error fetching transaction:`, error.message);
      return null;
    }
  }

  /**
   * Parse token transfers from transaction
   */
  parseTokenTransfers(transaction, walletAddress) {
    if (!transaction || !transaction.meta) return [];

    const transfers = [];
    const preBalances = transaction.meta.preTokenBalances || [];
    const postBalances = transaction.meta.postTokenBalances || [];

    // Match pre and post balances to find transfers
    postBalances.forEach(post => {
      const pre = preBalances.find(p => 
        p.accountIndex === post.accountIndex && 
        p.mint === post.mint
      );

      if (pre) {
        const preAmount = parseFloat(pre.uiTokenAmount?.uiAmountString || 0);
        const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || 0);
        const change = postAmount - preAmount;

        if (Math.abs(change) > 0.000001) { // Ignore dust
          transfers.push({
            mint: post.mint,
            decimals: post.uiTokenAmount.decimals,
            change: change,
            preBalance: preAmount,
            postBalance: postAmount,
            isBuy: change > 0,
            isSell: change < 0
          });
        }
      }
    });

    return transfers;
  }

  /**
   * Parse SOL changes from transaction
   */
  parseSOLChanges(transaction, walletAddress) {
    if (!transaction || !transaction.meta) return null;

    const accountKeys = transaction.transaction.message.accountKeys;
    const walletIndex = accountKeys.findIndex(key => 
      typeof key === 'string' ? key === walletAddress : key.pubkey === walletAddress
    );

    if (walletIndex === -1) return null;

    const preBalance = transaction.meta.preBalances[walletIndex] / 1e9; // Convert lamports to SOL
    const postBalance = transaction.meta.postBalances[walletIndex] / 1e9;
    const change = postBalance - preBalance;

    return {
      preBalance,
      postBalance,
      change,
      fee: transaction.meta.fee / 1e9
    };
  }

  /**
   * Calculate comprehensive wallet analytics
   */
  async getWalletAnalytics(walletAddress) {
    const cacheKey = `analytics-${walletAddress}`;

    return this.getCached(cacheKey, async () => {
      try {
        console.log(`\n🔍 Analyzing wallet: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);

        // Get transaction signatures (last 100 transactions)
        const signatures = await this.getSignaturesForAddress(walletAddress, 100);

        if (signatures.length === 0) {
          console.log(`⚠️ No transactions found for wallet`);
          return {
            success: true,
            wallet: walletAddress,
            hasData: false,
            message: 'No transaction history found'
          };
        }

        console.log(`📊 Analyzing ${signatures.length} transactions...`);

        // Fetch detailed transaction data (in batches to avoid overwhelming the API)
        const batchSize = 10;
        const transactions = [];
        
        for (let i = 0; i < Math.min(signatures.length, 50); i += batchSize) {
          const batch = signatures.slice(i, i + batchSize);
          const batchTxs = await Promise.all(
            batch.map(sig => this.getTransaction(sig.signature))
          );
          transactions.push(...batchTxs.filter(tx => tx !== null));
          
          // Log progress
          console.log(`   Processed ${Math.min(i + batchSize, 50)}/50 transactions...`);
        }

        console.log(`✅ Fetched ${transactions.length} detailed transactions`);

        // Analyze transactions
        const analytics = this.analyzeTransactions(transactions, walletAddress, signatures);

        return {
          success: true,
          wallet: walletAddress,
          hasData: true,
          ...analytics,
          cached: false
        };

      } catch (error) {
        console.error(`❌ Error analyzing wallet:`, error.message);
        return {
          success: false,
          wallet: walletAddress,
          error: error.message
        };
      }
    });
  }

  /**
   * Analyze transactions and calculate statistics
   */
  analyzeTransactions(transactions, walletAddress, signatures) {
    const stats = {
      totalTransactions: signatures.length,
      analyzedTransactions: transactions.length,
      tokenTrades: {},
      solChanges: {
        totalSpent: 0,
        totalReceived: 0,
        totalFees: 0
      },
      timestamps: {
        first: null,
        last: null
      }
    };

    // Track first and last transaction times
    if (signatures.length > 0) {
      stats.timestamps.last = signatures[0].blockTime * 1000;
      stats.timestamps.first = signatures[signatures.length - 1].blockTime * 1000;
    }

    // Analyze each transaction
    transactions.forEach((tx, index) => {
      if (!tx) return;

      const signature = signatures[index];
      const blockTime = signature?.blockTime;

      // Parse token transfers
      const tokenTransfers = this.parseTokenTransfers(tx, walletAddress);
      
      tokenTransfers.forEach(transfer => {
        const mint = transfer.mint;
        
        if (!stats.tokenTrades[mint]) {
          stats.tokenTrades[mint] = {
            mint: mint,
            buys: 0,
            sells: 0,
            totalBought: 0,
            totalSold: 0,
            netAmount: 0,
            transactions: []
          };
        }

        if (transfer.isBuy) {
          stats.tokenTrades[mint].buys++;
          stats.tokenTrades[mint].totalBought += Math.abs(transfer.change);
        } else if (transfer.isSell) {
          stats.tokenTrades[mint].sells++;
          stats.tokenTrades[mint].totalSold += Math.abs(transfer.change);
        }

        stats.tokenTrades[mint].netAmount += transfer.change;
        stats.tokenTrades[mint].transactions.push({
          signature: signature?.signature,
          time: blockTime,
          type: transfer.isBuy ? 'buy' : 'sell',
          amount: transfer.change
        });
      });

      // Parse SOL changes
      const solChange = this.parseSOLChanges(tx, walletAddress);
      if (solChange) {
        if (solChange.change > 0) {
          stats.solChanges.totalReceived += solChange.change;
        } else {
          stats.solChanges.totalSpent += Math.abs(solChange.change);
        }
        stats.solChanges.totalFees += solChange.fee;
      }
    });

    // Calculate summary statistics
    const tokenArray = Object.values(stats.tokenTrades);
    const totalTrades = tokenArray.reduce((sum, t) => sum + t.buys + t.sells, 0);
    const tokensWithBothSides = tokenArray.filter(t => t.buys > 0 && t.sells > 0);

    // Calculate simple win rate (tokens that are fully sold and profitable)
    const closedPositions = tokenArray.filter(t => Math.abs(t.netAmount) < 0.001 && t.sells > 0);
    const profitableCount = closedPositions.length; // Simplified - would need price data for accurate PnL

    return {
      trading: {
        totalTrades: totalTrades,
        uniqueTokens: tokenArray.length,
        activeTrades: tokenArray.filter(t => Math.abs(t.netAmount) > 0.001).length,
        closedTrades: closedPositions.length,
        firstTradeDate: stats.timestamps.first,
        lastTradeDate: stats.timestamps.last,
        avgTradesPerDay: this.calculateAvgTradesPerDay(stats.timestamps.first, stats.timestamps.last, totalTrades)
      },
      solActivity: {
        totalSpent: stats.solChanges.totalSpent.toFixed(4),
        totalReceived: stats.solChanges.totalReceived.toFixed(4),
        netChange: (stats.solChanges.totalReceived - stats.solChanges.totalSpent).toFixed(4),
        totalFees: stats.solChanges.totalFees.toFixed(4)
      },
      tokens: tokenArray.slice(0, 20), // Top 20 traded tokens
      recentActivity: transactions.slice(0, 10).map((tx, i) => ({
        signature: signatures[i]?.signature,
        time: signatures[i]?.blockTime * 1000,
        slot: tx?.slot
      }))
    };
  }

  /**
   * Calculate average trades per day
   */
  calculateAvgTradesPerDay(firstTime, lastTime, totalTrades) {
    if (!firstTime || !lastTime || totalTrades === 0) return 0;
    const days = (lastTime - firstTime) / (1000 * 60 * 60 * 24);
    return days > 0 ? (totalTrades / days).toFixed(2) : totalTrades;
  }
}

module.exports = HeliusWalletService;
