/**
 * RugcheckBatchProcessor - Background batch processor for rugcheck data
 * 
 * This service pre-fetches rugcheck data for all coins when feeds are updated,
 * eliminating the need for on-demand rugcheck calls. This approach:
 * 
 * 1. Prevents rate limiting at scale (fixed API call rate regardless of user count)
 * 2. Provides instant rugcheck data to users (already cached when they scroll)
 * 3. Processes in ROUND-ROBIN order across feeds (top coins from each feed first)
 * 4. Uses a shared cache across all feeds with 30-minute TTL
 * 
 * Processing order:
 * - Round 1: Top 3 coins from new, trending, dextrending, graduating
 * - Round 2: Next 3 coins from each feed
 * - Continues until all feeds are exhausted
 */

const rugcheckService = require('../rugcheckService');

class RugcheckBatchProcessor {
  constructor() {
    // Shared cache with 30-minute TTL (shared across all feeds)
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
    
    // Rate limiting configuration - VERY CONSERVATIVE to avoid Rugcheck API rate limits
    // Rugcheck API seems to allow ~10-20 requests per minute before timeouts
    this.coinsPerFeedPerRound = 1; // Process 1 coin from each feed per round (very conservative)
    this.batchDelayMs = 4000; // 4 second delay between rounds
    this.requestDelayMs = 2000; // 2 seconds delay between individual requests (~30 req/min max)
    this.retryDelayMs = 8000; // 8 second delay before retry on failure
    this.maxRetries = 2; // Max retries per coin
    
    // Track consecutive errors for adaptive throttling
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 2; // Pause after just 2 consecutive errors
    this.pauseDurationMs = 60000; // 60 second pause when hitting rate limits
    
    // Separate queues per feed (ordered - top coins first)
    this.feedQueues = {
      new: [],
      trending: [],
      dextrending: [],
      graduating: []
    };
    
    // Processing state
    this.isProcessing = false;
    this.processingAborted = false;
    
    // Stats
    this.stats = {
      totalProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      errors: 0,
      lastProcessedAt: null,
      currentRound: 0,
      feedStats: {}
    };
    
    // Start cache cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000); // Clean every 5 minutes
    
    console.log('🔒 RugcheckBatchProcessor initialized (Round-Robin Mode - Rate Limited)');
    console.log(`   Cache TTL: ${this.cacheTTL / 60000} minutes`);
    console.log(`   Coins per feed per round: ${this.coinsPerFeedPerRound}`);
    console.log(`   Request delay: ${this.requestDelayMs}ms | Round delay: ${this.batchDelayMs}ms`);
    console.log(`   Retry delay: ${this.retryDelayMs}ms | Max retries: ${this.maxRetries}`);
  }

  /**
   * Update the queue for a specific feed (replaces existing queue)
   * Called when a feed is refreshed with new coins
   * @param {Array} coins - Array of coin objects (in display order - top first)
   * @param {string} feedName - Name of the feed (new, trending, dextrending, graduating)
   */
  updateFeedQueue(coins, feedName) {
    if (!this.feedQueues.hasOwnProperty(feedName)) {
      console.log(`⚠️ Unknown feed: ${feedName}`);
      return;
    }
    
    if (!coins || coins.length === 0) {
      console.log(`📭 No coins to queue for ${feedName} rugcheck`);
      this.feedQueues[feedName] = [];
      return;
    }
    
    // Build new queue - filter out already cached coins (but include failed ones for retry)
    const coinsToProcess = coins
      .map((coin, index) => {
        const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
        if (!mintAddress) return null;
        
        const cached = this.cache.get(mintAddress);
        if (cached) {
          // Use shorter TTL for failures so they can be retried
          const ttl = cached.isFailure ? (cached.failureTTL || 5 * 60 * 1000) : this.cacheTTL;
          if (Date.now() - cached.timestamp < ttl) {
            return null; // Already cached and fresh (or recently failed)
          }
        }
        
        return {
          mintAddress,
          symbol: coin.symbol || mintAddress.slice(0, 8),
          position: index, // Track original position (for priority)
          feedName
        };
      })
      .filter(Boolean);
    
    const cachedCount = coins.length - coinsToProcess.length;
    
    console.log(`📋 [${feedName.toUpperCase()}] Queuing ${coinsToProcess.length}/${coins.length} coins (${cachedCount} already cached)`);
    
    // Replace the queue for this feed
    this.feedQueues[feedName] = coinsToProcess;
    
    // Update stats
    this.stats.feedStats[feedName] = {
      queued: coinsToProcess.length,
      cached: cachedCount,
      total: coins.length,
      updatedAt: new Date().toISOString()
    };
    
    // Restart processing (abort current and start fresh with new priorities)
    this.restartProcessing();
  }

  /**
   * Restart processing - abort current run and start fresh
   * This ensures new coins get processed immediately
   */
  restartProcessing() {
    if (this.isProcessing) {
      console.log('🔄 Restarting rugcheck processing with updated queues...');
      this.processingAborted = true;
    }
    
    // Start processing after a short delay (to allow abort to complete)
    setTimeout(() => {
      this.processingAborted = false;
      if (!this.isProcessing) {
        this.processRoundRobin();
      }
    }, 100);
  }

  /**
   * Process coins in round-robin order across all feeds
   * Each round takes 3 coins from each feed (in order), then repeats
   */
  async processRoundRobin() {
    if (this.isProcessing) return;
    
    // Check if any queue has coins
    const totalQueued = Object.values(this.feedQueues).reduce((sum, q) => sum + q.length, 0);
    if (totalQueued === 0) {
      console.log('✅ All feed queues empty - nothing to process');
      return;
    }
    
    this.isProcessing = true;
    this.processingAborted = false;
    this.stats.currentRound = 0;
    
    console.log(`\n🔍 Starting ROUND-ROBIN rugcheck processing...`);
    console.log(`   Queues: ${Object.entries(this.feedQueues).map(([k, v]) => `${k}: ${v.length}`).join(', ')}`);
    
    const feedOrder = ['new', 'trending', 'dextrending', 'graduating'];
    
    // Continue until all queues are empty or aborted
    while (!this.processingAborted) {
      // Check if any queue still has coins
      const hasCoins = feedOrder.some(feed => this.feedQueues[feed].length > 0);
      if (!hasCoins) break;
      
      this.stats.currentRound++;
      console.log(`\n📍 Round ${this.stats.currentRound}`);
      
      // Check if we need to pause due to consecutive errors (rate limiting)
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.log(`⚠️ Hit ${this.consecutiveErrors} consecutive errors - pausing ${this.pauseDurationMs / 1000}s to avoid rate limits...`);
        await this.sleep(this.pauseDurationMs);
        this.consecutiveErrors = 0; // Reset after pause
      }
      
      // Process coins from each feed in this round
      for (const feedName of feedOrder) {
        if (this.processingAborted) break;
        
        const queue = this.feedQueues[feedName];
        if (queue.length === 0) continue;
        
        // Take up to N coins from the front (top coins first)
        const batch = queue.splice(0, this.coinsPerFeedPerRound);
        
        console.log(`   [${feedName.toUpperCase()}] Processing ${batch.length} coins (${queue.length} remaining)`);
        
        // Process this batch
        for (const item of batch) {
          if (this.processingAborted) break;
          
          try {
            // Double-check cache (might have been filled by another request)
            const cached = this.cache.get(item.mintAddress);
            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
              this.stats.cacheHits++;
              console.log(`      ✓ ${item.symbol}: cached (locked: ${cached.data?.liquidityLocked || false})`);
              continue;
            }
            
            this.stats.cacheMisses++;
            this.stats.apiCalls++;
            
            // Fetch from API with retry logic
            const rugcheckData = await this.fetchWithRetry(item.mintAddress, item.symbol);
            
            // Cache the result
            this.cache.set(item.mintAddress, {
              data: rugcheckData,
              timestamp: Date.now(),
              feedName: item.feedName
            });
            
            this.stats.totalProcessed++;
            this.consecutiveErrors = 0; // Reset on success
            console.log(`      ✓ ${item.symbol}: ${rugcheckData.liquidityLocked ? 'LOCKED 🔒' : 'unlocked'} (${rugcheckData.lockPercentage}%)`);
            
            // Delay between requests to avoid rate limits
            await this.sleep(this.requestDelayMs);
            
          } catch (error) {
            this.stats.errors++;
            this.consecutiveErrors++;
            console.error(`      ✗ ${item.symbol}: ${error.message} (consecutive errors: ${this.consecutiveErrors})`);
            
            // Cache the failure with a SHORT TTL (5 minutes) so it can be retried soon
            this.cache.set(item.mintAddress, {
              data: this.createFallbackData(),
              timestamp: Date.now(),
              error: error.message,
              feedName: item.feedName,
              isFailure: true,
              failureTTL: 5 * 60 * 1000 // 5 minute TTL for failures (vs 30 min for success)
            });
            
            // Extra delay after error
            await this.sleep(this.retryDelayMs);
          }
        }
        
        // Delay between feeds within a round
        if (!this.processingAborted) {
          await this.sleep(1000); // 1 second between feeds
        }
      }
      
      this.stats.lastProcessedAt = new Date().toISOString();
      
      // Delay between rounds
      if (!this.processingAborted && feedOrder.some(f => this.feedQueues[f].length > 0)) {
        console.log(`   ⏱️ Waiting ${this.batchDelayMs}ms before next round...`);
        await this.sleep(this.batchDelayMs);
      }
    }
    
    this.isProcessing = false;
    
    if (this.processingAborted) {
      console.log(`🔄 Processing aborted - will restart with new priorities`);
    } else {
      console.log(`\n✅ Round-robin rugcheck complete!`);
      console.log(`   Rounds: ${this.stats.currentRound}`);
      console.log(`   Total processed: ${this.stats.totalProcessed}`);
      console.log(`   Cache size: ${this.cache.size}`);
      console.log(`   API calls: ${this.stats.apiCalls}`);
      console.log(`   Errors: ${this.stats.errors}`);
    }
  }

  /**
   * Fetch rugcheck data with timeout
   */
  async fetchWithTimeout(mintAddress, timeoutMs = 15000) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout'));
      }, timeoutMs);
      
      try {
        const data = await rugcheckService.checkToken(mintAddress);
        clearTimeout(timeout);
        resolve(data);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Fetch rugcheck data with retry logic
   * Retries on failure with exponential backoff
   */
  async fetchWithRetry(mintAddress, symbol = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        const data = await this.fetchWithTimeout(mintAddress, 15000);
        return data;
      } catch (error) {
        lastError = error;
        
        if (attempt <= this.maxRetries) {
          const backoffMs = this.retryDelayMs * attempt; // Exponential backoff
          console.log(`      ⚠️ ${symbol}: Attempt ${attempt} failed, retrying in ${backoffMs / 1000}s...`);
          await this.sleep(backoffMs);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get cached rugcheck data for a coin (instant - no API call)
   */
  getCached(mintAddress) {
    const cached = this.cache.get(mintAddress);
    if (!cached) {
      return null;
    }
    
    // Use shorter TTL for failures so they can be retried sooner
    const ttl = cached.isFailure ? (cached.failureTTL || 5 * 60 * 1000) : this.cacheTTL;
    
    // Check if expired
    if (Date.now() - cached.timestamp >= ttl) {
      this.cache.delete(mintAddress); // Clean up expired entry
      return null;
    }
    
    return cached.data;
  }

  /**
   * Get rugcheck data - returns cached if available, null otherwise
   * NO on-demand fetching - just returns what's in cache
   */
  getRugcheckData(mintAddress) {
    const cached = this.getCached(mintAddress);
    if (cached) {
      this.stats.cacheHits++;
      return {
        ...cached,
        fromCache: true,
        cached: true
      };
    }
    
    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Apply cached rugcheck data to coins array
   * Called when serving coins to frontend
   */
  enrichCoinsWithCache(coins) {
    let enrichedCount = 0;
    let notCachedCount = 0;
    let failedCount = 0;
    
    for (const coin of coins) {
      const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
      if (!mintAddress) continue;
      
      const cached = this.getCached(mintAddress);
      if (cached && cached.rugcheckAvailable) {
        // Apply rugcheck data to coin (successful fetch)
        coin.liquidityLocked = cached.liquidityLocked;
        coin.lockPercentage = cached.lockPercentage;
        coin.burnPercentage = cached.burnPercentage;
        coin.rugcheckScore = cached.score;
        coin.riskLevel = cached.riskLevel;
        coin.freezeAuthority = cached.freezeAuthority;
        coin.mintAuthority = cached.mintAuthority;
        coin.topHolderPercent = cached.topHolderPercent;
        coin.isHoneypot = cached.isHoneypot;
        coin.rugcheckVerified = true;
        coin.rugcheckCached = true;
        enrichedCount++;
      } else if (cached && cached.rugcheckAvailable === false) {
        // Rugcheck was attempted but failed - mark as unavailable for frontend
        coin.rugcheckUnavailable = true;
        coin.rugcheckAttempted = true;
        coin.rugcheckError = true;
        failedCount++;
      } else {
        // Not in cache yet - still processing
        notCachedCount++;
      }
    }
    
    if (notCachedCount > 0 || failedCount > 0) {
      console.log(`⚠️ Rugcheck: ${enrichedCount} cached, ${failedCount} failed, ${notCachedCount} pending`);
    }
    
    return enrichedCount;
  }

  /**
   * Create fallback data for failed requests
   */
  createFallbackData() {
    return {
      liquidityLocked: false,
      lockPercentage: 0,
      burnPercentage: 0,
      freezeAuthority: null,
      mintAuthority: null,
      topHolderPercent: 0,
      riskLevel: 'unknown',
      score: 0,
      isHoneypot: false,
      rugcheckAvailable: false
    };
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired rugcheck cache entries`);
    }
  }

  /**
   * Get processor stats
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheTTLMinutes: this.cacheTTL / 60000,
      cacheHitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(1) + '%'
        : '0%',
      isProcessing: this.isProcessing,
      queues: Object.fromEntries(
        Object.entries(this.feedQueues).map(([k, v]) => [k, v.length])
      ),
      totalQueued: Object.values(this.feedQueues).reduce((sum, q) => sum + q.length, 0)
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  queueFeedCoins(coins, feedName = 'unknown', options = {}) {
    // Map legacy feed names to standard names
    const feedMap = {
      'trending': 'trending',
      'trending-remaining': 'trending',
      'new': 'new',
      'new-saved': 'new',
      'new-saved-remaining': 'new',
      'new-remaining': 'new',
      'dextrending': 'dextrending',
      'graduating': 'graduating',
      'api-request': 'new' // Map API requests to new feed
    };
    
    const standardFeed = feedMap[feedName] || 'new';
    this.updateFeedQueue(coins, standardFeed);
  }

  /**
   * Legacy method: Process priority coins synchronously (DEPRECATED)
   * Now just updates the queue - round-robin will prioritize top coins anyway
   */
  async processPriorityCoinsSync(coins, count = 15, feedName = 'unknown') {
    // Map to standard feed name
    const feedMap = {
      'trending': 'trending',
      'new': 'new',
      'new-saved': 'new',
      'dextrending': 'dextrending',
      'graduating': 'graduating'
    };
    
    const standardFeed = feedMap[feedName] || 'new';
    
    console.log(`📌 [${feedName}] Priority processing ${count} coins via round-robin`);
    
    // Just update the queue - the round-robin processor will handle priority
    // (top coins are always first in queue, so they get processed first)
    this.updateFeedQueue(coins, standardFeed);
    
    // Return immediately - don't block startup
    return Promise.resolve();
  }

  /**
   * Legacy method: Fetch immediately (bypasses queue)
   * For individual API requests - still needed for specific coin lookup
   */
  async fetchImmediately(mintAddress, symbol = '') {
    // Check cache first
    const cached = this.getCached(mintAddress);
    if (cached) {
      console.log(`⚡ fetchImmediately: ${symbol || mintAddress.slice(0, 8)} - cache hit`);
      return {
        ...cached,
        fromCache: true
      };
    }
    
    // Fetch directly (this is for single coin lookups, not bulk processing)
    console.log(`⚡ fetchImmediately: ${symbol || mintAddress.slice(0, 8)} - API call`);
    
    try {
      const rugcheckData = await this.fetchWithTimeout(mintAddress, 8000);
      
      // Cache the result
      this.cache.set(mintAddress, {
        data: rugcheckData,
        timestamp: Date.now(),
        feedName: 'immediate'
      });
      
      this.stats.apiCalls++;
      this.stats.totalProcessed++;
      
      return rugcheckData;
    } catch (error) {
      console.error(`❌ fetchImmediately failed for ${mintAddress}: ${error.message}`);
      return this.createFallbackData();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown cleanup
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.feedQueues = { new: [], trending: [], dextrending: [], graduating: [] };
    this.isProcessing = false;
    this.processingAborted = true;
    console.log('🛑 RugcheckBatchProcessor shutdown complete');
  }
}

// Singleton instance
const rugcheckBatchProcessor = new RugcheckBatchProcessor();

module.exports = rugcheckBatchProcessor;
