/**
 * Affiliate System API Routes
 * RESTful endpoints for managing affiliates, tracking trades, and handling payouts
 */

const express = require('express');
const router = express.Router();
const affiliateStorage = require('../models/affiliate-storage');

// ==================== AFFILIATE MANAGEMENT ====================

/**
 * POST /api/affiliates/create
 * Create a new affiliate
 */
router.post('/create', async (req, res) => {
  try {
    const { code, name, walletAddress, sharePercentage, email, telegram } = req.body;

    if (!code || !name || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: code, name, walletAddress'
      });
    }

    // Validate code format (alphanumeric, no spaces)
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid code format. Use only letters, numbers, hyphens, and underscores.'
      });
    }

    const affiliate = await affiliateStorage.createAffiliate({
      code,
      name,
      walletAddress,
      sharePercentage: sharePercentage || 50,
      email,
      telegram
    });

    res.json({
      success: true,
      affiliate
    });
  } catch (error) {
    console.error('Error creating affiliate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/list
 * Get all affiliates
 */
router.get('/list', async (req, res) => {
  try {
    const affiliates = await affiliateStorage.getAllAffiliates();

    res.json({
      success: true,
      affiliates,
      count: affiliates.length
    });
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/:code
 * Get affiliate by code
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const affiliate = await affiliateStorage.getAffiliate(code);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        error: `Affiliate "${code}" not found`
      });
    }

    res.json({
      success: true,
      affiliate
    });
  } catch (error) {
    console.error('Error fetching affiliate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/affiliates/:code
 * Update affiliate
 */
router.put('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.code;
    delete updates.totalEarned;
    delete updates.totalVolume;
    delete updates.totalTrades;
    delete updates.createdAt;

    const affiliate = await affiliateStorage.updateAffiliate(code, updates);

    res.json({
      success: true,
      affiliate
    });
  } catch (error) {
    console.error('Error updating affiliate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/affiliates/:code
 * Delete affiliate
 */
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    await affiliateStorage.deleteAffiliate(code);

    res.json({
      success: true,
      message: `Affiliate "${code}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting affiliate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/:code/stats
 * Get detailed statistics for an affiliate
 */
router.get('/:code/stats', async (req, res) => {
  try {
    const { code } = req.params;

    const stats = await affiliateStorage.getAffiliateStats(code);

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== TRADE TRACKING ====================

/**
 * POST /api/affiliates/track-trade
 * Record a new trade with referral attribution
 */
router.post('/track-trade', async (req, res) => {
  try {
    const {
      referralCode,
      userWallet,
      tradeVolume,
      feeEarned,
      tokenIn,
      tokenOut,
      transactionSignature,
      metadata
    } = req.body;

    if (!referralCode || !userWallet || !tradeVolume || !feeEarned) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: referralCode, userWallet, tradeVolume, feeEarned'
      });
    }

    const trade = await affiliateStorage.recordTrade({
      referralCode,
      userWallet,
      tradeVolume: parseFloat(tradeVolume),
      feeEarned: parseFloat(feeEarned),
      tokenIn,
      tokenOut,
      transactionSignature,
      metadata
    });

    res.json({
      success: true,
      trade
    });
  } catch (error) {
    console.error('Error tracking trade:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/:code/trades
 * Get trades for a specific affiliate
 */
router.get('/:code/trades', async (req, res) => {
  try {
    const { code } = req.params;
    const { payoutStatus, limit, offset } = req.query;

    const trades = await affiliateStorage.getTradesByReferral(code, {
      payoutStatus,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({
      success: true,
      trades,
      count: trades.length
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/:code/pending-earnings
 * Get pending earnings for an affiliate
 */
router.get('/:code/pending-earnings', async (req, res) => {
  try {
    const { code } = req.params;

    const pendingEarnings = await affiliateStorage.getPendingEarnings(code);

    res.json({
      success: true,
      ...pendingEarnings
    });
  } catch (error) {
    console.error('Error fetching pending earnings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/trades/all
 * Get all trades (admin only)
 */
router.get('/trades/all', async (req, res) => {
  try {
    const { payoutStatus, limit, offset } = req.query;

    const trades = await affiliateStorage.getAllTrades({
      payoutStatus,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({
      success: true,
      trades,
      count: trades.length
    });
  } catch (error) {
    console.error('Error fetching all trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== PAYOUT MANAGEMENT ====================

/**
 * POST /api/affiliates/payouts/create
 * Create a payout for an affiliate
 */
router.post('/payouts/create', async (req, res) => {
  try {
    const {
      referralCode,
      amount,
      tradeIds,
      transactionSignature,
      notes
    } = req.body;

    if (!referralCode || !amount || !tradeIds || !Array.isArray(tradeIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: referralCode, amount, tradeIds (array)'
      });
    }

    const payout = await affiliateStorage.createPayout({
      referralCode,
      amount: parseFloat(amount),
      tradeIds,
      transactionSignature,
      notes
    });

    res.json({
      success: true,
      payout
    });
  } catch (error) {
    console.error('Error creating payout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/:code/payouts
 * Get payouts for a specific affiliate
 */
router.get('/:code/payouts', async (req, res) => {
  try {
    const { code } = req.params;
    const { limit, offset } = req.query;

    const payouts = await affiliateStorage.getPayoutsByReferral(code, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({
      success: true,
      payouts,
      count: payouts.length
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/payouts/all
 * Get all payouts (admin only)
 */
router.get('/payouts/all', async (req, res) => {
  try {
    const { limit, offset } = req.query;

    const payouts = await affiliateStorage.getAllPayouts({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({
      success: true,
      payouts,
      count: payouts.length
    });
  } catch (error) {
    console.error('Error fetching all payouts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/validate/:code
 * Validate if a referral code exists (for frontend)
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const affiliate = await affiliateStorage.getAffiliate(code);

    res.json({
      success: true,
      valid: !!affiliate,
      affiliate: affiliate ? {
        code: affiliate.code,
        name: affiliate.name,
        status: affiliate.status
      } : null
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/affiliates/platform/earnings
 * Get platform (Ultra wallet) total earnings
 */
router.get('/platform/earnings', async (req, res) => {
  try {
    const allTrades = await affiliateStorage.getAllTrades();
    
    // Calculate total platform earnings
    const totalEarnings = allTrades.reduce((sum, trade) => sum + trade.platformShare, 0);
    
    // Calculate pending (unpaid trades)
    const pendingEarnings = allTrades
      .filter(trade => trade.payoutStatus === 'pending')
      .reduce((sum, trade) => sum + trade.platformShare, 0);
    
    // Calculate paid (paid out trades)
    const paidEarnings = allTrades
      .filter(trade => trade.payoutStatus === 'paid')
      .reduce((sum, trade) => sum + trade.platformShare, 0);
    
    // Breakdown by affiliate
    const byAffiliate = {};
    allTrades.forEach(trade => {
      if (!byAffiliate[trade.referralCode]) {
        byAffiliate[trade.referralCode] = {
          total: 0,
          pending: 0,
          paid: 0,
          tradeCount: 0
        };
      }
      
      byAffiliate[trade.referralCode].total += trade.platformShare;
      byAffiliate[trade.referralCode].tradeCount++;
      
      if (trade.payoutStatus === 'pending') {
        byAffiliate[trade.referralCode].pending += trade.platformShare;
      } else if (trade.payoutStatus === 'paid') {
        byAffiliate[trade.referralCode].paid += trade.platformShare;
      }
    });

    res.json({
      success: true,
      platformEarnings: {
        total: totalEarnings,
        pending: pendingEarnings,
        paid: paidEarnings,
        tradeCount: allTrades.length
      },
      byAffiliate
    });
  } catch (error) {
    console.error('Error fetching platform earnings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
