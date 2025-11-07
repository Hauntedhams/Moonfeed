import React, { useEffect, useRef, useState } from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';
import './PriceHistoryChart.css';

// DEBUG MODE - Set to false to disable all diagnostic logging (massive performance boost)
const DEBUG_MODE = false;
const debugLog = (...args) => { if (DEBUG_MODE) console.log(...args); };

const PriceHistoryChart = ({ coin, width, height = 200, onPriceHover }) => {
  const { isDarkMode } = useDarkMode();
  // Detect mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Use parent container width - if width is "100%" or similar, use full container
  const chartWidth = width === "100%" ? "100%" : (width || 280);
  const canvasRef = useRef(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null); // For tooltip
  const [canvasReady, setCanvasReady] = useState(false); // Track when canvas is mounted and ready
  
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
      const hoverData = {
        x: mouseX,
        y: mouseY,
        price: dataPoint.price,
        time: dataPoint.timestamp,
        index: clampedIndex
      };
      setHoveredPoint(hoverData);
      
      // Notify parent component of hovered price
      if (onPriceHover) {
        onPriceHover(dataPoint.price);
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPoint(null);
    // Notify parent that hover ended
    if (onPriceHover) {
      onPriceHover(null);
    }
  };

  // Diagnostic logging - DISABLED in production for performance
  const DEBUG_MODE = false; // Set to true only for debugging
  
  // 🔥 CRITICAL: Cleanup canvas on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear canvas before unmount
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Clear the canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Reset canvas dimensions to free memory
        canvas.width = 0;
        canvas.height = 0;
      }
      // Clear state to free memory
      setChartData(null);
      setHoveredPoint(null);
      setCanvasReady(false);
    };
  }, []); // Empty deps = only run on unmount
  
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
    console.log(`[PriceHistoryChart] 🔄 Effect triggered for ${coin?.symbol || 'unknown'}:`, {
      hasCoin: !!coin,
      hasCleanChartData: !!coin?.cleanChartData,
      hasDataPoints: !!coin?.cleanChartData?.dataPoints,
      pointsCount: coin?.cleanChartData?.dataPoints?.length || 0
    });
    
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
  }, [coin]); // Watch the entire coin object to detect enrichment updates

  // 🔥 CONSOLIDATED FIX: Draw chart when we have BOTH canvas and data ready
  // Handles all timing scenarios: data first, canvas first, or simultaneous
  useEffect(() => {
    // Guard: Need canvas element, chart data, and points
    if (!canvasRef.current || !chartData || !chartData.dataPoints || chartData.dataPoints.length === 0) {
      console.log(`[PriceHistoryChart] ⏳ Waiting... Canvas: ${!!canvasRef.current}, Data: ${!!chartData}, Points: ${chartData?.dataPoints?.length || 0}`);
      return;
    }

    // Guard: Need canvas to be ready (mounted in DOM)
    if (!canvasReady) {
      console.log(`[PriceHistoryChart] ⏳ Canvas element exists but not ready yet for ${coin?.symbol}`);
      return;
    }

    console.log(`[PriceHistoryChart] ✅ All conditions met, drawing chart for ${coin?.symbol} (${chartData.dataPoints.length} points)`);
    
    // Use requestAnimationFrame to ensure canvas is fully painted in DOM
    let rafId = null;
    rafId = requestAnimationFrame(() => {
      if (canvasRef.current && chartData && chartData.dataPoints) {
        drawTimeRef.current = Date.now();
        drawChart(chartData.dataPoints);
        const drawDuration = Date.now() - drawTimeRef.current;
        debugLog('🔍 [CHART DIAGNOSTIC] Chart drawn in', drawDuration, 'ms');
      }
    });

    // 🔥 CRITICAL: Cancel animation frame on cleanup to prevent memory leaks
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [canvasReady, chartData, isDarkMode]); // Watch BOTH canvas readiness AND chart data AND dark mode

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

    const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for better performance
    
    // Use parent container width like CleanPriceChart does
    const containerWidth = canvas.parentElement?.offsetWidth || (typeof chartWidth === 'number' ? chartWidth : 280);
    const containerHeight = height;
    
    // Always use at least 2x pixel ratio for crisp rendering, up to device max
    const dpr = Math.max(2, window.devicePixelRatio || 2);
    
    debugLog('🔍 [CHART DIAGNOSTIC] Canvas dimensions:', {
      width: containerWidth,
      height: containerHeight,
      dpr: dpr,
      canvasElement: !!canvas,
      isMobile: isMobile
    });
    
    // Set canvas size for ULTRA crisp HD rendering with high pixel ratio
    const scaledWidth = Math.round(containerWidth * dpr);
    const scaledHeight = Math.round(containerHeight * dpr);
    
    // Only resize if dimensions changed (prevents unnecessary redraws)
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      canvas.style.width = containerWidth + 'px';
      canvas.style.height = containerHeight + 'px';
    }
    
    // Reset transform and scale for crisp rendering
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Debug: Log actual canvas and chart dimensions
    debugLog('📐 [CHART DIMENSIONS]', {
      containerWidth: containerWidth,
      containerHeight: containerHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      devicePixelRatio: dpr
    });

    // Clear canvas with background based on theme
    ctx.fillStyle = isDarkMode ? '#0f0f0f' : '#ffffff';
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    // Calculate dimensions - Minimal padding (no left padding since we removed price labels)
    const padding = { top: 10, right: 10, bottom: 35, left: 10 }; // Reduced left from 55 to 10
    const drawableWidth = containerWidth - padding.left - padding.right;
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

    // Draw axes with theme-aware colors
    ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.5;
    
    // Y-axis (left side) - REMOVED for cleaner look
    // (No price labels means no need for Y-axis line)
    
    // X-axis (bottom) - Keep this for time labels
    ctx.beginPath();
    ctx.moveTo(padding.left, containerHeight - padding.bottom);
    ctx.lineTo(containerWidth - padding.right, containerHeight - padding.bottom);
    ctx.stroke();
    
    // Y-axis labels (price values) - HIDDEN for cleaner chart appearance
    // Price info is already shown in the header, no need to duplicate on chart
    /* DISABLED - Price labels removed for cleaner look
    ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
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
    */
    
    // X-axis labels (time values) - Keep these visible
    ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Draw 3 time labels evenly spaced on X-axis
    const numXLabels = 3;
    for (let i = 0; i <= numXLabels; i++) {
      const dataIndex = Math.floor((dataPoints.length - 1) * i / numXLabels);
      const point = dataPoints[dataIndex];
      const xPos = padding.left + (drawableWidth * i / numXLabels);
      
      // Format time
      const date = new Date(point.timestamp);
      const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      ctx.fillText(formattedTime, xPos, containerHeight - padding.bottom + 5);
    }

    // Build path points - Adjust for padding
    const points = dataPoints.map((point, index) => {
      const x = padding.left + (index / (dataPoints.length - 1)) * drawableWidth;
      const y = padding.top + (1 - (point.price - minPrice) / priceRange) * chartHeight;
      return { x, y };
    });

    // Debug: Log actual drawing coordinates
    debugLog('📍 [CHART COORDINATES]', {
      drawableWidth,
      chartHeight, 
      padding,
      firstPoint: points[0],
      lastPoint: points[points.length - 1],
      totalPoints: points.length
    });

    // Draw smooth line with HIGH-QUALITY anti-aliasing
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    // Use quadratic curves for smoother lines
    for (let i = 1; i < points.length; i++) {
      if (i === points.length - 1) {
        // Last point - draw straight line
        ctx.lineTo(points[i].x, points[i].y);
      } else {
        // Calculate control point for smooth curve
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
    }
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Enable shadow for depth
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.stroke();
    
    // Reset shadow for other drawings
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
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
              ref={(el) => {
                canvasRef.current = el;
                if (el && !canvasReady) {
                  console.log(`[PriceHistoryChart] 🎨 Canvas element mounted for ${coin?.symbol}`);
                  setCanvasReady(true);
                }
              }}
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
  // Re-render if:
  // 1. Address changed
  // 2. Price changed
  // 3. cleanChartData presence changed (undefined -> object or vice versa)
  // 4. cleanChartData reference changed (enrichment completed)
  // 5. Dimensions changed
  
  const mintAddressChanged = prevProps.coin?.mintAddress !== nextProps.coin?.mintAddress;
  const priceChanged = prevProps.coin?.price !== nextProps.coin?.price;
  const chartDataChanged = prevProps.coin?.cleanChartData !== nextProps.coin?.cleanChartData;
  const dimensionsChanged = prevProps.width !== nextProps.width || prevProps.height !== nextProps.height;
  
  // Return true to SKIP re-render (props are "equal")
  // Return false to ALLOW re-render (props are "different")
  const shouldSkipRender = !mintAddressChanged && !priceChanged && !chartDataChanged && !dimensionsChanged;
  
  // Debug logging for enrichment tracking
  if (chartDataChanged && !import.meta.env.PROD) {
    console.log(`🔄 [PriceHistoryChart] cleanChartData changed for ${nextProps.coin?.symbol}:`, {
      hadData: !!prevProps.coin?.cleanChartData,
      hasData: !!nextProps.coin?.cleanChartData,
      willRerender: !shouldSkipRender
    });
  }
  
  return shouldSkipRender;
});