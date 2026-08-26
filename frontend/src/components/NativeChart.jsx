import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { useDarkMode } from '../contexts/DarkModeContext';
import { API_CONFIG } from '../config/api';
import './NativeChart.css';

// Phase 1 native candlestick chart. Renders lightweight-charts fed by the
// backend GeckoTerminal OHLCV proxy (real OHLC, ~0.5s, backend-cached).
// Replaces the GeckoTerminal iframe when the useNativeChart flag is on.

const TIMEFRAMES = [
  { label: '1m', interval: 'minute', aggregate: 1 },
  { label: '5m', interval: 'minute', aggregate: 5 },
  { label: '15m', interval: 'minute', aggregate: 15 },
  { label: '1h', interval: 'hour', aggregate: 1 },
  { label: '4h', interval: 'hour', aggregate: 4 },
  { label: '1d', interval: 'day', aggregate: 1 },
];

const DEFAULT_TF_INDEX = 2; // 15m — matches the old iframe's resolution

function resolvePool(coin) {
  return coin?.pairAddress || coin?.poolAddress || coin?.ammAccount || null;
}

// Interval length in seconds for a timeframe (used to bucket the live price).
function tfSeconds(tf) {
  const base = tf.interval === 'hour' ? 3600 : tf.interval === 'day' ? 86400 : 60;
  return base * tf.aggregate;
}

function formatPrice(p) {
  if (!Number.isFinite(p)) return '';
  if (p >= 1) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return '$' + p.toPrecision(4);
}

function themeOptions(isDarkMode) {
  return {
    layout: {
      background: { color: 'transparent' },
      textColor: isDarkMode ? '#9aa4bf' : '#4b5563',
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' },
      horzLines: { color: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' },
    },
  };
}

const NativeChart = ({ coin, isActive = false, isExpanded = false, livePrice = null }) => {
  const { isDarkMode } = useDarkMode();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  // Most recent candle, kept in sync so live prices can fold into it in place.
  const lastCandleRef = useRef(null);

  const [tfIndex, setTfIndex] = useState(DEFAULT_TF_INDEX);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | empty | error
  const [pool, setPool] = useState(() => resolvePool(coin));
  // Live price badge: value + last tick direction ('up'|'down') + counter to replay the flash.
  const [liveTick, setLiveTick] = useState({ price: null, dir: null, n: 0 });

  const mint = coin?.mintAddress || coin?.tokenAddress || coin?.address;

  // Resolve a pool address if the coin doesn't carry one (pre-DEX pump.fun tokens).
  useEffect(() => {
    const existing = resolvePool(coin);
    if (existing) { setPool(existing); return; }
    if (!mint) return;
    let cancelled = false;
    fetch(`${API_CONFIG.BASE_URL}/api/resolve-pool/${mint}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.poolAddress) setPool(d.poolAddress); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [coin, mint]);

  // Create the chart + candlestick series once.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      ...themeOptions(isDarkMode),
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      handleScroll: isExpanded,
      handleScale: isExpanded,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-theme on dark-mode toggle.
  useEffect(() => {
    if (chartRef.current) chartRef.current.applyOptions(themeOptions(isDarkMode));
  }, [isDarkMode]);

  // Only allow pan/zoom when the card is expanded; collapsed lets the feed scroll.
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ handleScroll: isExpanded, handleScale: isExpanded });
    }
  }, [isExpanded]);

  const load = useCallback(async () => {
    if (!pool || !seriesRef.current) return;
    const tf = TIMEFRAMES[tfIndex];
    setStatus('loading');
    lastCandleRef.current = null; // block live folding until fresh data lands
    const url = `${API_CONFIG.BASE_URL}/api/geckoterminal/ohlcv/solana/${pool}/${tf.interval}?aggregate=${tf.aggregate}&limit=200`;
    // The backend can transiently 503 a cold (uncached) pool if GeckoTerminal's own
    // rate limit is hit — retry a couple of times before treating it as empty/error.
    const RETRY_DELAYS_MS = [0, 900, 2000];
    let list = null;
    let hadError = false;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetch(url);
        if (!res.ok) { hadError = true; continue; } // transient — retry
        const json = await res.json();
        list = json?.data?.attributes?.ohlcv_list || [];
        hadError = false;
        break;
      } catch (e) {
        hadError = true;
      }
    }
    if (!seriesRef.current) return; // unmounted mid-fetch
    if (hadError) {
      setStatus('error');
      return;
    }
    if (!Array.isArray(list) || list.length === 0) {
      seriesRef.current.setData([]);
      setStatus('empty');
      return;
    }
    // GeckoTerminal returns [ts, open, high, low, close, volume], newest-first.
    const candles = list
      .map(([t, o, h, l, c]) => ({ time: t, open: +o, high: +h, low: +l, close: +c }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);
    // lightweight-charts requires strictly ascending, unique timestamps.
    const deduped = [];
    for (const c of candles) {
      if (deduped.length && deduped[deduped.length - 1].time === c.time) {
        deduped[deduped.length - 1] = c;
      } else {
        deduped.push(c);
      }
    }
    seriesRef.current.setData(deduped);
    lastCandleRef.current = deduped[deduped.length - 1] || null;
    chartRef.current?.timeScale().fitContent();
    setStatus('ready');
  }, [pool, tfIndex]);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  // Fold the live price into the last candle in real time (O(1) series.update).
  useEffect(() => {
    if (!isActive) return;
    const p = Number(livePrice);
    if (!Number.isFinite(p) || p <= 0) return;
    const series = seriesRef.current;
    const last = lastCandleRef.current;
    if (!series || !last) return;
    const sec = tfSeconds(TIMEFRAMES[tfIndex]);
    const nowBucket = Math.floor(Date.now() / 1000 / sec) * sec;
    const dir = p > last.close ? 'up' : p < last.close ? 'down' : null;
    const candle = nowBucket > last.time
      ? { time: nowBucket, open: last.close, high: p, low: p, close: p } // new interval
      : { time: last.time, open: last.open, high: Math.max(last.high, p), low: Math.min(last.low, p), close: p };
    lastCandleRef.current = candle;
    setLiveTick((prev) => ({ price: p, dir, n: prev.n + 1 }));
    try {
      series.update(candle);
    } catch (e) {
      // update() rejects out-of-order times; ignore and let the next OHLCV fetch reconcile.
    }
  }, [livePrice, isActive, tfIndex]);

  return (
    <div className={`native-chart ${isDarkMode ? 'dark' : 'light'} ${isExpanded ? 'expanded' : ''}`}>
      <div className="native-chart-tfs">
        {liveTick.price != null && (
          <span key={liveTick.n} className={`native-chart-live ${liveTick.dir || ''}`}>
            {formatPrice(liveTick.price)}
          </span>
        )}
        {TIMEFRAMES.map((tf, i) => (
          <button
            key={tf.label}
            type="button"
            className={`native-chart-tf ${i === tfIndex ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setTfIndex(i); }}
          >
            {tf.label}
          </button>
        ))}
      </div>
      <div className="native-chart-canvas" ref={containerRef} />
      {status === 'loading' && (
        <div className="native-chart-overlay">
          <div className="native-chart-spinner" />
        </div>
      )}
      {status === 'empty' && (
        <div className="native-chart-overlay">
          <span className="native-chart-msg">No chart data yet</span>
        </div>
      )}
      {status === 'error' && (
        <div className="native-chart-overlay native-chart-overlay-tappable" onClick={(e) => { e.stopPropagation(); load(); }}>
          <span className="native-chart-msg">Chart unavailable — tap to retry</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(NativeChart);
