// API Configuration
// Automatically detects environment and sets appropriate API base URL

const getApiBaseUrl = () => {
  // Check for Vite environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In production builds (including Capacitor), always use the live backend.
  // Do NOT use window.location.hostname — Capacitor serves from localhost even
  // in production, which would incorrectly fall through to the dev URL.
  if (import.meta.env.PROD) {
    return 'https://api.moonfeed.app';
  }

  return 'http://localhost:3001';
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  baseUrl: getApiBaseUrl(), // lowercase alias for convenience
  COINS_API: `${getApiBaseUrl()}/api/coins`,
  ENDPOINTS: {
    TRENDING: '/trending',
    NEW: '/new',
    FILTERED: '/filtered',
    ENRICH: '/enrich',
    CURATED: '/curated'
  }
};

export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.COINS_API}${endpoint}`;
};

export const getFullApiUrl = (path) => {
  return `${API_CONFIG.BASE_URL}${path}`;
};

// fetch() has no built-in timeout — without this a slow/hung backend leaves
// UI spinners spinning forever. Aborts and rejects after `ms`.
export const fetchJsonWithTimeout = (url, { timeoutMs = 8000, ...options } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .finally(() => clearTimeout(timer));
};

console.log('🌐 API Config initialized:', {
  environment: window.location.hostname === 'localhost' ? 'development' : 'production',
  baseUrl: API_CONFIG.BASE_URL,
  coinsApi: API_CONFIG.COINS_API
});
