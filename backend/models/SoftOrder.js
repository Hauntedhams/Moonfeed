const mongoose = require('mongoose');

// "Soft" limit orders — server-monitored price alerts that fire a push
// notification deep-linking into a prefilled instant swap. No escrow, no
// wallet signing at creation, so they work with every wallet (unlike Jupiter
// Trigger V2 deposits, which Phantom/Solflare break by injecting Lighthouse).
const softOrderSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  mint: { type: String, required: true },
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
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

softOrderSchema.index({ status: 1, mint: 1 });
softOrderSchema.index({ walletAddress: 1, status: 1 });

module.exports = mongoose.model('SoftOrder', softOrderSchema);
