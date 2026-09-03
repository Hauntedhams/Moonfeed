import { getFullApiUrl } from '../config/api';
import bs58 from 'bs58';
import { SOL_MINT, fetchTokenDecimals } from './triggerOrders';

/**
 * Jupiter Trigger V2 client.
 *
 * V2 supports true stop-losses (sell when price DROPS), buy-above, and OCO
 * take-profit + stop-loss pairs — none of which V1 could express. Triggers are
 * USD prices, which matches the app's USD-first UI directly (no SOL conversion).
 *
 * Flow per order: wallet-signed JWT auth (24h, cached) → vault → deposit craft
 * → wallet signs deposit tx → create. The backend proxies everything and holds
 * the Jupiter API key.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ── base58 (for message signatures) ─────────────────────────────────────────
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes) {
  if (!bytes || !bytes.length) return '';
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}

const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const bytesToB64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

// Wallets return message signatures in wildly different shapes: Uint8Array,
// { signature }, base58 strings (deeplink wallets), base64 strings, plain
// arrays, Buffers. Normalize to a 64-byte Uint8Array or null — anything else
// would reach Jupiter as garbage and come back as a bare "Invalid signature".
function toSignatureBytes(raw) {
  if (raw == null) return null;
  if (raw instanceof Uint8Array) return raw.length === 64 ? raw : null;
  if (typeof raw === 'object' && raw.signature != null) return toSignatureBytes(raw.signature);
  if (typeof raw === 'string') {
    try {
      const b = bs58.decode(raw);
      if (b.length === 64) return new Uint8Array(b);
    } catch (_) { /* not base58 */ }
    try {
      const b = b64ToBytes(raw);
      if (b.length === 64) return b;
    } catch (_) { /* not base64 */ }
    return null;
  }
  if (ArrayBuffer.isView(raw)) return toSignatureBytes(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  if (raw instanceof ArrayBuffer) return toSignatureBytes(new Uint8Array(raw));
  if (Array.isArray(raw)) return toSignatureBytes(new Uint8Array(raw));
  return null;
}

// The message part of a serialized tx (everything after the shortvec-prefixed
// signature array). Lets us detect wallet-side transaction modification by
// comparing crafted vs signed messages byte-for-byte.
function extractMessageB64(txB64) {
  try {
    const bytes = b64ToBytes(txB64);
    let numSigs = 0;
    let shift = 0;
    let i = 0;
    for (;;) {
      const b = bytes[i++];
      numSigs |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return bytesToB64(bytes.slice(i + numSigs * 64));
  } catch (_) {
    return null;
  }
}

// Names exactly what the wallet changed (blockhash refresh, injected/removed
// instructions, or rewritten compute-budget values) and RETURNS a compact
// summary so it can be surfaced in the on-device error message, where there
// is no console to read.
async function logTxDiff(origB64, signedB64) {
  try {
    const { VersionedTransaction } = await import('@solana/web3.js');
    const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
    const parse = (b64) => {
      const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
      const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
      const ixs = tx.message.compiledInstructions.map((ix) => ({
        program: keys[ix.programIdIndex],
        data: ix.data instanceof Uint8Array ? ix.data : new Uint8Array(ix.data || []),
      }));
      // Decode compute-budget values: discriminator 2 = unit limit (u32),
      // 3 = unit price in microlamports (u64).
      const budget = {};
      for (const ix of ixs) {
        if (ix.program !== COMPUTE_BUDGET || !ix.data.length) continue;
        const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
        if (ix.data[0] === 2 && ix.data.length >= 5) budget.unitLimit = view.getUint32(1, true);
        else if (ix.data[0] === 3 && ix.data.length >= 9) budget.unitPrice = Number(view.getBigUint64(1, true));
      }
      return {
        blockhash: tx.message.recentBlockhash,
        accounts: keys.length,
        ixs,
        budget,
      };
    };
    const a = parse(origB64);
    const b = parse(signedB64);
    const parts = [];
    if (a.blockhash !== b.blockhash) parts.push('blockhash replaced');
    if (a.accounts !== b.accounts) parts.push(`accounts ${a.accounts}→${b.accounts}`);
    if (a.ixs.length !== b.ixs.length) {
      parts.push(`instructions ${a.ixs.length}→${b.ixs.length}`);
      const progsA = a.ixs.map((ix) => ix.program);
      const progsB = b.ixs.map((ix) => ix.program);
      const added = progsB.filter((p) => !progsA.includes(p));
      if (added.length) parts.push(`added program ${added.map((p) => p.slice(0, 8)).join(',')}`);
    }
    if (a.budget.unitPrice !== b.budget.unitPrice) {
      parts.push(`priority fee ${a.budget.unitPrice ?? 'none'}→${b.budget.unitPrice ?? 'none'} µlam`);
    }
    if (a.budget.unitLimit !== b.budget.unitLimit) {
      parts.push(`CU limit ${a.budget.unitLimit ?? 'none'}→${b.budget.unitLimit ?? 'none'}`);
    }
    if (!parts.length) {
      // Same shape — find which instruction's data bytes changed.
      for (let i = 0; i < a.ixs.length; i++) {
        const da = a.ixs[i].data, db = b.ixs[i].data;
        const same = da.length === db.length && da.every((v, j) => v === db[j]);
        if (!same) parts.push(`ix[${i}] (${a.ixs[i].program.slice(0, 8)}) data changed`);
      }
    }
    const summary = parts.join(', ') || 'unknown byte-level change';
    console.warn('[TriggerV2] Crafted tx:', a);
    console.warn('[TriggerV2] Wallet-returned tx:', b);
    console.warn('[TriggerV2] Changed:', summary);
    return summary;
  } catch (e) {
    console.warn('[TriggerV2] Could not diff transactions:', e.message);
    return null;
  }
}

/**
 * Signs a base64 transaction with whichever signTransaction convention the
 * caller has: the WalletContext wrapper (base64 string in/out) or the raw
 * adapter (VersionedTransaction object in/out). Returns base64.
 */
async function signAnyTransaction(signTransaction, base64Tx) {
  // Try the wrapper convention first (base64 string in)
  try {
    const result = await signTransaction(base64Tx);
    if (typeof result === 'string') return result;
    if (result && typeof result.serialize === 'function') return bytesToB64(result.serialize());
  } catch (err) {
    if (/reject|denied|cancell/i.test(err?.message || '')) throw err; // user said no — don't re-prompt
  }
  // Raw adapter convention (transaction object in)
  const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
  const bytes = b64ToBytes(base64Tx);
  let tx;
  try {
    tx = VersionedTransaction.deserialize(bytes);
  } catch (_) {
    tx = Transaction.from(bytes);
  }
  const signed = await signTransaction(tx);
  if (typeof signed === 'string') return signed;
  return bytesToB64(signed.serialize());
}

// Phantom injects Lighthouse guard instructions into single signTransaction
// deeplinks on domains it hasn't reviewed (docs.phantom.com/developer-powertools/
// lighthouse), which Jupiter rejects ("Transaction accounts modified"). Batch
// signing is not augmented, so on native deeplink sessions try
// signAllTransactions first, falling back to the normal single-sign path.
async function signDepositBase64(signTransaction, base64Tx) {
  try {
    const { mobileWallet, base64ToBytes, bytesToBase64 } = await import('../services/mobileWalletDeeplink');
    if (mobileWallet.isConnected()) {
      const [signed] = await mobileWallet.signAllSerialized([base64ToBytes(base64Tx)]);
      if (signed?.length) return bytesToBase64(signed);
    }
  } catch (err) {
    if (/reject|denied|cancell/i.test(err?.message || '')) throw err;
    console.warn('[TriggerV2] Batch deposit sign failed, falling back to signTransaction:', err?.message);
  }
  return signAnyTransaction(signTransaction, base64Tx);
}

// ── JWT cache (in-memory + sessionStorage, 24h with safety margin) ─────────
const tokenCache = new Map(); // wallet -> { token, expiresAt }
const SESSION_KEY = (wallet) => `mf_trigger_jwt_${wallet}`;
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

export function getCachedTriggerToken(walletAddress) {
  if (!walletAddress) return null;
  const mem = tokenCache.get(walletAddress);
  if (mem && mem.expiresAt > Date.now()) return mem.token;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(walletAddress));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt > Date.now()) {
        tokenCache.set(walletAddress, parsed);
        return parsed.token;
      }
      sessionStorage.removeItem(SESSION_KEY(walletAddress));
    }
  } catch (_) { /* ignore */ }
  return null;
}

export function clearTriggerToken(walletAddress) {
  if (!walletAddress) return;
  tokenCache.delete(walletAddress);
  try { sessionStorage.removeItem(SESSION_KEY(walletAddress)); } catch (_) { /* ignore */ }
}

function storeTriggerToken(walletAddress, token) {
  const entry = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  tokenCache.set(walletAddress, entry);
  try { sessionStorage.setItem(SESSION_KEY(walletAddress), JSON.stringify(entry)); } catch (_) { /* ignore */ }
}

async function apiPost(path, body, jwt = null) {
  const res = await fetch(getFullApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function apiGet(path, jwt) {
  const res = await fetch(getFullApiUrl(path), {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Get (or create via wallet signature) a 24h Trigger V2 JWT for this wallet.
 * Prefers message signing; falls back to transaction-challenge signing for
 * wallets without signMessage (e.g. hardware wallets).
 */
export async function ensureTriggerAuth({ walletAddress, signMessage, signTransaction }) {
  if (!walletAddress) throw new Error('Please connect your wallet first');
  const cached = getCachedTriggerToken(walletAddress);
  if (cached) return cached;

  let token = null;
  if (signMessage) {
    const challenge = await apiPost('/api/trigger/v2/auth/challenge', { walletPubkey: walletAddress, type: 'message' });
    const message = new TextEncoder().encode(challenge.challenge);
    const rawSig = await signMessage(message);
    const sigBytes = toSignatureBytes(rawSig);
    if (!sigBytes) {
      console.warn('[TriggerV2] Unusable signMessage result:', typeof rawSig, rawSig);
      throw new Error('Your wallet returned an unusable signature — try reconnecting your wallet');
    }
    let verified;
    try {
      verified = await apiPost('/api/trigger/v2/auth/verify', {
        type: 'message',
        walletPubkey: walletAddress,
        signature: base58Encode(sigBytes),
      });
    } catch (err) {
      throw new Error(`Wallet sign-in failed (${err.message}) — try again`);
    }
    token = verified.token;
  } else if (signTransaction) {
    const challenge = await apiPost('/api/trigger/v2/auth/challenge', { walletPubkey: walletAddress, type: 'transaction' });
    const signedTransaction = await signAnyTransaction(signTransaction, challenge.transaction);
    // Note any wallet-side modification, but let Jupiter's verify decide —
    // its bare "Invalid signature" is only enriched with the diff on failure.
    const origMsg = extractMessageB64(challenge.transaction);
    const signedMsg = extractMessageB64(signedTransaction);
    let diffSummary = null;
    if (origMsg && signedMsg && origMsg !== signedMsg) {
      diffSummary = await logTxDiff(challenge.transaction, signedTransaction);
    }
    let verified;
    try {
      verified = await apiPost('/api/trigger/v2/auth/verify', {
        type: 'transaction',
        walletPubkey: walletAddress,
        signedTransaction,
      });
    } catch (err) {
      throw new Error(
        `Wallet sign-in failed (${err.message})` +
        (diffSummary ? ` — your wallet changed the sign-in transaction before signing (${diffSummary})` : ' — try again')
      );
    }
    token = verified.token;
  } else {
    throw new Error('Wallet cannot sign — reconnect your wallet');
  }

  if (!token) throw new Error('Wallet sign-in failed — try again');
  storeTriggerToken(walletAddress, token);
  return token;
}

async function fetchCurrentPriceUsd(mint) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pair = (data.pairs || []).sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
    const price = Number(pair?.priceUsd);
    return price > 0 ? price : null;
  } catch (_) {
    return null;
  }
}

/**
 * Place a Trigger V2 price order.
 * - `triggerPriceUsd` below the current price on a SELL = a real stop-loss.
 * - Pass `stopLossPriceUsd` alongside an upside sell target to create an OCO
 *   (take-profit + stop-loss sharing one deposit; one fills, other cancels).
 * Amounts are UI units (SOL for buys, tokens for sells).
 * Returns { orderId, signature }.
 */
export async function placeTriggerOrderV2({
  walletAddress,
  signMessage,
  signTransaction,
  mintAddress,
  side, // 'buy' | 'sell'
  inputAmount,
  triggerPriceUsd,
  currentPriceUsd = null,
  stopLossPriceUsd = null,
  expiredAt = null, // ms timestamp; V2 requires expiry, defaults to 30d
  tokenDecimals = null,
  slippageBps = null,
}) {
  if (!walletAddress) throw new Error('Please connect your wallet first');
  if (!signTransaction) throw new Error('Wallet cannot sign transactions');
  if (!mintAddress) throw new Error('Missing token address');

  const amount = parseFloat(inputAmount);
  const target = parseFloat(triggerPriceUsd);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter a valid amount');
  if (!Number.isFinite(target) || target <= 0) throw new Error('Please enter a valid trigger price');

  const decimals = tokenDecimals ?? await fetchTokenDecimals(mintAddress);
  const isBuy = side === 'buy';
  const inputMint = isBuy ? SOL_MINT : mintAddress;
  const outputMint = isBuy ? mintAddress : SOL_MINT;
  // Floor — rounding up can exceed the wallet's real balance.
  const rawAmount = String(Math.floor(isBuy ? amount * 1e9 : amount * Math.pow(10, decimals)));

  let current = Number(currentPriceUsd);
  if (!(current > 0)) current = await fetchCurrentPriceUsd(mintAddress);
  if (!(current > 0)) throw new Error('Could not fetch the current price — try again in a moment');

  const triggerCondition = target >= current ? 'above' : 'below';

  const useOco = !isBuy && Number(stopLossPriceUsd) > 0 && target > Number(stopLossPriceUsd);

  const jwt = await ensureTriggerAuth({ walletAddress, signMessage, signTransaction });

  await apiGet('/api/trigger/v2/vault', jwt); // registers on first use

  // Mobile wallets (Phantom/Solflare) often rewrite the deposit's compute-budget
  // fee values before signing, with no user-facing setting to disable it. The
  // docs never promise byte-exact validation — the observed rejection was
  // "Transaction accounts modified" — so a value-only rewrite may well pass.
  // ALWAYS submit and let Jupiter be the authority; keep a local diff of what
  // the wallet changed purely to make a rejection diagnosable. Each retry needs
  // a FRESH deposit (requestId is single-use).
  const MAX_ATTEMPTS = 2;
  let created = null;
  let lastDiffSummary = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Rapid app↔wallet deeplink ping-pong can crash wallet apps (Phantom shows
    // "Unknown Error") — give it a moment between attempts.
    if (attempt > 1) await new Promise((r) => setTimeout(r, 1200));
    lastDiffSummary = null;
    const deposit = await apiPost('/api/trigger/v2/deposit', {
      inputMint,
      outputMint,
      userAddress: walletAddress,
      amount: rawAmount,
      orderType: 'price',
      orderSubType: useOco ? 'oco' : 'single',
    }, jwt);
    if (!deposit.requestId || !deposit.transaction) throw new Error('Could not prepare the order deposit');

    let depositSignedTx;
    try {
      depositSignedTx = await signDepositBase64(signTransaction, deposit.transaction);
    } catch (err) {
      if (/reject|denied|cancell/i.test(err?.message || '')) throw err;
      throw new Error(`Wallet could not sign the order deposit: ${err.message}`);
    }

    const origMsg = extractMessageB64(deposit.transaction);
    const signedMsg = extractMessageB64(depositSignedTx);
    if (origMsg && signedMsg && origMsg !== signedMsg) {
      console.warn(`[TriggerV2] Wallet returned a modified transaction (attempt ${attempt}/${MAX_ATTEMPTS}) — submitting anyway`);
      lastDiffSummary = await logTxDiff(deposit.transaction, depositSignedTx);
    }

    const body = {
      depositRequestId: deposit.requestId,
      depositSignedTx,
      userPubkey: walletAddress,
      inputMint,
      outputMint,
      inputAmount: rawAmount,
      triggerMint: mintAddress,
      expiresAt: expiredAt || Date.now() + THIRTY_DAYS_MS,
      ...(slippageBps != null ? { slippageBps } : {}),
    };
    if (useOco) {
      body.orderType = 'oco';
      body.tpPriceUsd = target;
      body.slPriceUsd = Number(stopLossPriceUsd);
    } else {
      body.orderType = 'single';
      body.triggerCondition = triggerCondition;
      body.triggerPriceUsd = target;
    }

    try {
      created = await apiPost('/api/trigger/v2/order', body, jwt);
      break;
    } catch (err) {
      const depositRejected = /accounts modified|invalid.*deposit|deposit.*invalid|signature/i.test(err.message || '');
      if (depositRejected) {
        console.warn('[TriggerV2] Jupiter rejected the deposit:', err.message, '| wallet changes:', lastDiffSummary || 'none detected');
        // A wallet that injected guard instructions will do so again on a fresh
        // deposit — retrying just burns extra wallet round-trips. Only retry
        // when no modification was detected (transient failure).
        if (!lastDiffSummary && attempt < MAX_ATTEMPTS) {
          console.warn(`[TriggerV2] Retrying with a fresh deposit (attempt ${attempt}/${MAX_ATTEMPTS})`);
          continue;
        }
        if (lastDiffSummary && /added program L2TEx/i.test(lastDiffSummary)) {
          // Both Phantom and Solflare inject Lighthouse guards on unreviewed domains.
          throw new Error(
            "Your wallet added its transaction-protection (Lighthouse) instructions before signing, which Jupiter's order system rejects. " +
            'This happens on apps the wallet has not reviewed yet — Moonfeed is pending review. Please try again in a few days.'
          );
        }
        throw new Error(
          `Jupiter rejected the order deposit: ${err.message}.` +
          (lastDiffSummary ? ` Your wallet changed the transaction before signing (${lastDiffSummary}).` : ' Try again in a moment.')
        );
      }
      throw err;
    }
  }
  if (!created?.id) throw new Error(created?.error || 'Failed to create order');

  try {
    const { storeOrderSignature } = await import('./orderStorage.js');
    storeOrderSignature({
      orderId: created.id,
      signature: created.txSignature,
      maker: walletAddress,
      orderType: 'create',
    });
  } catch (_) { /* non-fatal */ }

  return { orderId: created.id, signature: created.txSignature, decimals, triggerCondition };
}

/**
 * List V2 orders. state: 'active' | 'past'.
 * With interactive=false, returns null instead of prompting a wallet signature
 * when no cached JWT exists (safe for background polling).
 */
export async function fetchTriggerOrdersV2({
  walletAddress,
  signMessage,
  signTransaction,
  state = 'active',
  interactive = true,
}) {
  if (!walletAddress) return null;
  let jwt = getCachedTriggerToken(walletAddress);
  if (!jwt) {
    if (!interactive) return null;
    jwt = await ensureTriggerAuth({ walletAddress, signMessage, signTransaction });
  }
  try {
    const result = await apiGet(`/api/trigger/v2/orders?state=${state}&limit=50`, jwt);
    return result.orders || [];
  } catch (err) {
    if (err.status === 401) {
      clearTriggerToken(walletAddress);
      if (interactive) {
        const fresh = await ensureTriggerAuth({ walletAddress, signMessage, signTransaction });
        const retry = await apiGet(`/api/trigger/v2/orders?state=${state}&limit=50`, fresh);
        return retry.orders || [];
      }
      return null;
    }
    throw err;
  }
}

/**
 * Cancel a V2 order: initiate → wallet signs the withdrawal → confirm.
 * Returns { orderId, signature }.
 */
export async function cancelTriggerOrderV2({ walletAddress, signMessage, signTransaction, orderId }) {
  if (!walletAddress) throw new Error('Please connect your wallet first');
  if (!orderId) throw new Error('Missing order id');
  const jwt = await ensureTriggerAuth({ walletAddress, signMessage, signTransaction });

  const init = await apiPost(`/api/trigger/v2/cancel/${orderId}`, {}, jwt);
  if (!init.transaction || !init.requestId) throw new Error('Could not prepare the cancellation');

  const signedTransaction = await signAnyTransaction(signTransaction, init.transaction);

  const confirmed = await apiPost(`/api/trigger/v2/confirm-cancel/${orderId}`, {
    signedTransaction,
    cancelRequestId: init.requestId,
  }, jwt);

  try {
    const { storeOrderSignature } = await import('./orderStorage.js');
    storeOrderSignature({
      orderId,
      signature: confirmed.txSignature,
      maker: walletAddress,
      orderType: 'cancel',
    });
  } catch (_) { /* non-fatal */ }

  return { orderId, signature: confirmed.txSignature };
}
