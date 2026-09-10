import { API_CONFIG } from '../config/api';
import { getAnalyticsIdentity } from './analytics';

// Gently re-orders a feed toward the kinds of coins this user actually engages
// with (see backend/services/analyticsService.js for how the profile is built).
// The effect ramps in with the profile's confidence, so a new user sees the
// stock feed and a heavy user slowly gets more of what they pay attention to.

const REFRESH_MS = 10 * 60 * 1000;
const MAX_SHIFT = 10;     // most positions a single coin can move
const PINNED_HEAD = 1;    // never move the top coin — it's what the feed opened on

let profile = null;
let fetchedAt = 0;
let inFlight = null;

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

function coinAgeHours(coin) {
  const createdAt = Number(coin.createdAt || coin.pairCreatedAt || coin.created_timestamp) || 0;
  if (!createdAt) return null;
  return Math.max(0, (Date.now() - createdAt) / 3600000);
}

function bucketOf(buckets, value, field) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return buckets.find(b => value < b[field]).key;
}

export function refreshTasteProfile({ force = false } = {}) {
  if (!force && profile && Date.now() - fetchedAt < REFRESH_MS) return Promise.resolve(profile);
  if (inFlight) return inFlight;

  const { anonId, walletAddress } = getAnalyticsIdentity();
  const params = new URLSearchParams();
  if (anonId) params.set('anonId', anonId);
  if (walletAddress) params.set('wallet', walletAddress);

  inFlight = fetch(`${API_CONFIG.BASE_URL}/api/analytics/preferences?${params}`)
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (data?.profile) {
        profile = data.profile;
        fetchedAt = Date.now();
      }
      return profile;
    })
    .catch(() => profile)
    .finally(() => { inFlight = null; });

  return inFlight;
}

export function getTasteProfile() {
  // Kept warm in the background; ordering never blocks on the network.
  refreshTasteProfile();
  return profile;
}

/**
 * Returns a new array, mildly re-ranked toward the user's taste. Falls back to
 * the original order whenever there isn't enough signal to justify a change.
 */
export function personalizeCoins(coins) {
  const p = getTasteProfile();
  if (!Array.isArray(coins) || coins.length < 5) return coins;
  if (!p || !(p.confidence > 0.15)) return coins;

  const affinityOf = (coin) => {
    const age = bucketOf(AGE_BUCKETS, Number.isFinite(coin.ageHours) ? coin.ageHours : coinAgeHours(coin), 'maxHours');
    const mcap = bucketOf(MCAP_BUCKETS, Number(coin.market_cap_usd || coin.marketCap || coin.marketCapUsd), 'max');
    return 0.6 * (p.age?.[age] || 0) + 0.4 * (p.marketCap?.[mcap] || 0);
  };

  const scored = coins.map((coin, index) => ({ coin, index, affinity: affinityOf(coin) }));
  const baseline = scored.reduce((sum, s) => sum + s.affinity, 0) / scored.length;
  if (!(baseline > 0)) return coins;

  const head = scored.slice(0, PINNED_HEAD);
  const tail = scored.slice(PINNED_HEAD).sort((a, b) => {
    const shift = (s) => s.index - p.confidence * MAX_SHIFT * ((s.affinity - baseline) / baseline);
    return shift(a) - shift(b) || a.index - b.index;
  });

  return [...head, ...tail].map(s => s.coin);
}
