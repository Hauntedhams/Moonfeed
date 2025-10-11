// NEW Feed coin storage - saves the most recent NEW feed batch
// Only keeps 1 batch (the most recent), automatically deletes old ones

const fs = require('fs');
const path = require('path');

const NEW_COINS_FILE = path.join(__dirname, 'new-coins-batch.json');

class NewCoinStorage {
  constructor() {
    this.currentBatch = this.loadBatch();
  }

  // Load saved batch from file
  loadBatch() {
    try {
      if (fs.existsSync(NEW_COINS_FILE)) {
        const data = fs.readFileSync(NEW_COINS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        console.log(`📂 Loaded NEW feed batch: ${parsed.coins?.length || 0} coins (saved at ${parsed.savedAt})`);
        return parsed;
      }
    } catch (error) {
      console.error('❌ Error loading NEW coins batch:', error.message);
    }
    return null;
  }

  // Save new batch (overwrites old one)
  saveBatch(coins) {
    try {
      const newBatch = {
        id: Date.now(),
        coins: coins,
        savedAt: new Date().toISOString(),
        count: coins.length,
        criteria: {
          age: '1-96 hours',
          volume_5m: '$20k-$70k',
          liquidity: '$10k+',
          market_cap: '$50k+'
        }
      };

      // Overwrite with new batch
      this.currentBatch = newBatch;

      // Save to file (overwrites previous)
      fs.writeFileSync(NEW_COINS_FILE, JSON.stringify(newBatch, null, 2));
      console.log(`💾 Saved NEW feed batch with ${coins.length} coins (overwrites previous batch)`);
      return true;
    } catch (error) {
      console.error('❌ Error saving NEW coins batch:', error.message);
      return false;
    }
  }

  // Get coins from current batch
  getCurrentBatch() {
    if (!this.currentBatch) return [];
    return this.currentBatch.coins || [];
  }

  // Get batch info
  getBatchInfo() {
    if (!this.currentBatch) {
      return {
        exists: false,
        count: 0,
        savedAt: null,
        age: null
      };
    }

    return {
      exists: true,
      batchId: this.currentBatch.id,
      count: this.currentBatch.count,
      savedAt: this.currentBatch.savedAt,
      age: Math.floor((Date.now() - this.currentBatch.id) / (1000 * 60)), // Age in minutes
      criteria: this.currentBatch.criteria
    };
  }

  // Clear batch
  clearBatch() {
    this.currentBatch = null;
    try {
      if (fs.existsSync(NEW_COINS_FILE)) {
        fs.unlinkSync(NEW_COINS_FILE);
        console.log('🗑️ Cleared NEW feed batch');
      }
      return true;
    } catch (error) {
      console.error('❌ Error clearing NEW feed batch:', error.message);
      return false;
    }
  }

  // Get storage info
  getStorageInfo() {
    return {
      file: NEW_COINS_FILE,
      exists: fs.existsSync(NEW_COINS_FILE),
      batchInfo: this.getBatchInfo()
    };
  }
}

module.exports = NewCoinStorage;
