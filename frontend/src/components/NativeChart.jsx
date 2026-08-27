import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, AreaSeries } from 'lightweight-charts';
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

const NativeChart = ({
  coin,
  isActive = false,
  isExpanded = false,
  livePrice = null,
  markers = null,
  initialTfIndex = null,
  focusOneMinute = false,
  targetPrice = null,
  targetLabel = '',
}) => {
  const { isDarkMode } = useDarkMode();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const seriesTypeRef = useRef(null); // 'candles' | 'area'
  const targetLineRef = useRef(null);
  const dataLengthRef = useRef(0);
  const focusAnimationRef = useRef(null);
  // Most recent candle, kept in sync so live prices can fold into it in place.
  const lastCandleRef = useRef(null);

  const [tfIndex, setTfIndex] = useState(initialTfIndex ?? DEFAULT_TF_INDEX);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | empty | error
  const [pool, setPool] = useState(() => resolvePool(coin));
  const [poolResolved, setPoolResolved] = useState(() => !!resolvePool(coin));
  // Live price badge: value + last tick direction ('up'|'down') + counter to replay the flash.
  const [liveTick, setLiveTick] = useState({ price: null, dir: null, n: 0 });

  const mint = coin?.mintAddress || coin?.tokenAddress || coin?.address;

  // Resolve a pool address if the coin doesn't carry one (pre-DEX pump.fun tokens).
  // poolResolved flips true once we know the answer (pool found OR none exists), so
  // load() can then fall back to the line-chart source for pool-less coins ($MOO).
  useEffect(() => {
    const existing = resolvePool(coin);
    if (existing) { setPool(existing); setPoolResolved(true); return; }
    if (!mint) { setPoolResolved(true); return; }
    let cancelled = false;
    setPool(null);
    setPoolResolved(false);
    fetch(`${API_CONFIG.BASE_URL}/api/resolve-pool/${mint}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { if (d?.poolAddress) setPool(d.poolAddress); setPoolResolved(true); } })
      .catch(() => { if (!cancelled) setPoolResolved(true); });
    return () => { cancelled = true; };
  }, [coin, mint]);

  // Lazily create/swap the series so we can switch between candlesticks (DEX pools)
  // and an area line (pool-less coins fed by /api/chart-data).
  const ensureSeries = useCallback((type) => {
    const chart = chartRef.current;
    if (!chart) return null;
    if (seriesRef.current && seriesTypeRef.current === type) return seriesRef.current;
    if (seriesRef.current) { try { chart.removeSeries(seriesRef.current); } catch (e) { /* already gone */ } seriesRef.current = null; }
    const series = type === 'area'
      ? chart.addSeries(AreaSeries, {
          lineColor: '#4f8cff', lineWidth: 2,
          topColor: 'rgba(79,140,255,0.35)', bottomColor: 'rgba(79,140,255,0.02)',
          priceLineVisible: false, lastValueVisible: true,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });
    seriesRef.current = series;
    seriesTypeRef.current = type;
    return series;
  }, []);

  // Create the chart once. The series is created lazily by ensureSeries() so it can
  // switch between candlestick (DEX pool) and area (pool-less /api/chart-data) modes.
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
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesTypeRef.current = null;
      targetLineRef.current = null;
      if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
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

  // Limit-order sell mode always works from a tight one-minute view of the
  // current coin, even if the user was previously looking at a wider chart.
  useEffect(() => {
    if (focusOneMinute && tfIndex !== 0) setTfIndex(0);
  }, [focusOneMinute, tfIndex]);

  const load = useCallback(async () => {
    if (!chartRef.current || !poolResolved) return;
    const tf = TIMEFRAMES[tfIndex];
    setStatus('loading');
    lastCandleRef.current = null; // block live folding until fresh data lands

    // Candlestick mode: coin has a DEX pool → GeckoTerminal OHLCV.
    if (pool) {
      const url = `${API_CONFIG.BASE_URL}/api/geckoterminal/ohlcv/solana/${pool}/${tf.interval}?aggregate=${tf.aggregate}&limit=200`;
      // The backend can transiently 503 a cold (uncached) pool if the provider's own
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
      if (!chartRef.current) return; // unmounted mid-fetch
      if (hadError) { setStatus('error'); return; }
      if (!Array.isArray(list) || list.length === 0) {
        ensureSeries('candles')?.setData([]);
        setStatus('empty');
        return;
      }
      // GeckoTerminal returns [ts, open, high, low, close, volume], newest-first.
      const candles = list
        .map(([t, o, h, l, c]) => ({ time: t, open: +o, high: +h, low: +l, close: +c }))
        .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
        .sort((a, b) => a.time - b.time);
      const deduped = [];
      for (const c of candles) {
        if (deduped.length && deduped[deduped.length - 1].time === c.time) deduped[deduped.length - 1] = c;
        else deduped.push(c);
      }
      const series = ensureSeries('candles');
      if (!series) return;
      series.setData(deduped);
      dataLengthRef.current = deduped.length;
      lastCandleRef.current = deduped[deduped.length - 1] || null;
      chartRef.current?.timeScale().fitContent();
      setStatus('ready');
      return;
    }

    // No DEX pool (e.g. Moonfeed-native $MOO): fall back to on-chain swap history from
    // /api/chart-data (returns {time, value}), rendered as an area line. The endpoint
    // builds candles from Helius on a cold call, which can transiently return empty —
    // retry a couple of times before treating it as genuinely empty.
    if (mint) {
      const RETRY_DELAYS_MS = [0, 1200, 2500];
      let points = null;
      let hadError = false;
      for (const delay of RETRY_DELAYS_MS) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        try {
          const res = await fetch(`${API_CONFIG.BASE_URL}/api/chart-data/${mint}?timeframe=${tf.label}`);
          if (res.ok) {
            const json = await res.json();
            points = json?.data || [];
            hadError = false;
            if (points.length > 0) break; // got data — done
          } else if (res.status === 404) {
            points = []; hadError = false; // endpoint says no data
          } else {
            hadError = true;
          }
        } catch (e) {
          hadError = true;
        }
      }
      if (!chartRef.current) return;
      if (hadError) { setStatus('error'); return; }
      const cleaned = (points || [])
        .map((d) => ({ time: d.time, value: +d.value }))
        .filter((d) => Number.isFinite(d.time) && Number.isFinite(d.value))
        .sort((a, b) => a.time - b.time);
      const deduped = [];
      for (const d of cleaned) {
        if (deduped.length && deduped[deduped.length - 1].time === d.time) deduped[deduped.length - 1] = d;
        else deduped.push(d);
      }
      const series = ensureSeries('area');
      if (!series) return;
      series.setData(deduped);
      dataLengthRef.current = deduped.length;
      if (deduped.length === 0) { setStatus('empty'); return; }
      chartRef.current?.timeScale().fitContent();
      setStatus('ready');
      return;
    }

    setStatus('empty');
  }, [pool, poolResolved, tfIndex, mint, ensureSeries]);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  // Overlay caller-supplied markers (e.g. buy/sell points) once real candles are in.
  useEffect(() => {
    if (status !== 'ready' || !seriesRef.current) return;
    try {
      seriesRef.current.setMarkers(Array.isArray(markers) ? markers : []);
    } catch (e) {
      // series may not support markers (area mode) or may be mid-teardown — ignore
    }
  }, [markers, status]);

  // Draw the active sell target directly on the chart and zoom to the recent
  // one-minute candles when the order drawer is in sell mode.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || status !== 'ready') return;

    if (targetLineRef.current) {
      try { series.removePriceLine(targetLineRef.current); } catch (e) { /* series changed */ }
      targetLineRef.current = null;
    }

    const price = Number(targetPrice);
    if (Number.isFinite(price) && price > 0) {
      try {
        targetLineRef.current = series.createPriceLine({
          price,
          color: '#22d3ee',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: targetLabel || 'Sell target',
        });
      } catch (e) {
        // Area fallback series may not support price lines in all chart builds.
      }
    }

  }, [status, targetLabel, targetPrice]);

  // Animate the sell-order focus into a tight 1m view. The extra future bars on
  // the right make the target line readable without covering the last candles.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !focusOneMinute || tfIndex !== 0 || status !== 'ready' || dataLengthRef.current === 0) return;

    if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
    const scale = chart.timeScale();
    const last = dataLengthRef.current - 1;
    const target = { from: Math.max(0, last - 84), to: last + 34 };
    const current = scale.getVisibleLogicalRange() || { from: Math.max(0, last - 150), to: last + 2 };
    const startedAt = performance.now();
    const duration = 420;

    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      scale.setVisibleLogicalRange({
        from: current.from + (target.from - current.from) * eased,
        to: current.to + (target.to - current.to) * eased,
      });
      if (progress < 1) focusAnimationRef.current = requestAnimationFrame(animate);
      else focusAnimationRef.current = null;
    };

    focusAnimationRef.current = requestAnimationFrame(animate);
    return () => {
      if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
    };
  }, [focusOneMinute, status, tfIndex]);

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
    <div className={`native-chart ${isDarkMode ? 'dark' : 'light'} ${isExpanded ? 'expanded' : ''} ${focusOneMinute ? 'order-focus' : ''}`}>
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
