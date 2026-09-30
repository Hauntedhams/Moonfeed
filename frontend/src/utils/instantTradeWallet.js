// In-app "instant trade" hot wallet: a device-local keypair that can sign
// swaps without a wallet-app round trip (the thing that makes one-tap buys
// possible — Phantom/Solflare deeplinks can't). Key lives in localStorage with
// a native-file backup, because WKWebView can evict web storage under memory
// pressure while Directory.Data survives.
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const KEY_STORAGE = 'moonfeed_instant_wallet_v1';
const PRESETS_STORAGE = 'moonfeed_instant_presets_v1';
const BACKUP_FILE = 'moonfeed-instant-wallet.json';

export const DEFAULT_PRESETS = {
  enabled: false,     // when true, the coin-card ⚡ button buys with one tap
  buySol: 0.05,       // SOL spent per instant buy
  slippagePct: 3,     // max slippage per swap
  autoSellPct: 0,     // 0 = off; otherwise sets a take-profit target at +X% per buy
  stopLossPct: 0,     // 0 = off; otherwise sets a stop-loss target at -X% per buy
  autoExecute: true,  // app-open: triggered targets auto-sell/buy; off = alert only
};

let cachedWallet = null; // { publicKey, secretKey (base58), createdAt }

async function nativeBackupWrite(json) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({ path: BACKUP_FILE, data: json, directory: Directory.Data, encoding: Encoding.UTF8 });
  } catch (err) {
    console.warn('[instant-wallet] native backup write failed:', err?.message);
  }
}

async function nativeBackupRead() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { data } = await Filesystem.readFile({ path: BACKUP_FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

function parseRecord(json) {
  try {
    const record = JSON.parse(json);
    if (record?.publicKey && record?.secretKey) return record;
  } catch { /* corrupt */ }
  return null;
}

/** Returns { publicKey, secretKey, createdAt } or null. Restores from native backup if web storage was evicted. */
export async function loadTradingWallet() {
  if (cachedWallet) return cachedWallet;
  let record = parseRecord(localStorage.getItem(KEY_STORAGE));
  if (!record) {
    const backup = await nativeBackupRead();
    record = backup ? parseRecord(backup) : null;
    if (record) {
      try { localStorage.setItem(KEY_STORAGE, backup); } catch { /* storage full */ }
    }
  }
  cachedWallet = record;
  return record;
}

export async function createTradingWallet() {
  const existing = await loadTradingWallet();
  if (existing) return existing;
  const kp = Keypair.generate();
  const record = {
    publicKey: kp.publicKey.toBase58(),
    secretKey: bs58.encode(kp.secretKey),
    createdAt: Date.now(),
  };
  const json = JSON.stringify(record);
  localStorage.setItem(KEY_STORAGE, json);
  await nativeBackupWrite(json);
  cachedWallet = record;
  window.dispatchEvent(new CustomEvent('moonfeed:instant-wallet-changed'));
  return record;
}

/** Import a base58-encoded 64-byte secret key (Phantom/Solflare export format). Throws on invalid input. */
export async function importTradingWallet(secretKeyB58) {
  const kp = Keypair.fromSecretKey(bs58.decode(String(secretKeyB58).trim()));
  const record = {
    publicKey: kp.publicKey.toBase58(),
    secretKey: bs58.encode(kp.secretKey),
    createdAt: Date.now(),
  };
  const json = JSON.stringify(record);
  localStorage.setItem(KEY_STORAGE, json);
  await nativeBackupWrite(json);
  cachedWallet = record;
  window.dispatchEvent(new CustomEvent('moonfeed:instant-wallet-changed'));
  return record;
}

/** Web3 Keypair for signing, or null if no wallet exists. */
export async function getTradingKeypair() {
  const record = await loadTradingWallet();
  return record ? Keypair.fromSecretKey(bs58.decode(record.secretKey)) : null;
}

// ── Presets ──────────────────────────────────────────────────────────────────

export function getPresets() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRESETS_STORAGE));
    if (stored && typeof stored === 'object') return { ...DEFAULT_PRESETS, ...stored };
  } catch { /* corrupt */ }
  return { ...DEFAULT_PRESETS };
}

export function savePresets(partial) {
  const next = { ...getPresets(), ...partial };
  localStorage.setItem(PRESETS_STORAGE, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('moonfeed:instant-presets-changed', { detail: next }));
  return next;
}
