const { AnalyticsEvent } = require('../models/Analytics');

// How much each interaction says about what a user actually cares about.
// Server-side so a client can't inflate its own taste signal.
const EVENT_WEIGHTS = {
  coin_view: 1,
  chart_interact: 2,
  transactions_open: 2,
  top_traders_open: 2,
  card_expand: 3,
  coin_share: 4,
  trade_window_open: 5,
  coin_tracked: 6,
  order_created: 8,
  swap_success: 12,
};

// Buckets the recommender reasons about. Kept coarse on purpose — with few
// events per user, fine-grained buckets would just be noise.
const AGE_BUCKETS = [
  { key: 'fresh', maxHours: 1 },
  { key: 'hours', maxHours: 6 },
  { key: 'day', maxHours: 24 },
  { key: 'week', maxHours: 24 * 7 },
  { key: 'established', maxHours: Infinity },
];

const MCAP_BUCKETS = [
  { key: 'micro', max: 100_000 },
  { key: 'small', max: 1_000_000 },
  { key: 'mid', max: 10_000_000 },
  { key: 'large', max: Infinity },
];

function ageBucket(ageHours) {
  if (!Number.isFinite(ageHours) || ageHours < 0) return null;
  return AGE_BUCKETS.find(b => ageHours < b.maxHours).key;
}

function mcapBucket(marketCap) {
  if (!Number.isFinite(marketCap) || marketCap <= 0) return null;
  return MCAP_BUCKETS.find(b => marketCap < b.max).key;
}

function eventWeight(type) {
  return EVENT_WEIGHTS[type] || 0;
}

// Profiles are read on every feed load — cache so the feed never waits on Mongo.
const profileCache = new Map(); // key -> { at, profile }
const PROFILE_TTL_MS = 5 * 60 * 1000;
const PROFILE_WINDOW_DAYS = 14;
const PROFILE_CACHE_MAX = 2000;

function normalize(counts) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!total) return {};
  const out = {};
  for (const [k, n] of Object.entries(counts)) out[k] = n / total;
  return out;
}

/**
 * Weighted taste profile for one identity (device or wallet), derived from the
 * coins they actually engaged with. Shares sum to 1 per dimension.
 */
async function getTasteProfile({ anonId, walletAddress }) {
  const key = walletAddress ? `w:${walletAddress}` : `a:${anonId}`;
  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached.profile;

  const match = {
    ts: { $gte: new Date(Date.now() - PROFILE_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
    weight: { $gt: 0 },
  };
  if (walletAddress) match.walletAddress = walletAddress;
  else match.anonId = anonId;

  const rows = await AnalyticsEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: '$weight' },
        events: {
          $push: { w: '$weight', ageHours: '$ageHours', marketCap: '$marketCap', feed: '$feed' },
        },
      },
    },
    { $project: { total: 1, events: { $slice: ['$events', 4000] } } },
  ]).option({ maxTimeMS: 4000 });

  const age = {};
  const mcap = {};
  const feed = {};
  let sample = 0;

  for (const e of rows[0]?.events || []) {
    const w = Number(e.w) || 0;
    if (w <= 0) continue;
    sample += w;
    const a = ageBucket(Number(e.ageHours));
    if (a) age[a] = (age[a] || 0) + w;
    const m = mcapBucket(Number(e.marketCap));
    if (m) mcap[m] = (mcap[m] || 0) + w;
    if (e.feed) feed[e.feed] = (feed[e.feed] || 0) + w;
  }

  const profile = {
    sampleWeight: sample,
    // Ramps 0 → 1 over roughly 200 weighted interactions, so recommendations
    // only creep in once there's real signal.
    confidence: Math.min(1, sample / 200),
    age: normalize(age),
    marketCap: normalize(mcap),
    feed: normalize(feed),
  };

  if (profileCache.size > PROFILE_CACHE_MAX) profileCache.clear();
  profileCache.set(key, { at: Date.now(), profile });
  return profile;
}

function invalidateProfile({ anonId, walletAddress }) {
  if (walletAddress) profileCache.delete(`w:${walletAddress}`);
  if (anonId) profileCache.delete(`a:${anonId}`);
}

module.exports = {
  EVENT_WEIGHTS,
  eventWeight,
  ageBucket,
  mcapBucket,
  getTasteProfile,
  invalidateProfile,
};
