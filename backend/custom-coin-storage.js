const fs = require('fs');
const path = require('path');

/**
 * Custom Filtered Coins Storage
 * Stores coins fetched with custom user filters
 * Similar to CoinStorage and NewCoinStorage but for custom filters
 */
class CustomCoinStorage {
  constructor() {
    this.storageDir = path.join(__dirname, 'storage');
    this.currentBatchFile = path.join(this.storageDir, 'custom-coins-current.json');
    this.metadataFile = path.join(this.storageDir, 'custom-coins-metadata.json');
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log('📁 Created storage directory for custom coins');
    }
  }

  /**
   * Save custom filtered coin batch to disk
   * @param {Array} coins - Array of coin objects
   * @param {Object} filters - The filters used to generate this batch
   */
  saveBatch(coins, filters = {}) {
    try {
      const batch = {
        coins: coins,
        filters: filters,
        timestamp: Date.now(),
        count: coins.length
      };

      // Save current batch
      fs.writeFileSync(this.currentBatchFile, JSON.stringify(batch, null, 2));

      // Update metadata
      const metadata = {
        lastUpdate: Date.now(),
        coinsCount: coins.length,
        filters: filters,
        lastFilters: JSON.stringify(filters)
      };
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));

      console.log(`💾 Saved custom filtered batch: ${coins.length} coins with filters:`, filters);
      return true;
    } catch (error) {
      console.error('❌ Error saving custom filtered batch:', error.message);
      return false;
    }
  }

  /**
   * Get current custom filtered batch from disk
   * @returns {Array} Array of coin objects
   */
  getCurrentBatch() {
    try {
      if (!fs.existsSync(this.currentBatchFile)) {
        console.log('📭 No custom filtered batch found on disk');
        return [];
      }

      const data = fs.readFileSync(this.currentBatchFile, 'utf8');
      const batch = JSON.parse(data);
      
      const ageMinutes = Math.floor((Date.now() - batch.timestamp) / (1000 * 60));
      console.log(`📂 Loaded custom filtered batch: ${batch.coins.length} coins (age: ${ageMinutes} min)`);
      
      return batch.coins || [];
    } catch (error) {
      console.error('❌ Error loading custom filtered batch:', error.message);
      return [];
    }
  }

  /**
   * Get batch info (age, count, filters)
   * @returns {Object} Batch information
   */
  getBatchInfo() {
    try {
      if (!fs.existsSync(this.currentBatchFile)) {
        return { age: null, count: 0, filters: {} };
      }

      const data = fs.readFileSync(this.currentBatchFile, 'utf8');
      const batch = JSON.parse(data);
      
      const ageMinutes = Math.floor((Date.now() - batch.timestamp) / (1000 * 60));
      
      return {
        age: ageMinutes,
        count: batch.coins?.length || 0,
        filters: batch.filters || {},
        timestamp: batch.timestamp
      };
    } catch (error) {
      console.error('❌ Error getting batch info:', error.message);
      return { age: null, count: 0, filters: {} };
    }
  }

  /**
   * Check if current batch matches the given filters
   * @param {Object} newFilters - Filters to compare
   * @returns {boolean} True if filters match
   */
  filtersMatch(newFilters) {
    try {
      const info = this.getBatchInfo();
      const currentFilters = info.filters || {};
      
      // Compare filter objects
      return JSON.stringify(currentFilters) === JSON.stringify(newFilters);
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear custom filtered batch
   */
  clearBatch() {
    try {
      if (fs.existsSync(this.currentBatchFile)) {
        fs.unlinkSync(this.currentBatchFile);
      }
      if (fs.existsSync(this.metadataFile)) {
        fs.unlinkSync(this.metadataFile);
      }
      console.log('🗑️ Cleared custom filtered batch');
      return true;
    } catch (error) {
      console.error('❌ Error clearing custom filtered batch:', error.message);
      return false;
    }
  }

  /**
   * Get storage info for debugging
   * @returns {Object} Storage information
   */
  getStorageInfo() {
    const info = this.getBatchInfo();
    return {
      storageDir: this.storageDir,
      currentBatchExists: fs.existsSync(this.currentBatchFile),
      currentBatchAge: info.age,
      currentBatchCount: info.count,
      currentFilters: info.filters
    };
  }
}

module.exports = CustomCoinStorage;
