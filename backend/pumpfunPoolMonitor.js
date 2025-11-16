/**
 * Pump.fun Bonding Curve Monitor
 * 
 * Monitors Pump.fun bonding curve accounts via Solana RPC for real-time price updates.
 * Works for tokens that haven't migrated to Raydium yet.
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

// Pump.fun Program ID
const PUMPFUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

class PumpfunPoolMonitor {
  constructor(rpcEndpoint = 'https://api.mainnet-beta.solana.com') {
    this.rpcEndpoint = rpcEndpoint;
    this.wsEndpoint = rpcEndpoint.replace('https://', 'wss://').replace('http://', 'ws://');
    this.ws = null;
    this.subscriptions = new Map(); // tokenAddress -> { subscriptionId, bondingCurveAddress, clients: [ws], pollingInterval }
    this.reconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 5;
    
    // Cache for bonding curve addresses
    this.bondingCurveCache = new Map(); // tokenAddress -> bondingCurveAddress
    
    // Rate limiting for price fetching
    this.priceCache = new Map(); // tokenAddress -> { data, timestamp }
    this.PRICE_CACHE_TTL = 2000; // 2 seconds between price updates
    
    // Polling for all tokens (Pump.fun doesn't change often)
    this.POLLING_INTERVAL = 3000; // Poll every 3 seconds
  }

  /**
   * Get bonding curve address for a Pump.fun token
   */
  async getBondingCurveAddress(tokenAddress) {
    try {
      // Check cache
      if (this.bondingCurveCache.has(tokenAddress)) {
        return this.bondingCurveCache.get(tokenAddress);
      }

      console.log(`[PumpfunMonitor] Looking up bonding curve for token ${tokenAddress.substring(0, 8)}...`);

      // Method 1: Try to derive the PDA (Program Derived Address)
      // Pump.fun uses: findProgramAddress(['bonding-curve', tokenMint], PUMPFUN_PROGRAM_ID)
      const { PublicKey } = require('@solana/web3.js');
      
      const tokenMint = new PublicKey(tokenAddress);
      const [bondingCurvePDA] = await PublicKey.findProgramAddress(
        [Buffer.from('bonding-curve'), tokenMint.toBuffer()],
        new PublicKey(PUMPFUN_PROGRAM_ID)
      );

      const bondingCurveAddress = bondingCurvePDA.toBase58();
      console.log(`[PumpfunMonitor] Found bonding curve: ${bondingCurveAddress.substring(0, 8)}...`);

      // Cache it
      this.bondingCurveCache.set(tokenAddress, bondingCurveAddress);
      
      return bondingCurveAddress;

    } catch (error) {
      console.error('[PumpfunMonitor] Error getting bonding curve address:', error.message);
      throw new Error(`No Pump.fun bonding curve found for token ${tokenAddress}`);
    }
  }

  /**
   * Fetch current price from Pump.fun API or calculate from bonding curve
   */
  async fetchPumpfunPrice(tokenAddress, bondingCurveAddress) {
    try {
      // Check cache
      const cached = this.priceCache.get(tokenAddress);
      if (cached && (Date.now() - cached.timestamp) < this.PRICE_CACHE_TTL) {
        return cached.data;
      }
      
      console.log(`[PumpfunMonitor] Fetching price for ${tokenAddress.substring(0, 8)}...`);
      
      // Method 1: Try Pump.fun API (if available)
      try {
        const response = await fetch(`https://frontend-api.pump.fun/coins/${tokenAddress}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.usd_market_cap) {
            const priceData = {
              price: parseFloat(data.price || 0),
              timestamp: Date.now(),
              marketCap: parseFloat(data.usd_market_cap || 0),
              liquidity: parseFloat(data.virtual_sol_reserves || 0) * 200, // Rough estimate
              volume24h: 0, // Pump.fun doesn't provide this
              priceChange24h: 0,
              source: 'pump.fun',
              bondingCurve: bondingCurveAddress
            };
            
            console.log(`[PumpfunMonitor] Price from Pump.fun API: $${priceData.price.toFixed(8)}`);
            
            // Cache it
            this.priceCache.set(tokenAddress, {
              data: priceData,
              timestamp: Date.now()
            });
            
            return priceData;
          }
        }
      } catch (apiError) {
        console.log(`[PumpfunMonitor] Pump.fun API failed, trying RPC...`);
      }

      // Method 2: Fetch bonding curve account data via RPC and calculate price
      const response = await fetch(this.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [
            bondingCurveAddress,
            { encoding: 'base64' }
          ]
        })
      });

      const result = await response.json();
      
      if (result.result && result.result.value) {
        const accountData = Buffer.from(result.result.value.data[0], 'base64');
        
        // Parse Pump.fun bonding curve data structure
        // This is a simplified version - actual structure may vary
        const virtualSolReserves = accountData.readBigUInt64LE(8) / BigInt(1e9); // Adjust offset
        const virtualTokenReserves = accountData.readBigUInt64LE(16) / BigInt(1e9); // Adjust offset
        
        // Calculate price: SOL reserves / Token reserves * SOL price
        const SOL_PRICE = 240; // Approximate, should fetch from API
        const price = (Number(virtualSolReserves) / Number(virtualTokenReserves)) * SOL_PRICE;
        
        const priceData = {
          price: price,
          timestamp: Date.now(),
          marketCap: 0, // Would need total supply
          liquidity: Number(virtualSolReserves) * SOL_PRICE,
          volume24h: 0,
          priceChange24h: 0,
          source: 'pump.fun-rpc',
          bondingCurve: bondingCurveAddress
        };
        
        console.log(`[PumpfunMonitor] Price from RPC calculation: $${price.toFixed(8)}`);
        
        // Cache it
        this.priceCache.set(tokenAddress, {
          data: priceData,
          timestamp: Date.now()
        });
        
        return priceData;
      }
      
      return null;
      
    } catch (error) {
      console.error('[PumpfunMonitor] Error fetching Pump.fun price:', error.message);
      return null;
    }
  }

  /**
   * Connect to Solana RPC WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[PumpfunMonitor] Connecting to ${this.wsEndpoint}...`);
        
        this.ws = new WebSocket(this.wsEndpoint);

        this.ws.on('open', () => {
          console.log('[PumpfunMonitor] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', async (data) => {
          await this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          console.error('[PumpfunMonitor] WebSocket error:', error.message);
        });

        this.ws.on('close', () => {
          console.log('[PumpfunMonitor] WebSocket closed');
          this.handleDisconnect();
        });

      } catch (error) {
        console.error('[PumpfunMonitor] Connection error:', error);
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
      if (message.result && typeof message.result === 'number' && message.id) {
        const subscriptionId = message.result;
        console.log(`[PumpfunMonitor] Subscription confirmed: ${subscriptionId}`);
        
        // Map subscription ID to token
        for (const [tokenAddress, sub] of this.subscriptions.entries()) {
          if (sub.bondingCurveAddress && !sub.subscriptionId) {
            sub.subscriptionId = subscriptionId;
            console.log(`[PumpfunMonitor] Mapped subscription ${subscriptionId} to token ${tokenAddress}`);
            break;
          }
        }
        return;
      }

      // Handle account notifications (bonding curve updates)
      if (message.method === 'accountNotification') {
        const { subscription } = message.params;
        
        // Find which token this subscription belongs to
        for (const [tokenAddress, sub] of this.subscriptions.entries()) {
          if (sub.subscriptionId === subscription) {
            console.log(`[PumpfunMonitor] 🔥 Bonding curve activity for ${tokenAddress.substring(0, 8)}...`);
            
            // Fetch fresh price
            const priceData = await this.fetchPumpfunPrice(tokenAddress, sub.bondingCurveAddress);
            
            if (priceData) {
              // Broadcast to all clients
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
      console.error('[PumpfunMonitor] Error handling message:', error);
    }
  }

  /**
   * Subscribe to bonding curve updates for a token
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
        console.log(`[PumpfunMonitor] Added client to existing subscription for ${tokenAddress}`);
        return;
      }

      // Get bonding curve address
      const bondingCurveAddress = await this.getBondingCurveAddress(tokenAddress);
      console.log(`[PumpfunMonitor] Bonding curve for ${tokenAddress}: ${bondingCurveAddress}`);

      // Send accountSubscribe request
      const subscribeRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'accountSubscribe',
        params: [
          bondingCurveAddress,
          {
            encoding: 'base64',
            commitment: 'confirmed'
          }
        ]
      };

      this.ws.send(JSON.stringify(subscribeRequest));

      // Store subscription
      const subscription = {
        subscriptionId: null,
        bondingCurveAddress,
        clients: [clientWs],
        pollingInterval: null
      };
      this.subscriptions.set(tokenAddress, subscription);

      // Start polling (Pump.fun bonding curves don't update often via RPC)
      this.startPolling(tokenAddress, subscription);

      console.log(`[PumpfunMonitor] Subscribed to bonding curve ${bondingCurveAddress} for token ${tokenAddress}`);
    } catch (error) {
      console.error(`[PumpfunMonitor] Error subscribing to token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Start polling for price updates
   */
  startPolling(tokenAddress, subscription) {
    // Clear any existing interval
    if (subscription.pollingInterval) {
      clearInterval(subscription.pollingInterval);
    }

    console.log(`[PumpfunMonitor] Starting price polling for ${tokenAddress.substring(0, 8)}...`);

    subscription.pollingInterval = setInterval(async () => {
      try {
        const priceData = await this.fetchPumpfunPrice(tokenAddress, subscription.bondingCurveAddress);
        
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
        console.error(`[PumpfunMonitor] Polling error for ${tokenAddress}:`, error.message);
      }
    }, this.POLLING_INTERVAL);
  }

  /**
   * Unsubscribe from token updates
   */
  async unsubscribeFromToken(tokenAddress, clientWs) {
    const sub = this.subscriptions.get(tokenAddress);
    if (!sub) return;

    // Remove client
    sub.clients = sub.clients.filter(c => c !== clientWs);

    // If no more clients, stop polling and unsubscribe
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
        console.log(`[PumpfunMonitor] Unsubscribed from RPC for ${tokenAddress}`);
      }

      this.subscriptions.delete(tokenAddress);
      console.log(`[PumpfunMonitor] Fully unsubscribed from ${tokenAddress}`);
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(`[PumpfunMonitor] Reconnecting... (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
      
      setTimeout(() => {
        this.connect().then(() => {
          // Resubscribe to all tokens
          for (const [tokenAddress, sub] of this.subscriptions.entries()) {
            this.subscribeToToken(tokenAddress, sub.clients[0]);
          }
        }).catch(console.error);
      }, 3000 * this.reconnectAttempts);
    } else {
      console.error('[PumpfunMonitor] Max reconnection attempts reached');
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

module.exports = PumpfunPoolMonitor;
