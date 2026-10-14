// Instant-trade HTTP surface for the in-app trading wallet.
// Default (non-custodial) path: the frontend holds the keypair, this route
// builds unsigned Jupiter swaps / transfers and broadcasts client-signed bytes.
// All Jupiter + RPC logic lives in services/instantSwapService so the opt-in
// cloud executor shares the exact same fee, simulation and confirm behaviour.
const express = require('express');
const { PublicKey } = require('@solana/web3.js');
const swapService = require('../services/instantSwapService');

const router = express.Router();
const { getConnection, isBase58Key, friendlyRpcError, SwapError } = swapService;

function sendError(res, error, fallback) {
  if (error instanceof SwapError) {
    const body = { success: false, error: error.message };
    if (error.code) body.code = error.code;
    if (error.maxBuyLamports != null) body.maxBuyLamports = error.maxBuyLamports;
    return res.status(error.status || 500).json(body);
  }
  console.error(`[instant-trade] ${fallback}:`, error.message);
  return res.status(500).json({ success: false, error: fallback });
}

/**
 * POST /api/instant-trade/build
 * { inputMint, outputMint, amountRaw, slippageBps?, wallet }
 * Returns an unsigned base64 swap transaction + quote summary.
 */
router.post('/build', async (req, res) => {
  try {
    const { inputMint, outputMint, amountRaw, slippageBps, wallet } = req.body || {};
    const built = await swapService.buildSwap({ inputMint, outputMint, amount: amountRaw, slippageBps, wallet });
    res.json({ success: true, ...built });
  } catch (error) {
    sendError(res, error, 'Failed to build swap');
  }
});

/**
 * POST /api/instant-trade/send
 * { signedTransaction (base64), lastValidBlockHeight? }
 * Broadcasts with rebroadcast + confirmation. Response:
 *   { success, signature, confirmed, status: 'confirmed'|'failed'|'expired'|'pending', error }
 * 'pending' means we stopped waiting but the tx may still land — poll /status/:signature.
 */
router.post('/send', async (req, res) => {
  try {
    const { signedTransaction, lastValidBlockHeight } = req.body || {};
    if (!signedTransaction || typeof signedTransaction !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing signedTransaction' });
    }
    const raw = Buffer.from(signedTransaction, 'base64');
    if (!raw.length || raw.length > 1644) {
      return res.status(400).json({ success: false, error: 'Invalid transaction size' });
    }
    const lvbh = Number.isFinite(Number(lastValidBlockHeight)) ? Number(lastValidBlockHeight) : null;

    const result = await swapService.sendAndConfirm(raw, { lastValidBlockHeight: lvbh, maxWaitMs: 75_000 });
    res.json({
      success: result.status === 'confirmed' || result.status === 'pending',
      signature: result.signature,
      confirmed: result.status === 'confirmed',
      status: result.status,
      error: result.error || null,
    });
  } catch (error) {
    const logs = typeof error?.getLogs === 'function' ? await error.getLogs(getConnection()).catch(() => null) : error?.logs;
    console.error('[instant-trade] send error:', error.message, Array.isArray(logs) ? logs.slice(-3) : '');
    res.status(500).json({ success: false, status: 'rejected', error: friendlyRpcError(error.message) });
  }
});

/**
 * GET /api/instant-trade/status/:signature — follow-up for 'pending' sends.
 */
router.get('/status/:signature', async (req, res) => {
  try {
    const { signature } = req.params;
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) {
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }
    const s = await swapService.getSignatureStatus(signature);
    res.json({ success: true, status: s.status, confirmed: s.status === 'confirmed', error: s.error || null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
});

/**
 * GET /api/instant-trade/limits/:wallet?mint=
 * Exact numbers the client needs to size a trade safely (balance, rent the
 * wallet must keep, per-swap overhead, max buy). Replaces guessed constants.
 */
router.get('/limits/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { mint } = req.query;
    if (!isBase58Key(wallet) || (mint && !isBase58Key(mint))) {
      return res.status(400).json({ success: false, error: 'Invalid wallet or mint' });
    }
    res.json({ success: true, ...(await swapService.computeLimits(wallet, mint || null)) });
  } catch (error) {
    sendError(res, error, 'Failed to compute limits');
  }
});

/**
 * POST /api/instant-trade/build-withdraw-sol
 * { wallet, destination, lamports? } — unsigned SOL transfer. Omit lamports to
 * sweep the whole balance. Rent rules enforced + simulated server-side.
 */
router.post('/build-withdraw-sol', async (req, res) => {
  try {
    const { wallet, destination, lamports } = req.body || {};
    const built = await swapService.buildSolWithdraw({ wallet, destination, lamports: lamports == null ? null : Number(lamports) });
    res.json({ success: true, ...built });
  } catch (error) {
    sendError(res, error, 'Failed to build SOL withdrawal');
  }
});

router.get('/blockhash', async (req, res) => {
  try {
    const { blockhash, lastValidBlockHeight } = await getConnection().getLatestBlockhash('confirmed');
    res.json({ success: true, blockhash, lastValidBlockHeight });
  } catch (error) {
    console.error('[instant-trade] blockhash error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch blockhash' });
  }
});

/**
 * GET /api/instant-trade/tokens/:owner
 * Every positive SPL / Token-2022 balance the trading wallet holds, with the
 * on-chain raw amount + decimals (so clients never have to guess decimals).
 */
router.get('/tokens/:owner', async (req, res) => {
  try {
    const { owner } = req.params;
    if (!isBase58Key(owner)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address' });
    }
    const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');
    const conn = getConnection();
    const ownerKey = new PublicKey(owner);
    const [classic, t22] = await Promise.all([
      conn.getParsedTokenAccountsByOwner(ownerKey, { programId: TOKEN_PROGRAM_ID }),
      conn.getParsedTokenAccountsByOwner(ownerKey, { programId: TOKEN_2022_PROGRAM_ID }),
    ]);
    const byMint = new Map();
    for (const { account } of [...classic.value, ...t22.value]) {
      const info = account.data.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      if (!info?.mint || !tokenAmount || !(Number(tokenAmount.uiAmount) > 0)) continue;
      const existing = byMint.get(info.mint) || {
        mint: info.mint,
        amount: 0,
        amountRaw: 0n,
        decimals: tokenAmount.decimals,
        tokenProgram: account.owner.toBase58(),
      };
      existing.amount += Number(tokenAmount.uiAmountString ?? tokenAmount.uiAmount) || 0;
      try { existing.amountRaw += BigInt(tokenAmount.amount || '0'); } catch (_) { /* non-numeric */ }
      byMint.set(info.mint, existing);
    }
    res.json({
      success: true,
      owner,
      tokens: Array.from(byMint.values()).map((t) => ({ ...t, amountRaw: t.amountRaw.toString() })),
    });
  } catch (error) {
    console.error('[instant-trade] tokens error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch token balances' });
  }
});

/**
 * POST /api/instant-trade/build-withdraw-token
 * { wallet, mint, destination } — unsigned transfer of the wallet's FULL
 * balance of one token to the destination (dest ATA created idempotently).
 * Client signs locally; keys never touch the server.
 */
router.post('/build-withdraw-token', async (req, res) => {
  try {
    const { wallet, mint, destination } = req.body || {};
    if (!isBase58Key(wallet) || !isBase58Key(mint) || !isBase58Key(destination)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet, mint or destination address' });
    }
    const {
      TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
      createTransferCheckedInstruction,
    } = require('@solana/spl-token');
    const { Transaction } = require('@solana/web3.js');

    const conn = getConnection();
    const walletKey = new PublicKey(wallet);
    const mintKey = new PublicKey(mint);
    const destKey = new PublicKey(destination);

    const accounts = await conn.getParsedTokenAccountsByOwner(walletKey, { mint: mintKey });
    const sources = accounts.value
      .map(({ pubkey, account }) => {
        const tokenAmount = account.data.parsed?.info?.tokenAmount;
        let raw = 0n;
        try { raw = BigInt(tokenAmount?.amount || '0'); } catch (_) { /* non-numeric */ }
        return { pubkey, raw, decimals: tokenAmount?.decimals ?? 0, programId: account.owner };
      })
      .filter((s) => s.raw > 0n);
    if (!sources.length) {
      return res.status(400).json({ success: false, error: 'No balance of this token to withdraw' });
    }

    const programId = sources[0].programId;
    const tokenProgramId = programId.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const decimals = sources[0].decimals;
    const destAta = getAssociatedTokenAddressSync(mintKey, destKey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);

    const tx = new Transaction();
    tx.add(createAssociatedTokenAccountIdempotentInstruction(walletKey, destAta, destKey, mintKey, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID));
    let totalRaw = 0n;
    for (const source of sources) {
      tx.add(createTransferCheckedInstruction(source.pubkey, mintKey, destAta, walletKey, source.raw, decimals, [], tokenProgramId));
      totalRaw += source.raw;
    }
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = walletKey;

    res.json({
      success: true,
      transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
      lastValidBlockHeight,
      amountRaw: totalRaw.toString(),
      decimals,
      amount: Number(totalRaw) / 10 ** decimals,
    });
  } catch (error) {
    console.error('[instant-trade] build-withdraw-token error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to build token withdrawal' });
  }
});

module.exports = router;
