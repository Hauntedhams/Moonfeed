// The ONE place that turns notifications on in response to an explicit user
// action (tracking a coin, following a wallet, tapping an "enable alerts"
// button). Never call this from app-launch or mount effects: the OS permission
// prompt should only appear at a moment when the user clearly wants alerts.
// iOS gives exactly one shot at the system prompt — a launch-time prompt is
// both bad UX and trivial to dismiss, and a denial silently kills ALL
// notifications (local alerts can't fire and the FCM token never registers,
// which also kills remote/closed-app pushes).
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { initTradeNotifications, getNotificationPermissionState } from './tradeNotifications';
import { initRemotePush } from './pushNotifications';

let promptedThisSession = false;

// Returns 'granted' | 'denied'. Shows the OS prompt at most once per session.
// walletAddress should be the CONNECTED account (used to associate the FCM
// token for closed-app pushes); pass null/omit when unknown — the App-level
// effect will associate the token on the next launch/connect instead.
export async function maybeEnableNotifications(walletAddress = null) {
  try {
    const state = await getNotificationPermissionState();

    if (state === 'granted') {
      // Already allowed — silently make sure both notification paths are live.
      await initTradeNotifications();
      if (walletAddress) await initRemotePush(walletAddress);
      return 'granted';
    }

    // iOS can't re-ask after a denial, and we show the prompt at most once per
    // session so repeated tracking actions never nag.
    if (state === 'denied' || promptedThisSession) return 'denied';
    promptedThisSession = true;

    // A single iOS notification authorization covers BOTH local and remote
    // notifications, so these back-to-back calls produce one system dialog.
    const granted = await initTradeNotifications({ request: true });
    if (granted && walletAddress) {
      await initRemotePush(walletAddress, { requestPermission: true });
    }
    return granted ? 'granted' : 'denied';
  } catch (_) {
    return 'denied';
  }
}

// After a denial the OS prompt can never be shown again — deep-link the user
// to the app's page in Settings so they can flip the switch manually.
export async function openNotificationSettings() {
  try {
    if (Capacitor.isNativePlatform()) {
      await AppLauncher.openUrl({ url: 'app-settings:' });
      return true;
    }
  } catch (_) { /* best-effort */ }
  return false;
}
