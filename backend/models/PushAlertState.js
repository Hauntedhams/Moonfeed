const mongoose = require('mongoose');

// Remembers which price alerts we've already pushed, so a coin sitting at the
// threshold doesn't re-notify every poll. Re-armed by the monitor when the coin
// crosses back past the reset band.
const pushAlertStateSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  mint: { type: String, required: true },
  type: { type: String, required: true }, // 'trackedGain' | 'holdingCrash'
  armed: { type: Boolean, default: false }, // true = already notified, waiting to reset
  lastValue: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

pushAlertStateSchema.index({ walletAddress: 1, mint: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('PushAlertState', pushAlertStateSchema);
