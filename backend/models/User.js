const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  displayName: {
    type: String,
    maxlength: 32,
    default: ''
  },
  bio: {
    type: String,
    maxlength: 160,
    default: ''
  },
  profilePicture: {
    type: String, // base64 data URL or external image URL
    default: null
  },
  // First-touch influencer attribution — set once at first wallet connect, immutable.
  referredBy: {
    code: { type: String, default: null },
    at: { type: Date, default: null }
  },
  // Per-coin "Notify at" price-alert preferences, keyed by mint address.
  alerts: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Wallets this account is following for copy-trade/analytics, synced across devices.
  trackedWallets: {
    type: [{
      address: { type: String, required: true },
      label: { type: String, default: '' },
      addedAt: { type: Number, default: Date.now },
      lastViewed: { type: Number, default: Date.now },
      copyTradeEnabled: { type: Boolean, default: true }
    }],
    default: []
  },
  // Coins this account has favorited/tracked, synced across devices (minimal fields —
  // full coin data is re-fetched/enriched from the feed when displayed).
  trackedCoins: {
    type: [{
      mintAddress: { type: String, required: true },
      symbol: { type: String, default: '' },
      name: { type: String, default: '' },
      image: { type: String, default: '' },
      addedAt: { type: Number, default: Date.now },
      // USD price when tracking started, so the UI can show performance since then.
      trackedAtPrice: { type: Number, default: 0 }
    }],
    default: []
  },
  // Moonfeed transaction history (Jupiter trades performed through Moonfeed), synced across devices.
  transactions: {
    type: [{
      id: { type: String, required: true },
      signature: { type: String, required: true },
      type: { type: String, default: 'buy' },
      tokenMint: { type: String, default: '' },
      tokenSymbol: { type: String, default: '' },
      tokenName: { type: String, default: '' },
      tokenImage: { type: String, default: '' },
      inputAmount: { type: Number, default: 0 },
      outputAmount: { type: Number, default: 0 },
      inputMint: { type: String, default: '' },
      outputMint: { type: String, default: '' },
      pricePerToken: { type: Number, default: 0 },
      pricePerTokenUsd: { type: Number, default: 0 },
      timestamp: { type: Number, default: Date.now },
      createdAt: { type: String, default: '' }
    }],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
