import { getFullApiUrl } from '../config/api';

/**
 * LocalStorage utility for storing and retrieving meme coin transaction history
 * Stores recent buys made through Moonfeed (Jupiter swaps)
 */

const STORAGE_KEY = 'moonfeed_transactions';
const MAX_TRANSACTIONS = 100; // Maximum transactions to store
const STORAGE_VERSION = 'v1';

/**
 * Sync local transactions with MongoDB backend
 */
export async function syncTransactionsWithAccount(walletAddress) {
  if (!walletAddress || walletAddress.length < 32) return [];

  const storageKey = `${STORAGE_KEY}_${walletAddress}_${STORAGE_VERSION}`;
  let localList = [];
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const data = JSON.parse(stored);
      localList = data.transactions || [];
    }
  } catch (e) {
    console.warn('[TransactionStorage] Failed reading local transactions for sync:', e);
  }

  try {
    const res = await fetch(getFullApiUrl(`/api/users/${walletAddress}/transactions`));
    if (res.ok) {
      const data = await res.json();
      const remoteList = Array.isArray(data?.transactions) ? data.transactions : [];

      // Merge local and remote without duplicates (by signature).
      // Local wins on conflict — the on-chain repair pass fixes records locally,
      // and a stale remote copy must not resurrect corrupted amounts.
      const map = new Map();
      remoteList.forEach(t => { if (t && t.signature) map.set(t.signature, t); });
      localList.forEach(t => { if (t && t.signature) map.set(t.signature, t); });

      const merged = Array.from(map.values());
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const trimmed = merged.slice(0, MAX_TRANSACTIONS);

      // Save back locally
      localStorage.setItem(storageKey, JSON.stringify({ transactions: trimmed, lastUpdated: Date.now() }));

      // If local had unsaved items or remote was merged, push updated list to backend
      if (trimmed.length > remoteList.length || (trimmed.length > 0 && localList.length > 0)) {
        fetch(getFullApiUrl(`/api/users/${walletAddress}/transactions`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: trimmed }),
          keepalive: true,
        }).catch(err => console.warn('[TransactionStorage] Failed saving remote sync:', err.message));
      }

      return trimmed;
    }
  } catch (err) {
    console.warn('[TransactionStorage] Remote sync failed:', err.message);
  }

  return localList;
}

/**
 * Get all stored transactions for a wallet
 * @param {string} walletAddress - Wallet address
 * @returns {Array} Array of transactions (sorted by timestamp, most recent first)
 */
export function getTransactions(walletAddress) {
  try {
    if (!walletAddress) return [];

    const stored = localStorage.getItem(`${STORAGE_KEY}_${walletAddress}_${STORAGE_VERSION}`);
    if (!stored) return [];

    const data = JSON.parse(stored);
    const transactions = data.transactions || [];
    
    // Always sort by timestamp (most recent first)
    transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    return transactions;
  } catch (error) {
    console.error('[TransactionStorage] Error retrieving transactions:', error);
    return [];
  }
}

/**
 * Store a new transaction
 * @param {Object} transactionData - Transaction data to store
 */
export function storeTransaction(transactionData) {
  try {
    const {
      walletAddress,
      signature,
      type = 'buy', // 'buy' or 'sell'
      tokenMint,
      tokenSymbol,
      tokenName,
      tokenImage,
      inputAmount, // Amount spent (SOL for buys)
      outputAmount, // Amount received (tokens for buys)
      inputMint, // SOL mint for buys
      outputMint, // Token mint for buys
      pricePerToken, // Price paid per token
      pricePerTokenUsd, // Same price in USD, for plotting against USD charts
      timestamp = Date.now(),
    } = transactionData;

    if (!walletAddress || !signature) {
      console.warn('[TransactionStorage] Missing walletAddress or signature, skipping storage');
      return false;
    }

    const storageKey = `${STORAGE_KEY}_${walletAddress}_${STORAGE_VERSION}`;
    
    // Get existing transactions
    let existingData = { transactions: [] };
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        existingData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[TransactionStorage] Could not parse existing data:', e);
    }

    // Check if transaction already exists (avoid duplicates)
    const existingTx = existingData.transactions.find(tx => tx.signature === signature);
    if (existingTx) {
      console.log('[TransactionStorage] Transaction already exists, skipping:', signature.slice(0, 8));
      return false;
    }

    // Create new transaction entry
    const newTransaction = {
      id: `${signature}_${timestamp}`,
      signature,
      type,
      tokenMint: tokenMint || outputMint,
      tokenSymbol: tokenSymbol || 'Unknown',
      tokenName: tokenName || tokenSymbol || 'Unknown Token',
      tokenImage: tokenImage || null,
      inputAmount: inputAmount || 0,
      outputAmount: outputAmount || 0,
      inputMint,
      outputMint,
      pricePerToken: pricePerToken || 0,
      pricePerTokenUsd: pricePerTokenUsd || 0,
      timestamp,
      createdAt: new Date(timestamp).toISOString(),
    };

    // Add to beginning (most recent first)
    existingData.transactions.unshift(newTransaction);

    // Limit to max transactions
    if (existingData.transactions.length > MAX_TRANSACTIONS) {
      existingData.transactions = existingData.transactions.slice(0, MAX_TRANSACTIONS);
    }

    // Update last modified timestamp
    existingData.lastUpdated = Date.now();

    // Save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(existingData));
    console.log(`[TransactionStorage] ✅ Stored ${type} transaction for ${tokenSymbol} - ${signature.slice(0, 8)}...`);
    
    // Sync newly stored transaction to MongoDB backend
    fetch(getFullApiUrl(`/api/users/${walletAddress}/transactions`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: existingData.transactions }),
      keepalive: true,
    }).catch(err => console.warn('[TransactionStorage] Failed pushing transaction to backend:', err.message));

    return true;
  } catch (error) {
    console.error('[TransactionStorage] Error storing transaction:', error);
    return false;
  }
}

/**
 * Delete a transaction
 * @param {string} walletAddress - Wallet address
 * @param {string} signature - Transaction signature to delete
 */
export function deleteTransaction(walletAddress, signature) {
  try {
    if (!walletAddress || !signature) return false;

    const storageKey = `${STORAGE_KEY}_${walletAddress}_${STORAGE_VERSION}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) return false;

    const data = JSON.parse(stored);
    const initialLength = data.transactions.length;
    
    data.transactions = data.transactions.filter(tx => tx.signature !== signature);
    
    if (data.transactions.length < initialLength) {
      data.lastUpdated = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log(`[TransactionStorage] ✅ Deleted transaction ${signature.slice(0, 8)}...`);

      fetch(getFullApiUrl(`/api/users/${walletAddress}/transactions`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: data.transactions }),
        keepalive: true,
      }).catch(err => console.warn('[TransactionStorage] Failed updating deleted transaction to backend:', err.message));

      return true;
    }

    return false;
  } catch (error) {
    console.error('[TransactionStorage] Error deleting transaction:', error);
    return false;
  }
}

/**
 * Clear all transactions for a wallet
 * @param {string} walletAddress - Wallet address
 */
export function clearTransactions(walletAddress) {
  try {
    if (!walletAddress) return;
    const storageKey = `${STORAGE_KEY}_${walletAddress}_${STORAGE_VERSION}`;
    localStorage.removeItem(storageKey);
    console.log('[TransactionStorage] ✅ Cleared all transactions');
  } catch (error) {
    console.error('[TransactionStorage] Error clearing transactions:', error);
  }
}

/**
 * Get transaction count for a wallet
 * @param {string} walletAddress - Wallet address
 * @returns {number} Number of stored transactions
 */
export function getTransactionCount(walletAddress) {
  return getTransactions(walletAddress).length;
}

/**
 * Get recent transactions (last N)
 * @param {string} walletAddress - Wallet address
 * @param {number} limit - Max number of transactions to return
 * @returns {Array} Recent transactions
 */
export function getRecentTransactions(walletAddress, limit = 20) {
  const transactions = getTransactions(walletAddress);
  return transactions.slice(0, limit);
}

/**
 * Get transactions for a specific token
 * @param {string} walletAddress - Wallet address
 * @param {string} tokenMint - Token mint address
 * @returns {Array} Transactions for the token
 */
export function getTransactionsForToken(walletAddress, tokenMint) {
  const transactions = getTransactions(walletAddress);
  return transactions.filter(tx => tx.tokenMint === tokenMint);
}
