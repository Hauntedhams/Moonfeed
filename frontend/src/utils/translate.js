import { getFullApiUrl } from '../config/api';

// Cheap heuristic: only bother calling the translate API for scripts that
// clearly aren't English (CJK, Hangul, Cyrillic, Arabic, Thai, etc.) — avoids
// wasting a request on every plain-English/Latin coin name.
const NON_LATIN_RE = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/;

export function looksNonEnglish(text) {
  return !!text && NON_LATIN_RE.test(text);
}

const cache = new Map();

export async function translateText(text, target = 'en') {
  if (!text) return null;
  const key = `${target}:${text}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetch(getFullApiUrl(`/api/translate?target=${target}&text=${encodeURIComponent(text)}`));
    const data = await res.json();
    const translated = data?.success && data.translated ? data.translated : null;
    cache.set(key, translated);
    return translated;
  } catch (_) {
    return null;
  }
}
