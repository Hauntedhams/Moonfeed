/**
 * Helius Webhook registration/sync.
 *
 * Replaces the 24/7 wallet-trade polling loop: instead of a 1-credit signature
 * probe per tracked wallet every cycle (plus 100-credit Enhanced fetches when a
 * wallet traded), Helius POSTs each SWAP to us as it happens — 1 credit per
 * actual event, zero idle cost.
 *
 * Requires env:
 *   HELIUS_WEBHOOK_PUBLIC_URL  e.g. https://api.moonfeed.app/api/webhook/helius
 *   HELIUS_WEBHOOK_SECRET      shared secret sent back by Helius as the
 *                              Authorization header on every delivery
 */
const fetch = require('node-fetch');
const User = require('../models/User');
const { HELIUS_API_KEY } = require('../solanaRpcConfig');

const WEBHOOK_URL = (process.env.HELIUS_WEBHOOK_PUBLIC_URL || '').trim();
const WEBHOOK_SECRET = (process.env.HELIUS_WEBHOOK_SECRET || '').trim();
// Re-sync the tracked-address list periodically (cheap Mongo distinct; the
// Helius webhook is only edited when the set actually changed).
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const MAX_ADDRESSES = 900;

let timer = null;
let webhookId = null;
let trackedSet = new Set(); // addresses currently registered on the webhook

function isConfigured() {
  return Boolean(
    WEBHOOK_URL &&
    WEBHOOK_SECRET &&
    HELIUS_API_KEY &&
    !WEBHOOK_URL.includes('your-domain.com') &&
    WEBHOOK_SECRET !== 'CHANGE_ME_SECRET'
  );
}

function getSecret() {
  return WEBHOOK_SECRET;
}

/** Addresses currently covered by the webhook (last successful sync). */
function getTrackedSet() {
  return trackedSet;
}

async function collectTrackedAddresses() {
  const addrs = await User.distinct('trackedWallets.address');
  return addrs
    .filter((a) => typeof a === 'string' && a.length >= 32 && a.length <= 44)
    .slice(0, MAX_ADDRESSES);
}

async function heliusApi(method, path, body) {
  const res = await fetch(`https://api.helius.xyz/v0/webhooks${path}?api-key=${HELIUS_API_KEY}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    timeout: 10000,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Helius webhooks API ${method} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function syncWebhook() {
  const addresses = await collectTrackedAddresses();
  if (!addresses.length) {
    console.log('[webhook] no tracked wallets yet — skipping webhook registration');
    return;
  }

  const desired = {
    webhookURL: WEBHOOK_URL,
    transactionTypes: ['SWAP'],
    accountAddresses: addresses,
    webhookType: 'enhanced',
    authHeader: WEBHOOK_SECRET,
  };

  // Find our existing webhook by URL (survives restarts without persisting the id).
  if (!webhookId) {
    const existing = await heliusApi('GET', '');
    const mine = Array.isArray(existing) ? existing.find((w) => w.webhookURL === WEBHOOK_URL) : null;
    if (mine) {
      webhookId = mine.webhookID;
      trackedSet = new Set(mine.accountAddresses || []);
    }
  }

  const desiredSet = new Set(addresses);
  const unchanged =
    webhookId &&
    trackedSet.size === desiredSet.size &&
    addresses.every((a) => trackedSet.has(a));
  if (unchanged) return;

  if (webhookId) {
    await heliusApi('PUT', `/${webhookId}`, desired);
    console.log(`[webhook] updated Helius webhook (${addresses.length} tracked wallets)`);
  } else {
    const created = await heliusApi('POST', '', desired);
    webhookId = created.webhookID;
    console.log(`[webhook] created Helius webhook ${webhookId} (${addresses.length} tracked wallets)`);
  }
  trackedSet = desiredSet;
}

function start() {
  if (timer) return;
  if (!isConfigured()) {
    console.log('[webhook] not configured (set HELIUS_WEBHOOK_PUBLIC_URL + HELIUS_WEBHOOK_SECRET) — wallet-trade polling stays primary');
    return;
  }
  const run = () => syncWebhook().catch((e) => console.error('[webhook] sync error:', e.message));
  run();
  timer = setInterval(run, SYNC_INTERVAL_MS);
  console.log('[webhook] Helius webhook sync started');
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, isConfigured, getSecret, getTrackedSet, syncWebhook };
