// Native local notifications for tracked-wallet trades.
// Fires OS notifications ("X wallet made a trade") on iOS/Android via Capacitor
// while the app is running. On web it falls back to the browser Notification API.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = Capacitor.isNativePlatform();
let permissionGranted = false;
let initialized = false;

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

function buildMessage(swap) {
  const label =
    swap.walletLabel ||
    `${swap.walletAddress.slice(0, 4)}...${swap.walletAddress.slice(-4)}`;
  const action = swap.type === 'sell' ? 'sold' : 'bought';
  const symbol = swap.tokenSymbol || 'a token';
  const sol =
    swap.solAmount != null && !Number.isNaN(Number(swap.solAmount))
      ? ` for ${Number(swap.solAmount).toFixed(3)} SOL`
      : '';
  return {
    title: `${label} made a trade`,
    body: `${action.charAt(0).toUpperCase() + action.slice(1)} ${symbol}${sol}`,
  };
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
      new Notification(title, { body });
    }
  } catch (err) {
    console.debug('[TradeNotifications] schedule error:', err?.message);
  }
}
