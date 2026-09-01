const mongoose = require('mongoose');

// One row per device push token. A wallet can have several (phone + tablet, etc.);
// a token is globally unique and re-registered (upsert) on every app launch.
const deviceTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  walletAddress: { type: String, default: null, index: true },
  platform: { type: String, enum: ['ios', 'android', 'web'], default: 'ios' },
  // Per-device opt-outs so the user can silence categories without unregistering.
  prefs: {
    trackedGain: { type: Boolean, default: true },
    holdingCrash: { type: Boolean, default: true },
    walletTrade: { type: Boolean, default: true },
    orderFill: { type: Boolean, default: true },
  },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
