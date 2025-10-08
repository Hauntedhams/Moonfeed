import React, { useEffect, useRef, useState } from 'react';
import './PriceHistoryChart.css';

const PriceHistoryChart = ({ coin, width, height = 200 }) => {
  // Use parent container width - if width is "100%" or similar, use full container
  const chartWidth = width === "100%" ? "100%" : (width || 280);
  const canvasRef = useRef(null);
  const [chartData, setChartData] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1H'); // Start with 1H for faster loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null); // For tooltip
  const fetchingRef = useRef(false); // Prevent multiple simultaneous fetches
  
  // Diagnostic timing
  const mountTimeRef = useRef(Date.now());
  const lastFetchTimeRef = useRef(null);
  const drawTimeRef = useRef(null);

  const timeframes = ['1M', '15M', '1H', '4H', '24H'];

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

    // Find closest data point
    const containerWidth = canvas.parentElement?.offsetWidth || (typeof chartWidth === 'number' ? chartWidth : 280);
    const containerHeight = height;
    const padding = { top: 5, right: 0, bottom: 5, left: 0 };
    const chartWidthCalc = containerWidth;
    
    const pointIndex = Math.round((mouseX / chartWidthCalc) * (chartData.dataPoints.length - 1));
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

  // Diagnostic logging
  useEffect(() => {
    console.log('🔍 [CHART DIAGNOSTIC] Component mounted at:', new Date().toISOString());
    console.log('🔍 [CHART DIAGNOSTIC] Coin data:', {
      symbol: coin?.symbol,
      tokenAddress: coin?.tokenAddress,
      mintAddress: coin?.mintAddress,
      pairAddress: coin?.pairAddress,
      hasRequiredAddress: !!(coin?.tokenAddress || coin?.mintAddress || coin?.pairAddress)
    });
    
    return () => {
      const totalTime = Date.now() - mountTimeRef.current;
      console.log('🔍 [CHART DIAGNOSTIC] Component unmounted after', totalTime, 'ms');
    };
  }, []);

  // Map frontend timeframes to backend timeframes
  const getBackendTimeframe = (frontendTimeframe) => {
    const mapping = {
      '1M': '1m',
      '15M': '15m', 
      '1H': '1h',
      '4H': '4h',
      '24H': '24h'
    };
    return mapping[frontendTimeframe] || '1h';
  };

  useEffect(() => {
    console.log('🔍 [CHART DIAGNOSTIC] Dependency changed - coin or timeframe');
    console.log('🔍 [CHART DIAGNOSTIC] Current state:', {
      selectedTimeframe,
      hasTokenAddress: !!(coin?.tokenAddress || coin?.mintAddress || coin?.pairAddress),
      loading,
      alreadyFetching: fetchingRef.current
    });
    
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      console.log('🔍 [CHART DIAGNOSTIC] Skipping fetch - already in progress');
      return;
    }
    
    if (coin && (coin.tokenAddress || coin.mintAddress || coin.pairAddress)) {
      fetchChartData();
    } else {
      console.log('❌ [CHART DIAGNOSTIC] No valid token address found');
      setError('No token address available');
      setLoading(false);
    }
  }, [coin?.tokenAddress || coin?.mintAddress || coin?.pairAddress, selectedTimeframe]);

  // Draw chart immediately when data is ready
  useEffect(() => {
    console.log('🔍 [CHART DIAGNOSTIC] Chart data effect triggered:', {
      hasChartData: !!chartData,
      hasDataPoints: !!(chartData?.dataPoints),
      dataPointsLength: chartData?.dataPoints?.length || 0
    });
    
    if (chartData && chartData.dataPoints && chartData.dataPoints.length > 0) {
      drawTimeRef.current = Date.now();
      drawChart(chartData.dataPoints);
      const drawDuration = Date.now() - drawTimeRef.current;
      console.log('🔍 [CHART DIAGNOSTIC] Chart drawn in', drawDuration, 'ms');
    }
  }, [chartData]);

  const fetchChartData = async () => {
    if (fetchingRef.current) {
      console.log('🔍 [CHART DIAGNOSTIC] Fetch already in progress, skipping');
      return;
    }
    
    const fetchStartTime = Date.now();
    lastFetchTimeRef.current = fetchStartTime;
    fetchingRef.current = true;
    
    console.log('🔍 [CHART DIAGNOSTIC] Starting API fetch at:', new Date().toISOString());
    
    setLoading(true);
    setError(null);
    
    try {
      const tokenAddress = coin.tokenAddress || coin.mintAddress || coin.pairAddress;
      if (!tokenAddress) {
        throw new Error('No token address available');
      }
      
      const backendTimeframe = getBackendTimeframe(selectedTimeframe);
      const apiUrl = `http://localhost:3001/api/chart/${tokenAddress}?timeframe=${backendTimeframe}`;
      
      console.log('🔍 [CHART DIAGNOSTIC] Fetching from:', apiUrl);
      
      const response = await fetch(apiUrl);
      const fetchDuration = Date.now() - fetchStartTime;
      
      console.log('🔍 [CHART DIAGNOSTIC] API response received in', fetchDuration, 'ms');
      console.log('🔍 [CHART DIAGNOSTIC] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const parseDuration = Date.now() - fetchStartTime;
      
      console.log('🔍 [CHART DIAGNOSTIC] Data parsed in', parseDuration, 'ms');
      console.log('🔍 [CHART DIAGNOSTIC] API data:', {
        success: data.success,
        dataPointsCount: data.data?.dataPoints?.length || 0,
        tokenInfo: data.data?.tokenInfo
      });
      
      if (!data.success) {
        throw new Error(data.error || 'API error');
      }
      
      setChartData(data.data);
      
      const totalDuration = Date.now() - fetchStartTime;
      console.log('🔍 [CHART DIAGNOSTIC] Total fetch operation completed in', totalDuration, 'ms');
      
    } catch (error) {
      const errorDuration = Date.now() - fetchStartTime;
      console.error('❌ [CHART DIAGNOSTIC] Fetch failed after', errorDuration, 'ms:', error);
      setError('Chart temporarily unavailable');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const drawChart = (dataPoints) => {
    const drawStartTime = Date.now();
    console.log('🔍 [CHART DIAGNOSTIC] Starting chart draw with', dataPoints.length, 'points');
    
    const canvas = canvasRef.current;
    if (!canvas || !dataPoints || dataPoints.length === 0) {
      console.log('❌ [CHART DIAGNOSTIC] Draw aborted - missing canvas or data');
      return;
    }

    const ctx = canvas.getContext('2d');
    
    // Use parent container width like CleanPriceChart does
    const containerWidth = canvas.parentElement?.offsetWidth || (typeof chartWidth === 'number' ? chartWidth : 280);
    const containerHeight = height;
    
    // Use device pixel ratio for HD rendering
    const dpr = window.devicePixelRatio || 1;
    
    console.log('🔍 [CHART DIAGNOSTIC] Canvas dimensions:', {
      width: containerWidth,
      height: containerHeight,
      dpr: dpr,
      canvasElement: !!canvas
    });
    
    // Set canvas size for crisp HD rendering using container dimensions
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    ctx.scale(dpr, dpr);

    // Debug: Log actual canvas and chart dimensions
    console.log('📐 [CHART DIMENSIONS]', {
      containerWidth: containerWidth,
      containerHeight: containerHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      devicePixelRatio: dpr
    });

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    // Calculate dimensions - TRUE edge-to-edge, no padding at all
    const padding = { top: 5, right: 0, bottom: 5, left: 0 };
    const chartWidth = containerWidth; // Use full container width
    const chartHeight = containerHeight - padding.top - padding.bottom;

    // Find min/max for scaling with slight padding
    const prices = dataPoints.map(d => d.price);
    const minPrice = Math.min(...prices) * 0.98; // 2% padding
    const maxPrice = Math.max(...prices) * 1.02; // 2% padding
    const priceRange = maxPrice - minPrice || 0.0001;

    console.log('🔍 [CHART DIAGNOSTIC] Price range:', {
      min: minPrice,
      max: maxPrice,
      range: priceRange
    });

    // Determine color based on trend
    const isPositive = prices[prices.length - 1] > prices[0];
    const lineColor = isPositive ? '#22c55e' : '#ef4444';

    // Build path points - TRUE edge-to-edge positioning
    const points = dataPoints.map((point, index) => {
      const x = (index / (dataPoints.length - 1)) * chartWidth; // Start from 0, end at chartWidth
      const y = padding.top + (1 - (point.price - minPrice) / priceRange) * chartHeight;
      return { x, y };
    });

    // Debug: Log actual drawing coordinates
    console.log('📍 [CHART COORDINATES]', {
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
    
    const drawDuration = Date.now() - drawStartTime;
    console.log('🔍 [CHART DIAGNOSTIC] Chart drawing completed in', drawDuration, 'ms');
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
      {/* Timeframe Selector */}
      <div className="timeframe-selector">
        {timeframes.map((timeframe) => (
          <button
            key={timeframe}
            className={`timeframe-btn ${selectedTimeframe === timeframe ? 'active' : ''}`}
            onClick={() => setSelectedTimeframe(timeframe)}
            disabled={false}
          >
            {timeframe}
          </button>
        ))}
      </div>

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
                <div className="tooltip-disclaimer">Estimated Price Data</div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Data Source Disclaimer */}
      <div className="chart-disclaimer">
        <span className="disclaimer-text">
          📊 Historical price estimates • Use "Advanced View" for real-time data
        </span>
      </div>
    </div>
  );
};

export default PriceHistoryChart;