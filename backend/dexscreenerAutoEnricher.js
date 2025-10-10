const dexscreenerService = require('./dexscreenerService');
const rugcheckService = require('./rugcheckService');

class DexscreenerAutoEnricher {
  constructor() {
    this.isProcessing = false;
    this.isProcessingNewFeed = false;
    this.processInterval = 30000; // Check every 30 seconds
    this.batchSize = 8; // Process 8 coins at a time (parallel) - reduced from 25 to avoid rate limits
    this.reEnrichmentInterval = 5 * 60 * 1000; // Re-enrich every 5 minutes
    this.reEnrichmentIntervalId = null;
    this.intervalId = null;
    this.newFeedIntervalId = null;
    this.stats = {
      totalProcessed: 0,
      totalEnriched: 0,
      withBanners: 0,
      withSocials: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0,
      reEnrichments: 0
    };
    this.newFeedStats = {
      totalProcessed: 0,
      totalEnriched: 0,
      withBanners: 0,
      withSocials: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0,
      reEnrichments: 0
    };
  }

  // Start the automated enricher for TRENDING feed
  start(currentCoinsRef, feedType = 'trending') {
    if (this.intervalId) {
      console.log('🎨 DexScreener auto-enricher already running for TRENDING feed');
      return;
    }

    this.currentCoinsRef = currentCoinsRef;
    this.feedType = feedType;
    console.log(`🚀 Starting DexScreener auto-enricher for ${feedType.toUpperCase()} feed...`);
    
    // Defer first enrichment by 5 seconds to allow server to fully start
    setTimeout(() => {
      this.processPriorityCoins();
    }, 5000);
    
    this.intervalId = setInterval(() => {
      this.processNext();
    }, this.processInterval);

    console.log(`✅ DexScreener auto-enricher started for ${feedType.toUpperCase()} (first 10 prioritized, checking every ${this.processInterval/1000}s)`);
  }

  // Start the automated enricher for NEW feed
  startNewFeed(newCoinsRef) {
    if (this.newFeedIntervalId) {
      console.log('🎨 DexScreener auto-enricher already running for NEW feed');
      return;
    }

    this.newCoinsRef = newCoinsRef;
    console.log('🚀 Starting DexScreener auto-enricher for NEW feed...');
    
    // Defer first enrichment by 5 seconds to allow server to fully start
    setTimeout(() => {
      this.processPriorityCoinsNewFeed();
    }, 5000);
    
    this.newFeedIntervalId = setInterval(() => {
      this.processNextNewFeed();
    }, this.processInterval);

    console.log(`✅ DexScreener auto-enricher started for NEW feed (first 10 prioritized, checking every ${this.processInterval/1000}s)`);
  }

  // Enrich a batch of coins in PARALLEL (includes Rugcheck)
  async enrichBatchParallel(coins) {
    console.log(`🚀 Starting parallel enrichment of ${coins.length} coins (DexScreener + Rugcheck)...`);
    
    const startTime = Date.now();
    
    // Step 1: DexScreener enrichment (all coins in parallel)
    const enrichmentPromises = coins.map(async (coin) => {
      try {
        const enriched = await dexscreenerService.enrichCoin(coin, {
          forceBannerEnrichment: true
        });
        return { success: true, coin: enriched, error: null };
      } catch (error) {
        console.error(`❌ Failed to enrich ${coin.symbol}:`, error.message);
        return { success: false, coin: coin, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(enrichmentPromises);
    
    const enrichedCoins = [];
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { success, coin, error } = result.value;
        
        // Add timestamp
        coin.lastEnrichedAt = new Date().toISOString();
        coin.enrichmentAttempts = (coin.enrichmentAttempts || 0) + 1;
        
        if (success && coin.enriched) {
          // Mark as processed if enriched (even without cleanChartData - some coins may not have it)
          coin.dexscreenerProcessedAt = new Date().toISOString();
          successCount++;
          
          // Clear error if it succeeded this time
          delete coin.lastEnrichmentError;
        } else {
          coin.lastEnrichmentError = error || 'No DexScreener data available';
          failureCount++;
        }
        
        enrichedCoins.push(coin);
      } else {
        // Promise itself rejected
        const originalCoin = coins[index];
        originalCoin.lastEnrichedAt = new Date().toISOString();
        originalCoin.lastEnrichmentError = result.reason?.message || 'Promise rejected';
        originalCoin.enrichmentAttempts = (originalCoin.enrichmentAttempts || 0) + 1;
        enrichedCoins.push(originalCoin);
        failureCount++;
      }
    });
    
    const dexscreenerDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ DexScreener enrichment complete in ${dexscreenerDuration}s: ${successCount} success, ${failureCount} failed`);
    
    // Step 2: Rugcheck enrichment (only for coins that haven't been checked)
    const coinsNeedingRugcheck = enrichedCoins.filter(coin => !coin.rugcheckProcessedAt);
    
    if (coinsNeedingRugcheck.length > 0) {
      console.log(`🔍 Starting Rugcheck for ${coinsNeedingRugcheck.length} coins...`);
      
      try {
        const mintAddresses = coinsNeedingRugcheck.map(coin => 
          coin.mintAddress || coin.tokenAddress || coin.address
        ).filter(Boolean);
        
        const rugcheckResults = await rugcheckService.checkMultipleTokens(mintAddresses, {
          maxConcurrent: 3,
          batchDelay: 1000,
          maxTokens: coinsNeedingRugcheck.length
        });
        
        let rugcheckCount = 0;
        
        // Apply rugcheck data to coins
        coinsNeedingRugcheck.forEach(coin => {
          const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
          const rugcheckData = rugcheckResults.find(r => r.address === mintAddress);
          
          if (rugcheckData && rugcheckData.rugcheckAvailable) {
            coin.liquidityLocked = rugcheckData.liquidityLocked;
            coin.lockPercentage = rugcheckData.lockPercentage;
            coin.burnPercentage = rugcheckData.burnPercentage;
            coin.rugcheckScore = rugcheckData.score;
            coin.riskLevel = rugcheckData.riskLevel;
            coin.freezeAuthority = rugcheckData.freezeAuthority;
            coin.mintAuthority = rugcheckData.mintAuthority;
            coin.topHolderPercent = rugcheckData.topHolderPercent;
            coin.isHoneypot = rugcheckData.isHoneypot;
            coin.rugcheckVerified = true;
            coin.rugcheckProcessedAt = new Date().toISOString();
            rugcheckCount++;
          } else {
            coin.rugcheckVerified = false;
            coin.rugcheckProcessedAt = new Date().toISOString();
          }
        });
        
        console.log(`✅ Rugcheck complete: ${rugcheckCount}/${coinsNeedingRugcheck.length} verified`);
      } catch (error) {
        console.error(`❌ Rugcheck batch failed:`, error.message);
        // Mark all as processed even if failed to avoid retrying immediately
        coinsNeedingRugcheck.forEach(coin => {
          coin.rugcheckProcessedAt = new Date().toISOString();
        });
      }
    }
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Complete enrichment finished in ${totalDuration}s`);
    
    return enrichedCoins;
  }

  // Stop the automated enricher
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 DexScreener auto-enricher stopped for TRENDING feed');
    }
    if (this.newFeedIntervalId) {
      clearInterval(this.newFeedIntervalId);
      this.newFeedIntervalId = null;
      console.log('🛑 DexScreener auto-enricher stopped for NEW feed');
    }
    if (this.reEnrichmentIntervalId) {
      clearInterval(this.reEnrichmentIntervalId);
      this.reEnrichmentIntervalId = null;
      console.log('🛑 Periodic re-enrichment stopped');
    }
  }

  // Start periodic re-enrichment (every 5 minutes)
  startPeriodicReEnrichment() {
    if (this.reEnrichmentIntervalId) {
      console.log('🔄 Periodic re-enrichment already running');
      return;
    }

    console.log(`🔄 Starting periodic re-enrichment (every ${this.reEnrichmentInterval / 1000 / 60} minutes)...`);
    
    this.reEnrichmentIntervalId = setInterval(() => {
      this.reEnrichAllCoins();
    }, this.reEnrichmentInterval);

    console.log('✅ Periodic re-enrichment started');
  }

  // Re-enrich all coins to keep static data fresh
  async reEnrichAllCoins() {
    console.log('\n🔄 ═══════════════════════════════════════════════════');
    console.log('🔄 PERIODIC RE-ENRICHMENT - Refreshing static data');
    console.log('🔄 ═══════════════════════════════════════════════════\n');

    // Re-enrich trending feed
    if (this.currentCoinsRef && this.currentCoinsRef()) {
      const currentCoins = this.currentCoinsRef();
      
      // Clear processed flags for top 20 visible coins (prioritize what users see)
      for (let i = 0; i < Math.min(20, currentCoins.length); i++) {
        delete currentCoins[i].dexscreenerProcessedAt;
        delete currentCoins[i].rugcheckProcessedAt; // Also clear rugcheck flag
      }
      
      console.log(`🔄 TRENDING: Cleared flags for top ${Math.min(20, currentCoins.length)} coins for re-enrichment`);
      this.stats.reEnrichments++;
    }

    // Re-enrich new feed
    if (this.newCoinsRef && this.newCoinsRef()) {
      const newCoins = this.newCoinsRef();
      
      // Clear processed flags for top 20 visible coins
      for (let i = 0; i < Math.min(20, newCoins.length); i++) {
        delete newCoins[i].dexscreenerProcessedAt;
        delete newCoins[i].rugcheckProcessedAt; // Also clear rugcheck flag
      }
      
      console.log(`🔄 NEW: Cleared flags for top ${Math.min(20, newCoins.length)} coins for re-enrichment`);
      this.newFeedStats.reEnrichments++;
    }

    console.log('✅ Re-enrichment flags cleared - enrichment will update on next cycle');
  }

  // Clear enrichment data when new Solana Tracker data arrives
  clearEnrichmentData(feed = 'trending') {
    console.log(`🧹 Clearing enrichment data for ${feed.toUpperCase()} feed...`);
    
    const coinsRef = feed === 'trending' ? this.currentCoinsRef : this.newCoinsRef;
    
    if (!coinsRef || !coinsRef()) {
      console.log('  No coins to clear');
      return;
    }
    
    const coins = coinsRef();
    let clearedCount = 0;
    
    for (const coin of coins) {
      if (coin.dexscreenerProcessedAt || coin.rugcheckProcessedAt) {
        delete coin.dexscreenerProcessedAt;
        delete coin.rugcheckProcessedAt; // Also clear rugcheck flag
        delete coin.lastEnrichedAt;
        delete coin.enrichmentAttempts;
        delete coin.lastEnrichmentError;
        clearedCount++;
      }
    }
    
    console.log(`✅ Cleared enrichment data for ${clearedCount} coins in ${feed.toUpperCase()} feed`);
  }

  // Process first 10 coins with PRIORITY for TRENDING feed (PARALLEL)
  async processPriorityCoins() {
    if (!this.currentCoinsRef || !this.currentCoinsRef()) {
      console.log('📭 No coins available for priority enrichment');
      return;
    }

    const currentCoins = this.currentCoinsRef();
    const priorityCoins = currentCoins.slice(0, 10);
    const unenrichedPriorityCoins = priorityCoins.filter(coin => !coin.dexscreenerProcessedAt);

    if (unenrichedPriorityCoins.length === 0) {
      console.log('✅ First 10 TRENDING coins already enriched');
      return;
    }

    console.log(`🚀 PRIORITY: Enriching first ${unenrichedPriorityCoins.length} TRENDING coins in PARALLEL...`);

    try {
      // Enrich all priority coins in parallel
      const enrichedBatch = await this.enrichBatchParallel(unenrichedPriorityCoins);

      let enrichedCount = 0;
      let bannersAdded = 0;
      let socialsAdded = 0;

      // Update coins in the main array
      for (const enrichedCoin of enrichedBatch) {
        const coinIndex = currentCoins.findIndex(c => c.mintAddress === enrichedCoin.mintAddress);
        
        if (coinIndex !== -1) {
          currentCoins[coinIndex] = enrichedCoin;

          if (enrichedCoin.enriched) enrichedCount++;
          if (enrichedCoin.banner) bannersAdded++;
          if (enrichedCoin.twitter || enrichedCoin.telegram || enrichedCoin.website) socialsAdded++;
        }
      }

      console.log(`✅ PRIORITY TRENDING: ${enrichedCount}/${unenrichedPriorityCoins.length} enriched, ${bannersAdded} banners, ${socialsAdded} socials`);

    } catch (error) {
      console.error('❌ Error in priority enrichment for TRENDING:', error.message);
      this.stats.errors++;
    }
  }

  // Process first 10 coins with PRIORITY for NEW feed (PARALLEL)
  async processPriorityCoinsNewFeed() {
    if (!this.newCoinsRef || !this.newCoinsRef()) {
      console.log('📭 No coins available for NEW feed priority enrichment');
      return;
    }

    const newCoins = this.newCoinsRef();
    const priorityCoins = newCoins.slice(0, 10);
    const unenrichedPriorityCoins = priorityCoins.filter(coin => !coin.dexscreenerProcessedAt);

    if (unenrichedPriorityCoins.length === 0) {
      console.log('✅ First 10 NEW coins already enriched');
      return;
    }

    console.log(`🚀 PRIORITY: Enriching first ${unenrichedPriorityCoins.length} NEW coins in PARALLEL...`);

    try {
      // Enrich all priority coins in parallel
      const enrichedBatch = await this.enrichBatchParallel(unenrichedPriorityCoins);

      let enrichedCount = 0;
      let bannersAdded = 0;
      let socialsAdded = 0;

      // Update coins in the main array
      for (const enrichedCoin of enrichedBatch) {
        const coinIndex = newCoins.findIndex(c => c.mintAddress === enrichedCoin.mintAddress);
        
        if (coinIndex !== -1) {
          newCoins[coinIndex] = enrichedCoin;

          if (enrichedCoin.enriched) enrichedCount++;
          if (enrichedCoin.banner) bannersAdded++;
          if (enrichedCoin.twitter || enrichedCoin.telegram || enrichedCoin.website) socialsAdded++;
        }
      }

      console.log(`✅ PRIORITY NEW: ${enrichedCount}/${unenrichedPriorityCoins.length} enriched, ${bannersAdded} banners, ${socialsAdded} socials`);

    } catch (error) {
      console.error('❌ Error in priority enrichment for NEW:', error.message);
      this.newFeedStats.errors++;
    }
  }

  // Process the next batch of unenriched coins
  async processNext() {
    if (this.isProcessing) {
      console.log('⏳ DexScreener enricher already working, skipping...');
      return;
    }

    if (!this.currentCoinsRef || !this.currentCoinsRef()) {
      console.log('📭 No coins available for enrichment');
      return;
    }

    const currentCoins = this.currentCoinsRef();
    const unenrichedCoins = currentCoins.filter(coin => !coin.dexscreenerProcessedAt);

    if (unenrichedCoins.length === 0) {
      console.log('✅ All coins have been enriched with DexScreener data');
      return;
    }

    this.isProcessing = true;
    console.log(`🎨 Auto-enriching next ${Math.min(this.batchSize, unenrichedCoins.length)} coins in PARALLEL...`);

    try {
      const totalCoins = currentCoins.length;
      const processedCount = totalCoins - unenrichedCoins.length;
      const coinsToProcess = Math.min(this.batchSize, unenrichedCoins.length);

      // Get the batch to process (get from unenriched coins directly)
      const batchToProcess = unenrichedCoins.slice(0, coinsToProcess);
      
      console.log(`🎨 Enriching batch of ${coinsToProcess} coins in parallel`);

      // Enrich this batch in PARALLEL
      const enrichedBatch = await this.enrichBatchParallel(batchToProcess);

      // Update the coins with enriched data
      let enrichedCount = 0;
      let bannersAdded = 0;
      let socialsAdded = 0;

      for (const enrichedCoin of enrichedBatch) {
        const coinIndex = currentCoins.findIndex(c => c.mintAddress === enrichedCoin.mintAddress);
        
        if (coinIndex !== -1) {
          currentCoins[coinIndex] = enrichedCoin;

          if (enrichedCoin.enriched) enrichedCount++;
          if (enrichedCoin.banner) bannersAdded++;
          if (enrichedCoin.twitter || enrichedCoin.telegram || enrichedCoin.website) socialsAdded++;
        }
      }

      // Update stats
      this.stats.totalProcessed += coinsToProcess;
      this.stats.totalEnriched += enrichedCount;
      this.stats.withBanners += bannersAdded;
      this.stats.withSocials += socialsAdded;
      this.stats.batchesCompleted++;
      this.stats.lastProcessedAt = new Date().toISOString();

      const newProcessedCount = totalCoins - (unenrichedCoins.length - coinsToProcess);
      const progressPercentage = Math.round((newProcessedCount / totalCoins) * 100);
      const remainingCoins = unenrichedCoins.length - coinsToProcess;

      console.log(`✅ Auto-enrichment batch complete: ${enrichedCount}/${coinsToProcess} enriched, ${bannersAdded} banners, ${socialsAdded} socials`);
      console.log(`📊 Progress: ${progressPercentage}% (${remainingCoins} coins remaining)`);

      if (remainingCoins === 0) {
        console.log('🎉 All coins have been enriched with DexScreener data!');
        this.logFinalStats(totalCoins);
      }

    } catch (error) {
      console.error('❌ Error in auto-enricher:', error.message);
      this.stats.errors++;
    } finally {
      this.isProcessing = false;
    }
  }

  // Process the next batch of unenriched coins for NEW feed
  async processNextNewFeed() {
    if (this.isProcessingNewFeed) {
      console.log('⏳ DexScreener enricher already working on NEW feed, skipping...');
      return;
    }

    if (!this.newCoinsRef || !this.newCoinsRef()) {
      console.log('📭 No NEW coins available for enrichment');
      return;
    }

    const newCoins = this.newCoinsRef();
    const unenrichedCoins = newCoins.filter(coin => !coin.dexscreenerProcessedAt);

    if (unenrichedCoins.length === 0) {
      console.log('✅ All NEW coins have been enriched with DexScreener data');
      return;
    }

    this.isProcessingNewFeed = true;
    console.log(`🎨 Auto-enriching next ${Math.min(this.batchSize, unenrichedCoins.length)} NEW coins in PARALLEL...`);

    try {
      const totalCoins = newCoins.length;
      const coinsToProcess = Math.min(this.batchSize, unenrichedCoins.length);

      const batchToProcess = unenrichedCoins.slice(0, coinsToProcess);
      
      console.log(`🎨 Enriching NEW feed batch of ${coinsToProcess} coins in parallel`);

      // Enrich this batch in PARALLEL
      const enrichedBatch = await this.enrichBatchParallel(batchToProcess);

      let enrichedCount = 0;
      let bannersAdded = 0;
      let socialsAdded = 0;

      for (const enrichedCoin of enrichedBatch) {
        const coinIndex = newCoins.findIndex(c => c.mintAddress === enrichedCoin.mintAddress);
        
        if (coinIndex !== -1) {
          newCoins[coinIndex] = enrichedCoin;

          if (enrichedCoin.enriched) enrichedCount++;
          if (enrichedCoin.banner) bannersAdded++;
          if (enrichedCoin.twitter || enrichedCoin.telegram || enrichedCoin.website) socialsAdded++;
        }
      }

      this.newFeedStats.totalProcessed += coinsToProcess;
      this.newFeedStats.totalEnriched += enrichedCount;
      this.newFeedStats.withBanners += bannersAdded;
      this.newFeedStats.withSocials += socialsAdded;
      this.newFeedStats.batchesCompleted++;
      this.newFeedStats.lastProcessedAt = new Date().toISOString();

      const newProcessedCount = totalCoins - (unenrichedCoins.length - coinsToProcess);
      const progressPercentage = Math.round((newProcessedCount / totalCoins) * 100);
      const remainingCoins = unenrichedCoins.length - coinsToProcess;

      console.log(`✅ NEW feed auto-enrichment batch complete: ${enrichedCount}/${coinsToProcess} enriched, ${bannersAdded} banners, ${socialsAdded} socials`);
      console.log(`📊 NEW feed progress: ${progressPercentage}% (${remainingCoins} coins remaining)`);

      if (remainingCoins === 0) {
        console.log('🎉 All NEW coins have been enriched with DexScreener data!');
        this.logFinalStatsNewFeed(totalCoins);
      }

    } catch (error) {
      console.error('❌ Error in NEW feed auto-enricher:', error.message);
      this.newFeedStats.errors++;
    } finally {
      this.isProcessingNewFeed = false;
    }
  }

  // Log final statistics
  logFinalStats(totalCoins) {
    const enrichmentRate = this.stats.totalProcessed > 0 ? 
      Math.round((this.stats.totalEnriched / this.stats.totalProcessed) * 100) : 0;
    const bannerRate = this.stats.totalProcessed > 0 ? 
      Math.round((this.stats.withBanners / this.stats.totalProcessed) * 100) : 0;
    const socialsRate = this.stats.totalProcessed > 0 ? 
      Math.round((this.stats.withSocials / this.stats.totalProcessed) * 100) : 0;

    console.log('\n🎯 DEXSCREENER AUTO-ENRICHER COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total coins processed: ${this.stats.totalProcessed}/${totalCoins}`);
    console.log(`✅ Enrichment rate: ${enrichmentRate}%`);
    console.log(`🎨 Banner rate: ${bannerRate}%`);
    console.log(`📱 Socials rate: ${socialsRate}%`);
    console.log(`📦 Batches completed: ${this.stats.batchesCompleted}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log('═══════════════════════════════════════\n');
  }

  // Log final statistics for NEW feed
  logFinalStatsNewFeed(totalCoins) {
    const enrichmentRate = this.newFeedStats.totalProcessed > 0 ? 
      Math.round((this.newFeedStats.totalEnriched / this.newFeedStats.totalProcessed) * 100) : 0;
    const bannerRate = this.newFeedStats.totalProcessed > 0 ? 
      Math.round((this.newFeedStats.withBanners / this.newFeedStats.totalProcessed) * 100) : 0;
    const socialsRate = this.newFeedStats.totalProcessed > 0 ? 
      Math.round((this.newFeedStats.withSocials / this.newFeedStats.totalProcessed) * 100) : 0;

    console.log('\n🎯 DEXSCREENER AUTO-ENRICHER (NEW FEED) COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total coins processed: ${this.newFeedStats.totalProcessed}/${totalCoins}`);
    console.log(`✅ Enrichment rate: ${enrichmentRate}%`);
    console.log(`🎨 Banner rate: ${bannerRate}%`);
    console.log(`📱 Socials rate: ${socialsRate}%`);
    console.log(`📦 Batches completed: ${this.newFeedStats.batchesCompleted}`);
    console.log(`❌ Errors encountered: ${this.newFeedStats.errors}`);
    console.log('═══════════════════════════════════════\n');
  }

  // Get current status
  getStatus() {
    return {
      trending: {
        isRunning: !!this.intervalId,
        isProcessing: this.isProcessing,
        stats: this.stats
      },
      new: {
        isRunning: !!this.newFeedIntervalId,
        isProcessing: this.isProcessingNewFeed,
        stats: this.newFeedStats
      },
      reEnrichment: {
        isRunning: !!this.reEnrichmentIntervalId,
        interval: this.reEnrichmentInterval
      },
      config: {
        batchSize: this.batchSize,
        processInterval: this.processInterval,
        reEnrichmentInterval: this.reEnrichmentInterval
      }
    };
  }

  // Manually trigger enrichment (useful for testing)
  async triggerProcessing() {
    if (this.isProcessing) {
      return { success: false, message: 'Already processing' };
    }

    console.log('🔧 Manual trigger: Enriching next batch...');
    await this.processNext();
    return { success: true, message: 'Enrichment triggered' };
  }

  // Start periodic re-enrichment (every 5 minutes)
  startPeriodicReEnrichment() {
    if (this.reEnrichmentIntervalId) {
      console.log('🔄 Periodic re-enrichment already running');
      return;
    }

    console.log(`🔄 Starting periodic re-enrichment (every ${this.reEnrichmentInterval / 1000 / 60} minutes)...`);
    
    this.reEnrichmentIntervalId = setInterval(() => {
      this.reEnrichAllCoins();
    }, this.reEnrichmentInterval);

    console.log('✅ Periodic re-enrichment started');
  }

  // Re-enrich all coins to keep static data fresh
  async reEnrichAllCoins() {
    console.log('\n🔄 ═══════════════════════════════════════════════════');
    console.log('🔄 PERIODIC RE-ENRICHMENT - Refreshing static data');
    console.log('🔄 ═══════════════════════════════════════════════════\n');

    // Re-enrich trending feed
    if (this.currentCoinsRef && this.currentCoinsRef()) {
      const currentCoins = this.currentCoinsRef();
      
      // Clear processed flags for top 20 visible coins (prioritize what users see)
      for (let i = 0; i < Math.min(20, currentCoins.length); i++) {
        delete currentCoins[i].dexscreenerProcessedAt;
        delete currentCoins[i].rugcheckProcessedAt; // Also clear rugcheck flag
      }
      
      console.log(`🔄 TRENDING: Cleared flags for top ${Math.min(20, currentCoins.length)} coins for re-enrichment`);
      this.stats.reEnrichments++;
    }

    // Re-enrich new feed
    if (this.newCoinsRef && this.newCoinsRef()) {
      const newCoins = this.newCoinsRef();
      
      // Clear processed flags for top 20 visible coins
      for (let i = 0; i < Math.min(20, newCoins.length); i++) {
        delete newCoins[i].dexscreenerProcessedAt;
        delete newCoins[i].rugcheckProcessedAt; // Also clear rugcheck flag
      }
      
      console.log(`🔄 NEW: Cleared flags for top ${Math.min(20, newCoins.length)} coins for re-enrichment`);
      this.newFeedStats.reEnrichments++;
    }

    console.log('✅ Re-enrichment flags cleared - enrichment will update on next cycle');
  }

  // Clear enrichment data when new Solana Tracker data arrives
  clearEnrichmentData(feed = 'trending') {
    console.log(`🧹 Clearing enrichment data for ${feed.toUpperCase()} feed...`);
    
    const coinsRef = feed === 'trending' ? this.currentCoinsRef : this.newCoinsRef;
    
    if (!coinsRef || !coinsRef()) {
      console.log('  No coins to clear');
      return;
    }
    
    const coins = coinsRef();
    let clearedCount = 0;
    
    for (const coin of coins) {
      if (coin.dexscreenerProcessedAt || coin.rugcheckProcessedAt) {
        delete coin.dexscreenerProcessedAt;
        delete coin.rugcheckProcessedAt; // Also clear rugcheck flag
        delete coin.lastEnrichedAt;
        delete coin.enrichmentAttempts;
        delete coin.lastEnrichmentError;
        clearedCount++;
      }
    }
    
    console.log(`✅ Cleared enrichment data for ${clearedCount} coins in ${feed.toUpperCase()} feed`);
  }

  // Reset stats
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      totalEnriched: 0,
      withBanners: 0,
      withSocials: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0,
      reEnrichments: 0
    };
    this.newFeedStats = {
      totalProcessed: 0,
      totalEnriched: 0,
      withBanners: 0,
      withSocials: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0,
      reEnrichments: 0
    };
    console.log('📊 DexScreener enricher stats reset');
  }
}

module.exports = new DexscreenerAutoEnricher();
