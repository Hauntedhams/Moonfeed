// Remote (closed-app) push via FCM. Registers the device with APNs/FCM through
// @capacitor-firebase/messaging (returns real FCM tokens on iOS + Android), then
// hands the token to our backend so the server can push tracked-coin gain/crash
// alerts even when the app is closed.
//
// Safe no-op on web / when the plugin isn't installed.
import { Capacitor } from '@capacitor/core';
import { getFullApiUrl } from '../config/api';

let FirebaseMessaging = null;
let registered = false;
let lastToken = null;
let lastWallet = null;

async function loadPlugin() {
  if (FirebaseMessaging) return FirebaseMessaging;
  try {
    ({ FirebaseMessaging } = await import('@capacitor-firebase/messaging'));
  } catch (_) {
    FirebaseMessaging = null;
  }
  return FirebaseMessaging;
}

async function sendTokenToBackend(token, walletAddress) {
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
export async function initRemotePush(walletAddress = null) {
  lastWallet = walletAddress;

  if (!Capacitor.isNativePlatform()) return;
  const plugin = await loadPlugin();
  if (!plugin) return;

  // If we already have a token, just re-associate it with the new wallet.
  if (registered && lastToken) {
    await sendTokenToBackend(lastToken, walletAddress);
    return;
  }
  if (registered) return;
  registered = true;

  try {
    let perm = await plugin.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await plugin.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      registered = false;
      return;
    }

    // Fires when FCM issues or rotates the token.
    await plugin.addListener('tokenReceived', (event) => {
      lastToken = event?.token || null;
      if (lastToken) sendTokenToBackend(lastToken, lastWallet);
    });

    const { token } = await plugin.getToken();
    if (token) {
      lastToken = token;
      await sendTokenToBackend(token, lastWallet);
    }
  } catch (err) {
    console.debug('[push] init error:', err?.message);
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
