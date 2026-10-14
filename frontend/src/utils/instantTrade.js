// Instant buy/sell execution through the in-app trading wallet.
// Flow per trade: backend builds a Jupiter Swap API transaction (explicit
// slippage + integrator fee) → we sign locally with the trading keypair →
// backend broadcasts through Helius and polls confirmation. One tap, no
// wallet-app round trip.
import { VersionedTransaction, Transaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { getFullApiUrl } from '../config/api';
import { loadTradingWallet, getTradingKeypair, getPresets } from './instantTradeWallet';
import { storeTransaction, getTransactions } from './transactionStorage';
import { readPendingTrades, savePendingTrade, removePendingTrade, reconcilePendingTrades } from './pendingTrades';
import { invalidateWalletPositions } from './walletPositions';
import { getSolUsdPrice } from './orderFillTracking';
import { fetchTokenDecimals } from './triggerOrders';
import { createSoftOrder, fetchSoftOrders, cancelSoftOrder } from './softOrders';
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
      else if (s.status === 'failed' || s.status === 'expired') {
        const error = new Error(s.error || 'Transaction did not confirm');
        error.txStatus = s.status;
        throw error;
      }
    }
  }
  if (status === 'failed' || status === 'expired' || status === 'rejected') {
    const error = new Error(sent.error || 'Transaction did not go through');
    error.txStatus = status;
    throw error;
  }
  if (sent.error && status !== 'confirmed') throw new Error(sent.error);
  return { signature, confirmed: status === 'confirmed', status: status || (sent.confirmed ? 'confirmed' : 'pending') };
}

async function signAndSend(swapTransactionB64, lastValidBlockHeight = null, beforeSend = null, expectedWallet = null) {
  const keypair = await getTradingKeypair();
  if (!keypair) throw new Error('No trading wallet set up');
  if (expectedWallet && keypair.publicKey.toBase58() !== expectedWallet) {
    throw new Error('Trading wallet changed. Nothing was submitted; select your wallet and try again.');
  }
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTransactionB64));
  tx.sign([keypair]);
  if (beforeSend) beforeSend(bs58.encode(tx.signatures[0]));
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
export async function getTradingLimits(mint = null, selectedWallet = null) {
  const wallet = selectedWallet || await loadTradingWallet();
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
    const { sol } = await getTradingWalletBalances(null, wallet);
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

export async function getTradingWalletBalances(mint = null, selectedWallet = null) {
  const wallet = selectedWallet || await loadTradingWallet();
  if (!wallet) return { sol: 0, tokens: 0, tokensRaw: 0n, decimals: null };
  const [solRes, tokenRes] = await Promise.all([
    api(`/api/wallet/${wallet.publicKey}/balance`),
    mint ? api(`/api/wallet/${wallet.publicKey}/balance?mint=${mint}`) : Promise.resolve({ amount: 0 }),
  ]);
  let tokensRaw = 0n;
  try { tokensRaw = BigInt(tokenRes.amountRaw ?? 0); } catch { /* older backend */ }
  return {
    sol: Number(solRes.sol) || 0,
    tokens: Number(tokenRes.amount) || 0,
    tokensRaw,
    decimals: typeof tokenRes.decimals === 'number' ? tokenRes.decimals : null,
  };
}

function assertNoPendingTrade(wallet, mint, allowConfirmed = false) {
  const record = readPendingTrades().find((item) => item.walletAddress === wallet && item.tokenMint === mint && (!allowConfirmed || item.status !== 'confirmed'));
  if (record) {
    throw new Error(record.status === 'confirmed'
      ? 'This coin has a confirmed trade whose history/exit setup is still being recovered. Wait before buying again; you can still sell.'
      : 'A trade for this coin is still awaiting confirmation. Check its status before trading again.');
  }
}

function tradeEvent(record, extra = {}) {
  window.dispatchEvent(new CustomEvent('moonfeed:instant-trade', {
    detail: {
      walletAddress: record.walletAddress, side: record.type, mint: record.tokenMint,
      symbol: record.tokenSymbol, signature: record.signature, ...extra,
    },
  }));
}

async function finalizeTrade(record) {
  const alreadyStored = getTransactions(record.walletAddress).some((tx) => tx.signature === record.signature);
  if (!alreadyStored && !storeTransaction(record)) {
    throw new Error('Trade confirmed, but history could not be saved. Its signature is retained for recovery.');
  }
  invalidateWalletPositions(record.walletAddress);
  tradeEvent(record, { confirmed: true, solAmount: record.type === 'buy' ? record.inputAmount : record.outputAmount });
  const orders = { autoSellOrder: null, stopLossOrder: null };
  if (record.type === 'buy') {
    const price = Number(record.pricePerTokenUsd);
    const targets = [
      ['autoSellOrder', 'tp', Number(record.presets?.autoSellPct) || 0],
      ['stopLossOrder', 'sl', -(Number(record.presets?.stopLossPct) || 0)],
    ].filter(([, , pct]) => pct !== 0);
    if (targets.length) {
      const holdings = await api(`/api/instant-trade/tokens/${record.walletAddress}`);
      if (!Array.isArray(holdings.tokens)) throw new Error('Buy confirmed, but holdings could not be verified for exit orders.');
      if (!holdings.tokens.some((token) => token.mint === record.tokenMint && Number(token.amount) > 0)) {
        console.warn('[instant-trade] confirmed buy is no longer held; skipping exit-order recovery:', record.signature);
        return orders;
      }
    }
    if (targets.length && !(price > 0)) {
      throw new Error('Buy confirmed, but exit orders could not be set because the entry price is unavailable.');
    }
    for (const [key, kind, pct] of targets) {
      orders[key] = await createSoftOrder({
        walletAddress: record.walletAddress,
        mint: record.tokenMint,
        tokenSymbol: record.tokenSymbol,
        tokenName: record.tokenName,
        tokenImage: record.tokenImage,
        side: 'sell',
        triggerPriceUsd: price * (1 + pct / 100),
        currentPriceUsd: price,
        amountTokens: record.outputAmount,
        clientOrderId: `${record.signature}:${kind}`,
      });
    }
  } else if (record.fullSell) {
    const orders = await fetchSoftOrders(record.walletAddress, 'active');
    for (const order of orders.filter((item) => item.type === 'sell' && item.tokenMint === record.tokenMint && Date.parse(item.createdAt) <= record.timestamp)) {
      await cancelSoftOrder(order.orderId, record.walletAddress);
    }
  }
  return orders;
}

async function submitTrackedTrade(built, record) {
  let signature = null;
  let sent;
  try {
    sent = await signAndSend(built.swapTransaction, built.lastValidBlockHeight, (signedSignature) => {
      // No signed bytes or private keys are stored. Persistence must succeed before broadcast.
      savePendingTrade({ ...record, signature: signedSignature, lastValidBlockHeight: built.lastValidBlockHeight, status: 'pending' });
      signature = signedSignature;
      tradeEvent({ ...record, signature }, { confirmed: false });
    }, record.walletAddress);
  } catch (error) {
    if (!signature) throw friendlySwapError(error);
    if (error.txStatus === 'failed' || error.txStatus === 'expired') {
      removePendingTrade(signature);
      throw friendlySwapError(error);
    }
    console.warn('[instant-trade] broadcast outcome uncertain:', error.message);
    tradeEvent({ ...record, signature }, { confirmed: false });
    return { signature, confirmed: false, status: 'pending', warning: 'Submission could not be verified. Do not buy again; its signature will be checked automatically.' };
  }
  if (!sent.confirmed) {
    tradeEvent({ ...record, signature }, { confirmed: false });
    return sent;
  }
  const confirmedRecord = { ...record, signature, lastValidBlockHeight: built.lastValidBlockHeight, status: 'confirmed' };
  let orders;
  try {
    savePendingTrade(confirmedRecord);
    orders = await finalizeTrade(confirmedRecord);
    removePendingTrade(signature);
    tradeEvent(confirmedRecord, { confirmed: true });
  } catch (error) {
    console.error('[instant-trade] confirmed trade bookkeeping failed:', error.message);
    return { ...sent, warning: `${record.type === 'buy' ? 'Buy' : 'Sell'} confirmed, but history/exit-order setup is incomplete: ${error.message} Recovery will retry automatically.` };
  }
  reportAffiliateTrade({
    signature, wallet: record.walletAddress,
    solAmount: record.type === 'buy' ? record.inputAmount : record.outputAmount,
    side: record.type, coin: { mintAddress: record.tokenMint, symbol: record.tokenSymbol, name: record.tokenName },
  });
  track('swap_success', { mint: record.tokenMint, symbol: record.tokenSymbol, label: `instant_${record.type}` });
  return { ...sent, ...orders };
}

let recoveryRunning = false;
let recoveringWallet = null;
export async function recoverPendingInstantTrades() {
  if (recoveryRunning) return;
  recoveryRunning = true;
  try {
    const wallet = await loadTradingWallet();
    if (!wallet || tradingWalletsBusy.has(wallet.publicKey)) return;
    recoveringWallet = wallet.publicKey;
    await reconcilePendingTrades({
      wallet: wallet.publicKey,
      getStatus: (signature, lastValidBlockHeight) => api(
        `/api/instant-trade/status/${signature}${lastValidBlockHeight ? `?lastValidBlockHeight=${lastValidBlockHeight}` : ''}`
      ),
      onConfirmed: finalizeTrade,
      onSettled: (record) => tradeEvent(record, { confirmed: true }),
      onFailed: (record, result) => {
        console.warn('[instant-trade] submitted trade did not settle:', record.signature, result.status);
        removePendingTrade(record.signature);
        tradeEvent(record, { confirmed: false, error: result.error || 'Transaction did not confirm.' });
      },
      onError: (record, error) => {
        console.error('[instant-trade] trade recovery deferred:', record.signature, error.message);
        window.dispatchEvent(new CustomEvent('moonfeed:trade-recovery-error', { detail: { mint: record.tokenMint, error: error.message } }));
      },
    });
  } catch (error) {
    console.error('[instant-trade] recovery failed:', error.message);
    window.dispatchEvent(new CustomEvent('moonfeed:trade-recovery-error', { detail: { error: error.message } }));
  } finally {
    recoveringWallet = null;
    recoveryRunning = false;
  }
}

/**
 * One-tap buy at the saved presets (or explicit overrides).
 * Returns { signature, confirmed, solSpent, tokensReceived, autoSellOrder }.
 */
const tradingWalletsBusy = new Set();
export function isInstantTradeBusy(walletAddress) {
  return tradingWalletsBusy.has(walletAddress) || recoveringWallet === walletAddress;
}

async function withTradingWallet(action) {
  const wallet = await loadTradingWallet();
  if (!wallet) throw new Error('No trading wallet set up');
  if (isInstantTradeBusy(wallet.publicKey)) {
    throw new Error('A trade is already in progress or being reconciled for this wallet.');
  }
  tradingWalletsBusy.add(wallet.publicKey);
  try {
    return await action(wallet);
  } finally {
    tradingWalletsBusy.delete(wallet.publicKey);
  }
}

export function executeInstantBuy(coin, overrides = {}) {
  return withTradingWallet((wallet) => buyWithWallet(coin, overrides, wallet));
}

async function buyWithWallet(coin, overrides, wallet) {
  const mint = coin?.mintAddress || coin?.address;
  if (!mint) throw new Error('Invalid coin');
  assertNoPendingTrade(wallet.publicKey, mint);

  const presets = { ...getPresets(), ...overrides };
  const solSpent = Number(presets.buySol);
  if (!(solSpent > 0)) throw new Error('Set a buy amount first');

  const limits = await getTradingLimits(mint, wallet);
  if (limits.sol < solSpent + limits.buyOverheadSol) {
    throw new Error(limits.maxBuySol >= 0.001
      ? `Not enough SOL for a ${solSpent} SOL buy — fees/rent need ~${limits.buyOverheadSol.toFixed(4)} SOL on top. Max right now: ${limits.maxBuySol} SOL.`
      : 'Not enough SOL in the trading wallet — deposit more to trade.');
  }

  const lamports = Math.round(solSpent * 1e9);
  const slippageBps = Math.round(Math.max(0.1, Number(presets.slippagePct) || 3) * 100);

  let built;
  try {
    built = await buildSwap({ inputMint: SOL_MINT, outputMint: mint, amountRaw: lamports, slippageBps, wallet: wallet.publicKey });
  } catch (err) {
    throw friendlySwapError(err);
  }

  const decimals = built.outputDecimals;
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error('Token decimals could not be verified. Nothing was submitted.');
  const tokensReceived = Number(built.quote?.outAmount || 0) / 10 ** decimals;
  if (!(tokensReceived > 0)) throw new Error('Trading provider returned an invalid token amount. Nothing was submitted.');
  const solUsd = await getSolUsdPrice({ requireLivePrice: true });
  const pricePerToken = tokensReceived > 0 ? solSpent / tokensReceived : 0;
  const priceUsd = pricePerToken * solUsd;

  const sent = await submitTrackedTrade(built, {
    walletAddress: wallet.publicKey,
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
    presets,
    timestamp: Date.now(),
  });
  return { ...sent, solSpent, tokensReceived };
}

/**
 * Sell a percentage (1-100) of the trading wallet's holdings of this coin.
 * Returns { signature, confirmed, tokensSold, solReceived }.
 */
export function executeInstantSell(coin, pct) {
  return withTradingWallet((wallet) => sellWithWallet(coin, pct, wallet));
}

async function sellWithWallet(coin, pct, wallet) {
  const mint = coin?.mintAddress || coin?.address;
  if (!mint) throw new Error('Invalid coin');
  assertNoPendingTrade(wallet.publicKey, mint, true);

  const { tokens, tokensRaw, decimals: chainDecimals } = await getTradingWalletBalances(mint, wallet);
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
  const limits = await getTradingLimits(mint, wallet);
  if (limits.sol < limits.sellOverheadSol) {
    throw new Error(`Selling needs ~${limits.sellOverheadSol.toFixed(4)} SOL in the trading wallet for fees — you have ${limits.sol.toFixed(4)}. Deposit a little SOL first.`);
  }

  let built;
  try {
    built = await buildSwap({ inputMint: mint, outputMint: SOL_MINT, amountRaw, slippageBps, wallet: wallet.publicKey });
  } catch (err) {
    throw friendlySwapError(err);
  }

  const tokensSold = Number(amountRaw) / 10 ** decimals;
  const solReceived = Number(built.quote?.outAmount || 0) / 1e9;
  const solUsd = await getSolUsdPrice({ requireLivePrice: true }).catch((error) => {
    console.warn('[instant-trade] USD sell value unavailable; preserving SOL-denominated execution:', error.message);
    return 0;
  });
  const pricePerToken = tokensSold > 0 ? solReceived / tokensSold : 0;

  const sent = await submitTrackedTrade(built, {
    walletAddress: wallet.publicKey,
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
    fullSell: share >= 1,
    timestamp: Date.now(),
  });
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
