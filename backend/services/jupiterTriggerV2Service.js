/**
 * Jupiter Trigger API V2 Service
 *
 * V2 (api.jup.ag/trigger/v2) supports what V1 fundamentally cannot:
 * stop-losses ("sell below"), buy-above, OCO (TP+SL pairs) — all with USD
 * price triggers. Requires a Jupiter API key (JUPITER_API_KEY) plus a
 * per-wallet JWT obtained via a challenge the user's wallet signs.
 *
 * This service is a thin proxy: the frontend holds the JWT (wallet-scoped),
 * the backend holds the API key. Order listings are normalized to the same
 * shape jupiterTriggerService (V1) returns so the UI can merge both.
 */

const axios = require('axios');

const V2_BASE = 'https://api.jup.ag/trigger/v2';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const getApiKey = () => process.env.JUPITER_API_KEY || null;

function assertApiKey() {
  if (!getApiKey()) {
    const err = new Error('JUPITER_API_KEY is not configured on the server — get one at developers.jup.ag/portal');
    err.statusCode = 503;
    throw err;
  }
}

function headers(jwt) {
  const h = { 'Content-Type': 'application/json', 'x-api-key': getApiKey() };
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
}

function wrapError(error) {
  const data = error.response?.data;
  const message = data?.error || data?.message || (typeof data === 'string' ? data : null) || error.message;
  console.warn(`[Jupiter Trigger V2] ${error.config?.method?.toUpperCase() || ''} ${error.config?.url || ''} failed (${error.response?.status || '-'}):`, message);
  return {
    success: false,
    error: message,
    statusCode: error.statusCode || error.response?.status || 500,
    details: data,
  };
}

// ── Auth proxies ─────────────────────────────────────────────────────────────

async function authChallenge({ walletPubkey, type = 'message' }) {
  assertApiKey();
  try {
    const res = await axios.post(`${V2_BASE}/auth/challenge`, { walletPubkey, type }, { headers: headers(), timeout: 15000 });
    return { success: true, ...res.data };
  } catch (error) {
    return wrapError(error);
  }
}

async function authVerify(body) {
  assertApiKey();
  try {
    const res = await axios.post(`${V2_BASE}/auth/verify`, body, { headers: headers(), timeout: 15000 });
    return { success: true, ...res.data };
  } catch (error) {
    return wrapError(error);
  }
}

// ── Vault + deposit + create ─────────────────────────────────────────────────

async function getOrRegisterVault(jwt) {
  assertApiKey();
  try {
    const res = await axios.get(`${V2_BASE}/vault`, { headers: headers(jwt), timeout: 15000 });
    return { success: true, ...res.data };
  } catch (error) {
    if (error.response && error.response.status !== 401 && error.response.status !== 403) {
      try {
        const reg = await axios.get(`${V2_BASE}/vault/register`, { headers: headers(jwt), timeout: 20000 });
        return { success: true, ...reg.data };
      } catch (regError) {
        return wrapError(regError);
      }
    }
    return wrapError(error);
  }
}

async function craftDeposit(jwt, body) {
  assertApiKey();
  try {
    const res = await axios.post(`${V2_BASE}/deposit/craft`, body, { headers: headers(jwt), timeout: 20000 });
    return { success: true, ...res.data };
  } catch (error) {
    return wrapError(error);
  }
}

async function createPriceOrder(jwt, body) {
  assertApiKey();
  try {
    const res = await axios.post(`${V2_BASE}/orders/price`, body, { headers: headers(jwt), timeout: 45000 });
    return { success: true, ...res.data };
  } catch (error) {
    return wrapError(error);
  }
}

// ── Cancel (two-step) ────────────────────────────────────────────────────────

async function cancelOrderInit(jwt, orderId) {
  assertApiKey();
  try {
    const res = await axios.post(`${V2_BASE}/orders/price/cancel/${orderId}`, {}, { headers: headers(jwt), timeout: 20000 });
    return { success: true, ...res.data };
  } catch (error) {
    return wrapError(error);
  }
}

async function cancelOrderConfirm(jwt, orderId, { signedTransaction, cancelRequestId }) {
  assertApiKey();
  try {
    const res = await axios.post(
      `${V2_BASE}/orders/price/confirm-cancel/${orderId}`,
      { signedTransaction, cancelRequestId },
      { headers: headers(jwt), timeout: 45000 }
    );
    return { success: true, ...res.data };
  } catch (error) {
    return wrapError(error);
  }
}

// ── Token metadata / price enrichment (Dexscreener, cached) ─────────────────

const tokenInfoCache = new Map(); // mint -> { data, timestamp }
const TOKEN_INFO_TTL = 60 * 1000; // price is included, keep it fresh-ish
const decimalsCache = new Map();  // mint -> number (immutable)

async function fetchTokenDecimals(mint) {
  if (mint === SOL_MINT) return 9;
  if (decimalsCache.has(mint)) return decimalsCache.get(mint);
  try {
    const res = await axios.get(`https://tokens.jup.ag/token/${mint}`, { timeout: 5000 });
    if (typeof res.data?.decimals === 'number') {
      decimalsCache.set(mint, res.data.decimals);
      return res.data.decimals;
    }
  } catch (_) { /* fall through */ }
  try {
    const { HELIUS_RPC_URL } = require('../solanaRpcConfig');
    const res = await axios.post(HELIUS_RPC_URL, {
      jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [mint],
    }, { timeout: 5000 });
    const dec = res.data?.result?.value?.decimals;
    if (typeof dec === 'number') {
      decimalsCache.set(mint, dec);
      return dec;
    }
  } catch (_) { /* fall through */ }
  return 6; // pump.fun default
}

async function fetchTokenInfo(mint) {
  const cached = tokenInfoCache.get(mint);
  if (cached && Date.now() - cached.timestamp < TOKEN_INFO_TTL) return cached.data;
  const info = {
    symbol: null, name: null, image: null, banner: null, pairAddress: null,
    priceUsd: null, priceNative: null,
  };
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { timeout: 5000 });
    const pairs = res.data?.pairs || [];
    // Prefer the deepest-liquidity SOL pair for a native (SOL/token) price
    const solPairs = pairs.filter((p) => p.quoteToken?.address === SOL_MINT && Number(p.priceNative) > 0);
    const best = (solPairs.length ? solPairs : pairs)
      .sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
    if (best) {
      const isBase = best.baseToken?.address?.toLowerCase() === mint.toLowerCase();
      const side = isBase ? best.baseToken : best.quoteToken;
      info.symbol = side?.symbol || null;
      info.name = side?.name || null;
      info.image = best.info?.imageUrl || null;
      info.banner = best.info?.header || best.info?.imageUrl || null;
      info.pairAddress = best.pairAddress || null;
      info.priceUsd = Number(best.priceUsd) > 0 ? Number(best.priceUsd) : null;
      info.priceNative = Number(best.priceNative) > 0 ? Number(best.priceNative) : null;
    }
  } catch (_) { /* silent */ }
  if (!info.symbol) {
    try {
      const res = await axios.get(`https://frontend-api.pump.fun/coins/${mint}`, { timeout: 5000 });
      if (res.data?.symbol) {
        info.symbol = res.data.symbol;
        info.name = res.data.name || res.data.symbol;
        info.image = info.image || res.data.image_uri || null;
        info.banner = info.banner || res.data.header_image || null;
      }
    } catch (_) { /* silent */ }
  }
  if (!info.symbol) info.symbol = `${mint.slice(0, 4)}...${mint.slice(-4)}`;
  if (!info.name) info.name = info.symbol;
  tokenInfoCache.set(mint, { data: info, timestamp: Date.now() });
  return info;
}

let solUsdCache = { price: null, timestamp: 0 };
async function getSolUsd() {
  if (solUsdCache.price && Date.now() - solUsdCache.timestamp < 5 * 60 * 1000) return solUsdCache.price;
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`, { timeout: 5000 });
    const pair = (res.data?.pairs || []).find((p) => Number(p.priceUsd) > 0);
    if (pair) {
      solUsdCache = { price: Number(pair.priceUsd), timestamp: Date.now() };
      return solUsdCache.price;
    }
  } catch (_) { /* silent */ }
  return solUsdCache.price || 150;
}

// ── Order listing (normalized to the V1 card shape) ─────────────────────────

function mapOrderState(orderState) {
  switch (orderState) {
    case 'pending':
    case 'open':
    case 'executing':
    case 'pending_withdraw':
      return 'active';
    case 'filled':
      return 'executed';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    case 'failed':
      return 'failed';
    default:
      return orderState || 'active';
  }
}

function eventSignature(events, type) {
  const ev = (events || []).filter((e) => e.type === type && e.txSignature);
  return ev.length ? ev[ev.length - 1].txSignature : null;
}

async function normalizeOrder(order) {
  const isBuy = order.inputMint === SOL_MINT;
  const tokenMint = isBuy ? order.outputMint : order.inputMint;

  const [info, tokenDecimals, solUsd] = await Promise.all([
    fetchTokenInfo(tokenMint),
    fetchTokenDecimals(tokenMint),
    getSolUsd(),
  ]);

  // Prefer the token's own pair for the SOL/USD rate so trigger conversion
  // matches the pair the order fills against.
  const pairSolUsd = info.priceUsd && info.priceNative ? info.priceUsd / info.priceNative : solUsd;

  const inputDecimals = isBuy ? 9 : tokenDecimals;
  const initialInput = Number(order.initialInputAmount || 0) / Math.pow(10, inputDecimals);

  // OCO orders carry tp/sl instead of a single trigger; expose the pair and use
  // TP as the primary display trigger.
  const isOco = order.orderType === 'oco';
  const triggerPriceUsd = isOco ? Number(order.tpPriceUsd || order.triggerPriceUsd || 0) : Number(order.triggerPriceUsd || 0);
  const stopLossPriceUsd = isOco ? Number(order.slPriceUsd || 0) || null : null;
  const triggerPriceSol = pairSolUsd > 0 ? triggerPriceUsd / pairSolUsd : 0;

  const currentPriceSol = info.priceNative || (info.priceUsd && pairSolUsd > 0 ? info.priceUsd / pairSolUsd : null) || triggerPriceSol;

  // amount = token quantity, estimatedValue = SOL size (matching V1 semantics)
  let amount;
  let estimatedValue;
  if (isBuy) {
    estimatedValue = initialInput; // SOL locked
    amount = triggerPriceSol > 0 ? initialInput / triggerPriceSol : 0; // est. tokens out
  } else {
    amount = initialInput; // tokens locked
    estimatedValue = amount * triggerPriceSol; // est. SOL out at trigger
  }

  // For fills, prefer the real output over estimates
  const outputRaw = Number(order.outputAmount || 0);
  if (outputRaw > 0) {
    if (isBuy) amount = outputRaw / Math.pow(10, tokenDecimals);
    else estimatedValue = outputRaw / 1e9;
  }

  const status = mapOrderState(order.orderState);
  const createdAtISO = order.createdAt ? new Date(Number(order.createdAt) || order.createdAt).toISOString() : new Date().toISOString();
  const expiresAtISO = order.expiresAt ? new Date(Number(order.expiresAt) || order.expiresAt).toISOString() : null;

  return {
    id: order.id,
    orderId: order.id,
    source: 'v2',
    orderVariant: order.orderType, // single | oco | otoco
    orderState: order.orderState,
    rawState: order.rawState,
    tokenSymbol: info.symbol,
    tokenName: info.name,
    tokenMint,
    tokenImage: info.image,
    tokenBannerImage: info.banner,
    tokenPairAddress: info.pairAddress,
    type: isBuy ? 'buy' : 'sell',
    status: status === 'active' ? 'active' : status,
    inputMint: order.inputMint,
    outputMint: order.outputMint,
    triggerCondition: order.triggerCondition || (isOco ? 'oco' : null),
    triggerPriceUsd,
    stopLossPriceUsd,
    trailingBps: order.trailingBps || null,
    triggerPrice: triggerPriceSol,
    currentPrice: currentPriceSol,
    currentPriceUsd: info.priceUsd || null,
    amount,
    estimatedValue,
    fillPercent: order.fillPercent ?? null,
    createdAt: createdAtISO,
    expiresAt: expiresAtISO,
    expiredAt: expiresAtISO,
    createTxSignature: eventSignature(order.events, 'deposit'),
    executeTxSignature: eventSignature(order.events, 'fill'),
    cancelTxSignature: eventSignature(order.events, 'withdrawal') || eventSignature(order.events, 'cancelled'),
    events: order.events || [],
  };
}

async function getOrders(jwt, { state = 'active', limit = 50, offset = 0 } = {}) {
  assertApiKey();
  try {
    const res = await axios.get(`${V2_BASE}/orders/history`, {
      headers: headers(jwt),
      params: { state, limit, offset, sort: 'created_at', dir: 'desc' },
      timeout: 30000,
    });
    const rawOrders = res.data?.orders || [];
    const orders = await Promise.all(rawOrders.map((o) => normalizeOrder(o).catch((e) => {
      console.warn('[Jupiter Trigger V2] Failed to normalize order', o?.id, e.message);
      return null;
    })));
    return {
      success: true,
      orders: orders.filter(Boolean),
      pagination: res.data?.pagination || null,
    };
  } catch (error) {
    return wrapError(error);
  }
}

module.exports = {
  authChallenge,
  authVerify,
  getOrRegisterVault,
  craftDeposit,
  createPriceOrder,
  cancelOrderInit,
  cancelOrderConfirm,
  getOrders,
  isConfigured: () => Boolean(getApiKey()),
};
