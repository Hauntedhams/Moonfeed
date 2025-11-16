/**
 * Solana Pool WebSocket Monitor
 * 
 * Monitors Raydium liquidity pool accounts via Solana RPC WebSocket
 * to provide real-time price updates for tokens.
 * 
 * This uses the FREE Solana RPC accountSubscribe WebSocket method
 * to listen for changes to pool accounts, which happen on every swap.
 */

const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const fetch = require('node-fetch');
const BufferLayout = require('buffer-layout');

// Helper function to create u64 layout
function u64(property) {
  return BufferLayout.blob(8, property);
}

// Helper function to create u128 layout  
function u128(property) {
  return BufferLayout.blob(16, property);
}

// Raydium AMM Pool Layout (simplified - only the fields we need)
const RAYDIUM_POOL_LAYOUT = BufferLayout.struct([
  u64('status'),
  u64('nonce'),
  u64('maxOrder'),
  u64('depth'),
  u64('baseDecimal'),
  u64('quoteDecimal'),
  u64('state'),
  u64('resetFlag'),
  u64('minSize'),
  u64('volMaxCutRatio'),
  u64('amountWaveRatio'),
  u64('baseLotSize'),
  u64('quoteLotSize'),
  u64('minPriceMultiplier'),
  u64('maxPriceMultiplier'),
  u64('systemDecimalValue'),
  u64('minSeparateNumerator'),
  u64('minSeparateDenominator'),
  u64('tradeFeeNumerator'),
  u64('tradeFeeDenominator'),
  u64('pnlNumerator'),
  u64('pnlDenominator'),
  u64('swapFeeNumerator'),
  u64('swapFeeDenominator'),
  u64('baseNeedTakePnl'),
  u64('quoteNeedTakePnl'),
  u64('quoteTotalPnl'),
  u64('baseTotalPnl'),
  u64('poolOpenTime'),
  u64('punishPcAmount'),
  u64('punishCoinAmount'),
  u64('orderbookToInitTime'),
  u128('swapBaseInAmount'),    // Important: total base tokens
  u128('swapQuoteOutAmount'),  // Important: total quote tokens
  u64('swapBase2QuoteFee'),
  u128('swapQuoteInAmount'),
  u128('swapBaseOutAmount'),
  u64('swapQuote2BaseFee'),
  BufferLayout.blob(32, 'baseMint'),        // Token mint address
  BufferLayout.blob(32, 'quoteMint'),       // Quote mint address (usually SOL/USDC)
  BufferLayout.blob(32, 'lpMint'),
  BufferLayout.blob(32, 'openOrders'),
  BufferLayout.blob(32, 'marketId'),
  BufferLayout.blob(32, 'marketProgramId'),
  BufferLayout.blob(32, 'targetOrders'),
  BufferLayout.blob(32, 'withdrawQueue'),
  BufferLayout.blob(32, 'lpVault'),
  BufferLayout.blob(32, 'owner'),
  BufferLayout.blob(32, 'lpReserve'),
  BufferLayout.blob(128, 'padding'),
]);

class SolanaPoolMonitor {
  constructor(rpcEndpoint = 'https://api.mainnet-beta.solana.com') {
    this.rpcEndpoint = rpcEndpoint;
    this.wsEndpoint = rpcEndpoint.replace('https://', 'wss://').replace('http://', 'ws://');
    this.ws = null;
    this.subscriptions = new Map(); // tokenAddress -> { subscriptionId, poolAddress, clients }
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.priceCache = new Map(); // tokenAddress -> { price, timestamp }
    this.PRICE_CACHE_TTL = 2000; // Don't fetch price more often than every 2 seconds
  }

  /**
   * Get the pool address for a token from ANY DEX (Raydium, Orca, Meteora, Pump.fun, etc.)
   * Uses DexScreener to find the highest liquidity pool across all DEXes
   */
  async getPoolAddress(tokenAddress) {
    try {
      console.log(`[SolanaPoolMonitor] Looking up pool for token ${tokenAddress}...`);
      
      // Try DexScreener first - it aggregates ALL DEXes on Solana
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const dexData = await dexResponse.json();
      
      if (dexData.pairs && dexData.pairs.length > 0) {
        // Filter for Solana DEXes only
        const solanaPairs = dexData.pairs.filter(p => p.chainId === 'solana');
        
        if (solanaPairs.length > 0) {
          // Sort by liquidity (highest first) to get the most active pool
          const sortedPairs = solanaPairs.sort((a, b) => 
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          );
          
          const bestPool = sortedPairs[0];
          console.log(`[SolanaPoolMonitor] Found pool on ${bestPool.dexId}: ${bestPool.pairAddress}`);
          console.log(`[SolanaPoolMonitor]   Liquidity: $${bestPool.liquidity?.usd?.toLocaleString() || 'unknown'}`);
          console.log(`[SolanaPoolMonitor]   Price: $${bestPool.priceUsd || 'unknown'}`);
          
          // Return the pair address (this is the pool account address)
          return bestPool.pairAddress;
        }
      }

      // Fallback: Try Raydium API directly
      console.log(`[SolanaPoolMonitor] No pool found in DexScreener, trying Raydium API...`);
      const raydiumResponse = await fetch(`https://api.raydium.io/v2/main/pairs`);
      const raydiumData = await raydiumResponse.json();
      
      // Find pool for this token
      const pool = Object.values(raydiumData).find(p => 
        p.baseMint === tokenAddress || p.quoteMint === tokenAddress
      );
      
      if (pool) {
        console.log(`[SolanaPoolMonitor] Found Raydium pool: ${pool.ammId}`);
        return pool.ammId;
      }

      throw new Error(`No pool found for token ${tokenAddress} on any DEX`);
    } catch (error) {
      console.error('[SolanaPoolMonitor] Error getting pool address:', error.message);
      throw error;
    }
  }

  /**
   * Parse pool account data to extract price
   * 
   * HYBRID APPROACH:
   * - Detect account change via Solana RPC (means a swap happened)
   * - Fetch actual price from DexScreener API (works for ALL DEXes)
   * - This gives us near-real-time updates without complex parsing
   * - NOTE: This is now only used when RPC detects a swap
   */
  async parsePoolPrice(accountData, tokenAddress, poolAddress) {
    // Account data changed = a swap just happened!
    console.log(`[SolanaPoolMonitor] 🔥 Pool activity detected for ${tokenAddress.substring(0, 8)}... (swap in progress)`);
    
    // Fetch fresh price (will use cache if recent)
    return this.fetchPoolPrice(tokenAddress, poolAddress);
  }

  /**
   * Convert u128 to JavaScript number
   * u128 is stored as array of bytes in little-endian format
   */
  u128ToNumber(u128Value) {
    // u128 is a Buffer or Uint8Array of 16 bytes
    if (!u128Value) return 0;
    
    let result = 0;
    for (let i = 0; i < Math.min(8, u128Value.length); i++) {
      result += u128Value[i] * Math.pow(256, i);
    }
    return result;
  }

  /**
   * Connect to Solana RPC WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[SolanaPoolMonitor] Connecting to ${this.wsEndpoint}...`);
        
        this.ws = new WebSocket(this.wsEndpoint);

        this.ws.on('open', () => {
          console.log('[SolanaPoolMonitor] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', async (data) => {
          await this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          console.error('[SolanaPoolMonitor] WebSocket error:', error.message);
        });

        this.ws.on('close', () => {
          console.log('[SolanaPoolMonitor] WebSocket closed');
          this.handleDisconnect();
        });

      } catch (error) {
        console.error('[SolanaPoolMonitor] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle subscription response (returns subscription ID)
      if (message.result && typeof message.result === 'number' && message.id) {
        const subscriptionId = message.result;
        const requestId = message.id;
        
        console.log(`[SolanaPoolMonitor] Subscription confirmed: ${subscriptionId} (request ${requestId})`);
        
        // Find the subscription that matches this request ID and update its subscriptionId
        // We use the request ID (timestamp) to match
        for (const [tokenAddress, sub] of this.subscriptions.entries()) {
          if (sub.poolAddress && !sub.subscriptionId) {
            sub.subscriptionId = subscriptionId;
            console.log(`[SolanaPoolMonitor] Mapped subscription ${subscriptionId} to token ${tokenAddress}`);
            break;
          }
        }
        return;
      }

      // Handle account notifications
      if (message.method === 'accountNotification') {
        const { subscription, result } = message.params;
        
        // Find which token this subscription belongs to
        for (const [tokenAddress, sub] of this.subscriptions.entries()) {
          if (sub.subscriptionId === subscription) {
            // Parse the account data to extract price (now async)
            const priceData = await this.parsePoolPrice(result.value.data, tokenAddress, sub.poolAddress);
            
            if (priceData) {
              // Broadcast to all connected clients for this token
              sub.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'price_update',
                    token: tokenAddress,
                    data: priceData
                  }), {
                    compress: false,
                    binary: false
                  });
                }
              });
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error('[SolanaPoolMonitor] Error handling message:', error);
    }
  }

  /**
   * Subscribe to pool account updates for a token
   */
  async subscribeToToken(tokenAddress, clientWs) {
    try {
      // Check if already subscribed
      let sub = this.subscriptions.get(tokenAddress);
      
      if (sub) {
        // Add client to existing subscription
        if (!sub.clients.includes(clientWs)) {
          sub.clients.push(clientWs);
        }
        console.log(`[SolanaPoolMonitor] Added client to existing subscription for ${tokenAddress}`);
        return;
      }

      // Get pool address
      const poolAddress = await this.getPoolAddress(tokenAddress);
      console.log(`[SolanaPoolMonitor] Pool address for ${tokenAddress}: ${poolAddress}`);

      // Send accountSubscribe request
      const subscribeRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'accountSubscribe',
        params: [
          poolAddress,
          {
            encoding: 'base64', // or 'jsonParsed' if supported for this account type
            commitment: 'confirmed' // or 'finalized' for slower but more secure updates
          }
        ]
      };

      this.ws.send(JSON.stringify(subscribeRequest));

      // Store subscription (subscriptionId will be set when we receive the response)
      const subscription = {
        subscriptionId: null,
        poolAddress,
        clients: [clientWs],
        pollingInterval: null
      };
      this.subscriptions.set(tokenAddress, subscription);

      // Start polling fallback for inactive pools
      this.startPolling(tokenAddress, subscription);

      console.log(`[SolanaPoolMonitor] Subscribed to pool ${poolAddress} for token ${tokenAddress}`);
    } catch (error) {
      console.error(`[SolanaPoolMonitor] Error subscribing to token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Start polling for price updates (fallback for inactive pools)
   */
  startPolling(tokenAddress, subscription) {
    // Clear any existing interval
    if (subscription.pollingInterval) {
      clearInterval(subscription.pollingInterval);
    }

    console.log(`[SolanaPoolMonitor] Starting price polling for ${tokenAddress.substring(0, 8)}...`);

    subscription.pollingInterval = setInterval(async () => {
      try {
        // Fetch latest price
        const priceData = await this.fetchPoolPrice(tokenAddress, subscription.poolAddress);
        
        if (priceData) {
          // Broadcast to all clients
          subscription.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'price_update',
                token: tokenAddress,
                data: priceData
              }), {
                compress: false,
                binary: false
              });
            }
          });
        }
      } catch (error) {
        console.error(`[SolanaPoolMonitor] Polling error for ${tokenAddress}:`, error.message);
      }
    }, this.POLLING_INTERVAL);
  }

  /**
   * Fetch pool price from DexScreener API (extracted from parsePoolPrice)
   */
  async fetchPoolPrice(tokenAddress, poolAddress) {
    try {
      // Check cache to avoid excessive API calls
      const cached = this.priceCache.get(tokenAddress);
      if (cached && (Date.now() - cached.timestamp) < this.PRICE_CACHE_TTL) {
        return cached.data;
      }
      
      console.log(`[SolanaPoolMonitor] Fetching price for ${tokenAddress.substring(0, 8)}...`);
      
      // Fetch current price from DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${poolAddress}`);
      const data = await response.json();
      
      if (data.pair) {
        const pair = data.pair;
        const price = parseFloat(pair.priceUsd) || 0;
        const liquidity = parseFloat(pair.liquidity?.usd) || 0;
        const volume24h = parseFloat(pair.volume?.h24) || 0;
        const priceChange24h = parseFloat(pair.priceChange?.h24) || 0;
        
        const priceData = {
          price,
          timestamp: Date.now(),
          liquidity,
          volume24h,
          priceChange24h,
          dex: pair.dexId
        };
        
        // Cache the result
        this.priceCache.set(tokenAddress, {
          data: priceData,
          timestamp: Date.now()
        });
        
        return priceData;
      }
      
      return null;
      
    } catch (error) {
      console.error('[SolanaPoolMonitor] Error fetching price:', error.message);
      return null;
    }
  }

  /**
   * Unsubscribe from token updates
   */
  async unsubscribeFromToken(tokenAddress, clientWs) {
    const sub = this.subscriptions.get(tokenAddress);
    if (!sub) return;

    // Remove client
    sub.clients = sub.clients.filter(c => c !== clientWs);

    // If no more clients, unsubscribe from pool and stop polling
    if (sub.clients.length === 0) {
      // Stop polling
      if (sub.pollingInterval) {
        clearInterval(sub.pollingInterval);
        sub.pollingInterval = null;
      }
      
      // Unsubscribe from RPC
      if (sub.subscriptionId) {
        const unsubscribeRequest = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'accountUnsubscribe',
          params: [sub.subscriptionId]
        };

        this.ws.send(JSON.stringify(unsubscribeRequest));
        console.log(`[SolanaPoolMonitor] Unsubscribed from RPC for ${tokenAddress}`);
      }
      
      this.subscriptions.delete(tokenAddress);
      console.log(`[SolanaPoolMonitor] Fully unsubscribed from ${tokenAddress}`);
    }
  }

  /**
   * Handle disconnection and reconnection
   */
  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[SolanaPoolMonitor] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().then(() => {
          // Re-subscribe to all tokens
          for (const [tokenAddress, sub] of this.subscriptions.entries()) {
            this.subscribeToToken(tokenAddress, sub.clients[0]);
          }
        }).catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[SolanaPoolMonitor] Max reconnection attempts reached');
    }
  }

  /**
   * Close WebSocket connection
   */
  close() {
    // Clear all polling intervals
    for (const sub of this.subscriptions.values()) {
      if (sub.pollingInterval) {
        clearInterval(sub.pollingInterval);
      }
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }
}

module.exports = SolanaPoolMonitor;
