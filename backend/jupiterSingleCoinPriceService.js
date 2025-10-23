const fetch = require('node-fetch');

/**
 * Jupiter Single Coin Live Price Service
 * 
 * Fetches live prices for ONE coin at a time (the currently visible coin).
 * This prevents rate limiting and ensures we only fetch what the user is actively viewing.
 * 
 * Usage:
 * - Frontend sends: { type: "subscribe-jupiter", address: "..." }
 * - Backend starts fetching price for that address every 2 seconds
 * - Frontend sends: { type: "unsubscribe-jupiter", address: "..." }
 * - Backend stops fetching for that address
 */
class JupiterSingleCoinPriceService {
  constructor() {
    this.subscriptions = new Map(); // address -> { clients: Set, lastPrice, interval }
    this.updateFrequency = 2000; // 2 seconds for single coin (no rate limit issues)
  }

  /**
   * Subscribe a WebSocket client to live prices for a specific coin
   */
  subscribe(address, wsClient, symbol = 'COIN') {
    console.log(`🪐 [Jupiter Single] Client subscribed to ${symbol} (${address.substring(0, 8)}...)`);
    
    if (!this.subscriptions.has(address)) {
      // First subscriber for this coin - start fetching
      this.subscriptions.set(address, {
        symbol,
        clients: new Set([wsClient]),
        lastPrice: null,
        interval: null
      });
      
      // Start price updates
      this.startPriceUpdates(address);
    } else {
      // Add client to existing subscription
      const sub = this.subscriptions.get(address);
      sub.clients.add(wsClient);
      
      // Send last known price immediately if available
      if (sub.lastPrice) {
        this.broadcastPrice(address, sub.lastPrice);
      }
    }
  }

  /**
   * Unsubscribe a WebSocket client from a coin's live prices
   */
  unsubscribe(address, wsClient) {
    if (!this.subscriptions.has(address)) return;
    
    const sub = this.subscriptions.get(address);
    sub.clients.delete(wsClient);
    
    console.log(`🪐 [Jupiter Single] Client unsubscribed from ${sub.symbol}, ${sub.clients.size} clients remaining`);
    
    // If no more clients, stop fetching
    if (sub.clients.size === 0) {
      console.log(`🪐 [Jupiter Single] No more clients for ${sub.symbol}, stopping price updates`);
      if (sub.interval) {
        clearInterval(sub.interval);
      }
      this.subscriptions.delete(address);
    }
  }

  /**
   * Start fetching prices for a coin
   */
  startPriceUpdates(address) {
    const sub = this.subscriptions.get(address);
    if (!sub) return;
    
    console.log(`🪐 [Jupiter Single] Starting price updates for ${sub.symbol} every ${this.updateFrequency}ms`);
    
    // Fetch immediately
    this.fetchPrice(address);
    
    // Then fetch on interval
    sub.interval = setInterval(() => {
      this.fetchPrice(address);
    }, this.updateFrequency);
  }

  /**
   * Fetch price for a single coin from Jupiter API
   */
  async fetchPrice(address) {
    const sub = this.subscriptions.get(address);
    if (!sub) return;
    
    try {
      const url = `https://api.jup.ag/price/v2?ids=${address}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ [Jupiter Single] API error for ${sub.symbol}: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      
      if (data.data && data.data[address]) {
        const priceData = data.data[address];
        const newPrice = priceData.price;
        
        // Calculate price change
        const previousPrice = sub.lastPrice;
        const priceChange = previousPrice 
          ? ((newPrice - previousPrice) / previousPrice) * 100 
          : 0;
        
        const priceUpdate = {
          address,
          symbol: sub.symbol,
          price: newPrice,
          previousPrice,
          priceChangeInstant: priceChange,
          timestamp: Date.now()
        };
        
        // Update last price
        sub.lastPrice = newPrice;
        
        // Broadcast to all subscribed clients
        this.broadcastPrice(address, priceUpdate);
        
        console.log(`💰 [Jupiter Single] ${sub.symbol}: $${newPrice.toFixed(8)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)`);
      } else {
        console.warn(`⚠️ [Jupiter Single] No price data for ${sub.symbol}`);
      }
      
    } catch (error) {
      console.error(`❌ [Jupiter Single] Error fetching price for ${sub.symbol}:`, error.message);
    }
  }

  /**
   * Broadcast price update to all clients subscribed to this coin
   */
  broadcastPrice(address, priceUpdate) {
    const sub = this.subscriptions.get(address);
    if (!sub) return;
    
    const message = JSON.stringify({
      type: 'jupiter-single-price',
      data: priceUpdate
    });
    
    let successCount = 0;
    let failCount = 0;
    
    sub.clients.forEach(client => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
        console.error(`❌ [Jupiter Single] Error sending to client:`, error.message);
      }
    });
    
    if (successCount > 0) {
      console.log(`🚀 [Jupiter Single] Broadcasted ${sub.symbol} price to ${successCount} client(s)`);
    }
    if (failCount > 0) {
      console.warn(`⚠️ [Jupiter Single] Failed to send to ${failCount} client(s)`);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    const subscriptions = Array.from(this.subscriptions.entries()).map(([address, sub]) => ({
      address: address.substring(0, 8) + '...',
      symbol: sub.symbol,
      clients: sub.clients.size,
      lastPrice: sub.lastPrice
    }));
    
    return {
      activeSubscriptions: this.subscriptions.size,
      totalClients: Array.from(this.subscriptions.values()).reduce((sum, sub) => sum + sub.clients.size, 0),
      updateFrequency: this.updateFrequency,
      subscriptions
    };
  }

  /**
   * Cleanup when client disconnects
   */
  removeClient(wsClient) {
    let removed = 0;
    
    this.subscriptions.forEach((sub, address) => {
      if (sub.clients.has(wsClient)) {
        this.unsubscribe(address, wsClient);
        removed++;
      }
    });
    
    if (removed > 0) {
      console.log(`🧹 [Jupiter Single] Removed disconnected client from ${removed} subscription(s)`);
    }
  }

  /**
   * Stop all price updates and cleanup
   */
  stop() {
    console.log('🛑 [Jupiter Single] Stopping all price updates...');
    
    this.subscriptions.forEach((sub, address) => {
      if (sub.interval) {
        clearInterval(sub.interval);
      }
    });
    
    this.subscriptions.clear();
    console.log('✅ [Jupiter Single] All price updates stopped');
  }
}

module.exports = JupiterSingleCoinPriceService;
