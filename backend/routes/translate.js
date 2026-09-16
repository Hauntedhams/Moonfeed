const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Free, no-key Google Translate endpoint (the same one many small apps use).
// Proxied server-side to avoid CORS and to keep the upstream URL off the client.
const UPSTREAM = 'https://translate.googleapis.com/translate_a/single';
const MAX_TEXT_LEN = 500;

// Tiny in-memory cache — coin names/descriptions repeat across many viewers.
const cache = new Map();
const CACHE_MAX = 2000;

router.get('/', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim().slice(0, MAX_TEXT_LEN);
    const target = /^[a-z]{2}(-[A-Z]{2})?$/.test(req.query.target) ? req.query.target : 'en';
    if (!text) return res.json({ success: true, translated: '', detectedLang: null });

    const cacheKey = `${target}:${text}`;
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    const url = `${UPSTREAM}?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const upstreamRes = await fetch(url, { timeout: 8000 });
    if (!upstreamRes.ok) throw new Error(`upstream ${upstreamRes.status}`);
    const data = await upstreamRes.json();

    const translated = Array.isArray(data?.[0]) ? data[0].map((seg) => seg?.[0] || '').join('') : '';
    const detectedLang = data?.[2] || null;
    const payload = { success: true, translated, detectedLang };

    if (cache.size >= CACHE_MAX) cache.clear(); // simple bound, no need for LRU here
    cache.set(cacheKey, payload);

    res.json(payload);
  } catch (error) {
    console.warn('[translate] failed:', error.message);
    res.status(502).json({ success: false, error: 'Translation unavailable' });
  }
});

module.exports = router;
