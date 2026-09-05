// Serves a generated PNG avatar for any Solana wallet address — the SAME
// gradient + animal-silhouette identity the frontend renders (see
// frontend/src/utils/walletIdentity.jsx). Used as the notification image for
// wallet alerts (iOS/Android/web pushes need a hosted URL; the in-app avatars
// are client-side SVGs, so this endpoint is their hosted twin).
const express = require('express');
const router = express.Router();

let sharp = null;
try {
  sharp = require('sharp');
} catch (_) {
  console.warn('[avatar] sharp not installed — wallet avatar endpoint disabled');
}

// ── Verbatim mirror of frontend/src/utils/walletIdentity.jsx ─────────────
const ANON_ANIMALS = [
  { name: 'Wolf', body: 'M12 4.2 17.5 7.8 20 5.8 18.7 13.2 21 16.5 16.7 16.2 14.2 19.8 12 17 9.8 19.8 7.3 16.2 3 16.5 5.3 13.2 4 5.8 6.5 7.8z' },
  { name: 'Fox', body: 'M12 5 16.8 7.3 20 4.8 18.5 13.7 20.2 17.8 15.2 16.4 12 19.2 8.8 16.4 3.8 17.8 5.5 13.7 4 4.8 7.2 7.3z' },
  { name: 'Lynx', body: 'M6.2 5.2 10.4 8.5 12 6.9 13.6 8.5 17.8 5.2 17 12.7 19.2 15.4 15 16.5 12 19.3 9 16.5 4.8 15.4 7 12.7z' },
  { name: 'Hare', body: 'M8.6 12.3 C6.5 7.8 6.5 3.9 8.2 3.4 C10 5.6 10.5 8.6 10.5 11.1 C11.1 11 11.7 11 12.3 11.1 C12.3 8.5 13 5.1 15.1 3.1 C16.7 3.9 16.4 8.2 14.6 12.3 C17.1 13.2 18.8 15.3 18.8 17.8 C16.8 19 14.5 19.6 12 19.6 C9.5 19.6 7.2 19 5.2 17.8 C5.2 15.3 6.9 13.2 8.6 12.3z' },
  { name: 'Bull', body: 'M4.3 7.1 C6.8 7.1 7.9 8.7 8.9 10.1 C9.8 9.6 10.8 9.4 12 9.4 C13.2 9.4 14.2 9.6 15.1 10.1 C16.1 8.7 17.2 7.1 19.7 7.1 C18.8 9.8 17.7 11.7 16.6 13 C17 14.1 17.1 15.2 17 16.5 C15.6 18 13.8 18.8 12 18.8 C10.2 18.8 8.4 18 7 16.5 C6.9 15.2 7 14.1 7.4 13 C6.3 11.7 5.2 9.8 4.3 7.1z' },
  { name: 'Manta', body: 'M2.8 12.5 C6.6 7.8 9.3 6.1 12 6.1 C14.7 6.1 17.4 7.8 21.2 12.5 C17.7 13.2 15.4 14.6 13.3 17.4 L12 20 L10.7 17.4 C8.6 14.6 6.3 13.2 2.8 12.5z' },
];

function hashAddress(addr = '') {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = addr.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function buildAvatarSvg(address) {
  const hash = hashAddress(address);
  const h1 = hash % 360;
  const h2 = (h1 + 60) % 360;
  const animal = ANON_ANIMALS[hash % ANON_ANIMALS.length];
  // Silhouette at 58% centered, white — mirrors .wallet-chip-animal CSS.
  const scale = (512 * 0.58) / 24;
  const offset = (512 - 24 * scale) / 2;
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${h1}, 65%, 55%)"/>
    <stop offset="100%" stop-color="hsl(${h2}, 65%, 45%)"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(${offset}, ${offset}) scale(${scale})"><path d="${animal.body}" fill="rgba(255,255,255,0.92)"/></g>
</svg>`;
}

// address -> { buf, ts }; avatars are deterministic so entries never expire.
const cache = new Map();
const MAX_CACHE = 500;

// GET /api/avatar/wallet/:address(.png) -> 512x512 PNG
router.get('/wallet/:address', async (req, res) => {
  const address = String(req.params.address || '').replace(/\.png$/i, '');
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'invalid_address' });
  }
  if (!sharp) return res.status(503).json({ error: 'avatar_unavailable' });

  try {
    let entry = cache.get(address);
    if (!entry) {
      const buf = await sharp(Buffer.from(buildAvatarSvg(address)))
        .png()
        .toBuffer();
      entry = { buf };
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(address, entry);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400, immutable');
    res.send(entry.buf);
  } catch (err) {
    console.error('[avatar] render error:', err.message);
    res.status(500).json({ error: 'avatar_render_failed' });
  }
});

module.exports = router;
