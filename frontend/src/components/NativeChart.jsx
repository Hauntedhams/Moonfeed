import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, AreaSeries, createSeriesMarkers } from 'lightweight-charts';
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

// How many "what it'd take to get there" candles are drawn ahead of the live price
// while an order target is being chosen.
const PROJECTION_BARS = 24;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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
  onCrosshairMove = null,
  initialTfIndex = null,
  focusOneMinute = false,
  focusTimelineFrom = null,
  refocusSignal = 0,
  targetPrice = null,
  targetLabel = '',
  targetColor = '#22d3ee',
  entryPrice = null,
  trackedPrice = null,
}) => {
  const { isDarkMode } = useDarkMode();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const seriesTypeRef = useRef(null); // 'candles' | 'area'
  const targetLineRef = useRef(null);
  const entryLineRef = useRef(null);
  const trackedLineRef = useRef(null);
  const markersRef = useRef(null);
  const projSeriesRef = useRef(null);
  const projShapeRef = useRef(null); // stable noise so scrolling stretches one path, not a new one
  const recentVolRef = useRef(0);
  const manualTfRef = useRef(false); // user picked a timeframe; auto-framing stands down
  const lastOrderTargetRef = useRef(null);
  const lastFocusTimelineRef = useRef(null);
  const dataLengthRef = useRef(0);
  const focusAnimationRef = useRef(null);
  const targetScaleAnimationRef = useRef(null);
  const targetPriceRef = useRef(null);
  const displayedTargetPriceRef = useRef(null);
  // Most recent candle, kept in sync so live prices can fold into it in place.
  const lastCandleRef = useRef(null);
  // Direct DOM handle for the price badge — hover/drag scrubbing writes to this
  // node's textContent instead of calling setState, so a fast mobile swipe
  // doesn't force a React re-render on every touchmove tick.
  const liveBadgeRef = useRef(null);

  const [tfIndex, setTfIndex] = useState(initialTfIndex ?? DEFAULT_TF_INDEX);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | empty | error
  const [pool, setPool] = useState(() => resolvePool(coin));
  const [poolResolved, setPoolResolved] = useState(() => !!resolvePool(coin));
  // Live price badge: value + last tick direction ('up'|'down') + counter to replay the flash.
  const [liveTick, setLiveTick] = useState({ price: null, dir: null, n: 0 });
  const [orderGuide, setOrderGuide] = useState(null);

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
    // Built-in last-value/price-line labels are pinned to the far-right edge of the
    // chart, where they get hidden behind the floating action buttons and can lag the
    // header price. Disabled in favor of the controlled .native-chart-live badge below.
    const series = type === 'area'
      ? chart.addSeries(AreaSeries, {
          lineColor: '#4f8cff', lineWidth: 2,
          topColor: 'rgba(79,140,255,0.35)', bottomColor: 'rgba(79,140,255,0.02)',
          priceLineVisible: false, lastValueVisible: false,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
          priceLineVisible: false, lastValueVisible: false,
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
      // fixLeftEdge stops panning past the oldest candle into a blank pane.
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, fixLeftEdge: true },
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
      entryLineRef.current = null;
      trackedLineRef.current = null;
      markersRef.current = null;
      projSeriesRef.current = null;
      if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
      if (targetScaleAnimationRef.current) cancelAnimationFrame(targetScaleAnimationRef.current);
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

  // When expanded/interactive, the chart usually sits inside a scrollable sheet
  // (PositionDetailView, OrderDetailView, fullscreen panel). Wheel/touch events
  // over the canvas would otherwise bubble up and scroll that ancestor at the
  // same time lightweight-charts pans/zooms, producing a jittery double-move.
  // Stopping propagation (not the default action) keeps the gesture contained
  // to the chart for both mouse-wheel and touch/trackpad scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isExpanded) return undefined;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    return () => {
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, [isExpanded]);

  // Feed the parent card's header with the historical candle under the
  // crosshair, and scrub the chart's own price badge to match — so hovering
  // or dragging through the chart shows the price at that point in time the
  // same way every other chart view does. Clearing the pointer restores the
  // live/last-candle price. Written directly to the DOM (not React state) so
  // a fast mobile swipe doesn't trigger a re-render on every touchmove.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return undefined;
    const handleMove = (param) => {
      const series = seriesRef.current;
      const candle = series ? param.seriesData?.get(series) : null;
      const price = Number(candle?.close ?? candle?.value);
      if (param.time && Number.isFinite(price) && price > 0) {
        onCrosshairMove?.({ price, time: param.time });
        if (liveBadgeRef.current) liveBadgeRef.current.textContent = formatPrice(price);
      } else {
        onCrosshairMove?.(null);
        const last = lastCandleRef.current;
        if (liveBadgeRef.current && last) liveBadgeRef.current.textContent = formatPrice(last.close);
      }
    };
    chart.subscribeCrosshairMove(handleMove);
    return () => chart.unsubscribeCrosshairMove(handleMove);
  }, [onCrosshairMove, status, tfIndex]);

  // Limit-order mode picks a timeframe that actually contains the move being asked
  // for — a +50% target is meaningless on a 1m chart.
  useEffect(() => {
    if (!focusOneMinute) {
      manualTfRef.current = false;
      lastOrderTargetRef.current = null;
      return undefined;
    }
    // Moving the price wheel hands control back to the auto-framing.
    if (lastOrderTargetRef.current !== targetPrice) {
      lastOrderTargetRef.current = targetPrice;
      manualTfRef.current = false;
    } else if (manualTfRef.current) {
      return undefined;
    }
    const current = Number(lastCandleRef.current?.close) || 0;
    const target = Number(targetPrice) || 0;
    if (!(current > 0) || !(target > 0)) return undefined;
    const distance = Math.abs(target / current - 1);
    const desired = distance < 0.02 ? 0
      : distance < 0.06 ? 1
      : distance < 0.15 ? 2
      : distance < 0.40 ? 3
      : distance < 1 ? 4
      : 5;
    if (desired === tfIndex) return undefined;
    // Debounced so dragging the price wheel doesn't refetch on every tick.
    const timer = setTimeout(() => setTfIndex(desired), 400);
    return () => clearTimeout(timer);
  }, [focusOneMinute, targetPrice, tfIndex]);

  // Position/profile mode: pick a timeframe wide enough that the entry candle
  // actually exists in the fetched window (~1000 candles). Otherwise the entry
  // simply isn't loaded and looks "stuck" off-screen with nowhere to pan to.
  useEffect(() => {
    if (!focusTimelineFrom) { lastFocusTimelineRef.current = null; return undefined; }
    if (lastFocusTimelineRef.current === focusTimelineFrom) {
      if (manualTfRef.current) return undefined;
    } else {
      lastFocusTimelineRef.current = focusTimelineFrom;
      manualTfRef.current = false;
    }
    const holdSecs = (Date.now() - Number(focusTimelineFrom)) / 1000;
    if (!(holdSecs > 0)) return undefined;
    let desired = TIMEFRAMES.length - 1;
    for (let i = 0; i < TIMEFRAMES.length; i++) {
      if (holdSecs / tfSeconds(TIMEFRAMES[i]) <= 700) { desired = i; break; }
    }
    if (desired !== tfIndex) setTfIndex(desired);
  }, [focusTimelineFrom, tfIndex]);

  const load = useCallback(async () => {
    if (!chartRef.current || !poolResolved) return;
    const tf = TIMEFRAMES[tfIndex];
    setStatus('loading');
    lastCandleRef.current = null; // block live folding until fresh data lands

    // Candlestick mode: coin has a DEX pool → GeckoTerminal OHLCV.
    if (pool) {
      const url = `${API_CONFIG.BASE_URL}/api/geckoterminal/ohlcv/solana/${pool}/${tf.interval}?aggregate=${tf.aggregate}&limit=1000`;
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
      // Typical bar range, used to size the projection's wobble realistically.
      const recent = deduped.slice(-20);
      const vols = recent.map((c) => (c.high - c.low) / (c.close || 1)).filter(Number.isFinite);
      recentVolRef.current = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
      // Seed the price badge immediately so it never shows blank/stale before the first live tick.
      if (lastCandleRef.current) setLiveTick((prev) => ({ price: lastCandleRef.current.close, dir: null, n: prev.n }));
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
      const lastPoint = deduped[deduped.length - 1];
      setLiveTick((prev) => ({ price: lastPoint.value, dir: null, n: prev.n }));
      chartRef.current?.timeScale().fitContent();
      setStatus('ready');
      return;
    }

    setStatus('empty');
  }, [pool, poolResolved, tfIndex, mint, ensureSeries]);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  // Position detail opens at the trader's entry point, leaving the subsequent
  // price action visible and scrollable instead of always fitting all history.
  // The entry sits ~20% in from the left edge (proportional to the total span)
  // rather than jammed against it with only a fixed few-candle buffer.
  // `refocusSignal` lets a caller re-run this on demand (e.g. a "recenter"
  // button) after the user has panned/zoomed away from the entry point.
  useEffect(() => {
    const chart = chartRef.current;
    const last = lastCandleRef.current;
    const entryMs = Number(focusTimelineFrom);
    if (!chart || !last || status !== 'ready' || !Number.isFinite(entryMs) || entryMs <= 0) return;

    const entry = Math.floor(entryMs / 1000);
    const interval = tfSeconds(TIMEFRAMES[tfIndex]);
    const to = last.time + interval * 6;
    const targetFraction = 0.2;
    let from = (entry - targetFraction * to) / (1 - targetFraction);
    from = Math.min(from, entry - interval);
    from = Math.max(0, from);
    try {
      chart.timeScale().setVisibleRange({ from, to });
    } catch (_) {
      // The selected timeframe may not retain an old entry candle; fitContent
      // from load() remains a useful fallback until the user changes timeframe.
    }
  }, [focusTimelineFrom, status, tfIndex, refocusSignal]);

  // Keep the price axis wide enough to always include the entry/target lines
  // (e.g. a placed order's buy-in and trigger price), not just the candles
  // currently in view. Order-placement mode (focusOneMinute) has its own
  // animated version of this, so this one steps aside for that.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || focusOneMinute || status !== 'ready') return undefined;
    const entry = Number(entryPrice);
    const target = Number(targetPrice);
    if (!(entry > 0) && !(target > 0)) return undefined;

    const autoscaleInfoProvider = (original) => {
      const baseInfo = original();
      const baseRange = baseInfo?.priceRange;
      if (!baseRange) return baseInfo;
      let min = baseRange.minValue;
      let max = baseRange.maxValue;
      if (entry > 0) { min = Math.min(min, entry); max = Math.max(max, entry); }
      if (target > 0) { min = Math.min(min, target); max = Math.max(max, target); }
      const pad = (max - min) * 0.12 || max * 0.05;
      return { ...baseInfo, priceRange: { minValue: Math.max(0, min - pad), maxValue: max + pad } };
    };
    try { series.applyOptions({ autoscaleInfoProvider }); } catch (_) { /* chart disposed */ }
    return () => {
      try { series.applyOptions({ autoscaleInfoProvider: undefined }); } catch (_) { /* chart disposed */ }
    };
  }, [focusOneMinute, status, entryPrice, targetPrice, refocusSignal]);

  // Overlay caller-supplied markers (e.g. buy/sell points) once real candles are in.
  // v5 moved markers off the series onto a plugin, so keep the primitive around.
  useEffect(() => {
    if (status !== 'ready' || !seriesRef.current) return;
    const list = Array.isArray(markers) ? markers : [];
    try {
      if (!markersRef.current || markersRef.current.series !== seriesRef.current) {
        markersRef.current = {
          series: seriesRef.current,
          plugin: createSeriesMarkers(seriesRef.current, list),
        };
      } else {
        markersRef.current.plugin.setMarkers(list);
      }
    } catch (e) {
      // series may be mid-teardown — ignore
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
    if (!focusOneMinute && Number.isFinite(price) && price > 0) {
      try {
        targetLineRef.current = series.createPriceLine({
          price,
          color: targetColor,
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: targetLabel || 'Sell target',
        });
      } catch (e) {
        // Area fallback series may not support price lines in all chart builds.
      }
    }

  }, [status, targetColor, targetLabel, targetPrice]);

  // The viewer's own average buy price for this coin, so they can see where they got in.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || status !== 'ready') return;

    if (entryLineRef.current) {
      try { series.removePriceLine(entryLineRef.current); } catch (e) { /* series changed */ }
      entryLineRef.current = null;
    }

    const price = Number(entryPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    try {
      entryLineRef.current = series.createPriceLine({
        price,
        color: '#a78bfa',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'Your buy in',
      });
    } catch (e) {
      // Area fallback series may not support price lines in all chart builds.
    }
  }, [status, entryPrice, tfIndex]);

  // Price when the user started tracking this coin.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || status !== 'ready') return;

    if (trackedLineRef.current) {
      try { series.removePriceLine(trackedLineRef.current); } catch (e) { /* series changed */ }
      trackedLineRef.current = null;
    }

    const price = Number(trackedPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    try {
      trackedLineRef.current = series.createPriceLine({
        price,
        color: '#fbbf24',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: 'Tracked at',
      });
    } catch (e) {
      // Area fallback series may not support price lines in all chart builds.
    }
  }, [status, trackedPrice, tfIndex]);

  // In order mode, draw a guide from the latest traded price to the selected
  // target instead of a full-width line that obscures the chart history.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const current = lastCandleRef.current;
    const target = Number(targetPrice);
    if (!chart || !series || !current || !focusOneMinute || status !== 'ready' || !Number.isFinite(target) || target <= 0) {
      setOrderGuide(null);
      return undefined;
    }

    const syncGuide = () => {
      const canvas = containerRef.current;
      const width = canvas?.clientWidth || 0;
      const height = canvas?.clientHeight || 0;
      const fromX = chart.timeScale().timeToCoordinate(current.time);
      const fromY = series.priceToCoordinate(current.close);
      const rawToY = series.priceToCoordinate(target);
      if (![width, height, fromX, fromY, rawToY].every(Number.isFinite)) return;
      // The price scale caps how far it expands, so keep the guide's tip on-canvas.
      const toY = Math.min(Math.max(rawToY, 10), height - 10);
      setOrderGuide((prev) => {
        if (prev && Math.abs(prev.fromY - fromY) < 0.5 && Math.abs(prev.toY - toY) < 0.5
          && prev.width === width && prev.height === height && Math.abs(prev.fromX - fromX) < 0.5) {
          return prev;
        }
        return { width, height, fromX, fromY, toX: width - 10, toY };
      });
    };

    // The price scale eases toward the target over several frames, so follow it per
    // frame instead of only on range changes — otherwise the guide lags the candles.
    let raf = requestAnimationFrame(function tick() {
      syncGuide();
      raf = requestAnimationFrame(tick);
    });
    const observer = new ResizeObserver(syncGuide);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [focusOneMinute, status, targetPrice, tfIndex]);

  // Keep the order target inside the chart's vertical range. Price lines do not
  // participate in lightweight-charts autoscaling, so the provider expands the
  // native candle range and eases toward the live target while the price wheel moves.
  useEffect(() => {
    const price = Number(targetPrice);
    targetPriceRef.current = focusOneMinute && Number.isFinite(price) && price > 0 ? price : null;
  }, [focusOneMinute, targetPrice]);

  useEffect(() => {
    const series = seriesRef.current;
    // Candlestick mode gets projection candles instead, and those already pull the
    // price scale toward the target on their own.
    if (!series || !focusOneMinute || status !== 'ready' || seriesTypeRef.current === 'candles') return undefined;

    const currentPrice = Number(lastCandleRef.current?.close) || 0;
    displayedTargetPriceRef.current = currentPrice;

    const autoscaleInfoProvider = (original) => {
      const baseInfo = original();
      const target = displayedTargetPriceRef.current;
      const baseRange = baseInfo?.priceRange;
      const center = Number(lastCandleRef.current?.close) || currentPrice;
      if (!baseRange || !center || !Number.isFinite(target) || target <= 0) return baseInfo;

      // Centre the view on the live price and zoom out symmetrically as the target
      // moves away. The candles then stay put instead of sliding up the pane, and the
      // target always lands ~3/4 of the way out rather than pinned to the edge.
      const half = Math.max(
        baseRange.maxValue - center,
        center - baseRange.minValue,
        Math.abs(target - center) * 1.3
      );
      const padding = half * 0.06;
      return {
        ...baseInfo,
        priceRange: {
          minValue: Math.max(0, center - half - padding),
          maxValue: center + half + padding,
        },
      };
    };

    const animatePriceScale = () => {
      const target = targetPriceRef.current || currentPrice;
      const displayed = displayedTargetPriceRef.current || target;
      displayedTargetPriceRef.current = displayed + (target - displayed) * 0.07;
      if (Math.abs(target - displayedTargetPriceRef.current) < Math.max(target * 0.0001, 0.00000001)) {
        displayedTargetPriceRef.current = target;
      }
      try {
        series.applyOptions({ autoscaleInfoProvider });
      } catch (error) {
        return;
      }
      targetScaleAnimationRef.current = requestAnimationFrame(animatePriceScale);
    };

    targetScaleAnimationRef.current = requestAnimationFrame(animatePriceScale);
    return () => {
      if (targetScaleAnimationRef.current) cancelAnimationFrame(targetScaleAnimationRef.current);
      targetScaleAnimationRef.current = null;
      try { series.applyOptions({ autoscaleInfoProvider: undefined }); } catch (error) { /* chart disposed */ }
    };
  }, [focusOneMinute, status, tfIndex]);

  // Zoom the order view onto the live price plus the projected path to the target.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !focusOneMinute || status !== 'ready' || dataLengthRef.current === 0) return;

    if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
    const scale = chart.timeScale();
    const last = dataLengthRef.current - 1;
    const historyBars = 30;
    // Reserve exactly enough room for the projected path to the target.
    const futureBars = PROJECTION_BARS + 3;
    const target = { from: Math.max(0, last - historyBars), to: last + futureBars };
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
  }, [focusOneMinute, status, targetPrice, tfIndex]);

  // Draw a plausible path of candles from the live price to the chosen order target,
  // so the user sees what "getting there" looks like instead of an abstract line.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const last = lastCandleRef.current;
    const target = Number(targetPrice);
    const active = focusOneMinute && status === 'ready' && seriesTypeRef.current === 'candles'
      && last && Number.isFinite(target) && target > 0;

    if (!active) {
      if (projSeriesRef.current) {
        try { chart.removeSeries(projSeriesRef.current); } catch (e) { /* already gone */ }
        projSeriesRef.current = null;
      }
      return;
    }

    if (!projSeriesRef.current) {
      projSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: 'rgba(38,166,154,0.38)', downColor: 'rgba(239,83,80,0.38)',
        borderVisible: false,
        wickUpColor: 'rgba(38,166,154,0.3)', wickDownColor: 'rgba(239,83,80,0.3)',
        priceLineVisible: false, lastValueVisible: false,
      });
    }

    const seedKey = `${mint}-${tfIndex}`;
    if (projShapeRef.current?.key !== seedKey) {
      const rand = mulberry32(hashString(seedKey));
      projShapeRef.current = {
        key: seedKey,
        noise: Array.from({ length: PROJECTION_BARS * 3 }, () => rand() * 2 - 1),
      };
    }
    const { noise } = projShapeRef.current;

    const interval = tfSeconds(TIMEFRAMES[tfIndex]);
    const start = last.close;
    const span = target - start;
    const vol = Math.max(recentVolRef.current, 0.002);
    const wobble = Math.abs(span) * 0.16 + start * vol * 0.6;

    const candles = [];
    let prevClose = start;
    for (let i = 0; i < PROJECTION_BARS; i++) {
      const p = (i + 1) / PROJECTION_BARS;
      const drift = start + span * (p * p * (3 - 2 * p)); // smoothstep, not a straight line
      const isLast = i === PROJECTION_BARS - 1;
      const close = isLast ? target : drift + wobble * noise[i];
      const open = prevClose;
      const high = Math.max(open, close) + wobble * Math.abs(noise[PROJECTION_BARS + i]) * 0.45;
      const low = Math.min(open, close) - wobble * Math.abs(noise[PROJECTION_BARS * 2 + i]) * 0.45;
      candles.push({
        time: last.time + interval * (i + 1),
        open,
        high,
        low: Math.max(low, start * 0.01),
        close,
      });
      prevClose = close;
    }

    try { projSeriesRef.current.setData(candles); } catch (e) { /* mid-teardown */ }
  }, [focusOneMinute, targetPrice, status, tfIndex, mint]);

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
          <span key={liveTick.n} ref={liveBadgeRef} className={`native-chart-live ${liveTick.dir || ''}`}>
            {formatPrice(liveTick.price)}
          </span>
        )}
        {TIMEFRAMES.map((tf, i) => (
          <button
            key={tf.label}
            type="button"
            className={`native-chart-tf ${i === tfIndex ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); manualTfRef.current = true; setTfIndex(i); }}
          >
            {tf.label}
          </button>
        ))}
      </div>
      <div className="native-chart-canvas" ref={containerRef} />
      {orderGuide && (
        <svg className="native-chart-order-guide" viewBox={`0 0 ${orderGuide.width} ${orderGuide.height}`} preserveAspectRatio="none" aria-hidden="true">
          <text x={orderGuide.toX - 4} y={orderGuide.toY - 8} textAnchor="end">{targetLabel}</text>
        </svg>
      )}
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
