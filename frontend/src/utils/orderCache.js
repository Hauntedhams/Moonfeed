/**
 * Frontend Order Caching Utility
 * Caches order data to avoid unnecessary re-fetches on tab switches
 */

const CACHE_KEY_PREFIX = 'order_cache_';
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Get cache key for a wallet and status filter
 * @param {string} walletAddress - Wallet public key
 * @param {string} statusFilter - 'active' or 'history'
 * @returns {string} Cache key
 */
function getCacheKey(walletAddress, statusFilter) {
  return `${CACHE_KEY_PREFIX}${walletAddress}_${statusFilter}`;
}

/**
 * Get cached orders if available and not expired
 * @param {string} walletAddress - Wallet public key
 * @param {string} statusFilter - 'active' or 'history'
 * @returns {Object|null} Cached orders or null if expired/not found
 */
export function getCachedOrders(walletAddress, statusFilter) {
  if (!walletAddress || !statusFilter) return null;
  
  try {
    const cacheKey = getCacheKey(walletAddress, statusFilter);
    const cached = sessionStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const { orders, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - timestamp > CACHE_DURATION) {
      // Cache expired, remove it
      sessionStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log(`[Order Cache] 🚀 Using cached orders for ${statusFilter} (${orders.length} orders, age: ${Math.round((now - timestamp) / 1000)}s)`);
    return orders;
  } catch (error) {
    console.error('[Order Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Cache orders for a wallet and status filter
 * @param {string} walletAddress - Wallet public key
 * @param {string} statusFilter - 'active' or 'history'
 * @param {Array} orders - Orders to cache
 */
export function setCachedOrders(walletAddress, statusFilter, orders) {
  if (!walletAddress || !statusFilter || !orders) return;
  
  try {
    const cacheKey = getCacheKey(walletAddress, statusFilter);
    const cacheData = {
      orders,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log(`[Order Cache] 💾 Cached ${orders.length} ${statusFilter} orders`);
  } catch (error) {
    console.error('[Order Cache] Error writing cache:', error);
  }
}

/**
 * Invalidate cache for a wallet (e.g., after order creation/cancellation)
 * @param {string} walletAddress - Wallet public key
 */
export function invalidateOrderCache(walletAddress) {
  if (!walletAddress) return;
  
  try {
    const activeKey = getCacheKey(walletAddress, 'active');
    const historyKey = getCacheKey(walletAddress, 'history');
    
    sessionStorage.removeItem(activeKey);
    sessionStorage.removeItem(historyKey);
    
    console.log('[Order Cache] 🗑️ Invalidated order cache');
  } catch (error) {
    console.error('[Order Cache] Error invalidating cache:', error);
  }
}

/**
 * Clear all order caches (e.g., on wallet disconnect)
 */
export function clearAllOrderCaches() {
  try {
    const keys = Object.keys(sessionStorage);
    const orderCacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    orderCacheKeys.forEach(key => sessionStorage.removeItem(key));
    
    if (orderCacheKeys.length > 0) {
      console.log(`[Order Cache] 🗑️ Cleared ${orderCacheKeys.length} order caches`);
    }
  } catch (error) {
    console.error('[Order Cache] Error clearing caches:', error);
  }
}
