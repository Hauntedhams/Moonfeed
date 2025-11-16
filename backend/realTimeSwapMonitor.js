/**
 * Real-Time Swap Monitor via Solana RPC
 * 
 * Monitors DEX swap programs (Raydium, Orca, etc.) via logsSubscribe
 * to catch EVERY swap as it happens - true sub-second updates!
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');
const { PublicKey } = require('@solana/web3.js');

// DEX Program IDs
const DEX_PROGRAMS = {
  RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_CLMM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  ORCA_WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  METEORA: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  PUMPFUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
};

class RealTimeSwapMonitor {
  constructor(rpcEndpoint = 'https://api.mainnet-beta.solana.com') {
    this.rpcEndpoint = rpcEndpoint;
    this.wsEndpoint = rpcEndpoint.replace('https://', 'wss://').replace('http://', 'ws://');
    this.ws = null;
    this.subscriptions = new Map(); // tokenAddress -> { subscriptionIds: [], poolAddresses: [], clients: [], lastPrice: null }
    this.poolCache = new Map(); // tokenAddress -> poolData
    this.reconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 5;
  }

  /**
   * Find all pools for a token across all DEXes
   */
  async findAllPools(tokenAddress) {
    try {
      // Check cache
      if (this.poolCache.has(tokenAddress)) {
        const cached = this.poolCache.get(tokenAddress);
        if (Date.now() - cached.timestamp < 300000) { // 5 min cache
          return cached.pools;
        }
      }

      console.log(`[SwapMonitor] Finding all pools for ${tokenAddress.substring(0, 8)}...`);

      const pools = [];

      // Method 1: DexScreener (finds all DEX pools)
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        const data = await response.json();
        
        if (data.pairs && data.pairs.length > 0) {
          for (const pair of data.pairs.slice(0, 5)) { // Top 5 pools
            pools.push({
              address: pair.pairAddress,
              dex: pair.dexId,
              liquidity: parseFloat(pair.liquidity?.usd || 0),
              volume24h: parseFloat(pair.volume?.h24 || 0),
              baseToken: pair.baseToken.address,
              quoteToken: pair.quoteToken.address
            });
          }
          console.log(`[SwapMonitor] Found ${pools.length} pools on DexScreener`);
        }
      } catch (error) {
        console.log(`[SwapMonitor] DexScreener lookup failed:`, error.message);
      }

      // Method 2: Check Pump.fun
      if (pools.length === 0) {
        try {
          const tokenMint = new PublicKey(tokenAddress);
          const [bondingCurvePDA] = await PublicKey.findProgramAddress(
            [Buffer.from('bonding-curve'), tokenMint.toBuffer()],
            new PublicKey(DEX_PROGRAMS.PUMPFUN)
          );
          
          pools.push({
            address: bondingCurvePDA.toBase58(),
            dex: 'pump.fun',
            liquidity: 0,
            volume24h: 0,
            baseToken: tokenAddress,
            quoteToken: 'So11111111111111111111111111111111111111112' // SOL
          });
          console.log(`[SwapMonitor] Found Pump.fun bonding curve`);
        } catch (error) {
          console.log(`[SwapMonitor] Not a Pump.fun token`);
        }
      }

      if (pools.length === 0) {
        throw new Error(`No pools found for token ${tokenAddress}`);
      }

      // Cache result
      this.poolCache.set(tokenAddress, {
        pools,
        timestamp: Date.now()
      });

      return pools;

    } catch (error) {
      console.error('[SwapMonitor] Error finding pools:', error.message);
      throw error;
    }
  }

  /**
   * Subscribe to real-time swap events for a token
   * Uses logsSubscribe to catch every swap instantly
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
        console.log(`[SwapMonitor] Added client to existing subscription for ${tokenAddress}`);
        
        // Send last known price immediately
        if (sub.lastPrice) {
          clientWs.send(JSON.stringify({
            type: 'price_update',
            token: tokenAddress,
            data: sub.lastPrice
          }), { compress: false });
        }
        return;
      }

      // Find all pools for this token
      const pools = await this.findAllPools(tokenAddress);
      console.log(`[SwapMonitor] Monitoring ${pools.length} pools for ${tokenAddress.substring(0, 8)}...`);

      // Create subscription
      sub = {
        subscriptionIds: [],
        poolAddresses: pools.map(p => p.address),
        pools,
        clients: [clientWs],
        lastPrice: null
      };
      this.subscriptions.set(tokenAddress, sub);

      // Subscribe to logs for each pool's DEX program
      for (const pool of pools) {
        const programId = this.getProgramIdForDex(pool.dex);
        if (programId) {
          await this.subscribeToProgram(tokenAddress, programId, pool);
        }
      }

      // Also start a slower polling fallback (every 2 seconds) for price accuracy
      this.startPricePolling(tokenAddress, sub);

      console.log(`[SwapMonitor] ✅ Subscribed to real-time swaps for ${tokenAddress.substring(0, 8)}...`);

    } catch (error) {
      console.error(`[SwapMonitor] Error subscribing to token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get program ID for a DEX
   */
  getProgramIdForDex(dexName) {
    const dex = dexName.toLowerCase();
    if (dex.includes('raydium')) return DEX_PROGRAMS.RAYDIUM_V4;
    if (dex.includes('orca')) return DEX_PROGRAMS.ORCA_WHIRLPOOL;
    if (dex.includes('meteora')) return DEX_PROGRAMS.METEORA;
    if (dex.includes('pump')) return DEX_PROGRAMS.PUMPFUN;
    return null;
  }

  /**
   * Subscribe to a DEX program's logs to catch swaps
   */
  async subscribeToProgram(tokenAddress, programId, pool) {
    try {
      const subscribeRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'logsSubscribe',
        params: [
          {
            mentions: [pool.address] // Only logs mentioning this pool
          },
          {
            commitment: 'confirmed'
          }
        ]
      };

      this.ws.send(JSON.stringify(subscribeRequest));
      console.log(`[SwapMonitor] Subscribed to logs for ${pool.dex} pool ${pool.address.substring(0, 8)}...`);

    } catch (error) {
      console.error('[SwapMonitor] Error subscribing to program logs:', error);
    }
  }

  /**
   * Start price polling (fallback for accurate prices)
   */
  startPricePolling(tokenAddress, subscription) {
    if (subscription.pollingInterval) {
      clearInterval(subscription.pollingInterval);
    }

    subscription.pollingInterval = setInterval(async () => {
      try {
        const priceData = await this.fetchCurrentPrice(tokenAddress, subscription.pools);
        
        if (priceData) {
          subscription.lastPrice = priceData;
          
          // Broadcast to all clients
          subscription.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'price_update',
                token: tokenAddress,
                data: priceData
              }), { compress: false });
            }
          });
        }
      } catch (error) {
        console.error(`[SwapMonitor] Polling error:`, error.message);
      }
    }, 2000); // Every 2 seconds for smooth updates
  }

  /**
   * Fetch current price from DexScreener or Jupiter
   */
  async fetchCurrentPrice(tokenAddress, pools) {
    try {
      // Try DexScreener first (most accurate for DEX pools)
      if (pools.length > 0 && pools[0].dex !== 'pump.fun') {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pools[0].address}`);
        const data = await response.json();
        
        if (data.pair) {
          return {
            price: parseFloat(data.pair.priceUsd || 0),
            timestamp: Date.now(),
            liquidity: parseFloat(data.pair.liquidity?.usd || 0),
            volume24h: parseFloat(data.pair.volume?.h24 || 0),
            priceChange24h: parseFloat(data.pair.priceChange?.h24 || 0),
            source: 'dex-swap',
            dex: pools[0].dex
          };
        }
      }

      // Fallback to Jupiter
      const jupResponse = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
      const jupData = await jupResponse.json();
      
      if (jupData.data && jupData.data[tokenAddress]) {
        return {
          price: jupData.data[tokenAddress].price,
          timestamp: Date.now(),
          liquidity: 0,
          volume24h: 0,
          priceChange24h: 0,
          source: 'jupiter',
          dex: 'jupiter-aggregator'
        };
      }

      return null;

    } catch (error) {
      console.error('[SwapMonitor] Error fetching price:', error.message);
      return null;
    }
  }

  /**
   * Connect to Solana RPC WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[SwapMonitor] Connecting to ${this.wsEndpoint}...`);
        
        this.ws = new WebSocket(this.wsEndpoint);

        this.ws.on('open', () => {
          console.log('[SwapMonitor] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', async (data) => {
          await this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          console.error('[SwapMonitor] WebSocket error:', error.message);
        });

        this.ws.on('close', () => {
          console.log('[SwapMonitor] WebSocket closed');
          this.handleDisconnect();
        });

      } catch (error) {
        console.error('[SwapMonitor] Connection error:', error);
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
      
      // Handle subscription confirmation
      if (message.result && typeof message.result === 'number') {
        console.log(`[SwapMonitor] Log subscription confirmed: ${message.result}`);
        return;
      }

      // Handle log notifications (SWAP EVENTS!)
      if (message.method === 'logsNotification') {
        const { logs, signature } = message.params.result.value;
        
        // Check if this is a swap transaction
        const isSwap = logs.some(log => 
          log.includes('Instruction: Swap') || 
          log.includes('swap') ||
          log.includes('SwapBaseIn') ||
          log.includes('SwapBaseOut')
        );

        if (isSwap) {
          console.log(`[SwapMonitor] 🔥 SWAP DETECTED! Signature: ${signature.substring(0, 8)}...`);
          
          // Find which token this swap is for
          for (const [tokenAddress, sub] of this.subscriptions.entries()) {
            // Fetch fresh price immediately
            const priceData = await this.fetchCurrentPrice(tokenAddress, sub.pools);
            
            if (priceData) {
              sub.lastPrice = priceData;
              
              // Broadcast to all clients INSTANTLY
              sub.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'price_update',
                    token: tokenAddress,
                    data: {
                      ...priceData,
                      swapSignature: signature // Include swap signature
                    }
                  }), { compress: false });
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('[SwapMonitor] Error handling message:', error);
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

    // If no more clients, clean up
    if (sub.clients.length === 0) {
      // Stop polling
      if (sub.pollingInterval) {
        clearInterval(sub.pollingInterval);
      }

      // Unsubscribe from logs
      for (const subId of sub.subscriptionIds) {
        const unsubscribeRequest = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'logsUnsubscribe',
          params: [subId]
        };
        this.ws.send(JSON.stringify(unsubscribeRequest));
      }

      this.subscriptions.delete(tokenAddress);
      console.log(`[SwapMonitor] Unsubscribed from ${tokenAddress}`);
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`[SwapMonitor] Reconnecting... (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().then(() => {
          // Resubscribe to all tokens
          for (const [tokenAddress, sub] of this.subscriptions.entries()) {
            if (sub.clients.length > 0) {
              this.subscribeToToken(tokenAddress, sub.clients[0]);
            }
          }
        }).catch(console.error);
      }, 3000 * this.reconnectAttempts);
    }
  }

  /**
   * Close the monitor
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

module.exports = RealTimeSwapMonitor;
