// Opt-in "cloud execution" for the in-app trading wallet. Enrolling uploads
// the trading-wallet secret key (over TLS) so the backend can execute
// take-profit / stop-loss / buy-at targets while the app is closed. Until the
// user explicitly enrols, the key never leaves the device. Disenrolling and
// settings changes are authorised by signing a short message with the key.
import bs58 from 'bs58';
import { getFullApiUrl } from '../config/api';
import { loadTradingWallet, signMessageWithTradingWallet } from './instantTradeWallet';
import { track } from './analytics';

const STATUS_TTL_MS = 60 * 1000;
let statusCache = { wallet: null, ts: 0, value: null };

async function api(path, options) {
  const res = await fetch(getFullApiUrl(path), options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function emit(status) {
  window.dispatchEvent(new CustomEvent('moonfeed:cloud-exec-changed', { detail: status }));
}

// Must match routes/cloudExec.js authMessage().
async function signedBody(action, wallet, extra = {}) {
  const timestamp = Date.now();
  const sig = await signMessageWithTradingWallet(new TextEncoder().encode(`moonfeed:cloud-exec:${action}:${wallet}:${timestamp}`));
  if (!sig) throw new Error('No trading wallet set up');
  return { wallet, timestamp, signature: bs58.encode(sig), ...extra };
}

/** { configured, enrolled, enrolledAt, lastExecutionAt, executionCount, slippageBps, failureStreak } */
export async function getCloudExecStatus({ force = false } = {}) {
  const wallet = await loadTradingWallet();
  if (!wallet) return { configured: false, enrolled: false };
  if (!force && statusCache.wallet === wallet.publicKey && Date.now() - statusCache.ts < STATUS_TTL_MS && statusCache.value) {
    return statusCache.value;
  }
  const value = await api(`/api/cloud-exec/status/${wallet.publicKey}`);
  statusCache = { wallet: wallet.publicKey, ts: Date.now(), value };
  return value;
}

/** Cheap check for hot paths (auto-executor). Never throws; false on error. */
export async function isCloudExecEnrolled() {
  try {
    const s = await getCloudExecStatus();
    return Boolean(s.enrolled);
  } catch {
    return false;
  }
}

export async function enrollCloudExecution({ slippagePct }) {
  const wallet = await loadTradingWallet();
  if (!wallet) throw new Error('No trading wallet set up');
  const status = await api('/api/cloud-exec/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: wallet.publicKey,
      secretKey: wallet.secretKey,
      slippageBps: Math.round(Math.max(0.5, Number(slippagePct) || 5) * 100),
    }),
  });
  statusCache = { wallet: wallet.publicKey, ts: Date.now(), value: status };
  track('cloud_exec_enrolled', {});
  emit(status);
  return status;
}

export async function disenrollCloudExecution() {
  const wallet = await loadTradingWallet();
  if (!wallet) throw new Error('No trading wallet set up');
  const status = await api('/api/cloud-exec/disenroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedBody('disenroll', wallet.publicKey)),
  });
  statusCache = { wallet: wallet.publicKey, ts: Date.now(), value: status };
  track('cloud_exec_disenrolled', {});
  emit(status);
  return status;
}

/** Mirror the device slippage preset to the server (no-op when not enrolled). */
export async function syncCloudExecSettings({ slippagePct }) {
  const wallet = await loadTradingWallet();
  if (!wallet) return null;
  if (!(await isCloudExecEnrolled())) return null;
  const status = await api('/api/cloud-exec/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedBody('settings', wallet.publicKey, {
      slippageBps: Math.round(Math.max(0.5, Number(slippagePct) || 5) * 100),
    })),
  });
  statusCache = { wallet: wallet.publicKey, ts: Date.now(), value: status };
  return status;
}

/** Recent server/device executions for this trading wallet. */
export async function fetchCloudExecutions() {
  const wallet = await loadTradingWallet();
  if (!wallet) return [];
  const data = await api(`/api/cloud-exec/executions/${wallet.publicKey}`);
  return Array.isArray(data.executions) ? data.executions : [];
}
