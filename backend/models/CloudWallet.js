const mongoose = require('mongoose');

// Opt-in "cloud execution" for the in-app trading wallet: the user explicitly
// uploads their trading-wallet key so the server can execute take-profit /
// stop-loss sells while the app is closed. The secret is stored only as
// AES-256-GCM ciphertext (see services/keyVault.js); decrypted in memory for
// the duration of a single swap and zeroed afterwards.
const cloudWalletSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, index: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  keyVersion: { type: Number, default: 1 },
  // Execution preferences mirrored from the device presets at enroll time.
  slippageBps: { type: Number, default: 500 },
  enrolledAt: { type: Date, default: Date.now },
  lastExecutionAt: { type: Date, default: null },
  executionCount: { type: Number, default: 0 },
  // Consecutive failures — after too many we stop trying and alert instead.
  failureStreak: { type: Number, default: 0 },
});

module.exports = mongoose.model('CloudWallet', cloudWalletSchema);
