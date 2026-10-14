// Moonfeed ranking — the default feed. Goal: a short list of coins that are
// actively going up on REAL volume, with enough size and liquidity that a new
// user can trade them. Built from the shared multi-source candidate pool
// (Dexscreener + CoinGecko Onchain + Solana Tracker) that the other feeds use.
//
// Three stages:
//   1. Hard gates   — market cap, liquidity, volume, trade count, honeypot.
//   2. Bot filter   — wash-trading heuristics score 0..1; above the cutoff the
//                     coin is dropped, below it the score is dented.
//   3. Score        — momentum (1h/6h/24h) × volume quality × liquidity depth
//                     × verified lock × participation.
//
// Everything here is a pure function of the coin object so it can be unit
// tested without the server.

const GATE = {
  minMarketCapUsd: 50_000,
  maxMarketCapUsd: 250_000_000,  // above this it's not a "moonshot" any more
  minLiquidityUsd: 10_000,
  minVolume24hUsd: 20_000,
  minTxns24h: 120,
  minAgeHours: 1,                // let a pair print at least an hour of history
  maxDrawdown24hPct: -25,        // allow pullbacks, not collapses
};

// Verified locked/burned LP the user asked for. When Rugcheck data exists and
// says the locked value is below this, the coin is dropped; coins without
// Rugcheck data yet are kept but ranked below verified ones.
const MIN_LOCKED_LIQUIDITY_USD = 10_000;

const BOT_DROP_THRESHOLD = 0.6;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Log-scaled 0..max credit between `floor` (0) and `ceil` (max)
const logCredit = (value, floor, ceil, max) => {
  if (!(value > floor)) return 0;
  return clamp((max * Math.log10(value / floor)) / Math.log10(ceil / floor), 0, max);
};

function ageHours(coin) {
  const raw = coin.pairCreatedAt ?? coin.createdAt ?? coin.created_at ?? null;
  if (!raw) return null;
  const ms = typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
  if (!ms || Number.isNaN(ms)) return null;
  return (Date.now() - ms) / 3_600_000;
}

function fields(coin) {
  const liquidity = num(coin.liquidity_usd ?? coin.liquidity);
  const marketCap = num(coin.market_cap_usd ?? coin.marketCap ?? coin.market_cap);
  const vol24 = num(coin.volume_24h_usd ?? coin.volume_24h ?? coin.volume24h);
  const vol6 = num(coin.volume_6h_usd);
  const vol1 = num(coin.volume_1h_usd);
  const txns24 = num(coin.txns_24h) || num(coin.buys_24h) + num(coin.sells_24h);
  const buys24 = num(coin.buys_24h);
  const sells24 = num(coin.sells_24h);
  const txns1 = num(coin.txns_1h) || num(coin.buys_1h) + num(coin.sells_1h);
  const buys1 = num(coin.buys_1h);
  const sells1 = num(coin.sells_1h);
  const ch24 = num(coin.price_change_24h ?? coin.priceChange24h ?? coin.change_24h);
  const ch6 = num(coin.price_change_6h);
  const ch1 = num(coin.price_change_1h);
  const ch5m = num(coin.price_change_5m);
  const holders = num(coin.holders ?? coin.holderCount ?? coin.holder_count);
  const lockPct = num(coin.lockPercentage) + num(coin.burnPercentage);
  const hasRugcheck = coin.liquidityLocked === true || coin.liquidityLocked === false
    || Number.isFinite(Number(coin.lockPercentage));
  const lockedUsd = hasRugcheck ? liquidity * clamp(lockPct, 0, 100) / 100 : null;
  return {
    liquidity, marketCap, vol24, vol6, vol1, txns24, buys24, sells24, txns1, buys1, sells1,
    ch24, ch6, ch1, ch5m, holders, lockPct, hasRugcheck, lockedUsd, age: ageHours(coin),
  };
}

/** Hard gates. Returns null when the coin passes, else a short reason string. */
function gateReason(coin) {
  const f = fields(coin);
  if (coin.isHoneypot === true) return 'honeypot';
  if (f.marketCap < GATE.minMarketCapUsd) return 'mcap<50k';
  if (f.marketCap > GATE.maxMarketCapUsd) return 'mcap>250M';
  if (f.liquidity < GATE.minLiquidityUsd) return 'liq<10k';
  if (f.vol24 < GATE.minVolume24hUsd) return 'vol<20k';
  if (f.txns24 < GATE.minTxns24h) return 'txns<120';
  if (f.age !== null && f.age < GATE.minAgeHours) return 'age<1h';
  if (f.ch24 < GATE.maxDrawdown24hPct) return 'down>25%';
  if (f.hasRugcheck && f.lockedUsd !== null && f.lockedUsd < MIN_LOCKED_LIQUIDITY_USD) return 'locked<10k';
  // "Actively going up": at least one of the short windows must be green and
  // the day can't be red while the short windows are flat.
  const goingUp = (f.ch1 > 0.5 && f.ch24 > -10)
    || (f.ch6 > 2 && f.ch24 > -15 && f.ch1 > -8)
    || (f.ch24 > 5 && f.ch1 > -3 && f.ch6 > -5);
  if (!goingUp) return 'not-rising';
  // Market cap that dwarfs liquidity is a dump waiting to happen.
  if (f.liquidity > 0 && f.marketCap / f.liquidity > 150) return 'thin-liq';
  return null;
}

/**
 * Wash / bot-volume suspicion, 0 (clean) .. 1 (almost certainly fake).
 * Heuristics that work with public DEX aggregates:
 *  - turnover: 24h volume vs pool depth. Real pools rarely churn > 25× a day.
 *  - volume without price impact: lots of volume, price barely moved.
 *  - trade size: avg trade that is a large slice of the pool (two bots
 *    ping-ponging) or dust-sized spam.
 *  - buy/sell symmetry: wash bots produce ~50/50 with high counts; organic
 *    pumps are buy-heavy. Near-100% buys with few sells = bundled/sniped.
 *  - 1h burst: most of the day's volume in the last hour on an old pair.
 */
function botSignal(coin) {
  const f = fields(coin);
  const flags = [];
  let s = 0;

  const turnover = f.liquidity > 0 ? f.vol24 / f.liquidity : 0;
  if (turnover > 60) { s += 0.45; flags.push('turnover>60x'); }
  else if (turnover > 25) { s += 0.25; flags.push('turnover>25x'); }

  // Volume with no price impact
  const absMove = Math.max(Math.abs(f.ch24), Math.abs(f.ch6) * 1.5, Math.abs(f.ch1) * 3);
  if (turnover > 8 && absMove < 3) { s += 0.35; flags.push('volume-no-impact'); }

  const avgTrade = f.txns24 > 0 ? f.vol24 / f.txns24 : 0;
  if (f.liquidity > 0 && avgTrade > f.liquidity * 0.04) { s += 0.25; flags.push('whale-pingpong'); }
  if (f.txns24 > 1000 && avgTrade > 0 && avgTrade < 4) { s += 0.3; flags.push('dust-spam'); }

  if (f.txns24 >= 300) {
    const buyShare = f.buys24 / Math.max(1, f.buys24 + f.sells24);
    if (buyShare > 0.48 && buyShare < 0.52 && turnover > 5) { s += 0.2; flags.push('mirror-50/50'); }
    if (buyShare > 0.93) { s += 0.25; flags.push('all-buys'); }
    if (buyShare < 0.2) { s += 0.2; flags.push('all-sells'); }
  }

  if (f.age !== null && f.age > 36 && f.vol24 > 0 && f.vol1 / f.vol24 > 0.6 && Math.abs(f.ch1) < 2) {
    s += 0.25; flags.push('1h-burst-no-move');
  }

  // Many holders relative to trades is a strong organic signal — relax.
  if (f.holders > 0 && f.txns24 > 0 && f.holders / f.txns24 > 0.5) s -= 0.15;
  // Verified lock does not prove organic volume but correlates with it.
  if (coin.liquidityLocked === true) s -= 0.1;

  return { score: clamp(s, 0, 1), flags };
}

/** Composite 0..~100 ranking score (higher = shown first). */
function scoreCoin(coin, bot = botSignal(coin)) {
  const f = fields(coin);
  let score = 0;

  // Momentum — the feed's whole point. Short windows weigh more.
  score += clamp(f.ch1, -10, 40) * 0.6;        // up to +24
  score += clamp(f.ch6, -15, 80) * 0.25;       // up to +20
  score += clamp(f.ch24, -25, 200) * 0.08;     // up to +16
  if (f.ch5m > 0) score += Math.min(4, f.ch5m * 0.5);
  // Consistency bonus: green on every window = trend, not a wick
  if (f.ch1 > 0 && f.ch6 > 0 && f.ch24 > 0) score += 8;
  // A sharp red last hour means the move is unwinding right now — big gains
  // earlier in the day shouldn't carry it to the top of the feed.
  if (f.ch1 < -10) score -= 14;
  else if (f.ch1 < -5) score -= 6;

  // Real volume: log credit $20k → 0, $5M → 18
  score += logCredit(f.vol24, 20_000, 5_000_000, 18);
  // Healthy turnover band (0.3× – 12× pool depth per day)
  const turnover = f.liquidity > 0 ? f.vol24 / f.liquidity : 0;
  if (turnover >= 0.3 && turnover <= 12) score += 8;
  else if (turnover > 12 && turnover <= 25) score += 3;

  // Liquidity depth: $10k → 0, $2M → 14
  score += logCredit(f.liquidity, 10_000, 2_000_000, 14);

  // Verified locked / burned LP
  if (f.lockedUsd !== null && f.lockedUsd >= MIN_LOCKED_LIQUIDITY_USD) {
    score += coin.liquidityLocked === true ? 12 : 8;
  }

  // Participation: trades (120 → 0, 20k → 10) and holders (200 → 0, 50k → 8)
  score += logCredit(f.txns24, 120, 20_000, 10);
  if (f.holders > 0) score += logCredit(f.holders, 200, 50_000, 8);
  // Fresh buy pressure in the last hour
  if (f.txns1 >= 20) {
    const buyShare1h = f.buys1 / Math.max(1, f.buys1 + f.sells1);
    if (buyShare1h >= 0.55 && buyShare1h <= 0.85) score += 6;
  }

  // Sweet-spot market cap for a "moon" ($150k – $20M) gets a nudge
  if (f.marketCap >= 150_000 && f.marketCap <= 20_000_000) score += 4;

  // Seen by more than one data source = stronger signal
  if ((coin.sourceCount || (coin.sources || []).length) >= 2) score += 4;

  // Dent for bot suspicion
  score -= bot.score * 40;

  return score;
}

/**
 * Rank a candidate pool into the Moonfeed list.
 * Returns { coins, dropped: { reason: count } } where each coin carries
 * moonfeedScore / botScore / botFlags / priority.
 */
function rankMoonfeedCoins(candidates) {
  const dropped = {};
  const drop = (why) => { dropped[why] = (dropped[why] || 0) + 1; };
  const seen = new Set();
  const kept = [];

  for (const coin of candidates) {
    const mint = coin?.mintAddress || coin?.address || coin?.tokenAddress;
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);
    const reason = gateReason(coin);
    if (reason) { drop(reason); continue; }
    const bot = botSignal(coin);
    if (bot.score >= BOT_DROP_THRESHOLD) { drop('bot-volume'); continue; }
    kept.push({ coin, bot, score: scoreCoin(coin, bot) });
  }

  kept.sort((a, b) => b.score - a.score);
  const coins = kept.map(({ coin, bot, score }, index) => ({
    ...coin,
    mintAddress: coin.mintAddress || coin.address || coin.tokenAddress,
    priority: index + 1,
    moonfeedScore: Math.round(score * 10) / 10,
    botScore: Math.round(bot.score * 100) / 100,
    botFlags: bot.flags,
    lockedLiquidityUsd: fields(coin).lockedUsd,
    _moonfeedFeedType: 'moonfeed',
  }));
  return { coins, dropped };
}

module.exports = { GATE, MIN_LOCKED_LIQUIDITY_USD, BOT_DROP_THRESHOLD, gateReason, botSignal, scoreCoin, rankMoonfeedCoins };
