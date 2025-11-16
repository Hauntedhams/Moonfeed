const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const WebSocket = require('ws');

/**
 * Universal Solana Token Monitor
 * 
 * Strategy:
 * 1. First check if token is on Pump.fun
 * 2. If yes: Use Pump.fun monitoring (RPC logs + API polling)
 * 3. If no: Use Birdeye WebSocket for graduated/DEX tokens
 */
class SolanaTokenMonitor {
  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    this.subscriptions = new Map(); // tokenMint -> subscription data
    this.clients = new Map(); // tokenMint -> Set of WebSocket clients
    
    // Pump.fun configuration
    this.PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
    
    console.log('🚀 [SolanaTokenMonitor] Initialized with Solana RPC (Pump.fun + Raydium/DEX)');
  }

  /**
   * Check if a token is on Pump.fun
   */
  async isPumpfunToken(tokenMint) {
    try {
      console.log(`🔍 [Monitor] Checking if ${tokenMint.substring(0, 8)}... is on Pump.fun...`);
      
      const response = await axios.get(`https://frontend-api.pump.fun/coins/${tokenMint}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.mint) {
        console.log(`✅ [Monitor] ${tokenMint.substring(0, 8)}... is on Pump.fun!`);
        return {
          isPumpfun: true,
          bondingCurve: response.data.bonding_curve,
          data: response.data
        };
      }
      
      return { isPumpfun: false };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`ℹ️  [Monitor] ${tokenMint.substring(0, 8)}... not on Pump.fun (404) - will try Birdeye`);
      } else {
        console.log(`⚠️  [Monitor] Error checking Pump.fun:`, error.message);
      }
      return { isPumpfun: false };
    }
  }

  /**
   * Get current price from Pump.fun API
   */
  async getPumpfunPrice(tokenMint) {
    try {
      const response = await axios.get(`https://frontend-api.pump.fun/coins/${tokenMint}`, {
        timeout: 5000
      });
      
      if (response.data) {
        const data = response.data;
        const price = data.usd_market_cap ? data.usd_market_cap / (data.total_supply || 1000000000) : 0;
        
        return {
          price: price,
          priceUsd: price,
          marketCap: data.usd_market_cap || 0,
          volume24h: data.volume_24h || 0,
          bondingCurve: data.bonding_curve,
          liquidity: (data.virtual_sol_reserves || 0) * 150,
          timestamp: Date.now(),
          source: 'pumpfun',
          dex: 'pump.fun'
        };
      }
    } catch (error) {
      console.error(`❌ [Monitor] Error fetching Pump.fun price:`, error.message);
      return null;
    }
  }

  /**
   * Subscribe to a token (auto-detects Pump.fun vs Birdeye)
   */
  async subscribe(tokenMint, client) {
    console.log(`📡 [Monitor] Subscribing to ${tokenMint.substring(0, 8)}...`);
    
    // Add client to subscribers
    if (!this.clients.has(tokenMint)) {
      this.clients.set(tokenMint, new Set());
    }
    this.clients.get(tokenMint).add(client);
    console.log(`👥 [Monitor] Client added. Total clients: ${this.clients.get(tokenMint).size}`);

    // If already subscribed, just add the client
    if (this.subscriptions.has(tokenMint)) {
      console.log(`✅ [Monitor] Already subscribed, reusing existing subscription`);
      return;
    }

    // Check if it's a Pump.fun token
    const pumpfunCheck = await this.isPumpfunToken(tokenMint);
    
    if (pumpfunCheck.isPumpfun) {
      // Use Pump.fun monitoring
      await this.subscribePumpfun(tokenMint, pumpfunCheck);
    } else {
      // Fall back to Raydium/DEX monitoring via Solana RPC + Jupiter
      await this.subscribeRaydium(tokenMint);
    }
  }

  /**
   * Subscribe to Pump.fun token (RPC logs + polling)
   */
  async subscribePumpfun(tokenMint, pumpfunData) {
    console.log(`🎯 [Monitor] Using Pump.fun monitoring for ${tokenMint.substring(0, 8)}...`);
    
    const bondingCurve = pumpfunData.bondingCurve;
    if (!bondingCurve) {
      throw new Error('No bonding curve found for token');
    }

    // Subscribe to Pump.fun program logs
    const subscriptionId = this.connection.onLogs(
      new PublicKey(this.PUMPFUN_PROGRAM),
      async (logs) => {
        const logsText = logs.logs.join('\n');
        
        if (logsText.includes(bondingCurve)) {
          console.log(`🔥 [Monitor] SWAP DETECTED for ${tokenMint.substring(0, 8)}...!`);
          
          const priceData = await this.getPumpfunPrice(tokenMint);
          if (priceData) {
            console.log(`💰 [Monitor] New price: $${priceData.price.toFixed(8)}`);
            this.broadcastPrice(tokenMint, priceData);
          }
        }
      },
      'confirmed'
    );

    // Store subscription
    this.subscriptions.set(tokenMint, {
      type: 'pumpfun',
      subscriptionId,
      bondingCurve,
      startTime: Date.now()
    });

    // Send initial price
    const initialPrice = await this.getPumpfunPrice(tokenMint);
    if (initialPrice) {
      console.log(`📤 [Monitor] Sending initial Pump.fun price: $${initialPrice.price.toFixed(8)}`);
      this.broadcastPrice(tokenMint, initialPrice);
    }

    // Start polling (backup)
    this.startPumpfunPolling(tokenMint);
  }

  /**
   * Subscribe to Raydium/DEX tokens using Solana RPC
   * Monitors account changes for token accounts
   */
  async subscribeRaydium(tokenMint) {
    console.log(`� [Monitor] Using Raydium/DEX monitoring via Solana RPC for ${tokenMint.substring(0, 8)}...`);
    
    try {
      // Get token account info to find pools
      const tokenPubkey = new PublicKey(tokenMint);
      
      // Subscribe to account changes for this token
      const subscriptionId = this.connection.onAccountChange(
        tokenPubkey,
        async (accountInfo) => {
          console.log(`🔄 [Monitor] Account change detected for ${tokenMint.substring(0, 8)}...`);
          
          // Fetch price from Jupiter (most reliable for all DEX tokens)
          const priceData = await this.getJupiterPrice(tokenMint);
          if (priceData) {
            console.log(`💰 [Monitor] Jupiter price: $${priceData.price}`);
            this.broadcastPrice(tokenMint, priceData);
          }
        },
        'confirmed'
      );

      console.log(`✅ [Monitor] Subscribed to account changes (ID: ${subscriptionId})`);

      // Store subscription
      this.subscriptions.set(tokenMint, {
        type: 'raydium',
        subscriptionId,
        startTime: Date.now()
      });

      // Get and send initial price from Jupiter
      const initialPrice = await this.getJupiterPrice(tokenMint);
      if (initialPrice) {
        console.log(`📤 [Monitor] Sending initial Jupiter price: $${initialPrice.price}`);
        this.broadcastPrice(tokenMint, initialPrice);
      } else {
        // If Jupiter fails, notify client
        this.broadcastError(tokenMint, 'Unable to fetch price for this token');
      }

      // Start polling Jupiter as backup (every 5 seconds for DEX tokens)
      this.startJupiterPolling(tokenMint);

    } catch (error) {
      console.error(`❌ [Monitor] Error subscribing to Raydium token:`, error.message);
      this.broadcastError(tokenMint, `Failed to monitor token: ${error.message}`);
    }
  }

  /**
   * Get price from Jupiter API
   * Jupiter aggregates prices from all Solana DEXes
   */
  async getJupiterPrice(tokenMint) {
    try {
      const response = await axios.get(
        `https://price.jup.ag/v4/price?ids=${tokenMint}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.data && response.data.data[tokenMint]) {
        const data = response.data.data[tokenMint];
        return {
          price: data.price,
          priceUsd: data.price,
          timestamp: Date.now(),
          source: 'jupiter',
          dex: 'jupiter-aggregated'
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ [Monitor] Jupiter API error:`, error.message);
      return null;
    }
  }

  /**
   * Start polling Jupiter for price updates
   */
  startJupiterPolling(tokenMint) {
    const intervalId = setInterval(async () => {
      if (!this.clients.has(tokenMint) || this.clients.get(tokenMint).size === 0) {
        console.log(`⏹️  [Monitor] No clients for ${tokenMint.substring(0, 8)}..., stopping Jupiter poll`);
        clearInterval(intervalId);
        return;
      }

      const priceData = await this.getJupiterPrice(tokenMint);
      if (priceData) {
        this.broadcastPrice(tokenMint, priceData);
      }
    }, 5000); // Poll every 5 seconds for DEX tokens

    // Store interval ID
    if (this.subscriptions.has(tokenMint)) {
      this.subscriptions.get(tokenMint).pollingInterval = intervalId;
    }
  }

  /**
   * Start polling for Pump.fun tokens (backup)
   */
  startPumpfunPolling(tokenMint) {
    const intervalId = setInterval(async () => {
      if (!this.clients.has(tokenMint) || this.clients.get(tokenMint).size === 0) {
        console.log(`⏹️  [Monitor] No clients for ${tokenMint.substring(0, 8)}..., stopping poll`);
        clearInterval(intervalId);
        return;
      }

      const priceData = await this.getPumpfunPrice(tokenMint);
      if (priceData) {
        this.broadcastPrice(tokenMint, priceData);
      }
    }, 3000);

    // Store interval ID
    if (this.subscriptions.has(tokenMint)) {
      this.subscriptions.get(tokenMint).pollingInterval = intervalId;
    }
  }

  /**
   * Broadcast price update to all subscribed clients
   */
  broadcastPrice(tokenMint, priceData) {
    const clients = this.clients.get(tokenMint);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'price_update',
      token: tokenMint,
      data: priceData
    });

    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      console.log(`📤 [Monitor] Broadcasted price to ${sentCount} client(s)`);
    }
  }

  /**
   * Broadcast error to all subscribed clients
   */
  broadcastError(tokenMint, errorMessage) {
    const clients = this.clients.get(tokenMint);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'error',
      token: tokenMint,
      error: errorMessage
    });

    clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });

    console.log(`⚠️  [Monitor] Broadcasted error to clients: ${errorMessage}`);
  }

  /**
   * Unsubscribe a client from a token
   */
  unsubscribe(tokenMint, client) {
    console.log(`🔌 [Monitor] Unsubscribing client from ${tokenMint.substring(0, 8)}...`);
    
    const clients = this.clients.get(tokenMint);
    if (clients) {
      clients.delete(client);
      console.log(`👥 [Monitor] Remaining clients: ${clients.size}`);

      // If no more clients, clean up subscription
      if (clients.size === 0) {
        console.log(`🧹 [Monitor] No more clients, cleaning up subscription for ${tokenMint.substring(0, 8)}...`);
        
        const sub = this.subscriptions.get(tokenMint);
        if (sub) {
          if (sub.type === 'pumpfun' || sub.type === 'raydium') {
            // Unsubscribe from Solana logs/account changes
            if (sub.subscriptionId) {
              if (sub.type === 'pumpfun') {
                this.connection.removeOnLogsListener(sub.subscriptionId);
              } else {
                this.connection.removeAccountChangeListener(sub.subscriptionId);
              }
            }
            // Clear polling interval
            if (sub.pollingInterval) {
              clearInterval(sub.pollingInterval);
            }
          }
        }

        this.subscriptions.delete(tokenMint);
        this.clients.delete(tokenMint);
        console.log(`✅ [Monitor] Cleanup complete for ${tokenMint.substring(0, 8)}...`);
      }
    }
  }

  /**
   * Get active subscriptions count
   */
  getStats() {
    return {
      activeTokens: this.subscriptions.size,
      totalClients: Array.from(this.clients.values()).reduce((sum, clients) => sum + clients.size, 0),
      subscriptions: Array.from(this.subscriptions.entries()).map(([token, sub]) => ({
        token: token.substring(0, 8) + '...',
        type: sub.type,
        clients: this.clients.get(token)?.size || 0,
        uptime: Math.floor((Date.now() - sub.startTime) / 1000) + 's'
      }))
    };
  }
}

module.exports = SolanaTokenMonitor;
