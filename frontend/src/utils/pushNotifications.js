// Remote (closed-app) push via FCM. Registers the device with APNs/FCM through
// @capacitor-firebase/messaging (returns real FCM tokens on iOS + Android), then
// hands the token to our backend so the server can push tracked-coin gain/crash
// alerts even when the app is closed.
//
// Safe no-op on web / when the plugin isn't installed.
import { Capacitor } from '@capacitor/core';
import { getFullApiUrl } from '../config/api';
import { markXNewsPushUnread } from './xNewsAlerts';

let FirebaseMessaging = null;
let registered = false;
let lastToken = null;
let lastWallet = null;

// Persisted so the Options screen can read/update prefs even after a fresh
// reload, before initRemotePush has re-registered a token this session.
const PUSH_TOKEN_STORAGE_KEY = 'moonfeed_push_token';
function persistToken(token) {
  try { if (token) localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token); } catch (_) { /* best-effort */ }
}
export function getStoredPushToken() {
  if (lastToken) return lastToken;
  try { return localStorage.getItem(PUSH_TOKEN_STORAGE_KEY); } catch (_) { return null; }
}

// Read this device's saved notification-category prefs from the backend.
export async function fetchNotificationPrefs() {
  const token = getStoredPushToken();
  if (!token) return null;
  try {
    const res = await fetch(getFullApiUrl(`/api/push/prefs?token=${encodeURIComponent(token)}`));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.prefs || null;
  } catch (_) {
    return null;
  }
}

// Update one or more notification-category prefs for this device.
export async function updateNotificationPrefs(prefsPartial) {
  const token = getStoredPushToken();
  if (!token) return false;
  try {
    await fetch(getFullApiUrl('/api/push/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        walletAddress: lastWallet || null,
        platform: Capacitor.getPlatform(),
        prefs: prefsPartial,
      }),
    });
    return true;
  } catch (_) {
    return false;
  }
}

// NOTE: never return/resolve the plugin proxy from an async function —
// Capacitor's plugin proxy traps EVERY property access, so resolving a promise
// with it invokes plugin.then() and rejects with
// '"FirebaseMessaging.then()" is not implemented on ios' (crashed boot on
// TestFlight build 67). Store it in the module var and return a boolean.
async function loadPlugin() {
  if (FirebaseMessaging) return true;
  try {
    const mod = await import('@capacitor-firebase/messaging');
    FirebaseMessaging = mod.FirebaseMessaging || null;
  } catch (_) {
    FirebaseMessaging = null;
  }
  return !!FirebaseMessaging;
}

async function sendTokenToBackend(token, walletAddress) {
  persistToken(token);
  try {
    await fetch(getFullApiUrl('/api/push/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        walletAddress: walletAddress || null,
        platform: Capacitor.getPlatform(),
      }),
    });
  } catch (err) {
    console.debug('[push] register failed:', err?.message);
  }
}

// Call once after the app mounts (and again whenever the wallet changes so the
// token gets re-associated with the connected account).
//
// PASSIVE BY DEFAULT: if the OS notification permission isn't already granted,
// this returns without prompting — the system prompt must only ever appear
// after an explicit user action (tracking a coin, following a wallet, tapping
// an enable button). Pass { requestPermission: true } from those actions only.
// (iOS gives one shot at the prompt; a launch-time prompt that's dismissed
// silences the app permanently AND blocks FCM token registration.)
export async function initRemotePush(walletAddress = null, { requestPermission = false } = {}) {
  lastWallet = walletAddress;

  if (!Capacitor.isNativePlatform()) return;
  await loadPlugin();
  const plugin = FirebaseMessaging;
  if (!plugin) return;

  // If we already have a token, just re-associate it with the new wallet.
  if (registered && lastToken) {
    await sendTokenToBackend(lastToken, walletAddress);
    return;
  }
  if (registered) return;

  try {
    let perm = await plugin.checkPermissions();
    if (perm.receive !== 'granted') {
      if (!requestPermission) return; // passive mode: never prompt unprompted
      perm = await plugin.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    // Latch only AFTER permission is confirmed so a later explicit request can
    // still complete registration.
    registered = true;

    // Fires when FCM issues or rotates the token.
    await plugin.addListener('tokenReceived', (event) => {
      lastToken = event?.token || null;
      if (lastToken) sendTokenToBackend(lastToken, lastWallet);
    });

    // Fires when the user taps a notification (app backgrounded or closed).
    // App.jsx routes the payload (e.g. soft-order triggered → prefilled swap).
    await plugin.addListener('notificationActionPerformed', (event) => {
      const data = event?.notification?.data || {};
      try {
        if (data.type === 'xNews') markXNewsPushUnread(data.alertKey, { open: true });
        window.dispatchEvent(new CustomEvent('moonfeed:push-action', { detail: data }));
      } catch (_) { /* non-fatal */ }
    });

    await plugin.addListener('notificationReceived', (event) => {
      const data = event?.notification?.data || {};
      try {
        if (data.type === 'xNews') markXNewsPushUnread(data.alertKey);
      } catch (_) { /* non-fatal */ }
    });

    const { token } = await plugin.getToken();
    if (token) {
      lastToken = token;
      await sendTokenToBackend(token, lastWallet);
    }
  } catch (err) {
    console.warn('[push] init error:', err?.message);
    registered = false;
  }
}

// Called on logout / when the user turns notifications off.
export async function unregisterRemotePush() {
  if (!lastToken) return;
  try {
    await fetch(getFullApiUrl('/api/push/unregister'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: lastToken }),
    });
  } catch (_) { /* best-effort */ }
}
