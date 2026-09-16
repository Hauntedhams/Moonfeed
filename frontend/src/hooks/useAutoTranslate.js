import { useState, useEffect, useRef } from 'react';
import { translateText, looksNonEnglish } from '../utils/translate';

// Auto-translates non-English text (coin names/descriptions) to English,
// with a toggle to flip back to the original.
//
//   const t = useAutoTranslate(coin.description);
//   <span onClick={() => t.setShowOriginal(s => !s)}>{t.display}</span>
export default function useAutoTranslate(text) {
  const [translated, setTranslated] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const requestedForRef = useRef(null);

  useEffect(() => {
    setShowOriginal(false);
    if (!looksNonEnglish(text) || requestedForRef.current === text) {
      if (!looksNonEnglish(text)) setTranslated(null);
      return;
    }
    requestedForRef.current = text;
    let cancelled = false;
    translateText(text).then((result) => {
      if (cancelled) return;
      // Some short/ambiguous strings "translate" back to themselves — nothing to show then.
      setTranslated(result && result.trim() && result.trim() !== text.trim() ? result : null);
    });
    return () => { cancelled = true; };
  }, [text]);

  const hasTranslation = !!translated;
  return {
    display: hasTranslation && !showOriginal ? translated : (text || ''),
    hasTranslation,
    showOriginal,
    setShowOriginal,
    original: text || '',
  };
}
