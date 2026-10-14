// Ships render crashes and unhandled errors to the backend so we can see what
// broke on devices (the native app has no visible console). Fire-and-forget,
// de-duplicated, and capped so a crash loop can't flood the server.
import { API_CONFIG } from '../config/api';
import { getAnalyticsIdentity } from './analytics';

const ENDPOINT = `${API_CONFIG.BASE_URL}/api/analytics/client-errors`;
const MAX_REPORTS_PER_SESSION = 20;
const recent = new Set();
let sent = 0;

function platform() {
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.()) return cap.getPlatform?.() || 'native';
  } catch (_) { /* not in Capacitor */ }
  return 'web';
}

export function reportClientError(error, { kind = 'render', boundary = null, componentStack = null } = {}) {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 400);
    const key = `${kind}|${boundary || ''}|${message}`;
    if (recent.has(key) || sent >= MAX_REPORTS_PER_SESSION) return;
    recent.add(key);
    sent += 1;
    let identity = {};
    try { identity = getAnalyticsIdentity() || {}; } catch (_) { /* analytics not initialised */ }
    const body = JSON.stringify({
      kind,
      boundary,
      message,
      stack: error?.stack ? String(error.stack).slice(0, 1500) : null,
      componentStack: componentStack ? String(componentStack).slice(0, 1500) : null,
      route: `${window.location.pathname}${window.location.hash || ''}`.slice(0, 120),
      platform: platform(),
      appVersion: import.meta.env?.VITE_APP_VERSION || null,
      walletAddress: identity.walletAddress || null,
      sessionId: identity.sessionId || null,
    });
    if (navigator.sendBeacon) {
      try { navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' })); return; } catch (_) { /* fall through */ }
    }
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (_) { /* never let the reporter itself throw */ }
}

let installed = false;
/** Catch errors that happen outside React rendering (event handlers, async). */
export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (event) => {
    if (event?.error) reportClientError(event.error, { kind: 'uncaught' });
    else if (event?.message) reportClientError(new Error(event.message), { kind: 'uncaught' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    // Aborted fetches / timeouts are routine; don't report them.
    if (reason?.name === 'AbortError') return;
    reportClientError(reason instanceof Error ? reason : new Error(String(reason)), { kind: 'unhandledrejection' });
  });
}
