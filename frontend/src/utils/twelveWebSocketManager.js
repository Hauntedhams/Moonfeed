/**
 * Twelve Data WebSocket Connection Manager
 * 
 * CRITICAL: Free plan only allows 1 WebSocket connection
 * This manager ensures only one component can connect at a time
 */

class TwelveWebSocketManager {
  constructor() {
    this.activeConnection = null;
    this.activeSymbol = null;
    this.subscribers = new Set();
  }

  /**
   * Request a WebSocket connection for a symbol
   * Only one connection can be active at a time
   * 
   * @param {string} symbol - The symbol to subscribe to (e.g., "SOL/USD")
   * @param {Function} onMessage - Callback for price updates
   * @param {Function} onError - Callback for errors
   * @returns {Function} Cleanup function to disconnect
   */
  connect(symbol, onMessage, onError) {
    // If there's already an active connection for a different symbol, close it
    if (this.activeConnection && this.activeSymbol !== symbol) {
      console.log(`⚠️ Closing existing connection to ${this.activeSymbol} to connect to ${symbol}`);
      this.disconnect();
    }

    // If already connected to the same symbol, just add subscriber
    if (this.activeConnection && this.activeSymbol === symbol) {
      this.subscribers.add({ onMessage, onError });
      console.log(`✅ Reusing existing connection to ${symbol}`);
      return () => this._removeSubscriber({ onMessage, onError });
    }

    // Create new connection
    console.log(`🔌 Creating new Twelve Data WebSocket connection for ${symbol}`);
    this.activeSymbol = symbol;
    this.subscribers.add({ onMessage, onError });
    
    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=5bbbe353245a4b0795eed57ad93e72cc`);
    this.activeConnection = ws;

    ws.onopen = () => {
      console.log(`✅ Connected to Twelve Data for ${symbol}`);
      ws.send(JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: symbol
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Broadcast to all subscribers
        this.subscribers.forEach(subscriber => {
          if (subscriber.onMessage) {
            subscriber.onMessage(data);
          }
        });
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
        this.subscribers.forEach(subscriber => {
          if (subscriber.onError) {
            subscriber.onError(err);
          }
        });
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Twelve Data WebSocket error:', error);
      this.subscribers.forEach(subscriber => {
        if (subscriber.onError) {
          subscriber.onError(error);
        }
      });
    };

    ws.onclose = () => {
      console.log('🔌 Twelve Data WebSocket closed');
      if (this.activeConnection === ws) {
        this.activeConnection = null;
        this.activeSymbol = null;
        this.subscribers.clear();
      }
    };

    // Return cleanup function
    return () => this._removeSubscriber({ onMessage, onError });
  }

  /**
   * Remove a subscriber and close connection if no subscribers left
   */
  _removeSubscriber(subscriber) {
    this.subscribers.delete(subscriber);
    
    // If no more subscribers, close the connection
    if (this.subscribers.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Force disconnect the active connection
   */
  disconnect() {
    if (this.activeConnection) {
      console.log(`🔌 Closing Twelve Data WebSocket connection to ${this.activeSymbol}`);
      this.activeConnection.close();
      this.activeConnection = null;
      this.activeSymbol = null;
      this.subscribers.clear();
    }
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      connected: !!this.activeConnection,
      symbol: this.activeSymbol,
      subscriberCount: this.subscribers.size
    };
  }
}

// Export singleton instance
export const twelveWSManager = new TwelveWebSocketManager();

// Debug helper - expose to window in development
if (process.env.NODE_ENV === 'development') {
  window.__TWELVE_WS_MANAGER__ = twelveWSManager;
}
