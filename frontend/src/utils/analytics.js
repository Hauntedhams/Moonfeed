import { API_CONFIG } from '../config/api';

// First-party interaction tracking. Events are queued in memory, flushed in
// small batches, and always flushed when the app is backgrounded/closed so a
// short session ("opened, scrolled 4 times, left") is never lost.

const ANON_KEY = 'moonfeed_anon_id';
const SESSION_KEY = 'moonfeed_analytics_session';
const SESSION_IDLE_MS = 30 * 60 * 1000; // a return after 30min idle is a new session
const FLUSH_INTERVAL_MS = 10000;
const FLUSH_AT_COUNT = 20;
const MAX_QUEUE = 200;

const ENDPOINT = `${API_CONFIG.BASE_URL}/api/analytics/events`;

let queue = [];
let flushTimer = null;
let walletAddress = null;
let started = false;

const uuid = () => (
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
);

const readStore = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStore = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

function getAnonId() {
  let id = readStore(ANON_KEY);
  if (!id) {
    id = uuid();
    writeStore(ANON_KEY, id);
  }
  return id;
}

function getSessionId() {
  const now = Date.now();
  let session = null;
  try { session = JSON.parse(readStore(SESSION_KEY) || 'null'); } catch { /* corrupt */ }
  if (!session?.id || !(now - Number(session.lastSeen) < SESSION_IDLE_MS)) {
    session = { id: uuid(), lastSeen: now };
  } else {
    session.lastSeen = now;
  }
  writeStore(SESSION_KEY, JSON.stringify(session));
  return session.id;
}

function getPlatform() {
  if (globalThis.Capacitor?.getPlatform) {
    try { return globalThis.Capacitor.getPlatform(); } catch { /* fall through */ }
  }
  return 'web';
}

function buildPayload() {
  return {
    sessionId: getSessionId(),
    anonId: getAnonId(),
    walletAddress,
    platform: getPlatform(),
    appVersion: import.meta.env?.VITE_APP_VERSION || null,
    referralCode: readStore('moonfeed_referral_code'),
    events: queue,
  };
}

function flush({ beacon = false } = {}) {
  if (!queue.length) return;
  const body = JSON.stringify(buildPayload());
  queue = [];

  if (beacon && navigator.sendBeacon) {
    // Content-Type must stay text/plain-ish for beacons; the backend only reads JSON body.
    try {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    } catch { /* fall back to fetch */ }
  }

  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => { /* analytics must never surface errors to the user */ });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Record one interaction. Extra fields (feed, mint, symbol, ageHours,
 * marketCap…) are what the recommender learns from.
 */
export function track(type, props = {}) {
  if (!type) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ type, ts: Date.now(), ...props });
  if (queue.length >= FLUSH_AT_COUNT) flush();
  else scheduleFlush();
}

/** Coin-shaped props for any event about a specific coin. */
export function coinProps(coin, extra = {}) {
  if (!coin) return extra;
  const createdAt = Number(coin.createdAt || coin.pairCreatedAt || coin.created_timestamp) || null;
  const ageHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3600000) : null;
  return {
    mint: coin.mintAddress || coin.address || coin.tokenAddress || null,
    symbol: coin.symbol || null,
    ageHours: Number.isFinite(coin.ageHours) ? coin.ageHours : ageHours,
    marketCap: Number(coin.market_cap_usd || coin.marketCap || coin.marketCapUsd) || null,
    liquidity: Number(coin.liquidity_usd || coin.liquidityUsd || coin.liquidity) || null,
    volume24h: Number(coin.volume_24h_usd || coin.volume24h) || null,
    ...extra,
  };
}

export function setAnalyticsWallet(address) {
  const next = address || null;
  if (next === walletAddress) return;
  walletAddress = next;
  if (next) track('wallet_connected');
}

export function getAnalyticsIdentity() {
  return { anonId: getAnonId(), walletAddress };
}

export function initAnalytics() {
  if (started) return;
  started = true;
  getSessionId(); // refresh/roll the session on launch
  track('app_open');

  const onHidden = () => {
    if (document.visibilityState === 'hidden') flush({ beacon: true });
  };
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', () => flush({ beacon: true }));
}
