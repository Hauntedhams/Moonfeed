/**
 * One-off: repair affiliate trades whose volume was recorded from a raw token
 * amount instead of the SOL side (e.g. the 1,398 "SOL" WOODSTOCK sell).
 * Re-verifies every trade on-chain, fixes the trade rows, then rebuilds
 * affiliate totals from the corrected trades.
 *
 * Usage: node scripts/repair-affiliate-volumes.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Affiliate, AffiliateTrade } = require('../models/Affiliate');
const { verifySwapVolume } = require('../utils/verifySwapVolume');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected to Mongo');

  const trades = await AffiliateTrade.find({}).lean();
  console.log(`${trades.length} trades to check${DRY_RUN ? ' (dry run)' : ''}`);

  for (const t of trades) {
    if (!t.transactionSignature) {
      console.log(`- ${t.tradeId}: no signature, skipping`);
      continue;
    }
    const v = await verifySwapVolume(t.transactionSignature, t.userWallet, { attempts: 2, delayMs: 800 });
    if (!v.verified) {
      console.log(`- ${t.tradeId} (${t.transactionSignature.slice(0, 12)}…): UNVERIFIABLE (${v.reason}), recorded ${t.tradeVolume} SOL`);
      continue;
    }
    const diff = t.tradeVolume > 0 ? Math.abs(t.tradeVolume - v.volumeSol) / v.volumeSol : Infinity;
    if (diff < 0.05) {
      console.log(`- ${t.tradeId}: OK (${t.tradeVolume} SOL ≈ on-chain ${v.volumeSol.toFixed(6)} SOL)`);
      continue;
    }

    console.log(`- ${t.tradeId}: FIXING ${t.tradeVolume} SOL → ${v.volumeSol.toFixed(9)} SOL (tx ${t.transactionSignature.slice(0, 16)}…)`);
    if (DRY_RUN) continue;

    const affiliate = await Affiliate.findOne({ code: t.referralCode }).lean();
    const share = affiliate?.sharePercentage ?? 25;
    const solUsd = t.solUsdPriceAtTrade || 0;

    const tradeVolume = v.volumeSol;
    const feeEarned = tradeVolume * 0.01;
    const jupiterCut = feeEarned * 0.20;
    const netFee = feeEarned - jupiterCut;
    const influencerShare = feeEarned * (share / 100);
    const platformShare = netFee - influencerShare;

    await AffiliateTrade.updateOne({ _id: t._id }, {
      $set: {
        tradeVolume,
        feeEarned,
        jupiterCut,
        netFee,
        influencerShare,
        platformShare,
        tradeVolumeUsd: tradeVolume * solUsd,
        feeEarnedUsd: feeEarned * solUsd,
        influencerShareUsd: influencerShare * solUsd,
        platformShareUsd: platformShare * solUsd,
        'metadata.volumeVerified': true,
        'metadata.repairedAt': new Date().toISOString(),
        'metadata.previousVolume': t.tradeVolume,
      }
    });
  }

  // Rebuild affiliate totals from (now corrected) trades
  const affiliates = await Affiliate.find({}).lean();
  for (const a of affiliates) {
    const agg = await AffiliateTrade.aggregate([
      { $match: { referralCode: a.code } },
      { $group: {
        _id: null,
        totalEarned: { $sum: '$influencerShare' },
        totalVolume: { $sum: '$tradeVolume' },
        totalTrades: { $sum: 1 },
        totalEarnedUsd: { $sum: '$influencerShareUsd' },
        totalVolumeUsd: { $sum: '$tradeVolumeUsd' },
      } }
    ]);
    const s = agg[0] || { totalEarned: 0, totalVolume: 0, totalTrades: 0, totalEarnedUsd: 0, totalVolumeUsd: 0 };
    console.log(`Affiliate ${a.code}: totals → ${s.totalVolume.toFixed(4)} SOL vol, ${s.totalEarned.toFixed(6)} SOL earned ($${(s.totalEarnedUsd || 0).toFixed(2)}), ${s.totalTrades} trades`);
    if (!DRY_RUN) {
      await Affiliate.updateOne({ code: a.code }, { $set: {
        totalEarned: s.totalEarned,
        totalVolume: s.totalVolume,
        totalTrades: s.totalTrades,
        totalEarnedUsd: s.totalEarnedUsd,
        totalVolumeUsd: s.totalVolumeUsd,
      } });
    }
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((e) => { console.error(e); process.exit(1); });
