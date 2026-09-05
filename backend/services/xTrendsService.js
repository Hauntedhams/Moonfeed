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

const REFRESH_MINUTES = Math.max(15, parseInt(process.env.X_TRENDS_REFRESH_MINUTES, 10) || 60);
const REFRESH_MS = REFRESH_MINUTES * 60 * 1000; // fresh window
const STALE_MAX_MS = 6 * 60 * 60 * 1000;         // serve-on-error ceiling
const MAX_EVENTS = 8;
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
const GROK_PROMPT = `You are a trend analyst. Search X (Twitter) for what is trending
right now (last 24 hours, high engagement): world events, politics,
celebrity/cultural moments, sports, tech, viral internet phenomena. Use AT MOST
2 X searches total, then stop searching and answer.

Return ONLY a JSON array (no markdown fences, no prose) of up to ${MAX_EVENTS} objects:
[
  {
    "topic": "short topic name (2-5 words)",
    "headline": "news-style headline",
    "summary": "2-3 sentence plain-language summary of what happened and why it's trending",
    "category": "politics | celebrity | sports | tech | finance | culture | world",
    "momentum": 1-100 (how fast this is trending right now),
    "eventTime": "best estimate of when the underlying event happened, relative to now (e.g. '2 hours ago', 'yesterday', 'this morning') based on the posts you found",
    "keywords": ["5-10 single words or short names people/memes would name a coin after — names, nicknames, catchphrases, hashtag words"],
    "hashtags": ["up to 3 trending hashtags, without #"]
  }
]
Order by momentum descending. Keywords must be specific (proper nouns, slang from
the event) — never generic words like "news" or "video".`;

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

async function fetchGrokTrends() {
  let json = await callXai(GROK_PROMPT);
  let toolCalls = json?.usage?.num_server_side_tools_used || 0;
  let totalCostUsd = (json?.usage?.cost_in_usd_ticks || 0) / 1e10;

  // A 0-tool-call response means the model answered from stale training data
  // instead of actually searching — retry once with a stronger directive.
  if (toolCalls === 0) {
    console.warn('🐦 [x-trends] first attempt skipped search (stale data) — retrying with a stronger directive');
    json = await callXai(GROK_PROMPT + FORCE_SEARCH_SUFFIX);
    toolCalls = json?.usage?.num_server_side_tools_used || 0;
    totalCostUsd += (json?.usage?.cost_in_usd_ticks || 0) / 1e10;
  }

  console.log(`🐦 [x-trends] Grok call cost ~$${totalCostUsd.toFixed(4)} total (${toolCalls} tool calls on final attempt, live search ${toolCalls > 0 ? 'used' : 'NOT used — results may be stale'})`);

  const messageItems = (json?.output || []).filter((o) => o.type === 'message');
  const lastMessage = messageItems[messageItems.length - 1];
  const content = lastMessage?.content?.[0]?.text || '';
  const citations = messageItems.flatMap((m) =>
    (m.content?.[0]?.annotations || [])
      .filter((a) => a.type === 'url_citation')
      .map((a) => a.url)
  );


  return { events: parseEventsJson(content), citations, liveSearchUsed: toolCalls > 0 };
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

  return arr.slice(0, MAX_EVENTS).map((e, i) => ({
    id: `${Date.now()}-${i}`,
    topic: String(e.topic || '').slice(0, 80),
    headline: String(e.headline || e.topic || '').slice(0, 160),
    summary: String(e.summary || '').slice(0, 600),
    category: String(e.category || 'culture').toLowerCase(),
    momentum: Math.max(1, Math.min(100, parseInt(e.momentum, 10) || 50)),
    eventTime: String(e.eventTime || '').slice(0, 40),
    keywords: (Array.isArray(e.keywords) ? e.keywords : [])
      .map((k) => String(k).trim()).filter(Boolean).slice(0, 12),
    hashtags: (Array.isArray(e.hashtags) ? e.hashtags : [])
      .map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3),
  })).filter((e) => e.topic && e.summary);
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

  const trends = events.map((event) => ({
    ...event,
    coins: matchCoinsForEvent(event, pool),
  }));

  cache = { trends, updatedAt: Date.now(), model: XAI_MODEL, citations: citations.slice(0, 30), poolSize: pool.length, liveSearchUsed };
  lastError = null;
  console.log(`🐦 [x-trends] refreshed: ${trends.length} events, ${trends.reduce((n, t) => n + t.coins.length, 0)} coin matches (pool ${pool.length})`);
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

module.exports = { setCoinPoolGetter, getTrends, isEnabled };
