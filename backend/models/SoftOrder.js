const mongoose = require('mongoose');

// "Soft" limit orders — server-monitored price alerts that fire a push
// notification deep-linking into a prefilled instant swap. No escrow, no
// wallet signing at creation, so they work with every wallet (unlike Jupiter
// Trigger V2 deposits, which Phantom/Solflare break by injecting Lighthouse).
const softOrderSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  mint: { type: String, required: true },
  clientOrderId: { type: String },
  tokenSymbol: { type: String, default: null },
  tokenName: { type: String, default: null },
  tokenImage: { type: String, default: null },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  triggerCondition: { type: String, enum: ['above', 'below'], required: true },
  triggerPriceUsd: { type: Number, required: true },
  createdPriceUsd: { type: Number, default: null },
  amountSol: { type: Number, default: null },      // buys: SOL to spend
  amountTokens: { type: Number, default: null },   // sells: tokens to sell
  status: {
    type: String,
    enum: ['active', 'triggered', 'cancelled', 'expired'],
    default: 'active',
    index: true,
  },
  triggeredAt: { type: Date, default: null },
  triggeredPriceUsd: { type: Number, default: null },
  // Set when something actually traded on this trigger (cloud executor or the
  // device while the app was open). Null = alert-only trigger.
  executionStatus: { type: String, enum: [null, 'executing', 'executed', 'failed'], default: null },
  executedBy: { type: String, enum: [null, 'cloud', 'device'], default: null },
  executionSignature: { type: String, default: null },
  executionError: { type: String, default: null },
  executedAt: { type: Date, default: null },
  executionSolAmount: { type: Number, default: null },   // SOL received (sell) / spent (buy)
  executionTokenAmount: { type: Number, default: null },  // tokens sold (sell) / received (buy)
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

softOrderSchema.index({ status: 1, mint: 1 });
softOrderSchema.index({ walletAddress: 1, status: 1 });
softOrderSchema.index(
  { walletAddress: 1, clientOrderId: 1 },
  { unique: true, partialFilterExpression: { clientOrderId: { $type: 'string' } } }
);

module.exports = mongoose.model('SoftOrder', softOrderSchema);
