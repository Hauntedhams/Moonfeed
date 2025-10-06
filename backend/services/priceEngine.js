const EventEmitter = require('events');
const axios = require('axios');

class PriceEngine extends EventEmitter {
  constructor() {
    super();
    this.prices = new Map();
    this.enrichedData = new Map();
    this.chartData = new Map();
    this.priceHistory = new Map();
    this.updateIntervals = {
      prices: 2000,      // Live prices every 2 seconds
      charts: 10000,     // Chart data every 10 seconds  
      marketData: 30000  // Market cap/volume every 30 seconds
    };
    this.clients = new Set();
    this.isRunning = false;
    this.priceInterval = null;
    this.chartInterval = null;
    this.marketInterval = null;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('🚀 Price Engine starting with live updates...');
    
    // Initial fetch of all data
    await this.fetchAllData();
    
    // Set up different update intervals for different data types
    this.priceInterval = setInterval(() => {
      this.fetchPrices();
    }, this.updateIntervals.prices);
    
    this.chartInterval = setInterval(() => {
      this.fetchChartData();
    }, this.updateIntervals.charts);
    
    this.marketInterval = setInterval(() => {
      this.fetchMarketData();
    }, this.updateIntervals.marketData);
  }

  stop() {
    this.isRunning = false;
    if (this.priceInterval) clearInterval(this.priceInterval);
    if (this.chartInterval) clearInterval(this.chartInterval);
    if (this.marketInterval) clearInterval(this.marketInterval);
    console.log('🛑 Price Engine stopped');
  }

  async fetchAllData() {
    const coins = await this.getAllCoins();
    await Promise.all([
      this.fetchPrices(coins),
      this.fetchMarketData(coins),
      this.fetchChartData(coins)
    ]);
  }

  async fetchPrices(coins = null) {
    try {
      if (!coins) coins = await this.getAllCoins();
      
      // Batch fetch prices - much more efficient
      const batchSize = 100; // Jupiter can handle 100 at once
      
      for (let i = 0; i < coins.length; i += batchSize) {
        const batch = coins.slice(i, i + batchSize);
        const addresses = batch.map(c => c.mintAddress || c.address).filter(Boolean).join(',');
        
        if (!addresses) continue;
        
        try {
          const response = await axios.get(
            `https://price.jup.ag/v6/price?ids=${addresses}`,
            { timeout: 5000 }
          );

          if (response.data?.data) {
            const updates = [];
            
            Object.entries(response.data.data).forEach(([address, priceData]) => {
              const coin = batch.find(c => (c.mintAddress || c.address) === address);
              if (!coin) return;
              
              const existingData = this.enrichedData.get(address) || {};
              
              // Calculate price change from last update
              const lastPrice = existingData.currentPrice || priceData.price;
              const priceChangePercent = lastPrice ? ((priceData.price - lastPrice) / lastPrice) * 100 : 0;
              
              const updated = {
                ...existingData,
                ...coin,
                address,
                currentPrice: priceData.price,
                lastPrice: lastPrice,
                priceChangeInstant: priceChangePercent,
                lastPriceUpdate: Date.now()
              };
              
              this.enrichedData.set(address, updated);
              updates.push(updated);
            });
            
            // Emit only price updates for live display
            if (updates.length > 0) {
              this.emit('prices-updated', {
                type: 'price',
                data: updates,
                timestamp: Date.now()
              });
              
              this.broadcastToClients({
                type: 'price-update',
                data: updates
              });
            }
          }
        } catch (error) {
          console.error(`Batch price fetch error:`, error.message);
        }
        
        // Small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Price fetch error:', error);
    }
  }

  async fetchMarketData(coins = null) {
    try {
      if (!coins) coins = await this.getAllCoins();
      
      // Fetch market cap, volume, liquidity from DexScreener
      const updates = [];
      
      for (const coin of coins.slice(0, 50)) { // Limit to avoid rate limits
        try {
          const address = coin.mintAddress || coin.address;
          if (!address) continue;
          
          const response = await axios.get(
            `https://api.dexscreener.com/latest/dex/tokens/${address}`,
            { timeout: 5000 }
          );
          
          if (response.data?.pairs?.[0]) {
            const pair = response.data.pairs[0];
            const existingData = this.enrichedData.get(address) || {};
            
            const updated = {
              ...existingData,
              address,
              marketCap: pair.fdv || pair.marketCap || 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              priceChange24h: pair.priceChange?.h24 || 0,
              txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
              lastMarketUpdate: Date.now()
            };
            
            this.enrichedData.set(address, updated);
            updates.push(updated);
          }
        } catch (error) {
          // Individual coin errors don't stop the whole process
          console.error(`Market data error for ${coin.symbol}:`, error.message);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (updates.length > 0) {
        this.emit('market-updated', {
          type: 'market',
          data: updates,
          timestamp: Date.now()
        });
        
        this.broadcastToClients({
          type: 'market-update',
          data: updates
        });
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
    }
  }

  async fetchChartData(coins = null) {
    try {
      if (!coins) coins = await this.getAllCoins();
      
      // Fetch OHLCV data for charts - limit to top 20 to avoid rate limits
      const updates = [];
      
      for (const coin of coins.slice(0, 20)) {
        try {
          const address = coin.mintAddress || coin.address;
          if (!address) continue;
          
          // Get price data for chart generation
          const response = await axios.get(
            `https://api.dexscreener.com/latest/dex/tokens/${address}`,
            { timeout: 5000 }
          );
          
          if (response.data?.pairs?.[0]) {
            const pair = response.data.pairs[0];
            
            // Generate simple chart data points
            const chartPoints = this.generateChartPoints(pair);
            
            this.chartData.set(address, {
              points: chartPoints,
              high24h: parseFloat(pair.priceUsd || 0),
              low24h: parseFloat(pair.priceUsd || 0) * 0.95, // Approximate for now
              lastChartUpdate: Date.now()
            });
            
            updates.push({
              address: address,
              chart: chartPoints
            });
          }
        } catch (error) {
          // Continue with other coins
          console.error(`Chart data error for ${coin.symbol}:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      if (updates.length > 0) {
        this.broadcastToClients({
          type: 'chart-update',
          data: updates
        });
      }
    } catch (error) {
      console.error('Chart data fetch error:', error);
    }
  }

  generateChartPoints(pair) {
    // Generate simple line chart points based on price changes
    const points = [];
    const now = Date.now();
    const price = parseFloat(pair.priceUsd || 0);
    
    if (price === 0) return points;
    
    // Simulate hourly points for the last 24 hours
    for (let i = 24; i >= 0; i--) {
      const time = now - (i * 3600000); // Hour in ms
      const variation = (Math.random() - 0.5) * 0.1; // ±10% variation
      const historicalPrice = price * (1 + variation);
      
      points.push({
        time: Math.floor(time / 1000),
        value: historicalPrice
      });
    }
    
    return points;
  }

  calculatePriceChange(address, currentPrice) {
    // Store price history for calculating changes
    if (!this.priceHistory.has(address)) {
      this.priceHistory.set(address, []);
    }
    
    const history = this.priceHistory.get(address);
    history.push({ price: currentPrice, time: Date.now() });
    
    // Keep only last 24 hours of data
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const filtered = history.filter(h => h.time > dayAgo);
    this.priceHistory.set(address, filtered);
    
    if (filtered.length > 1) {
      const oldPrice = filtered[0].price;
      return ((currentPrice - oldPrice) / oldPrice) * 100;
    }
    
    return 0;
  }

  async getAllCoins() {
    // Get coins from your existing data sources
    const coins = global.coinsCache || [];
    console.log(`📊 Price Engine: Processing ${coins.length} coins`);
    return coins;
  }

  getPricesData() {
    return Array.from(this.enrichedData.values());
  }

  getPrice(address) {
    return this.prices.get(address);
  }

  getChartData(address) {
    return this.chartData.get(address);
  }

  broadcastToClients(message) {
    if (this.clients.size === 0) return;
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error('Error sending to client:', error.message);
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });
    
    if (sentCount > 0) {
      console.log(`📡 Broadcasted ${message.type} to ${sentCount} clients`);
    }
  }

  // Client management
  addClient(client) {
    this.clients.add(client);
    console.log(`👤 Client connected. Total: ${this.clients.size}`);
    
    // Send initial data snapshot
    const snapshot = Array.from(this.enrichedData.values());
    const charts = Array.from(this.chartData.entries()).map(([address, data]) => ({
      address,
      chart: data.points
    }));
    
    try {
      client.send(JSON.stringify({
        type: 'initial',
        data: {
          coins: snapshot,
          charts: charts
        },
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error sending initial data:', error.message);
      this.clients.delete(client);
    }
  }

  removeClient(client) {
    this.clients.delete(client);
    console.log(`👤 Client disconnected. Total: ${this.clients.size}`);
  }

  // Status methods
  getStatus() {
    return {
      isRunning: this.isRunning,
      clientCount: this.clients.size,
      coinsCount: this.enrichedData.size,
      chartsCount: this.chartData.size,
      lastUpdate: Date.now()
    };
  }
}

module.exports = new PriceEngine();
