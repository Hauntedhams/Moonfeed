// Live X feed: polls a curated list of meme-coin-moving accounts through
// twitterapi.io (pay-per-call, ~$0.00015/call) and pairs every tweet with the
// pump.fun coins that launched right after it — ranked so the coin that links
// back to the tweet / was launched first sits on top.
//
// Cost model (twitterapi.io): every search call costs max(1, tweetsReturned)
// × $0.00015. Cost therefore scales with poll frequency, so tier-1 accounts are
// polled fast ONLY while someone has the X Tracker open; otherwise the poller
// idles down. A daily budget cap slows everything further if ever exceeded.
//
// Env: TWITTERAPI_IO_KEY (required — no-op without it)
//      X_FEED_FAST_SECONDS (tier-1 interval while viewers are connected, default 8)
//      X_FEED_IDLE_SECONDS (tier-1 interval with nobody watching, default 45)
//      X_FEED_DAILY_BUDGET_USD (default 1.5 ≈ $45/mo hard ceiling)
//      X_FEED_EXTRA_ACCOUNTS (see config/xFeedAccounts.js)

const mongoose = require('mongoose');
const { getTrackedAccounts } = require('../config/xFeedAccounts');
const pumpLaunchStream = require('./pumpLaunchStream');
const { getSolUsdPrice } = require('../utils/solPrice');

const API_KEY = process.env.TWITTERAPI_IO_KEY || '';
const SEARCH_URL = 'https://api.twitterapi.io/twitter/tweet/advanced_search';
const COST_PER_UNIT_USD = 0.00015;

const envSeconds = (name, fallback, min) => Math.max(min, Number(process.env[name]) || fallback);
const INTERVALS = {
  1: { fast: envSeconds('X_FEED_FAST_SECONDS', 8, 3), idle: envSeconds('X_FEED_IDLE_SECONDS', 45, 15) },
  2: { fast: 30, idle: 120 },
};
const DAILY_BUDGET_USD = Number(process.env.X_FEED_DAILY_BUDGET_USD) || 1.5;
const MAX_QUERY_CHARS = 450;
const MAX_TWEETS = 300;
const TWEET_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MATCH_WINDOW_BEFORE_MS = 60 * 1000;
const MATCH_WINDOW_AFTER_MS = 30 * 60 * 1000;
const MAX_COINS_PER_TWEET = 6;
const BOOT_BACKFILL_MS = 10 * 60 * 1000;

const CRYPTO_RE = /\b(solana|sol|pump\.?fun|memecoin|meme coin|token|ticker|ca|contract|launch(ed|ing)?|airdrop|coin|degen|jupiter|phantom|dex|bonding curve|mcap|market cap|bullish|bearish|wagmi|ngmi|gm|lfg|send it|chart)\b/i;
const GENERIC_WORDS = new Set([
  'the', 'and', 'for', 'you', 'are', 'this', 'that', 'with', 'from', 'what', 'when', 'why', 'how', 'who',
  'just', 'not', 'but', 'all', 'now', 'new', 'can', 'will', 'its', 'our', 'your', 'has', 'have', 'was',
  'one', 'out', 'get', 'got', 'more', 'most', 'very', 'much', 'here', 'there', 'they', 'them', 'then',
  'usa', 'ceo', 'cto', 'etf', 'lol', 'lmao', 'imo', 'tbh', 'wtf', 'omg', 'yes', 'yeah', 'okay', 'today',
  'breaking', 'update', 'news', 'just in', 'thread', 'video', 'watch', 'live', 'people', 'time', 'day',
  'crypto', 'coin', 'token', 'meme', 'solana', 'bitcoin', 'ethereum', 'rt', 'via', 'amp', 'https',
]);

const accounts = getTrackedAccounts();
const accountByHandle = new Map(accounts.map((a) => [a.handle.toLowerCase(), a]));

const tweets = new Map(); // tweetId -> tweet (newest inserted last)
const termIndex = new Map(); // term -> Set<tweetId>, recent tweets only
const sseClients = new Set();
let groups = [];
let started = false;
let spend = { day: '', usd: 0, calls: 0, tweets: 0 };

function isEnabled() {
  return Boolean(API_KEY);
}

// ── Budget ───────────────────────────────────────────────────────────────────

function recordSpend(tweetCount) {
  const day = new Date().toISOString().slice(0, 10);
  if (spend.day !== day) {
    if (spend.day) console.log(`🐦 [x-feed] ${spend.day} spend ~$${spend.usd.toFixed(3)} (${spend.calls} calls, ${spend.tweets} tweets)`);
    spend = { day, usd: 0, calls: 0, tweets: 0 };
  }
  spend.calls += 1;
  spend.tweets += tweetCount;
  spend.usd += Math.max(1, tweetCount) * COST_PER_UNIT_USD;
}

function intervalMsFor(tier) {
  const { fast, idle } = INTERVALS[tier];
  let seconds = sseClients.size > 0 ? fast : idle;
  if (spend.usd >= DAILY_BUDGET_USD) seconds = Math.max(seconds, idle) * 2;
  return seconds * 1000;
}

// ── Text analysis ────────────────────────────────────────────────────────────

function normalizeTerm(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const compact = (value) => normalizeTerm(value).replace(/ /g, '');

function extractSignals(text) {
  const raw = String(text || '');
  const cashtags = [...raw.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,14})\b/g)].map((m) => m[1]);
  const contractAddresses = [...raw.matchAll(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)]
    .map((m) => m[0])
    .filter((ca) => /\d/.test(ca) && /[a-z]/.test(ca) && /[A-Z]/.test(ca));
  const hashtags = [...raw.matchAll(/#([A-Za-z][A-Za-z0-9_]{1,30})/g)].map((m) => m[1]);
  const shouting = [...raw.matchAll(/\b[A-Z][A-Z0-9]{2,11}\b/g)].map((m) => m[0]);
  const quoted = [...raw.matchAll(/["“]([^"”]{3,32})["”]/g)].map((m) => m[1]);
  const capitalizedRuns = [...raw.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,2})\b/g)].map((m) => m[1]);
  const midSentenceCaps = [...raw.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]{3,})\b/gm)].map((m) => m[1]);

  const terms = new Set();
  for (const value of [...cashtags, ...hashtags, ...shouting, ...quoted, ...capitalizedRuns, ...midSentenceCaps]) {
    const term = normalizeTerm(value);
    if (term.length >= 3 && !GENERIC_WORDS.has(term)) terms.add(term);
  }
  return { cashtags: [...new Set(cashtags.map((c) => c.toUpperCase()))], contractAddresses: [...new Set(contractAddresses)], terms: [...terms] };
}

// ── Tweet normalization ──────────────────────────────────────────────────────

function mediaOf(raw) {
  const media = raw?.extendedEntities?.media || raw?.extended_entities?.media || raw?.entities?.media || [];
  return media
    .map((m) => ({ url: m.media_url_https || m.media_url || '', type: m.type || 'photo' }))
    .filter((m) => /^https:\/\//.test(m.url))
    .slice(0, 4);
}

function expandedText(raw) {
  let text = String(raw?.text || '');
  for (const u of raw?.entities?.urls || []) {
    if (u.url && u.expanded_url) text = text.split(u.url).join(u.expanded_url);
  }
  return text.replace(/\s*https:\/\/t\.co\/\w+\s*$/g, '').trim();
}

function authorOf(raw) {
  const a = raw?.author || {};
  return {
    handle: a.userName || a.screen_name || '',
    name: a.name || a.userName || '',
    avatar: a.profilePicture || null,
    followers: Number(a.followers) || 0,
    blueVerified: Boolean(a.isBlueVerified),
  };
}

function normalizeQuoted(raw) {
  if (!raw?.id) return null;
  const author = authorOf(raw);
  return {
    id: String(raw.id),
    url: raw.url || `https://x.com/${author.handle}/status/${raw.id}`,
    text: expandedText(raw).slice(0, 600),
    author,
    media: mediaOf(raw),
  };
}

function relevanceOf(tweet, account) {
  const s = tweet.signals;
  let score = account?.tier === 1 ? 3 : 1;
  if (s.cashtags.length) score += 4;
  if (s.contractAddresses.length) score += 6;
  if (CRYPTO_RE.test(tweet.text) || CRYPTO_RE.test(tweet.quoted?.text || '')) score += 2;
  if (tweet.media.length) score += 1;
  if (tweet.metrics.likes > 1000) score += 2;
  else if (tweet.metrics.likes > 100) score += 1;
  if (tweet.coins.length) score += 5;
  if (tweet.coins.some((c) => c.verification)) score += 5;
  return score;
}

function normalizeTweet(raw) {
  const author = authorOf(raw);
  const account = accountByHandle.get(author.handle.toLowerCase());
  const text = expandedText(raw);
  const quoted = normalizeQuoted(raw.quoted_tweet);
  const createdAtMs = Date.parse(raw.createdAt) || Date.now();
  const signals = extractSignals(`${text}\n${quoted?.text || ''}`);

  const tweet = {
    id: String(raw.id),
    url: raw.url || `https://x.com/${author.handle}/status/${raw.id}`,
    text: text.slice(0, 1200),
    createdAtMs,
    seenAtMs: Date.now(),
    author: { ...author, category: account?.category || 'kol', label: account?.label || '', tier: account?.tier || 2 },
    kind: raw.isReply ? 'reply' : quoted ? 'quote' : 'post',
    replyTo: raw.isReply ? (raw.inReplyToUsername || null) : null,
    quoted,
    media: mediaOf(raw),
    metrics: {
      likes: Number(raw.likeCount) || 0,
      retweets: Number(raw.retweetCount) || 0,
      replies: Number(raw.replyCount) || 0,
      views: Number(raw.viewCount) || 0,
    },
    signals,
    coins: [],
  };
  tweet.relevance = relevanceOf(tweet, account);
  tweet.lowSignal = tweet.kind === 'reply' && tweet.relevance < 5;
  return tweet;
}

// ── Coin matching ────────────────────────────────────────────────────────────

let coinPoolGetter = null;
function setCoinPoolGetter(fn) { coinPoolGetter = fn; }

function scoreLaunch(launch, terms) {
  const sym = compact(launch.symbol);
  const name = normalizeTerm(launch.name);
  const nameCompact = name.replace(/ /g, '');
  const nameWords = new Set(name.split(' '));
  let best = null;
  for (const term of terms) {
    const termCompact = term.replace(/ /g, '');
    let score = 0;
    if (sym && sym === termCompact) score = 10;
    else if (nameCompact && nameCompact === termCompact) score = 9;
    else if (termCompact.length >= 4 && nameWords.has(term)) score = 5;
    else if (termCompact.length >= 5 && nameCompact.includes(termCompact)) score = 5;
    if (score && (!best || score > best.score)) best = { score, term };
  }
  return best;
}

function verificationFor(tweet, launch, metadata) {
  if (tweet.signals.contractAddresses.includes(launch.mint)) return 'ca';
  if (!metadata) return null;
  const links = `${metadata.twitter} ${metadata.website}`.toLowerCase();
  if (links.includes(`/status/${tweet.id}`)) return 'linked';
  if (tweet.quoted && links.includes(`/status/${tweet.quoted.id}`)) return 'linked';
  const handle = tweet.author.handle.toLowerCase();
  if (handle && new RegExp(`(x|twitter)\\.com/${handle}(?![a-z0-9_])`).test(links)) return 'author';
  return null;
}

const VERIFICATION_RANK = { ca: 3, linked: 2, author: 1 };

function rankCoins(coins) {
  const launchCoins = coins.filter((c) => c.source === 'launch').sort((a, b) => a.launchedAt - b.launchedAt);
  if (launchCoins.length) launchCoins[0].isFirst = true;
  return coins
    .sort((a, b) =>
      (VERIFICATION_RANK[b.verification] || 0) - (VERIFICATION_RANK[a.verification] || 0)
      || (a.source === 'pool') - (b.source === 'pool')
      || b.matchScore - a.matchScore
      || (a.launchedAt || 0) - (b.launchedAt || 0))
    .slice(0, MAX_COINS_PER_TWEET);
}

async function launchToCoin(tweet, launch, match, solUsd) {
  const metadata = await pumpLaunchStream.getMetadata(launch.mint);
  return {
    mintAddress: launch.mint,
    symbol: launch.symbol,
    name: launch.name,
    image: metadata?.image || null,
    source: 'launch',
    launchedAt: launch.launchedAt,
    secondsAfterTweet: Math.round((launch.launchedAt - tweet.createdAtMs) / 1000),
    market_cap_usd: Math.round(launch.marketCapSol * solUsd),
    matchedTerm: match.term,
    matchScore: match.score,
    verification: verificationFor(tweet, launch, metadata),
    twitter: metadata?.twitter || '',
  };
}

function poolMatches(tweet) {
  const pool = (typeof coinPoolGetter === 'function' ? coinPoolGetter() : []) || [];
  if (!pool.length) return [];
  const wanted = new Set(tweet.signals.cashtags.map((c) => c.toLowerCase()));
  const cas = new Set(tweet.signals.contractAddresses);
  const bySymbol = new Map();
  for (const coin of pool) {
    const mint = coin?.mintAddress;
    if (!mint) continue;
    const isCa = cas.has(mint);
    const sym = String(coin.symbol || '').toLowerCase();
    if (!isCa && !wanted.has(sym)) continue;
    const key = isCa ? `ca:${mint}` : sym;
    const prev = bySymbol.get(key);
    if (!prev || (Number(coin.volume_24h_usd) || 0) > (Number(prev.volume_24h_usd) || 0)) bySymbol.set(key, coin);
  }
  return [...bySymbol.values()].map((coin) => ({
    mintAddress: coin.mintAddress,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image || coin.profileImage || coin.logo || null,
    banner: coin.banner || coin.header || null,
    pairAddress: coin.pairAddress || null,
    source: 'pool',
    market_cap_usd: Number(coin.market_cap_usd) || 0,
    priceChange24h: Number(coin.priceChange24h ?? coin.change_24h) || 0,
    matchedTerm: String(coin.symbol || '').toLowerCase(),
    matchScore: cas.has(coin.mintAddress) ? 12 : 8,
    verification: cas.has(coin.mintAddress) ? 'ca' : null,
  }));
}

async function matchTweet(tweet) {
  const terms = tweet.signals.terms;
  const solUsd = await getSolUsdPrice();
  const candidates = [];
  const launches = pumpLaunchStream.getLaunchesBetween(
    tweet.createdAtMs - MATCH_WINDOW_BEFORE_MS,
    tweet.createdAtMs + MATCH_WINDOW_AFTER_MS,
  );
  for (const launch of launches) {
    const isCa = tweet.signals.contractAddresses.includes(launch.mint);
    const match = isCa ? { score: 12, term: 'ca' } : terms.length ? scoreLaunch(launch, terms) : null;
    if (match) candidates.push({ launch, match });
  }
  const launchCoins = await Promise.all(
    candidates
      .sort((a, b) => b.match.score - a.match.score || a.launch.launchedAt - b.launch.launchedAt)
      .slice(0, 20)
      .map(({ launch, match }) => launchToCoin(tweet, launch, match, solUsd)),
  );
  tweet.coins = rankCoins([...launchCoins, ...poolMatches(tweet)]);
}

function indexTerms(tweet) {
  const keys = new Set(tweet.signals.contractAddresses);
  for (const term of tweet.signals.terms) {
    keys.add(term);
    keys.add(term.replace(/ /g, ''));
  }
  for (const key of keys) {
    if (!termIndex.has(key)) termIndex.set(key, new Set());
    termIndex.get(key).add(tweet.id);
  }
}

// A coin launched AFTER we saw the tweet — re-check just the tweets whose
// terms it could match instead of rescanning everything.
async function handleLaunch(launch) {
  const keys = new Set([compact(launch.symbol), normalizeTerm(launch.name), compact(launch.name), launch.mint]);
  for (const word of normalizeTerm(launch.name).split(' ')) if (word.length >= 4) keys.add(word);

  const affected = new Set();
  for (const key of keys) {
    for (const id of termIndex.get(key) || []) affected.add(id);
  }
  const cutoff = Date.now() - MATCH_WINDOW_AFTER_MS;
  for (const id of affected) {
    const tweet = tweets.get(id);
    if (!tweet || tweet.createdAtMs < cutoff || tweet.coins.some((c) => c.mintAddress === launch.mint)) continue;
    const isCa = tweet.signals.contractAddresses.includes(launch.mint);
    const match = isCa ? { score: 12, term: 'ca' } : scoreLaunch(launch, tweet.signals.terms);
    if (!match) continue;
    const coin = await launchToCoin(tweet, launch, match, await getSolUsdPrice());
    tweet.coins = rankCoins([...tweet.coins.map((c) => ({ ...c, isFirst: false })), coin]);
    tweet.relevance = relevanceOf(tweet, accountByHandle.get(tweet.author.handle.toLowerCase()));
    tweet.lowSignal = tweet.kind === 'reply' && tweet.relevance < 5;
    broadcast('update', tweet);
    persist(tweet);
  }
}

// ── Storage ──────────────────────────────────────────────────────────────────

function rememberTweet(tweet) {
  tweets.set(tweet.id, tweet);
  indexTerms(tweet);
  while (tweets.size > MAX_TWEETS) {
    const oldestId = tweets.keys().next().value;
    tweets.delete(oldestId);
  }
}

function pruneTermIndex() {
  const cutoff = Date.now() - MATCH_WINDOW_AFTER_MS;
  for (const [term, ids] of termIndex) {
    for (const id of ids) {
      const t = tweets.get(id);
      if (!t || t.createdAtMs < cutoff) ids.delete(id);
    }
    if (!ids.size) termIndex.delete(term);
  }
}

function dbReady() {
  return mongoose.connection.readyState === 1;
}

function persist(tweet) {
  if (!dbReady()) return;
  const XFeedTweet = require('../models/XFeedTweet');
  XFeedTweet.updateOne(
    { tweetId: tweet.id },
    { $set: { createdAtMs: tweet.createdAtMs, doc: tweet, expireAt: new Date(tweet.createdAtMs + TWEET_TTL_MS) } },
    { upsert: true },
  ).catch((err) => console.warn(`[x-feed] persist failed: ${err.message}`));
}

async function loadPersisted() {
  if (!dbReady()) return;
  const XFeedTweet = require('../models/XFeedTweet');
  const docs = await XFeedTweet.find({}).sort({ createdAtMs: -1 }).limit(MAX_TWEETS).lean();
  for (const { doc } of docs.reverse()) {
    if (doc?.id && doc.signals) rememberTweet(doc);
  }
  console.log(`🐦 [x-feed] restored ${docs.length} tweets from Mongo`);
}

// ── Polling ──────────────────────────────────────────────────────────────────

function buildGroups() {
  const out = [];
  for (const tier of [1, 2]) {
    let handles = [];
    const flush = () => {
      if (handles.length) out.push({ tier, handles, sinceSec: Math.floor((Date.now() - BOOT_BACKFILL_MS) / 1000), timer: null, busy: false, backoffUntil: 0 });
      handles = [];
    };
    for (const account of accounts.filter((a) => a.tier === tier)) {
      const next = [...handles, account.handle];
      if (next.map((h) => `from:${h}`).join(' OR ').length > MAX_QUERY_CHARS) flush();
      handles.push(account.handle);
    }
    flush();
  }
  return out;
}

async function searchPage(query, cursor) {
  const params = new URLSearchParams({ query, queryType: 'Latest' });
  if (cursor) params.set('cursor', cursor);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${SEARCH_URL}?${params}`, { headers: { 'X-API-Key': API_KEY }, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = new Error(`twitterapi.io ${res.status}: ${body.slice(0, 200)}`);
      error.status = res.status;
      throw error;
    }
    const json = await res.json();
    const page = Array.isArray(json?.tweets) ? json.tweets : [];
    recordSpend(page.length);
    return { tweets: page, next: json?.has_next_page ? json.next_cursor : null };
  } finally {
    clearTimeout(timer);
  }
}

async function pollGroup(group) {
  if (group.busy || Date.now() < group.backoffUntil) return;
  group.busy = true;
  try {
    const query = `(${group.handles.map((h) => `from:${h}`).join(' OR ')}) since_time:${group.sinceSec}`;
    let { tweets: page, next } = await searchPage(query);
    if (page.length >= 20 && next) {
      const more = await searchPage(query, next);
      page = page.concat(more.tweets);
    }

    const fresh = page
      .filter((raw) => raw?.id && !tweets.has(String(raw.id)))
      .map(normalizeTweet)
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (const raw of page) {
      const sec = Math.floor((Date.parse(raw?.createdAt) || 0) / 1000);
      if (sec > group.sinceSec) group.sinceSec = sec;
    }

    for (const tweet of fresh) {
      await matchTweet(tweet);
      tweet.relevance = relevanceOf(tweet, accountByHandle.get(tweet.author.handle.toLowerCase()));
      tweet.lowSignal = tweet.kind === 'reply' && tweet.relevance < 5;
      rememberTweet(tweet);
      broadcast('tweet', tweet);
      persist(tweet);
    }
    if (fresh.length) console.log(`🐦 [x-feed] +${fresh.length} tweet(s) tier${group.tier} (spend today ~$${spend.usd.toFixed(3)})`);
  } catch (err) {
    const wait = err.status === 402 || err.status === 401 ? 10 * 60 * 1000 : 60 * 1000;
    group.backoffUntil = Date.now() + wait;
    console.warn(`[x-feed] poll tier${group.tier} failed (${err.message}) — backing off ${wait / 1000}s`);
  } finally {
    group.busy = false;
  }
}

function schedule(group) {
  clearTimeout(group.timer);
  group.timer = setTimeout(async () => {
    await pollGroup(group);
    schedule(group);
  }, intervalMsFor(group.tier));
}

let lastViewerKick = 0;
function kickFastPolling() {
  if (Date.now() - lastViewerKick < 10000) return;
  lastViewerKick = Date.now();
  for (const group of groups) {
    if (group.tier !== 1) continue;
    pollGroup(group).finally(() => schedule(group));
  }
}

async function start() {
  if (started || !isEnabled()) {
    if (!isEnabled()) console.log('🐦 [x-feed] disabled (TWITTERAPI_IO_KEY not set)');
    return;
  }
  started = true;
  pumpLaunchStream.start();
  pumpLaunchStream.onLaunch((launch) => {
    handleLaunch(launch).catch((err) => console.warn(`[x-feed] launch match failed: ${err.message}`));
  });
  try { await loadPersisted(); } catch (err) { console.warn(`[x-feed] restore failed: ${err.message}`); }

  groups = buildGroups();
  console.log(`🐦 [x-feed] tracking ${accounts.length} accounts in ${groups.length} queries (tier1 ${INTERVALS[1].fast}s live / ${INTERVALS[1].idle}s idle, budget $${DAILY_BUDGET_USD}/day)`);
  groups.forEach((group, i) => setTimeout(() => pollGroup(group).finally(() => schedule(group)), i * 1500));
  setInterval(pruneTermIndex, 5 * 60 * 1000).unref();
  setInterval(heartbeat, 25000).unref();
}

// ── Delivery ─────────────────────────────────────────────────────────────────

function getFeed({ limit = 80 } = {}) {
  const list = [...tweets.values()].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, Math.min(200, limit));
  return {
    enabled: isEnabled(),
    tweets: list,
    accounts: accounts.map(({ handle, label, category, tier }) => ({ handle, label, category, tier })),
    launchStream: pumpLaunchStream.getStats().connected,
  };
}

function writeFrame(res, frame) {
  try {
    res.write(frame);
    // compression() middleware buffers otherwise — SSE must go out immediately
    res.flush?.();
  } catch {
    sseClients.delete(res);
  }
}

function broadcast(event, payload) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) writeFrame(res, frame);
}

function heartbeat() {
  for (const res of sseClients) writeFrame(res, ': ping\n\n');
}

function attachStream(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  sseClients.add(res);
  writeFrame(res, 'retry: 3000\n\n');
  if (isEnabled()) kickFastPolling();
  req.on('close', () => sseClients.delete(res));
}

function getStatus() {
  return {
    enabled: isEnabled(),
    viewers: sseClients.size,
    tweetsCached: tweets.size,
    groups: groups.map((g) => ({ tier: g.tier, accounts: g.handles.length, sinceSec: g.sinceSec, backoffUntil: g.backoffUntil })),
    spend,
    dailyBudgetUsd: DAILY_BUDGET_USD,
    launchStream: pumpLaunchStream.getStats(),
  };
}

module.exports = { start, isEnabled, getFeed, attachStream, getStatus, setCoinPoolGetter };
