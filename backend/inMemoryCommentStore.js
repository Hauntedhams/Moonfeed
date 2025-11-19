/**
 * In-Memory Comment Storage
 * Fallback for when MongoDB is not available
 * Comments will be lost on server restart
 */

class InMemoryCommentStore {
  constructor() {
    this.comments = new Map(); // Map of coinAddress -> array of comments
    this.commentId = 1;
  }

  // Get all comments for a coin
  async getComments(coinAddress) {
    const comments = this.comments.get(coinAddress) || [];
    return comments
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100); // Limit to 100 most recent
  }

  // Add a comment
  async addComment(coinAddress, coinSymbol, walletAddress, comment) {
    if (!this.comments.has(coinAddress)) {
      this.comments.set(coinAddress, []);
    }

    const newComment = {
      _id: `comment_${this.commentId++}`,
      coinAddress,
      coinSymbol,
      walletAddress,
      comment,
      timestamp: new Date(),
      edited: false,
      likes: 0,
      likedBy: []
    };

    const coinComments = this.comments.get(coinAddress);
    coinComments.unshift(newComment); // Add to beginning

    // Keep only last 100 comments per coin
    if (coinComments.length > 100) {
      coinComments.pop();
    }

    return newComment;
  }

  // Check rate limiting
  async canWalletPost(coinAddress, walletAddress) {
    const comments = this.comments.get(coinAddress) || [];
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const recentComments = comments.filter(
      c => c.walletAddress === walletAddress && c.timestamp > oneHourAgo
    );

    return recentComments.length < 10;
  }

  // Check for duplicate comments
  async hasDuplicateComment(coinAddress, walletAddress, comment) {
    const comments = this.comments.get(coinAddress) || [];
    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    return comments.some(
      c => c.walletAddress === walletAddress &&
           c.comment === comment &&
           c.timestamp > oneMinuteAgo
    );
  }

  // Get comment count
  async getCommentCount(coinAddress) {
    const comments = this.comments.get(coinAddress) || [];
    return comments.length;
  }

  // Delete a comment
  async deleteComment(commentId, walletAddress) {
    for (const [coinAddress, comments] of this.comments.entries()) {
      const index = comments.findIndex(
        c => c._id === commentId && c.walletAddress === walletAddress
      );
      if (index !== -1) {
        comments.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  // Get stats
  async getStats(coinAddress) {
    const comments = this.comments.get(coinAddress) || [];
    const uniqueWallets = new Set(comments.map(c => c.walletAddress));
    
    return {
      totalComments: comments.length,
      uniqueCommenters: uniqueWallets.size
    };
  }

  // Clear old comments (optional cleanup)
  clearOldComments(daysOld = 7) {
    const cutoffDate = new Date(Date.now() - daysOld * 86400000);
    
    for (const [coinAddress, comments] of this.comments.entries()) {
      const filtered = comments.filter(c => c.timestamp > cutoffDate);
      this.comments.set(coinAddress, filtered);
    }
  }
}

module.exports = new InMemoryCommentStore();
