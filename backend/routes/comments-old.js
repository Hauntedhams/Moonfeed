const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { isConnected } = require('../config/database');

/**
 * Middleware to check if MongoDB is connected
 */
const checkDBConnection = (req, res, next) => {
  if (!isConnected()) {
    return res.status(503).json({
      success: false,
      message: 'Comments feature is temporarily unavailable. Please try again later.'
    });
  }
  next();
};

/**
 * GET /api/comments/:coinAddress
 * Get all comments for a specific coin
 */
router.get('/:coinAddress', async (req, res) => {
  try {
    const { coinAddress } = req.params;
    
    // Find comments for this coin, sorted by newest first
    const comments = await Comment.find({ coinAddress })
      .sort({ timestamp: -1 })
      .limit(100); // Limit to most recent 100 comments
    
    res.json({
      success: true,
      comments,
      count: comments.length
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
    
    // Basic spam prevention - check if user posted same comment recently
    const recentDuplicate = await Comment.findOne({
      coinAddress,
      walletAddress,
      comment: comment.trim(),
      timestamp: { $gt: new Date(Date.now() - 60000) } // Within last minute
    });
    
    if (recentDuplicate) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before posting the same comment again'
      });
    }
    
    // Rate limiting - max 10 comments per wallet per coin per hour
    const recentComments = await Comment.countDocuments({
      coinAddress,
      walletAddress,
      timestamp: { $gt: new Date(Date.now() - 3600000) } // Within last hour
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
    
    res.status(201).json({
      success: true,
      message: 'Comment posted successfully',
      comment: newComment
    });
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
    
    // Find comment and verify ownership
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
    
    const count = await Comment.countDocuments({ coinAddress });
    const uniqueCommenters = await Comment.distinct('walletAddress', { coinAddress });
    
    res.json({
      success: true,
      stats: {
        totalComments: count,
        uniqueCommenters: uniqueCommenters.length
      }
    });
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
