const rugcheckService = require('./rugcheckService');

class RugcheckAutoProcessor {
  constructor() {
    this.isProcessing = false;
    this.isProcessingNewFeed = false;
    this.processInterval = 30000; // Check every 30 seconds
    this.batchSize = 30;
    this.intervalId = null;
    this.newFeedIntervalId = null;
    this.stats = {
      totalProcessed: 0,
      totalVerified: 0,
      totalLocked: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0
    };
    this.newFeedStats = {
      totalProcessed: 0,
      totalVerified: 0,
      totalLocked: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0
    };
  }

  // Start the automated processor for TRENDING feed
  start(currentCoinsRef, feedType = 'trending') {
    if (this.intervalId) {
      console.log('🔍 Rugcheck auto-processor already running for TRENDING feed');
      return;
    }

    this.currentCoinsRef = currentCoinsRef;
    this.feedType = feedType;
    console.log(`🚀 Starting Rugcheck auto-processor for ${feedType.toUpperCase()} feed...`);
    
    // Process first 10 coins immediately with priority
    this.processPriorityCoins();
    
    this.intervalId = setInterval(() => {
      this.processNext();
    }, this.processInterval);

    console.log(`✅ Rugcheck auto-processor started for ${feedType.toUpperCase()} (first 10 prioritized, checking every ${this.processInterval/1000}s)`);
  }

  // Start the automated processor for NEW feed
  startNewFeed(newCoinsRef) {
    if (this.newFeedIntervalId) {
      console.log('🔍 Rugcheck auto-processor already running for NEW feed');
      return;
    }

    this.newCoinsRef = newCoinsRef;
    console.log('🚀 Starting Rugcheck auto-processor for NEW feed...');
    
    // Process first 10 coins immediately with priority
    this.processPriorityCoinsNewFeed();
    
    this.newFeedIntervalId = setInterval(() => {
      this.processNextNewFeed();
    }, this.processInterval);

    console.log(`✅ Rugcheck auto-processor started for NEW feed (first 10 prioritized, checking every ${this.processInterval/1000}s)`);
  }

  // Stop the automated processor
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Rugcheck auto-processor stopped for TRENDING feed');
    }
    if (this.newFeedIntervalId) {
      clearInterval(this.newFeedIntervalId);
      this.newFeedIntervalId = null;
      console.log('🛑 Rugcheck auto-processor stopped for NEW feed');
    }
  }

  // Process first 10 coins with PRIORITY for TRENDING feed
  async processPriorityCoins() {
    if (!this.currentCoinsRef || !this.currentCoinsRef()) {
      console.log('📭 No coins available for priority processing');
      return;
    }

    const currentCoins = this.currentCoinsRef();
    const priorityCoins = currentCoins.slice(0, 10);
    const unprocessedPriorityCoins = priorityCoins.filter(coin => !coin.rugcheckProcessedAt);

    if (unprocessedPriorityCoins.length === 0) {
      console.log('✅ First 10 TRENDING coins already processed');
      return;
    }

    console.log(`🚀 PRIORITY: Processing first 10 TRENDING coins immediately...`);

    try {
      const mintAddresses = unprocessedPriorityCoins.map(coin => 
        coin.mintAddress || coin.tokenAddress || coin.address
      ).filter(Boolean);

      const rugcheckResults = await rugcheckService.checkMultipleTokens(mintAddresses, {
        maxConcurrent: 2,
        batchDelay: 1500,
        maxTokens: 10
      });

      let verifiedCount = 0;
      let lockedCount = 0;

      for (let i = 0; i < unprocessedPriorityCoins.length; i++) {
        const coin = unprocessedPriorityCoins[i];
        const coinIndex = currentCoins.findIndex(c => c.mintAddress === coin.mintAddress);
        const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
        const rugcheckData = rugcheckResults.find(r => r.address === mintAddress);
        
        if (rugcheckData && rugcheckData.rugcheckAvailable && coinIndex !== -1) {
          currentCoins[coinIndex] = {
            ...coin,
            liquidityLocked: rugcheckData.liquidityLocked,
            lockPercentage: rugcheckData.lockPercentage,
            burnPercentage: rugcheckData.burnPercentage,
            rugcheckScore: rugcheckData.score,
            riskLevel: rugcheckData.riskLevel,
            freezeAuthority: rugcheckData.freezeAuthority,
            mintAuthority: rugcheckData.mintAuthority,
            topHolderPercent: rugcheckData.topHolderPercent,
            isHoneypot: rugcheckData.isHoneypot,
            rugcheckVerified: true,
            rugcheckProcessedAt: new Date().toISOString()
          };
          verifiedCount++;
          if (rugcheckData.liquidityLocked) lockedCount++;
        } else if (coinIndex !== -1) {
          currentCoins[coinIndex] = {
            ...coin,
            rugcheckVerified: false,
            rugcheckProcessedAt: new Date().toISOString()
          };
        }
      }

      console.log(`✅ PRIORITY TRENDING: ${verifiedCount}/${unprocessedPriorityCoins.length} verified, ${lockedCount} locked`);

    } catch (error) {
      console.error('❌ Error in priority processing for TRENDING:', error.message);
    }
  }

  // Process first 10 coins with PRIORITY for NEW feed
  async processPriorityCoinsNewFeed() {
    if (!this.newCoinsRef || !this.newCoinsRef()) {
      console.log('📭 No coins available for NEW feed priority processing');
      return;
    }

    const newCoins = this.newCoinsRef();
    const priorityCoins = newCoins.slice(0, 10);
    const unprocessedPriorityCoins = priorityCoins.filter(coin => !coin.rugcheckProcessedAt);

    if (unprocessedPriorityCoins.length === 0) {
      console.log('✅ First 10 NEW coins already processed');
      return;
    }

    console.log(`🚀 PRIORITY: Processing first 10 NEW coins immediately...`);

    try {
      const mintAddresses = unprocessedPriorityCoins.map(coin => 
        coin.mintAddress || coin.tokenAddress || coin.address
      ).filter(Boolean);

      const rugcheckResults = await rugcheckService.checkMultipleTokens(mintAddresses, {
        maxConcurrent: 2,
        batchDelay: 1500,
        maxTokens: 10
      });

      let verifiedCount = 0;
      let lockedCount = 0;

      for (let i = 0; i < unprocessedPriorityCoins.length; i++) {
        const coin = unprocessedPriorityCoins[i];
        const coinIndex = newCoins.findIndex(c => c.mintAddress === coin.mintAddress);
        const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
        const rugcheckData = rugcheckResults.find(r => r.address === mintAddress);
        
        if (rugcheckData && rugcheckData.rugcheckAvailable && coinIndex !== -1) {
          newCoins[coinIndex] = {
            ...coin,
            liquidityLocked: rugcheckData.liquidityLocked,
            lockPercentage: rugcheckData.lockPercentage,
            burnPercentage: rugcheckData.burnPercentage,
            rugcheckScore: rugcheckData.score,
            riskLevel: rugcheckData.riskLevel,
            freezeAuthority: rugcheckData.freezeAuthority,
            mintAuthority: rugcheckData.mintAuthority,
            topHolderPercent: rugcheckData.topHolderPercent,
            isHoneypot: rugcheckData.isHoneypot,
            rugcheckVerified: true,
            rugcheckProcessedAt: new Date().toISOString()
          };
          verifiedCount++;
          if (rugcheckData.liquidityLocked) lockedCount++;
        } else if (coinIndex !== -1) {
          newCoins[coinIndex] = {
            ...coin,
            rugcheckVerified: false,
            rugcheckProcessedAt: new Date().toISOString()
          };
        }
      }

      console.log(`✅ PRIORITY NEW: ${verifiedCount}/${unprocessedPriorityCoins.length} verified, ${lockedCount} locked`);

    } catch (error) {
      console.error('❌ Error in priority processing for NEW:', error.message);
    }
  }

  // Process the next batch of unverified coins
  async processNext() {
    if (this.isProcessing) {
      console.log('⏳ Rugcheck processor already working, skipping...');
      return;
    }

    if (!this.currentCoinsRef || !this.currentCoinsRef()) {
      console.log('📭 No coins available for processing');
      return;
    }

    const currentCoins = this.currentCoinsRef();
    const unprocessedCoins = currentCoins.filter(coin => !coin.rugcheckProcessedAt);

    if (unprocessedCoins.length === 0) {
      console.log('✅ All coins have been processed by Rugcheck');
      return;
    }

    this.isProcessing = true;
    console.log(`🔍 Auto-processing next ${Math.min(this.batchSize, unprocessedCoins.length)} coins...`);

    try {
      const totalCoins = currentCoins.length;
      const processedCount = totalCoins - unprocessedCoins.length;
      const startIndex = processedCount;
      const coinsToProcess = Math.min(this.batchSize, unprocessedCoins.length);

      // Get the batch to process
      const batchToProcess = currentCoins.slice(startIndex, startIndex + coinsToProcess);
      const mintAddresses = batchToProcess.map(coin => 
        coin.mintAddress || coin.tokenAddress || coin.address
      ).filter(Boolean);

      console.log(`🔍 Processing batch starting at index ${startIndex} (${coinsToProcess} coins)`);

      // Process this batch
      const rugcheckResults = await rugcheckService.checkMultipleTokens(mintAddresses, {
        maxConcurrent: 2,
        batchDelay: 1500,
        maxTokens: coinsToProcess
      });

      // Update the coins with Rugcheck data
      let updatedCount = 0;
      let verifiedCount = 0;
      let lockedCount = 0;

      for (let i = 0; i < batchToProcess.length; i++) {
        const coinIndex = startIndex + i;
        const coin = currentCoins[coinIndex];
        const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
        const rugcheckData = rugcheckResults.find(r => r.address === mintAddress);
        
        if (rugcheckData && rugcheckData.rugcheckAvailable) {
          currentCoins[coinIndex] = {
            ...coin,
            liquidityLocked: rugcheckData.liquidityLocked,
            lockPercentage: rugcheckData.lockPercentage,
            burnPercentage: rugcheckData.burnPercentage,
            rugcheckScore: rugcheckData.score,
            riskLevel: rugcheckData.riskLevel,
            freezeAuthority: rugcheckData.freezeAuthority,
            mintAuthority: rugcheckData.mintAuthority,
            topHolderPercent: rugcheckData.topHolderPercent,
            isHoneypot: rugcheckData.isHoneypot,
            rugcheckVerified: true,
            rugcheckProcessedAt: new Date().toISOString()
          };
          verifiedCount++;
          if (rugcheckData.liquidityLocked) lockedCount++;
        } else {
          // Mark as processed but not verified
          currentCoins[coinIndex] = {
            ...coin,
            rugcheckVerified: false,
            rugcheckProcessedAt: new Date().toISOString()
          };
        }
        updatedCount++;
      }

      // Update stats
      this.stats.totalProcessed += updatedCount;
      this.stats.totalVerified += verifiedCount;
      this.stats.totalLocked += lockedCount;
      this.stats.batchesCompleted++;
      this.stats.lastProcessedAt = new Date().toISOString();

      const progressPercentage = Math.round(((processedCount + coinsToProcess) / totalCoins) * 100);
      const remainingCoins = totalCoins - (processedCount + coinsToProcess);

      console.log(`✅ Auto-batch complete: ${verifiedCount}/${coinsToProcess} verified, ${lockedCount} locked`);
      console.log(`📊 Progress: ${progressPercentage}% (${remainingCoins} coins remaining)`);

      if (remainingCoins === 0) {
        console.log('🎉 All coins have been processed by Rugcheck auto-processor!');
        this.logFinalStats(totalCoins);
      }

    } catch (error) {
      console.error('❌ Error in auto-processor:', error.message);
      this.stats.errors++;
    } finally {
      this.isProcessing = false;
    }
  }

  // Process the next batch of unverified coins for NEW feed
  async processNextNewFeed() {
    if (this.isProcessingNewFeed) {
      console.log('⏳ Rugcheck processor already working on NEW feed, skipping...');
      return;
    }

    if (!this.newCoinsRef || !this.newCoinsRef()) {
      console.log('📭 No NEW coins available for processing');
      return;
    }

    const newCoins = this.newCoinsRef();
    const unprocessedCoins = newCoins.filter(coin => !coin.rugcheckProcessedAt);

    if (unprocessedCoins.length === 0) {
      console.log('✅ All NEW coins have been processed by Rugcheck');
      return;
    }

    this.isProcessingNewFeed = true;
    console.log(`🔍 Auto-processing next ${Math.min(this.batchSize, unprocessedCoins.length)} NEW coins...`);

    try {
      const totalCoins = newCoins.length;
      const processedCount = totalCoins - unprocessedCoins.length;
      const startIndex = processedCount;
      const coinsToProcess = Math.min(this.batchSize, unprocessedCoins.length);

      const batchToProcess = newCoins.slice(startIndex, startIndex + coinsToProcess);
      const mintAddresses = batchToProcess.map(coin => 
        coin.mintAddress || coin.tokenAddress || coin.address
      ).filter(Boolean);

      console.log(`🔍 Processing NEW feed batch starting at index ${startIndex} (${coinsToProcess} coins)`);

      const rugcheckResults = await rugcheckService.checkMultipleTokens(mintAddresses, {
        maxConcurrent: 2,
        batchDelay: 1500,
        maxTokens: coinsToProcess
      });

      let updatedCount = 0;
      let verifiedCount = 0;
      let lockedCount = 0;

      for (let i = 0; i < batchToProcess.length; i++) {
        const coinIndex = startIndex + i;
        const coin = newCoins[coinIndex];
        const mintAddress = coin.mintAddress || coin.tokenAddress || coin.address;
        const rugcheckData = rugcheckResults.find(r => r.address === mintAddress);
        
        if (rugcheckData && rugcheckData.rugcheckAvailable) {
          newCoins[coinIndex] = {
            ...coin,
            liquidityLocked: rugcheckData.liquidityLocked,
            lockPercentage: rugcheckData.lockPercentage,
            burnPercentage: rugcheckData.burnPercentage,
            rugcheckScore: rugcheckData.score,
            riskLevel: rugcheckData.riskLevel,
            freezeAuthority: rugcheckData.freezeAuthority,
            mintAuthority: rugcheckData.mintAuthority,
            topHolderPercent: rugcheckData.topHolderPercent,
            isHoneypot: rugcheckData.isHoneypot,
            rugcheckVerified: true,
            rugcheckProcessedAt: new Date().toISOString()
          };
          verifiedCount++;
          if (rugcheckData.liquidityLocked) lockedCount++;
        } else {
          newCoins[coinIndex] = {
            ...coin,
            rugcheckVerified: false,
            rugcheckProcessedAt: new Date().toISOString()
          };
        }
        updatedCount++;
      }

      this.newFeedStats.totalProcessed += updatedCount;
      this.newFeedStats.totalVerified += verifiedCount;
      this.newFeedStats.totalLocked += lockedCount;
      this.newFeedStats.batchesCompleted++;
      this.newFeedStats.lastProcessedAt = new Date().toISOString();

      const progressPercentage = Math.round(((processedCount + coinsToProcess) / totalCoins) * 100);
      const remainingCoins = totalCoins - (processedCount + coinsToProcess);

      console.log(`✅ NEW feed auto-batch complete: ${verifiedCount}/${coinsToProcess} verified, ${lockedCount} locked`);
      console.log(`📊 NEW feed progress: ${progressPercentage}% (${remainingCoins} coins remaining)`);

      if (remainingCoins === 0) {
        console.log('🎉 All NEW coins have been processed by Rugcheck auto-processor!');
        this.logFinalStatsNewFeed(totalCoins);
      }

    } catch (error) {
      console.error('❌ Error in NEW feed auto-processor:', error.message);
      this.newFeedStats.errors++;
    } finally {
      this.isProcessingNewFeed = false;
    }
  }

  // Log final statistics
  logFinalStats(totalCoins) {
    const verificationRate = this.stats.totalProcessed > 0 ? 
      Math.round((this.stats.totalVerified / this.stats.totalProcessed) * 100) : 0;
    const lockRate = this.stats.totalVerified > 0 ? 
      Math.round((this.stats.totalLocked / this.stats.totalVerified) * 100) : 0;

    console.log('\n🎯 RUGCHECK AUTO-PROCESSOR COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total coins processed: ${this.stats.totalProcessed}/${totalCoins}`);
    console.log(`✅ Verification rate: ${verificationRate}%`);
    console.log(`🔒 Liquidity lock rate: ${lockRate}%`);
    console.log(`📦 Batches completed: ${this.stats.batchesCompleted}`);
    console.log(`❌ Errors encountered: ${this.stats.errors}`);
    console.log('═══════════════════════════════════════\n');
  }

  // Log final statistics for NEW feed
  logFinalStatsNewFeed(totalCoins) {
    const verificationRate = this.newFeedStats.totalProcessed > 0 ? 
      Math.round((this.newFeedStats.totalVerified / this.newFeedStats.totalProcessed) * 100) : 0;
    const lockRate = this.newFeedStats.totalVerified > 0 ? 
      Math.round((this.newFeedStats.totalLocked / this.newFeedStats.totalVerified) * 100) : 0;

    console.log('\n🎯 RUGCHECK AUTO-PROCESSOR COMPLETE (NEW FEED)!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total NEW coins processed: ${this.newFeedStats.totalProcessed}/${totalCoins}`);
    console.log(`✅ Verification rate: ${verificationRate}%`);
    console.log(`🔒 Liquidity lock rate: ${lockRate}%`);
    console.log(`📦 Batches completed: ${this.newFeedStats.batchesCompleted}`);
    console.log(`❌ Errors encountered: ${this.newFeedStats.errors}`);
    console.log('═══════════════════════════════════════\n');
  }

  // Get current processor status
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
      config: {
        batchSize: this.batchSize,
        processInterval: this.processInterval
      }
    };
  }

  // Manually trigger processing (useful for testing)
  async triggerProcessing() {
    if (this.isProcessing) {
      return { success: false, message: 'Already processing' };
    }

    console.log('🔧 Manual trigger: Processing next batch...');
    await this.processNext();
    return { success: true, message: 'Processing triggered' };
  }

  // Reset stats
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      totalVerified: 0,
      totalLocked: 0,
      batchesCompleted: 0,
      lastProcessedAt: null,
      errors: 0
    };
    console.log('📊 Rugcheck auto-processor stats reset');
  }
}

module.exports = RugcheckAutoProcessor;
