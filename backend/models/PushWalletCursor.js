const mongoose = require('mongoose');

// Global per-wallet cursor for server-side wallet-trade push. Tracks the newest
// swap we've already pushed for a tracked wallet, so a trade is announced once
// (to everyone tracking it) and never re-announced. Seeded silently on first sight.
const pushWalletCursorSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, index: true },
  lastTimestamp: { type: Number, default: 0 }, // unix seconds of newest seen swap
  lastSignature: { type: String, default: null },
  // Newest tx signature of ANY kind seen on this wallet (1-credit
  // getSignaturesForAddress pre-check). Unchanged sig = skip the 100-credit
  // Enhanced API fetch for the cycle.
  lastSeenSignature: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PushWalletCursor', pushWalletCursorSchema);
