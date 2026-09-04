// Alert storage — persists per-coin "Notify at" price-alert preferences and the
// triggered notifications they produce. Works with no wallet (localStorage only);
// when a wallet is connected the AlertsContext syncs preferences to the backend.

import { API_CONFIG } from '../config/api.js';

const PREFS_KEY = 'moonfeed_alert_prefs';
const NOTIFS_KEY = 'moonfeed_alert_notifications';

// The alert levels offered in the follow flyout, ordered as shown in the UI.
export const ALERT_LEVELS = [-10, -5, 5, 10];

function safeParse(json, fallback) {
  try {
    return JSON.parse(json) ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Preferences: { [mintAddress]: { coin, basePrice, baseAt, levels:[..], triggered:{level:ts} } }
// ---------------------------------------------------------------------------
export function getAllPrefs() {
  return safeParse(localStorage.getItem(PREFS_KEY), {});
}

export function getPrefs(mint) {
  if (!mint) return null;
  return getAllPrefs()[mint] || null;
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save alert prefs:', e);
  }
}

function coinSummary(coin) {
  return {
    mintAddress: coin.mintAddress || coin.address,
    symbol: coin.symbol || 'TOKEN',
    name: coin.name || coin.symbol || 'Token',
    profileImage: coin.profileImage || coin.image || coin.profilePic || null,
  };
}

function coinPrice(coin) {
  return Number(coin.price_usd || coin.priceUsd || coin.price || 0) || 0;
}

// Enable/disable a single alert level for a coin. Returns the updated pref entry.
export function toggleLevel(coin, level, currentPrice) {
  const mint = coin.mintAddress || coin.address;
  if (!mint) return null;

  const prefs = getAllPrefs();
  const price = Number(currentPrice) || coinPrice(coin);
  const existing = prefs[mint] || {
    coin: coinSummary(coin),
    basePrice: price,
    baseAt: Date.now(),
    levels: [],
    triggered: {},
  };

  const levels = new Set(existing.levels || []);
  if (levels.has(level)) {
    levels.delete(level);
    if (existing.triggered) delete existing.triggered[level];
  } else {
    levels.add(level);
  }

  // Reset the baseline to "now" whenever the set of levels changes so alerts
  // measure from the moment the user chose them.
  const updated = {
    ...existing,
    coin: coinSummary(coin),
    basePrice: price > 0 ? price : existing.basePrice,
    baseAt: Date.now(),
    levels: Array.from(levels).sort((a, b) => a - b),
    triggered: {},
  };

  if (updated.levels.length === 0) {
    delete prefs[mint];
  } else {
    prefs[mint] = updated;
  }
  writePrefs(prefs);
  return prefs[mint] || null;
}

// Remove all alert preferences for a coin (e.g. when unfollowed).
export function clearPrefs(mint) {
  if (!mint) return;
  const prefs = getAllPrefs();
  if (prefs[mint]) {
    delete prefs[mint];
    writePrefs(prefs);
  }
}

// Replace the full prefs map (used when hydrating from the backend).
export function replaceAllPrefs(prefs) {
  writePrefs(prefs || {});
}

// Mark a level as triggered so it won't fire repeatedly.
export function markTriggered(mint, level) {
  const prefs = getAllPrefs();
  const entry = prefs[mint];
  if (!entry) return;
  entry.triggered = entry.triggered || {};
  entry.triggered[level] = Date.now();
  writePrefs(prefs);
}

// ---------------------------------------------------------------------------
// Triggered notifications: [{ id, mint, coin, level, price, message, timestamp, read }]
// ---------------------------------------------------------------------------
export function getNotifications() {
  return safeParse(localStorage.getItem(NOTIFS_KEY), []);
}

function writeNotifications(list) {
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save alert notifications:', e);
  }
}

export function addNotification(notif) {
  const list = getNotifications();
  list.unshift({ read: false, ...notif });
  writeNotifications(list);
  return list;
}

export function getUnreadCount() {
  return getNotifications().filter((n) => !n.read).length;
}

export function markAllRead() {
  const list = getNotifications().map((n) => ({ ...n, read: true }));
  writeNotifications(list);
  return list;
}

export function markNotificationsRead(predicate) {
  const list = getNotifications().map((notification) => (
    predicate(notification) ? { ...notification, read: true } : notification
  ));
  writeNotifications(list);
  return list;
}

// ---------------------------------------------------------------------------
// Backend sync — only used when a wallet is connected. Failures are non-fatal;
// localStorage remains the source of truth for the current device.
// ---------------------------------------------------------------------------
export async function syncPrefsToBackend(walletAddress, prefs) {
  if (!walletAddress) return;
  try {
    await fetch(`${API_CONFIG.BASE_URL}/api/users/${walletAddress}/alerts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: prefs }),
    });
  } catch (e) {
    console.warn('Alert backend sync failed (kept locally):', e?.message);
  }
}

export async function loadPrefsFromBackend(walletAddress) {
  if (!walletAddress) return null;
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/users/${walletAddress}/alerts`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.alerts || null;
  } catch (e) {
    console.warn('Alert backend load failed:', e?.message);
    return null;
  }
}
