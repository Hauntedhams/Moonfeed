const axios = require('axios');

/**
 * Solana Transaction Service (Simplified)
 * 
 * Uses Helius enhanced transaction API for parsed swap history.
 * Falls back to Solana RPC if Helius is unavailable.
 * 
 * Simple strategy:
 *   1. getRecentTransactions() → Helius parsed history (fast, pre-parsed)
 *   2. Cache for 15s to avoid repeated hits
 *   3. No live subscriptions (frontend polls every 10s instead)
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || process.env.HELIUS_KEY || '';
const HELIUS_RPC = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

// Known DEX program IDs for labeling
const DEX_PROGRAMS = {
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium V3',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca V2',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter V4',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'Meteora DLMM',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
  'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG': 'Moonshot',
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': 'Phoenix',
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': 'Serum',
  'DFLow1msLDJn5uLH4dXCSGFSzSLKHfEA3fCmbEsiy2TG': 'DFlow',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

class SolanaTransactionService {
  constructor() {
    this.txCache = new Map(); // mintAddress -> { transactions, timestamp }
    this.CACHE_TTL = 15_000; // 15 seconds
    
    console.log('[TxService] Initialized. Helius:', HELIUS_RPC ? 'YES' : 'NO (will use fallback)');
  }

  /**
   * Fetch the most recent swap transactions for a token.
   * Uses Helius enhanced API (fast, pre-parsed) with Solana RPC fallback.
   */
  async getRecentTransactions(mintAddress, limit = 50) {
    // Check cache first
    const cached = this.txCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.transactions;
    }

    let transactions = [];

    // Strategy 1: Helius parsed transaction history (fast & reliable)
    if (HELIUS_API_KEY) {
      transactions = await this.fetchViaHelius(mintAddress, limit);
    }

    // Strategy 2: Solana RPC fallback (slower, less reliable on public endpoint)
    if (transactions.length === 0) {
      transactions = await this.fetchViaSolanaRpc(mintAddress, limit);
    }

    // Cache result
    if (transactions.length > 0) {
      this.txCache.set(mintAddress, { transactions, timestamp: Date.now() });
    }

    // Evict old cache entries
    if (this.txCache.size > 200) {
      const oldest = this.txCache.keys().next().value;
      this.txCache.delete(oldest);
    }

    return transactions;
  }

  /**
   * Fetch via Helius enhanced transactions API.
   * Returns pre-parsed swap data — no raw transaction parsing needed.
   * 
   * Fetches extra signatures to compensate for filtering (many tx types
   * like UNKNOWN, INITIALIZE_ACCOUNT get filtered out). Uses pagination
   * to ensure we reach the requested limit of actual swaps.
   */
  async fetchViaHelius(mintAddress, limit) {
    try {
      const parsed = [];
      let beforeSig = undefined; // for pagination
      const MAX_PAGES = 3; // max pagination rounds to avoid infinite loops

      for (let page = 0; page < MAX_PAGES && parsed.length < limit; page++) {
        // Fetch more signatures than needed — many won't be swaps
        const fetchCount = Math.min((limit - parsed.length) * 3, 100);

        const sigParams = { limit: fetchCount };
        if (beforeSig) sigParams.before = beforeSig;

        const sigResponse = await axios.post(HELIUS_RPC, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [mintAddress, sigParams],
        }, { timeout: 8000 });

        const signatures = sigResponse.data?.result;
        if (!signatures || signatures.length === 0) break;

        // Track last signature for pagination
        beforeSig = signatures[signatures.length - 1].signature;

        const sigList = signatures.map(s => s.signature);

        // Parse transactions via Helius enhanced API
        const parseResponse = await axios.post(
          `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
          { transactions: sigList },
          { timeout: 10000 }
        );

        if (!Array.isArray(parseResponse.data)) break;

        // Extract swap data from Helius parsed format
        for (const tx of parseResponse.data) {
          const swap = this.extractSwapFromHelius(tx, mintAddress);
          if (swap) {
            parsed.push(swap);
            if (parsed.length >= limit) break;
          }
        }

        // If we got fewer signatures than requested, no more pages exist
        if (signatures.length < fetchCount) break;
      }

      console.log(`[TxService] Helius returned ${parsed.length} swaps for ${mintAddress.substring(0, 8)}`);
      return parsed;

    } catch (error) {
      console.warn(`[TxService] Helius fetch failed for ${mintAddress.substring(0, 8)}:`, error.message);
      return [];
    }
  }

  /**
   * Extract swap info from a Helius-parsed transaction.
   * Helius returns type: "SWAP" with tokenTransfers and nativeTransfers already parsed.
   */
  extractSwapFromHelius(tx, mintAddress) {
    try {
      // Accept SWAP, TRANSFER, and UNKNOWN types — many DEX swaps
      // (e.g. DFlow, Meteora DLMM) are classified as UNKNOWN by Helius
      // but still contain valid tokenTransfers we can parse.
      // Skip only explicitly non-swap types.
      const SKIP_TYPES = new Set([
        'INITIALIZE_ACCOUNT', 'CREATE_ACCOUNT', 'CLOSE_ACCOUNT',
        'TOKEN_MINT', 'BURN', 'BURN_NFT', 'NFT_SALE', 'NFT_MINT',
        'STAKE', 'UNSTAKE', 'COMPRESSED_NFT_MINT',
      ]);
      if (SKIP_TYPES.has(tx.type)) return null;

      const sig = tx.signature;
      const timestamp = tx.timestamp ? tx.timestamp * 1000 : Date.now();
      const wallet = tx.feePayer || 'Unknown';

      // Find the token transfer for our mint
      let tokenAmount = 0;
      let side = 'unknown';
      let solAmount = 0;

      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          if (transfer.mint === mintAddress) {
            const amt = Math.abs(transfer.tokenAmount || 0);
            if (amt > tokenAmount) {
              tokenAmount = amt;
              // If feePayer received tokens → buy, sent → sell
              if (transfer.toUserAccount === wallet) {
                side = 'buy';
              } else if (transfer.fromUserAccount === wallet) {
                side = 'sell';
              }
            }
          }
          // SOL/WSOL transfer
          if (transfer.mint === SOL_MINT) {
            const amt = Math.abs(transfer.tokenAmount || 0);
            if (amt > solAmount) solAmount = amt;
          }
        }
      }

      // Also check native SOL transfers
      if (solAmount === 0 && tx.nativeTransfers) {
        for (const nt of tx.nativeTransfers) {
          if (nt.fromUserAccount === wallet || nt.toUserAccount === wallet) {
            const amt = Math.abs(nt.amount || 0) / 1e9; // lamports → SOL
            if (amt > solAmount) solAmount = amt;
          }
        }
      }

      // Skip non-swap transactions (no token movement for our mint)
      if (tokenAmount === 0) return null;

      // Determine DEX from program interactions
      let dex = null;
      if (tx.instructions) {
        for (const ix of tx.instructions) {
          if (DEX_PROGRAMS[ix.programId]) {
            dex = DEX_PROGRAMS[ix.programId];
            break;
          }
        }
      }
      // Helius also provides source field (e.g. "DFLOW", "METEORA", "JUPITER")
      if (!dex && tx.source) {
        dex = tx.source;
      }

      return {
        signature: sig,
        timestamp,
        side,
        dex: dex || 'Unknown',
        wallet,
        tokenAmount,
        solAmount,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Fallback: Fetch via raw Solana RPC.
   * Uses the public endpoint or HELIUS_RPC — slower but works as backup.
   */
  async fetchViaSolanaRpc(mintAddress, limit) {
    const rpcUrl = HELIUS_RPC || 'https://api.mainnet-beta.solana.com';
    
    try {
      // Fetch more signatures than needed because many won't be swaps
      const fetchCount = Math.min(limit * 3, 100);

      // Get recent signatures
      const sigResponse = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [mintAddress, { limit: fetchCount }],
      }, { timeout: 8000 });

      const signatures = sigResponse.data?.result;
      if (!signatures || signatures.length === 0) return [];

      // Fetch transactions in small batches to avoid rate limits
      const BATCH = 5;
      const parsed = [];

      for (let i = 0; i < signatures.length && parsed.length < limit; i += BATCH) {
        const batch = signatures.slice(i, i + BATCH);
        
        const results = await Promise.allSettled(
          batch.map(sig => 
            axios.post(rpcUrl, {
              jsonrpc: '2.0',
              id: 1,
              method: 'getTransaction',
              params: [sig.signature, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
            }, { timeout: 5000 })
          )
        );

        for (let j = 0; j < results.length; j++) {
          if (parsed.length >= limit) break;
          const result = results[j];
          if (result.status !== 'fulfilled') continue;
          
          const tx = result.value?.data?.result;
          if (!tx || !tx.meta || tx.meta.err) continue;

          const swap = this.extractSwapFromRpc(tx, signatures[i + j].signature, mintAddress);
          if (swap) parsed.push(swap);
        }

        // Small delay between batches on public RPC
        if (!HELIUS_RPC && i + BATCH < signatures.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      console.log(`[TxService] RPC returned ${parsed.length} swaps for ${mintAddress.substring(0, 8)}`);
      return parsed;

    } catch (error) {
      console.error(`[TxService] RPC fallback failed for ${mintAddress.substring(0, 8)}:`, error.message);
      return [];
    }
  }

  /**
   * Extract swap data from a raw Solana RPC transaction (jsonParsed encoding).
   */
  extractSwapFromRpc(tx, signature, mintAddress) {
    try {
      const { meta } = tx;
      const wallet = tx.transaction?.message?.accountKeys?.[0]?.pubkey || 'Unknown';

      // Determine DEX from program IDs in instructions
      let dex = null;
      const instructions = tx.transaction?.message?.instructions || [];
      for (const ix of instructions) {
        if (DEX_PROGRAMS[ix.programId]) {
          dex = DEX_PROGRAMS[ix.programId];
          break;
        }
      }
      // Also check inner instructions
      if (!dex && meta.innerInstructions) {
        for (const inner of meta.innerInstructions) {
          for (const ix of (inner.instructions || [])) {
            if (DEX_PROGRAMS[ix.programId]) {
              dex = DEX_PROGRAMS[ix.programId];
              break;
            }
          }
          if (dex) break;
        }
      }
      if (!dex) return null; // Not a swap

      // Token balance changes
      let tokenAmount = 0;
      let solAmount = 0;
      let side = 'unknown';

      if (meta.preTokenBalances && meta.postTokenBalances) {
        for (const post of meta.postTokenBalances) {
          if (post.mint !== mintAddress) continue;
          const pre = meta.preTokenBalances.find(
            p => p.mint === mintAddress && p.accountIndex === post.accountIndex
          );
          const postAmt = parseFloat(post.uiTokenAmount?.uiAmountString || '0');
          const preAmt = pre ? parseFloat(pre.uiTokenAmount?.uiAmountString || '0') : 0;
          const diff = postAmt - preAmt;
          if (Math.abs(diff) > tokenAmount) {
            tokenAmount = Math.abs(diff);
            side = diff > 0 ? 'buy' : 'sell';
          }
        }

        // SOL/WSOL changes
        for (const post of meta.postTokenBalances) {
          if (post.mint !== SOL_MINT) continue;
          const pre = meta.preTokenBalances.find(
            p => p.mint === SOL_MINT && p.accountIndex === post.accountIndex
          );
          const postAmt = parseFloat(post.uiTokenAmount?.uiAmountString || '0');
          const preAmt = pre ? parseFloat(pre.uiTokenAmount?.uiAmountString || '0') : 0;
          const diff = Math.abs(postAmt - preAmt);
          if (diff > solAmount) solAmount = diff;
        }
      }

      // Native SOL fallback
      if (solAmount === 0 && meta.preBalances && meta.postBalances) {
        const preSol = meta.preBalances[0] || 0;
        const postSol = meta.postBalances[0] || 0;
        const fee = meta.fee || 0;
        solAmount = Math.abs(postSol - preSol - fee) / 1e9;
      }

      if (tokenAmount === 0) return null;

      return {
        signature,
        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
        side,
        dex: dex || 'Unknown',
        wallet,
        tokenAmount,
        solAmount,
      };
    } catch (e) {
      return null;
    }
  }
}

// Export singleton
module.exports = new SolanaTransactionService();
