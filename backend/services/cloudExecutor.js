// Server-side executor for opt-in "cloud execution" trading wallets.
// When the soft-order monitor flips a take-profit / stop-loss / buy-at order
// to 'triggered' for a wallet that has enrolled (routes/cloudExec.js), this
// module decrypts the key for the duration of one swap, builds + signs +
// sends it through the same instantSwapService the device path uses, records
// the outcome on the order, cancels the surviving TP/SL sibling, and pushes a
// result notification. Non-enrolled wallets never reach this code — they get
// the plain "tap to sell" alert as before.
const { Keypair } = require('@solana/web3.js');
const CloudWallet = require('../models/CloudWallet');
const SoftOrder = require('../models/SoftOrder');
const keyVault = require('./keyVault');
const swapService = require('./instantSwapService');

const MAX_FAILURE_STREAK = 5;         // pause auto-execution after this many consecutive failures
const SLIPPAGE_RETRY_MULTIPLIER = 1.5; // one retry with wider slippage on 0x1771
const MAX_SLIPPAGE_BPS = 3000;
const PENDING_RECONCILE_AFTER_MS = 2 * 60 * 1000;

const { SOL_MINT, SwapError } = swapService;
const walletQueues = new Map(); // walletAddress -> tail promise (serialises swaps per fee payer)

const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const fmtPrice = (p) => (p >= 0.01 ? Number(p).toFixed(4) : Number(p).toPrecision(3));
const kindOf = (o) => (o.side === 'buy' ? 'buy target' : o.triggerCondition === 'below' ? 'stop loss' : 'take profit');

function isAvailable() {
  return keyVault.isConfigured();
}

async function isEnrolled(walletAddress) {
  if (!isAvailable()) return false;
  return Boolean(await CloudWallet.exists({ walletAddress }));
}

// Runs `fn` after any in-flight execution for the same wallet finishes.
function enqueue(walletAddress, fn) {
  const prev = walletQueues.get(walletAddress) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (walletQueues.get(walletAddress) === next) walletQueues.delete(walletAddress);
  });
  walletQueues.set(walletAddress, next);
  return next;
}

async function markFailed(order, error, notify, { signature = null, countsAgainstStreak = true } = {}) {
  await SoftOrder.updateOne(
    { _id: order._id },
    { $set: { executionStatus: 'failed', executionError: String(error).slice(0, 300), executedAt: new Date(), ...(signature ? { executionSignature: signature } : {}) } }
  );
  if (countsAgainstStreak) {
    await CloudWallet.updateOne({ walletAddress: order.walletAddress }, { $inc: { failureStreak: 1 } });
  }
  const symbol = order.tokenSymbol || order.mint.slice(0, 6);
  const action = order.side === 'buy' ? 'buy' : 'sell';
  console.warn(`[cloud-exec] ${action} ${symbol} for ${short(order.walletAddress)} failed: ${error}`);
  if (!notify) return;
  // Same deep-link payload as the alert path so the user can finish by hand.
  await notify(order.walletAddress, 'orderFill', {
    title: `Auto-${action} failed: ${symbol}`,
    body: `${String(error).slice(0, 120)} Tap to ${action} manually.`,
    image: order.tokenImage || undefined,
    data: {
      type: 'softOrderTriggered',
      orderId: String(order._id),
      mint: order.mint,
      symbol,
      side: order.side,
      triggerPriceUsd: String(order.triggerPriceUsd),
      triggeredPriceUsd: String(order.triggeredPriceUsd || ''),
      executionStatus: 'failed',
      ...(order.amountSol ? { amountSol: String(order.amountSol) } : {}),
      ...(order.amountTokens ? { amountTokens: String(order.amountTokens) } : {}),
    },
  }).catch((e) => console.error('[cloud-exec] notify error:', e.message));
}

async function markExecuted(order, { signature, solAmount, tokenAmount }, notify) {
  await SoftOrder.updateOne(
    { _id: order._id },
    { $set: { executionStatus: 'executed', executionSignature: signature, executedAt: new Date(), executionSolAmount: solAmount, executionTokenAmount: tokenAmount, executionError: null } }
  );
  await CloudWallet.updateOne(
    { walletAddress: order.walletAddress },
    { $set: { lastExecutionAt: new Date(), failureStreak: 0 }, $inc: { executionCount: 1 } }
  );
  // A filled TP makes the SL moot (and vice versa): drop the surviving sibling.
  if (order.side === 'sell') {
    await SoftOrder.updateMany(
      { walletAddress: order.walletAddress, mint: order.mint, side: 'sell', status: 'active', _id: { $ne: order._id } },
      { $set: { status: 'cancelled' } }
    );
  }
  const symbol = order.tokenSymbol || order.mint.slice(0, 6);
  console.log(`[cloud-exec] ${order.side} ${symbol} for ${short(order.walletAddress)} executed: ${signature}`);
  if (!notify) return;
  const body = order.side === 'buy'
    ? `Bought ${symbol} with ${Number(solAmount).toFixed(4)} SOL at your ${kindOf(order)} ($${fmtPrice(order.triggeredPriceUsd)}).`
    : `Sold ${symbol} for ${Number(solAmount).toFixed(4)} SOL at your ${kindOf(order)} ($${fmtPrice(order.triggeredPriceUsd)}).`;
  await notify(order.walletAddress, 'orderFill', {
    title: `${symbol} ${order.side === 'buy' ? 'bought' : 'sold'} automatically`,
    body,
    image: order.tokenImage || undefined,
    data: {
      type: 'softOrderExecuted',
      orderId: String(order._id),
      mint: order.mint,
      symbol,
      side: order.side,
      signature,
      solAmount: String(solAmount),
      tokenAmount: String(tokenAmount),
    },
  }).catch((e) => console.error('[cloud-exec] notify error:', e.message));
}

// Build → sign → send, with one widened-slippage retry and one expiry retry.
async function swapOnce(order, keypair, slippageBps) {
  const wallet = order.walletAddress;
  let inputMint;
  let outputMint;
  let amount;
  let decimals = 9;
  if (order.side === 'buy') {
    inputMint = SOL_MINT;
    outputMint = order.mint;
    amount = BigInt(Math.round(Number(order.amountSol) * 1e9));
  } else {
    // Sell the whole on-chain position (the device executor does the same):
    // brackets are created per full buy, and partial ledgers across brackets
    // risk stranding dust below the sellable minimum.
    const bal = await swapService.getTokenBalance(wallet, order.mint);
    if (bal.raw <= 0n) throw new SwapError('No tokens left to sell — position was already closed.', { code: 'NO_BALANCE' });
    inputMint = order.mint;
    outputMint = SOL_MINT;
    amount = bal.raw;
    decimals = bal.decimals ?? 6;
  }

  const attempt = async (bps) => {
    const built = await swapService.buildSwap({ inputMint, outputMint, amount, slippageBps: bps, wallet });
    const result = await swapService.signAndSendSwap(built.swapTransaction, keypair, built.lastValidBlockHeight);
    return { built, result, bps };
  };

  let { built, result, bps } = await attempt(slippageBps);
  if (result.status === 'failed' && /0x1771|slippage/i.test(result.error || '')) {
    bps = Math.min(MAX_SLIPPAGE_BPS, Math.round(bps * SLIPPAGE_RETRY_MULTIPLIER));
    console.warn(`[cloud-exec] slippage hit for ${short(wallet)} — retrying at ${bps} bps`);
    ({ built, result } = await attempt(bps));
  } else if (result.status === 'expired') {
    console.warn(`[cloud-exec] tx expired for ${short(wallet)} — rebuilding once`);
    ({ built, result } = await attempt(bps));
  }

  const outRaw = Number(built.quote?.outAmount || 0);
  const inRaw = Number(built.quote?.inAmount || 0);
  const amounts = order.side === 'buy'
    ? { solAmount: inRaw / 1e9, tokenAmount: outRaw / 10 ** (await tokenDecimals(order.mint)) }
    : { solAmount: outRaw / 1e9, tokenAmount: inRaw / 10 ** decimals };
  return { result, amounts };
}

const decimalsCache = new Map();
async function tokenDecimals(mint) {
  if (decimalsCache.has(mint)) return decimalsCache.get(mint);
  try {
    const { PublicKey } = require('@solana/web3.js');
    const info = await swapService.getConnection().getParsedAccountInfo(new PublicKey(mint));
    const d = info.value?.data?.parsed?.info?.decimals;
    if (typeof d === 'number') { decimalsCache.set(mint, d); return d; }
  } catch (_) { /* fall through */ }
  return 6;
}

/**
 * Execute a just-triggered soft order for an enrolled wallet. Resolves when
 * the order has been marked executed/failed. Safe to call without awaiting.
 * @param {object} order   lean SoftOrder doc (status already 'triggered')
 * @param {function} notify  (walletAddress, category, payload) => Promise — push sender
 */
async function execute(order, notify) {
  if (!isAvailable()) return false;
  // Claim atomically so an overlapping poll (or a future second worker) can't double-trade.
  const claimed = await SoftOrder.findOneAndUpdate(
    { _id: order._id, executionStatus: null },
    { $set: { executionStatus: 'executing', executedBy: 'cloud' } },
    { new: true }
  ).lean();
  if (!claimed) return false;

  return enqueue(order.walletAddress, async () => {
    const row = await CloudWallet.findOne({ walletAddress: order.walletAddress }).lean();
    if (!row) {
      await markFailed(claimed, 'Cloud execution was turned off before this target hit.', notify);
      return false;
    }
    if (row.failureStreak >= MAX_FAILURE_STREAK) {
      await markFailed(claimed, `Auto-execution paused after ${row.failureStreak} failures in a row — re-enable it in Instant Trade.`, notify);
      return false;
    }

    let secret = null;
    try {
      secret = keyVault.decrypt(row, order.walletAddress);
      const keypair = Keypair.fromSecretKey(secret);
      if (keypair.publicKey.toBase58() !== order.walletAddress) {
        throw new Error('Stored key does not match wallet');
      }
      const { result, amounts } = await swapOnce(claimed, keypair, row.slippageBps || 500);
      if (result.status === 'confirmed') {
        await markExecuted(claimed, { signature: result.signature, ...amounts }, notify);
        return true;
      }
      if (result.status === 'pending') {
        // Leave it 'executing' with the signature; reconcilePending() finalises it.
        await SoftOrder.updateOne({ _id: order._id }, { $set: { executionSignature: result.signature, executionSolAmount: amounts.solAmount, executionTokenAmount: amounts.tokenAmount } });
        console.warn(`[cloud-exec] ${short(order.walletAddress)} tx still pending: ${result.signature}`);
        return false;
      }
      await markFailed(claimed, result.error || 'Swap did not confirm', notify, { signature: result.signature });
      return false;
    } catch (error) {
      const msg = error instanceof SwapError ? error.message : swapService.friendlyRpcError(error.message);
      if (error instanceof SwapError && error.code === 'NO_BALANCE') {
        // Position already closed by hand — not a wallet fault; retire the orphaned sibling too.
        await SoftOrder.updateMany(
          { walletAddress: order.walletAddress, mint: order.mint, side: 'sell', status: 'active', _id: { $ne: order._id } },
          { $set: { status: 'cancelled' } }
        );
        await markFailed(claimed, msg, notify, { countsAgainstStreak: false });
        return false;
      }
      await markFailed(claimed, msg, notify);
      return false;
    } finally {
      if (secret) secret.fill(0);
    }
  });
}

/**
 * Finalise executions that were left 'executing' with a signature because the
 * network was slow. Called from the monitor loop.
 */
async function reconcilePending(notify) {
  if (!isAvailable()) return;
  const cutoff = new Date(Date.now() - PENDING_RECONCILE_AFTER_MS);
  const stuck = await SoftOrder.find({
    executionStatus: 'executing', executedBy: 'cloud', executionSignature: { $ne: null }, triggeredAt: { $lt: cutoff },
  }).limit(20).lean();
  for (const o of stuck) {
    try {
      const s = await swapService.getSignatureStatus(o.executionSignature);
      if (s.status === 'confirmed') {
        await markExecuted(o, { signature: o.executionSignature, solAmount: o.executionSolAmount, tokenAmount: o.executionTokenAmount }, notify);
      } else if (s.status === 'failed' || s.status === 'unknown') {
        await markFailed(o, s.error || 'Transaction never landed on-chain.', notify, { signature: o.executionSignature });
      }
    } catch (e) {
      console.error('[cloud-exec] reconcile error:', e.message);
    }
  }
  // Claimed but never got a signature (process crashed mid-swap): fail them so the user is told.
  await SoftOrder.updateMany(
    { executionStatus: 'executing', executedBy: 'cloud', executionSignature: null, triggeredAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } },
    { $set: { executionStatus: 'failed', executionError: 'Execution was interrupted — sell manually.', executedAt: new Date() } }
  );
}

module.exports = { isAvailable, isEnrolled, execute, reconcilePending };
