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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
