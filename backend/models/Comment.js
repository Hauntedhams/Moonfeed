const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  coinAddress: {
    type: String,
    required: true,
    index: true
  },
  coinSymbol: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  comment: {
    type: String,
    required: true,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: String // Wallet addresses that liked this comment
  }],
  reported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Compound index for efficient queries
commentSchema.index({ coinAddress: 1, timestamp: -1 });
commentSchema.index({ walletAddress: 1, timestamp: -1 });

// Virtual for formatted timestamp
commentSchema.virtual('formattedTime').get(function() {
  const now = new Date();
  const diff = now - this.timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return this.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
});

// Method to truncate wallet address
commentSchema.methods.getTruncatedWallet = function() {
  const addr = this.walletAddress;
  return `${addr.substring(0, 4)}..${addr.substring(addr.length - 4)}`;
};

// Static method to get recent comments for a coin
commentSchema.statics.getRecentComments = async function(coinAddress, limit = 100) {
  return this.find({ coinAddress, reported: false })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get comment count for a coin
commentSchema.statics.getCommentCount = async function(coinAddress) {
  return this.countDocuments({ coinAddress, reported: false });
};

// Static method to check if wallet can post (rate limiting)
commentSchema.statics.canWalletPost = async function(coinAddress, walletAddress) {
  const recentComments = await this.countDocuments({
    coinAddress,
    walletAddress,
    timestamp: { $gt: new Date(Date.now() - 3600000) } // Within last hour
  });
  
  return recentComments < 10; // Max 10 comments per hour
};

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
