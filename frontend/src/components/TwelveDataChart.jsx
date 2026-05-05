import React, { useState, useEffect } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import './TwelveDataChart.css';

const TwelveDataChart = ({ coin, isActive = false, isDesktopMode = false, showPriceScale, showActionButtons = true, onCrosshairMove, onFirstPriceUpdate }) => {
  const { isDarkMode: contextDarkMode } = useDarkMode();
  const [srcReady, setSrcReady] = useState(false);

  const pairAddress = coin?.pairAddress ||
                      coin?.poolAddress ||
                      coin?.ammAccount ||
                      null;

  useEffect(() => {
    // isDesktopMode only controls layout — never loading.
    // Only isActive (driven by isCurrentCard) gates the WebSocket connection
    // so at most ONE DexScreener iframe is live at a time, preventing rate-limiting.
    if (!isActive || !pairAddress) {
      setSrcReady(false);
      return;
    }

    // Double-rAF: ensure browser has painted the DOM and the iframe container
    // has real layout dimensions before DexScreener's embed initialises.
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setSrcReady(true);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      // Tear down the iframe when this card is no longer the active one.
      // Without this, scrolled-past cards keep live WebSocket connections open
      // and DexScreener's rate limiter causes "Loading pair…" forever.
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
