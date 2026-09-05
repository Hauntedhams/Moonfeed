// Native local notifications for tracked-wallet trades.
// Fires OS notifications ("X wallet made a trade") on iOS/Android via Capacitor
// while the app is running. On web it falls back to the browser Notification API.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';

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

function isRemoteImage(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url);
}

// iOS notification attachments must be LOCAL files, so a remote image URL has
// to be downloaded into the cache dir first. Returns the native file URI, or
// null (notification still fires, just without the picture).
const imageFileCache = new Map(); // url -> file URI
async function resolveImageAttachment(imageUrl) {
  if (!isNative || !isRemoteImage(imageUrl)) return null;
  if (imageFileCache.has(imageUrl)) return imageFileCache.get(imageUrl);
  let fileUri = null;
  try {
    let hash = 0;
    for (let i = 0; i < imageUrl.length; i++) hash = imageUrl.charCodeAt(i) + ((hash << 5) - hash);
    const extMatch = /\.(png|jpe?g|gif|webp)(\?|#|$)/i.exec(imageUrl);
    const path = `notif-img-${Math.abs(hash)}${extMatch ? `.${extMatch[1].toLowerCase()}` : '.png'}`;
    try {
      const existing = await Filesystem.stat({ path, directory: Directory.Cache });
      fileUri = existing.uri || null;
    } catch (_) {
      const res = await Filesystem.downloadFile({ url: imageUrl, path, directory: Directory.Cache, recursive: true });
      fileUri = res.path || null;
    }
  } catch (_) {
    fileUri = null;
  }
  if (imageFileCache.size > 100) imageFileCache.clear();
  imageFileCache.set(imageUrl, fileUri);
  return fileUri;
}

// Extra fields for a native notification carrying an image: iOS attachment
// (thumbnail + expanded large image) and Android largeIcon.
async function imageFields(imageUrl) {
  const fileUri = await resolveImageAttachment(imageUrl);
  return fileUri
    ? { attachments: [{ id: 'image', url: fileUri }], largeIcon: fileUri }
    : {};
}

// Check current permission status without prompting the user.
export async function hasNotificationPermission() {
  try {
    if (isNative) {
      const check = await LocalNotifications.checkPermissions();
      return check.display === 'granted';
    }
    if ('Notification' in window) return Notification.permission === 'granted';
  } catch (err) {
    console.debug('[TradeNotifications] permission check error:', err?.message);
  }
  return false;
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
  const actionLabel = action[0].toUpperCase() + action.slice(1);
  return {
    title: `${label} • Following`,
    body: `${actionLabel} $${symbol}${sol}`,
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
  const image = order.image || order.tokenImage || null;

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
            ...(await imageFields(image)),
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: isRemoteImage(image) ? image : '/android-chrome-192x192.png',
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
export async function notifyHoldingCrash({ mint, symbol, dropPct, windowLabel, valueUsd, image }) {
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
            ...(await imageFields(image)),
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: isRemoteImage(image) ? image : '/android-chrome-192x192.png',
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
export async function notifyTrackedGain({ mint, symbol, gainPct, trackedAtPrice, price, image }) {
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
            ...(await imageFields(image)),
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: isRemoteImage(image) ? image : '/android-chrome-192x192.png',
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
export async function notifyTrackedDrop({ mint, symbol, dropPct, trackedAtPrice, price, image }) {
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
            ...(await imageFields(image)),
          },
        ],
      });
    } else if ('Notification' in window) {
      const notificationOptions = {
        body,
        icon: isRemoteImage(image) ? image : '/android-chrome-192x192.png',
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
  // Prefer the wallet's hosted profile pic / generated avatar URL; only use a
  // remote image (data-URI pictures can't be attached or used as web icons).
  const image = isRemoteImage(swap.walletImage)
    ? swap.walletImage
    : isRemoteImage(swap.walletProfileImage)
      ? swap.walletProfileImage
      : null;

  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idFromSignature(swap.signature || String(Date.now())),
            title,
            body,
            schedule: { at: new Date(Date.now() + 200) },
            ...(await imageFields(image)),
            extra: { signature: swap.signature, walletAddress: swap.walletAddress },
          },
        ],
      });
    } else if ('Notification' in window && permissionGranted) {
      const notificationOptions = {
        body,
        icon: image || '/android-chrome-192x192.png',
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
