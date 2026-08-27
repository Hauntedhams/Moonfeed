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
      addedAt: { type: Number, default: Date.now }
    }],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
