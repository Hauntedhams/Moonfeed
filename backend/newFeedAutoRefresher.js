// New Feed Auto-Refresher - Fetches fresh NEW coins from Solana Tracker every 30 minutes
// Automatically enriches coins in the background, independent of frontend requests

class NewFeedAutoRefresher {
  constructor() {
    this.isRefreshing = false;
    this.refreshInterval = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.intervalId = null;
    this.fetchNewCoinBatchFn = null;
    this.onRefreshCompleteFn = null;
    this.stats = {
      totalRefreshes: 0,
      lastRefreshAt: null,
      lastRefreshCount: 0,
      nextRefreshAt: null,
      errors: 0
    };
  }

  // Start the automated refresher
  start(fetchNewCoinBatch, onRefreshComplete) {
    if (this.intervalId) {
      console.log('🔄 New feed auto-refresher already running');
      return;
    }

    this.fetchNewCoinBatchFn = fetchNewCoinBatch;
    this.onRefreshCompleteFn = onRefreshComplete;

    console.log('🚀 Starting New Feed Auto-Refresher...');
    console.log(`⏰ Will refresh NEW coins every 30 minutes`);
    
    // Defer first refresh by 10 seconds to allow server to fully start
    // This prevents blocking server initialization and health checks
    setTimeout(() => {
      this.refreshNewCoins();
    }, 10000);
    
    // Calculate next refresh time
    this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();
    
    // Start interval
    this.intervalId = setInterval(() => {
      this.refreshNewCoins();
    }, this.refreshInterval);

    console.log(`✅ New feed auto-refresher started`);
    console.log(`📅 Next refresh scheduled for: ${this.stats.nextRefreshAt}`);
  }

  // Stop the automated refresher
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 New feed auto-refresher stopped');
    }
  }

  // Refresh NEW coins with fresh data from Solana Tracker
  async refreshNewCoins() {
    if (this.isRefreshing) {
      console.log('⏳ New feed refresh already in progress, skipping...');
      return;
    }

    if (!this.fetchNewCoinBatchFn) {
      console.log('❌ Required functions not configured');
      return;
    }

    this.isRefreshing = true;
    console.log('\n🆕 ═══════════════════════════════════════════════════');
    console.log('🆕 NEW FEED AUTO-REFRESH - Fetching fresh data from Solana Tracker');
    console.log('🆕 ═══════════════════════════════════════════════════\n');

    try {
      // Fetch fresh NEW coin batch from Solana Tracker
      const freshNewBatch = await this.fetchNewCoinBatchFn();
      
      if (!freshNewBatch || freshNewBatch.length === 0) {
        throw new Error('No NEW coins returned from Solana Tracker');
      }

      console.log(`✅ Fetched ${freshNewBatch.length} fresh NEW coins from Solana Tracker`);

      // Call the refresh complete callback to update current serving coins
      // This will trigger enrichment for the first 10 coins automatically
      if (this.onRefreshCompleteFn) {
        await this.onRefreshCompleteFn(freshNewBatch);
      }

      // Clear enrichment data for fresh start
      console.log('🧹 Clearing old enrichment data...');
      const dexscreenerAutoEnricher = require('./dexscreenerAutoEnricher');
      dexscreenerAutoEnricher.clearEnrichmentData('new');

      // Update stats
      this.stats.totalRefreshes++;
      this.stats.lastRefreshAt = new Date().toISOString();
      this.stats.lastRefreshCount = freshNewBatch.length;
      this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();

      console.log('\n🎉 ═══════════════════════════════════════════════════');
      console.log('🎉 NEW FEED AUTO-REFRESH COMPLETE!');
      console.log(`📊 Refreshed ${freshNewBatch.length} NEW coins`);
      console.log(`📅 Next refresh: ${this.stats.nextRefreshAt}`);
      console.log(`🔢 Total refreshes: ${this.stats.totalRefreshes}`);
      console.log('🎉 ═══════════════════════════════════════════════════\n');

    } catch (error) {
      console.error('❌ Error in NEW feed auto-refresh:', error.message);
      this.stats.errors++;
      
      // Calculate next retry
      this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();
      console.log(`⚠️  Will retry at: ${this.stats.nextRefreshAt}`);
    } finally {
      this.isRefreshing = false;
    }
  }

  // Manually trigger refresh (useful for testing)
  async triggerRefresh() {
    if (this.isRefreshing) {
      return { success: false, message: 'Already refreshing' };
    }

    console.log('🔧 Manual trigger: Refreshing NEW coins...');
    await this.refreshNewCoins();
    return { success: true, message: 'Refresh triggered' };
  }

  // Get current refresher status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      isRefreshing: this.isRefreshing,
      stats: this.stats,
      config: {
        refreshInterval: this.refreshInterval,
        refreshIntervalMinutes: this.refreshInterval / (60 * 1000)
      }
    };
  }

  // Reset stats
  resetStats() {
    this.stats = {
      totalRefreshes: 0,
      lastRefreshAt: null,
      lastRefreshCount: 0,
      nextRefreshAt: null,
      errors: 0
    };
    console.log('📊 New feed auto-refresher stats reset');
  }
}

module.exports = new NewFeedAutoRefresher();
