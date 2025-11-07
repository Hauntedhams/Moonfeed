import React, { useState, useEffect, useRef } from 'react';
import MobileOptimizer from '../utils/mobileOptimizer';

const DexScreenerChart = ({ coin, isPreview = false, autoLoad = false }) => {
  // 🔥 MOBILE PERFORMANCE FIX: Detect mobile device
  const isMobile = MobileOptimizer.isMobile;
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  // 🆕 AUTO-LOAD FIX: On mobile, auto-load if autoLoad=true (triggered by enrichment)
  const [showIframe, setShowIframe] = useState(!isMobile || autoLoad); 
  const iframeRef = useRef(null);
  const timeoutRef = useRef(null);
  const cleanupRegisteredRef = useRef(false);

  // 🚀 OPTIMIZED URL: Minimal params for fastest loading
  // Remove unnecessary features to reduce load time
  const chartUrl = `https://dexscreener.com/${coin.chainId}/${coin.pairAddress || coin.tokenAddress}?embed=1&theme=dark&trades=0&info=0&interval=5m&chart=1&header=0&utm_source=moonfeed&utm_medium=embed&layout=base`;
  
  // 🆕 SPEED OPTIMIZATION: DNS prefetch and preconnect for DexScreener
  useEffect(() => {
    // Only run once on mount
    const head = document.head;
    
    // DNS prefetch - resolve domain name early
    if (!document.querySelector('link[rel="dns-prefetch"][href*="dexscreener"]')) {
      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = 'https://dexscreener.com';
      head.appendChild(dnsPrefetch);
    }
    
    // Preconnect - establish connection early (DNS + TCP + TLS)
    if (!document.querySelector('link[rel="preconnect"][href*="dexscreener"]')) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = 'https://dexscreener.com';
      preconnect.crossOrigin = 'anonymous';
      head.appendChild(preconnect);
    }
  }, []); // Run once

  // 🆕 AUTO-LOAD EFFECT: When autoLoad becomes true, trigger iframe loading
  useEffect(() => {
    if (autoLoad && isMobile && !showIframe) {
      console.log(`📊 Auto-loading DexScreener chart for ${coin.symbol} after enrichment`);
      setShowIframe(true);
      setIsLoading(true);
    }
  }, [autoLoad, isMobile, showIframe, coin.symbol]);

  // EFFECT 1: Aggressive preloading for faster iframe startup
  useEffect(() => {
    if (!showIframe) return; // Skip if iframe is not shown yet
    
    // 🚀 SPEED HACK: Preload critical resources
    const head = document.head;
    const resources = [];
    
    // Preload the main page
    const pagePreload = document.createElement('link');
    pagePreload.rel = 'preload';
    pagePreload.href = chartUrl;
    pagePreload.as = 'document';
    head.appendChild(pagePreload);
    resources.push(pagePreload);
    
    // Preconnect to chart data CDN
    const cdnPreconnect = document.createElement('link');
    cdnPreconnect.rel = 'preconnect';
    cdnPreconnect.href = 'https://cdn.dexscreener.com';
    head.appendChild(cdnPreconnect);
    resources.push(cdnPreconnect);
    
    // Preconnect to API endpoints
    const apiPreconnect = document.createElement('link');
    apiPreconnect.rel = 'preconnect';
    apiPreconnect.href = 'https://api.dexscreener.com';
    head.appendChild(apiPreconnect);
    resources.push(apiPreconnect);

    // Set a timeout to show error if chart doesn't load within 6 seconds (reduced from 8)
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setHasError(true);
        setIsLoading(false);
      }
    }, 6000); // Reduced timeout

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Clean up all preload resources
      resources.forEach(resource => {
        if (head.contains(resource)) {
          head.removeChild(resource);
        }
      });
    };
  }, [chartUrl, isLoading, showIframe]);

  // EFFECT 2: Mobile memory management - aggressive cleanup
  useEffect(() => {
    if (isMobile && showIframe && !cleanupRegisteredRef.current) {
      console.log('📊 DexScreener chart loaded for', coin.symbol);
      
      // Register cleanup with optimizer
      MobileOptimizer.registerCleanup(`Chart-${coin.symbol}`, () => {
        if (iframeRef.current) {
          MobileOptimizer.destroyIframe(iframeRef);
        }
      });
      cleanupRegisteredRef.current = true;
      
      return () => {
        console.log('🧹 Aggressively cleaning up DexScreener chart for', coin.symbol);
        
        // Destroy iframe immediately
        if (iframeRef.current) {
          MobileOptimizer.destroyIframe(iframeRef);
        }
        
        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Reset states
        setShowIframe(false);
        setIsLoading(true);
        setHasError(false);
        cleanupRegisteredRef.current = false;
      };
    }
  }, [isMobile, showIframe, coin.symbol]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Apply optimizations to the iframe content
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Inject CSS to optimize the layout and hide unnecessary elements
        const style = doc.createElement('style');
        style.innerHTML = `
          /* Performance optimizations */
          * {
            will-change: auto !important;
          }
          
          /* Hide unnecessary elements for faster rendering */
          [data-testid="layout-sidebar"], 
          .sidebar,
          [class*="sidebar"]:not([class*="main"]):not([class*="right"]),
          .left-panel,
          [class*="left-panel"],
          .trading-panel,
          [class*="trading-panel"],
          [data-testid="layout-footer"],
          .footer,
          [class*="footer"]:not([class*="main"]):not([class*="header"]),
          .bottom-panel,
          [class*="bottom-panel"],
          .trading-footer,
          [class*="trading-footer"],
          .toolbar,
          [class*="toolbar"]:not([class*="top"]):not([class*="header"]),
          .ads,
          [class*="advertisement"],
          [class*="promo"],
          .header,
          [class*="header"]:not([class*="chart"]),
          .top-bar,
          [class*="top-bar"] {
            display: none !important;
          }
          
          /* Maximize chart container for full-width display */
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          
          .chart-area,
          .main-chart,
          [class*="chart-container"],
          [class*="chart-wrapper"],
          [class*="chart-content"],
          .tv-chart,
          [class*="tv-chart"] {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            position: relative !important;
          }
          
          /* Hide loading overlays that might persist */
          .loading-overlay,
          [class*="loading"]:not([class*="chart"]),
          .spinner:not([class*="chart"]) {
            display: none !important;
          }
          
          /* Optimize canvas and SVG elements for full width */
          canvas, svg {
            image-rendering: optimizeSpeed !important;
            shape-rendering: optimizeSpeed !important;
            width: 100% !important;
            max-width: none !important;
          }
          
          /* Remove any constraints that might limit chart width */
          [style*="max-width"] {
            max-width: none !important;
          }
        `;
        doc.head.appendChild(style);

        // Also try to speed up loading by disabling some features
        const optimizeScript = doc.createElement('script');
        optimizeScript.innerHTML = `
          // Disable animations for faster loading
          if (window.TradingView) {
            window.TradingView.onChartReady = function() {
              console.log('Chart ready - optimized for Moonfeed');
            };
          }
        `;
        doc.head.appendChild(optimizeScript);
      } catch (err) {
        console.log('Could not access iframe content (CORS restriction):', err);
      }
    }
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const retry = () => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount(prev => prev + 1);
  };

  // NOW we can do conditional rendering AFTER all hooks are called
  // 🔥 MOBILE FIX: Show placeholder with "Load Chart Here" button
  if (isMobile && !showIframe) {
    return (
      <div style={{
        height: '100%',
        minHeight: isPreview ? '150px' : '320px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
        borderRadius: '14px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        margin: 0,
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.6 }}>📊</div>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', marginBottom: '16px', fontSize: '0.95rem', fontWeight: '600' }}>
          Interactive Chart Available
        </p>
        <p style={{ color: 'rgba(0, 0, 0, 0.5)', marginBottom: '20px', fontSize: '0.85rem', lineHeight: '1.4' }}>
          Load live trading chart or view in new tab
        </p>
        
        {/* Load Embedded Chart Button */}
        <button 
          onClick={() => {
            setShowIframe(true);
            setIsLoading(true);
          }}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: '600',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            marginBottom: '12px',
            width: '100%',
            maxWidth: '280px'
          }}
          onMouseOver={e => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
          }}
          onMouseOut={e => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
          }}
        >
          📈 Load Chart Here
        </button>
        
        {/* Open in New Tab Button */}
        <button 
          onClick={() => window.open(`https://dexscreener.com/${coin.chainId}/${coin.pairAddress || coin.tokenAddress}`, '_blank')}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: '600',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            width: '100%',
            maxWidth: '280px'
          }}
          onMouseOver={e => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
          }}
          onMouseOut={e => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }}
        >
          🔗 Open in New Tab
        </button>
        
        <p style={{ 
          marginTop: '16px', 
          fontSize: '0.75rem', 
          color: 'rgba(0, 0, 0, 0.4)',
          fontStyle: 'italic',
          lineHeight: '1.4'
        }}>
          💡 Tip: "Load Chart Here" uses ~8-10MB memory
        </p>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div style={{ 
        height: '100%', 
        minHeight: '320px',
        background: 'rgba(0, 0, 0, 0.04)', 
        borderRadius: '14px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        margin: 0
      }}>
        <div className="text-center p-4">
          <div style={{ color: '#ef4444', marginBottom: '8px', fontSize: '24px' }}>⚠️</div>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', marginBottom: '12px', fontSize: '0.9rem' }}>Chart failed to load</p>
          <button 
            onClick={retry}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              marginBottom: '8px'
            }}
            onMouseOver={e => e.target.style.background = '#2563eb'}
            onMouseOut={e => e.target.style.background = '#3b82f6'}
          >
            Retry
          </button>
          <div>
            <button 
              onClick={() => window.open(`https://dexscreener.com/${coin.chainId}/${coin.pairAddress || coin.tokenAddress}`, '_blank')}
              style={{
                color: '#3b82f6',
                fontSize: '0.8rem',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Open in DexScreener
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chart iframe (loaded state)
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: isPreview ? '150px' : (isExpanded ? '600px' : '320px'),
      background: '#1a1a1a', // Match DexScreener dark theme to prevent flash
      overflow: 'hidden',
      margin: 0,
      borderRadius: '14px',
      transition: 'min-height 0.3s ease-in-out'
    }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20
        }}>
          <div className="text-center">
            <div style={{
              width: '32px',
              height: '32px',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 8px'
            }}></div>
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.9rem', marginBottom: '4px' }}>Loading chart...</p>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem' }}>This may take a few seconds</p>
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        key={`${coin.tokenAddress}-${retryCount}`}
        src={chartUrl}
        className="w-full h-full border-0"
        style={{
          background: '#1a1a1a',
          width: '100%',
          height: '100%',
          minHeight: isPreview ? '150px' : (isExpanded ? '600px' : '320px'),
          borderRadius: '14px',
          overflow: 'visible',
          border: 'none',
          margin: 0,
          padding: 0,
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: isPreview ? 'none' : 'auto',
          colorScheme: 'dark'
        }}
        title={`${coin.symbol} Chart`}
        allow="fullscreen"
        loading="eager"
        importance="high"
        fetchpriority="high"
        frameBorder="0"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
      />
      
      {/* Expand/Collapse Toggle Button */}
      {!isPreview && !isLoading && !hasError && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            zIndex: 30,
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={isExpanded ? 'Collapse chart' : 'Expand chart'}
          aria-label={isExpanded ? 'Collapse chart' : 'Expand chart'}
        >
          <span style={{
            display: 'inline-block',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>
            ↓
          </span>
        </button>
      )}
    </div>
  );
};

// 🔥 PERFORMANCE FIX: Memoize component to prevent unnecessary re-renders
export default React.memo(DexScreenerChart, (prevProps, nextProps) => {
  // Only re-render if coin address changes
  return prevProps.coin?.pairAddress === nextProps.coin?.pairAddress &&
         prevProps.coin?.tokenAddress === nextProps.coin?.tokenAddress &&
         prevProps.isPreview === nextProps.isPreview;
});
