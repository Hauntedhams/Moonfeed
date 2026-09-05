// Server-side price monitors — run on the backend so alerts fire even when the
// app is fully closed. Uses the account's already-synced tracked coins
// (User.trackedCoins, with trackedAtPrice) + live Dexscreener prices, and pushes
// via FCM to that wallet's registered devices.
const fetch = require('node-fetch');
const User = require('../models/User');
const DeviceToken = require('../models/DeviceToken');
const PushAlertState = require('../models/PushAlertState');
const PushWalletCursor = require('../models/PushWalletCursor');
const SoftOrder = require('../models/SoftOrder');
const pushService = require('./pushService');

const PUBLIC_API_BASE_URL = (process.env.PUBLIC_API_BASE_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.moonfeed.app').replace(/\/$/, '');

const POLL_INTERVAL_MS = 90 * 1000;
// Each cycle costs 100 Helius credits (Enhanced API) PER tracked wallet, 24/7 —
// at 60s this alone burned ~1M credits/day. 180s cuts it 3x.
const WALLET_POLL_INTERVAL_MS = 180 * 1000;
const SOFT_ORDER_POLL_INTERVAL_MS = 30 * 1000;
const CHUNK = 30;

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '05a97104-cba1-4284-aed6-e0ad21af8b33';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const MAX_TRACKED_WALLETS = 60; // cap Helius load per cycle

// Tracked-coin gain thresholds.
const GAIN_PCT = 10;
const GAIN_REARM_PCT = 5;
// Held/tracked-coin crash thresholds (Dexscreener price-change windows).
const CRASH_M5_PCT = -15;
const CRASH_H1_PCT = -30;
const CRASH_REARM_M5 = -5;

let timer = null;
let walletTimer = null;
let softOrderTimer = null;
const symbolCache = new Map(); // mint -> { symbol, ts }
const SYMBOL_TTL = 60 * 60 * 1000;

function shortWallet(address) {
  return address ? `${address.slice(0, 4)}…${address.slice(-4)}` : 'Tracked wallet';
}

function pushSafeImage(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

function profileImageForPush(profile, walletAddress) {
  const picture = profile?.profilePicture;
  if (!picture) return null;
  const remoteUrl = pushSafeImage(picture);
  if (remoteUrl) return remoteUrl;
  if (typeof picture === 'string' && picture.startsWith('data:image/')) {
    return `${PUBLIC_API_BASE_URL}/api/users/${encodeURIComponent(walletAddress)}/profile-picture`;
  }
  return null;
}


async function deepestPairs(mints) {
  const prices = new Map(); // mint -> { price, m5, h1, symbol, image, liq }
  for (let i = 0; i < mints.length; i += CHUNK) {
    const chunk = mints.slice(i, i + CHUNK);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const pair of data.pairs || []) {
        const mint = pair.baseToken?.address;
        const price = Number(pair.priceUsd);
        if (!mint || !(price > 0)) continue;
        const liq = Number(pair.liquidity?.usd) || 0;
        const prev = prices.get(mint);
        if (prev && liq <= prev.liq) continue;
        prices.set(mint, {
          price,
          liq,
          m5: Number(pair.priceChange?.m5),
          h1: Number(pair.priceChange?.h1),
          symbol: pair.baseToken?.symbol,
          image: pair.info?.imageUrl || null,
        });
      }
    } catch (_) { /* keep whatever we have */ }
  }
  return prices;
}

async function getState(walletAddress, mint, type) {
  return PushAlertState.findOne({ walletAddress, mint, type });
}

async function setState(walletAddress, mint, type, armed, lastValue) {
  await PushAlertState.findOneAndUpdate(
    { walletAddress, mint, type },
    { $set: { armed, lastValue, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function sendToWallet(walletAddress, category, payload) {
  const prefKey = category; // matches DeviceToken.prefs keys
  const devices = await DeviceToken.find({
    walletAddress,
    [`prefs.${prefKey}`]: { $ne: false },
  }).lean();
  const tokens = devices.map((d) => d.token);
  if (!tokens.length) return;

  const { invalidTokens } = await pushService.sendToTokens(tokens, payload);
  if (invalidTokens.length) {
    await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
  }
}

async function runOnce() {
  if (!pushService.isEnabled()) return;

  // Only accounts that have at least one registered device are worth polling.
  const walletsWithDevices = await DeviceToken.distinct('walletAddress', {
    walletAddress: { $ne: null },
  });
  if (!walletsWithDevices.length) return;

  const users = await User.find({
    walletAddress: { $in: walletsWithDevices },
    'trackedCoins.0': { $exists: true },
  }).select('walletAddress trackedCoins').lean();
  if (!users.length) return;

  // Gather every tracked mint across accounts for one batched price fetch.
  const allMints = new Set();
  for (const u of users) {
    for (const c of u.trackedCoins) if (c.mintAddress) allMints.add(c.mintAddress);
  }
  const prices = await deepestPairs([...allMints]);
  if (!prices.size) return;

  for (const user of users) {
    const wallet = user.walletAddress;
    for (const coin of user.trackedCoins) {
      const mint = coin.mintAddress;
      const live = prices.get(mint);
      if (!live) continue;
      const symbol = live.symbol || coin.symbol || mint.slice(0, 6);

      // ── Tracked-coin +10% gain ──
      const trackedAt = Number(coin.trackedAtPrice) || 0;
      if (trackedAt > 0) {
        const gainPct = ((live.price - trackedAt) / trackedAt) * 100;
        const st = await getState(wallet, mint, 'trackedGain');
        if (gainPct < GAIN_REARM_PCT && st?.armed) {
          await setState(wallet, mint, 'trackedGain', false, gainPct);
        } else if (gainPct >= GAIN_PCT && !st?.armed) {
          await setState(wallet, mint, 'trackedGain', true, gainPct);
          await sendToWallet(wallet, 'trackedGain', {
            title: `${symbol} is up ${gainPct.toFixed(1)}%`,
            body: `Since you tracked it, now $${live.price.toPrecision(3)}.`,
            image: live.image,
            data: { type: 'trackedGain', mint },
          });
        }
      }

      // ── Crash (−15%/5m or −30%/1h) ──
      const crashedM5 = Number.isFinite(live.m5) && live.m5 <= CRASH_M5_PCT;
      const crashedH1 = Number.isFinite(live.h1) && live.h1 <= CRASH_H1_PCT;
      const st = await getState(wallet, mint, 'holdingCrash');
      const recovered = Number.isFinite(live.m5) && live.m5 >= CRASH_REARM_M5;
      if (recovered && st?.armed) {
        await setState(wallet, mint, 'holdingCrash', false, live.m5);
      } else if ((crashedM5 || crashedH1) && !st?.armed) {
        const dropPct = crashedM5 ? live.m5 : live.h1;
        const windowLabel = crashedM5 ? 'last 5 minutes' : 'last hour';
        await setState(wallet, mint, 'holdingCrash', true, dropPct);
        await sendToWallet(wallet, 'holdingCrash', {
          title: `${symbol} is dropping fast`,
          body: `Down ${Math.abs(dropPct).toFixed(1)}% in the ${windowLabel}.`,
          image: live.image,
          data: { type: 'holdingCrash', mint },
        });
      }
    }
  }
}

// ── Wallet-trade monitor ──────────────────────────────────────────────────
// Notifies each account when a wallet it tracks makes a new buy/sell, even with
// the app closed. Reuses the Helius Enhanced Transactions swap parse.

async function tokenSymbol(mint) {
  if (mint === SOL_MINT) return 'SOL';
  const cached = symbolCache.get(mint);
  if (cached && Date.now() - cached.ts < SYMBOL_TTL) return cached.symbol;
  let symbol = null;
  try {
    const r = await fetch(`https://tokens.jup.ag/token/${mint}`, { timeout: 3000 });
    if (r.ok) symbol = (await r.json())?.symbol || null;
  } catch (_) { /* fall through */ }
  if (!symbol) symbol = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  symbolCache.set(mint, { symbol, ts: Date.now() });
  return symbol;
}

function parseSwap(tx, walletAddress) {
  const s = tx?.events?.swap;
  if (!s) return null;
  const { nativeInput, nativeOutput, tokenInputs, tokenOutputs } = s;
  let type = null, tokenMint = null, solAmount = 0;
  if (nativeInput?.amount && tokenOutputs?.length) {
    type = 'buy'; solAmount = parseFloat(nativeInput.amount) / 1e9; tokenMint = tokenOutputs[0].mint;
  } else if (nativeOutput?.amount && tokenInputs?.length) {
    type = 'sell'; solAmount = parseFloat(nativeOutput.amount) / 1e9; tokenMint = tokenInputs[0].mint;
  } else if (tokenInputs?.length && tokenOutputs?.length) {
    type = 'buy'; tokenMint = tokenOutputs[0].mint;
  }
  if (!type || !tokenMint || tokenMint === SOL_MINT) return null;
  return { walletAddress, signature: tx.signature, timestamp: tx.timestamp, type, tokenMint, solAmount };
}

async function fetchRecentSwaps(address) {
  const url = `https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=5`;
  const res = await fetch(url, { timeout: 8000 });
  if (!res.ok) return [];
  const txs = await res.json();
  if (!Array.isArray(txs)) return [];
  return txs.map((tx) => parseSwap(tx, address)).filter(Boolean);
}

async function runWalletTradesOnce() {
  if (!pushService.isEnabled()) return;

  // Only poll for accounts that can actually RECEIVE a walletTrade push —
  // every polled wallet costs 100 Helius credits per cycle.
  const walletsWithDevices = await DeviceToken.distinct('walletAddress', {
    walletAddress: { $ne: null },
    'prefs.walletTrade': { $ne: false },
  });
  if (!walletsWithDevices.length) return;

  // Map tracked wallet -> [{ userWallet, label }] for everyone who tracks it (and has a device).
  const users = await User.find({
    walletAddress: { $in: walletsWithDevices },
    'trackedWallets.0': { $exists: true },
  }).select('walletAddress trackedWallets').lean();
  if (!users.length) return;

  const followersOf = new Map(); // trackedWallet -> [{ userWallet, label }]
  for (const u of users) {
    for (const tw of u.trackedWallets) {
      if (!tw.address) continue;
      if (!followersOf.has(tw.address)) followersOf.set(tw.address, []);
      followersOf.get(tw.address).push({ userWallet: u.walletAddress, label: tw.label });
    }
  }

  const trackedWallets = [...followersOf.keys()].slice(0, MAX_TRACKED_WALLETS);

  const profiles = await User.find({ walletAddress: { $in: trackedWallets } })
    .select('walletAddress displayName profilePicture')
    .lean();
  const profileByWallet = new Map(profiles.map((p) => [p.walletAddress, p]));

  for (const w of trackedWallets) {
    let swaps;
    try {
      swaps = await fetchRecentSwaps(w);
    } catch (_) { continue; }
    if (!swaps.length) continue;

    swaps.sort((a, b) => b.timestamp - a.timestamp);
    const newest = swaps[0];

    const cursor = await PushWalletCursor.findOne({ walletAddress: w });
    // First time we see this wallet: seed silently so we don't blast old history.
    if (!cursor) {
      await PushWalletCursor.create({ walletAddress: w, lastTimestamp: newest.timestamp, lastSignature: newest.signature });
      continue;
    }
    if (newest.timestamp <= cursor.lastTimestamp) continue;

    const fresh = swaps.filter((s) => s.timestamp > cursor.lastTimestamp).slice(0, 3);
    cursor.lastTimestamp = newest.timestamp;
    cursor.lastSignature = newest.signature;
    cursor.updatedAt = new Date();
    await cursor.save();

    const followers = followersOf.get(w) || [];
    for (const swap of fresh.reverse()) {
      const sym = await tokenSymbol(swap.tokenMint);
      const action = swap.type === 'sell' ? 'sold' : 'bought';
      const sol = swap.solAmount > 0 ? ` for ${swap.solAmount.toFixed(3)} SOL` : '';
      for (const f of followers) {
        const profile = profileByWallet.get(w);
        const label = profile?.displayName || f.label || shortWallet(w);
        // Prefer the tracked wallet's own uploaded pic; fall back to the same
        // generated gradient+animal avatar the app shows for that wallet.
        const profileImage = profileImageForPush(profile, w)
          || `${PUBLIC_API_BASE_URL}/api/avatar/wallet/${w}.png`;
        await sendToWallet(f.userWallet, 'walletTrade', {
          title: `${label} • Following`,
          body: `${action[0].toUpperCase()}${action.slice(1)} $${sym}${sol}`,
          image: profileImage,
          data: {
            type: 'walletTrade',
            wallet: w,
            mint: swap.tokenMint,
            signature: swap.signature,
            walletLabel: label,
            tokenSymbol: sym,
            action,
            ...(profileImage ? { walletProfileImage: profileImage } : {}),
          },
        });
      }
    }
  }
}

// ── Soft-order monitor ─────────────────────────────────────────────────
// Server-monitored buy-at / sell-at / stop-loss alerts. When a trigger hits,
// the order flips to 'triggered' and every registered device gets a push that
// deep-links into a prefilled instant swap. Runs even when FCM is disabled so
// the in-app orders list still reflects triggered state.

async function runSoftOrdersOnce() {
  await SoftOrder.updateMany(
    { status: 'active', expiresAt: { $ne: null, $lt: new Date() } },
    { $set: { status: 'expired' } }
  );

  const orders = await SoftOrder.find({ status: 'active' }).lean();
  if (!orders.length) return;

  const prices = await deepestPairs([...new Set(orders.map((o) => o.mint))]);
  if (!prices.size) return;

  for (const o of orders) {
    const live = prices.get(o.mint);
    if (!live || !(live.price > 0)) continue;

    const hit = o.triggerCondition === 'below'
      ? live.price <= o.triggerPriceUsd
      : live.price >= o.triggerPriceUsd;
    if (!hit) continue;

    // Atomic flip guards against double-notify if two polls overlap.
    const updated = await SoftOrder.findOneAndUpdate(
      { _id: o._id, status: 'active' },
      { $set: { status: 'triggered', triggeredAt: new Date(), triggeredPriceUsd: live.price } }
    );
    if (!updated) continue;

    if (!pushService.isEnabled()) continue;
    const symbol = o.tokenSymbol || live.symbol || o.mint.slice(0, 6);
    const action = o.side === 'buy' ? 'buy' : 'sell';
    const priceStr = live.price >= 0.01 ? live.price.toFixed(4) : live.price.toPrecision(3);
    try {
      await sendToWallet(o.walletAddress, 'orderFill', {
        title: `${symbol} hit your ${action} target`,
        body: `Now $${priceStr} — tap to ${action} ${o.side === 'buy' ? `with ${o.amountSol} SOL` : 'now'}.`,
        image: live.image,
        data: {
          type: 'softOrderTriggered',
          orderId: String(o._id),
          mint: o.mint,
          symbol,
          side: o.side,
          ...(o.amountSol ? { amountSol: String(o.amountSol) } : {}),
          ...(o.amountTokens ? { amountTokens: String(o.amountTokens) } : {}),
        },
      });
    } catch (e) {
      console.error('[push] soft-order notify error:', e.message);
    }
  }
}

function start() {
  if (timer || softOrderTimer) return;

  // Soft orders run regardless of FCM — triggered state must update either way.
  console.log('[push] soft-order monitor started');
  runSoftOrdersOnce().catch((e) => console.error('[push] soft-order monitor error:', e.message));
  softOrderTimer = setInterval(() => {
    runSoftOrdersOnce().catch((e) => console.error('[push] soft-order monitor error:', e.message));
  }, SOFT_ORDER_POLL_INTERVAL_MS);

  if (!pushService.isEnabled()) {
    console.log('[push] price/wallet monitors not started (FCM disabled — set FIREBASE_SERVICE_ACCOUNT)');
    return;
  }
  console.log('[push] price monitors started (tracked-gain + crash)');
  runOnce().catch((e) => console.error('[push] monitor error:', e.message));
  timer = setInterval(() => {
    runOnce().catch((e) => console.error('[push] monitor error:', e.message));
  }, POLL_INTERVAL_MS);

  console.log('[push] wallet-trade monitor started');
  runWalletTradesOnce().catch((e) => console.error('[push] wallet monitor error:', e.message));
  walletTimer = setInterval(() => {
    runWalletTradesOnce().catch((e) => console.error('[push] wallet monitor error:', e.message));
  }, WALLET_POLL_INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  if (walletTimer) clearInterval(walletTimer);
  if (softOrderTimer) clearInterval(softOrderTimer);
  timer = null;
  walletTimer = null;
  softOrderTimer = null;
}

module.exports = { start, stop, runOnce, runWalletTradesOnce, runSoftOrdersOnce };
