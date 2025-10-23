const axios = require('axios');
const EventEmitter = require('events');

class JupiterLivePriceService extends EventEmitter {
  constructor() {
    super();
    this.priceCache = new Map();
    this.subscribers = new Set(); // WebSocket clients
    this.updateInterval = null;
    this.isRunning = false;
    this.batchSize = 100; // Jupiter allows 100 tokens per request
    this.updateFrequency = 10000; // Update every 10 seconds (was 1s - too aggressive, caused rate limiting)
    this.retryAttempts = 3;
    this.batchDelay = 1000; // 1 second delay between batches to avoid rate limits
    
    console.log('🪐 Jupiter Live Price Service initialized (10-second intervals)');
  }

  /**
   * Start the live price fetching service
   * @param {Array} coinList - Array of coins to track
   */
  start(coinList = []) {
    if (this.isRunning) {
      console.log('⚠️ Jupiter Live Price Service already running');
      return;
    }

    this.isRunning = true;
    this.coinList = coinList;
    
    console.log(`🚀 Starting Jupiter Live Price Service for ${coinList.length} coins`);
    
    // Initial fetch
    this.fetchAllPrices();
    
    // Set up interval for continuous updates
    this.updateInterval = setInterval(() => {
      this.fetchAllPrices();
    }, this.updateFrequency);
    
    console.log(`✅ Jupiter Live Price Service started (${this.updateFrequency}ms = ${this.updateFrequency/1000} second intervals)`);
  }

  /**
   * Stop the live price service
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    console.log('🛑 Jupiter Live Price Service stopped');
  }

  /**
   * Add a WebSocket client subscriber
   * @param {WebSocket} client - WebSocket client to add
   */
  addSubscriber(client) {
    this.subscribers.add(client);
    console.log(`📡 Added subscriber (${this.subscribers.size} total)`);
    
    // Send current price data to new subscriber
    const currentPrices = this.getAllPrices();
    if (currentPrices.length > 0) {
      this.sendToClient(client, {
        type: 'jupiter-prices-initial',
        data: currentPrices,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Remove a WebSocket client subscriber
   * @param {WebSocket} client - WebSocket client to remove
   */
  removeSubscriber(client) {
    this.subscribers.delete(client);
    console.log(`📡 Removed subscriber (${this.subscribers.size} total)`);
  }

  /**
   * Update the coin list to track
   * @param {Array} newCoinList - New list of coins to track
   */
  updateCoinList(newCoinList) {
    this.coinList = newCoinList;
    console.log(`🔄 Updated coin list: ${newCoinList.length} coins`);
    
    // Immediately fetch prices for new list
    if (this.isRunning) {
      this.fetchAllPrices();
    }
  }

  /**
   * Fetch prices for all tracked coins
   */
  async fetchAllPrices() {
    this.lastFetchAttempt = Date.now();
    
    if (!this.coinList || this.coinList.length === 0) {
      console.log('⚠️ [Jupiter] No coins to fetch prices for');
      return;
    }

    try {
      console.log(`� [Jupiter Live] STARTING price fetch for ${this.coinList.length} coins (${this.subscribers.size} subscribers waiting)`);
      
      // Split coins into batches
      const batches = this.chunkArray(this.coinList, this.batchSize);
      const allUpdates = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📦 [Jupiter] Processing batch ${i + 1}/${batches.length} (${batch.length} coins)`);
        
        const updates = await this.fetchBatchPrices(batch);
        console.log(`📦 [Jupiter] Batch ${i + 1} returned ${updates.length} price updates`);
        allUpdates.push(...updates);
        
        // Delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(this.batchDelay);
        }
      }
      
      if (allUpdates.length > 0) {
        console.log(`🔥 [Jupiter Live] Broadcasting prices for ${allUpdates.length} coins to ${this.subscribers.size} subscribers`);
        this.lastUpdate = Date.now();
        this.lastSuccessfulFetch = Date.now();
        
        // Emit update event
        this.emit('prices-updated', allUpdates);
        
        // DEBUG: Log first price update for verification
        console.log(`� [Jupiter Live] Sample: ${allUpdates[0].symbol} = $${allUpdates[0].price}`);
        
        // Broadcast to all subscribers
        const broadcastMessage = {
          type: 'jupiter-prices-update',
          data: allUpdates,
          timestamp: Date.now(),
          source: 'jupiter-live'
        };
        this.broadcastToSubscribers(broadcastMessage);
        console.log(`✅ [Jupiter Live] Broadcast complete`);
      } else {
        console.error('❌ [Jupiter Live] NO PRICE UPDATES - All batches returned empty! API may be down or rate limiting.');
      }
      
    } catch (error) {
      console.error('❌ [Jupiter Live] Fatal error fetching prices:', error.message);
      console.error('❌ [Jupiter Live] Stack:', error.stack);
    }
  }

  /**
   * Fetch prices for a batch of coins
   * @param {Array} batch - Array of coins in this batch
   * @returns {Array} Array of price updates
   */
  async fetchBatchPrices(batch) {
    const updates = [];
    
    try {
      // Extract mint addresses from the batch
      const addresses = batch
        .map(coin => coin.mintAddress || coin.address || coin.tokenAddress)
        .filter(Boolean);
      
      if (addresses.length === 0) {
        console.log('⚠️ No valid addresses in batch');
        return updates;
      }
      
      console.log(`🔍 Fetching prices for addresses: ${addresses.slice(0, 3).join(', ')}${addresses.length > 3 ? '...' : ''}`);
      
      // Make request to Jupiter Price API V3
      const response = await axios.get(
        `https://lite-api.jup.ag/price/v3?ids=${addresses.join(',')}`,
        { 
          timeout: 8000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MoonFeed/1.0'
          }
        }
      );
      
      console.log(`📡 Jupiter V3 API response status: ${response.status}`);
      
      if (!response.data) {
        console.log('⚠️ No price data in response:', response.data);
        return updates;
      }
      
      const priceDataKeys = Object.keys(response.data);
      console.log(`💰 Received price data for ${priceDataKeys.length} tokens`);
      
      // Process each price update - V3 format is different
      Object.entries(response.data).forEach(([address, priceData]) => {
        const coin = batch.find(c => 
          (c.mintAddress || c.address || c.tokenAddress) === address
        );
        
        if (!coin) {
          console.log(`⚠️ No matching coin found for address: ${address}`);
          return;
        }
        
        const previousPrice = this.priceCache.get(address);
        const currentPrice = parseFloat(priceData.usdPrice); // V3 uses usdPrice
        
        if (currentPrice > 0) {
          // Calculate price change
          let priceChangePercent = 0;
          if (previousPrice && previousPrice.price) {
            priceChangePercent = ((currentPrice - previousPrice.price) / previousPrice.price) * 100;
          }
          
          // Update cache
          const priceUpdate = {
            address,
            symbol: coin.symbol,
            name: coin.name,
            price: currentPrice,
            previousPrice: previousPrice?.price || currentPrice,
            priceChangeInstant: priceChangePercent,
            timestamp: Date.now(),
            source: 'jupiter-live'
          };
          
          this.priceCache.set(address, priceUpdate);
          updates.push(priceUpdate);
          
          // Log all price updates for debugging
          console.log(`� ${coin.symbol}: $${currentPrice.toFixed(8)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
        } else {
          console.log(`⚠️ Invalid price for ${coin.symbol}: ${currentPrice}`);
        }
      });
      
    } catch (error) {
      console.error('❌ Batch price fetch error:', error.message);
      console.error('❌ Error details:', {
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Handle rate limiting and network errors with exponential backoff
      if (error.response?.status === 429) {
        console.log('🚫 Rate limited by Jupiter API - implementing exponential backoff');
        const backoffDelay = Math.min(1000 * Math.pow(2, 1), 30000); // Start with 2 seconds, max 30 seconds
        console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
        await this.delay(backoffDelay);
        
        // Single retry for rate limit with longer delay
        try {
          console.log('🔄 Retrying after rate limit backoff...');
          const retryResponse = await axios.get(
            `https://lite-api.jup.ag/price/v3?ids=${addresses.join(',')}`,
            { 
              timeout: 15000,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'MoonFeed/1.0'
              }
            }
          );
          
          if (retryResponse.data) {
            console.log('✅ Rate limit retry successful');
            // Process the successful retry response - V3 format
            Object.entries(retryResponse.data).forEach(([address, priceData]) => {
              const coin = batch.find(c => 
                (c.mintAddress || c.address || c.tokenAddress) === address
              );
              
              if (coin && parseFloat(priceData.usdPrice) > 0) {
                const previousPrice = this.priceCache.get(address);
                const currentPrice = parseFloat(priceData.usdPrice);
                let priceChangePercent = 0;
                if (previousPrice && previousPrice.price) {
                  priceChangePercent = ((currentPrice - previousPrice.price) / previousPrice.price) * 100;
                }
                
                const priceUpdate = {
                  address,
                  symbol: coin.symbol,
                  name: coin.name,
                  price: currentPrice,
                  previousPrice: previousPrice?.price || currentPrice,
                  priceChangeInstant: priceChangePercent,
                  timestamp: Date.now(),
                  source: 'jupiter-live'
                };
                
                this.priceCache.set(address, priceUpdate);
                updates.push(priceUpdate);
                console.log(`💰 ${coin.symbol}: $${currentPrice.toFixed(8)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
              }
            });
          }
        } catch (retryError) {
          console.error('❌ Rate limit retry failed:', retryError.message);
        }
      } else if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
        console.log('🔄 Retrying batch after network error...');
        await this.delay(1000);
        
        // Implement actual retry logic
        for (let retryCount = 0; retryCount < this.retryAttempts; retryCount++) {
          try {
            console.log(`🔄 Retry attempt ${retryCount + 1}/${this.retryAttempts}`);
            const retryResponse = await axios.get(
              `https://lite-api.jup.ag/price/v3?ids=${addresses.join(',')}`,
              { 
                timeout: 10000,
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'MoonFeed/1.0'
                }
              }
            );
            
            if (retryResponse.data) {
              console.log(`✅ Retry successful on attempt ${retryCount + 1}`);
              // Process the successful retry response - V3 format
              Object.entries(retryResponse.data).forEach(([address, priceData]) => {
                const coin = batch.find(c => 
                  (c.mintAddress || c.address || c.tokenAddress) === address
                );
                
                if (coin && parseFloat(priceData.usdPrice) > 0) {
                  const previousPrice = this.priceCache.get(address);
                  const currentPrice = parseFloat(priceData.usdPrice);
                  let priceChangePercent = 0;
                  if (previousPrice && previousPrice.price) {
                    priceChangePercent = ((currentPrice - previousPrice.price) / previousPrice.price) * 100;
                  }
                  
                  const priceUpdate = {
                    address,
                    symbol: coin.symbol,
                    name: coin.name,
                    price: currentPrice,
                    previousPrice: previousPrice?.price || currentPrice,
                    priceChangeInstant: priceChangePercent,
                    timestamp: Date.now(),
                    source: 'jupiter-live'
                  };
                  
                  this.priceCache.set(address, priceUpdate);
                  updates.push(priceUpdate);
                  console.log(`💲 ${coin.symbol}: $${currentPrice.toFixed(8)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
                }
              });
              break; // Exit retry loop on success
            }
          } catch (retryError) {
            console.error(`❌ Retry ${retryCount + 1} failed:`, retryError.message);
            if (retryCount < this.retryAttempts - 1) {
              await this.delay(2000 * (retryCount + 1)); // Exponential backoff
            }
          }
        }
      }
    }
    
    return updates;
  }

  /**
   * Get current price for a specific coin
   * @param {string} address - Mint address of the coin
   * @returns {Object|null} Current price data or null
   */
  getPrice(address) {
    return this.priceCache.get(address) || null;
  }

  /**
   * Get all current prices
   * @returns {Array} Array of all current price data
   */
  getAllPrices() {
    return Array.from(this.priceCache.values());
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      subscriberCount: this.subscribers.size,
      trackedCoins: this.coinList?.length || 0,
      cachedPrices: this.priceCache.size,
      updateFrequency: this.updateFrequency,
      lastUpdate: this.lastUpdate || null,
      lastFetchAttempt: this.lastFetchAttempt || null,
      lastSuccessfulFetch: this.lastSuccessfulFetch || null
    };
  }

  /**
   * Clear the price cache
   */
  clearCache() {
    this.priceCache.clear();
    console.log('🗑️ Price cache cleared');
  }

  /**
   * Send message to a specific client
   * @param {WebSocket} client - WebSocket client
   * @param {Object} message - Message to send
   */
  sendToClient(client, message) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Error sending to client:', error.message);
        this.removeSubscriber(client);
      }
    }
  }

  /**
   * Broadcast message to all subscribers
   * @param {Object} message - Message to broadcast
   */
  broadcastToSubscribers(message) {
    if (this.subscribers.size === 0) {
      console.log('⚠️ [Jupiter] No subscribers to broadcast to');
      return;
    }
    
    const messageStr = JSON.stringify(message);
    let successCount = 0;
    let closedCount = 0;
    
    this.subscribers.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(messageStr);
          successCount++;
        } catch (error) {
          console.error('❌ [Jupiter] Error broadcasting to client:', error.message);
          this.removeSubscriber(client);
        }
      } else {
        closedCount++;
        this.removeSubscriber(client);
      }
    });
    
    if (successCount > 0) {
      console.log(`📡 [Jupiter] Broadcasted to ${successCount}/${this.subscribers.size + closedCount} clients (${closedCount} closed)`);
    } else {
      console.log(`⚠️ [Jupiter] Broadcast failed - ${closedCount} closed connections`);
    }
  }

  /**
   * Utility function to chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility function to create a delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = JupiterLivePriceService;
