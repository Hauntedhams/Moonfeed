import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

const TwelveDataChart = ({ coin, isActive = false, isDesktopMode = false, desktopSlotRef = null, showPriceScale, showActionButtons = true, isExpanded = false, onCrosshairMove, onFirstPriceUpdate, onTradeClick }) => {
  const { isDarkMode: contextDarkMode } = useDarkMode();
  const [srcReady, setSrcReady] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(null); // null | 'portrait' | 'landscape'

  // Single imperative iframe node — always lives in fsSlotRef (document.body portal).
  // NEVER moved in the DOM after creation. Instead, fsSlotRef's position/size is updated
  // with CSS via getBoundingClientRect(), the same way portrait→landscape works in
  // fullscreen: only dimensions change, the iframe never reloads.
  const iframeRef = useRef(null);
  // Thin wrapper div that sits between the slot and the iframe.
  // ALL rotation/positioning for landscape mode is applied to this wrapper;
  // the iframe itself always fills the wrapper at 100% and its style is
  // never changed after creation — eliminating accidental rotation resets.
  const rotateWrapperRef = useRef(null);
  // Placeholder div in the card — used to measure card chart area coordinates only.
  // The iframe is never appended here; this just gives us getBoundingClientRect().
  const cardSlotRef = useRef(null);
  // The iframe's permanent home — always in document.body portal, never moved.
  const fsSlotRef = useRef(null);
  // Wrapper in the body portal that mirrors fsSlotRef's position at a higher z-index.
  // pointer-events:none on the wrapper, auto on the button, so clicks reach the button
  // but the wrapper itself doesn't block the iframe beneath it.
  const fullscreenBtnRef = useRef(null);
  // Gradient mask div — sits above the iframe (z-index 65) and behind the action buttons
  // (z-index 100). Fades the right edge of the chart so buttons are readable over the chart.
  const maskRef = useRef(null);

  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  // Synchronous mirrors — updated during render so they're always current when effects run.
  // Used by updateSlotPosition() to read current mode without stale closures.
  const isDesktopModeRef = useRef(isDesktopMode);
  isDesktopModeRef.current = isDesktopMode;
  const fullscreenModeRef = useRef(fullscreenMode);
  fullscreenModeRef.current = fullscreenMode;
  const showActionButtonsRef = useRef(showActionButtons);
  showActionButtonsRef.current = showActionButtons;

  const pairAddress = coin?.pairAddress ||
                      coin?.poolAddress ||
                      coin?.ammAccount ||
                      null;

  // For pump.fun / graduating tokens with no pair address yet, try to resolve one via Dexscreener.
  const [resolvedPairAddress, setResolvedPairAddress] = useState(null);
  const [poolResolutionState, setPoolResolutionState] = useState('idle'); // 'idle' | 'loading' | 'failed'

  const effectivePairAddress = pairAddress || resolvedPairAddress;

  const isPumpFunNoChart = isActive && !pairAddress &&
    (coin?.isPumpFun || coin?.status === 'graduating') &&
    (coin?.mintAddress || coin?.tokenAddress || coin?.address);

  useEffect(() => {
    setResolvedPairAddress(null);
    setPoolResolutionState('idle');
  }, [coin?.mintAddress, coin?.tokenAddress, coin?.address]);

  useEffect(() => {
    if (!isPumpFunNoChart || poolResolutionState !== 'idle') return;
    const mintAddress = coin?.mintAddress || coin?.tokenAddress || coin?.address;
    if (!mintAddress) return;

    setPoolResolutionState('loading');
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    fetch(`${apiBase}/api/resolve-pool/${mintAddress}`)
      .then(r => r.json())
      .then(data => {
        if (data.poolAddress) {
          setResolvedPairAddress(data.poolAddress);
          setPoolResolutionState('idle');
        } else {
          setPoolResolutionState('failed');
        }
      })
      .catch(() => setPoolResolutionState('failed'));
  }, [isPumpFunNoChart, poolResolutionState, coin?.mintAddress, coin?.tokenAddress, coin?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Graduation Snipe ──────────────────────────────────────────────────────
  // "Buy after DEX listing" — immediately opens the Limit Order modal.
  // The limit order itself handles execution timing once the token is tradeable.
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive || !effectivePairAddress) {
      setSrcReady(false);
      return;
    }

    setSrcReady(false);

    // Wait until the container div has real non-zero dimensions before injecting
    // the iframe src so the chart initialises at the correct viewport size.
    const activate = () => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      setSrcReady(true);
    };

    const tryObserve = () => {
      // In desktop mode observe the actual target slot (right panel, always visible).
      // In mobile mode observe containerRef (inside the mobile chart section).
      const el = (isDesktopModeRef.current && desktopSlotRef?.current)
        ? desktopSlotRef.current
        : containerRef.current;
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
        const checkEl = (isDesktopModeRef.current && desktopSlotRef?.current)
          ? desktopSlotRef.current
          : containerRef.current;
        const rect = checkEl?.getBoundingClientRect();
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
  }, [isActive, effectivePairAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the iframe src (null when not ready)
  const gcParams = `embed=1&bg_color=${contextDarkMode ? '111827' : 'f4f6fb'}&chart_type=price&info=0&light_chart=${contextDarkMode ? '0' : '1'}&resolution=15m&swaps=0`;
  const iframeSrc = srcReady && effectivePairAddress
    ? `https://www.geckoterminal.com/solana/pools/${effectivePairAddress}?${gcParams}`
    : null;

  // ── CSS-only slot positioning ────────────────────────────────────────────────
  // The iframe lives in fsSlotRef permanently (document.body portal, no DOM moves).
  // Instead of reparenting the iframe, we only change fsSlotRef's position/size via
  // CSS — the same mechanism portrait→landscape uses inside fullscreen mode.
  // getBoundingClientRect() returns real viewport coords even inside CSS transforms.

  const updateSlotPosition = () => {
    const slot = fsSlotRef.current;
    const btnWrapper = fullscreenBtnRef.current;
    const mask = maskRef.current;
    if (!slot || !rotateWrapperRef.current) {
      // Not ready — reset slot to invisible
      if (slot) slot.style.cssText = '';
      if (btnWrapper) btnWrapper.style.cssText = '';
      if (mask) mask.style.cssText = '';
      return;
    }
    const fm = fullscreenModeRef.current;
    const showMask = showActionButtonsRef.current;

    // Reset iframe to default fill-parent style (all non-landscape modes).
    // Changing CSS on an <iframe> does NOT cause it to reload — only src changes do.
    const resetIframe = () => {
      if (iframeRef.current) {
        iframeRef.current.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;transform:none;border:none;display:block;';
      }
    };

    if (fm === 'landscape') {
      // Slot + wrapper: identical to portrait — full-viewport, no transform.
      // This is the key fix: by keeping the slot/wrapper layout identical to portrait,
      // there are zero dead zones and the backdrop can never receive accidental events.
      slot.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;transform:none;z-index:99991;border-radius:0;';
      rotateWrapperRef.current.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;transform:none;';
      // Only the iframe is rotated: sized landscape (dvh × dvw), centered in the wrapper,
      // then rotated 90° so it visually fills the full viewport in landscape orientation.
      // The slot/wrapper carry no transform so hit-testing and the backdrop work perfectly.
      if (iframeRef.current) {
        iframeRef.current.style.cssText = 'position:absolute;top:calc((100dvh - 100dvw)/2);left:calc((100dvw - 100dvh)/2);width:100dvh;height:100dvw;transform:rotate(90deg);transform-origin:center;border:none;display:block;';
      }
      if (btnWrapper) btnWrapper.style.cssText = '';
      if (mask) mask.style.cssText = '';
    } else if (fm === 'portrait') {
      slot.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;transform:none;z-index:99991;border-radius:0;';
      rotateWrapperRef.current.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;transform:none;';
      resetIframe();
      if (btnWrapper) btnWrapper.style.cssText = '';
      if (mask) mask.style.cssText = '';
    } else if (isDesktopModeRef.current && desktopSlotRef?.current) {
      const { top, left, width, height } = desktopSlotRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        slot.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${width}px;height:${height}px;transform:none;z-index:1;border-radius:0;`;
        rotateWrapperRef.current.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;transform:none;';
        resetIframe();
        if (btnWrapper) {
          btnWrapper.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${width}px;height:${height}px;transform:none;z-index:2;pointer-events:none;`;
        }
        if (mask) mask.style.cssText = '';
      }
    } else {
      // Mobile card view — position to exactly overlay containerRef in the viewport.
      const el = containerRef.current;
      if (!el) return;
      const { top, left, width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      // Clip the fixed iframe slot to the coin-info-layer's visible bounds so the
      // chart never bleeds outside the card when the expanded card is scrolled.
      const layerEl = el.closest('.coin-info-layer');
      const layerRect = layerEl?.getBoundingClientRect();
      const clipTop = layerRect ? Math.max(top, layerRect.top) : top;
      const clipBottom = layerRect ? Math.min(top + height, layerRect.bottom) : (top + height);
      const clippedH = Math.max(0, clipBottom - clipTop);
      // How many px from the chart's natural top are hidden above the layer boundary.
      const offsetY = clipTop - top;

      if (clippedH <= 0) {
        // Chart has fully scrolled out of the card — hide everything.
        slot.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;';
        if (btnWrapper) btnWrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;overflow:hidden;';
        if (mask) mask.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;';
        return;
      }

      slot.style.cssText = `position:fixed;top:${clipTop}px;left:${left}px;width:${width}px;height:${clippedH}px;transform:none;z-index:60;border-radius:12px;overflow:hidden;`;
      rotateWrapperRef.current.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;transform:none;border-radius:12px;';
      // Offset the iframe upward within the slot so the visible portion of the chart
      // content aligns correctly with the slot window (mirrors CSS overflow:hidden clipping).
      if (iframeRef.current) {
        iframeRef.current.style.cssText = `position:absolute;top:${-offsetY}px;left:0;width:100%;height:${height}px;transform:none;border:none;display:block;`;
      }
      if (btnWrapper) {
        btnWrapper.style.cssText = `position:fixed;top:${clipTop}px;left:${left}px;width:${width}px;height:${clippedH}px;transform:none;z-index:70;pointer-events:none;border-radius:12px;overflow:hidden;`;
      }
      if (mask) {
        // Gradient mask: right-side fade that makes action buttons readable over the chart.
        // z-index 65 = above iframe (60), below Full Chart btn (70) and action buttons (100).
        const opacity = showMask ? '1' : '0';
        const maskColor = contextDarkMode ? 'rgba(11,18,32,1)' : 'rgba(244,246,251,1)';
        mask.style.cssText = `position:fixed;top:${clipTop}px;right:0px;left:${left + width - 140}px;width:140px;height:${clippedH}px;transform:none;z-index:65;pointer-events:none;border-radius:0 12px 12px 0;background:linear-gradient(to right,transparent,${maskColor} 50%);opacity:${opacity};transition:opacity 0.35s ease;`;
      }
    }
  };

  useEffect(() => {
    if (!iframeSrc) {
      // Not ready or coin changed — destroy wrapper+iframe and hide slot
      if (rotateWrapperRef.current) {
        rotateWrapperRef.current.remove();
        rotateWrapperRef.current = null;
      }
      iframeRef.current = null; // removed with wrapper above
      if (fsSlotRef.current) fsSlotRef.current.style.cssText = '';
      if (fullscreenBtnRef.current) fullscreenBtnRef.current.style.cssText = '';
      if (maskRef.current) maskRef.current.style.cssText = '';
      return;
    }

    // Create the rotation wrapper if needed
    if (!rotateWrapperRef.current) {
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
      rotateWrapperRef.current = wrapper;
    }

    if (!iframeRef.current) {
      const iframe = document.createElement('iframe');
      iframe.src = iframeSrc;
      iframe.title = 'GeckoTerminal Chart';
      iframe.setAttribute('frameborder', '0');
      // Initial style — fill the wrapper. updateSlotPosition() will override this
      // for landscape mode (rotating the iframe directly) and reset it otherwise.
      Object.assign(iframe.style, {
        position: 'absolute',
        top: '0', left: '0',
        width: '100%', height: '100%',
        border: 'none', display: 'block',
      });
      iframeRef.current = iframe;
      rotateWrapperRef.current.appendChild(iframe);
    }

    // Position the slot/wrapper before appending so the chart initialises at the correct size.
    updateSlotPosition();

    // Place wrapper in fsSlotRef — its permanent home, never moved again.
    const slot = fsSlotRef.current;
    if (slot && rotateWrapperRef.current.parentNode !== slot) {
      slot.appendChild(rotateWrapperRef.current);
    }

    return () => {
      if (rotateWrapperRef.current) {
        rotateWrapperRef.current.remove();
        rotateWrapperRef.current = null;
      }
      iframeRef.current = null;
      if (fsSlotRef.current) fsSlotRef.current.style.cssText = '';
      if (fullscreenBtnRef.current) fullscreenBtnRef.current.style.cssText = '';
      if (maskRef.current) maskRef.current.style.cssText = '';
    };
  }, [iframeSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reposition when active card changes or mode changes ──────────────────
  // useLayoutEffect so the move happens synchronously before paint.
  useLayoutEffect(() => {
    updateSlotPosition();
  }, [fullscreenMode, isDesktopMode, isActive, showActionButtons, contextDarkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // isExpanded animation tracking: the info-layer expands/collapses over 500ms via
  // a CSS height transition. The chart section moves with it. We run a rAF loop for
  // 600ms so the fixed slot tracks the animation every frame — same as following a
  // scroll but driven by CSS transition instead.
  const expandRafRef = useRef(null);
  useEffect(() => {
    if (expandRafRef.current) cancelAnimationFrame(expandRafRef.current);
    const startTime = performance.now();
    const DURATION = 600; // slightly longer than the 500ms CSS transition
    const tick = (now) => {
      // Skip repositioning in fullscreen — the chart is viewport-fixed and
      // doesn't need to track card coordinates during the expand animation.
      if (!fullscreenModeRef.current) updateSlotPosition();
      if (now - startTime < DURATION) {
        expandRafRef.current = requestAnimationFrame(tick);
      } else {
        expandRafRef.current = null;
      }
    };
    expandRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (expandRafRef.current) cancelAnimationFrame(expandRafRef.current);
    };
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Window resize + scroller scroll: keep the slot aligned with its reference element.
  // The scroller scroll listener handles snap-scroll animations so the fixed slot
  // stays in sync while the card is animating into position.
  // Also listen to info-layer-content scroll so the chart stays in sync when the
  // user scrolls through the expanded card's inner content (transactions, etc.).
  useEffect(() => {
    const scroller = document.querySelector('.modern-scroller-container');
    // Use containerRef to find the coin-info-layer — the scroll container when expanded.
    const infoContent = containerRef.current?.closest('.coin-info-layer')
      ?? document.querySelector('.coin-info-layer');
    // In fullscreen mode the slot is viewport-fixed — skip card-tracking updates.
    // This prevents scroll events from the underlying feed from flickering the chart.
    const handleScroll = () => { if (!fullscreenModeRef.current) updateSlotPosition(); };
    const handleResize = () => updateSlotPosition(); // resize is always needed (mode can change dims)
    window.addEventListener('resize', handleResize);
    if (scroller) scroller.addEventListener('scroll', handleScroll, { passive: true });
    if (infoContent) infoContent.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (scroller) scroller.removeEventListener('scroll', handleScroll);
      if (infoContent) infoContent.removeEventListener('scroll', handleScroll);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock the feed scroller while in fullscreen so scroll/touch events can't
  // change the active card, which would remount this component and reset
  // fullscreenMode state back to null — causing the chart to snap to the
  // card's coordinates instead of staying in the fullscreen position.
  useEffect(() => {
    const scroller = document.querySelector('.modern-scroller-container');
    if (!scroller) return;
    if (fullscreenMode) {
      scroller.classList.add('scroll-locked');
    } else {
      scroller.classList.remove('scroll-locked');
    }
    return () => {
      scroller.classList.remove('scroll-locked');
    };
  }, [fullscreenMode]);

  const showFullscreenBtn = effectivePairAddress && (isExpanded || isDesktopMode);

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
        {/* Invisible placeholder — keeps the chart area in the card layout so
            containerRef.getBoundingClientRect() returns the correct coordinates.
            The actual iframe lives in fsSlotRef (body portal) and is positioned
            via inline CSS to overlay this exact area. */}
        <div
          ref={cardSlotRef}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          }}
        />

        {/* Button is rendered in the body portal (fullscreenBtnRef) at z-index 70,
            above the iframe. Nothing here — avoids being buried by the iframe. */}

        {/* Bonding curve fallback — shown only while resolution is in progress or truly unavailable */}
        {isActive && !effectivePairAddress && isPumpFunNoChart && (
          <div className="chart-bonding-curve-fallback">
            {poolResolutionState === 'loading' ? (
              <>
                <div className="chart-bc-spinner" />
                <div className="chart-bc-label">Looking up chart…</div>
              </>
            ) : (
              <>
                <div className="chart-bc-icon">🚀</div>
                <div className="chart-bc-title">Bonding Curve</div>
                {(coin?.bondingCurveProgress || coin?.bondingProgress) > 0 && (
                  <div className="chart-bc-progress-wrap">
                    <div className="chart-bc-progress-bar">
                      <div
                        className="chart-bc-progress-fill"
                        style={{ width: `${Math.min(100, coin.bondingCurveProgress || coin.bondingProgress || 0)}%` }}
                      />
                    </div>
                    <div className="chart-bc-progress-label">
                      {(coin.bondingCurveProgress || coin.bondingProgress || 0).toFixed(1)}% to graduation
                    </div>
                  </div>
                )}
                <div className="chart-bc-sublabel">Chart available after DEX listing</div>

                {onTradeClick && (
                  <button
                    className="chart-bc-snipe-btn"
                    onClick={e => { e.stopPropagation(); onTradeClick(coin, { tab: 'limit' }); }}
                  >
                    ⚡ Buy after DEX listing
                  </button>
                )}

                <a
                  href={`https://pump.fun/${coin?.mintAddress || coin?.tokenAddress || coin?.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chart-bc-link"
                  onClick={e => e.stopPropagation()}
                >
                  View on Pump.fun
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* fsSlotRef portal — always mounted so the ref is always available.
          The iframe lives here permanently and is positioned via inline CSS.
          No DOM moves: we only change fsSlotRef's style (same as portrait↔landscape). */}
      {effectivePairAddress && createPortal(
        <>
          {/* Dark backdrop — only visible in fullscreen modes */}
          {fullscreenMode && (
            <div
              className="chart-fs-backdrop"
              onClick={() => {
                // In landscape the chart fills the entire viewport via the rotated wrapper.
                // The slot's layout box now covers the full viewport (no dead zones), but
                // keep this guard as a safety net: dead-zone taps should never exit fullscreen.
                if (fullscreenModeRef.current === 'landscape') return;
                fullscreenModeRef.current = null;
                setFullscreenMode(null);
              }}
            />
          )}

          {/* iframe's permanent home — position/size set imperatively by updateSlotPosition() */}
          <div ref={fsSlotRef} />

          {/* Gradient mask — sits above the iframe (z-index 65) and behind the action buttons
              (z-index 100). Fades the right edge so buttons are readable against the chart.
              Position/opacity are set imperatively by updateSlotPosition(). */}
          <div ref={maskRef} />

          {/* "Full Chart" button wrapper — mirrors fsSlotRef position at z-index 70 so the
              button floats above the cross-origin iframe. pointer-events:none on the wrapper,
              auto on the button itself, so clicks reach it without blocking the iframe. */}
          <div ref={fullscreenBtnRef}>
            {showFullscreenBtn && !fullscreenMode && (
              <button
                className="chart-fullscreen-btn"
                onClick={(e) => { e.stopPropagation(); fullscreenModeRef.current = 'portrait'; setFullscreenMode('portrait'); }}
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

          {fullscreenMode && (
            <div className={`chart-fs-controls-overlay${fullscreenMode === 'landscape' ? ' chart-fs-controls-overlay--landscape' : ''}`}>
              <button
                className={`chart-fs-mode-btn${fullscreenMode === 'portrait' ? ' active' : ''}`}
                onClick={() => { fullscreenModeRef.current = 'portrait'; setFullscreenMode('portrait'); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="2" width="10" height="20" rx="2"/>
                </svg>
                Vertical
              </button>

              <button
                className={`chart-fs-mode-btn${fullscreenMode === 'landscape' ? ' active' : ''}`}
                onClick={() => { fullscreenModeRef.current = 'landscape'; setFullscreenMode('landscape'); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="10" rx="2"/>
                </svg>
                Horizontal
              </button>

              <div className="chart-fs-divider" />

              <button className="chart-fs-close-btn" onClick={() => { fullscreenModeRef.current = null; setFullscreenMode(null); }}>
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
