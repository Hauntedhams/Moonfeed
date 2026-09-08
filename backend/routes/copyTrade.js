/**
 * Copy Trade Route
 * Polls Helius Enhanced Transactions API for recent SWAP activity
 * on a list of tracked wallet addresses.
 *
 * POST /api/copy-trade/recent-swaps
 * Body: { wallets: [{ address: string, since?: number }] }
 *   - since: unix timestamp (seconds). Only returns swaps newer than this.
 * Response: { success: true, swaps: [...] }
 */

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '05a97104-cba1-4284-aed6-e0ad21af8b33';
const { HELIUS_RPC_URL } = require('../solanaRpcConfig');
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Per-wallet swap cache — prevents hammering Helius on rapid polls.
// Each cache miss = 100 Helius credits (Enhanced API); keep TTL in sync with
// the frontend CopyTradeContext poll interval. On expiry a 1-credit
// getSignaturesForAddress pre-check skips the 100-credit refetch when the
// wallet had no new activity.
const swapCache = new Map();
const SWAP_CACHE_TTL = 60000;
// Wallets covered by the Helius webhook get every SWAP pushed into the cache
// as it happens — trust the cache much longer (capped so a silently broken
// webhook can't serve stale data forever).
const WEBHOOK_CACHE_TTL = 15 * 60 * 1000;

let heliusWebhookService = null;
function webhookCovers(address) {
  try {
    if (!heliusWebhookService) heliusWebhookService = require('../services/heliusWebhookService');
    return heliusWebhookService.isConfigured() && heliusWebhookService.getTrackedSet().has(address);
  } catch {
    return false;
  }
}

/**
 * Called by the Helius webhook route: prepend a fresh enhanced tx so frontend
 * polls hit the cache instead of the Enhanced API.
 */
function ingestWebhookTx(address, tx) {
  const cached = swapCache.get(address);
  const txs = Array.isArray(cached?.txs) ? cached.txs : [];
  if (txs.some((t) => t?.signature === tx.signature)) {
    cached.ts = Date.now();
    return;
  }
  swapCache.set(address, {
    txs: [tx, ...txs].slice(0, 10),
    ts: Date.now(),
    lastSeenSig: tx.signature,
  });
}

// 1-credit activity probe. Returns newest tx signature (any kind) or null on
// failure so callers fail open to the full Enhanced fetch.
async function newestSignature(address) {
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 1 }],
      }),
      timeout: 6000,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.[0]?.signature || null;
  } catch {
    return null;
  }
}

// Token symbol cache (1 hour TTL)
const symbolCache = new Map();
const SYMBOL_CACHE_TTL = 60 * 60 * 1000;

/**
 * Look up a token's symbol via Jupiter token list.
 * Falls back to abbreviated mint address.
 */
async function getTokenSymbol(mint) {
  if (mint === SOL_MINT) return 'SOL';

  const cached = symbolCache.get(mint);
  if (cached && Date.now() - cached.ts < SYMBOL_CACHE_TTL) {
    return cached.symbol;
  }

  let symbol = null;

  // Try Jupiter token API
  try {
    const r = await fetch(`https://tokens.jup.ag/token/${mint}`, {
      headers: { Accept: 'application/json' },
      timeout: 3000,
    });
    if (r.ok) {
      const d = await r.json();
      symbol = d.symbol || null;
    }
  } catch {
    // ignore
  }

  // Fallback: abbreviated mint
  if (!symbol) {
    symbol = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  }

  symbolCache.set(mint, { symbol, ts: Date.now() });
  return symbol;
}

/**
 * Parse a Helius Enhanced Transaction into a normalised swap object.
 * Returns null if the transaction is not a recognisable buy/sell swap.
 */
function parseSwap(tx, walletAddress) {
  const swapEvent = tx?.events?.swap;
  if (!swapEvent) return null;

  const { nativeInput, nativeOutput, tokenInputs, tokenOutputs } = swapEvent;

  let type = null;
  let tokenMint = null;
  let tokenAmount = 0;
  let solAmount = 0;

  // BUY: SOL in → token out
  if (nativeInput?.amount && tokenOutputs?.length > 0) {
    type = 'buy';
    solAmount = parseFloat(nativeInput.amount) / 1e9;
    const out = tokenOutputs[0];
    tokenMint = out.mint;
    const raw = out.rawTokenAmount;
    tokenAmount = raw
      ? parseFloat(raw.tokenAmount) / Math.pow(10, raw.decimals || 6)
      : 0;
  }
  // SELL: token in → SOL out
  else if (nativeOutput?.amount && tokenInputs?.length > 0) {
    type = 'sell';
    solAmount = parseFloat(nativeOutput.amount) / 1e9;
    const inp = tokenInputs[0];
    tokenMint = inp.mint;
    const raw = inp.rawTokenAmount;
    tokenAmount = raw
      ? parseFloat(raw.tokenAmount) / Math.pow(10, raw.decimals || 6)
      : 0;
  }
  // Token-to-token: treat as buy of output token
  else if (tokenInputs?.length > 0 && tokenOutputs?.length > 0) {
    type = 'buy';
    const out = tokenOutputs[0];
    tokenMint = out.mint;
    const raw = out.rawTokenAmount;
    tokenAmount = raw
      ? parseFloat(raw.tokenAmount) / Math.pow(10, raw.decimals || 6)
      : 0;
    solAmount = 0;
  }

  // Skip if we couldn't determine the type, or if the "token" is actually SOL
  if (!type || !tokenMint || tokenMint === SOL_MINT) return null;

  return {
    walletAddress,
    signature: tx.signature,
    timestamp: tx.timestamp, // unix seconds
    type,                    // 'buy' | 'sell'
    tokenMint,
    tokenAmount,
    solAmount,
    source: tx.source || 'UNKNOWN',
  };
}

/**
 * POST /api/copy-trade/recent-swaps
 */
router.post('/recent-swaps', async (req, res) => {
  const { wallets } = req.body;

  if (!Array.isArray(wallets) || wallets.length === 0) {
    return res.status(400).json({ success: false, error: 'wallets array is required' });
  }
  if (wallets.length > 20) {
    return res.status(400).json({ success: false, error: 'max 20 wallets per request' });
  }

  const rawSwaps = [];

  await Promise.all(
    wallets.map(async ({ address, since }) => {
      // Basic address sanity check
      if (!address || address.length < 32 || address.length > 44) return;

      try {
        // Serve from cache if fresh (webhook-covered wallets stay fresh via
        // pushed events, so their TTL is much longer)
        const cached = swapCache.get(address);
        const ttl = webhookCovers(address) ? WEBHOOK_CACHE_TTL : SWAP_CACHE_TTL;
        let txs;

        if (cached && Date.now() - cached.ts < ttl) {
          txs = cached.txs;
        } else {
          // Stale cache: 1-credit pre-check — if the wallet's newest tx
          // signature hasn't changed, reuse the cached swaps (100→1 credits).
          if (cached?.lastSeenSig) {
            const sig = await newestSignature(address);
            if (sig && sig === cached.lastSeenSig) {
              cached.ts = Date.now();
              txs = cached.txs;
            }
          }
        }

        if (!txs) {
          // Probe BEFORE the Enhanced fetch so a race re-checks instead of
          // ever skipping a new swap.
          const lastSeenSig = await newestSignature(address);

          const url =
            `https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions` +
            `?api-key=${HELIUS_API_KEY}&type=SWAP&limit=5`;

          const response = await fetch(url, { timeout: 8000 });

          if (!response.ok) {
            console.warn(`[CopyTrade] Helius ${response.status} for ${address.slice(0, 8)}`);
            return;
          }

          txs = await response.json();
          swapCache.set(address, { txs, ts: Date.now(), lastSeenSig });
        }

        if (!Array.isArray(txs) || txs.length === 0) return;

        // Filter to only transactions strictly newer than `since`
        const newTxs = since != null
          ? txs.filter(tx => tx.timestamp > since)
          : txs.slice(0, 1);

        for (const tx of newTxs) {
          const swap = parseSwap(tx, address);
          if (swap) rawSwaps.push(swap);
        }
      } catch (err) {
        console.error(`[CopyTrade] Error for ${address.slice(0, 8)}:`, err.message);
      }
    })
  );

  // Enrich with token symbols (parallel lookup, non-blocking failures)
  const uniqueMints = [...new Set(rawSwaps.map(s => s.tokenMint))];
  const symbolMap = {};
  await Promise.all(
    uniqueMints.map(async mint => {
      symbolMap[mint] = await getTokenSymbol(mint);
    })
  );

  const swaps = rawSwaps.map(s => ({
    ...s,
    tokenSymbol: symbolMap[s.tokenMint] || s.tokenMint.slice(0, 6),
  }));

  console.log(`[CopyTrade] Returning ${swaps.length} new swap(s) for ${wallets.length} wallet(s)`);
  res.json({ success: true, swaps });
});

module.exports = router;
module.exports.ingestWebhookTx = ingestWebhookTx;
