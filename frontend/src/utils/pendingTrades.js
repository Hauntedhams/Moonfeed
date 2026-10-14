const STORAGE_KEY = 'moonfeed_pending_trades_v1';

export function readPendingTrades(storage = localStorage) {
  const records = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
  if (!Array.isArray(records) || records.some((record) =>
    !record || typeof record.signature !== 'string' || typeof record.walletAddress !== 'string' || typeof record.tokenMint !== 'string'
  )) throw new Error('Pending trade history is unreadable. Do not retry a trade until its signature is checked.');
  return records;
}

export function savePendingTrade(record, storage = localStorage) {
  const records = readPendingTrades(storage).filter((item) => item.signature !== record.signature);
  records.push(record);
  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function removePendingTrade(signature, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(readPendingTrades(storage).filter((item) => item.signature !== signature)));
}

export async function reconcilePendingTrades({ wallet, getStatus, onConfirmed, onSettled, onFailed, onError, storage = localStorage }) {
  for (const record of readPendingTrades(storage).filter((item) => item.walletAddress === wallet)) {
    try {
      const result = record.status === 'confirmed'
        ? { status: 'confirmed' }
        : await getStatus(record.signature, record.lastValidBlockHeight);
      if (result.status === 'confirmed') {
        // Persist confirmation before finalization so a restart only retries bookkeeping.
        savePendingTrade({ ...record, status: 'confirmed' }, storage);
        await onConfirmed(record);
        removePendingTrade(record.signature, storage);
        if (onSettled) await onSettled(record);
      } else if (result.status === 'failed' || result.status === 'expired') {
        await onFailed(record, result);
        removePendingTrade(record.signature, storage);
      }
    } catch (error) {
      if (!onError) throw error;
      await onError(record, error);
    }
  }
}
