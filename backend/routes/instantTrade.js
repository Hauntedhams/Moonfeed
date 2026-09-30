// Instant-trade execution for the in-app trading wallet.
// The frontend holds a device-local keypair; this route builds swaps through
// Jupiter's Swap API (explicit slippage control + integrator referral fee) and
// broadcasts the client-signed transaction through Helius RPC. No keys ever
// touch the server.
const express = require('express');
const { Connection, PublicKey, VersionedTransaction } = require('@solana/web3.js');
const { HELIUS_RPC_URL } = require('../solanaRpcConfig');

const router = express.Router();

const QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote';
const SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap';
const REFERRAL_PROGRAM_ID = 'REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3';
const REFERRAL_ACCOUNT = process.env.JUPITER_REFERRAL_ACCOUNT;
const FEE_BPS = parseInt(process.env.JUPITER_REFERRAL_FEE_BPS) || 100;
const MAX_PRIORITY_LAMPORTS = 2_000_000; // 0.002 SOL cap on priority fees

let connection = null;
const getConnection = () => {
  if (!connection) connection = new Connection(HELIUS_RPC_URL, 'confirmed');
  return connection;
};

const isBase58Key = (value) => {
  try { new PublicKey(value); return true; } catch { return false; }
};

// Same graceful pattern as jupiterTriggerService.resolveTriggerFeeAccount:
// only attach the fee when the referral token account actually exists on-chain.
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
        [
          Buffer.from('referral_ata'),
          new PublicKey(REFERRAL_ACCOUNT).toBuffer(),
          new PublicKey(mint).toBuffer(),
        ],
        new PublicKey(REFERRAL_PROGRAM_ID)
      );
      const info = await getConnection().getAccountInfo(ata);
      const value = info ? ata.toBase58() : null;
      feeAccountCache.set(mint, value);
      if (value) return value;
    } catch (error) {
      console.warn('[instant-trade] feeAccount lookup failed for', mint, error.message);
      return null;
    }
  }
  return null;
}

/**
 * POST /api/instant-trade/build
 * { inputMint, outputMint, amountRaw, slippageBps?, wallet }
 * Returns an unsigned base64 swap transaction + quote summary.
 */
async function buildOnce({ inputMint, outputMint, amount, slippageBps, wallet, feeAccount }) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: String(slippageBps),
    swapMode: 'ExactIn',
  });
  if (feeAccount) params.set('platformFeeBps', String(FEE_BPS));

  const quoteRes = await fetch(`${QUOTE_URL}?${params}`);
  const quote = await quoteRes.json().catch(() => ({}));
  if (!quoteRes.ok || quote.error) {
    const err = new Error(quote.error || `Quote failed (${quoteRes.status})`);
    err.status = 502;
    throw err;
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

  const swapRes = await fetch(SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapBody),
  });
  const swap = await swapRes.json().catch(() => ({}));
  if (!swapRes.ok || !swap.swapTransaction) {
    const err = new Error(swap.error || `Swap build failed (${swapRes.status})`);
    err.status = 502;
    throw err;
  }
  return { swap, quote };
}

// Simulates the unsigned transaction with real account state. Returns null when
// clean, else a message that keeps the "custom program error: 0x..." form so the
// frontend's friendly-error mapping works on it.
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
    console.warn('[instant-trade] simulation errored, letting preflight decide:', error.message);
    return null; // fail-open: /send still runs preflight
  }
}

router.post('/build', async (req, res) => {
  try {
    const { inputMint, outputMint, amountRaw, wallet } = req.body || {};
    const slippageBps = Math.min(3000, Math.max(10, parseInt(req.body?.slippageBps) || 300));

    if (!isBase58Key(inputMint) || !isBase58Key(outputMint) || !isBase58Key(wallet)) {
      return res.status(400).json({ success: false, error: 'Invalid mint or wallet address' });
    }
    const amount = BigInt(String(amountRaw || 0));
    if (amount <= 0n) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const feeAccount = await resolveFeeAccount(inputMint, outputMint);
    const args = { inputMint, outputMint, amount, slippageBps, wallet };

    let { swap, quote } = await buildOnce({ ...args, feeAccount });
    let feeApplied = Boolean(feeAccount);
    let simError = await simulateSwap(swap.swapTransaction);

    // Some routes reject the fee account (e.g. quote takes the fee on a
    // Token-2022 side → IncorrectTokenProgramID 0x177e). Never block the trade
    // on fee plumbing: rebuild without the fee and re-check.
    if (simError && feeApplied) {
      console.warn(`[instant-trade] sim failed with fee (${simError.slice(0, 120)}) — retrying without fee`);
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
      return res.status(422).json({ success: false, error: simError });
    }

    res.json({
      success: true,
      swapTransaction: swap.swapTransaction,
      lastValidBlockHeight: swap.lastValidBlockHeight || null,
      feeApplied,
      quote: {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        priceImpactPct: quote.priceImpactPct,
        slippageBps,
      },
    });
  } catch (error) {
    console.error('[instant-trade] build error:', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Failed to build swap' });
  }
});

/**
 * POST /api/instant-trade/send
 * { signedTransaction } (base64) — broadcasts and polls for confirmation.
 */
router.post('/send', async (req, res) => {
  try {
    const { signedTransaction } = req.body || {};
    if (!signedTransaction || typeof signedTransaction !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing signedTransaction' });
    }
    const raw = Buffer.from(signedTransaction, 'base64');
    if (!raw.length || raw.length > 1644) {
      return res.status(400).json({ success: false, error: 'Invalid transaction size' });
    }

    const conn = getConnection();
    const signature = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });

    let confirmed = false;
    let txErr = null;
    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, 1400));
      const { value } = await conn.getSignatureStatuses([signature]);
      const status = value?.[0];
      if (status) {
        if (status.err) { txErr = JSON.stringify(status.err); break; }
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }
      }
    }

    res.json({ success: !txErr, signature, confirmed, error: txErr });
  } catch (error) {
    console.error('[instant-trade] send error:', error.message);
    const msg = /simulation failed|insufficient/i.test(error.message)
      ? error.message.slice(0, 300)
      : 'Failed to send transaction';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/instant-trade/blockhash — for client-built transfers (withdraw).
 */
router.get('/blockhash', async (req, res) => {
  try {
    const { blockhash, lastValidBlockHeight } = await getConnection().getLatestBlockhash('confirmed');
    res.json({ success: true, blockhash, lastValidBlockHeight });
  } catch (error) {
    console.error('[instant-trade] blockhash error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch blockhash' });
  }
});

module.exports = router;
