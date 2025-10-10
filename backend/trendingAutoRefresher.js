// Trending Auto-Refresher - Fetches fresh trending coins from Solana Tracker every 24 hours
// Similar to how the "new" tab refreshes, but for trending coins

class TrendingAutoRefresher {
  constructor() {
    this.isRefreshing = false;
    this.refreshInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.intervalId = null;
    this.fetchFreshCoinBatchFn = null;
    this.coinStorageSaveFn = null;
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
  start(fetchFreshCoinBatch, coinStorageSave, onRefreshComplete) {
    if (this.intervalId) {
      console.log('🔄 Trending auto-refresher already running');
      return;
    }

    this.fetchFreshCoinBatchFn = fetchFreshCoinBatch;
    this.coinStorageSaveFn = coinStorageSave;
    this.onRefreshCompleteFn = onRefreshComplete;

    console.log('🚀 Starting Trending Auto-Refresher...');
    console.log(`⏰ Will refresh trending coins every 24 hours`);
    
    // Calculate next refresh time
    this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();
    
    // Start interval
    this.intervalId = setInterval(() => {
      this.refreshTrendingCoins();
    }, this.refreshInterval);

    console.log(`✅ Trending auto-refresher started`);
    console.log(`📅 Next refresh scheduled for: ${this.stats.nextRefreshAt}`);
  }

  // Stop the automated refresher
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Trending auto-refresher stopped');
    }
  }

  // Refresh trending coins with fresh data from Solana Tracker
  async refreshTrendingCoins() {
    if (this.isRefreshing) {
      console.log('⏳ Trending refresh already in progress, skipping...');
      return;
    }

    if (!this.fetchFreshCoinBatchFn || !this.coinStorageSaveFn) {
      console.log('❌ Required functions not configured');
      return;
    }

    this.isRefreshing = true;
    console.log('\n🔄 ═══════════════════════════════════════════════════');
    console.log('🔄 TRENDING AUTO-REFRESH - Fetching fresh data from Solana Tracker');
    console.log('🔄 ═══════════════════════════════════════════════════\n');

    try {
      // Fetch fresh coin batch from Solana Tracker
      const freshCoinBatch = await this.fetchFreshCoinBatchFn();
      
      if (!freshCoinBatch || freshCoinBatch.length === 0) {
        throw new Error('No coins returned from Solana Tracker');
      }

      console.log(`✅ Fetched ${freshCoinBatch.length} fresh trending coins from Solana Tracker`);

      // Save as new batch (auto-rotates old ones)
      this.coinStorageSaveFn(freshCoinBatch);
      console.log(`💾 Saved fresh batch to storage`);

      // Call the refresh complete callback to update current serving coins
      if (this.onRefreshCompleteFn) {
        this.onRefreshCompleteFn(freshCoinBatch);
      }

      // Clear enrichment data for fresh start
      console.log('🧹 Clearing old enrichment data...');
      const dexscreenerAutoEnricher = require('./dexscreenerAutoEnricher');
      dexscreenerAutoEnricher.clearEnrichmentData('trending');

      // Update stats
      this.stats.totalRefreshes++;
      this.stats.lastRefreshAt = new Date().toISOString();
      this.stats.lastRefreshCount = freshCoinBatch.length;
      this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();

      console.log('\n🎉 ═══════════════════════════════════════════════════');
      console.log('🎉 TRENDING AUTO-REFRESH COMPLETE!');
      console.log(`📊 Refreshed ${freshCoinBatch.length} trending coins`);
      console.log(`📅 Next refresh: ${this.stats.nextRefreshAt}`);
      console.log(`📈 Total refreshes: ${this.stats.totalRefreshes}`);
      console.log('🎉 ═══════════════════════════════════════════════════\n');

    } catch (error) {
      console.error('❌ Error in trending auto-refresh:', error.message);
      this.stats.errors++;
      console.log(`⚠️ Will retry at next scheduled interval (${this.stats.nextRefreshAt})`);
    } finally {
      this.isRefreshing = false;
    }
  }

  // Get current refresher status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      isRefreshing: this.isRefreshing,
      stats: {
        ...this.stats,
        refreshInterval: this.refreshInterval,
        refreshIntervalHours: this.refreshInterval / (1000 * 60 * 60)
      }
    };
  }

  // Manually trigger refresh (useful for testing or manual updates)
  async triggerRefresh() {
    if (this.isRefreshing) {
      return { success: false, message: 'Refresh already in progress' };
    }

    console.log('🔧 Manual trigger: Refreshing trending coins now...');
    await this.refreshTrendingCoins();
    return { success: true, message: 'Refresh triggered' };
  }

  // Reset stats
  resetStats() {
    this.stats = {
      totalRefreshes: 0,
      lastRefreshAt: null,
      lastRefreshCount: 0,
      nextRefreshAt: this.intervalId ? new Date(Date.now() + this.refreshInterval).toISOString() : null,
      errors: 0
    };
    console.log('📊 Trending auto-refresher stats reset');
  }

  // Update refresh interval (in hours)
  setRefreshInterval(hours) {
    if (hours < 1) {
      console.log('⚠️ Minimum refresh interval is 1 hour');
      return false;
    }

    const wasRunning = !!this.intervalId;
    
    // Stop current interval
    if (wasRunning) {
      this.stop();
    }

    // Update interval
    this.refreshInterval = hours * 60 * 60 * 1000;
    console.log(`⏰ Refresh interval updated to ${hours} hours`);

    // Restart if it was running
    if (wasRunning && this.fetchFreshCoinBatchFn && this.coinStorageSaveFn) {
      this.start(this.fetchFreshCoinBatchFn, this.coinStorageSaveFn, this.onRefreshCompleteFn);
    }

    return true;
  }
}

module.exports = new TrendingAutoRefresher();
