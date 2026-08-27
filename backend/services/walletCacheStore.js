const fs = require('fs').promises;
const path = require('path');

class WalletCacheStore {
  constructor() {
    this.storageDir = path.join(__dirname, '../storage');
    this.cacheFile = path.join(this.storageDir, 'wallet-cache.json');
    this.maxEntries = 750;
    this.maxAgeMs = 24 * 60 * 60 * 1000;
    this.saveTimer = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return new Map();
    this.initialized = true;

    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const raw = await fs.readFile(this.cacheFile, 'utf8');
      const parsed = JSON.parse(raw);
      const entries = Object.entries(parsed.entries || {})
        .filter(([, value]) => value?.timestamp && Date.now() - value.timestamp < this.maxAgeMs);

      console.log(`💾 Loaded ${entries.length} persisted wallet cache entries`);
      return new Map(entries);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Failed to load wallet cache store:', error.message);
      }
      return new Map();
    }
  }

  scheduleSave(cache) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.save(cache).catch((error) => {
        console.warn('⚠️ Failed to persist wallet cache:', error.message);
      });
    }, 500);
  }

  async save(cache) {
    await fs.mkdir(this.storageDir, { recursive: true });
    const entries = [...cache.entries()]
      .filter(([, value]) => value?.timestamp && Date.now() - value.timestamp < this.maxAgeMs)
      .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
      .slice(0, this.maxEntries);

    const payload = {
      savedAt: new Date().toISOString(),
      entries: Object.fromEntries(entries),
    };

    await fs.writeFile(this.cacheFile, JSON.stringify(payload, null, 2));
  }
}

module.exports = WalletCacheStore;