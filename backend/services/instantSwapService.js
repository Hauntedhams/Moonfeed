// Shared swap plumbing for the in-app trading wallet. Used by two callers:
//   • routes/instantTrade.js — builds unsigned txs for the device-held key
//   • services/cloudExecutor.js — signs server-side for opted-in wallets
// Everything that talks to Jupiter or the RPC lives here so both paths get
// identical fee handling, simulation, funding preflight and send/confirm logic.
const { Connection, PublicKey, VersionedTransaction, Transaction, SystemProgram } = require('@solana/web3.js');
const { HELIUS_RPC_URL } = require('../solanaRpcConfig');
const { requestJupiterSwap, JupiterRequestError } = require('./jupiterSwapClient');
const REFERRAL_PROGRAM_ID = 'REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3';
const REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT;
const FEE_BPS = parseInt(process.env.JUPITER_REFERRAL_FEE_BPS) || 100;

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const MAX_PRIORITY_LAMPORTS = 2_000_000; // 0.002 SOL cap on priority fees
const ATA_RENT_LAMPORTS = 2_039_280;     // rent-exempt minimum for a token account
const BASE_FEE_LAMPORTS = 5_000;         // one signature

let connection = null;
const getConnection = () => {
  if (!connection) connection = new Connection(HELIUS_RPC_URL, 'confirmed');
  return connection;
};

const isBase58Key = (value) => {
  try { new PublicKey(value); return true; } catch { return false; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class SwapError extends Error {
  constructor(message, { status = 500, code = null, extra = {} } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

// Turns RPC / preflight errors into something a trader can act on. Keeps the
// raw "custom program error: 0x…" fragment so the frontend mapping still works.
function friendlyRpcError(message) {
  const msg = String(message || '');
  if (/insufficient funds for rent/i.test(msg)) {
    return 'Not enough SOL left for rent — the wallet must keep ~0.001 SOL (or be emptied completely). Lower the amount slightly.';
  }
  if (/insufficient lamports|insufficient funds/i.test(msg)) {
    return 'Not enough SOL in the trading wallet to cover this amount plus network fees.';
  }
  if (/blockhash not found|block height exceeded/i.test(msg)) {
    return 'Transaction expired before it reached the network — nothing was executed. Try again.';
  }
  if (/0x1771|slippage/i.test(msg)) {
    return 'Price moved beyond the max slippage (custom program error: 0x1771).';
  }
  const custom = msg.match(/custom program error: (0x[0-9a-f]+)/i);
  if (custom) return `Swap rejected on-chain (custom program error: ${custom[1]}).`;
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

// ── Rent / fee math ──────────────────────────────────────────────────────────
let rentMinCache = { value: 890_880, ts: 0 };
async function getRentMinimum() {
  if (Date.now() - rentMinCache.ts < 6 * 60 * 60 * 1000) return rentMinCache.value;
  try {
    rentMinCache = { value: await getConnection().getMinimumBalanceForRentExemption(0), ts: Date.now() };
  } catch (_) { /* keep cached default */ }
  return rentMinCache.value;
}

/**
 * Exact numbers needed to size a trade safely for `wallet` on `mint`:
 * balance, rent the wallet must keep, upfront overhead for a buy/sell
 * (WSOL + token ATA rent, priority cap, base fee), and the max buy.
 */
async function computeLimits(wallet, mint = null) {
  const conn = getConnection();
  const walletKey = new PublicKey(wallet);
  const [balance, rentMin] = await Promise.all([conn.getBalance(walletKey), getRentMinimum()]);
  let tokenAtaExists = false;
  if (mint) {
    const accounts = await conn.getParsedTokenAccountsByOwner(walletKey, { mint: new PublicKey(mint) }).catch(() => ({ value: [] }));
    tokenAtaExists = accounts.value.length > 0;
  }
  // WSOL ATA rent is refunded when Jupiter closes it, but it must be funded up front.
  const buyOverhead = ATA_RENT_LAMPORTS + (tokenAtaExists ? 0 : ATA_RENT_LAMPORTS) + MAX_PRIORITY_LAMPORTS + BASE_FEE_LAMPORTS;
  const sellOverhead = ATA_RENT_LAMPORTS + MAX_PRIORITY_LAMPORTS + BASE_FEE_LAMPORTS;
  return {
    balanceLamports: balance,
    rentMinLamports: rentMin,
    buyOverheadLamports: buyOverhead,
    sellOverheadLamports: sellOverhead,
    maxBuyLamports: Math.max(0, balance - buyOverhead - rentMin),
    tokenAtaExists,
  };
}

/** Full on-chain balance of `mint` for `owner`: { raw: bigint, decimals, uiAmount }. */
async function getTokenBalance(owner, mint) {
  const accounts = await getConnection().getParsedTokenAccountsByOwner(new PublicKey(owner), { mint: new PublicKey(mint) });
  let raw = 0n;
  let decimals = null;
  let uiAmount = 0;
  for (const acc of accounts.value) {
    const t = acc.account.data.parsed?.info?.tokenAmount;
    if (!t) continue;
    try { raw += BigInt(t.amount || '0'); } catch (_) { /* non-numeric */ }
    uiAmount += Number(t.uiAmountString ?? t.uiAmount) || 0;
    if (typeof t.decimals === 'number') decimals = t.decimals;
  }
  return { raw, decimals, uiAmount };
}

// ── Jupiter ──────────────────────────────────────────────────────────────────
// Only attach the fee when the referral token account actually exists on-chain.
const feeAccountCache = new Map(); // mint -> pubkey string | null
async function resolveFeeAccount(inputMint, outputMint) {
  if (!REFERRAL_ACCOUNT) return null;
  for (const mint of [outputMint, inputMint]) {
    if (feeAccountCache.has(mint)) {
      const cached = feeAccountCache.get(mint);
      if (cached) return cached;
      continue;
    }
    try {
      const [ata] = PublicKey.findProgramAddressSync(
        [Buffer.from('referral_ata'), new PublicKey(REFERRAL_ACCOUNT).toBuffer(), new PublicKey(mint).toBuffer()],
        new PublicKey(REFERRAL_PROGRAM_ID)
      );
      const info = await getConnection().getAccountInfo(ata);
      const value = info ? ata.toBase58() : null;
      feeAccountCache.set(mint, value);
      if (value) return value;
    } catch (error) {
      console.warn('[instant-swap] feeAccount lookup failed for', mint, error.message);
      return null;
    }
  }
  return null;
}

async function buildOnce({ inputMint, outputMint, amount, slippageBps, wallet, feeAccount }) {
  const params = new URLSearchParams({
    inputMint, outputMint, amount: amount.toString(), slippageBps: String(slippageBps), swapMode: 'ExactIn',
  });
  if (feeAccount) params.set('platformFeeBps', String(FEE_BPS));

  let quote;
  try {
    quote = await requestJupiterSwap(`quote?${params}`);
  } catch (error) {
    if (!(error instanceof JupiterRequestError)) throw error;
    throw new SwapError(error.message, {
      status: error.status === 429 ? 429 : 502,
      code: error.status === 429 ? 'RATE_LIMITED' : 'QUOTE_FAILED',
      extra: { retryAfterMs: error.retryAfterMs },
    });
  }

  const swapBody = {
    quoteResponse: quote,
    userPublicKey: wallet,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: { priorityLevel: 'high', maxLamports: MAX_PRIORITY_LAMPORTS },
    },
  };
  if (feeAccount) swapBody.feeAccount = feeAccount;

  let swap;
  try {
    swap = await requestJupiterSwap('swap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(swapBody),
    });
  } catch (error) {
    if (!(error instanceof JupiterRequestError)) throw error;
    throw new SwapError(error.message, {
      status: error.status === 429 ? 429 : 502,
      code: error.status === 429 ? 'RATE_LIMITED' : 'SWAP_BUILD_FAILED',
      extra: { retryAfterMs: error.retryAfterMs },
    });
  }
  if (!swap.swapTransaction) throw new SwapError('Trading provider returned no swap transaction', { status: 502, code: 'SWAP_BUILD_FAILED' });
  return { swap, quote };
}

// Simulates the unsigned transaction with real account state. Returns null when
// clean, else a message that keeps the "custom program error: 0x..." form.
async function simulateSwap(swapTransactionB64) {
  try {
    const tx = VersionedTransaction.deserialize(Buffer.from(swapTransactionB64, 'base64'));
    const { value } = await getConnection().simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
    if (!value.err) return null;
    let message = `Simulation failed: ${JSON.stringify(value.err)}`;
    const custom = value.err?.InstructionError?.[1]?.Custom;
    if (Number.isInteger(custom)) message += ` (custom program error: 0x${custom.toString(16)})`;
    const logs = (value.logs || []).filter((l) => /error|failed|insufficient/i.test(l)).slice(-2).join(' | ');
    if (logs) message += ` — ${logs}`;
    return message.slice(0, 400);
  } catch (error) {
    console.warn('[instant-swap] simulation errored, letting preflight decide:', error.message);
    return null; // fail-open: send still runs preflight
  }
}

/**
 * Funding preflight with exact rent/ATA math. Throws SwapError(422,
 * INSUFFICIENT_SOL) with an actionable message when the wallet is short.
 */
async function assertFunded({ inputMint, outputMint, amount, wallet }) {
  const isBuy = inputMint === SOL_MINT;
  const limits = await computeLimits(wallet, isBuy ? outputMint : inputMint);
  const overhead = isBuy ? limits.buyOverheadLamports : limits.sellOverheadLamports;
  const needed = (isBuy ? Number(amount) : 0) + overhead + limits.rentMinLamports;
  if (limits.balanceLamports >= needed) return limits;
  const maxBuy = limits.maxBuyLamports / 1e9;
  const extra = ((overhead + limits.rentMinLamports) / 1e9).toFixed(4);
  const message = isBuy
    ? (maxBuy >= 0.001
      ? `Not enough SOL: a ${(Number(amount) / 1e9).toFixed(4)} SOL buy needs ~${extra} SOL extra for fees and rent. Max buy right now: ${maxBuy.toFixed(4)} SOL.`
      : 'Not enough SOL in the trading wallet — deposit more to trade.')
    : `Selling needs ~${extra} SOL in the trading wallet for fees and rent (you have ${(limits.balanceLamports / 1e9).toFixed(4)}). Deposit a little SOL first.`;
  throw new SwapError(message, { status: 422, code: 'INSUFFICIENT_SOL', extra: { maxBuyLamports: limits.maxBuyLamports } });
}

/**
 * Build an unsigned, simulated Jupiter swap for `wallet`.
 * Returns { swapTransaction (b64), lastValidBlockHeight, feeApplied, quote }.
 * Throws SwapError with .status/.code for HTTP mapping.
 */
async function buildSwap({ inputMint, outputMint, amount, slippageBps = 300, wallet }) {
  if (!isBase58Key(inputMint) || !isBase58Key(outputMint) || !isBase58Key(wallet)) {
    throw new SwapError('Invalid mint or wallet address', { status: 400, code: 'BAD_REQUEST' });
  }
  const amt = BigInt(String(amount || 0));
  if (amt <= 0n) throw new SwapError('Invalid amount', { status: 400, code: 'BAD_REQUEST' });
  const bps = Math.min(3000, Math.max(10, parseInt(slippageBps) || 300));

  await assertFunded({ inputMint, outputMint, amount: amt, wallet });

  const feeAccount = await resolveFeeAccount(inputMint, outputMint);
  const args = { inputMint, outputMint, amount: amt, slippageBps: bps, wallet };

  let { swap, quote } = await buildOnce({ ...args, feeAccount });
  let feeApplied = Boolean(feeAccount);
  let simError = await simulateSwap(swap.swapTransaction);

  // Some routes reject the fee account (e.g. Token-2022 side → 0x177e). Never
  // block the trade on fee plumbing: rebuild without the fee and re-check.
  if (simError && feeApplied) {
    console.warn(`[instant-swap] sim failed with fee (${simError.slice(0, 120)}) — retrying without fee`);
    const retry = await buildOnce({ ...args, feeAccount: null });
    const retryError = await simulateSwap(retry.swap.swapTransaction);
    if (!retryError) {
      swap = retry.swap;
      quote = retry.quote;
      feeApplied = false;
      simError = null;
    }
  }
  if (simError) {
    const friendly = /insufficient funds for rent|insufficient lamports|insufficient funds|0x1771/i.test(simError)
      ? friendlyRpcError(simError)
      : simError;
    throw new SwapError(friendly, { status: 422, code: 'SIMULATION_FAILED' });
  }
  const outputDecimals = outputMint === SOL_MINT
    ? 9
    : (await getConnection().getTokenSupply(new PublicKey(outputMint))).value.decimals;

  return {
    swapTransaction: swap.swapTransaction,
    lastValidBlockHeight: swap.lastValidBlockHeight || null,
    feeApplied,
    outputDecimals,
    quote: {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: bps,
    },
  };
}

// ── Send / confirm ───────────────────────────────────────────────────────────
/**
 * Standard Solana send pattern: rebroadcast the same signed bytes every ~2s
 * (RPCs drop txs under load) until confirmed, failed on-chain, or the
 * blockhash expires. Never reports an unconfirmed tx as a success.
 * Returns { signature, status: 'confirmed'|'failed'|'expired'|'pending', error? }.
 * Throws (SendTransactionError) if the very first broadcast is rejected.
 */
async function sendAndConfirm(raw, { lastValidBlockHeight = null, maxWaitMs = 75_000 } = {}) {
  const conn = getConnection();
  const deadline = Date.now() + maxWaitMs;

  // First broadcast keeps preflight so deterministic failures surface
  // immediately with a real reason instead of a silent on-chain drop.
  const signature = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 0 });

  let lastRebroadcast = Date.now();
  while (Date.now() < deadline) {
    await sleep(1200);
    const { value } = await conn.getSignatureStatuses([signature]);
    const status = value?.[0];
    if (status) {
      if (status.err) return { signature, status: 'failed', error: friendlyRpcError(JSON.stringify(status.err)) };
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        return { signature, status: 'confirmed' };
      }
    }
    if (lastValidBlockHeight) {
      const height = await conn.getBlockHeight('confirmed').catch(() => null);
      if (height && height > lastValidBlockHeight) {
        // One last look: the status RPC can lag the block height by a slot or two.
        const { value: late } = await conn.getSignatureStatuses([signature]);
        const s = late?.[0];
        if (s && !s.err && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) {
          return { signature, status: 'confirmed' };
        }
        if (s && !s.err) return { signature, status: 'pending' };
        if (s?.err) return { signature, status: 'failed', error: friendlyRpcError(JSON.stringify(s.err)) };
        return { signature, status: 'expired', error: 'Transaction expired before it was confirmed — nothing was executed. Try again.' };
      }
    }
    if (Date.now() - lastRebroadcast > 2000) {
      lastRebroadcast = Date.now();
      conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
    }
  }
  return { signature, status: 'pending' };
}

/** Status of a previously sent signature: { status: 'confirmed'|'pending'|'failed'|'unknown', error? }. */
async function getSignatureStatus(signature) {
  const { value } = await getConnection().getSignatureStatuses([signature], { searchTransactionHistory: true });
  const s = value?.[0];
  if (!s) return { status: 'unknown' };
  if (s.err) return { status: 'failed', error: friendlyRpcError(JSON.stringify(s.err)) };
  const confirmed = s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized';
  return { status: confirmed ? 'confirmed' : 'pending' };
}

/**
 * Sign a Jupiter swap with a server-held keypair and send it. Used only by the
 * opt-in cloud executor. Returns sendAndConfirm's result.
 */
async function signAndSendSwap(swapTransactionB64, keypair, lastValidBlockHeight) {
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransactionB64, 'base64'));
  tx.sign([keypair]);
  return sendAndConfirm(Buffer.from(tx.serialize()), { lastValidBlockHeight });
}

// ── SOL withdraw ─────────────────────────────────────────────────────────────
/**
 * Unsigned SOL transfer honouring the runtime's rent rules. `lamports` null
 * sweeps everything (leaves exactly 0). Partial withdraws must leave the
 * rent-exempt minimum; a brand-new destination must receive at least it.
 * Returns { transaction (b64 legacy), lastValidBlockHeight, lamports, feeLamports, remainingLamports }.
 */
async function buildSolWithdraw({ wallet, destination, lamports: requested = null }) {
  if (!isBase58Key(wallet) || !isBase58Key(destination)) {
    throw new SwapError('Invalid wallet or destination address', { status: 400 });
  }
  if (wallet === destination) throw new SwapError('Destination is the trading wallet itself', { status: 400 });

  const conn = getConnection();
  const walletKey = new PublicKey(wallet);
  const destKey = new PublicKey(destination);
  const [balance, rentMin, destInfo, { blockhash, lastValidBlockHeight }] = await Promise.all([
    conn.getBalance(walletKey),
    getRentMinimum(),
    conn.getAccountInfo(destKey),
    conn.getLatestBlockhash('confirmed'),
  ]);

  const buildTx = (lamports) => new Transaction({ recentBlockhash: blockhash, feePayer: walletKey })
    .add(SystemProgram.transfer({ fromPubkey: walletKey, toPubkey: destKey, lamports }));

  // Exact fee for this message (no priority fee instruction → base fee only).
  const feeLamports = (await conn.getFeeForMessage(buildTx(1).compileMessage(), 'confirmed').catch(() => ({ value: null }))).value || BASE_FEE_LAMPORTS;

  let lamports;
  if (requested == null) {
    lamports = balance - feeLamports;
  } else {
    const n = Number(requested);
    if (!Number.isInteger(n) || n <= 0) throw new SwapError('Invalid amount', { status: 400 });
    lamports = n;
    const remaining = balance - lamports - feeLamports;
    if (remaining < 0) {
      throw new SwapError(`Not enough SOL — max withdraw is ${((balance - feeLamports) / 1e9).toFixed(6)} SOL.`, { status: 400 });
    }
    // Within a hair of a full sweep: send everything instead of stranding sub-rent dust.
    if (remaining > 0 && remaining < rentMin) {
      if (remaining <= 50_000) lamports = balance - feeLamports;
      else {
        throw new SwapError(
          `That would leave ${(remaining / 1e9).toFixed(6)} SOL, below the ~${(rentMin / 1e9).toFixed(4)} SOL rent minimum. Withdraw everything or leave at least that much.`,
          { status: 400 }
        );
      }
    }
  }
  if (lamports <= 0) throw new SwapError('Nothing to withdraw', { status: 400 });
  if (!destInfo && lamports < rentMin) {
    throw new SwapError(
      `The destination wallet is empty on-chain and needs at least ${(rentMin / 1e9).toFixed(4)} SOL to be created.`,
      { status: 400 }
    );
  }

  const tx = buildTx(lamports);
  const sim = await conn.simulateTransaction(tx).catch(() => null);
  if (sim?.value?.err) {
    throw new SwapError(friendlyRpcError(`${JSON.stringify(sim.value.err)} ${(sim.value.logs || []).join(' ')}`), { status: 422 });
  }
  return {
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
    lastValidBlockHeight,
    lamports,
    feeLamports,
    remainingLamports: balance - lamports - feeLamports,
  };
}

module.exports = {
  SOL_MINT,
  MAX_PRIORITY_LAMPORTS,
  ATA_RENT_LAMPORTS,
  BASE_FEE_LAMPORTS,
  SwapError,
  getConnection,
  isBase58Key,
  friendlyRpcError,
  getRentMinimum,
  computeLimits,
  getTokenBalance,
  buildSwap,
  sendAndConfirm,
  getSignatureStatus,
  signAndSendSwap,
  buildSolWithdraw,
};
