/**
 * POST /api/webhook/helius — receives Helius enhanced-webhook deliveries
 * (1 credit per event) for tracked wallets' SWAP transactions.
 *
 * Each event: feeds the copy-trade swap cache (so frontend polls stop hitting
 * the Enhanced API) and fires the wallet-trade push to followers.
 */
const express = require('express');
const router = express.Router();

const heliusWebhookService = require('../services/heliusWebhookService');
const pushMonitors = require('../services/pushMonitors');
const copyTradeRoutes = require('./copyTrade');

router.post('/', async (req, res) => {
  if (!heliusWebhookService.isConfigured()) {
    return res.status(404).json({ success: false });
  }
  const secret = heliusWebhookService.getSecret();
  if ((req.headers.authorization || '') !== secret) {
    return res.status(401).json({ success: false });
  }

  const events = Array.isArray(req.body) ? req.body : [req.body];
  const tracked = heliusWebhookService.getTrackedSet();
  let handled = 0;

  for (const tx of events) {
    if (!tx || !tx.signature) continue;
    // The tracked wallet is the swap's fee payer; fall back to any tracked
    // address present in the tx's account list.
    let wallet = tracked.has(tx.feePayer) ? tx.feePayer : null;
    if (!wallet && Array.isArray(tx.accountData)) {
      wallet = tx.accountData.map((a) => a.account).find((a) => tracked.has(a)) || null;
    }
    if (!wallet) continue;
    handled++;

    try { copyTradeRoutes.ingestWebhookTx(wallet, tx); } catch (_) { /* cache only */ }
    // Pushes can be slow (FCM); don't block the webhook response on them.
    pushMonitors
      .handleWebhookSwap(wallet, tx)
      .catch((e) => console.error('[webhook] push error:', e.message));
  }

  res.json({ success: true, handled });
});

module.exports = router;
