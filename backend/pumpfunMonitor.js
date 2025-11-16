const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

/**
 * Monitors Pump.fun tokens using Solana native RPC
 * Detects real-time swaps and updates prices instantly
 */
class PumpfunMonitor {
  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    this.subscriptions = new Map(); // tokenMint -> subscription data
    this.clients = new Map(); // tokenMint -> Set of WebSocket clients
    
    // Pump.fun program IDs
    this.PUMPFUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
    this.PUMPFUN_GLOBAL_ACCOUNT = '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
    
    console.log('🚀 [PumpfunMonitor] Initialized');
  }

  /**
   * Check if a token is on Pump.fun
   */
  async isPumpfunToken(tokenMint) {
    try {
      console.log(`🔍 [PumpfunMonitor] Checking if ${tokenMint.substring(0, 8)}... is on Pump.fun...`);
      
      // Check Pump.fun API
      const response = await axios.get(`https://frontend-api.pump.fun/coins/${tokenMint}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.mint) {
        console.log(`✅ [PumpfunMonitor] ${tokenMint.substring(0, 8)}... is a Pump.fun token!`);
        console.log(`   Bonding curve: ${response.data.bonding_curve || 'N/A'}`);
        return {
          isPumpfun: true,
          bondingCurve: response.data.bonding_curve,
          data: response.data
        };
      }
      
      return { isPumpfun: false };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`ℹ️  [PumpfunMonitor] ${tokenMint.substring(0, 8)}... not found on Pump.fun`);
      } else {
        console.log(`⚠️  [PumpfunMonitor] Error checking Pump.fun:`, error.message);
      }
      return { isPumpfun: false };
    }
  }

  /**
   * Get current price from Pump.fun API
   */
  async getCurrentPrice(tokenMint) {
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
          liquidity: (data.virtual_sol_reserves || 0) * 150, // Approx SOL price
          timestamp: Date.now(),
          source: 'pumpfun',
          dex: 'pump.fun'
        };
      }
    } catch (error) {
      console.error(`❌ [PumpfunMonitor] Error fetching price:`, error.message);
      return null;
    }
  }

  /**
   * Subscribe to a Pump.fun token
   */
  async subscribe(tokenMint, client) {
    console.log(`📡 [PumpfunMonitor] Subscribing to ${tokenMint.substring(0, 8)}...`);
    
    // Check if it's a Pump.fun token
    const pumpfunCheck = await this.isPumpfunToken(tokenMint);
    if (!pumpfunCheck.isPumpfun) {
      throw new Error('Not a Pump.fun token');
    }

    // Add client to subscribers
    if (!this.clients.has(tokenMint)) {
      this.clients.set(tokenMint, new Set());
    }
    this.clients.get(tokenMint).add(client);
    console.log(`👥 [PumpfunMonitor] Client added. Total clients for ${tokenMint.substring(0, 8)}...: ${this.clients.get(tokenMint).size}`);

    // If already subscribed, just add the client and send current data
    if (this.subscriptions.has(tokenMint)) {
      console.log(`✅ [PumpfunMonitor] Already subscribed to ${tokenMint.substring(0, 8)}..., reusing subscription`);
      
      // Send current price immediately
      const currentPrice = await this.getCurrentPrice(tokenMint);
      if (currentPrice) {
        this.broadcastPrice(tokenMint, currentPrice);
      }
      return;
    }

    // Get bonding curve address
    const bondingCurve = pumpfunCheck.bondingCurve;
    if (!bondingCurve) {
      throw new Error('No bonding curve found for token');
    }

    console.log(`📊 [PumpfunMonitor] Setting up monitoring for bonding curve: ${bondingCurve.substring(0, 8)}...`);

    // Subscribe to Pump.fun program logs (catches all swaps)
    const subscriptionId = this.connection.onLogs(
      new PublicKey(this.PUMPFUN_PROGRAM),
      async (logs) => {
        // Check if this transaction involves our token's bonding curve
        const signature = logs.signature;
        const logsText = logs.logs.join('\n');
        
        if (logsText.includes(bondingCurve)) {
          console.log(`🔥 [PumpfunMonitor] SWAP DETECTED for ${tokenMint.substring(0, 8)}...! Signature: ${signature.substring(0, 8)}...`);
          
          // Fetch updated price
          const priceData = await this.getCurrentPrice(tokenMint);
          if (priceData) {
            console.log(`💰 [PumpfunMonitor] New price: $${priceData.price.toFixed(8)}`);
            this.broadcastPrice(tokenMint, priceData);
          }
        }
      },
      'confirmed'
    );

    console.log(`✅ [PumpfunMonitor] Subscribed to logs (ID: ${subscriptionId})`);

    // Store subscription info
    this.subscriptions.set(tokenMint, {
      subscriptionId,
      bondingCurve,
      startTime: Date.now()
    });

    // Send initial price
    const initialPrice = await this.getCurrentPrice(tokenMint);
    if (initialPrice) {
      console.log(`📤 [PumpfunMonitor] Sending initial price: $${initialPrice.price.toFixed(8)}`);
      this.broadcastPrice(tokenMint, initialPrice);
    }

    // Start polling for price updates (every 3 seconds as backup)
    this.startPolling(tokenMint);

    console.log(`✅ [PumpfunMonitor] Successfully subscribed to ${tokenMint.substring(0, 8)}...`);
  }

  /**
   * Start polling for a token (backup to catch updates if logs miss something)
   */
  startPolling(tokenMint) {
    const intervalId = setInterval(async () => {
      if (!this.clients.has(tokenMint) || this.clients.get(tokenMint).size === 0) {
        console.log(`⏹️  [PumpfunMonitor] No clients for ${tokenMint.substring(0, 8)}..., stopping poll`);
        clearInterval(intervalId);
        return;
      }

      const priceData = await this.getCurrentPrice(tokenMint);
      if (priceData) {
        this.broadcastPrice(tokenMint, priceData);
      }
    }, 3000);

    // Store interval ID for cleanup
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
        client.send(message, { compress: false });
        sentCount++;
      }
    });

    console.log(`📤 [PumpfunMonitor] Broadcast price $${priceData.price.toFixed(8)} to ${sentCount} clients`);
  }

  /**
   * Unsubscribe a client from a token
   */
  async unsubscribe(tokenMint, client) {
    console.log(`📡 [PumpfunMonitor] Unsubscribing client from ${tokenMint.substring(0, 8)}...`);

    const clients = this.clients.get(tokenMint);
    if (clients) {
      clients.delete(client);
      console.log(`👥 [PumpfunMonitor] Client removed. Remaining clients: ${clients.size}`);

      // If no more clients, stop monitoring
      if (clients.size === 0) {
        const sub = this.subscriptions.get(tokenMint);
        if (sub) {
          // Remove Solana RPC subscription
          if (sub.subscriptionId) {
            await this.connection.removeOnLogsListener(sub.subscriptionId);
            console.log(`🔌 [PumpfunMonitor] Removed logs subscription for ${tokenMint.substring(0, 8)}...`);
          }

          // Stop polling
          if (sub.pollingInterval) {
            clearInterval(sub.pollingInterval);
            console.log(`⏹️  [PumpfunMonitor] Stopped polling for ${tokenMint.substring(0, 8)}...`);
          }

          this.subscriptions.delete(tokenMint);
        }
        this.clients.delete(tokenMint);
        console.log(`✅ [PumpfunMonitor] Fully unsubscribed from ${tokenMint.substring(0, 8)}...`);
      }
    }
  }

  /**
   * Get subscription info for debugging
   */
  getSubscriptionInfo(tokenMint) {
    return {
      isSubscribed: this.subscriptions.has(tokenMint),
      clientCount: this.clients.get(tokenMint)?.size || 0,
      subscriptionData: this.subscriptions.get(tokenMint)
    };
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup() {
    console.log('🧹 [PumpfunMonitor] Cleaning up all subscriptions...');
    
    for (const [tokenMint, sub] of this.subscriptions) {
      if (sub.subscriptionId) {
        await this.connection.removeOnLogsListener(sub.subscriptionId);
      }
      if (sub.pollingInterval) {
        clearInterval(sub.pollingInterval);
      }
    }
    
    this.subscriptions.clear();
    this.clients.clear();
    console.log('✅ [PumpfunMonitor] Cleanup complete');
  }
}

module.exports = PumpfunMonitor;
