// One cheap Dexscreener lookup per mint → the things the UI needs instantly
// (header banner, logo, best pool address, price). Shared + cached so the
// profile grid, position sheet and chart never each pay for the same call.
// The pool address lets NativeChart skip its own /api/resolve-pool round trip.

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // mint -> { ts, promise }

function pickBestPair(pairs) {
  let best = null;
  let bestLiq = -1;
  for (const pair of pairs || []) {
    if (pair?.chainId !== 'solana') continue;
    const liq = Number(pair.liquidity?.usd) || 0;
    if (liq > bestLiq) { best = pair; bestLiq = liq; }
  }
  return best;
}

export function pairInfoFromPair(pair) {
  if (!pair) return null;
  return {
    mint: pair.baseToken?.address || null,
    pairAddress: pair.pairAddress || null,
    banner: pair.info?.header || null,
    image: pair.info?.imageUrl || null,
    symbol: pair.baseToken?.symbol || null,
    name: pair.baseToken?.name || null,
    priceUsd: Number(pair.priceUsd) || null,
    priceNative: Number(pair.priceNative) || null,
    marketCap: Number(pair.marketCap ?? pair.fdv) || null,
  };
}

/** Seed the cache from data another screen already fetched (e.g. the profile grid). */
export function primeTokenPairInfo(mint, info) {
  if (!mint || !info) return;
  const existing = cache.get(mint);
  if (existing && Date.now() - existing.ts < TTL_MS) return;
  cache.set(mint, { ts: Date.now(), promise: Promise.resolve({ mint, ...info }) });
}

export function fetchTokenPairInfo(mint, { timeoutMs = 6000 } = {}) {
  if (!mint) return Promise.resolve(null);
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.promise;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const promise = fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: controller.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => pairInfoFromPair(pickBestPair(data?.pairs)))
    .catch(() => { cache.delete(mint); return null; })
    .finally(() => clearTimeout(timer));
  cache.set(mint, { ts: Date.now(), promise });
  return promise;
}

/** Batch variant (≤30 mints per Dexscreener call). Resolves Map<mint, info>. */
export async function fetchTokenPairInfoBatch(mints) {
  const unique = [...new Set((mints || []).filter(Boolean))];
  const out = new Map();
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
      if (!res.ok) return;
      const data = await res.json();
      const byMint = new Map();
      for (const pair of data?.pairs || []) {
        const mint = pair.baseToken?.address;
        if (!mint || pair.chainId !== 'solana') continue;
        const liq = Number(pair.liquidity?.usd) || 0;
        if (!byMint.has(mint) || liq > byMint.get(mint).liq) byMint.set(mint, { pair, liq });
      }
      for (const [mint, { pair }] of byMint) {
        const info = pairInfoFromPair(pair);
        out.set(mint, info);
        primeTokenPairInfo(mint, info);
      }
    } catch (_) { /* best effort */ }
  }));
  return out;
}
