// Chart timeframe table shared by NativeChart and the screens that embed it,
// so an embedder can pick the SAME initial timeframe the chart's own
// auto-framing would choose — otherwise the chart loads one timeframe, then
// immediately switches and loads another (a wasted OHLCV round trip on open).

export const TIMEFRAMES = [
  { label: '1m', interval: 'minute', aggregate: 1 },
  { label: '5m', interval: 'minute', aggregate: 5 },
  { label: '15m', interval: 'minute', aggregate: 15 },
  { label: '1h', interval: 'hour', aggregate: 1 },
  { label: '4h', interval: 'hour', aggregate: 4 },
  { label: '1d', interval: 'day', aggregate: 1 },
];

export const DEFAULT_TF_INDEX = 2; // 15m — matches the old iframe's resolution

/** Interval length in seconds for a timeframe (used to bucket the live price). */
export function tfSeconds(tf) {
  const base = tf.interval === 'hour' ? 3600 : tf.interval === 'day' ? 86400 : 60;
  return base * tf.aggregate;
}

// OHLCV requests fetch ~1000 candles; keep the entry inside that window with room.
const MAX_CANDLES_BACK = 700;

/**
 * Smallest timeframe on which a trade made at `fromMs` still falls inside the
 * fetched candle window. Returns `fallback` when the time is unknown.
 */
export function tfIndexForEntryTime(fromMs, fallback = DEFAULT_TF_INDEX) {
  const from = Number(fromMs);
  if (!(from > 0)) return fallback;
  const ms = from < 1e12 ? from * 1000 : from;
  const agoSecs = (Date.now() - ms) / 1000;
  if (!(agoSecs > 0)) return fallback;
  for (let i = 0; i < TIMEFRAMES.length; i++) {
    if (agoSecs / tfSeconds(TIMEFRAMES[i]) <= MAX_CANDLES_BACK) return i;
  }
  return TIMEFRAMES.length - 1;
}
