const mongoose = require('mongoose');

const xNewsAlertSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true, index: true },
  topic: { type: String, required: true },
  headline: { type: String, required: true },
  eventId: { type: String, default: null },
  mint: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
  expireAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('XNewsAlert', xNewsAlertSchema);