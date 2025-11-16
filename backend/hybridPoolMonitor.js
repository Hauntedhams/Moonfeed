/**
 * Hybrid Pool Monitor
 * 
 * Tries to monitor tokens in this order:
 * 1. DEX pools (Raydium, Orca, etc.) via DexScreener
 * 2. Pump.fun bonding curves
 * 3. Jupiter Price API as final fallback
 */

const SolanaPoolMonitor = require('./solanaPoolWebSocket');
const PumpfunPoolMonitor = require('./pumpfunPoolMonitor');
const WebSocket = require('ws');

class HybridPoolMonitor {
  constructor(rpcEndpoint = 'https://api.mainnet-beta.solana.com') {
    this.dexMonitor = new SolanaPoolMonitor(rpcEndpoint);
    this.pumpfunMonitor = new PumpfunPoolMonitor(rpcEndpoint);
    this.tokenSources = new Map(); // tokenAddress -> 'dex' | 'pumpfun' | 'jupiter'
  }

  async connect() {
    await Promise.all([
      this.dexMonitor.connect(),
      this.pumpfunMonitor.connect()
    ]);
    console.log('[HybridMonitor] All monitors connected');
  }

  /**
   * Subscribe to token updates - tries DEX first, then Pump.fun
   */
  async subscribeToToken(tokenAddress, clientWs) {
    try {
      // Try DEX pools first
      try {
        await this.dexMonitor.subscribeToToken(tokenAddress, clientWs);
        this.tokenSources.set(tokenAddress, 'dex');
        console.log(`[HybridMonitor] ✅ Using DEX pool for ${tokenAddress.substring(0, 8)}...`);
        return;
      } catch (dexError) {
        console.log(`[HybridMonitor] ⚠️  No DEX pool found, trying Pump.fun...`);
      }

      // Try Pump.fun bonding curve
      try {
        await this.pumpfunMonitor.subscribeToToken(tokenAddress, clientWs);
        this.tokenSources.set(tokenAddress, 'pumpfun');
        console.log(`[HybridMonitor] ✅ Using Pump.fun bonding curve for ${tokenAddress.substring(0, 8)}...`);
        return;
      } catch (pumpfunError) {
        console.log(`[HybridMonitor] ⚠️  No Pump.fun bonding curve found, trying Jupiter...`);
      }

      // Fall back to Jupiter Price API polling
      await this.subscribeViaJupiter(tokenAddress, clientWs);
      this.tokenSources.set(tokenAddress, 'jupiter');
      console.log(`[HybridMonitor] ✅ Using Jupiter API for ${tokenAddress.substring(0, 8)}...`);

    } catch (error) {
      console.error(`[HybridMonitor] ❌ All methods failed for ${tokenAddress}:`, error.message);
      throw new Error(`Unable to monitor token ${tokenAddress}: No DEX pool, Pump.fun bonding curve, or Jupiter data found`);
    }
  }

  /**
   * Subscribe via Jupiter Price API (polling)
   */
  async subscribeViaJupiter(tokenAddress, clientWs) {
    const fetch = require('node-fetch');
    
    // Create a polling interval
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
        const data = await response.json();
        
        if (data.data && data.data[tokenAddress]) {
          const jupiterData = data.data[tokenAddress];
          
          const priceData = {
            price: jupiterData.price,
            timestamp: Date.now(),
            marketCap: 0,
            liquidity: 0,
            volume24h: 0,
            priceChange24h: 0,
            source: 'jupiter'
          };
          
          // Send to client
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'price_update',
              token: tokenAddress,
              data: priceData
            }), {
              compress: false,
              binary: false
            });
          }
        }
      } catch (error) {
        console.error(`[HybridMonitor] Jupiter polling error for ${tokenAddress}:`, error.message);
      }
    }, 5000); // Poll every 5 seconds

    // Store interval for cleanup
    if (!this.jupiterIntervals) {
      this.jupiterIntervals = new Map();
    }
    
    if (!this.jupiterIntervals.has(tokenAddress)) {
      this.jupiterIntervals.set(tokenAddress, []);
    }
    this.jupiterIntervals.get(tokenAddress).push({ client: clientWs, interval });
  }

  /**
   * Unsubscribe from token updates
   */
  async unsubscribeFromToken(tokenAddress, clientWs) {
    const source = this.tokenSources.get(tokenAddress);
    
    switch (source) {
      case 'dex':
        await this.dexMonitor.unsubscribeFromToken(tokenAddress, clientWs);
        break;
      case 'pumpfun':
        await this.pumpfunMonitor.unsubscribeFromToken(tokenAddress, clientWs);
        break;
      case 'jupiter':
        // Clear Jupiter polling interval
        if (this.jupiterIntervals && this.jupiterIntervals.has(tokenAddress)) {
          const intervals = this.jupiterIntervals.get(tokenAddress);
          const index = intervals.findIndex(item => item.client === clientWs);
          if (index !== -1) {
            clearInterval(intervals[index].interval);
            intervals.splice(index, 1);
          }
          if (intervals.length === 0) {
            this.jupiterIntervals.delete(tokenAddress);
          }
        }
        break;
    }
    
    this.tokenSources.delete(tokenAddress);
  }

  /**
   * Close all monitors
   */
  close() {
    this.dexMonitor.close();
    this.pumpfunMonitor.close();
    
    // Clear all Jupiter intervals
    if (this.jupiterIntervals) {
      for (const intervals of this.jupiterIntervals.values()) {
        intervals.forEach(item => clearInterval(item.interval));
      }
      this.jupiterIntervals.clear();
    }
    
    this.tokenSources.clear();
  }
}

module.exports = HybridPoolMonitor;
