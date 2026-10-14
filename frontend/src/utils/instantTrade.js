// Instant buy/sell execution through the in-app trading wallet.
// Flow per trade: backend builds a Jupiter Swap API transaction (explicit
// slippage + integrator fee) → we sign locally with the trading keypair →
// backend broadcasts through Helius and polls confirmation. One tap, no
// wallet-app round trip.
import { VersionedTransaction, Transaction, PublicKey } from '@solana/web3.js';
import { getFullApiUrl } from '../config/api';
import { loadTradingWallet, getTradingKeypair, getPresets } from './instantTradeWallet';
import { storeTransaction } from './transactionStorage';
import { getSolUsdPrice } from './orderFillTracking';
import { fetchTokenDecimals } from './triggerOrders';
import { createSoftOrder } from './softOrders';
import ReferralTracker from './ReferralTracker';
import { track } from './analytics';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
// Fallback when /limits is unreachable. Beyond the buy amount a swap also pays:
// WSOL + token ATA rent (~0.004), priority fee (≤0.002), base fee, and the
// wallet must keep its own rent-exempt minimum (~0.0009). The server computes
// the exact figure per wallet/mint; see getTradingLimits().
export const SWAP_FEE_OVERHEAD_SOL = 0.009;

function friendlySwapError(err) {
  const msg = String(err?.message || '');
  if (/insufficient funds for rent/i.test(msg)) {
    return new Error('Not enough SOL left for rent — the trading wallet must keep ~0.001 SOL. Try a slightly smaller amount.');
  }
  if (/custom program error: 0x1\b/i.test(msg) || /insufficient (funds|lamports)/i.test(msg) || /AccountNotFound/i.test(msg)) {
    return new Error(`Not enough SOL — a swap also needs ~${SWAP_FEE_OVERHEAD_SOL} SOL for fees and token-account rent. Try a smaller amount.`);
  }
  if (/0x1771|slippage/i.test(msg)) {
    return new Error('Price moved beyond your max slippage — try again or raise slippage.');
  }
  if (/0x177e|IncorrectTokenProgramID/i.test(msg)) {
    return new Error("This coin's swap route rejected the trade — try again in a moment.");
  }
  return err;
}

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
};

async function api(path, options) {
  const res = await fetch(getFullApiUrl(path), options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    if (data.code) err.code = data.code;
    if (data.status) err.txStatus = data.status;
    throw err;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Broadcast an already-signed transaction and resolve its final state.
// Throws on 'failed' / 'expired' / 'rejected' (nothing executed). Returns
// { signature, confirmed, status } where status is 'confirmed' or — only if
// the network is badly congested — 'pending' (the tx may still land; callers
// must present it as "submitted", never as done).
async function broadcastSigned(signedBytes, lastValidBlockHeight) {
  const sent = await api('/api/instant-trade/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: bytesToB64(signedBytes), lastValidBlockHeight }),
  });
  let { status, signature } = sent;
  if (status === 'pending' && signature) {
    // Server stopped waiting; keep polling client-side for a bit longer.
    for (let i = 0; i < 20 && status === 'pending'; i++) {
      await sleep(2000);
      const s = await api(`/api/instant-trade/status/${signature}`).catch(() => null);
      if (!s) continue;
      if (s.status === 'confirmed') status = 'confirmed';
      else if (s.status === 'failed') throw new Error(`Transaction failed on-chain: ${s.error || 'unknown error'}`);
    }
  }
  if (status === 'failed' || status === 'expired' || status === 'rejected') {
    throw new Error(sent.error || 'Transaction did not go through');
  }
  if (sent.error && status !== 'confirmed') throw new Error(sent.error);
  return { signature, confirmed: status === 'confirmed', status: status || (sent.confirmed ? 'confirmed' : 'pending') };
}

async function signAndSend(swapTransactionB64, lastValidBlockHeight = null) {
  const keypair = await getTradingKeypair();
  if (!keypair) throw new Error('No trading wallet set up');
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTransactionB64));
  tx.sign([keypair]);
  return broadcastSigned(tx.serialize(), lastValidBlockHeight);
}

async function signAndSendLegacy(transactionB64, lastValidBlockHeight = null) {
  const keypair = await getTradingKeypair();
  if (!keypair) throw new Error('No trading wallet set up');
  const tx = Transaction.from(b64ToBytes(transactionB64));
  tx.sign(keypair);
  return broadcastSigned(new Uint8Array(tx.serialize()), lastValidBlockHeight);
}

async function buildSwap({ inputMint, outputMint, amountRaw, slippageBps, wallet }) {
  return api('/api/instant-trade/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputMint, outputMint, amountRaw: String(amountRaw), slippageBps, wallet }),
  });
}

/**
 * Exact funding limits for the trading wallet from the server (rent minimum,
 * per-swap overhead given whether the token ATA already exists, max buy).
 * Falls back to the conservative constant if the endpoint is unreachable.
 * Returns { sol, rentMinSol, buyOverheadSol, sellOverheadSol, maxBuySol, exact }.
 */
export async function getTradingLimits(mint = null) {
  const wallet = await loadTradingWallet();
  if (!wallet) return { sol: 0, rentMinSol: 0, buyOverheadSol: SWAP_FEE_OVERHEAD_SOL, sellOverheadSol: SWAP_FEE_OVERHEAD_SOL, maxBuySol: 0, exact: false };
  try {
    const q = mint ? `?mint=${encodeURIComponent(mint)}` : '';
    const d = await api(`/api/instant-trade/limits/${wallet.publicKey}${q}`);
    return {
      sol: d.balanceLamports / 1e9,
      rentMinSol: d.rentMinLamports / 1e9,
      buyOverheadSol: (d.buyOverheadLamports + d.rentMinLamports) / 1e9,
      sellOverheadSol: (d.sellOverheadLamports + d.rentMinLamports) / 1e9,
      maxBuySol: Math.floor(d.maxBuyLamports / 1e5) / 1e4, // floor to 0.0001 SOL
      exact: true,
    };
  } catch {
    const { sol } = await getTradingWalletBalances();
    return {
      sol,
      rentMinSol: 0.001,
      buyOverheadSol: SWAP_FEE_OVERHEAD_SOL,
      sellOverheadSol: SWAP_FEE_OVERHEAD_SOL,
      maxBuySol: Math.max(0, Math.floor((sol - SWAP_FEE_OVERHEAD_SOL) * 1e4) / 1e4),
      exact: false,
    };
  }
}

// Backend re-verifies volume on-chain from the signature, so this is fire-and-forget.
function reportAffiliateTrade({ signature, wallet, solAmount, side, coin }) {
  ReferralTracker.trackTrade({
    userWallet: wallet,
    tradeVolume: solAmount,
    feeEarned: solAmount * 0.01,
    tokenIn: side === 'buy' ? SOL_MINT : coin?.mintAddress,
    tokenOut: side === 'buy' ? coin?.mintAddress : SOL_MINT,
    transactionSignature: signature,
    metadata: { coinSymbol: coin?.symbol, coinName: coin?.name, side, source: 'instant-trade', timestamp: new Date().toISOString() },
  }).catch((err) => console.warn('[instant-trade] affiliate tracking failed:', err?.message));
}

export async function getTradingWalletBalances(mint = null) {
  const wallet = await loadTradingWallet();
  if (!wallet) return { sol: 0, tokens: 0, tokensRaw: 0n, decimals: null };
  const [solRes, tokenRes] = await Promise.all([
    api(`/api/wallet/${wallet.publicKey}/balance`).catch(() => ({ sol: 0 })),
    mint ? api(`/api/wallet/${wallet.publicKey}/balance?mint=${mint}`).catch(() => ({ amount: 0 })) : Promise.resolve({ amount: 0 }),
  ]);
  let tokensRaw = 0n;
  try { tokensRaw = BigInt(tokenRes.amountRaw ?? 0); } catch (_) { /* older backend */ }
  return {
    sol: Number(solRes.sol) || 0,
    tokens: Number(tokenRes.amount) || 0,
    tokensRaw,
    decimals: typeof tokenRes.decimals === 'number' ? tokenRes.decimals : null,
  };
}

/**
 * One-tap buy at the saved presets (or explicit overrides).
 * Returns { signature, confirmed, solSpent, tokensReceived, autoSellOrder }.
 */
export async function executeInstantBuy(coin, overrides = {}) {
  const mint = coin?.mintAddress || coin?.address;
  if (!mint) throw new Error('Invalid coin');
  const wallet = await loadTradingWallet();
  if (!wallet) throw new Error('No trading wallet set up');

  const presets = { ...getPresets(), ...overrides };
  const solSpent = Number(presets.buySol);
  if (!(solSpent > 0)) throw new Error('Set a buy amount first');

  const limits = await getTradingLimits(mint);
  if (limits.sol < solSpent + limits.buyOverheadSol) {
    throw new Error(limits.maxBuySol >= 0.001
      ? `Not enough SOL for a ${solSpent} SOL buy — fees/rent need ~${limits.buyOverheadSol.toFixed(4)} SOL on top. Max right now: ${limits.maxBuySol} SOL.`
      : 'Not enough SOL in the trading wallet — deposit more to trade.');
  }

  const lamports = Math.round(solSpent * 1e9);
  const slippageBps = Math.round(Math.max(0.1, Number(presets.slippagePct) || 3) * 100);

  let built;
  let sent;
  try {
    built = await buildSwap({ inputMint: SOL_MINT, outputMint: mint, amountRaw: lamports, slippageBps, wallet: wallet.publicKey });
    sent = await signAndSend(built.swapTransaction, built.lastValidBlockHeight);
  } catch (err) {
    throw friendlySwapError(err);
  }

  const decimals = await fetchTokenDecimals(mint).catch(() => 6);
  const tokensReceived = Number(built.quote?.outAmount || 0) / 10 ** decimals;
  const solUsd = await getSolUsdPrice().catch(() => 0);
  const pricePerToken = tokensReceived > 0 ? solSpent / tokensReceived : 0;
  const priceUsd = pricePerToken * solUsd;

  storeTransaction({
    walletAddress: wallet.publicKey,
    signature: sent.signature,
    type: 'buy',
    tokenMint: mint,
    tokenSymbol: coin.symbol,
    tokenName: coin.name,
    tokenImage: coin.image || coin.logo || null,
    inputAmount: solSpent,
    outputAmount: tokensReceived,
    inputMint: SOL_MINT,
    outputMint: mint,
    pricePerToken,
    pricePerTokenUsd: priceUsd,
  });
  reportAffiliateTrade({ signature: sent.signature, wallet: wallet.publicKey, solAmount: solSpent, side: 'buy', coin });
  track('swap_success', { mint, symbol: coin.symbol, label: 'instant_buy', value: solSpent });

  // Take-profit / stop-loss bracket: server-monitored soft orders that alert
  // (and deep-link back) when either side hits.
  const sellAlert = (pctMove) => createSoftOrder({
    walletAddress: wallet.publicKey,
    mint,
    tokenSymbol: coin.symbol,
    tokenName: coin.name,
    tokenImage: coin.image || null,
    side: 'sell',
    triggerPriceUsd: priceUsd * (1 + pctMove / 100),
    currentPriceUsd: priceUsd,
    amountTokens: tokensReceived,
  }).catch((err) => {
    console.warn('[instant-trade] sell alert failed:', err?.message);
    return null;
  });

  let autoSellOrder = null;
  let stopLossOrder = null;
  const autoSellPct = Number(presets.autoSellPct) || 0;
  const stopLossPct = Number(presets.stopLossPct) || 0;
  // Only bracket a buy we know landed — a still-pending tx might never fill.
  if (sent.confirmed && priceUsd > 0 && tokensReceived > 0) {
    if (autoSellPct > 0) autoSellOrder = await sellAlert(autoSellPct);
    if (stopLossPct > 0) stopLossOrder = await sellAlert(-stopLossPct);
  }

  window.dispatchEvent(new CustomEvent('moonfeed:instant-trade', {
    detail: { side: 'buy', mint, symbol: coin.symbol, signature: sent.signature, solAmount: solSpent, tokens: tokensReceived },
  }));
  return { ...sent, solSpent, tokensReceived, autoSellOrder, stopLossOrder };
}

/**
 * Sell a percentage (1-100) of the trading wallet's holdings of this coin.
 * Returns { signature, confirmed, tokensSold, solReceived }.
 */
export async function executeInstantSell(coin, pct) {
  const mint = coin?.mintAddress || coin?.address;
  if (!mint) throw new Error('Invalid coin');
  const wallet = await loadTradingWallet();
  if (!wallet) throw new Error('No trading wallet set up');

  const { tokens, tokensRaw, decimals: chainDecimals } = await getTradingWalletBalances(mint);
  if (!(tokens > 0)) throw new Error(`No ${coin.symbol || 'token'} in the trading wallet`);
  const share = Math.min(100, Math.max(1, Number(pct) || 100)) / 100;
  const decimals = typeof chainDecimals === 'number'
    ? chainDecimals
    : await fetchTokenDecimals(mint).catch(() => 6);
  // The on-chain raw amount is authoritative — rebuilding it from the UI amount
  // with guessed decimals sells 10^k too little/much whenever the guess is wrong.
  const fullRaw = tokensRaw > 0n ? tokensRaw : BigInt(Math.floor(tokens * 10 ** decimals));
  const amountRaw = share >= 1
    ? fullRaw // full balance so we never oversell
    : (fullRaw * BigInt(Math.round(share * 10000))) / 10000n;
  if (amountRaw <= 0n) throw new Error('Amount too small to sell');

  const presets = getPresets();
  const slippageBps = Math.round(Math.max(0.1, Number(presets.slippagePct) || 3) * 100);

  // A sell still fronts WSOL rent + priority fee from the SOL balance (the
  // rent comes back when the WSOL account closes, but it must exist first).
  const limits = await getTradingLimits(mint);
  if (limits.sol < limits.sellOverheadSol) {
    throw new Error(`Selling needs ~${limits.sellOverheadSol.toFixed(4)} SOL in the trading wallet for fees — you have ${limits.sol.toFixed(4)}. Deposit a little SOL first.`);
  }

  let built;
  let sent;
  try {
    built = await buildSwap({ inputMint: mint, outputMint: SOL_MINT, amountRaw, slippageBps, wallet: wallet.publicKey });
    sent = await signAndSend(built.swapTransaction, built.lastValidBlockHeight);
  } catch (err) {
    throw friendlySwapError(err);
  }

  const tokensSold = Number(amountRaw) / 10 ** decimals;
  const solReceived = Number(built.quote?.outAmount || 0) / 1e9;
  const solUsd = await getSolUsdPrice().catch(() => 0);
  const pricePerToken = tokensSold > 0 ? solReceived / tokensSold : 0;

  storeTransaction({
    walletAddress: wallet.publicKey,
    signature: sent.signature,
    type: 'sell',
    tokenMint: mint,
    tokenSymbol: coin.symbol,
    tokenName: coin.name,
    tokenImage: coin.image || coin.logo || null,
    inputAmount: tokensSold,
    outputAmount: solReceived,
    inputMint: mint,
    outputMint: SOL_MINT,
    pricePerToken,
    pricePerTokenUsd: pricePerToken * solUsd,
  });
  reportAffiliateTrade({ signature: sent.signature, wallet: wallet.publicKey, solAmount: solReceived, side: 'sell', coin });
  track('swap_success', { mint, symbol: coin.symbol, label: 'instant_sell', value: solReceived });

  window.dispatchEvent(new CustomEvent('moonfeed:instant-trade', {
    detail: { side: 'sell', mint, symbol: coin.symbol, signature: sent.signature, solAmount: solReceived, tokens: tokensSold },
  }));
  return { ...sent, tokensSold, solReceived };
}

/**
 * Withdraw SOL from the trading wallet to a destination address.
 * `solAmount` null/undefined sweeps the full balance (leaves exactly 0 — the
 * only non-rent-exempt balance the runtime permits). A partial amount must
 * leave the rent-exempt minimum behind; the server enforces both rules and
 * pays the exact network fee from the remainder.
 */
export async function withdrawSol(destination, solAmount = null) {
  const keypair = await getTradingKeypair();
  if (!keypair) throw new Error('No trading wallet set up');
  const destKey = new PublicKey(String(destination).trim()); // throws on invalid address

  const body = { wallet: keypair.publicKey.toBase58(), destination: destKey.toBase58() };
  if (solAmount != null && solAmount !== '') {
    const n = Number(solAmount);
    if (!(n > 0)) throw new Error('Enter a valid amount');
    body.lamports = Math.round(n * 1e9);
  }

  const built = await api('/api/instant-trade/build-withdraw-sol', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let sent;
  try {
    sent = await signAndSendLegacy(built.transaction, built.lastValidBlockHeight);
  } catch (err) {
    throw friendlySwapError(err);
  }
  return { ...sent, solWithdrawn: built.lamports / 1e9, feeSol: built.feeLamports / 1e9 };
}

/** Every token the trading wallet holds: [{ mint, amount, amountRaw, decimals }]. */
export async function listTradingWalletTokens() {
  const wallet = await loadTradingWallet();
  if (!wallet) return [];
  const data = await api(`/api/instant-trade/tokens/${wallet.publicKey}`);
  return Array.isArray(data.tokens) ? data.tokens : [];
}

/** Withdraw the trading wallet's FULL balance of one token to a destination address. */
export async function withdrawToken(mint, destination) {
  const keypair = await getTradingKeypair();
  if (!keypair) throw new Error('No trading wallet set up');
  const destKey = new PublicKey(String(destination).trim()); // throws on invalid address

  // Backend builds the transfer (dest ATA created idempotently, on-chain raw
  // amount + token program resolved server-side); we only sign locally.
  const built = await api('/api/instant-trade/build-withdraw-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: keypair.publicKey.toBase58(), mint, destination: destKey.toBase58() }),
  });

  let sent;
  try {
    sent = await signAndSendLegacy(built.transaction, built.lastValidBlockHeight);
  } catch (err) {
    throw friendlySwapError(err);
  }
  return { ...sent, amount: built.amount, decimals: built.decimals };
}
