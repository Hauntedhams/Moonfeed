const express = require('express');
const router = express.Router();
const { isConnected } = require('../config/database');
const inMemoryStore = require('../inMemoryCommentStore');

// Try to load MongoDB Comment model
let Comment = null;
try {
  Comment = require('../models/Comment');
} catch (error) {
  console.warn('⚠️  MongoDB Comment model not available');
}

/**
 * GET /api/comments-admin/stats
 * Get overall comment statistics and storage usage
 */
router.get('/stats', async (req, res) => {
  try {
    if (!Comment || !isConnected()) {
      // In-memory storage stats
      const memoryStats = {
        totalComments: 0,
        uniqueCoins: 0,
        uniqueWallets: new Set()
      };
      
      for (const [coinAddress, comments] of inMemoryStore.comments.entries()) {
        memoryStats.totalComments += comments.length;
        memoryStats.uniqueCoins++;
        comments.forEach(c => memoryStats.uniqueWallets.add(c.walletAddress));
      }
      
      return res.json({
        success: true,
        storage: 'memory',
        stats: {
          totalComments: memoryStats.totalComments,
          uniqueCoins: memoryStats.uniqueCoins,
          uniqueUsers: memoryStats.uniqueWallets.size,
          estimatedStorageMB: 0,
          percentUsed: 0
        },
        message: 'Using in-memory storage (data will be lost on restart)'
      });
    }
    
    // MongoDB stats
    const totalComments = await Comment.estimatedDocumentCount();
    const uniqueCoins = await Comment.distinct('coinAddress');
    const uniqueUsers = await Comment.distinct('walletAddress');
    
    // Estimate storage (400 bytes per comment average)
    const avgCommentSize = 400; // bytes
    const totalStorageBytes = totalComments * avgCommentSize;
    const totalStorageMB = totalStorageBytes / (1024 * 1024);
    
    // Free tier is 512 MB
    const freeTierLimitMB = 512;
    const percentUsed = (totalStorageMB / freeTierLimitMB) * 100;
    
    // Determine tier recommendation
    let recommendation = 'good';
    let message = 'Storage usage is healthy';
    
    if (percentUsed > 80) {
      recommendation = 'upgrade_now';
      message = 'Storage critical! Upgrade to M2 ($9/month) recommended';
    } else if (percentUsed > 60) {
      recommendation = 'plan_upgrade';
      message = 'Plan upgrade soon. Consider implementing comment TTL';
    } else if (percentUsed > 40) {
      recommendation = 'monitor';
      message = 'Monitor storage usage. Consider adding TTL when > 60%';
    }
    
    res.json({
      success: true,
      storage: 'mongodb',
      stats: {
        totalComments,
        uniqueCoins: uniqueCoins.length,
        uniqueUsers: uniqueUsers.length,
        estimatedStorageMB: totalStorageMB.toFixed(2),
        percentUsed: percentUsed.toFixed(1),
        freeTierLimitMB,
        remainingMB: (freeTierLimitMB - totalStorageMB).toFixed(2)
      },
      recommendation: {
        status: recommendation,
        message,
        actions: recommendation === 'upgrade_now' 
          ? ['Upgrade to M2 tier', 'Implement comment TTL', 'Archive old comments']
          : recommendation === 'plan_upgrade'
          ? ['Implement comment TTL', 'Monitor weekly', 'Plan upgrade budget']
          : ['Monitor monthly', 'Growth is healthy']
      }
    });
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage stats',
      error: error.message
    });
  }
});

/**
 * GET /api/comments-admin/breakdown
 * Get comment breakdown by coin
 */
router.get('/breakdown', async (req, res) => {
  try {
    if (!Comment || !isConnected()) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB not available'
      });
    }
    
    // Aggregate comments by coin
    const breakdown = await Comment.aggregate([
      {
        $group: {
          _id: '$coinAddress',
          coinSymbol: { $first: '$coinSymbol' },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$walletAddress' },
          latestComment: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          coinAddress: '$_id',
          coinSymbol: 1,
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          latestComment: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 } // Top 50 coins by comment count
    ]);
    
    res.json({
      success: true,
      breakdown,
      total: breakdown.length
    });
  } catch (error) {
    console.error('Error fetching comment breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch breakdown',
      error: error.message
    });
  }
});

module.exports = router;
