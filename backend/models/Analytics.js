const mongoose = require('mongoose');

// First-party product analytics. Two collections:
//   AnalyticsEvent   — one row per user interaction (scroll, expand, trade open…)
//   AnalyticsSession — one row per app launch, kept in sync on every ingest so
//                      "opened the app, scrolled 4 times, left" is a single doc.
// Both expire automatically so the collection can't grow without bound.

const EVENT_TTL_DAYS = Number(process.env.ANALYTICS_TTL_DAYS) || 90;

const analyticsEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  anonId: { type: String, required: true, index: true },
  walletAddress: { type: String, default: null, index: true },
  type: { type: String, required: true, index: true },
  ts: { type: Date, default: Date.now },
  platform: { type: String, default: 'web' },
  appVersion: { type: String, default: null },
  feed: { type: String, default: null },
  mint: { type: String, default: null },
  symbol: { type: String, default: null },
  // Coin shape at interaction time — the signal the recommender learns from.
  ageHours: { type: Number, default: null },
  marketCap: { type: Number, default: null },
  liquidity: { type: Number, default: null },
  volume24h: { type: Number, default: null },
  // Weight of the interaction for taste scoring (a buy counts more than a scroll).
  weight: { type: Number, default: 1 },
  durationMs: { type: Number, default: null },
  value: { type: Number, default: null },
  label: { type: String, default: null },
});

analyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: EVENT_TTL_DAYS * 24 * 60 * 60 });
analyticsEventSchema.index({ type: 1, ts: -1 });
analyticsEventSchema.index({ anonId: 1, ts: -1 });

const analyticsSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  anonId: { type: String, required: true, index: true },
  walletAddress: { type: String, default: null, index: true },
  platform: { type: String, default: 'web' },
  appVersion: { type: String, default: null },
  referralCode: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  lastEventAt: { type: Date, default: Date.now },
  lastEventType: { type: String, default: null },
  eventCount: { type: Number, default: 0 },
  scrollCount: { type: Number, default: 0 },
  coinsViewed: { type: Number, default: 0 },
  expandedCard: { type: Boolean, default: false },
  openedTradeWindow: { type: Boolean, default: false },
  connectedWallet: { type: Boolean, default: false },
  tradedSuccessfully: { type: Boolean, default: false },
});

analyticsSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: EVENT_TTL_DAYS * 24 * 60 * 60 });

module.exports = {
  AnalyticsEvent: mongoose.model('AnalyticsEvent', analyticsEventSchema),
  AnalyticsSession: mongoose.model('AnalyticsSession', analyticsSessionSchema),
};
