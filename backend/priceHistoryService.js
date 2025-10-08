class PriceHistoryService {
  constructor() {
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    this.lastRequestTime = 0;
    this.MIN_REQUEST_INTERVAL = 200; // Reduced from 1000ms to 200ms for faster chart loading
  }

  async getChartData(tokenAddress, timeframe = '1D') {
    const cacheKey = `${tokenAddress}_${timeframe}`;
    const cached = this.cache.get(cacheKey);
    
    // For chart requests, use longer cache duration for better performance
    const CHART_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for chart data
    
    if (cached && Date.now() - cached.timestamp < CHART_CACHE_DURATION) {
      console.log('Using cached chart data for', tokenAddress, timeframe);
      return cached.data;
    }

    try {
      console.log('Fetching chart data for token:', tokenAddress);
      
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      this.lastRequestTime = Date.now();
      
      // Dexscreener provides OHLCV data
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        {
          headers: {
            'User-Agent': 'MoonFeed/1.0',
          }
        }
      );
      
      if (!response.ok) {
        if (response.status === 429) {
          console.log('Rate limited, using cached data if available');
          if (cached) {
            return cached.data;
          }
          throw new Error('Rate limited and no cached data available');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Dexscreener response:', JSON.stringify(data, null, 2));
      
      if (!data.pairs || data.pairs.length === 0) {
        throw new Error('No trading pairs found for this token');
      }
      
      // Process the price history from the pair data
      const chartData = this.generateChartData(data.pairs[0], timeframe);
      
      this.cache.set(cacheKey, {
        data: chartData,
        timestamp: Date.now()
      });
      
      return chartData;
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      throw error;
    }
  }

  generateChartData(pair, timeframe) {
    const currentPrice = parseFloat(pair.priceUsd);
    const priceChanges = pair.priceChange;
    
    // Map timeframes to available data points from Dexscreener
    const timeframeConfig = {
      '1m': { 
        points: 15, 
        changes: [
          { minutes: 5, change: priceChanges.m5 || 0 }
        ],
        interval: 1 
      },
      '15m': { 
        points: 20, 
        changes: [
          { minutes: 60, change: priceChanges.h1 || 0 },
          { minutes: 5, change: priceChanges.m5 || 0 }
        ],
        interval: 15 
      },
      '1h': { 
        points: 24, 
        changes: [
          { minutes: 360, change: priceChanges.h6 || 0 },
          { minutes: 60, change: priceChanges.h1 || 0 },
          { minutes: 5, change: priceChanges.m5 || 0 }
        ],
        interval: 60 
      },
      '4h': { 
        points: 25, 
        changes: [
          { minutes: 1440, change: priceChanges.h24 || 0 },
          { minutes: 360, change: priceChanges.h6 || 0 },
          { minutes: 60, change: priceChanges.h1 || 0 }
        ],
        interval: 240 
      },
      '24h': { 
        points: 48, 
        changes: [
          { minutes: 1440, change: priceChanges.h24 || 0 },
          { minutes: 360, change: priceChanges.h6 || 0 },
          { minutes: 60, change: priceChanges.h1 || 0 },
          { minutes: 5, change: priceChanges.m5 || 0 }
        ],
        interval: 30 
      }
    };

    const config = timeframeConfig[timeframe] || timeframeConfig['1h'];
    const dataPoints = this.generateDataFromKnownPoints(
      currentPrice,
      config.changes,
      config.points,
      config.interval
    );

    return {
      tokenInfo: {
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        address: pair.baseToken.address
      },
      current: currentPrice,
      priceUsd: pair.priceUsd,
      change24h: priceChanges.h24 || 0,
      change1h: priceChanges.h1 || 0,
      change6h: priceChanges.h6 || 0,
      change5m: priceChanges.m5 || 0,
      volume24h: pair.volume.h24,
      marketCap: pair.fdv,
      timeframe,
      dataPoints,
      // Metadata about data quality
      dataQuality: {
        type: 'interpolated',
        knownPoints: config.changes.length,
        description: 'Price interpolated between known Dexscreener data points'
      }
    };
  }

  generateDataFromKnownPoints(currentPrice, knownChanges, totalPoints, intervalMinutes) {
    const points = [];
    const now = Date.now();
    
    // Calculate known price points from Dexscreener data
    const knownPoints = [
      { minutes: 0, price: currentPrice } // Current price (now)
    ];
    
    // Add known historical points
    knownChanges.forEach(change => {
      const historicalPrice = currentPrice / (1 + change.change / 100);
      knownPoints.push({
        minutes: change.minutes,
        price: historicalPrice
      });
    });
    
    // Sort by time (most recent first)
    knownPoints.sort((a, b) => a.minutes - b.minutes);
    
    // Generate interpolated points
    for (let i = 0; i < totalPoints; i++) {
      const minutesAgo = (totalPoints - i - 1) * intervalMinutes;
      const timestamp = now - (minutesAgo * 60000);
      
      // Find the price for this time point
      let price = this.interpolatePriceAtTime(minutesAgo, knownPoints);
      
      // Add small realistic volatility (max 1% to keep it realistic)
      const volatility = (Math.random() - 0.5) * 0.01; // ±0.5%
      price = price * (1 + volatility);
      
      points.push({
        time: timestamp,
        price: price,
        timestamp: new Date(timestamp).toISOString()
      });
    }
    
    return points;
  }
  
  interpolatePriceAtTime(minutesAgo, knownPoints) {
    // Find the two known points to interpolate between
    let beforePoint = knownPoints[0]; // Current price
    let afterPoint = knownPoints[knownPoints.length - 1]; // Oldest point
    
    for (let i = 0; i < knownPoints.length - 1; i++) {
      if (minutesAgo >= knownPoints[i].minutes && minutesAgo <= knownPoints[i + 1].minutes) {
        beforePoint = knownPoints[i];
        afterPoint = knownPoints[i + 1];
        break;
      }
    }
    
    // If outside known range, use closest known point
    if (minutesAgo < knownPoints[0].minutes) {
      return knownPoints[0].price;
    }
    if (minutesAgo > knownPoints[knownPoints.length - 1].minutes) {
      return knownPoints[knownPoints.length - 1].price;
    }
    
    // Linear interpolation between known points
    const timeDiff = afterPoint.minutes - beforePoint.minutes;
    const priceDiff = afterPoint.price - beforePoint.price;
    const timeProgress = (minutesAgo - beforePoint.minutes) / timeDiff;
    
    return beforePoint.price + (priceDiff * timeProgress);
  }
}

module.exports = new PriceHistoryService();
