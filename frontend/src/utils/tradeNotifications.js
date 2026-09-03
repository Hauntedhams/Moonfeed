// Native local notifications for tracked-wallet trades.
// Fires OS notifications ("X wallet made a trade") on iOS/Android via Capacitor
// while the app is running. On web it falls back to the browser Notification API.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = Capacitor.isNativePlatform();
let permissionGranted = false;
let initialized = false;
let serviceWorkerRegistrationPromise = null;

// Notification ids must be 32-bit ints; derive one from the tx signature.
function idFromSignature(signature) {
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    hash = (hash * 31 + signature.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

// Request notification permission once. Safe to call multiple times.
export async function initTradeNotifications() {
  if (initialized) return permissionGranted;
  initialized = true;

  try {
    if (isNative) {
      const check = await LocalNotifications.checkPermissions();
      let status = check.display;
      if (status !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        status = req.display;
      }
      permissionGranted = status === 'granted';
    } else if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        permissionGranted = true;
      } else if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        permissionGranted = res === 'granted';
      }
    }
  } catch (err) {
    console.debug('[TradeNotifications] permission error:', err?.message);
  }
  return permissionGranted;
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .getRegistration()
      .catch(() => null);
  }
  return serviceWorkerRegistrationPromise;
}

function buildMessage(swap) {
  const label =
    swap.walletLabel ||
    `${swap.walletAddress.slice(0, 4)}...${swap.walletAddress.slice(-4)}`;
  const action = swap.type === 'sell' ? 'sold' : 'bought';
  const symbol = swap.tokenSymbol || 'a token';
  const sol =
    swap.solAmount != null && !Number.isNaN(Number(swap.solAmount)) && Number(swap.solAmount) > 0
      ? ` for ${Number(swap.solAmount).toFixed(3)} SOL`
      : '';
  return {
    title: `🚨 Tracked Wallet Trade: ${label}`,
    body: `${label} ${action} $${symbol}${sol}`,
  };
}

function buildFillMessage(order, stats) {
  const symbol = order.tokenSymbol || order.symbol || 'your token';
  const action = order.type === 'sell' ? 'Sold' : 'Bought';
  const pct = Number.isFinite(stats?.percent)
    ? ` (${stats.percent >= 0 ? '+' : ''}${stats.percent.toFixed(1)}%)`
    : '';
  const usd = stats?.usdAmount > 0 ? ` for $${stats.usdAmount.toFixed(2)}` : '';
  return {
    title: '🎉 Limit order filled!',
    body: `${action} ${symbol}${usd}${pct}`,
  };
}

// Fire a native (or web) notification when a limit order fills.
export async function notifyOrderFilled(order, stats) {
  if (!permissionGranted) return;
  const { title, body } = buildFillMessage(order, stats);
  const orderId = order.orderId || order.id || String(Date.now());

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idFromSignature(orderId),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            extra: { orderId, tokenMint: order.tokenMint },
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `order-filled-${orderId}`,
        renotify: true,
        data: { orderId, tokenMint: order.tokenMint, url: '/' },
      };

      const registration = await getServiceWorkerRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }
    }
  } catch (err) {
    console.debug('[TradeNotifications] order-filled schedule error:', err?.message);
  }
}

// Fire a native (or web) notification when a coin the user holds starts crashing.
export async function notifyHoldingCrash({ mint, symbol, dropPct, windowLabel, valueUsd }) {
  if (!permissionGranted) return;
  const pct = Math.abs(Number(dropPct) || 0).toFixed(1);
  const value = valueUsd > 0 ? ` Your position is worth ~$${Number(valueUsd).toFixed(2)}.` : '';
  const title = `${symbol || 'A coin you hold'} is dropping fast`;
  const body = `Down ${pct}% in the ${windowLabel}.${value}`;

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idFromSignature(`crash-${mint}-${Date.now()}`),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            extra: { tokenMint: mint },
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `holding-crash-${mint}`,
        renotify: true,
        data: { tokenMint: mint, url: '/' },
      };
      const registration = await getServiceWorkerRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }
    }
  } catch (err) {
    console.debug('[TradeNotifications] crash schedule error:', err?.message);
  }
}

// Fire a native (or web) notification when a tracked coin is up past a threshold.
export async function notifyTrackedGain({ mint, symbol, gainPct, trackedAtPrice, price }) {
  if (!permissionGranted) return;
  const pct = Number(gainPct) || 0;
  const title = `${symbol || 'A coin you track'} is up ${pct.toFixed(1)}%`;
  const from = trackedAtPrice > 0 && price > 0
    ? ` Tracked at $${Number(trackedAtPrice).toPrecision(3)}, now $${Number(price).toPrecision(3)}.`
    : '';
  const body = `Since you tracked it.${from}`;

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idFromSignature(`gain-${mint}-${Date.now()}`),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            extra: { tokenMint: mint },
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `tracked-gain-${mint}`,
        renotify: true,
        data: { tokenMint: mint, url: '/' },
      };
      const registration = await getServiceWorkerRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }
    }
  } catch (err) {
    console.debug('[TradeNotifications] gain schedule error:', err?.message);
  }
}

// Fire a native (or web) notification when a tracked coin is down past a threshold.
export async function notifyTrackedDrop({ mint, symbol, dropPct, trackedAtPrice, price }) {
  if (!permissionGranted) return;
  const pct = Math.abs(Number(dropPct) || 0);
  const title = `📉 ${symbol || 'Tracked coin'} is down ${pct.toFixed(1)}%`;
  const from = trackedAtPrice > 0 && price > 0
    ? ` Tracked at $${Number(trackedAtPrice).toPrecision(3)}, now $${Number(price).toPrecision(3)}.`
    : '';
  const body = `Down ${pct.toFixed(1)}% since you tracked it.${from}`;

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idFromSignature(`drop-${mint}-${Date.now()}`),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            extra: { tokenMint: mint },
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `tracked-drop-${mint}`,
        renotify: true,
        data: { tokenMint: mint, url: '/' },
      };
      const registration = await getServiceWorkerRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }
    }
  } catch (err) {
    console.debug('[TradeNotifications] drop schedule error:', err?.message);
  }
}

// Fire a native (or web) notification for a single detected swap.
export async function notifyWalletTrade(swap) {
  if (!permissionGranted) return;
  const { title, body } = buildMessage(swap);

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idFromSignature(swap.signature || String(Date.now())),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            extra: { signature: swap.signature, walletAddress: swap.walletAddress },
          },
        ],
      });
    } else if ('Notification' in window && permissionGranted) {
      const notificationOptions = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `tracked-wallet-${swap.signature || swap.walletAddress || Date.now()}`,
        renotify: true,
        data: {
          signature: swap.signature,
          walletAddress: swap.walletAddress,
          url: '/',
        },
      };

      const registration = await getServiceWorkerRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }
    }
  } catch (err) {
    console.debug('[TradeNotifications] schedule error:', err?.message);
  }
}

// Send a custom push notification to the user (e.g. for notifications enabled or test alert)
export async function sendPushNotification(title, body, extraData = {}) {
  await initTradeNotifications();
  if (!permissionGranted) return false;

  const notifId = Math.floor(Math.random() * 2147483647) || 1;

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            extra: extraData,
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        tag: `moonfeed-push-${Date.now()}`,
        renotify: true,
        data: { url: '/', ...extraData },
      };

      const registration = await getServiceWorkerRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }
    }
    return true;
  } catch (err) {
    console.debug('[TradeNotifications] sendPushNotification error:', err?.message);
    return false;
  }
}
