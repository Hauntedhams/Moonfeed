// Free real-time pump.fun launch feed (PumpPortal subscribeNewToken). Keeps a
// rolling window of recent launches so the X feed can answer "which coins
// launched right after this tweet?" the way trader X-trackers do.

const WebSocket = require('ws');
const { EventEmitter } = require('events');

const WS_URL = 'wss://pumpportal.fun/api/data';
const WINDOW_MS = 45 * 60 * 1000;
const MAX_LAUNCHES = 20000;
const METADATA_TIMEOUT_MS = 4000;
const IPFS_GATEWAYS = ['https://ipfs.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://dweb.link/ipfs/'];

const emitter = new EventEmitter();
emitter.setMaxListeners(20);

const launches = new Map(); // mint -> launch (insertion order == launch order)
const metadataCache = new Map(); // mint -> Promise<metadata|null>
let ws = null;
let started = false;
let reconnectTimer = null;
let reconnectDelayMs = 5000;
let lastMessageAt = 0;

function normalizeLaunch(msg) {
  return {
    mint: msg.mint,
    name: String(msg.name || '').slice(0, 64),
    symbol: String(msg.symbol || '').slice(0, 24),
    uri: typeof msg.uri === 'string' ? msg.uri : '',
    creator: msg.traderPublicKey || null,
    initialBuySol: Number(msg.solAmount) || 0,
    marketCapSol: Number(msg.marketCapSol) || 0,
    pool: msg.pool || 'pump',
    launchedAt: Date.now(),
  };
}

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [mint, launch] of launches) {
    if (launch.launchedAt >= cutoff && launches.size <= MAX_LAUNCHES) break;
    launches.delete(mint);
    metadataCache.delete(mint);
  }
}

function connect() {
  clearTimeout(reconnectTimer);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    reconnectDelayMs = 5000;
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    console.log('🚀 [launch-stream] connected to PumpPortal new-token feed');
  });

  ws.on('message', (raw) => {
    lastMessageAt = Date.now();
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.txType !== 'create' || !msg.mint) return;
    const launch = normalizeLaunch(msg);
    launches.set(launch.mint, launch);
    if (launches.size % 200 === 0) prune();
    emitter.emit('launch', launch);
  });

  ws.on('error', (err) => console.warn(`[launch-stream] ws error: ${err.message}`));

  ws.on('close', () => {
    ws = null;
    reconnectTimer = setTimeout(connect, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60000);
  });
}

function start() {
  if (started) return;
  started = true;
  connect();
  // A silently stalled socket (no close event) would freeze matching — recycle it.
  setInterval(() => {
    prune();
    if (ws && lastMessageAt && Date.now() - lastMessageAt > 120000) {
      console.warn('[launch-stream] no launches for 2m — reconnecting');
      ws.terminate();
    }
  }, 30000).unref();
}

function getLaunchesBetween(fromMs, toMs) {
  const out = [];
  for (const launch of launches.values()) {
    if (launch.launchedAt >= fromMs && launch.launchedAt <= toMs) out.push(launch);
  }
  return out;
}

function getLaunch(mint) {
  return launches.get(mint) || null;
}

function ipfsCandidates(uri) {
  const match = uri.match(/\/ipfs\/([^/?#]+)/) || uri.match(/^ipfs:\/\/([^/?#]+)/);
  if (!match) return [uri];
  return IPFS_GATEWAYS.map((gateway) => gateway + match[1]);
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Fetched lazily and only for launches that already look related to a tweet —
// the social links in the metadata are what make a match "verified".
function getMetadata(mint) {
  if (metadataCache.has(mint)) return metadataCache.get(mint);
  const launch = launches.get(mint);
  if (!launch?.uri || !/^(https:\/\/|ipfs:\/\/)/.test(launch.uri)) return Promise.resolve(null);

  const promise = (async () => {
    for (const url of ipfsCandidates(launch.uri)) {
      try {
        const json = await fetchJsonWithTimeout(url);
        return {
          image: typeof json.image === 'string' ? json.image : null,
          description: String(json.description || '').slice(0, 400),
          twitter: String(json.twitter || json.extensions?.twitter || '').slice(0, 300),
          website: String(json.website || json.extensions?.website || '').slice(0, 300),
          telegram: String(json.telegram || json.extensions?.telegram || '').slice(0, 300),
        };
      } catch {
        // try next gateway
      }
    }
    return null;
  })();
  metadataCache.set(mint, promise);
  return promise;
}

function onLaunch(listener) {
  emitter.on('launch', listener);
}

function getStats() {
  return { connected: ws?.readyState === WebSocket.OPEN, buffered: launches.size, lastMessageAt };
}

module.exports = { start, getLaunchesBetween, getLaunch, getMetadata, onLaunch, getStats };
