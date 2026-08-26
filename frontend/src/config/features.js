// Frontend feature flags.
//
// USE_NATIVE_CHART: Phase 1 native lightweight-charts candlestick chart
// (fed by the backend GeckoTerminal OHLCV proxy) instead of the GeckoTerminal
// iframe embed. Runtime-togglable for A/B testing without a rebuild:
//   localStorage.setItem('nativeChart', '0'); location.reload();  // disable
//   localStorage.removeItem('nativeChart'); location.reload();    // back to default
// Or build-time via VITE_NATIVE_CHART. DEFAULT_ON: true for iOS TestFlight build 26.
const DEFAULT_ON = true;

function readFlag(localStorageKey, envValue) {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(localStorageKey);
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    }
  } catch (e) {
    // localStorage may be unavailable (SSR / privacy mode) — fall through to env/default.
  }
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;
  return DEFAULT_ON;
}

export const USE_NATIVE_CHART = readFlag('nativeChart', import.meta.env.VITE_NATIVE_CHART);
