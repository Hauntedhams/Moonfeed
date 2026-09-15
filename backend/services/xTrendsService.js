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
    "eventType": "coin_launch | coin_move | coin_wave | news | viral",
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
const GROK_CRYPTO_PROMPT = `You are a crypto-Twitter analyst tracking meme coins in
real time. Search X (Twitter) for what is trending RIGHT NOW in crypto / Solana
meme-coin culture — prioritize the LAST FEW HOURS over the last 24, since meme
coin trends move and die within hours, not days. Do not just report an event
because it's the biggest story of the last day — a smaller story from the last
hour that is actively accelerating is more valuable here than a bigger one that
already peaked.

IMPORTANT — "trending" here does NOT mean real news. The single biggest driver
of new Solana meme coins is a JOKE going viral: an absurd AI-generated mashup
image/video (often posted by an explicitly-labeled "Parody account"), a meme
format, or a funny catchphrase — with zero real-world news value — that racks
up huge likes/retweets/views and immediately spawns dozens of copycat coins and
reply-guy jokes. Weigh RAW ENGAGEMENT (like/retweet/view counts on the actual
post) as the signal of what's "popping" — not whether it's a real, important,
or verifiable event. A silly, fabricated mashup with big numbers is MORE
valuable to report here than a slow-burn real story with modest engagement.

Specifically look for, in priority order:
1. VIRAL JOKE/MASHUP MOMENTS: an absurd AI-generated image or video mixing two
   unrelated things (e.g. a celebrity blended with an animal, vehicle, or
   object — "Wheel Smith", "Bike Tyson"-style mashups are the current pattern,
   but the format itself will keep changing) that is currently racking up big
   engagement, especially from parody/meme accounts. Report the JOKE/FORMAT
   ITSELF as the topic even if it has no news value at all.
2. MEME-TEMPLATE WAVES: that same joke/format spawning many copycat coins in a
   short window (one viral mashup name inspires dozens of similarly-named
   tickers within hours). Treat the WAVE as the trend (topic = the format/joke,
   not any single coin), and list every actual coin name/ticker you find riding
   it in "keywords".
3. New pump.fun / Solana meme coin launches tied to a person, meme, or event.
4. Celebrity/politically-linked coin drama, crypto CEO/founder/exchange posts
   people are reacting to, and real-world events already visibly moving coin
   prices.
Coins announced by the person/organization on their own official X account are
highest priority for sourceUrl, but for #1/#2 the highest-engagement post OF
THE JOKE ITSELF (parody account or not) is exactly what you should cite.
Use AT MOST 5 X searches total (try queries like "parody account" + a current
buzzy word, "pump.fun new", a currently-trending mashup name/format + "coin",
"new coin just launched", a viral meme phrase from the last few hours), then
stop searching and answer. Skip generic market analysis and skip requiring
"real" news — a fabricated joke that's clearly popping right now is exactly
what this pass exists to catch.

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

function topicKey(event) {
  return normalize(event.topic).split(' ').filter((w) => w.length > 3).slice(0, 3).join(' ');
}

function dedupeEvents(events) {
  const seen = new Set();
  const out = [];
  for (const event of events) {
    const key = topicKey(event);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(event);
  }
  return out;
}

// When the SAME story keeps showing up across refreshes (still trending), it
// should keep its original discovery time so a genuinely new story can still
// jump ahead of it — this map is what makes "newest first" mean newest STORY,
// not just whichever refresh happened to run most recently.
const firstSeenMap = new Map(); // topicKey -> first Date.now() we saw it
const FIRST_SEEN_MAX_AGE_MS = 48 * 60 * 60 * 1000; // prune so the map can't grow forever

function stampFirstSeen(events) {
  const now = Date.now();
  for (const [key, seenAt] of firstSeenMap) {
    if (now - seenAt > FIRST_SEEN_MAX_AGE_MS) firstSeenMap.delete(key);
  }
  for (const event of events) {
    const key = topicKey(event);
    if (key && firstSeenMap.has(key)) {
      event.firstSeenAt = firstSeenMap.get(key);
    } else {
      event.firstSeenAt = now;
      if (key) firstSeenMap.set(key, now);
    }
  }
  return events;
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
    || event.eventType === 'coin_wave'
    || /\b(crypto|solana|pumpfun|pump fun|pump\.fun|meme coin|memecoin|coinbase|binance|kraken|bybit|okx|jupiter|phantom|solflare|wallet|token|launch|ticker|cto|ceo|founder|vitalik|cz|brian armstrong|anatoly|mert)\b/.test(haystack);
}

function trendPriority(event) {
  const momentum = Number(event.momentum) || 0;
  let boost = 0;
  if (event.category === 'crypto') boost += 24;
  if (event.eventType === 'coin_launch') boost += 18;
  if (event.eventType === 'coin_wave') boost += 20;
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

// Final display order: newest STORY first (so a story that just appeared
// beats one that's merely still trending from an earlier refresh), breaking
// ties within the same discovery moment by the usual momentum/coin-match score.
function prioritizeMatchedTrends(trends) {
  return [...trends]
    .sort((a, b) => (b.firstSeenAt || 0) - (a.firstSeenAt || 0) || trendDisplayScore(b) - trendDisplayScore(a))
    .slice(0, MAX_EVENTS_TOTAL);
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
    eventType: ['coin_launch', 'coin_move', 'coin_wave', 'news', 'viral'].includes(eventType) ? eventType : 'news',
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

// A coin that only hits our locally-cached pools (dextrending/whalefeed/
// trending/new) — the event's namesake coin often isn't in ANY of those at
// refresh time (fresh pump.fun launch, low volume, etc). Below this score we
// fall back to a live Dexscreener search so e.g. a headline literally titled
// "$NPC Meme Coin Surge" still surfaces the real $NPC coin as a related coin.
const LIVE_SEARCH_MIN_SCORE = 6;
const LIVE_SEARCH_MAX_TERMS = 3;
const DEXSCREENER_SEARCH_URL = 'https://api.dexscreener.com/latest/dex/search';

function scoreCoinAgainstTerms(coin, terms) {
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
  if (score <= 0) return null;

  // Tiny bump for activity so a live coin outranks a dead namesake.
  const vol = Number(coin.volume_24h_usd) || 0;
  score += Math.min(3, Math.log10(1 + vol) / 2);

  return { coin, score, hits };
}

// Live keyword search against Dexscreener (same public endpoint used
// elsewhere in the app) — used ONLY as a fallback when the cached coin pools
// don't have a good match, so this doesn't add load to the normal path.
async function searchDexscreenerTokens(query) {
  try {
    const res = await fetch(`${DEXSCREENER_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
    const byMint = new Map();
    for (const p of pairs) {
      if (p.chainId !== 'solana') continue;
      const mint = p.baseToken?.address;
      if (!mint || byMint.has(mint)) continue;
      const liquidity = Number(p.liquidity?.usd) || 0;
      byMint.set(mint, {
        mintAddress: mint,
        symbol: p.baseToken?.symbol || '',
        name: p.baseToken?.name || '',
        image: p.info?.imageUrl || null,
        banner: null,
        price_usd: parseFloat(p.priceUsd) || 0,
        market_cap_usd: Number(p.fdv || p.marketCap) || 0,
        volume_24h_usd: Number(p.volume?.h24) || 0,
        priceChange24h: Number(p.priceChange?.h24) || 0,
        pairAddress: p.pairAddress || null,
        liquidity_usd: liquidity,
      });
    }
    return [...byMint.values()].sort((a, b) => b.liquidity_usd - a.liquidity_usd).slice(0, 8);
  } catch (error) {
    console.warn(`[x-trends] live coin search failed for "${query}": ${error.message}`);
    return [];
  }
}

async function matchCoinsForEvent(event, pool) {
  const terms = [...new Set(
    [...event.keywords, ...event.hashtags, ...normalize(event.topic).split(' ')]
      .map(normalize)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  )];
  if (!terms.length) return [];

  const scored = [];
  for (const coin of pool) {
    const result = scoreCoinAgainstTerms(coin, terms);
    if (result) scored.push(result);
  }
  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score || 0;
  if (topScore < LIVE_SEARCH_MIN_SCORE) {
    // Prefer short/ticker-like terms (hashtags, keywords) over generic topic
    // words for the live search — these are the closest thing Grok gives us
    // to an actual coin symbol/name.
    const searchTerms = [...new Set([...(event.hashtags || []), ...(event.keywords || [])])]
      .map((t) => String(t).trim())
      .filter((t) => t.length >= 2 && t.length <= 20)
      .slice(0, LIVE_SEARCH_MAX_TERMS);

    const seenMints = new Set(scored.map((s) => s.coin.mintAddress));
    for (const term of searchTerms) {
      const liveCoins = await searchDexscreenerTokens(term);
      for (const coin of liveCoins) {
        if (!coin.mintAddress || seenMints.has(coin.mintAddress)) continue;
        const result = scoreCoinAgainstTerms(coin, terms);
        if (result) {
          scored.push(result);
          seenMints.add(coin.mintAddress);
        }
      }
    }
    scored.sort((a, b) => b.score - a.score);
  }

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

  const eventsWithCoins = [];
  for (const event of events) {
    eventsWithCoins.push({ ...event, coins: await matchCoinsForEvent(event, pool) });
  }
  stampFirstSeen(eventsWithCoins);
  const matchedTrends = prioritizeMatchedTrends(eventsWithCoins);
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
