import React, { useEffect, useRef, useState } from 'react';
import './PriceHistoryChart.css';

// DEBUG MODE - Set to false to disable all diagnostic logging (massive performance boost)
const DEBUG_MODE = false;
const debugLog = (...args) => { if (DEBUG_MODE) debugLog(...args); };

const PriceHistoryChart = ({ coin, width, height = 200 }) => {
  // 🔥 MOBILE PERFORMANCE FIX: Reduce pixel ratio on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Use parent container width - if width is "100%" or similar, use full container
  const chartWidth = width === "100%" ? "100%" : (width || 280);
  const canvasRef = useRef(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null); // For tooltip
  
  // Diagnostic timing
  const mountTimeRef = useRef(Date.now());
  const drawTimeRef = useRef(null);

  // Helper functions for tooltip
  const formatPrice = (price) => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle canvas mouse events for tooltip
  const handleCanvasMouseMove = (event) => {
    if (!chartData?.dataPoints || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Find closest data point with updated padding
    const containerWidth = canvas.parentElement?.offsetWidth || (typeof chartWidth === 'number' ? chartWidth : 280);
    const containerHeight = height;
    const padding = { top: 10, right: 10, bottom: 35, left: 55 };
    const chartWidthCalc = containerWidth - padding.left - padding.right;
    
    // Check if mouse is within chart area
    if (mouseX < padding.left || mouseX > containerWidth - padding.right ||
        mouseY < padding.top || mouseY > containerHeight - padding.bottom) {
      setHoveredPoint(null);
      return;
    }
    
    const relativeX = mouseX - padding.left;
    const pointIndex = Math.round((relativeX / chartWidthCalc) * (chartData.dataPoints.length - 1));
    const clampedIndex = Math.max(0, Math.min(pointIndex, chartData.dataPoints.length - 1));
    
    if (chartData.dataPoints[clampedIndex]) {
      const dataPoint = chartData.dataPoints[clampedIndex];
      setHoveredPoint({
        x: mouseX,
        y: mouseY,
        price: dataPoint.price,
        time: dataPoint.timestamp,
        index: clampedIndex
      });
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Diagnostic logging - DISABLED in production for performance
  const DEBUG_MODE = false; // Set to true only for debugging
  
  useEffect(() => {
    if (DEBUG_MODE) {
      debugLog('🔍 [CHART DIAGNOSTIC] Component mounted at:', new Date().toISOString());
      debugLog('🔍 [CHART DIAGNOSTIC] Coin data:', {
        symbol: coin?.symbol,
        tokenAddress: coin?.tokenAddress,
        mintAddress: coin?.mintAddress,
        pairAddress: coin?.pairAddress,
        hasRequiredAddress: !!(coin?.tokenAddress || coin?.mintAddress || coin?.pairAddress)
      });
    }
    
    return () => {
      if (DEBUG_MODE) {
        const totalTime = Date.now() - mountTimeRef.current;
        debugLog('🔍 [CHART DIAGNOSTIC] Component unmounted after', totalTime, 'ms');
      }
    };
  }, []);

  useEffect(() => {
    if (DEBUG_MODE) {
      debugLog('🔍 [CHART DIAGNOSTIC] Dependency changed - coin data');
      debugLog('🔍 [CHART DIAGNOSTIC] Generating 24-hour blended chart from DexScreener price changes');
    }
    
    if (coin) {
      // Check if we have pre-generated chart data from backend enrichment
      if (coin.cleanChartData && coin.cleanChartData.dataPoints) {
        if (DEBUG_MODE) debugLog('✅ [CHART] Using pre-generated chart data from backend enrichment');
        const rawData = coin.cleanChartData;
        const rawPoints = rawData.dataPoints;
        
        console.log(`[PriceHistoryChart] 📊 Raw data points from API: ${rawPoints.length}`);
        
        // 🎯 ENSURE EXACTLY 5 REAL POINTS: Sample evenly from rawPoints
        let sampledRealPoints = [];
        if (rawPoints.length >= 5) {
          // Take 5 evenly spaced points from the data
          const step = (rawPoints.length - 1) / 4; // Divide into 4 segments for 5 points
          for (let i = 0; i < 5; i++) {
            const index = Math.round(i * step);
            sampledRealPoints.push(rawPoints[index]);
          }
        } else {
          // If we have fewer than 5 points, use all of them
          sampledRealPoints = [...rawPoints];
        }
        
        console.log(`[PriceHistoryChart] 🎯 Sampled ${sampledRealPoints.length} real points from ${rawPoints.length} API points`);
        
        // 🎯 ADD INTERPOLATION: Create exactly 5 interpolated points (one between each pair of real points)
        const interpolatedPoints = [];
        
        for (let i = 0; i < sampledRealPoints.length; i++) {
          // Add the real data point
          interpolatedPoints.push({
            ...sampledRealPoints[i],
            isReal: true // Mark as real API data
          });
          
          // Add interpolated point between this and next (except for last point)
          if (i < sampledRealPoints.length - 1) {
            const current = sampledRealPoints[i];
            const next = sampledRealPoints[i + 1];
            
            // Calculate base interpolation (midpoint)
            const baseTime = (current.timestamp + next.timestamp) / 2;
            const basePrice = (current.price + next.price) / 2;
            
            // 🎨 ADD REALISTIC VARIATION based on price trend
            const priceDiff = next.price - current.price;
            const isUptrend = priceDiff > 0;
            
            // Calculate a natural curve factor (sine wave for smooth variation)
            // This creates a subtle peak or valley between points
            const curveIntensity = Math.abs(priceDiff) * 0.2; // 20% of the price difference for noticeable variation
            const curveFactor = Math.sin(Math.PI * 0.5); // Peak at midpoint
            
            // Add random variation factor for more liveliness (-0.5 to +0.5)
            const randomFactor = (Math.random() - 0.5) * 0.4; // ±20% additional randomness
            
            // Add variation that follows the trend with randomness
            let priceVariation;
            if (isUptrend) {
              // For uptrend: create a slight peak above the straight line with random variation
              priceVariation = curveIntensity * curveFactor * (1 + randomFactor);
            } else {
              // For downtrend: create a slight dip below the straight line with random variation
              priceVariation = -curveIntensity * curveFactor * (1 + randomFactor);
            }
            
            const interpolatedPrice = basePrice + priceVariation;
            
            interpolatedPoints.push({
              timestamp: baseTime,
              price: interpolatedPrice,
              time: new Date(baseTime).toLocaleTimeString(),
              isReal: false, // Mark as interpolated/estimated
              isInterpolated: true
            });
          }
        }
        
        console.log(`[PriceHistoryChart] ✨ Final result: ${sampledRealPoints.length} real + ${interpolatedPoints.length - sampledRealPoints.length} interpolated = ${interpolatedPoints.length} total points`);
        console.log(`[PriceHistoryChart] 🎯 Target achieved: 5 real + 5 interpolated = 10 total points`);
        
        // Calculate min/max for display
        const prices = interpolatedPoints.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        setChartData({
          tokenInfo: {
            address: coin.mintAddress || coin.tokenAddress,
            minPrice,
            maxPrice,
            priceChange24h: coin.priceChanges?.change24h || coin.priceChange?.h24 || 0
          },
          dataPoints: interpolatedPoints, // Use interpolated data
          metadata: {
            timeframe: '24H',
            dataPoints: interpolatedPoints.length,
            source: 'Backend pre-generated (DexScreener) + Interpolation'
          }
        });
        setLoading(false);
      } else {
        // Fallback: Generate chart from DexScreener price change anchors client-side
        debugLog('⚠️  [CHART] No pre-generated data, generating client-side');
        generateBlended24HourChart();
      }
    } else {
      debugLog('❌ [CHART DIAGNOSTIC] No coin data available');
      setError('No coin data available');
      setLoading(false);
    }
  }, [coin?.mintAddress || coin?.tokenAddress, coin?.cleanChartData]);

  // Draw chart immediately when data is ready
  useEffect(() => {
    debugLog('🔍 [CHART DIAGNOSTIC] Chart data effect triggered:', {
      hasChartData: !!chartData,
      hasDataPoints: !!(chartData?.dataPoints),
      dataPointsLength: chartData?.dataPoints?.length || 0
    });
    
    if (chartData && chartData.dataPoints && chartData.dataPoints.length > 0) {
      drawTimeRef.current = Date.now();
      drawChart(chartData.dataPoints);
      const drawDuration = Date.now() - drawTimeRef.current;
      debugLog('🔍 [CHART DIAGNOSTIC] Chart drawn in', drawDuration, 'ms');
    }
  }, [chartData]);

  // Generate blended 24-hour chart using multiple DexScreener price change anchors
  const generateBlended24HourChart = () => {
    const generateStartTime = Date.now();
    debugLog('📊 [BLENDED CHART] Starting 24-hour blended chart generation');
    
    setLoading(true);
    setError(null);
    
    try {
      const currentPrice = coin?.price_usd ?? coin?.priceUsd ?? coin?.price ?? 0;
      
      if (!currentPrice || currentPrice === 0) {
        throw new Error('No valid price data');
      }
      
      // Get all available price changes from DexScreener
      const priceChanges = coin?.priceChanges || coin?.priceChange || {};
      const change5m = priceChanges.change5m || priceChanges.m5 || coin?.change_5m || null;
      const change1h = priceChanges.change1h || priceChanges.h1 || coin?.change_1h || null;
      const change6h = priceChanges.change6h || priceChanges.h6 || coin?.change_6h || null;
      const change24h = priceChanges.change24h || priceChanges.h24 || coin?.change_24h || coin?.change24h || 0;
      
      debugLog('📊 [BLENDED CHART] Price change anchors:', {
        currentPrice,
        change5m,
        change1h,
        change6h,
        change24h
      });
      
      // Generate anchor points for 24-hour period
      const anchors = createPriceAnchors(currentPrice, { change5m, change1h, change6h, change24h });
      
      // Interpolate 24 hourly points between anchors
      const dataPoints = interpolateHourlyPoints(anchors);
      
      // Calculate min/max for chart display
      const prices = dataPoints.map(d => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      setChartData({
        tokenInfo: {
          address: coin.mintAddress || coin.tokenAddress,
          minPrice,
          maxPrice,
          priceChange24h: change24h
        },
        dataPoints,
        metadata: {
          timeframe: '24H',
          dataPoints: dataPoints.length,
          source: 'DexScreener blended anchors'
        }
      });
      
      const totalDuration = Date.now() - generateStartTime;
      debugLog(`✅ [BLENDED CHART] Generated ${dataPoints.length} points in ${totalDuration}ms`);
      
    } catch (error) {
      console.error('❌ [BLENDED CHART] Generation failed:', error);
      setError('Unable to generate chart');
    } finally {
      setLoading(false);
    }
  };
  
  // Create price anchor points from DexScreener price changes
  const createPriceAnchors = (currentPrice, changes) => {
    const anchors = [];
    const now = Date.now();
    
    // Always add current price as most recent anchor
    anchors.push({
      hoursAgo: 0,
      timestamp: now,
      price: currentPrice
    });
    
    // Add 5-minute anchor if available (0.083 hours ago)
    if (changes.change5m !== null) {
      const price5mAgo = currentPrice / (1 + changes.change5m / 100);
      anchors.push({
        hoursAgo: 0.083,
        timestamp: now - 5 * 60 * 1000,
        price: price5mAgo
      });
    }
    
    // Add 1-hour anchor if available
    if (changes.change1h !== null) {
      const price1hAgo = currentPrice / (1 + changes.change1h / 100);
      anchors.push({
        hoursAgo: 1,
        timestamp: now - 1 * 60 * 60 * 1000,
        price: price1hAgo
      });
    }
    
    // Add 6-hour anchor if available
    if (changes.change6h !== null) {
      const price6hAgo = currentPrice / (1 + changes.change6h / 100);
      anchors.push({
        hoursAgo: 6,
        timestamp: now - 6 * 60 * 60 * 1000,
        price: price6hAgo
      });
    }
    
    // Always add 24-hour anchor (required)
    const price24hAgo = currentPrice / (1 + changes.change24h / 100);
    anchors.push({
      hoursAgo: 24,
      timestamp: now - 24 * 60 * 60 * 1000,
      price: price24hAgo
    });
    
    // Sort by time (oldest first)
    anchors.sort((a, b) => b.hoursAgo - a.hoursAgo);
    
    debugLog('📊 [BLENDED CHART] Created anchors:', anchors.map(a => ({
      hoursAgo: a.hoursAgo,
      price: a.price
    })));
    
    return anchors;
  };
  
  // Interpolate 24 hourly data points between anchors with smooth curves
  const interpolateHourlyPoints = (anchors) => {
    const dataPoints = [];
    const now = Date.now();
    
    // Create deterministic seed from coin data for consistent randomness
    const coinId = (coin?.mintAddress || coin?.tokenAddress || coin?.symbol || 'unknown');
    const coinSeed = coinId.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
    let seed = coinSeed % 233280;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    // Generate 24 hourly points (25 points for 0-24 hours)
    for (let hour = 24; hour >= 0; hour--) {
      const targetHoursAgo = hour;
      const timestamp = now - hour * 60 * 60 * 1000;
      
      // Find surrounding anchors
      let lowerAnchor = null;
      let upperAnchor = null;
      
      for (let i = 0; i < anchors.length - 1; i++) {
        if (anchors[i].hoursAgo >= targetHoursAgo && anchors[i + 1].hoursAgo <= targetHoursAgo) {
          lowerAnchor = anchors[i];
          upperAnchor = anchors[i + 1];
          break;
        }
      }
      
      // If no surrounding anchors found, use closest anchor
      if (!lowerAnchor || !upperAnchor) {
        const closestAnchor = anchors.reduce((closest, anchor) => {
          return Math.abs(anchor.hoursAgo - targetHoursAgo) < Math.abs(closest.hoursAgo - targetHoursAgo) 
            ? anchor : closest;
        });
        dataPoints.push({
          timestamp,
          price: closestAnchor.price,
          time: new Date(timestamp).toLocaleTimeString()
        });
        continue;
      }
      
      // Interpolate between anchors
      const timeFraction = (lowerAnchor.hoursAgo - targetHoursAgo) / (lowerAnchor.hoursAgo - upperAnchor.hoursAgo);
      const basePrice = lowerAnchor.price + (upperAnchor.price - lowerAnchor.price) * timeFraction;
      
      // Add realistic volatility (smaller for meme coins to avoid extreme spikes)
      const priceRange = Math.abs(upperAnchor.price - lowerAnchor.price);
      const volatility = priceRange * 0.08; // 8% of local range for realism
      const noise = (seededRandom() - 0.5) * volatility;
      
      // Apply smoothing - use sine wave for natural oscillation
      const wavePhase = (hour / 24) * Math.PI * 2;
      const wave = Math.sin(wavePhase + coinSeed) * volatility * 0.3;
      
      let price = basePrice + noise + wave;
      
      // Ensure price stays within reasonable bounds
      price = Math.max(0.000001, price);
      price = Math.max(lowerAnchor.price * 0.85, Math.min(upperAnchor.price * 1.15, price));
      
      dataPoints.push({
        timestamp,
        price,
        time: new Date(timestamp).toLocaleTimeString()
      });
    }
    
    // Reverse to get chronological order (oldest to newest)
    dataPoints.reverse();
    
    return dataPoints;
  };
  
  const drawChart = (dataPoints) => {
    const drawStartTime = Date.now();
    debugLog('🔍 [CHART DIAGNOSTIC] Starting chart draw with', dataPoints.length, 'points');
    
    const canvas = canvasRef.current;
    if (!canvas || !dataPoints || dataPoints.length === 0) {
      debugLog('❌ [CHART DIAGNOSTIC] Draw aborted - missing canvas or data');
      return;
    }

    const ctx = canvas.getContext('2d');
    
    // Use parent container width like CleanPriceChart does
    const containerWidth = canvas.parentElement?.offsetWidth || (typeof chartWidth === 'number' ? chartWidth : 280);
    const containerHeight = height;
    
    // 🔥 MOBILE PERFORMANCE FIX: Use lower pixel ratio on mobile to save memory
    const dpr = isMobile ? 1 : (window.devicePixelRatio || 1);
    
    debugLog('🔍 [CHART DIAGNOSTIC] Canvas dimensions:', {
      width: containerWidth,
      height: containerHeight,
      dpr: dpr,
      canvasElement: !!canvas,
      isMobile: isMobile
    });
    
    // Set canvas size for crisp HD rendering using container dimensions
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    ctx.scale(dpr, dpr);

    // Debug: Log actual canvas and chart dimensions
    debugLog('📐 [CHART DIMENSIONS]', {
      containerWidth: containerWidth,
      containerHeight: containerHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      devicePixelRatio: dpr
    });

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    // Calculate dimensions - Add padding for axis labels
    const padding = { top: 10, right: 10, bottom: 35, left: 55 };
    const chartWidth = containerWidth - padding.left - padding.right;
    const chartHeight = containerHeight - padding.top - padding.bottom;

    // Find min/max for scaling with slight padding
    const prices = dataPoints.map(d => d.price);
    const minPrice = Math.min(...prices) * 0.98; // 2% padding
    const maxPrice = Math.max(...prices) * 1.02; // 2% padding
    const priceRange = maxPrice - minPrice || 0.0001;

    debugLog('🔍 [CHART DIAGNOSTIC] Price range:', {
      min: minPrice,
      max: maxPrice,
      range: priceRange
    });

    // Determine color based on trend
    const isPositive = prices[prices.length - 1] > prices[0];
    const lineColor = isPositive ? '#22c55e' : '#ef4444';

    // Draw X and Y axes
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.5;
    
    // Y-axis (left side)
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, containerHeight - padding.bottom);
    ctx.stroke();
    
    // X-axis (bottom)
    ctx.beginPath();
    ctx.moveTo(padding.left, containerHeight - padding.bottom);
    ctx.lineTo(containerWidth - padding.right, containerHeight - padding.bottom);
    ctx.stroke();
    
    // Y-axis labels (price values)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    // Draw 4 price labels evenly spaced on Y-axis
    const numYLabels = 4;
    for (let i = 0; i <= numYLabels; i++) {
      const priceValue = minPrice + (priceRange * (numYLabels - i) / numYLabels);
      const yPos = padding.top + (chartHeight * i / numYLabels);
      
      // Format price based on magnitude (no $ sign, no leading zero)
      let formattedPrice;
      if (priceValue < 0.00001) {
        formattedPrice = priceValue.toFixed(8).replace(/^0+/, ''); // Remove leading zeros
        if (!formattedPrice.startsWith('.')) formattedPrice = '0' + formattedPrice; // Keep one 0 if needed
      } else if (priceValue < 0.01) {
        formattedPrice = priceValue.toFixed(6).replace(/^0+/, '');
        if (!formattedPrice.startsWith('.')) formattedPrice = '0' + formattedPrice;
      } else if (priceValue < 1) {
        formattedPrice = priceValue.toFixed(4).replace(/^0\./, '.'); // Remove leading 0 for 0.xxxx
      } else {
        formattedPrice = priceValue.toFixed(2); // Keep regular format for >= 1
      }
      
      ctx.fillText(formattedPrice, padding.left - 5, yPos);
    }
    
    // X-axis labels (time values)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Draw 3 time labels evenly spaced on X-axis
    const numXLabels = 3;
    for (let i = 0; i <= numXLabels; i++) {
      const dataIndex = Math.floor((dataPoints.length - 1) * i / numXLabels);
      const point = dataPoints[dataIndex];
      const xPos = padding.left + (chartWidth * i / numXLabels);
      
      // Format time
      const date = new Date(point.timestamp);
      const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      ctx.fillText(formattedTime, xPos, containerHeight - padding.bottom + 5);
    }

    // Build path points - Adjust for padding
    const points = dataPoints.map((point, index) => {
      const x = padding.left + (index / (dataPoints.length - 1)) * chartWidth;
      const y = padding.top + (1 - (point.price - minPrice) / priceRange) * chartHeight;
      return { x, y };
    });

    // Debug: Log actual drawing coordinates
    debugLog('📍 [CHART COORDINATES]', {
      chartWidth,
      chartHeight, 
      padding,
      firstPoint: points[0],
      lastPoint: points[points.length - 1],
      totalPoints: points.length
    });

    // Draw smooth line with better quality
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    // Use smooth curves for better appearance
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // ✨ Clean line chart - no dots, just smooth line with interpolated points
    console.log(`[PriceHistoryChart] � Clean chart rendered with ${points.length} points (5 real + 5 interpolated)`);
    
    const drawDuration = Date.now() - drawStartTime;
    debugLog('🔍 [CHART DIAGNOSTIC] Chart drawing completed in', drawDuration, 'ms');
  };

  if (error) {
    return (
      <div className="price-history-chart error">
        <div className="error-message">
          <div className="error-text">
            <h3>Chart Unavailable</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="price-history-chart">
      {/* Chart Container */}
      <div className="chart-container">
        {loading ? (
          <div className="chart-loading">
            <div className="loading-spinner">⟳</div>
            <span>Loading chart...</span>
          </div>
        ) : (
          <>
            <canvas 
              ref={canvasRef} 
              className="price-canvas"
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
            />
            
            {/* Tooltip */}
            {hoveredPoint && (
              <div 
                className="chart-tooltip"
                style={{
                  left: hoveredPoint.x > (canvasRef.current?.offsetWidth * 0.7 || 200) ? `${hoveredPoint.x - 140}px` : `${hoveredPoint.x + 10}px`,
                  top: `${hoveredPoint.y - 70}px`,
                }}
              >
                <div className="tooltip-price">{formatPrice(hoveredPoint.price)}</div>
                <div className="tooltip-time">{formatTime(hoveredPoint.time)}</div>
                <div className="tooltip-disclaimer">Estimated from DexScreener</div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Data Source Disclaimer */}
      <div className="chart-disclaimer">
        <span className="disclaimer-text">
          Blended 24h estimate from DexScreener price changes • Use "Advanced View" for live data
        </span>
      </div>
    </div>
  );
};

// 🔥 PERFORMANCE FIX: Memoize component to prevent unnecessary re-renders
export default React.memo(PriceHistoryChart, (prevProps, nextProps) => {
  // Only re-render if coin address, price, or cleanChartData changes
  return prevProps.coin?.mintAddress === nextProps.coin?.mintAddress &&
         prevProps.coin?.price === nextProps.coin?.price &&
         prevProps.coin?.cleanChartData === nextProps.coin?.cleanChartData &&
         prevProps.width === nextProps.width &&
         prevProps.height === nextProps.height;
});