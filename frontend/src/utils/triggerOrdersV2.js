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

// Names exactly what the wallet changed (blockhash refresh vs injected
// instructions) so failures are diagnosable from the console.
async function logTxDiff(origB64, signedB64) {
  try {
    const { VersionedTransaction } = await import('@solana/web3.js');
    const info = (b64) => {
      const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
      const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
      return {
        blockhash: tx.message.recentBlockhash,
        accounts: keys.length,
        instructions: tx.message.compiledInstructions.length,
        programs: tx.message.compiledInstructions.map((ix) => keys[ix.programIdIndex]),
      };
    };
    const a = info(origB64);
    const b = info(signedB64);
    console.warn('[TriggerV2] Crafted tx:', a);
    console.warn('[TriggerV2] Wallet-returned tx:', b);
    console.warn('[TriggerV2] Changed:', {
      blockhash: a.blockhash !== b.blockhash,
      accounts: a.accounts !== b.accounts,
      instructions: a.instructions !== b.instructions,
    });
  } catch (e) {
    console.warn('[TriggerV2] Could not diff transactions:', e.message);
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
    // Jupiter verifies the signed challenge byte-for-byte — a wallet that
    // injects priority-fee instructions breaks it with a bare "Invalid
    // signature". Catch it locally so the user gets an actionable message.
    const origMsg = extractMessageB64(challenge.transaction);
    const signedMsg = extractMessageB64(signedTransaction);
    if (origMsg && signedMsg && origMsg !== signedMsg) {
      await logTxDiff(challenge.transaction, signedTransaction);
      throw new Error(
        'Your wallet altered the sign-in transaction before signing. ' +
        'Solflare mobile may not expose a setting to disable this. Try Phantom, or use the Solflare browser extension and approve the site as trusted.'
      );
    }
    let verified;
    try {
      verified = await apiPost('/api/trigger/v2/auth/verify', {
        type: 'transaction',
        walletPubkey: walletAddress,
        signedTransaction,
      });
    } catch (err) {
      throw new Error(`Wallet sign-in failed (${err.message}) — try again`);
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

  // Jupiter validates the signed deposit byte-for-byte against what it crafted.
  // Some wallets (Solflare especially, on sites they don't recognize) inject
  // priority-fee/protection instructions before signing, which gets rejected as
  // "Transaction accounts modified". Each retry needs a FRESH deposit (requestId
  // is single-use) — often the wallet stops modifying once the site is trusted.
  const MAX_ATTEMPTS = 2;
  let created = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Rapid app↔wallet deeplink ping-pong can crash wallet apps (Phantom shows
    // "Unknown Error") — give it a moment between attempts.
    if (attempt > 1) await new Promise((r) => setTimeout(r, 1200));
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
      depositSignedTx = await signAnyTransaction(signTransaction, deposit.transaction);
    } catch (err) {
      if (/reject|denied|cancell/i.test(err?.message || '')) throw err;
      throw new Error(`Wallet could not sign the order deposit: ${err.message}`);
    }

    // Catch wallet modification locally — no point submitting a tx Jupiter will
    // reject, and this tells us definitively whether the wallet is the culprit.
    const origMsg = extractMessageB64(deposit.transaction);
    const signedMsg = extractMessageB64(depositSignedTx);
    const locallyModified = origMsg && signedMsg && origMsg !== signedMsg;
    if (locallyModified) {
      console.warn(`[TriggerV2] Wallet returned a MODIFIED transaction (attempt ${attempt}/${MAX_ATTEMPTS})`, {
        originalBytes: origMsg.length,
        signedBytes: signedMsg.length,
      });
      await logTxDiff(deposit.transaction, depositSignedTx);
      if (attempt < MAX_ATTEMPTS) continue;
      throw new Error(
        'Your wallet altered the transaction before signing, so Jupiter would reject it. ' +
        'Solflare mobile may not expose a setting to disable this. Try Phantom, or use the Solflare browser extension and tick "I trust this site" on the approval popup.'
      );
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
      const walletModified = /accounts modified|invalid.*deposit/i.test(err.message || '');
      if (walletModified) {
        // Our local byte-compare said the message was untouched, so this isn't
        // the wallet — surface Jupiter's raw error for diagnosis.
        console.warn('[TriggerV2] Jupiter rejected an UNMODIFIED deposit:', err.message);
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`[TriggerV2] Retrying with a fresh deposit (attempt ${attempt}/${MAX_ATTEMPTS})`);
          continue;
        }
        throw new Error(`Jupiter rejected the order deposit: ${err.message}. Try again in a moment.`);
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
