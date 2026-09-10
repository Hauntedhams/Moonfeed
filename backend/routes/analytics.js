/**
 * First-party product analytics.
 *  POST /api/analytics/events       — batched ingest from the app (public)
 *  GET  /api/analytics/preferences  — this device/wallet's taste profile (public)
 *  GET  /api/analytics/summary      — dashboard aggregations (admin only)
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { AnalyticsEvent, AnalyticsSession } = require('../models/Analytics');
const adminAuth = require('../middleware/adminAuth');
const { eventWeight, getTasteProfile } = require('../services/analyticsService');

const MAX_EVENTS_PER_REQUEST = 100;
const MAX_STR = 120;

function str(value, max = MAX_STR) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

// ==================== INGEST ====================

router.post('/events', async (req, res) => {
  try {
    const sessionId = str(req.body?.sessionId, 64);
    const anonId = str(req.body?.anonId, 64);
    const events = Array.isArray(req.body?.events) ? req.body.events : [];

    if (!sessionId || !anonId) {
      return res.status(400).json({ success: false, error: 'sessionId and anonId are required' });
    }
    if (!events.length) return res.json({ success: true, accepted: 0 });
    if (!dbReady()) return res.json({ success: true, accepted: 0, skipped: 'db_unavailable' });

    const walletAddress = str(req.body?.walletAddress, 64);
    const platform = str(req.body?.platform, 24) || 'web';
    const appVersion = str(req.body?.appVersion, 24);
    const referralCode = str(req.body?.referralCode, 40);
    const now = Date.now();

    const docs = [];
    for (const raw of events.slice(0, MAX_EVENTS_PER_REQUEST)) {
      const type = str(raw?.type, 48);
      if (!type) continue;
      const ts = Number(raw?.ts);
      docs.push({
        sessionId,
        anonId,
        walletAddress,
        platform,
        appVersion,
        type,
        // Clamp client clocks: never accept a future or absurdly old timestamp.
        ts: new Date(Number.isFinite(ts) && ts > now - 86400000 && ts < now + 60000 ? ts : now),
        feed: str(raw?.feed, 32),
        mint: str(raw?.mint, 64),
        symbol: str(raw?.symbol, 32),
        ageHours: num(raw?.ageHours),
        marketCap: num(raw?.marketCap),
        liquidity: num(raw?.liquidity),
        volume24h: num(raw?.volume24h),
        durationMs: num(raw?.durationMs),
        value: num(raw?.value),
        label: str(raw?.label, 64),
        weight: eventWeight(type),
      });
    }
    if (!docs.length) return res.json({ success: true, accepted: 0 });

    await AnalyticsEvent.insertMany(docs, { ordered: false });

    const last = docs[docs.length - 1];
    const scrolls = docs.filter(d => d.type === 'coin_view').length;
    const has = (type) => docs.some(d => d.type === type);

    await AnalyticsSession.updateOne(
      { sessionId },
      {
        $setOnInsert: { sessionId, anonId, startedAt: docs[0].ts, referralCode },
        $set: {
          walletAddress,
          platform,
          appVersion,
          lastEventAt: last.ts,
          lastEventType: last.type,
        },
        $inc: {
          eventCount: docs.length,
          scrollCount: scrolls,
          coinsViewed: new Set(docs.filter(d => d.mint).map(d => d.mint)).size,
        },
        ...(has('card_expand') || has('trade_window_open') || has('wallet_connected') || has('swap_success')
          ? {
              $max: {
                expandedCard: has('card_expand'),
                openedTradeWindow: has('trade_window_open'),
                connectedWallet: has('wallet_connected'),
                tradedSuccessfully: has('swap_success'),
              },
            }
          : {}),
      },
      { upsert: true }
    );

    res.json({ success: true, accepted: docs.length });
  } catch (error) {
    // Analytics must never break the app — always answer 200-ish and log.
    console.warn('[analytics] ingest failed:', error.message);
    res.status(202).json({ success: false, error: 'ingest_failed' });
  }
});

// ==================== PERSONALIZATION ====================

router.get('/preferences', async (req, res) => {
  try {
    const anonId = str(req.query.anonId, 64);
    const walletAddress = str(req.query.wallet, 64);
    if (!anonId && !walletAddress) {
      return res.status(400).json({ success: false, error: 'anonId or wallet is required' });
    }
    if (!dbReady()) {
      return res.json({ success: true, profile: { confidence: 0, age: {}, marketCap: {}, feed: {} } });
    }
    const profile = await getTasteProfile({ anonId, walletAddress });
    res.json({ success: true, profile });
  } catch (error) {
    console.warn('[analytics] preferences failed:', error.message);
    res.json({ success: true, profile: { confidence: 0, age: {}, marketCap: {}, feed: {} } });
  }
});

// ==================== DASHBOARD ====================

router.get('/summary', adminAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ success: false, error: 'Database unavailable' });

    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const eventMatch = { ts: { $gte: since } };
    const sessionMatch = { startedAt: { $gte: since } };

    const [
      totals,
      eventsByType,
      daily,
      hourly,
      funnel,
      scrollBuckets,
      exitPoints,
      platforms,
      topCoins,
      feedUsage,
    ] = await Promise.all([
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            events: { $sum: '$eventCount' },
            scrolls: { $sum: '$scrollCount' },
            devices: { $addToSet: '$anonId' },
            wallets: { $addToSet: '$walletAddress' },
            avgDurationMs: { $avg: { $subtract: ['$lastEventAt', '$startedAt'] } },
          },
        },
        {
          $project: {
            _id: 0,
            sessions: 1,
            events: 1,
            scrolls: 1,
            avgDurationMs: 1,
            devices: { $size: '$devices' },
            wallets: {
              $size: { $filter: { input: '$wallets', as: 'w', cond: { $ne: ['$$w', null] } } },
            },
          },
        },
      ]),

      AnalyticsEvent.aggregate([
        { $match: eventMatch },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
        { $project: { _id: 0, type: '$_id', count: 1 } },
      ]),

      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
            sessions: { $sum: 1 },
            events: { $sum: '$eventCount' },
            scrolls: { $sum: '$scrollCount' },
            devices: { $addToSet: '$anonId' },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0, date: '$_id', sessions: 1, events: 1, scrolls: 1,
            devices: { $size: '$devices' },
          },
        },
      ]),

      AnalyticsEvent.aggregate([
        { $match: eventMatch },
        { $group: { _id: { $hour: '$ts' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, hour: '$_id', count: 1 } },
      ]),

      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: null,
            opened: { $sum: 1 },
            scrolled: { $sum: { $cond: [{ $gt: ['$scrollCount', 0] }, 1, 0] } },
            expanded: { $sum: { $cond: ['$expandedCard', 1, 0] } },
            connected: { $sum: { $cond: ['$connectedWallet', 1, 0] } },
            openedTrade: { $sum: { $cond: ['$openedTradeWindow', 1, 0] } },
            traded: { $sum: { $cond: ['$tradedSuccessfully', 1, 0] } },
          },
        },
        { $project: { _id: 0 } },
      ]),

      // "user did 4 scrolls and closed the app" — how far sessions get.
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        {
          $bucket: {
            groupBy: '$scrollCount',
            boundaries: [0, 1, 3, 6, 11, 21, 51],
            default: '51+',
            output: { sessions: { $sum: 1 } },
          },
        },
      ]),

      // The last thing a session did before it ended.
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        { $group: { _id: '$lastEventType', sessions: { $sum: 1 } } },
        { $sort: { sessions: -1 } },
        { $limit: 12 },
        { $project: { _id: 0, type: { $ifNull: ['$_id', 'unknown'] }, sessions: 1 } },
      ]),

      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        { $group: { _id: '$platform', sessions: { $sum: 1 } } },
        { $sort: { sessions: -1 } },
        { $project: { _id: 0, platform: { $ifNull: ['$_id', 'unknown'] }, sessions: 1 } },
      ]),

      AnalyticsEvent.aggregate([
        { $match: { ...eventMatch, mint: { $ne: null }, weight: { $gt: 0 } } },
        {
          $group: {
            _id: '$mint',
            symbol: { $last: '$symbol' },
            engagement: { $sum: '$weight' },
            views: { $sum: { $cond: [{ $eq: ['$type', 'coin_view'] }, 1, 0] } },
            trades: { $sum: { $cond: [{ $eq: ['$type', 'swap_success'] }, 1, 0] } },
          },
        },
        { $sort: { engagement: -1 } },
        { $limit: 15 },
        { $project: { _id: 0, mint: '$_id', symbol: 1, engagement: 1, views: 1, trades: 1 } },
      ]),

      AnalyticsEvent.aggregate([
        { $match: { ...eventMatch, feed: { $ne: null } } },
        { $group: { _id: '$feed', events: { $sum: 1 } } },
        { $sort: { events: -1 } },
        { $project: { _id: 0, feed: '$_id', events: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      days,
      totals: totals[0] || { sessions: 0, events: 0, scrolls: 0, devices: 0, wallets: 0, avgDurationMs: 0 },
      funnel: funnel[0] || { opened: 0, scrolled: 0, expanded: 0, connected: 0, openedTrade: 0, traded: 0 },
      eventsByType,
      daily,
      hourly,
      scrollBuckets: scrollBuckets.map(b => ({ bucket: b._id, sessions: b.sessions })),
      exitPoints,
      platforms,
      topCoins,
      feedUsage,
    });
  } catch (error) {
    console.error('[analytics] summary failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to build analytics summary' });
  }
});

module.exports = router;
