/**
 * LocalStorage utility for storing and retrieving limit order transaction signatures
 * This ensures we always have transaction signatures even when Jupiter API doesn't return them
 */

const STORAGE_PREFIX = 'moonfeed_limit_order_';
const STORAGE_VERSION = 'v1';

/**
 * Store order transaction signature in localStorage
 * @param {Object} orderData - Order data to store
 */
export function storeOrderSignature(orderData) {
  try {
    const {
      orderId,
      signature,
      maker,
      orderType, // 'create', 'cancel', 'execute'
      timestamp = Date.now()
    } = orderData;

    if (!orderId || !signature) {
      console.warn('[LocalStorage] Missing orderId or signature, skipping storage');
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${orderId}_${STORAGE_VERSION}`;
    
    // Get existing data for this order (if any)
    let existingData = {};
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        existingData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[LocalStorage] Could not parse existing data:', e);
    }

    // Merge with new data
    const updatedData = {
      ...existingData,
      orderId,
      maker,
      lastUpdated: timestamp,
      signatures: {
        ...(existingData.signatures || {}),
        [orderType]: signature
      }
    };

    localStorage.setItem(storageKey, JSON.stringify(updatedData));
    console.log(`[LocalStorage] ✅ Stored ${orderType} signature for order ${orderId.slice(0, 8)}...`);
  } catch (error) {
    console.error('[LocalStorage] Error storing order signature:', error);
  }
}

/**
 * Retrieve order data from localStorage
 * @param {string} orderId - Order ID to retrieve
 * @returns {Object|null} Stored order data or null if not found
 */
export function getOrderSignature(orderId) {
  try {
    if (!orderId) return null;

    const storageKey = `${STORAGE_PREFIX}${orderId}_${STORAGE_VERSION}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored);
    return data;
  } catch (error) {
    console.error('[LocalStorage] Error retrieving order signature:', error);
    return null;
  }
}

/**
 * Enrich order with stored signatures (merge API data with localStorage data)
 * @param {Object} order - Order object from API
 * @returns {Object} Enriched order with signatures from localStorage
 */
export function enrichOrderWithStoredSignatures(order) {
  try {
    const orderId = order.orderId || order.id;
    if (!orderId) return order;

    const storedData = getOrderSignature(orderId);
    if (!storedData) return order;

    // Merge signatures, preferring API data over localStorage
    return {
      ...order,
      createTxSignature: order.createTxSignature || storedData.signatures?.create || null,
      cancelTxSignature: order.cancelTxSignature || storedData.signatures?.cancel || null,
      executeTxSignature: order.executeTxSignature || storedData.signatures?.execute || null,
      _hasStoredSignatures: true
    };
  } catch (error) {
    console.error('[LocalStorage] Error enriching order:', error);
    return order;
  }
}

/**
 * Clean up old order data (older than 30 days)
 */
export function cleanupOldOrders() {
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const keysToRemove = [];

    // Find all moonfeed limit order keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.lastUpdated && data.lastUpdated < thirtyDaysAgo) {
            keysToRemove.push(key);
          }
        } catch (e) {
          // Invalid data, mark for removal
          keysToRemove.push(key);
        }
      }
    }

    // Remove old keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[LocalStorage] 🗑️  Removed old order data: ${key}`);
    });

    if (keysToRemove.length > 0) {
      console.log(`[LocalStorage] Cleaned up ${keysToRemove.length} old order(s)`);
    }
  } catch (error) {
    console.error('[LocalStorage] Error during cleanup:', error);
  }
}

/**
 * Get all stored orders for a specific maker/wallet
 * @param {string} maker - Wallet address
 * @returns {Array} Array of stored order data
 */
export function getAllStoredOrdersForWallet(maker) {
  try {
    const orders = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.maker === maker) {
            orders.push(data);
          }
        } catch (e) {
          console.warn('[LocalStorage] Could not parse order data for key:', key);
        }
      }
    }

    return orders;
  } catch (error) {
    console.error('[LocalStorage] Error getting stored orders:', error);
    return [];
  }
}

// Run cleanup on load (once per session)
let cleanupRun = false;
if (!cleanupRun) {
  cleanupOldOrders();
  cleanupRun = true;
}
