/**
 * Affiliate System Storage — MongoDB-backed
 * Same public API as the old file-based version, but persisted in Mongo
 * (file storage was wiped on every Render deploy).
 */

const { Affiliate, AffiliateTrade, AffiliatePayout } = require('./Affiliate');
const { getSolUsdPrice } = require('../utils/solPrice');

class AffiliateStorage {
  // Kept for API compatibility — Mongo connection is managed by config/database.js
  async initialize() {
    return true;
  }

  // ==================== AFFILIATE METHODS ====================

  async createAffiliate({ code, name, walletAddress, sharePercentage = 25, email = null, telegram = null }) {
    const existing = await Affiliate.findOne({ code }).lean();
    if (existing) {
      throw new Error(`Affiliate code "${code}" already exists`);
    }

    const affiliate = await Affiliate.create({
      code, name, walletAddress, sharePercentage, email, telegram
    });

    console.log(`✅ Created affiliate: ${name} (${code})`);
    return affiliate.toObject();
  }

  async getAffiliate(code) {
    return Affiliate.findOne({ code }).lean();
  }

  async getAllAffiliates() {
    return Affiliate.find().sort({ createdAt: -1 }).lean();
  }

  async updateAffiliate(code, updates) {
    delete updates.code;
    const affiliate = await Affiliate.findOneAndUpdate(
      { code },
      { $set: updates },
      { new: true }
    ).lean();

    if (!affiliate) {
      throw new Error(`Affiliate "${code}" not found`);
    }
    return affiliate;
  }

  async deleteAffiliate(code) {
    const result = await Affiliate.deleteOne({ code });
    if (result.deletedCount === 0) {
      throw new Error(`Affiliate "${code}" not found`);
    }
    console.log(`✅ Deleted affiliate: ${code}`);
    return true;
  }

  // ==================== TRADE METHODS ====================

  async recordTrade({
    referralCode,
    userWallet,
    tradeVolume,
    feeEarned,
    tokenIn,
    tokenOut,
    transactionSignature = null,
    metadata = {}
  }) {
    // Dedupe: one ledger entry per on-chain swap
    if (transactionSignature) {
      const existing = await AffiliateTrade.findOne({ transactionSignature }).lean();
      if (existing) {
        console.log(`📊 Trade ${transactionSignature.slice(0, 12)}… already recorded, skipping`);
        return existing;
      }
    }

    const affiliate = await Affiliate.findOne({ code: referralCode }).lean();
    if (!affiliate) {
      console.warn(`⚠️ Trade recorded with unknown referral code: ${referralCode}`);
    }

    // Influencer share is a percent of the GROSS fee (25% of a 1% fee = 0.25% of volume).
    const jupiterCut = feeEarned * 0.20;
    const netFee = feeEarned - jupiterCut;
    const influencerShare = affiliate ? (feeEarned * (affiliate.sharePercentage / 100)) : 0;
    const platformShare = netFee - influencerShare;

    // USD equivalents are valued once at the trade's own SOL/USD rate (not re-priced later).
    const solUsdPriceAtTrade = await getSolUsdPrice();
    const tradeVolumeUsd = tradeVolume * solUsdPriceAtTrade;
    const feeEarnedUsd = feeEarned * solUsdPriceAtTrade;
    const influencerShareUsd = influencerShare * solUsdPriceAtTrade;
    const platformShareUsd = platformShare * solUsdPriceAtTrade;

    const trade = await AffiliateTrade.create({
      tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      referralCode,
      influencerWallet: affiliate?.walletAddress || null,
      influencerName: affiliate?.name || null,
      userWallet,
      tradeVolume,
      feeEarned,
      jupiterCut,
      netFee,
      influencerShare,
      platformShare,
      solUsdPriceAtTrade,
      tradeVolumeUsd,
      feeEarnedUsd,
      influencerShareUsd,
      platformShareUsd,
      tokenIn,
      tokenOut,
      transactionSignature,
      metadata
    });

    if (affiliate) {
      await Affiliate.updateOne(
        { code: referralCode },
        {
          $inc: {
            totalEarned: influencerShare,
            totalVolume: tradeVolume,
            totalTrades: 1,
            totalEarnedUsd: influencerShareUsd,
            totalVolumeUsd: tradeVolumeUsd
          }
        }
      );
    }

    console.log(`📊 Trade recorded: ${tradeVolume} SOL volume ($${tradeVolumeUsd.toFixed(2)}), ${influencerShare.toFixed(4)} SOL ($${influencerShareUsd.toFixed(2)}) to ${referralCode}`);
    return trade.toObject();
  }

  async getTradesByReferral(referralCode, options = {}) {
    const query = { referralCode };
    if (options.payoutStatus) query.payoutStatus = options.payoutStatus;

    let q = AffiliateTrade.find(query).sort({ timestamp: -1 });
    if (options.limit) q = q.skip(options.offset || 0).limit(options.limit);
    return q.lean();
  }

  async getAllTrades(options = {}) {
    const query = {};
    if (options.payoutStatus) query.payoutStatus = options.payoutStatus;

    let q = AffiliateTrade.find(query).sort({ timestamp: -1 });
    if (options.limit) q = q.skip(options.offset || 0).limit(options.limit);
    return q.lean();
  }

  async getPendingEarnings(referralCode) {
    const pendingTrades = await AffiliateTrade.find({
      referralCode,
      payoutStatus: 'pending'
    }).sort({ timestamp: -1 }).lean();

    const totalPending = pendingTrades.reduce((sum, t) => sum + t.influencerShare, 0);
    const totalPendingUsd = pendingTrades.reduce((sum, t) => sum + (t.influencerShareUsd || 0), 0);

    return {
      referralCode,
      totalPending,
      totalPendingUsd,
      tradeCount: pendingTrades.length,
      trades: pendingTrades
    };
  }

  // ==================== PAYOUT METHODS ====================

  async createPayout({
    referralCode,
    amount,
    tradeIds,
    transactionSignature = null,
    notes = null
  }) {
    const affiliate = await Affiliate.findOne({ code: referralCode }).lean();
    if (!affiliate) {
      throw new Error(`Affiliate "${referralCode}" not found`);
    }

    const paidTrades = await AffiliateTrade.find({ tradeId: { $in: tradeIds } }).lean();
    const amountUsd = paidTrades.reduce((sum, t) => sum + (t.influencerShareUsd || 0), 0);

    const payout = await AffiliatePayout.create({
      payoutId: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      referralCode,
      influencerWallet: affiliate.walletAddress,
      influencerName: affiliate.name,
      amount,
      amountUsd,
      tradeIds,
      tradeCount: tradeIds.length,
      transactionSignature,
      notes,
      status: transactionSignature ? 'completed' : 'pending',
      completedAt: transactionSignature ? new Date() : null
    });

    if (transactionSignature) {
      await this.markTradesAsPaid(tradeIds, payout.payoutId);
    }

    console.log(`💰 Payout created: ${amount} to ${referralCode} (${tradeIds.length} trades)`);
    return payout.toObject();
  }

  async markTradesAsPaid(tradeIds, payoutId) {
    const result = await AffiliateTrade.updateMany(
      { tradeId: { $in: tradeIds } },
      { $set: { payoutStatus: 'paid', payoutId, paidAt: new Date() } }
    );
    console.log(`✅ Marked ${result.modifiedCount} trades as paid (payout: ${payoutId})`);
  }

  async getPayoutsByReferral(referralCode, options = {}) {
    let q = AffiliatePayout.find({ referralCode }).sort({ createdAt: -1 });
    if (options.limit) q = q.skip(options.offset || 0).limit(options.limit);
    return q.lean();
  }

  async getAllPayouts(options = {}) {
    let q = AffiliatePayout.find().sort({ createdAt: -1 });
    if (options.limit) q = q.skip(options.offset || 0).limit(options.limit);
    return q.lean();
  }

  // ==================== STATS ====================

  async getAffiliateStats(referralCode) {
    const affiliate = await Affiliate.findOne({ code: referralCode }).lean();
    if (!affiliate) {
      throw new Error(`Affiliate "${referralCode}" not found`);
    }

    const [agg] = await AffiliateTrade.aggregate([
      { $match: { referralCode } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          pendingEarnings: {
            $sum: { $cond: [{ $eq: ['$payoutStatus', 'pending'] }, '$influencerShare', 0] }
          },
          paidEarnings: {
            $sum: { $cond: [{ $eq: ['$payoutStatus', 'paid'] }, '$influencerShare', 0] }
          },
          pendingEarningsUsd: {
            $sum: { $cond: [{ $eq: ['$payoutStatus', 'pending'] }, '$influencerShareUsd', 0] }
          },
          paidEarningsUsd: {
            $sum: { $cond: [{ $eq: ['$payoutStatus', 'paid'] }, '$influencerShareUsd', 0] }
          },
          pendingTradeCount: {
            $sum: { $cond: [{ $eq: ['$payoutStatus', 'pending'] }, 1, 0] }
          },
          paidTradeCount: {
            $sum: { $cond: [{ $eq: ['$payoutStatus', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);

    return {
      affiliate,
      stats: {
        totalTrades: agg?.totalTrades || 0,
        totalVolume: affiliate.totalVolume,
        totalVolumeUsd: affiliate.totalVolumeUsd,
        totalEarnings: affiliate.totalEarned,
        totalEarningsUsd: affiliate.totalEarnedUsd,
        pendingEarnings: agg?.pendingEarnings || 0,
        pendingEarningsUsd: agg?.pendingEarningsUsd || 0,
        paidEarnings: agg?.paidEarnings || 0,
        paidEarningsUsd: agg?.paidEarningsUsd || 0,
        pendingTradeCount: agg?.pendingTradeCount || 0,
        paidTradeCount: agg?.paidTradeCount || 0
      }
    };
  }
}

module.exports = new AffiliateStorage();
