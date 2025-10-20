// Dextrending Auto-Refresher - Fetches fresh trending coins from Dexscreener every hour
// Similar to trending/new feed refreshers, but specifically for Dexscreener boosted tokens

class DextrendingAutoRefresher {
  constructor() {
    this.isRefreshing = false;
    this.refreshInterval = 60 * 60 * 1000; // 1 hour in milliseconds
    this.intervalId = null;
    this.fetchDextrendingBatchFn = null;
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
  start(fetchDextrendingBatch, onRefreshComplete) {
    if (this.intervalId) {
      console.log('🔄 Dextrending auto-refresher already running');
      return;
    }

    this.fetchDextrendingBatchFn = fetchDextrendingBatch;
    this.onRefreshCompleteFn = onRefreshComplete;

    console.log('🚀 Starting Dextrending Auto-Refresher...');
    console.log(`⏰ Will refresh Dexscreener trending coins every hour`);
    
    // Calculate next refresh time
    this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();
    
    // Start interval
    this.intervalId = setInterval(() => {
      this.refreshDextrendingCoins();
    }, this.refreshInterval);

    console.log(`✅ Dextrending auto-refresher started`);
    console.log(`📅 Next refresh scheduled for: ${this.stats.nextRefreshAt}`);
  }

  // Stop the automated refresher
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Dextrending auto-refresher stopped');
    }
  }

  // Refresh Dextrending coins with fresh data from Dexscreener
  async refreshDextrendingCoins() {
    if (this.isRefreshing) {
      console.log('⏳ Dextrending refresh already in progress, skipping...');
      return;
    }

    if (!this.fetchDextrendingBatchFn) {
      console.log('❌ Fetch function not configured');
      return;
    }

    this.isRefreshing = true;
    console.log('\n🔥 ═══════════════════════════════════════════════════');
    console.log('🔥 DEXTRENDING AUTO-REFRESH - Fetching fresh data from Dexscreener');
    console.log('🔥 ═══════════════════════════════════════════════════\n');

    try {
      // Fetch fresh Dextrending batch from Dexscreener
      const freshDextrendingBatch = await this.fetchDextrendingBatchFn();
      
      if (!freshDextrendingBatch || freshDextrendingBatch.length === 0) {
        throw new Error('No coins returned from Dexscreener');
      }

      console.log(`✅ Fetched ${freshDextrendingBatch.length} fresh Dexscreener trending coins`);

      // Call the refresh complete callback to update current serving coins
      if (this.onRefreshCompleteFn) {
        await this.onRefreshCompleteFn(freshDextrendingBatch);
      }

      // Update stats
      this.stats.totalRefreshes++;
      this.stats.lastRefreshAt = new Date().toISOString();
      this.stats.lastRefreshCount = freshDextrendingBatch.length;
      this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();

      console.log('\n✅ ═══════════════════════════════════════════════════');
      console.log(`✅ DEXTRENDING AUTO-REFRESH COMPLETE`);
      console.log(`📊 Total refreshes: ${this.stats.totalRefreshes}`);
      console.log(`🪙 Coins updated: ${freshDextrendingBatch.length}`);
      console.log(`📅 Next refresh: ${this.stats.nextRefreshAt}`);
      console.log('✅ ═══════════════════════════════════════════════════\n');

    } catch (error) {
      this.stats.errors++;
      console.error('\n❌ ═══════════════════════════════════════════════════');
      console.error('❌ DEXTRENDING AUTO-REFRESH ERROR');
      console.error(`❌ Error: ${error.message}`);
      console.error(`❌ Total errors: ${this.stats.errors}`);
      console.error('❌ ═══════════════════════════════════════════════════\n');
      
      // Schedule next retry
      this.stats.nextRefreshAt = new Date(Date.now() + this.refreshInterval).toISOString();
    } finally {
      this.isRefreshing = false;
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      isRefreshing: this.isRefreshing,
      refreshInterval: this.refreshInterval,
      refreshIntervalHuman: '1 hour',
      stats: this.stats
    };
  }

  // Manually trigger a refresh (with rate limiting)
  async triggerRefresh() {
    // Rate limit: Don't allow manual refresh if one happened in last 5 minutes
    const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    if (this.stats.lastRefreshAt) {
      const timeSinceLastRefresh = Date.now() - new Date(this.stats.lastRefreshAt).getTime();
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        const waitTime = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000 / 60);
        return {
          success: false,
          message: `Please wait ${waitTime} minutes before triggering another refresh`
        };
      }
    }

    console.log('🔧 Manual Dextrending refresh triggered');
    await this.refreshDextrendingCoins();
    
    return {
      success: true,
      message: 'Dextrending feed refreshed successfully',
      stats: this.stats
    };
  }
}

// Singleton instance
const dextrendingAutoRefresher = new DextrendingAutoRefresher();

module.exports = dextrendingAutoRefresher;