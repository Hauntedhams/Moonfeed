// Opt-in cloud execution for the in-app trading wallet.
// A user who wants take-profit / stop-loss to fire while the app is closed
// explicitly uploads the trading-wallet key. It is stored only as AES-GCM
// ciphertext (services/keyVault.js) and used by services/cloudExecutor.js.
// Mutating calls other than enroll must be signed by the wallet itself.
const express = require('express');
const { Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const CloudWallet = require('../models/CloudWallet');
const SoftOrder = require('../models/SoftOrder');
const keyVault = require('../services/keyVault');

const router = express.Router();
const b58 = bs58.default || bs58;

const AUTH_WINDOW_MS = 5 * 60 * 1000;

const isBase58Key = (value) => {
  try { new PublicKey(value); return true; } catch { return false; }
};

/** Expected message the client signs for `action` — kept in sync with frontend/src/utils/cloudExecution.js */
function authMessage(action, wallet, timestamp) {
  return `moonfeed:cloud-exec:${action}:${wallet}:${timestamp}`;
}

function verifySigned(req, action) {
  const { wallet, timestamp, signature } = req.body || {};
  if (!isBase58Key(wallet)) return 'Invalid wallet';
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > AUTH_WINDOW_MS) return 'Request expired — try again';
  try {
    const ok = nacl.sign.detached.verify(
      Buffer.from(authMessage(action, wallet, ts), 'utf8'),
      b58.decode(String(signature || '')),
      new PublicKey(wallet).toBytes()
    );
    return ok ? null : 'Bad signature';
  } catch {
    return 'Bad signature';
  }
}

function publicStatus(row) {
  return {
    configured: keyVault.isConfigured(),
    enrolled: Boolean(row),
    enrolledAt: row?.enrolledAt || null,
    lastExecutionAt: row?.lastExecutionAt || null,
    executionCount: row?.executionCount || 0,
    slippageBps: row?.slippageBps ?? null,
    failureStreak: row?.failureStreak || 0,
  };
}

/** GET /api/cloud-exec/status/:wallet */
router.get('/status/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!isBase58Key(wallet)) return res.status(400).json({ success: false, error: 'Invalid wallet' });
    const row = await CloudWallet.findOne({ walletAddress: wallet }).lean();
    res.json({ success: true, ...publicStatus(row) });
  } catch (error) {
    console.error('[cloud-exec] status error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/cloud-exec/enroll
 * { wallet, secretKey (base58, 64 bytes), slippageBps? }
 * Possession of the secret is the proof of ownership. Idempotent (re-enroll
 * replaces the ciphertext — used after key rotation or to update settings).
 */
router.post('/enroll', async (req, res) => {
  let secret = null;
  try {
    if (!keyVault.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Cloud execution is not enabled on this server' });
    }
    const { wallet, secretKey, slippageBps } = req.body || {};
    if (!isBase58Key(wallet)) return res.status(400).json({ success: false, error: 'Invalid wallet' });
    try {
      secret = Buffer.from(b58.decode(String(secretKey || '')));
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid secret key' });
    }
    if (secret.length !== 64) return res.status(400).json({ success: false, error: 'Invalid secret key' });
    const kp = Keypair.fromSecretKey(secret);
    if (kp.publicKey.toBase58() !== wallet) {
      return res.status(400).json({ success: false, error: 'Secret key does not match wallet' });
    }

    const enc = keyVault.encrypt(secret, wallet);
    const bps = Math.min(3000, Math.max(50, parseInt(slippageBps) || 500));
    const row = await CloudWallet.findOneAndUpdate(
      { walletAddress: wallet },
      { $set: { ...enc, slippageBps: bps, failureStreak: 0 }, $setOnInsert: { enrolledAt: new Date() } },
      { upsert: true, new: true }
    ).lean();
    console.log(`[cloud-exec] enrolled ${wallet.slice(0, 4)}…${wallet.slice(-4)}`);
    res.json({ success: true, ...publicStatus(row) });
  } catch (error) {
    console.error('[cloud-exec] enroll error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    if (secret) secret.fill(0);
  }
});

/**
 * POST /api/cloud-exec/disenroll
 * { wallet, timestamp, signature } — signed "moonfeed:cloud-exec:disenroll:<wallet>:<ts>".
 * Deletes the ciphertext; the server can no longer act for this wallet.
 */
router.post('/disenroll', async (req, res) => {
  try {
    const authError = verifySigned(req, 'disenroll');
    if (authError) return res.status(401).json({ success: false, error: authError });
    const { wallet } = req.body;
    const { deletedCount } = await CloudWallet.deleteOne({ walletAddress: wallet });
    console.log(`[cloud-exec] disenrolled ${wallet.slice(0, 4)}…${wallet.slice(-4)} (${deletedCount} row)`);
    res.json({ success: true, ...publicStatus(null) });
  } catch (error) {
    console.error('[cloud-exec] disenroll error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/cloud-exec/settings
 * { wallet, timestamp, signature, slippageBps } — signed "…:settings:<wallet>:<ts>".
 */
router.post('/settings', async (req, res) => {
  try {
    const authError = verifySigned(req, 'settings');
    if (authError) return res.status(401).json({ success: false, error: authError });
    const { wallet, slippageBps } = req.body;
    const bps = Math.min(3000, Math.max(50, parseInt(slippageBps) || 500));
    const row = await CloudWallet.findOneAndUpdate(
      { walletAddress: wallet },
      { $set: { slippageBps: bps } },
      { new: true }
    ).lean();
    if (!row) return res.status(404).json({ success: false, error: 'Not enrolled' });
    res.json({ success: true, ...publicStatus(row) });
  } catch (error) {
    console.error('[cloud-exec] settings error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * GET /api/cloud-exec/executions/:wallet — recent cloud/device executions for the history UI.
 */
router.get('/executions/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!isBase58Key(wallet)) return res.status(400).json({ success: false, error: 'Invalid wallet' });
    const rows = await SoftOrder.find({ walletAddress: wallet, executionStatus: { $ne: null } })
      .sort({ executedAt: -1, triggeredAt: -1 }).limit(50).lean();
    res.json({
      success: true,
      executions: rows.map((o) => ({
        orderId: String(o._id),
        mint: o.mint,
        tokenSymbol: o.tokenSymbol,
        side: o.side,
        kind: o.side === 'buy' ? 'buyTarget' : (o.triggerCondition === 'below' ? 'stopLoss' : 'takeProfit'),
        triggerPriceUsd: o.triggerPriceUsd,
        triggeredPriceUsd: o.triggeredPriceUsd,
        triggeredAt: o.triggeredAt,
        executionStatus: o.executionStatus,
        executedBy: o.executedBy,
        executionSignature: o.executionSignature,
        executionError: o.executionError,
        executedAt: o.executedAt,
        solAmount: o.executionSolAmount,
        tokenAmount: o.executionTokenAmount,
      })),
    });
  } catch (error) {
    console.error('[cloud-exec] executions error:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
