// Server-side price monitors — run on the backend so alerts fire even when the
// app is fully closed. Uses the account's already-synced tracked coins
// (User.trackedCoins, with trackedAtPrice) + live Dexscreener prices, and pushes
// via FCM to that wallet's registered devices.
const fetch = require('node-fetch');
const User = require('../models/User');
const DeviceToken = require('../models/DeviceToken');
const PushAlertState = require('../models/PushAlertState');
const pushService = require('./pushService');

const POLL_INTERVAL_MS = 90 * 1000;
const CHUNK = 30;

// Tracked-coin gain thresholds.
const GAIN_PCT = 10;
const GAIN_REARM_PCT = 5;
// Held/tracked-coin crash thresholds (Dexscreener price-change windows).
const CRASH_M5_PCT = -15;
const CRASH_H1_PCT = -30;
const CRASH_REARM_M5 = -5;

let timer = null;

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
          data: { type: 'holdingCrash', mint },
        });
      }
    }
  }
}

function start() {
  if (timer) return;
  if (!pushService.isEnabled()) {
    console.log('[push] monitors not started (FCM disabled — set FIREBASE_SERVICE_ACCOUNT)');
    return;
  }
  console.log('[push] price monitors started (tracked-gain + crash)');
  runOnce().catch((e) => console.error('[push] monitor error:', e.message));
  timer = setInterval(() => {
    runOnce().catch((e) => console.error('[push] monitor error:', e.message));
  }, POLL_INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, runOnce };
