import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

const TwelveDataChart = ({ coin, isActive = false, isDesktopMode = false, showPriceScale, showActionButtons = true, isExpanded = false, onCrosshairMove, onFirstPriceUpdate }) => {
  const { isDarkMode: contextDarkMode } = useDarkMode();
  const [srcReady, setSrcReady] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(null); // null | 'portrait' | 'landscape'

  // Single imperative iframe node — moved between slots instead of remounted
  const iframeRef = useRef(null);
  // Slot in the card view (empty div, iframe lives here when not in fullscreen)
  const cardSlotRef = useRef(null);
  // Slot inside the fullscreen portal (iframe moves here when fullscreen is open)
  const fsSlotRef = useRef(null);

  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  // WebSocket kick timers — nudge early (invisible to user) + fallback reload
  const nudge1Ref = useRef(null);
  const nudge2Ref = useRef(null);
  const nudge3Ref = useRef(null);
  const reloadTimerRef = useRef(null);
  // Mirror isActive in a ref so stale-recovery timers can read current value
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const pairAddress = coin?.pairAddress ||
                      coin?.poolAddress ||
                      coin?.ammAccount ||
                      null;

  useEffect(() => {
    if (!isActive || !pairAddress) {
      setSrcReady(false);
      return;
    }

    setSrcReady(false);

    // Wait until the container div has real non-zero dimensions before injecting
    // the iframe src. DexScreener's embed reads the container size on init —
    // if it gets 0×0 it stalls on "Loading pair…" forever.
    const activate = () => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      setSrcReady(true);
    };

    const tryObserve = () => {
      const el = containerRef.current;
      if (!el) {
        const raf = requestAnimationFrame(tryObserve);
        return () => cancelAnimationFrame(raf);
      }

      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        activate();
        return;
      }

      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) { activate(); break; }
        }
      });
      ro.observe(el);
      observerRef.current = ro;
      // Fallback: only activate if the container actually has dimensions by then;
      // if still 0×0 (e.g. hidden by a parent), wait another 2 s before forcing.
      fallbackTimerRef.current = setTimeout(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width > 0) {
          activate();
        } else {
          fallbackTimerRef.current = setTimeout(activate, 2000);
        }
      }, 500);
    };

    tryObserve();

    return () => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      setSrcReady(false);
    };
  }, [isActive, pairAddress]);

  // Build the iframe src (null when not ready)
  const iframeSrc = srcReady && pairAddress
    ? `https://dexscreener.com/solana/${pairAddress}?embed=1&theme=${contextDarkMode ? 'dark' : 'light'}&trades=0&info=0`
    : null;

  // ── Single-iframe lifecycle ─────────────────────────────────────────────────
  // Create ONE imperative <iframe> when the chart becomes ready; destroy it when
  // the card goes inactive. We never create a second iframe for the fullscreen
  // overlay — instead we physically move this same node between cardSlotRef and
  // fsSlotRef. That keeps the DexScreener WebSocket alive across portrait /
  // landscape switches and open/close cycles.

  const clearKickTimers = () => {
    if (nudge1Ref.current)   { clearTimeout(nudge1Ref.current);   nudge1Ref.current   = null; }
    if (nudge2Ref.current)   { clearTimeout(nudge2Ref.current);   nudge2Ref.current   = null; }
    if (nudge3Ref.current)   { clearTimeout(nudge3Ref.current);   nudge3Ref.current   = null; }
    if (reloadTimerRef.current) { clearTimeout(reloadTimerRef.current); reloadTimerRef.current = null; }
  };

  useEffect(() => {
    clearKickTimers();

    if (!iframeSrc) {
      // Not ready or coin changed — destroy any existing iframe
      if (iframeRef.current) {
        iframeRef.current.remove();
        iframeRef.current = null;
      }
      return;
    }

    if (!iframeRef.current) {
      const iframe = document.createElement('iframe');
      iframe.src = iframeSrc;
      iframe.title = 'DexScreener Chart';
      iframe.setAttribute('frameborder', '0');
      Object.assign(iframe.style, {
        position: 'absolute',
        top: '0', left: '0',
        width: '100%', height: '100%',
        border: 'none', display: 'block',
      });
      iframeRef.current = iframe;
    }

    // Place in card slot on creation
    const slot = cardSlotRef.current;
    if (slot && iframeRef.current.parentNode !== slot) {
      slot.appendChild(iframeRef.current);
    }

    // ── Proactive WebSocket kick ─────────────────────────────────────────────
    // DexScreener's WebSocket silently fails to connect ~50% of the time.
    // Triggering a micro-resize (1 px height flip) immediately after load
    // fires DexScreener's internal ResizeObserver which restarts the connection.
    // We do it at 300 ms / 800 ms / 1500 ms so the chart never visibly stalls.
    // A 1-px nudge on an already-loaded chart is completely invisible.
    // Only if all three nudges fail (extremely rare) do we do a full src reload at 5 s.
    const nudge = (iframe) => {
      if (!iframe || !isActiveRef.current) return;
      iframe.style.height = 'calc(100% - 1px)';
      requestAnimationFrame(() => {
        if (iframeRef.current === iframe) iframe.style.height = '100%';
      });
    };

    nudge1Ref.current = setTimeout(() => nudge(iframeRef.current), 300);
    nudge2Ref.current = setTimeout(() => nudge(iframeRef.current), 800);
    nudge3Ref.current = setTimeout(() => nudge(iframeRef.current), 1500);

    reloadTimerRef.current = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!isActiveRef.current || !iframe) return;
      const src = iframe.src;
      iframe.src = '';
      setTimeout(() => { if (iframeRef.current === iframe) iframe.src = src; }, 250);
    }, 5000);

    return () => {
      clearKickTimers();
      // Component unmounting — clean up
      if (iframeRef.current) {
        iframeRef.current.remove();
        iframeRef.current = null;
      }
    };
  }, [iframeSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Move iframe between card slot and fullscreen slot ───────────────────────
  // useLayoutEffect (not useEffect) so the move happens synchronously before the
  // browser paints.  With useEffect the backdrop becomes visible one frame before
  // the iframe arrives, causing a blank-then-chart double-flash.
  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // When fullscreen opens, move iframe into the portal slot (it is always
    // mounted so fsSlotRef is always set when pairAddress is truthy).
    // When fullscreen closes, move it back to the card slot.
    const target = fullscreenMode ? fsSlotRef.current : cardSlotRef.current;
    if (target && iframe.parentNode !== target) {
      target.appendChild(iframe);
    }
  }, [fullscreenMode]);

  const showFullscreenBtn = pairAddress && (isExpanded || isDesktopMode);

  return (
    <div
      className={`twelve-data-chart-wrapper ${isDesktopMode ? 'desktop-mode' : ''}`}
      style={isDesktopMode ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      } : {
        width: '100%',
        height: 'auto',
        minHeight: '380px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        ref={containerRef}
        className={`dexscreener-advanced-container${showActionButtons ? '' : ' no-mask'}`}
        style={{
          width: '100%',
          height: isDesktopMode ? '100%' : '380px',
          minHeight: isDesktopMode ? '100vh' : '380px',
          position: 'relative',
        }}
      >
        {/* Empty slot — the single iframe lives here imperatively when not fullscreen.
            React never renders children into this div so it won't remove the iframe. */}
        <div
          ref={cardSlotRef}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            borderRadius: isDesktopMode ? '0' : '12px',
            overflow: 'hidden',
          }}
        />

        {showFullscreenBtn && (
          <button
            className="chart-fullscreen-btn"
            onClick={(e) => { e.stopPropagation(); setFullscreenMode('portrait'); }}
            title="View chart fullscreen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            <span>Full Chart</span>
          </button>
        )}
      </div>

      {/* Fullscreen portal — always mounted when pairAddress exists.
          Using display:none (via chart-fs-hidden) instead of conditional rendering
          keeps the portal (and fsSlotRef) in the DOM at all times, which lets us
          safely move the single iframe in and out without a reload. */}
      {pairAddress && createPortal(
        <>
          <div className={`chart-fs-backdrop${fullscreenMode ? '' : ' chart-fs-hidden'}`}>
            {/* Inner frame: position:fixed so it is positioned relative to the
                viewport, never clipped by the backdrop's box. The iframe lives
                here imperatively while fullscreen is active. */}
            <div
              ref={fsSlotRef}
              className={`chart-fs-inner ${fullscreenMode || 'portrait'}`}
            />
          </div>

          {/* Controls pill — only shown while fullscreen is active */}
          {fullscreenMode && (
            <div className="chart-fs-controls-overlay">
              <button
                className={`chart-fs-mode-btn${fullscreenMode === 'portrait' ? ' active' : ''}`}
                onClick={() => setFullscreenMode('portrait')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="2" width="10" height="20" rx="2"/>
                </svg>
                Vertical
              </button>

              <button
                className={`chart-fs-mode-btn${fullscreenMode === 'landscape' ? ' active' : ''}`}
                onClick={() => setFullscreenMode('landscape')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="10" rx="2"/>
                </svg>
                Horizontal
              </button>

              <div className="chart-fs-divider" />

              <button className="chart-fs-close-btn" onClick={() => setFullscreenMode(null)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20"/>
                  <polyline points="20 10 14 10 14 4"/>
                  <line x1="10" y1="14" x2="3" y2="21"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                </svg>
                Shrink
              </button>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
};

export default TwelveDataChart;
