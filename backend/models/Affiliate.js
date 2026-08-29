const mongoose = require('mongoose');

const affiliateSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  walletAddress: { type: String, required: true },
  // Percent of the GROSS integrator fee shared with the influencer.
  // With a 1% swap fee, 25 => influencer earns 0.25% of trade volume.
  sharePercentage: { type: Number, default: 25 },
  email: { type: String, default: null },
  telegram: { type: String, default: null },
  totalEarned: { type: Number, default: 0 },
  totalVolume: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  // USD equivalents, valued at each trade's own SOL/USD rate (not re-priced later)
  totalEarnedUsd: { type: Number, default: 0 },
  totalVolumeUsd: { type: Number, default: 0 },
  status: { type: String, default: 'active' }
}, { timestamps: true });

const affiliateTradeSchema = new mongoose.Schema({
  tradeId: { type: String, required: true, unique: true },
  referralCode: { type: String, required: true, index: true },
  influencerWallet: { type: String, default: null },
  influencerName: { type: String, default: null },
  userWallet: { type: String, index: true },
  // All amounts below are denominated in SOL (the fee currency Jupiter pays out in).
  tradeVolume: { type: Number, required: true },
  feeEarned: { type: Number, required: true },
  jupiterCut: { type: Number, default: 0 },
  netFee: { type: Number, default: 0 },
  influencerShare: { type: Number, default: 0 },
  platformShare: { type: Number, default: 0 },
  // USD equivalents, computed once from the SOL/USD rate at the moment of the trade
  solUsdPriceAtTrade: { type: Number, default: 0 },
  tradeVolumeUsd: { type: Number, default: 0 },
  feeEarnedUsd: { type: Number, default: 0 },
  influencerShareUsd: { type: Number, default: 0 },
  platformShareUsd: { type: Number, default: 0 },
  tokenIn: { type: String, default: null },
  tokenOut: { type: String, default: null },
  transactionSignature: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  payoutStatus: { type: String, default: 'pending', index: true },
  payoutId: { type: String, default: null },
  paidAt: { type: Date, default: null },
  timestamp: { type: Date, default: Date.now }
});

// One ledger entry per on-chain swap — prevents double-counting volume.
affiliateTradeSchema.index(
  { transactionSignature: 1 },
  { unique: true, partialFilterExpression: { transactionSignature: { $type: 'string' } } }
);

const affiliatePayoutSchema = new mongoose.Schema({
  payoutId: { type: String, required: true, unique: true },
  referralCode: { type: String, required: true, index: true },
  influencerWallet: { type: String, default: null },
  influencerName: { type: String, default: null },
  amount: { type: Number, required: true },
  amountUsd: { type: Number, default: 0 },
  tradeIds: { type: [String], default: [] },
  tradeCount: { type: Number, default: 0 },
  transactionSignature: { type: String, default: null },
  notes: { type: String, default: null },
  status: { type: String, default: 'pending' },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = {
  Affiliate: mongoose.model('Affiliate', affiliateSchema),
  AffiliateTrade: mongoose.model('AffiliateTrade', affiliateTradeSchema),
  AffiliatePayout: mongoose.model('AffiliatePayout', affiliatePayoutSchema)
};
