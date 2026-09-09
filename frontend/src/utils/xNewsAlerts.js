const SEEN_KEY = 'moonfeed_x_news_seen_v1';
const OPEN_KEY = 'moonfeed_open_x_tracker';

const readSeen = () => {
  try {
    const value = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
};

export const xNewsAlertKeys = (trends = []) => trends
  .filter((trend) => trend?.alertWorthy && trend?.alertKey)
  .map((trend) => trend.alertKey);

export const hasUnreadXNews = (trends = []) => {
  const seen = readSeen();
  return xNewsAlertKeys(trends).some((key) => !seen.has(key));
};

export const markXNewsRead = (trends = []) => {
  const seen = readSeen();
  xNewsAlertKeys(trends).forEach((key) => seen.add(key));
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
  } catch { /* storage unavailable */ }
};

export const markXNewsPushUnread = (alertKey, { open = false } = {}) => {
  if (alertKey) {
    const seen = readSeen();
    seen.delete(alertKey);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* storage unavailable */ }
  }
  if (open) {
    try { localStorage.setItem(OPEN_KEY, '1'); } catch { /* storage unavailable */ }
  }
  window.dispatchEvent(new CustomEvent('moonfeed:x-news-updated', { detail: { alertKey } }));
};

export const consumePendingXTrackerOpen = () => {
  try {
    if (localStorage.getItem(OPEN_KEY) !== '1') return false;
    localStorage.removeItem(OPEN_KEY);
    return true;
  } catch {
    return false;
  }
};