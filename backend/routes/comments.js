const express = require('express');
const router = express.Router();
const { isConnected } = require('../config/database');
const inMemoryStore = require('../inMemoryCommentStore');

// Try to load MongoDB Comment model, fallback to in-memory if not available
let Comment = null;
try {
  Comment = require('../models/Comment');
  console.log('✅ MongoDB Comment model loaded');
} catch (error) {
  console.warn('⚠️  MongoDB Comment model not available, using in-memory storage');
}

// Check if we should use in-memory storage
const shouldUseInMemory = () => {
  return !Comment || !isConnected();
};

/**
 * GET /api/comments/:coinAddress
 * Get all comments for a specific coin
 */
router.get('/:coinAddress', async (req, res) => {
  try {
    const { coinAddress } = req.params;
    
    let comments;
    if (shouldUseInMemory()) {
      // Use in-memory storage
      comments = await inMemoryStore.getComments(coinAddress);
      console.log(`📝 [In-Memory] Fetched ${comments.length} comments for ${coinAddress.substring(0, 8)}...`);
    } else {
      // Use MongoDB
      comments = await Comment.find({ coinAddress })
        .sort({ timestamp: -1 })
        .limit(100);
      console.log(`📝 [MongoDB] Fetched ${comments.length} comments for ${coinAddress.substring(0, 8)}...`);
    }
    
    res.json({
      success: true,
      comments,
      count: comments.length,
      storage: shouldUseInMemory() ? 'memory' : 'mongodb'
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message
    });
  }
});

/**
 * POST /api/comments
 * Post a new comment (requires wallet address)
 */
router.post('/', async (req, res) => {
  try {
    const { coinAddress, coinSymbol, walletAddress, comment } = req.body;
    
    // Validation
    if (!coinAddress || !walletAddress || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: coinAddress, walletAddress, and comment are required'
      });
    }
    
    if (!comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }
    
    if (comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment is too long (max 500 characters)'
      });
    }
    
    if (shouldUseInMemory()) {
      // Use in-memory storage
      
      // Check for duplicate comment
      const hasDuplicate = await inMemoryStore.hasDuplicateComment(
        coinAddress,
        walletAddress,
        comment.trim()
      );
      
      if (hasDuplicate) {
        return res.status(429).json({
          success: false,
          message: 'Please wait before posting the same comment again'
        });
      }
      
      // Check rate limit
      const canPost = await inMemoryStore.canWalletPost(coinAddress, walletAddress);
      
      if (!canPost) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Please wait before posting more comments.'
        });
      }
      
      // Add comment
      const newComment = await inMemoryStore.addComment(
        coinAddress,
        coinSymbol || 'Unknown',
        walletAddress,
        comment.trim()
      );
      
      console.log(`💬 [In-Memory] New comment posted for ${coinSymbol || coinAddress.substring(0, 8)} by ${walletAddress.substring(0, 8)}...`);
      
      res.status(201).json({
        success: true,
        message: 'Comment posted successfully',
        comment: newComment,
        storage: 'memory'
      });
      
    } else {
      // Use MongoDB
      
      // Check for duplicate comment
      const recentDuplicate = await Comment.findOne({
        coinAddress,
        walletAddress,
        comment: comment.trim(),
        timestamp: { $gt: new Date(Date.now() - 60000) }
      });
      
      if (recentDuplicate) {
        return res.status(429).json({
          success: false,
          message: 'Please wait before posting the same comment again'
        });
      }
      
      // Check rate limit
      const recentComments = await Comment.countDocuments({
        coinAddress,
        walletAddress,
        timestamp: { $gt: new Date(Date.now() - 3600000) }
      });
      
      if (recentComments >= 10) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Please wait before posting more comments.'
        });
      }
      
      // Create new comment
      const newComment = new Comment({
        coinAddress,
        coinSymbol: coinSymbol || 'Unknown',
        walletAddress,
        comment: comment.trim(),
        timestamp: new Date()
      });
      
      await newComment.save();
      
      console.log(`💬 [MongoDB] New comment posted for ${coinSymbol || coinAddress.substring(0, 8)} by ${walletAddress.substring(0, 8)}...`);
      
      res.status(201).json({
        success: true,
        message: 'Comment posted successfully',
        comment: newComment,
        storage: 'mongodb'
      });
    }
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post comment',
      error: error.message
    });
  }
});

/**
 * DELETE /api/comments/:commentId
 * Delete a comment (only by the original poster)
 */
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }
    
    if (shouldUseInMemory()) {
      // Use in-memory storage
      const deleted = await inMemoryStore.deleteComment(commentId, walletAddress);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found or you do not have permission to delete it'
        });
      }
      
      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });
      
    } else {
      // Use MongoDB
      const comment = await Comment.findById(commentId);
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found'
        });
      }
      
      if (comment.walletAddress !== walletAddress) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own comments'
        });
      }
      
      await Comment.findByIdAndDelete(commentId);
      
      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message
    });
  }
});

/**
 * GET /api/comments/stats/:coinAddress
 * Get comment stats for a coin
 */
router.get('/stats/:coinAddress', async (req, res) => {
  try {
    const { coinAddress } = req.params;
    
    if (shouldUseInMemory()) {
      // Use in-memory storage
      const stats = await inMemoryStore.getStats(coinAddress);
      
      res.json({
        success: true,
        stats,
        storage: 'memory'
      });
    } else {
      // Use MongoDB
      const count = await Comment.countDocuments({ coinAddress });
      const uniqueCommenters = await Comment.distinct('walletAddress', { coinAddress });
      
      res.json({
        success: true,
        stats: {
          totalComments: count,
          uniqueCommenters: uniqueCommenters.length
        },
        storage: 'mongodb'
      });
    }
  } catch (error) {
    console.error('Error fetching comment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comment stats',
      error: error.message
    });
  }
});

module.exports = router;
