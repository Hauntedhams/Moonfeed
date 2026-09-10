// X (Twitter) trends tracker — asks Grok (xAI Responses API + x_search tool)
// for the events trending on X right now, then matches each event's keywords
// against the coin pools the server already maintains (dextrending/whalefeed/
// trending/new). One Grok call serves ALL users (cached), so cost is per-
// refresh, not per-user.
//
// ⚠️ COST NOTE: xAI's old "Live Search" chat-completions API was deprecated
// (410) in favor of the Responses API (`/v1/responses`) with built-in tools.
// x_search is billed at $5 per 1,000 calls PLUS normal token cost — a single
// refresh here costs ~$0.015-0.02 (measured live with tool_choice:'required',
// which is REQUIRED — without it the model often skips searching and just
// recalls stale training-data "trends" for ~$0.004 instead). At the default
// 60-min refresh that's ~$0.50/day (~$15/month). Do NOT drop REFRESH_MS much
// below 30-60 min without budget headroom — a 10-min refresh would cost
// ~$70-100/month.
//
// Env: XAI_API_KEY (required — service is a safe no-op without it),
//      XAI_MODEL (optional, default a non-reasoning model — reasoning tokens
//      are billed too and add nothing for this JSON-extraction task),
//      X_TRENDS_REFRESH_MINUTES (optional, default 60).

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.20-0309-non-reasoning';
const XAI_URL = 'https://api.x.ai/v1/responses';
const xNewsAlertService = require('./xNewsAlertService');

const REFRESH_MINUTES = Math.max(15, parseInt(process.env.X_TRENDS_REFRESH_MINUTES, 10) || 60);
const REFRESH_MS = REFRESH_MINUTES * 60 * 1000; // fresh window
const STALE_MAX_MS = 6 * 60 * 60 * 1000;         // serve-on-error ceiling
const MAX_EVENTS_PER_PASS = 8;
const MAX_EVENTS_TOTAL = 14;
const MIN_CRYPTO_EVENTS_TOTAL = 6;
const MAX_COINS_PER_EVENT = 6;

// Generic words that would false-positive against half the coin pool.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'has', 'have', 'are',
  'was', 'were', 'will', 'been', 'its', 'his', 'her', 'their', 'about', 'into',
  'new', 'news', 'live', 'today', 'breaking', 'update', 'updates', 'trending',
  'trend', 'viral', 'world', 'people', 'video', 'watch', 'crypto', 'coin',
  'token', 'meme', 'solana', 'usa', 'not', 'out', 'over', 'all', 'now', 'big',
]);

let coinPoolGetter = null; // wired by server.js
let cache = { trends: [], updatedAt: 0, model: XAI_MODEL };
let refreshPromise = null;
let lastError = null;

function setCoinPoolGetter(fn) {
  coinPoolGetter = fn;
}

function isEnabled() {
  return Boolean(XAI_API_KEY);
}

// ── Grok call ────────────────────────────────────────────────────────────────

// Phrasing matters a lot here: mentioning "meme coin app" up front nudges the
// model toward free-associating plausible trends instead of actually
// researching — measured live, this exact research-first framing reliably
// triggers a real x_search where a "for a meme coin app" framing did not.
const EVENT_SCHEMA = `Return ONLY a JSON array (no markdown fences, no prose) of up to ${MAX_EVENTS_PER_PASS} objects:
[
  {
    "topic": "short topic name (2-5 words)",
    "headline": "news-style headline",
    "summary": "2-3 sentence plain-language summary of what happened and why it's trending",
    "category": "politics | celebrity | sports | tech | finance | culture | world | crypto",
    "momentum": 1-100 (how fast this is trending right now),
    "eventTime": "best estimate of when the underlying event happened, relative to now (e.g. '2 hours ago', 'yesterday', 'this morning') based on the posts you found",
    "eventType": "coin_launch | coin_move | news | viral",
    "sourceType": "official | reported | unknown",
    "sourceUrl": "direct X URL for the strongest source post, preferably the official account's post, or empty string",
    "keywords": ["5-10 single words or short names people/memes would name a coin after — names, nicknames, catchphrases, hashtag words"],
    "hashtags": ["up to 3 trending hashtags, without #"]
  }
]
Order by momentum descending. Keywords must be specific (proper nouns, slang from
the event) — never generic words like "news" or "video".`;

// Phrasing matters a lot here: mentioning "meme coin app" up front nudges the
// model toward free-associating plausible trends instead of actually
// researching — measured live, this exact research-first framing reliably
// triggers a real x_search where a "for a meme coin app" framing did not.
const GROK_PROMPT = `You are a trend analyst. Search X (Twitter) for what is trending
right now (last 24 hours, high engagement): world events, politics,
celebrity/cultural moments, sports, tech, viral internet phenomena. Use AT MOST
3 X searches total, then stop searching and answer.

${EVENT_SCHEMA}`;

// Dedicated second pass — the general pass above rarely surfaces niche crypto
// stories (a celebrity/politically-linked coin launch, a viral pump.fun token,
// crypto-Twitter drama) since they compete against much bigger world/politics
// stories for the model's limited search budget. This pass searches ONLY
// crypto/meme-coin Twitter specifically so those stories aren't missed.
const GROK_CRYPTO_PROMPT = `You are a crypto-Twitter analyst. Search X (Twitter) for what is
trending RIGHT NOW specifically in crypto / Solana meme-coin culture (last 24
hours, high engagement): new pump.fun / Solana meme coin launches tied to a
person, meme, or news event; celebrity or politically-linked coin drama;
viral crypto-Twitter moments; big coin pumps/dumps driven by a real-world
event; crypto CEO/founder/exchange/protocol posts people are reacting to; and
fresh memes or ticker narratives spreading through crypto accounts. Prioritize
specific stories that could create or move meme coins over broad market takes.
Coins announced by the person or organization on their own official X account
are highest priority; include that exact post as sourceUrl when you find one.
Use AT MOST 4 X searches total (try queries like "pump.fun", "solana meme coin",
"new coin launched", "crypto CEO", "Binance Coinbase Solana meme", a trending
name + "coin"), then stop searching and answer. Skip generic market analysis —
only report events tied to a SPECIFIC person/meme/news/crypto-industry moment.

${EVENT_SCHEMA}`;

const FORCE_SEARCH_SUFFIX = `

MANDATORY: call the x_search tool at least once before answering — do not answer
from memory alone. Your training data is stale; only real, freshly-searched X
posts count as "trending right now".`;

async function callXai(promptText) {
  const res = await fetch(XAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input: [{ role: 'user', content: promptText }],
      tools: [{ type: 'x_search' }],
      // 'required' is only a soft bias for agentic search tools, not a hard
      // guarantee (measured: same prompt sometimes searches, sometimes
      // recalls stale training-data "trends" instead) — see the retry below.
      tool_choice: 'required',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`xAI ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function runPass(prompt, label) {
  let json = await callXai(prompt);
  let toolCalls = json?.usage?.num_server_side_tools_used || 0;
  let totalCostUsd = (json?.usage?.cost_in_usd_ticks || 0) / 1e10;

  // A 0-tool-call response means the model answered from stale training data
  // instead of actually searching — retry once with a stronger directive.
  if (toolCalls === 0) {
    console.warn(`🐦 [x-trends] ${label} pass skipped search (stale data) — retrying with a stronger directive`);
    json = await callXai(prompt + FORCE_SEARCH_SUFFIX);
    toolCalls = json?.usage?.num_server_side_tools_used || 0;
    totalCostUsd += (json?.usage?.cost_in_usd_ticks || 0) / 1e10;
  }

  console.log(`🐦 [x-trends] ${label} pass cost ~$${totalCostUsd.toFixed(4)} (${toolCalls} tool calls, live search ${toolCalls > 0 ? 'used' : 'NOT used — results may be stale'})`);

  const messageItems = (json?.output || []).filter((o) => o.type === 'message');
  const lastMessage = messageItems[messageItems.length - 1];
  const content = lastMessage?.content?.[0]?.text || '';
  const citations = messageItems.flatMap((m) =>
    (m.content?.[0]?.annotations || [])
      .filter((a) => a.type === 'url_citation')
      .map((a) => a.url)
  );

  return { events: parseEventsJson(content), citations, liveSearchUsed: toolCalls > 0, costUsd: totalCostUsd };
}

function dedupeEvents(events) {
  const seen = new Set();
  const out = [];
  for (const event of events) {
    const key = normalize(event.topic).split(' ').filter((w) => w.length > 3).slice(0, 3).join(' ');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(event);
  }
  return out;
}

function isCryptoSpaceEvent(event) {
  const haystack = normalize([
    event.category,
    event.eventType,
    event.topic,
    event.headline,
    event.summary,
    ...(event.keywords || []),
    ...(event.hashtags || []),
  ].join(' '));
  return event.category === 'crypto'
    || event.eventType === 'coin_launch'
    || event.eventType === 'coin_move'
    || /\b(crypto|solana|pumpfun|pump fun|pump\.fun|meme coin|memecoin|coinbase|binance|kraken|bybit|okx|jupiter|phantom|solflare|wallet|token|launch|ticker|cto|ceo|founder|vitalik|cz|brian armstrong|anatoly|mert)\b/.test(haystack);
}

function trendPriority(event) {
  const momentum = Number(event.momentum) || 0;
  let boost = 0;
  if (event.category === 'crypto') boost += 24;
  if (event.eventType === 'coin_launch') boost += 18;
  if (event.eventType === 'coin_move') boost += 14;
  if (event.sourceType === 'official') boost += 5;
  return momentum + boost;
}

function prioritizeEvents(events) {
  const sorted = [...events].sort((a, b) => trendPriority(b) - trendPriority(a));
  const cryptoEvents = sorted.filter(isCryptoSpaceEvent);
  const otherEvents = sorted.filter((event) => !isCryptoSpaceEvent(event));
  const head = cryptoEvents.slice(0, MIN_CRYPTO_EVENTS_TOTAL);
  const remainder = [...cryptoEvents.slice(head.length), ...otherEvents]
    .sort((a, b) => trendPriority(b) - trendPriority(a));
  return [...head, ...remainder].slice(0, MAX_EVENTS_TOTAL);
}

function trendDisplayScore(trend) {
  const coinMatch = trend.coins?.[0]?.matchScore || 0;
  const coinCount = trend.coins?.length || 0;
  return trendPriority(trend)
    + Math.min(22, coinMatch * 2.5)
    + Math.min(10, coinCount * 2);
}

function prioritizeMatchedTrends(trends) {
  const sorted = [...trends].sort((a, b) => trendDisplayScore(b) - trendDisplayScore(a));
  const cryptoHead = sorted.filter(isCryptoSpaceEvent).slice(0, MIN_CRYPTO_EVENTS_TOTAL);
  const cryptoIds = new Set(cryptoHead.map((trend) => trend.id));
  const rest = sorted.filter((trend) => !cryptoIds.has(trend.id));
  return [...cryptoHead, ...rest].slice(0, MAX_EVENTS_TOTAL);
}

async function fetchGrokTrends() {
  // Run both passes in parallel — general world/culture trends + a dedicated
  // crypto/meme-coin-specific pass (catches niche stories the general pass
  // loses to bigger news, e.g. a celebrity-linked coin launch).
  const results = await Promise.allSettled([
    runPass(GROK_PROMPT, 'general'),
    runPass(GROK_CRYPTO_PROMPT, 'crypto'),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!ok.length) throw results[0].reason;

  const merged = prioritizeEvents(dedupeEvents(ok.flatMap((r) => r.events)));
  const citations = ok.flatMap((r) => r.citations);
  const liveSearchUsed = ok.some((r) => r.liveSearchUsed);
  const totalCostUsd = ok.reduce((n, r) => n + r.costUsd, 0);

  console.log(`🐦 [x-trends] combined: ${merged.length} events (${ok.length}/2 passes ok), ~$${totalCostUsd.toFixed(4)} total`);

  return { events: merged, citations, liveSearchUsed };
}

function parseEventsJson(content) {
  // Models sometimes wrap JSON in fences or add a preamble — extract the array.
  let text = String(content).trim()
    .replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON array in Grok response');
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('Grok response is not an array');

  return arr.slice(0, MAX_EVENTS_PER_PASS).map((e, i) => {
    const eventType = String(e.eventType || '').toLowerCase();
    const sourceType = String(e.sourceType || '').toLowerCase();
    return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`,
    topic: String(e.topic || '').slice(0, 80),
    headline: String(e.headline || e.topic || '').slice(0, 160),
    summary: String(e.summary || '').slice(0, 600),
    category: String(e.category || 'culture').toLowerCase(),
    momentum: Math.max(1, Math.min(100, parseInt(e.momentum, 10) || 50)),
    eventTime: String(e.eventTime || '').slice(0, 40),
    eventType: ['coin_launch', 'coin_move', 'news', 'viral'].includes(eventType) ? eventType : 'news',
    sourceType: ['official', 'reported', 'unknown'].includes(sourceType) ? sourceType : 'unknown',
    sourceUrl: /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i.test(String(e.sourceUrl || ''))
      ? String(e.sourceUrl).slice(0, 500)
      : '',
    keywords: (Array.isArray(e.keywords) ? e.keywords : [])
      .map((k) => String(k).trim()).filter(Boolean).slice(0, 12),
    hashtags: (Array.isArray(e.hashtags) ? e.hashtags : [])
      .map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3),
    };
  }).filter((e) => e.topic && e.summary);
}

// ── Coin matching ────────────────────────────────────────────────────────────

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchCoinsForEvent(event, pool) {
  const terms = [...new Set(
    [...event.keywords, ...event.hashtags, ...normalize(event.topic).split(' ')]
      .map(normalize)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  )];
  if (!terms.length) return [];

  const scored = [];
  for (const coin of pool) {
    const symbol = normalize(coin.symbol);
    const name = normalize(coin.name);
    const nameWords = new Set(name.split(' '));
    const desc = normalize(coin.description).slice(0, 400);

    let score = 0;
    const hits = [];
    for (const term of terms) {
      if (!term) continue;
      if (symbol === term) { score += 10; hits.push(term); continue; }
      if (name === term) { score += 9; hits.push(term); continue; }
      if (nameWords.has(term)) { score += 6; hits.push(term); continue; }
      // Multi-word terms ("stonk chump") matching inside the name.
      if (term.includes(' ') && name.includes(term)) { score += 8; hits.push(term); continue; }
      if (term.length >= 4 && (symbol.includes(term) || term.includes(symbol) && symbol.length >= 4)) {
        score += 4; hits.push(term); continue;
      }
      if (desc && term.length >= 5 && desc.includes(term)) { score += 2; hits.push(term); }
    }
    if (score <= 0) continue;

    // Tiny bump for activity so a live coin outranks a dead namesake.
    const vol = Number(coin.volume_24h_usd) || 0;
    score += Math.min(3, Math.log10(1 + vol) / 2);

    scored.push({ coin, score, hits });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_COINS_PER_EVENT).map(({ coin, score, hits }) => ({
    mintAddress: coin.mintAddress,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image || coin.profileImage || coin.logo || null,
    banner: coin.banner || coin.header || null,
    price_usd: coin.price_usd || 0,
    market_cap_usd: coin.market_cap_usd || 0,
    volume_24h_usd: coin.volume_24h_usd || 0,
    priceChange24h: coin.priceChange24h ?? coin.change_24h ?? 0,
    pairAddress: coin.pairAddress || null,
    matchScore: Math.round(score * 10) / 10,
    matchedTerms: [...new Set(hits)].slice(0, 4),
  }));
}

// ── Refresh + cache ──────────────────────────────────────────────────────────

async function refresh() {
  const { events, citations, liveSearchUsed } = await fetchGrokTrends();
  const pool = (typeof coinPoolGetter === 'function' ? coinPoolGetter() : []) || [];

  const matchedTrends = prioritizeMatchedTrends(events.map((event) => ({
    ...event,
    coins: matchCoinsForEvent(event, pool),
  })));
  const trends = xNewsAlertService.decorateTrends(matchedTrends, liveSearchUsed);

  cache = { trends, updatedAt: Date.now(), model: XAI_MODEL, citations: citations.slice(0, 30), poolSize: pool.length, liveSearchUsed };
  lastError = null;
  console.log(`🐦 [x-trends] refreshed: ${trends.length} events, ${trends.reduce((n, t) => n + t.coins.length, 0)} coin matches (pool ${pool.length})`);
  xNewsAlertService.processTrends(trends).catch((error) => {
    console.error(`[x-news] push processing failed: ${error.message}`);
  });
  return cache;
}

async function getTrends() {
  if (!isEnabled()) {
    return { enabled: false, trends: [], updatedAt: 0, error: 'XAI_API_KEY not configured' };
  }

  const age = Date.now() - cache.updatedAt;
  const fresh = cache.updatedAt > 0 && age < REFRESH_MS;

  if (!fresh) {
    if (!refreshPromise) {
      refreshPromise = refresh()
        .catch((err) => {
          lastError = err.message;
          console.warn(`🐦 [x-trends] refresh failed: ${err.message}`);
        })
        .finally(() => { refreshPromise = null; });
    }
    // Stale-while-revalidate: serve old data during refresh, block only when empty.
    if (!cache.updatedAt || age > STALE_MAX_MS) await refreshPromise;
  }

  return {
    enabled: true,
    trends: cache.trends,
    updatedAt: cache.updatedAt,
    stale: Date.now() - cache.updatedAt > REFRESH_MS,
    liveSearchUsed: cache.liveSearchUsed !== false,
    ...(lastError && !cache.trends.length ? { error: lastError } : {}),
  };
}

// Kick off a refresh in the background without blocking the caller — meant to
// be called once at server startup so the panel's first open is instant
// instead of waiting ~10-20s for the first live Grok call.
function prewarm() {
  if (!isEnabled() || cache.updatedAt > 0 || refreshPromise) return;
  refreshPromise = refresh()
    .catch((err) => {
      lastError = err.message;
      console.warn(`🐦 [x-trends] prewarm failed: ${err.message}`);
    })
    .finally(() => { refreshPromise = null; });
}

module.exports = { setCoinPoolGetter, getTrends, isEnabled, prewarm };
