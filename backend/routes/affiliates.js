/**
 * Affiliate System API Routes
 * RESTful endpoints for managing affiliates, tracking trades, and handling payouts
 */

const express = require('express');
const router = express.Router();
const affiliateStorage = require('../models/affiliate-storage');
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const { verifySwapVolume } = require('../utils/verifySwapVolume');

// ==================== AFFILIATE MANAGEMENT ====================

/**
 * POST /api/affiliates/create
 * Create a new affiliate (admin only)
 */
router.post('/create', adminAuth, async (req, res) => {
  try {
    const { code, name, walletAddress, sharePercentage, email, telegram, password } = req.body;

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
      sharePercentage: sharePercentage || 25,
      email,
      telegram,
      password
    });
    const { plainPassword, ...affiliateSafe } = affiliate;

    res.json({
      success: true,
      affiliate: affiliateSafe,
      // Plaintext portal password — only ever returned once, at creation time.
      portalPassword: plainPassword
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
 * Get all affiliates (admin only)
 */
router.get('/list', adminAuth, async (req, res) => {
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
 * Update affiliate (admin only)
 */
router.put('/:code', adminAuth, async (req, res) => {
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
 * Delete affiliate (admin only)
 */
router.delete('/:code', adminAuth, async (req, res) => {
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
 * POST /api/affiliates/:code/reset-password
 * Set/regenerate an affiliate's portal login password (admin only).
 * Returns the new plaintext password once — share it with the influencer directly.
 */
router.post('/:code/reset-password', adminAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body || {};

    const plainPassword = await affiliateStorage.setAffiliatePassword(code, password || null);

    res.json({
      success: true,
      portalPassword: plainPassword
    });
  } catch (error) {
    console.error('Error resetting affiliate password:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/affiliates/:code/portal
 * Influencer self-service portal login — password-protected, no admin key needed.
 * Bundles everything the portal page needs in one call.
 */
router.post('/:code/portal', async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ success: false, error: 'Missing password' });
    }

    const auth = await affiliateStorage.verifyAffiliatePassword(code, password);
    if (!auth.ok) {
      const status = auth.reason === 'not_found' ? 404 : 401;
      return res.status(status).json({
        success: false,
        error: auth.reason === 'not_found' ? `Affiliate "${code}" not found`
          : auth.reason === 'no_password_set' ? 'No portal password set for this affiliate yet — contact the admin.'
          : 'Incorrect password'
      });
    }

    const [{ affiliate, stats }, trades, payouts, pendingEarnings] = await Promise.all([
      affiliateStorage.getAffiliateStats(code),
      affiliateStorage.getTradesByReferral(code, { limit: 200 }),
      affiliateStorage.getPayoutsByReferral(code, { limit: 50 }),
      affiliateStorage.getPendingEarnings(code)
    ]);

    res.json({
      success: true,
      affiliate,
      stats,
      trades,
      payouts,
      pendingEarnings
    });
  } catch (error) {
    console.error('Error loading affiliate portal:', error);
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

    if (!userWallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userWallet'
      });
    }

    // On-chain txid required so volume is auditable and dedupable
    if (!transactionSignature) {
      return res.status(400).json({
        success: false,
        error: 'transactionSignature is required'
      });
    }

    // No code on this device? Fall back to the account's permanent attribution.
    // Un-attributed trades are STILL recorded (referralCode null) so the main
    // fee wallet's contributions stay auditable in the dashboard.
    let resolvedCode = referralCode;
    if (!resolvedCode) {
      const user = await User.findOne({ walletAddress: userWallet }).lean();
      resolvedCode = user?.referredBy?.code || null;
    }

    // NEVER trust the client-reported volume — derive the true SOL side of the
    // swap from the on-chain transaction (a raw token amount was once reported
    // as SOL, inflating volume ~20,000x). Client value is only a fallback for
    // small trades when the RPC lookup fails.
    const claimedVolume = parseFloat(tradeVolume) || 0;
    let finalVolume = claimedVolume;
    let volumeVerified = false;
    const verification = await verifySwapVolume(transactionSignature, userWallet);
    if (verification.verified) {
      finalVolume = verification.volumeSol;
      volumeVerified = true;
      if (claimedVolume > 0 && Math.abs(claimedVolume - finalVolume) / finalVolume > 0.25) {
        console.warn(`⚠️ Affiliate trade volume mismatch for ${transactionSignature.slice(0, 12)}…: claimed ${claimedVolume} SOL, on-chain ${finalVolume} SOL — using on-chain value`);
      }
    } else {
      console.warn(`⚠️ Could not verify swap ${transactionSignature.slice(0, 12)}… on-chain (${verification.reason})`);
      // Refuse unverifiable claims that would be worth real money
      if (!(claimedVolume > 0) || claimedVolume > 10) {
        return res.status(422).json({
          success: false,
          error: `Unable to verify trade volume on-chain (${verification.reason})`
        });
      }
    }

    const finalFee = finalVolume * 0.01; // 1% integrator fee

    const trade = await affiliateStorage.recordTrade({
      referralCode: resolvedCode,
      userWallet,
      tradeVolume: finalVolume,
      feeEarned: finalFee,
      tokenIn,
      tokenOut,
      transactionSignature,
      metadata: { ...(metadata || {}), volumeVerified, claimedVolume }
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
router.get('/trades/all', adminAuth, async (req, res) => {
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
 * Create a payout for an affiliate (admin only)
 */
router.post('/payouts/create', adminAuth, async (req, res) => {
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
router.get('/payouts/all', adminAuth, async (req, res) => {
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

/**
 * GET /api/affiliates/platform/contributors
 * Wallets contributing fees to the main fee wallet, aggregated (admin only)
 */
router.get('/platform/contributors', adminAuth, async (req, res) => {
  try {
    const { AffiliateTrade } = require('../models/Affiliate');
    const contributors = await AffiliateTrade.aggregate([
      {
        $group: {
          _id: '$userWallet',
          trades: { $sum: 1 },
          totalVolume: { $sum: '$tradeVolume' },
          totalVolumeUsd: { $sum: '$tradeVolumeUsd' },
          totalFees: { $sum: '$feeEarned' },
          totalFeesUsd: { $sum: '$feeEarnedUsd' },
          platformShare: { $sum: '$platformShare' },
          platformShareUsd: { $sum: '$platformShareUsd' },
          lastTradeAt: { $max: '$timestamp' },
          referralCodes: { $addToSet: '$referralCode' },
        }
      },
      { $sort: { platformShare: -1 } },
      { $limit: 100 },
    ]);

    const totals = contributors.reduce((acc, c) => ({
      totalFees: acc.totalFees + (c.totalFees || 0),
      totalFeesUsd: acc.totalFeesUsd + (c.totalFeesUsd || 0),
      platformShare: acc.platformShare + (c.platformShare || 0),
      platformShareUsd: acc.platformShareUsd + (c.platformShareUsd || 0),
    }), { totalFees: 0, totalFeesUsd: 0, platformShare: 0, platformShareUsd: 0 });

    res.json({
      success: true,
      totals,
      contributors: contributors.map((c) => ({
        wallet: c._id,
        trades: c.trades,
        totalVolume: c.totalVolume,
        totalVolumeUsd: c.totalVolumeUsd,
        totalFees: c.totalFees,
        totalFeesUsd: c.totalFeesUsd,
        platformShare: c.platformShare,
        platformShareUsd: c.platformShareUsd,
        lastTradeAt: c.lastTradeAt,
        referralCodes: (c.referralCodes || []).filter(Boolean),
      })),
    });
  } catch (error) {
    console.error('Error fetching platform contributors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
