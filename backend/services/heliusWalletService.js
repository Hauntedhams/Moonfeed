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
    this.tokenMetadataCache = new Map(); // Cache for token metadata
  }

  /**
   * Fetch token metadata from Jupiter API
   */
  async getTokenMetadata(mintAddress) {
    // Check cache first
    const cached = this.tokenMetadataCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.data;
    }

    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    if (mintAddress === SOL_MINT) {
      return { symbol: 'SOL', name: 'Solana', image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' };
    }

    try {
      // Try Jupiter token API first
      const response = await fetch(`https://tokens.jup.ag/token/${mintAddress}`, {
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      });

      if (response.ok) {
        const data = await response.json();
        const metadata = {
          symbol: data.symbol || 'Unknown',
          name: data.name || data.symbol || 'Unknown Token',
          image: data.logoURI || null
        };
        
        // Cache the result
        this.tokenMetadataCache.set(mintAddress, { data: metadata, timestamp: Date.now() });
        return metadata;
      }
    } catch (e) {
      console.log(`⚠️ Jupiter metadata lookup failed for ${mintAddress.slice(0, 8)}:`, e.message);
    }

    // Fallback: try DexScreener
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`, {
        timeout: 5000
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          const isBase = pair.baseToken?.address === mintAddress;
          const token = isBase ? pair.baseToken : pair.quoteToken;
          
          const metadata = {
            symbol: token?.symbol || 'Unknown',
            name: token?.name || token?.symbol || 'Unknown Token',
            image: pair.info?.imageUrl || null
          };
          
          this.tokenMetadataCache.set(mintAddress, { data: metadata, timestamp: Date.now() });
          return metadata;
        }
      }
    } catch (e) {
      console.log(`⚠️ DexScreener metadata lookup failed for ${mintAddress.slice(0, 8)}:`, e.message);
    }

    // Return unknown if all lookups fail
    return { symbol: 'Unknown', name: 'Unknown Token', image: null };
  }

  /**
   * Batch fetch token metadata for multiple mints
   */
  async batchGetTokenMetadata(mintAddresses) {
    const uniqueMints = [...new Set(mintAddresses)];
    const results = {};
    
    // Fetch all in parallel
    await Promise.all(
      uniqueMints.map(async (mint) => {
        results[mint] = await this.getTokenMetadata(mint);
      })
    );
    
    return results;
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

  /**
   * Get swap transactions for a wallet (Jupiter swaps specifically)
   * Returns formatted transactions for the Transactions history section
   */
  async getSwapTransactions(walletAddress, limit = 50) {
    const cacheKey = `swaps-${walletAddress}-${limit}`;
    
    return this.getCached(cacheKey, async () => {
      try {
        console.log(`\n🔍 Fetching swap transactions for: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`);

        // Use Helius enhanced transactions API for parsed swap data
        const apiKey = this.apiKey;
        const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=${limit}&type=SWAP`;

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          // Fallback to regular transactions if SWAP type doesn't work
          console.log('⚠️ SWAP type not supported, fetching all transactions...');
          return await this.getSwapTransactionsFallback(walletAddress, limit);
        }

        const transactions = await response.json();
        console.log(`✅ Found ${transactions.length} swap transactions`);

        return await this.parseSwapTransactions(transactions, walletAddress);

      } catch (error) {
        console.error(`❌ Error fetching swap transactions:`, error.message);
        // Try fallback method
        return await this.getSwapTransactionsFallback(walletAddress, limit);
      }
    });
  }

  /**
   * Fallback method - fetch all transactions and filter for swaps
   */
  async getSwapTransactionsFallback(walletAddress, limit = 50) {
    try {
      console.log(`📡 Using fallback: Fetching all transactions and filtering for swaps...`);

      const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${this.apiKey}&limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const transactions = await response.json();
      console.log(`✅ Fetched ${transactions.length} transactions, filtering for swaps...`);

      return await this.parseSwapTransactions(transactions, walletAddress);

    } catch (error) {
      console.error(`❌ Fallback also failed:`, error.message);
      return {
        success: false,
        transactions: [],
        error: error.message
      };
    }
  }

  /**
   * Parse transactions and extract swap data
   */
  async parseSwapTransactions(transactions, walletAddress) {
    const swaps = [];
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const tokenMintsToFetch = new Set();

    // First pass: extract swaps and collect token mints
    for (const tx of transactions) {
      try {
        // Skip failed transactions
        if (tx.transactionError) continue;

        // Check if this is a swap transaction
        const isSwap = this.isSwapTransaction(tx);
        if (!isSwap) continue;

        // Extract swap details
        const swapData = this.extractSwapDetails(tx, walletAddress, SOL_MINT);
        if (swapData) {
          swaps.push(swapData);
          // Collect token mints for metadata lookup
          if (swapData.tokenMint && swapData.tokenMint !== SOL_MINT) {
            tokenMintsToFetch.add(swapData.tokenMint);
          }
        }

      } catch (e) {
        console.log(`⚠️ Error parsing tx ${tx.signature?.slice(0, 8)}:`, e.message);
      }
    }

    console.log(`✅ Parsed ${swaps.length} swap transactions, fetching metadata for ${tokenMintsToFetch.size} tokens...`);

    // Fetch token metadata for all unique mints
    let tokenMetadata = {};
    if (tokenMintsToFetch.size > 0) {
      try {
        tokenMetadata = await this.batchGetTokenMetadata([...tokenMintsToFetch]);
        console.log(`✅ Fetched metadata for ${Object.keys(tokenMetadata).length} tokens`);
      } catch (e) {
        console.log(`⚠️ Failed to fetch some token metadata:`, e.message);
      }
    }

    // Enrich swaps with metadata
    for (const swap of swaps) {
      if (swap.tokenMint && tokenMetadata[swap.tokenMint]) {
        const meta = tokenMetadata[swap.tokenMint];
        swap.tokenSymbol = meta.symbol || swap.tokenSymbol;
        swap.tokenName = meta.name || swap.tokenName;
        swap.tokenImage = meta.image || swap.tokenImage;
      }
    }

    // Sort by timestamp (most recent first)
    swaps.sort((a, b) => b.timestamp - a.timestamp);

    return {
      success: true,
      transactions: swaps,
      count: swaps.length,
      wallet: walletAddress
    };
  }

  /**
   * Check if a transaction is a swap (DEX trade)
   */
  isSwapTransaction(tx) {
    // Check for common DEX program IDs
    const swapPrograms = [
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter v4
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
      '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca
      'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ', // Saber
      'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr', // Raydium
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
      'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CPMM
      'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // Meteora
    ];

    // Check if transaction involves any swap program
    if (tx.source && swapPrograms.some(p => tx.source.includes('JUPITER') || tx.source.includes('RAYDIUM') || tx.source.includes('ORCA'))) {
      return true;
    }

    // Check token transfers - a swap typically has 2+ token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length >= 2) {
      return true;
    }

    // Check description
    if (tx.description && (tx.description.toLowerCase().includes('swap') || tx.description.toLowerCase().includes('traded'))) {
      return true;
    }

    // Check for native transfers combined with token transfers (SOL -> Token swap)
    if (tx.nativeTransfers?.length > 0 && tx.tokenTransfers?.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Extract swap details from transaction
   */
  extractSwapDetails(tx, walletAddress, SOL_MINT) {
    const timestamp = tx.timestamp ? tx.timestamp * 1000 : Date.now();
    
    // Find what was spent and what was received
    let inputToken = null;
    let outputToken = null;
    let inputAmount = 0;
    let outputAmount = 0;

    // Check token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        const amount = parseFloat(transfer.tokenAmount || 0);
        
        // User sent tokens (input)
        if (transfer.fromUserAccount === walletAddress && amount > 0) {
          inputToken = {
            mint: transfer.mint,
            symbol: transfer.symbol || 'Unknown',
            amount: amount,
            decimals: transfer.decimals || 9
          };
          inputAmount = amount;
        }
        
        // User received tokens (output)
        if (transfer.toUserAccount === walletAddress && amount > 0) {
          outputToken = {
            mint: transfer.mint,
            symbol: transfer.symbol || 'Unknown',
            amount: amount,
            decimals: transfer.decimals || 9
          };
          outputAmount = amount;
        }
      }
    }

    // Check native (SOL) transfers
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      for (const transfer of tx.nativeTransfers) {
        const amount = (transfer.amount || 0) / 1e9; // Convert lamports to SOL
        
        // User sent SOL (buying tokens)
        if (transfer.fromUserAccount === walletAddress && amount > 0.001) {
          if (!inputToken || inputToken.mint === SOL_MINT) {
            inputToken = {
              mint: SOL_MINT,
              symbol: 'SOL',
              amount: amount,
              decimals: 9
            };
            inputAmount = amount;
          }
        }
        
        // User received SOL (selling tokens)
        if (transfer.toUserAccount === walletAddress && amount > 0.001) {
          if (!outputToken || outputToken.mint === SOL_MINT) {
            outputToken = {
              mint: SOL_MINT,
              symbol: 'SOL',
              amount: amount,
              decimals: 9
            };
            outputAmount = amount;
          }
        }
      }
    }

    // Need both input and output to be a valid swap
    if (!inputToken || !outputToken) {
      return null;
    }

    // Determine if it's a buy or sell (from meme coin perspective)
    // Buy = SOL -> Token, Sell = Token -> SOL
    const isBuy = inputToken.mint === SOL_MINT;
    const tokenMint = isBuy ? outputToken.mint : inputToken.mint;
    const tokenSymbol = isBuy ? outputToken.symbol : inputToken.symbol;
    const tokenAmount = isBuy ? outputAmount : inputAmount;
    const solAmount = isBuy ? inputAmount : outputAmount;

    // Calculate price per token
    const pricePerToken = tokenAmount > 0 ? solAmount / tokenAmount : 0;

    return {
      id: `${tx.signature}_${timestamp}`,
      signature: tx.signature,
      type: isBuy ? 'buy' : 'sell',
      tokenMint: tokenMint,
      tokenSymbol: tokenSymbol,
      tokenName: tokenSymbol, // Would need metadata lookup for full name
      tokenImage: null, // Would need metadata lookup
      inputAmount: isBuy ? solAmount : tokenAmount,
      outputAmount: isBuy ? tokenAmount : solAmount,
      inputMint: inputToken.mint,
      outputMint: outputToken.mint,
      inputSymbol: inputToken.symbol,
      outputSymbol: outputToken.symbol,
      pricePerToken: pricePerToken,
      timestamp: timestamp,
      createdAt: new Date(timestamp).toISOString(),
      source: tx.source || 'Unknown DEX',
      description: tx.description || `Swapped ${inputToken.symbol} for ${outputToken.symbol}`
    };
  }
}

module.exports = HeliusWalletService;
