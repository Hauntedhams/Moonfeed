import React, { useState, useEffect, useRef } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

const TwelveDataChart = ({ coin, isActive = false, isDesktopMode = false, showPriceScale, showActionButtons = true, onCrosshairMove, onFirstPriceUpdate }) => {
  const { isDarkMode: contextDarkMode } = useDarkMode();
  const [srcReady, setSrcReady] = useState(false);
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const fallbackTimerRef = useRef(null);

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
        // DOM not mounted yet — wait one frame and retry
        const raf = requestAnimationFrame(tryObserve);
        return () => cancelAnimationFrame(raf);
      }

      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        // Container already has dimensions — inject immediately
        activate();
        return;
      }

      // Container is 0×0 — observe until it has real dimensions
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            activate();
            break;
          }
        }
      });
      ro.observe(el);
      observerRef.current = ro;

      // Safety fallback: if ResizeObserver never fires with good dims, inject after 500ms
      fallbackTimerRef.current = setTimeout(activate, 500);
    };

    tryObserve();

    return () => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (fallbackTimerRef.current) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null; }
      setSrcReady(false);
    };
  }, [isActive, pairAddress]);

  const iframeSrc = srcReady && pairAddress
    ? `https://dexscreener.com/solana/${pairAddress}?embed=1&theme=${contextDarkMode ? 'dark' : 'light'}&trades=0&info=0`
    : undefined;

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
        <iframe
          key={iframeSrc || 'empty'}
          src={iframeSrc}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: isDesktopMode ? '0' : '12px',
          }}
          title="Dexscreener Chart"
          frameBorder="0"
        />
      </div>
    </div>
  );
};

export default TwelveDataChart;
