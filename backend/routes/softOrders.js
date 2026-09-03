const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const SoftOrder = require('../models/SoftOrder');
const { getSolUsdPrice } = require('../utils/solPrice');

const MAX_ACTIVE_PER_WALLET = 30;

// Deepest-liquidity Dexscreener pair per mint (batch, 30 mints/call).
async function fetchPairInfo(mints) {
  const out = new Map(); // mint -> { priceUsd, priceNative, symbol, name, image, liq }
  for (let i = 0; i < mints.length; i += 30) {
    const chunk = mints.slice(i, i + 30);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const pair of data.pairs || []) {
        const mint = pair.baseToken?.address;
        const priceUsd = Number(pair.priceUsd);
        if (!mint || !(priceUsd > 0)) continue;
        const liq = Number(pair.liquidity?.usd) || 0;
        const prev = out.get(mint);
        if (prev && liq <= prev.liq) continue;
        out.set(mint, {
          priceUsd,
          priceNative: Number(pair.priceNative) || null,
          symbol: pair.baseToken?.symbol || null,
          name: pair.baseToken?.name || null,
          image: pair.info?.imageUrl || null,
          liq,
        });
      }
    } catch (_) { /* keep whatever we have */ }
  }
  return out;
}

// Match the normalized Jupiter V2 order shape so OrdersView cards render as-is.
function normalizeOrder(o, pair, solUsd) {
  const pairSolUsd = pair?.priceUsd && pair?.priceNative
    ? pair.priceUsd / pair.priceNative
    : (solUsd > 0 ? solUsd : 0);
  const triggerPriceSol = pairSolUsd > 0 ? o.triggerPriceUsd / pairSolUsd : 0;
  const currentPriceUsd = pair?.priceUsd || null;
  const currentPriceSol = pair?.priceNative
    || (currentPriceUsd && pairSolUsd > 0 ? currentPriceUsd / pairSolUsd : triggerPriceSol);

  const isBuy = o.side === 'buy';
  const amount = isBuy
    ? (triggerPriceSol > 0 && o.amountSol ? o.amountSol / triggerPriceSol : 0)
    : (o.amountTokens || 0);
  const estimatedValue = isBuy ? (o.amountSol || 0) : (o.amountTokens || 0) * triggerPriceSol;

  const expiresAtISO = o.expiresAt ? new Date(o.expiresAt).toISOString() : null;
  return {
    id: String(o._id),
    orderId: String(o._id),
    source: 'soft',
    tokenSymbol: o.tokenSymbol || pair?.symbol || null,
    tokenName: o.tokenName || pair?.name || null,
    tokenMint: o.mint,
    tokenImage: o.tokenImage || pair?.image || null,
    type: o.side,
    status: o.status,
    triggerCondition: o.triggerCondition,
    triggerPriceUsd: o.triggerPriceUsd,
    triggerPrice: triggerPriceSol,
    currentPrice: currentPriceSol,
    currentPriceUsd,
    amount,
    estimatedValue,
    amountSol: o.amountSol,
    amountTokens: o.amountTokens,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    expiresAt: expiresAtISO,
    expiredAt: expiresAtISO,
    triggeredAt: o.triggeredAt ? new Date(o.triggeredAt).toISOString() : null,
    triggeredPriceUsd: o.triggeredPriceUsd || null,
  };
}

// POST /api/soft-orders — create an order alert.
router.post('/', async (req, res) => {
  try {
    const {
      walletAddress, mint, tokenSymbol, tokenName, tokenImage,
      side, triggerPriceUsd, currentPriceUsd, amountSol, amountTokens, expiresAt,
    } = req.body || {};

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return res.status(400).json({ success: false, error: 'Invalid walletAddress' });
    }
    if (!mint || typeof mint !== 'string' || mint.length < 32) {
      return res.status(400).json({ success: false, error: 'Invalid mint' });
    }
    if (side !== 'buy' && side !== 'sell') {
      return res.status(400).json({ success: false, error: 'side must be buy or sell' });
    }
    const trigger = Number(triggerPriceUsd);
    if (!(trigger > 0)) {
      return res.status(400).json({ success: false, error: 'Invalid triggerPriceUsd' });
    }
    const sol = Number(amountSol);
    const tokens = Number(amountTokens);
    if (side === 'buy' && !(sol > 0)) {
      return res.status(400).json({ success: false, error: 'Buy orders need amountSol' });
    }
    if (side === 'sell' && !(tokens > 0)) {
      return res.status(400).json({ success: false, error: 'Sell orders need amountTokens' });
    }

    const activeCount = await SoftOrder.countDocuments({ walletAddress, status: 'active' });
    if (activeCount >= MAX_ACTIVE_PER_WALLET) {
      return res.status(429).json({ success: false, error: `Max ${MAX_ACTIVE_PER_WALLET} active orders — cancel some first` });
    }

    const current = Number(currentPriceUsd) > 0 ? Number(currentPriceUsd) : null;
    const triggerCondition = current ? (trigger < current ? 'below' : 'above') : (side === 'buy' ? 'below' : 'above');

    const order = await SoftOrder.create({
      walletAddress,
      mint,
      tokenSymbol: tokenSymbol || null,
      tokenName: tokenName || null,
      tokenImage: tokenImage || null,
      side,
      triggerCondition,
      triggerPriceUsd: trigger,
      createdPriceUsd: current,
      amountSol: side === 'buy' ? sol : null,
      amountTokens: side === 'sell' ? tokens : null,
      expiresAt: Number(expiresAt) > Date.now() ? new Date(Number(expiresAt)) : null,
    });

    res.json({ success: true, order: normalizeOrder(order.toObject(), null, 0) });
  } catch (err) {
    console.error('❌ soft-order create error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/soft-orders?wallet=...&status=active|past — list, normalized for the orders UI.
router.get('/', async (req, res) => {
  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ success: false, error: 'Missing wallet' });
    const status = req.query.status === 'past'
      ? { $in: ['triggered', 'cancelled', 'expired'] }
      : 'active';

    const orders = await SoftOrder.find({ walletAddress: wallet, status })
      .sort({ createdAt: -1 }).limit(100).lean();
    if (!orders.length) return res.json({ success: true, orders: [] });

    const [pairs, solUsd] = await Promise.all([
      fetchPairInfo([...new Set(orders.map((o) => o.mint))]),
      getSolUsdPrice().catch(() => 0),
    ]);
    res.json({ success: true, orders: orders.map((o) => normalizeOrder(o, pairs.get(o.mint), solUsd)) });
  } catch (err) {
    console.error('❌ soft-order list error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/soft-orders/:id/cancel — body: { walletAddress }
router.post('/:id/cancel', async (req, res) => {
  try {
    const { walletAddress } = req.body || {};
    if (!walletAddress) return res.status(400).json({ success: false, error: 'Missing walletAddress' });
    const order = await SoftOrder.findOneAndUpdate(
      { _id: req.params.id, walletAddress, status: 'active' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ soft-order cancel error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
