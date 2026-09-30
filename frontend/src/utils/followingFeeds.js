import { API_CONFIG } from '../config/api';

export const FOLLOW_WALLETS_FEED = 'followwallets';
export const FOLLOW_COINS_FEED = 'followcoins';
export const FOLLOWING_FEEDS = [FOLLOW_WALLETS_FEED, FOLLOW_COINS_FEED];

const MAX_FEED_COINS = 25;
const WALLET_TRADE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ENRICH_TTL_MS = 60 * 1000;
const ENRICH_CONCURRENCY = 6;

const enrichCache = new Map(); // mint -> { coin, ts } | { pending }

const mintOf = (c) => c?.mintAddress || c?.tokenAddress || c?.address || c?.mint;

async function enrichOne(seed) {
  const mint = mintOf(seed);
  const cached = enrichCache.get(mint);
  if (cached?.coin && Date.now() - cached.ts < ENRICH_TTL_MS) return cached.coin;
  if (cached?.pending) return cached.pending;

  const pending = (async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/coins/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coin: { mintAddress: mint, tokenAddress: mint, symbol: seed.symbol, name: seed.name || seed.symbol, image: seed.image },
        }),
      });
      if (!res.ok) return null;
      const full = (await res.json())?.coin;
      if (!full || !(Number(full.price_usd ?? full.priceUsd ?? full.price) > 0)) return null;
      const coin = { ...full, mintAddress: full.mintAddress || mint };
      enrichCache.set(mint, { coin, ts: Date.now() });
      return coin;
    } catch (_) {
      return null;
    } finally {
      const entry = enrichCache.get(mint);
      if (entry?.pending) enrichCache.delete(mint);
    }
  })();
  enrichCache.set(mint, { pending });
  return pending;
}

async function enrichAll(seeds) {
  const out = new Array(seeds.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < seeds.length) {
      const i = next++;
      out[i] = await enrichOne(seeds[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(ENRICH_CONCURRENCY, seeds.length) }, worker));
  return out;
}

/**
 * Coins traded by tracked wallets. Fresh buys a wallet still holds (its latest
 * trade on the coin is a buy) come first, newest entry first, so the user can
 * still get in near the wallet's entry; coins they've since sold follow.
 */
export function rankTrackedWalletCoins(tradesByMint, now = Date.now()) {
  const ranked = [];
  for (const [mint, trades] of tradesByMint || []) {
    const recent = trades.filter((t) => now - t.time < WALLET_TRADE_MAX_AGE_MS);
    if (!recent.length) continue;

    const lastByWallet = new Map();
    for (const t of recent) lastByWallet.set(t.walletAddress, t); // trades are ascending by time
    const openBuys = [...lastByWallet.values()].filter((t) => t.type === 'buy').sort((a, b) => b.time - a.time);
    const latest = recent[recent.length - 1];

    ranked.push({
      mint,
      symbol: latest.symbol,
      image: latest.image,
      holding: openBuys.length > 0,
      sortTime: openBuys.length ? openBuys[0].time : latest.time,
      openBuy: openBuys[0] || null,
      openBuyers: openBuys.length,
    });
  }
  ranked.sort((a, b) => (a.holding === b.holding ? b.sortTime - a.sortTime : a.holding ? -1 : 1));
  return ranked.slice(0, MAX_FEED_COINS);
}

export async function buildFollowWalletsFeed(tradesByMint) {
  const ranked = rankTrackedWalletCoins(tradesByMint);
  const enriched = await enrichAll(ranked.map((r) => ({ mintAddress: r.mint, symbol: r.symbol, image: r.image })));
  return enriched
    .map((coin, i) => {
      if (!coin) return null;
      const r = ranked[i];
      const buy = r.openBuy;
      return {
        ...coin,
        trackedWalletBuy: buy ? {
          label: buy.label,
          walletAddress: buy.walletAddress,
          time: buy.time,
          solAmount: buy.solAmount,
          usdAmount: buy.usdAmount,
          symbol: buy.symbol,
          image: buy.image,
          othersCount: r.openBuyers - 1,
        } : undefined,
      };
    })
    .filter(Boolean);
}

/** The user's tracked coins, most recently tracked first. */
export async function buildFollowCoinsFeed(favorites) {
  const trackedAt = (c) => Number(c.savedAt || c.addedAt || c.timestamp) || 0;
  const sorted = [...(favorites || [])].filter(mintOf).sort((a, b) => trackedAt(b) - trackedAt(a)).slice(0, MAX_FEED_COINS);
  const enriched = await enrichAll(sorted.map((f) => ({ mintAddress: mintOf(f), symbol: f.symbol, name: f.name, image: f.image })));
  return enriched
    .map((coin, i) => (coin ? { ...coin, trackedAtPrice: sorted[i].trackedAtPrice, savedAt: sorted[i].savedAt } : null))
    .filter(Boolean);
}
