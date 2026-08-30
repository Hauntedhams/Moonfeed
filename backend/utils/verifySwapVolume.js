/**
 * On-chain swap volume verification for affiliate fee tracking.
 *
 * The client-reported tradeVolume proved unreliable (a sell's raw TOKEN amount
 * was once reported as SOL — 1.4M WOODSTOCK became "1,398 SOL" / $149k volume).
 * This derives the true SOL side of a swap from the transaction itself, so a
 * memecoin amount can never be mistaken for SOL again.
 */

const { HELIUS_RPC_URL } = require('../solanaRpcConfig');

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1e9;

async function fetchTransaction(signature) {
  const res = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [signature, {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }],
    }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result; // null if not yet available
}

/**
 * Compute the SOL side of a swap from balance changes.
 * Returns volume in SOL, or null if there is no meaningful SOL side.
 */
function computeSolVolume(tx, userWallet) {
  const meta = tx?.meta;
  if (!meta || meta.err) return null;

  const accountKeys = tx.transaction?.message?.accountKeys || [];
  const txFee = (meta.fee || 0);

  // Native lamports delta for the user's wallet account
  let userNativeDelta = 0;
  let userIsFeePayer = false;
  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys[i]?.pubkey || accountKeys[i];
    if (key === userWallet) {
      userNativeDelta = (meta.postBalances?.[i] || 0) - (meta.preBalances?.[i] || 0);
      userIsFeePayer = i === 0;
      break;
    }
  }

  // WSOL token-account deltas (pre/post token balances keyed by accountIndex)
  const preByIndex = new Map();
  for (const b of meta.preTokenBalances || []) {
    if (b.mint === WSOL_MINT) preByIndex.set(b.accountIndex, b);
  }
  let largestWsolAbs = 0;
  let userWsolAbs = 0;
  const seen = new Set();
  for (const post of meta.postTokenBalances || []) {
    if (post.mint !== WSOL_MINT) continue;
    seen.add(post.accountIndex);
    const pre = preByIndex.get(post.accountIndex);
    const delta = Math.abs(
      Number(post.uiTokenAmount?.amount || 0) - Number(pre?.uiTokenAmount?.amount || 0)
    );
    if (delta > largestWsolAbs) largestWsolAbs = delta;
    if (post.owner === userWallet && delta > userWsolAbs) userWsolAbs = delta;
  }
  // WSOL accounts closed during the tx (present pre, absent post)
  for (const [index, pre] of preByIndex) {
    if (seen.has(index)) continue;
    const delta = Math.abs(Number(pre.uiTokenAmount?.amount || 0));
    if (delta > largestWsolAbs) largestWsolAbs = delta;
    if (pre.owner === userWallet && delta > userWsolAbs) userWsolAbs = delta;
  }

  // User native movement net of the tx fee they paid
  let userNativeAbs = Math.abs(userNativeDelta);
  if (userIsFeePayer && userNativeDelta < 0) {
    userNativeAbs = Math.max(0, userNativeAbs - txFee);
  }

  const volumeLamports = Math.max(largestWsolAbs, userNativeAbs, userWsolAbs);
  if (!(volumeLamports > 0)) return null;

  const volumeSol = volumeLamports / LAMPORTS_PER_SOL;
  // Ignore dust — not a real swap SOL side
  if (volumeSol < 0.000001) return null;
  return volumeSol;
}

/**
 * Verify a swap's SOL volume on-chain, with retries for RPC propagation lag.
 * Returns { verified: true, volumeSol } or { verified: false, reason }.
 */
async function verifySwapVolume(signature, userWallet, { attempts = 4, delayMs = 1500 } = {}) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const tx = await fetchTransaction(signature);
      if (tx) {
        if (tx.meta?.err) return { verified: false, reason: 'transaction_failed_onchain' };
        const volumeSol = computeSolVolume(tx, userWallet);
        if (volumeSol == null) return { verified: false, reason: 'no_sol_side' };
        return { verified: true, volumeSol };
      }
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { verified: false, reason: lastError ? `rpc_error: ${lastError.message}` : 'transaction_not_found' };
}

module.exports = { verifySwapVolume, computeSolVolume, WSOL_MINT };
