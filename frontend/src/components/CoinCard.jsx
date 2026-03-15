import React, { memo, useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './CoinCard.css';
import TwelveDataChart from './TwelveDataChart';
import LiquidityLockIndicator from './LiquidityLockIndicator';
import TopTradersList from './TopTradersList';
import WalletPopup from './WalletPopup';
import { useLiveData } from '../hooks/useLiveDataContext.jsx';
import { useSolanaTransactions } from '../hooks/useSolanaTransactions.jsx';
import { useOnDemandPrice } from '../hooks/useOnDemandPrice.js';
import { useWallet } from '../contexts/WalletContext';
import { API_CONFIG } from '../config/api.js';
import { 
  calculateGraduationPercentage, 
  formatGraduationPercentage, 
  getGraduationStatus,
  getGraduationColor 
} from '../utils/graduationCalculator.js';
import debug from '../utils/debug.js';
import { rafManager, eventListenerManager, cleanupManager } from '../utils/mobileOptimizations.js';

// Simple time-ago formatter for transaction timestamps
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Compact number formatter for token amounts (e.g. 1234567 → "1.23M")
function formatCompactNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  if (num >= 1) return num.toFixed(1);
  return num.toFixed(4);
}

const CoinCard = memo(({ 
  coin, 
  isFavorite, 
  onFavoriteToggle, 
  onTradeClick, 
  isTrending,
  isGraduating = false, // NEW: Is this a graduating Pump.fun token?
  onExpandChange,
  isVisible = true,
  onEnrichmentComplete = null // Callback when enrichment completes
}) => {
  // Generate unique component ID for cleanup tracking
  const componentId = useRef(`coincard-${coin.mintAddress || coin.address || Math.random()}`).current;
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPriceChangeModal, setShowPriceChangeModal] = useState(false);
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const [showGraduationInfo, setShowGraduationInfo] = useState(false);
  const [graduationIconPosition, setGraduationIconPosition] = useState(null);
  const [priceFlash, setPriceFlash] = useState('');
  const [showLiveTransactions, setShowLiveTransactions] = useState(false);
  const [showTopTraders, setShowTopTraders] = useState(false); // Toggled via TikTok action button
  const [showComments, setShowComments] = useState(false); // TikTok-style comments bottom sheet
  const [comments, setComments] = useState([]); // Cached comments for count badge
  const [showActionButtons, setShowActionButtons] = useState(true); // TikTok action bar visible by default
  const [hasToggledActions, setHasToggledActions] = useState(false); // Track if user has toggled (avoids mount animation)
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [chartHoveredPrice, setChartHoveredPrice] = useState(null); // Track hovered price from chart
  const [chartHoveredData, setChartHoveredData] = useState(null); // Track full crosshair data (price + time)
  const [chartFirstPrice, setChartFirstPrice] = useState(null); // Track first visible price for % calculation
  const chartsContainerRef = useRef(null);
  const chartNavRef = useRef(null);
  const prevPriceRef = useRef(null);
  const graduationIconRef = useRef(null);
  const rightPanelRef = useRef(null); // Ref for the right panel (desktop chart target)
  const mobileChartTargetRef = useRef(null); // Ref for mobile chart target (portal destination)
  
  // Track desktop mode for responsive chart positioning
  const [isDesktopMode, setIsDesktopMode] = useState(() => window.innerWidth >= 1200);

  // Track if coin is enriched (has banner, socials, rugcheck, etc.)
  const isEnriched = !!(
    coin.enriched || 
    coin.banner || 
    coin.bannerImage || 
    coin.header || 
    coin.bannerUrl ||
    coin.website || 
    coin.twitter ||
    (coin.rugcheck && Object.keys(coin.rugcheck).length > 0)
  );

  // Removed: Debug-only useEffect for Age/Holders logging
  // This was causing unnecessary re-renders and console spam

  // 🔥 MOBILE PERFORMANCE FIX: Detect mobile and disable live data
  const isMobile = useRef(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)).current;

  // Get live data from WebSocket (COMPLETELY disabled on mobile for performance)
  // 🔥 CRITICAL FIX: Get coins Map directly from context to force re-renders when it updates
  const { getCoin, getChart, connected, connectionStatus, coins, updateCount } = useLiveData();
  const { walletAddress, connected: walletConnected } = useWallet();
  
  // 🔥 PRICE UPDATE FIX: Directly read from coins Map and use it to trigger re-renders
  const address = coin.mintAddress || coin.address;
  
  // 🔥 CRITICAL: Compute liveData directly from the coins Map
  // This makes the component reactive to Map changes
  const liveData = useMemo(() => {
    if (isMobile || !isVisible || !address) return null;
    const data = coins?.get(address) || null;
    
    return data;
  }, [isMobile, isVisible, address, coins, coin.symbol, updateCount]); // ← Added updateCount
  
  const chartData = useMemo(() => {
    if (isMobile || !isVisible || !address) return null;
    return getChart(address);
  }, [isMobile, isVisible, address, getChart]);
  
  // Mobile detection for other optimizations
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
  
  // Solana RPC live transactions - backend handles the heavy lifting now (works on mobile too)
  const mintAddress = coin.mintAddress || coin.mint || coin.address || coin.contract_address || coin.contractAddress || coin.tokenAddress;
  
  // 🔥 NEW: On-demand price fetching from Solana blockchain
  // Fetches price ONLY when coin is visible - no batch fetching!
  const { 
    price: onDemandPrice, 
    isLive: priceIsLive,
    priceChangePercent: instantChange 
  } = useOnDemandPrice(
    mintAddress,
    isVisible,
    coin.price_usd || coin.priceUsd || coin.price || 0
  );
  
  // 🔥 CRITICAL FIX: Use on-demand price as primary source, fallback to WebSocket/API
  const livePrice = liveData?.price;
  const fallbackPrice = coin.price_usd || coin.priceUsd || coin.price || 0;
  const displayPrice = onDemandPrice || livePrice || fallbackPrice;
  const { transactions, isConnected: txConnected, error: txError, clearTransactions } = useSolanaTransactions(
    mintAddress,
    showLiveTransactions // Only fetch when user explicitly opens the panel
  );

  // 🆕 ON-VIEW ENRICHMENT: Trigger enrichment when coin becomes visible
  const [enrichmentRequested, setEnrichmentRequested] = useState(false);
  const [enrichmentCompleted, setEnrichmentCompleted] = useState(false); // Track when enrichment finishes
  
  // 🆕 CRITICAL FIX: If coin is already enriched on load, mark enrichmentCompleted as true
  // This MUST come AFTER enrichmentCompleted state is declared
  useEffect(() => {
    if (isEnriched && !enrichmentCompleted) {
      debug.log(`📦 Coin ${coin.symbol} is pre-enriched, enabling chart auto-load`);
      setEnrichmentCompleted(true);
    }
  }, [isEnriched, enrichmentCompleted, coin.symbol]);
  
  useEffect(() => {
    // Only enrich if:
    // 1. Coin is visible
    // 2. Coin is NOT already enriched
    // 3. We haven't already requested enrichment for this coin
    if (isVisible && !isEnriched && !enrichmentRequested && mintAddress) {
      debug.log(`🎯 On-view enrichment triggered for ${coin.symbol || coin.name}`);
      setEnrichmentRequested(true);
      
      // Call backend enrichment API
      const enrichCoin = async () => {
        try {
          const apiUrl = `${API_CONFIG.COINS_API}/enrich-single`;
          debug.log(`🔄 Enriching ${coin.symbol} via ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              mintAddress,
              coin: coin 
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.coin) {
              debug.log(`✅ On-view enrichment complete for ${coin.symbol} in ${data.enrichmentTime}ms`);
              debug.log(`📊 Enriched coin data:`, {
                hasCleanChartData: !!data.coin.cleanChartData,
                hasRugcheck: !!data.coin.rugcheckScore || !!data.coin.liquidityLocked,
                hasBanner: !!data.coin.banner,
                phase: data.coin.phase // 'fast' or 'complete'
              });
              
              // 🆕 Mark enrichment as completed to trigger chart auto-load
              setEnrichmentCompleted(true);
              
              // Notify parent component of enrichment completion
              if (onEnrichmentComplete && typeof onEnrichmentComplete === 'function') {
                onEnrichmentComplete(mintAddress, data.coin);
              }
            } else {
              debug.warn(`⚠️ Enrichment returned success:false for ${coin.symbol}:`, data);
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            console.error(`❌ Enrichment API error for ${coin.symbol}:`, response.status, errorData);
          }
        } catch (error) {
          console.error(`❌ On-view enrichment failed for ${coin.symbol}:`, error.message);
        }
      };
      
      // 🚀 NO DEBOUNCE - Start enrichment immediately for fast loading
      enrichCoin();
    }
  }, [isVisible, isEnriched, enrichmentRequested, mintAddress, coin, onEnrichmentComplete]);

  // 📱 RESPONSIVE CHART FIX: Track window size for single responsive chart
  useEffect(() => {
    const handleResize = () => {
      const newIsDesktop = window.innerWidth >= 1200;
      if (newIsDesktop !== isDesktopMode) {
        setIsDesktopMode(newIsDesktop);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDesktopMode]);


  // Close transaction panel when coin becomes invisible
  useEffect(() => {
    if (!isVisible && showLiveTransactions) {
      debug.log(`🛑 Closing transactions for coin: ${coin.symbol || coin.name} (not visible)`);
      setShowLiveTransactions(false);
      if (clearTransactions) {
        clearTransactions();
      }
    }
    // Also close comments when not visible
    if (!isVisible && showComments) {
      setShowComments(false);
    }
  }, [isVisible, coin.symbol, coin.name]);

  // Fetch comment count when card is visible (lightweight — just the count)
  useEffect(() => {
    if (!isVisible || !mintAddress) return;
    const fetchCommentCount = async () => {
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/api/comments/${mintAddress}`);
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        }
      } catch (err) {
        // Silent fail — comment count is non-critical
      }
    };
    fetchCommentCount();
  }, [isVisible, mintAddress]);

  // Handle price flash animation (COMPLETELY DISABLED on mobile for performance)
  useEffect(() => {
    // 🔥 MOBILE PERFORMANCE FIX: Completely skip on mobile AND when not visible
    if (isMobile || !isVisible) return;
    
    const currentPrice = liveData?.price || coin.price_usd || coin.priceUsd || coin.price || 0;
    const prevPrice = prevPriceRef.current;
    
    let timer = null;
    
    if (prevPrice !== null && currentPrice !== prevPrice && currentPrice > 0) {
      if (currentPrice > prevPrice) {
        setPriceFlash('price-up');
      } else if (currentPrice < prevPrice) {
        setPriceFlash('price-down');
      }
      
      // Clear flash after animation
      timer = setTimeout(() => setPriceFlash(''), 600);
    }
    
    prevPriceRef.current = currentPrice;
    
    // Always return cleanup function
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [liveData?.price, coin.price_usd, coin.priceUsd, coin.price, isVisible, isMobile]);

  // Helpers
  const formatCompact = (num) => {
    const n = Number(num);
    if (!isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n/1_000).toFixed(1)}K`;
    return n.toFixed(abs < 1 ? 4 : 2);
  };

  const formatPrice = (v) => {
    const n = Number(v);
    if (!isFinite(n)) return '$0.00';
    
    // For very small numbers, use subscript notation (e.g., $0.0₃44097)
    if (Math.abs(n) > 0 && Math.abs(n) < 0.0001) {
      const str = n.toExponential();
      const [coefficient, exponent] = str.split('e');
      const exp = Math.abs(parseInt(exponent));
      
      // Get significant digits
      const cleanCoef = parseFloat(coefficient).toFixed(5).replace(/\.?0+$/, '');
      const significantDigits = cleanCoef.replace('.', '').substring(0, 5);
      
      // Convert exponent to subscript
      const subscriptMap = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
      const subscriptExp = (exp - 1).toString().split('').map(d => subscriptMap[d]).join('');
      
      return `$0.0${subscriptExp}${significantDigits}`;
    }
    
    if (Math.abs(n) < 0.01) return `$${n.toFixed(6)}`;
    if (Math.abs(n) < 1) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  };

  const formatPercent = (v) => {
    const n = Number(v);
    if (!isFinite(n)) return '0.00%';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  };

  // Helper function to format exact numbers for tooltips
  const formatExact = (num) => {
    const n = Number(num);
    if (!isFinite(n)) return '0';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  // Helper function to get tooltip content for metrics
  const getTooltipContent = (metric, value, coin) => {
    const exactValue = formatExact(value);
    
    switch (metric) {
      case 'marketCap':
        return {
          title: 'Market Capitalization',
          exact: `$${exactValue}`,
          description: 'The total value of all tokens in circulation. Calculated by multiplying the current price by the total supply.',
          example: `If ${coin.symbol || 'this token'} has ${formatCompact(coin.totalSupply || 1000000)} tokens and costs ${formatPrice(coin.price_usd || coin.priceUsd || coin.price || 0)} each, the market cap is ${formatPrice(coin.price_usd || coin.priceUsd || coin.price || 0)} × ${formatCompact(coin.totalSupply || 1000000)} = $${exactValue}`
        };
      case 'volume':
        // Build comprehensive price change information with proper HTML formatting
        let priceChangeInfo = '';
        
        // Get price change data - backend stores this at the root level as priceChange/priceChanges
        // The backend sets both priceChange (raw DexScreener format with m5, h1, h6, h24)
        // and priceChanges (same data, alternative field name)
        let changes = null;
        
        // Priority order: coin.priceChanges > coin.priceChange > coin.dexscreener?.priceChanges
        const rawPriceChange = coin.priceChanges || coin.priceChange || coin.dexscreener?.priceChanges;
        
        if (rawPriceChange) {
          // Check if it's in DexScreener format (m5, h1, h6, h24) or already converted
          if ('m5' in rawPriceChange || 'h1' in rawPriceChange || 'h6' in rawPriceChange || 'h24' in rawPriceChange) {
            // Convert from DexScreener format
            changes = {
              change5m: parseFloat(rawPriceChange.m5 || 0),
              change1h: parseFloat(rawPriceChange.h1 || 0),
              change6h: parseFloat(rawPriceChange.h6 || 0),
              change24h: parseFloat(rawPriceChange.h24 || 0)
            };
          } else if ('change5m' in rawPriceChange || 'change1h' in rawPriceChange || 'change6h' in rawPriceChange || 'change24h' in rawPriceChange) {
            // Already in converted format
            changes = rawPriceChange;
          }
        }
        
        // Debug logging to understand the data structure
        debug.log(`📊 Volume tooltip for ${coin.symbol}:`, {
          hasChanges: !!changes,
          changes: changes,
          rawPriceChange: rawPriceChange,
          enriched: coin.enriched,
          hasCleanChart: !!coin.cleanChartData
        });
        
        // Start the price changes section
        priceChangeInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; border-left: 3px solid #4F46E5;">';
        priceChangeInfo += '<div style="font-weight: 700; font-size: 0.85rem; color: #4F46E5; margin-bottom: 10px;">PRICE CHANGES</div>';
        
        // Simplified check: just check if changes object exists
        if (changes) {
          // Display all available price changes - show ALL that exist (including 0%)
          let hasAnyChange = false;
          
          // 5 minute change - show if property exists (even if 0)
          if ('change5m' in changes) {
            hasAnyChange = true;
            const change5m = Number(changes.change5m);
            const color5m = change5m >= 0 ? '#16a34a' : '#dc2626';
            const bgColor5m = change5m >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const arrow5m = change5m >= 0 ? '▲' : '▼';
            priceChangeInfo += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: ${bgColor5m}; border-radius: 6px; margin-bottom: 6px;">`;
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #64748b;">5 minutes:</span>`;
            priceChangeInfo += `<span style="font-size: 0.8rem; font-weight: 600; color: ${color5m};">${arrow5m} ${formatPercent(change5m)}</span>`;
            priceChangeInfo += '</div>';
          }
          
          // 1 hour change - show if property exists (even if 0)
          if ('change1h' in changes) {
            hasAnyChange = true;
            const change1h = Number(changes.change1h);
            const color1h = change1h >= 0 ? '#16a34a' : '#dc2626';
            const bgColor1h = change1h >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const arrow1h = change1h >= 0 ? '▲' : '▼';
            priceChangeInfo += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: ${bgColor1h}; border-radius: 6px; margin-bottom: 6px;">`;
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #64748b;">1 hour:</span>`;
            priceChangeInfo += `<span style="font-size: 0.8rem; font-weight: 600; color: ${color1h};">${arrow1h} ${formatPercent(change1h)}</span>`;
            priceChangeInfo += '</div>';
          }
          
          // 6 hour change - show if property exists (even if 0)
          if ('change6h' in changes) {
            hasAnyChange = true;
            const change6h = Number(changes.change6h);
            const color6h = change6h >= 0 ? '#16a34a' : '#dc2626';
            const bgColor6h = change6h >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const arrow6h = change6h >= 0 ? '▲' : '▼';
            priceChangeInfo += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: ${bgColor6h}; border-radius: 6px; margin-bottom: 6px;">`;
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #64748b;">6 hours:</span>`;
            priceChangeInfo += `<span style="font-size: 0.8rem; font-weight: 600; color: ${color6h};">${arrow6h} ${formatPercent(change6h)}</span>`;
            priceChangeInfo += '</div>';
          }
          
          // 24 hour change - show if property exists (even if 0)
          if ('change24h' in changes) {
            hasAnyChange = true;
            const change24h = Number(changes.change24h);
            const color24h = change24h >= 0 ? '#16a34a' : '#dc2626';
            const bgColor24h = change24h >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const arrow24h = change24h >= 0 ? '▲' : '▼';
            priceChangeInfo += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: ${bgColor24h}; border-radius: 6px; margin-bottom: 6px;">`;
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #64748b;">24 hours:</span>`;
            priceChangeInfo += `<span style="font-size: 0.8rem; font-weight: 600; color: ${color24h};">${arrow24h} ${formatPercent(change24h)}</span>`;
            priceChangeInfo += '</div>';
          }
          
          // If no price changes found, show a message
          if (!hasAnyChange) {
            priceChangeInfo += '<div style="padding: 8px; text-align: center; color: #94a3b8; font-size: 0.75rem;">Price change data loading...</div>';
          }
          
          // Buy/Sell transaction counts if available
          const buys = coin.dexscreener?.transactions?.buys24h || coin.buys24h || 0;
          const sells = coin.dexscreener?.transactions?.sells24h || coin.sells24h || 0;
          if (buys > 0 || sells > 0) {
            priceChangeInfo += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);">';
            priceChangeInfo += '<div style="font-weight: 600; font-size: 0.75rem; color: #334155; margin-bottom: 6px;">Transaction Activity</div>';
            priceChangeInfo += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #16a34a;">Buys: ${buys}</span>`;
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #dc2626;">Sells: ${sells}</span>`;
            priceChangeInfo += '</div>';
            const buyRatio = buys + sells > 0 ? ((buys / (buys + sells)) * 100).toFixed(1) : 0;
            const sentimentColor = buyRatio > 60 ? '#16a34a' : buyRatio < 40 ? '#dc2626' : '#ca8a04';
            const sentimentLabel = buyRatio > 60 ? 'Bullish' : buyRatio < 40 ? 'Bearish' : 'Neutral';
            priceChangeInfo += `<div style="font-size: 0.7rem; color: ${sentimentColor}; text-align: center; margin-top: 4px; font-weight: 600;">${sentimentLabel} (${buyRatio}% buys)</div>`;
            priceChangeInfo += '</div>';
          }
          
          priceChangeInfo += '<div style="font-size: 0.7rem; color: #64748b; margin-top: 8px; text-align: center;">Live price tracking</div>';
          priceChangeInfo += '</div>';
        } else {
          // Fallback: show at least the 24h change we have
          const change24h = coin.change_24h || coin.priceChange24h || coin.change24h || 0;
          if (change24h !== 0) {
            const color24h = change24h >= 0 ? '#16a34a' : '#dc2626';
            const bgColor24h = change24h >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const arrow24h = change24h >= 0 ? '▲' : '▼';
            priceChangeInfo += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: ${bgColor24h}; border-radius: 6px; margin-bottom: 6px;">`;
            priceChangeInfo += `<span style="font-size: 0.75rem; color: #64748b;">24 hours:</span>`;
            priceChangeInfo += `<span style="font-size: 0.8rem; font-weight: 600; color: ${color24h};">${arrow24h} ${formatPercent(change24h)}</span>`;
            priceChangeInfo += '</div>';
            // Only show "more timeframes available after enrichment" if coin is NOT yet enriched
            if (!coin.enriched && !coin.cleanChartData) {
              priceChangeInfo += '<div style="font-size: 0.7rem; color: #64748b; margin-top: 8px; text-align: center;">More timeframes available after enrichment</div>';
            }
          } else {
            priceChangeInfo += '<div style="padding: 16px; text-align: center;">';
            priceChangeInfo += '<div style="font-size: 0.8rem; color: #64748b;">Price change data will load shortly</div>';
            priceChangeInfo += '</div>';
          }
          priceChangeInfo += '</div>';
        }
        
        return {
          title: '24h Trading Volume',
          exact: `$${exactValue}`,
          description: 'The total dollar value of tokens traded in the last 24 hours. Higher volume indicates more activity and liquidity.',
          example: `$${exactValue} worth of ${coin.symbol || 'tokens'} have been bought and sold in the past 24 hours.${priceChangeInfo}`,
          isHtml: true
        };
      case 'liquidity':
        // Build comprehensive rugcheck security information with proper HTML formatting
        let rugcheckInfo = '';
        
        // � DEBUG: Log rugcheck data to see what we're working with
        if (coin.rugcheckVerified || coin.enriched) {
          console.log(`🔍 Rugcheck data for ${coin.symbol}:`, {
            rugcheckVerified: coin.rugcheckVerified,
            rugcheckProcessedAt: coin.rugcheckProcessedAt,
            liquidityLocked: coin.liquidityLocked,
            lockPercentage: coin.lockPercentage,
            burnPercentage: coin.burnPercentage,
            riskLevel: coin.riskLevel,
            rugcheckScore: coin.rugcheckScore,
            freezeAuthority: coin.freezeAuthority,
            mintAuthority: coin.mintAuthority,
            topHolderPercent: coin.topHolderPercent,
            isHoneypot: coin.isHoneypot,
            rugcheckError: coin.rugcheckError
          });
        }
        
        // 🔥 NEW LOGIC: Only consider rugcheck "attempted" if rugcheckProcessedAt exists
        // If rugcheck fails, backend won't set rugcheckProcessedAt, so it will retry on next view
        const rugcheckAttempted = coin.rugcheckProcessedAt;
        
        // Check if rugcheck is still pending (data not ready yet)
        const rugcheckPending = coin.rugcheckPending || coin.riskLevel === 'pending';
        
        // Check if we have ANY real rugcheck data (not pending status)
        const hasAnyRugcheckData = coin.rugcheckVerified || 
                                   coin.liquidityLocked !== null && coin.liquidityLocked !== undefined ||
                                   coin.rugcheckScore !== null && coin.rugcheckScore !== undefined ||
                                   (coin.riskLevel && coin.riskLevel !== 'pending' && coin.riskLevel !== 'unknown') || 
                                   coin.freezeAuthority !== null && coin.freezeAuthority !== undefined ||
                                   coin.mintAuthority !== null && coin.mintAuthority !== undefined;
        
        // Show "Loading" state if rugcheck is pending
        if (rugcheckPending && !hasAnyRugcheckData) {
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 3px solid #f97316; text-align: center;">';
          rugcheckInfo += '<div style="font-size: 0.8rem; color: #c2410c;">⏳ Security check in progress...</div>';
          rugcheckInfo += '<div style="font-size: 0.7rem; color: #ea580c; margin-top: 4px;">Rugcheck data loading (this may take a few seconds)</div>';
          rugcheckInfo += '</div>';
        } else if (coin.rugcheckVerified || hasAnyRugcheckData) {
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; border-left: 3px solid #4F46E5;">';
          rugcheckInfo += '<div style="font-weight: 700; font-size: 0.85rem; color: #4F46E5; margin-bottom: 10px;">🔐 SECURITY ANALYSIS</div>';
          
          // Liquidity Lock Status - ALWAYS show if rugcheckVerified (even if false)
          if (coin.liquidityLocked !== null && coin.liquidityLocked !== undefined) {
            if (coin.liquidityLocked) {
              rugcheckInfo += '<div style="margin-bottom: 10px; padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px;">';
              rugcheckInfo += '<div style="font-weight: 600; color: #16a34a; margin-bottom: 4px;">✅ Liquidity: LOCKED</div>';
              if (coin.lockPercentage > 0) {
                rugcheckInfo += `<div style="font-size: 0.75rem; color: #15803d; margin-left: 16px;">🔒 Locked: ${coin.lockPercentage}%</div>`;
              }
              if (coin.burnPercentage > 0) {
                rugcheckInfo += `<div style="font-size: 0.75rem; color: #15803d; margin-left: 16px;">🔥 Burned: ${coin.burnPercentage}%</div>`;
              }
              const totalSecured = Math.max(coin.lockPercentage || 0, coin.burnPercentage || 0);
              if (totalSecured > 0) {
                rugcheckInfo += `<div style="font-size: 0.75rem; font-weight: 600; color: #15803d; margin-left: 16px; margin-top: 4px;">🛡️ Total Secured: ${totalSecured}%</div>`;
              }
              rugcheckInfo += '</div>';
            } else {
              rugcheckInfo += '<div style="margin-bottom: 10px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">';
              rugcheckInfo += '<div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">⚠️ Liquidity: UNLOCKED</div>';
              rugcheckInfo += '<div style="font-size: 0.75rem; color: #b91c1c; margin-left: 16px;">⚡ Developers can remove liquidity anytime</div>';
              rugcheckInfo += '</div>';
            }
          }
          
          // Risk Assessment & Score - ALWAYS show if rugcheckVerified
          const riskSection = [];
          // Only show valid risk levels (not 'unknown' or 'pending')
          if (coin.riskLevel && coin.riskLevel !== 'unknown' && coin.riskLevel !== 'pending') {
            const riskEmoji = coin.riskLevel === 'low' ? '🟢' : 
                             coin.riskLevel === 'medium' ? '🟡' : '🔴';
            const riskColor = coin.riskLevel === 'low' ? '#16a34a' : 
                             coin.riskLevel === 'medium' ? '#ca8a04' : '#dc2626';
            riskSection.push(`<div style="font-weight: 600; color: ${riskColor}; margin-bottom: 4px;">${riskEmoji} Risk Level: ${coin.riskLevel.toUpperCase()}</div>`);
          }
          if (coin.rugcheckScore !== null && coin.rugcheckScore !== undefined) {
            const scoreEmoji = coin.rugcheckScore >= 1000 ? '🌟' :
                              coin.rugcheckScore >= 500 ? '⭐' : '⚡';
            const scoreColor = coin.rugcheckScore >= 1000 ? '#16a34a' :
                              coin.rugcheckScore >= 500 ? '#ca8a04' : '#dc2626';
            riskSection.push(`<div style="font-weight: 600; color: ${scoreColor};">${scoreEmoji} Score: ${coin.rugcheckScore}/5000</div>`);
          }
          if (riskSection.length > 0) {
            rugcheckInfo += '<div style="margin-bottom: 10px; padding: 8px; background: rgba(124, 58, 237, 0.05); border-radius: 6px;">';
            rugcheckInfo += riskSection.join('');
            rugcheckInfo += '</div>';
          }
          
          // Token Authorities
          if (coin.freezeAuthority !== undefined || coin.mintAuthority !== undefined) {
            rugcheckInfo += '<div style="margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.02); border-radius: 6px;">';
            rugcheckInfo += '<div style="font-weight: 600; color: #334155; margin-bottom: 6px;">🔑 Token Authorities</div>';
            if (coin.freezeAuthority !== undefined) {
              const freezeColor = coin.freezeAuthority ? '#dc2626' : '#16a34a';
              const freezeIcon = coin.freezeAuthority ? '❌' : '✅';
              rugcheckInfo += `<div style="font-size: 0.75rem; color: ${freezeColor}; margin-left: 16px; margin-bottom: 3px;">${freezeIcon} Freeze Authority: ${coin.freezeAuthority ? 'Active' : 'Revoked'}</div>`;
            }
            if (coin.mintAuthority !== undefined) {
              const mintColor = coin.mintAuthority ? '#dc2626' : '#16a34a';
              const mintIcon = coin.mintAuthority ? '❌' : '✅';
              rugcheckInfo += `<div style="font-size: 0.75rem; color: ${mintColor}; margin-left: 16px;">${mintIcon} Mint Authority: ${coin.mintAuthority ? 'Active' : 'Revoked'}</div>`;
            }
            rugcheckInfo += '</div>';
          }
          
          // Top Holder
          if (coin.topHolderPercent > 0) {
            const holderWarning = coin.topHolderPercent > 20 ? '⚠️' : 
                                 coin.topHolderPercent > 10 ? '⚡' : '✅';
            const holderColor = coin.topHolderPercent > 20 ? '#dc2626' : 
                               coin.topHolderPercent > 10 ? '#ca8a04' : '#16a34a';
            rugcheckInfo += '<div style="margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.02); border-radius: 6px;">';
            rugcheckInfo += `<div style="font-weight: 600; color: ${holderColor};">${holderWarning} Top Holder: ${coin.topHolderPercent.toFixed(1)}%</div>`;
            if (coin.topHolderPercent > 20) {
              rugcheckInfo += '<div style="font-size: 0.7rem; color: #b91c1c; margin-left: 16px; margin-top: 3px;">(High concentration risk)</div>';
            }
            rugcheckInfo += '</div>';
          }
          
          // Honeypot Warning (Critical)
          if (coin.isHoneypot) {
            rugcheckInfo += '<div style="margin-bottom: 10px; padding: 10px; background: rgba(239, 68, 68, 0.15); border-radius: 6px; border: 2px solid #dc2626;">';
            rugcheckInfo += '<div style="font-weight: 700; color: #dc2626; margin-bottom: 4px;">🚨 HONEYPOT DETECTED</div>';
            rugcheckInfo += '<div style="font-size: 0.7rem; color: #b91c1c; line-height: 1.4;">⛔ You may not be able to sell!<br/>⛔ DO NOT BUY - Likely a scam!</div>';
            rugcheckInfo += '</div>';
          }
          
          rugcheckInfo += '<div style="font-size: 0.7rem; color: #64748b; margin-top: 8px; text-align: center;">✅ Verified by Rugcheck API</div>';
          rugcheckInfo += '</div>';
          
        } else if (rugcheckAttempted && coin.rugcheckError) {
          // Rugcheck was attempted but failed with an error after retries
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(203, 213, 225, 0.2); border-radius: 8px; border-left: 3px solid #94a3b8; text-align: center;">';
          rugcheckInfo += '<div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">ℹ️ Security analysis incomplete</div>';
          rugcheckInfo += '<div style="font-size: 0.7rem; color: #94a3b8;">Check liquidity and other metrics carefully</div>';
          rugcheckInfo += '</div>';
        } else if (coin.rugcheckUnavailable) {
          // Rugcheck timed out or was unavailable (quick timeout reached)
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(203, 213, 225, 0.2); border-radius: 8px; border-left: 3px solid #94a3b8; text-align: center;">';
          rugcheckInfo += '<div style="font-size: 0.75rem; color: #64748b; margin-bottom: 4px;">ℹ️ Security check unavailable</div>';
          rugcheckInfo += '<div style="font-size: 0.7rem; color: #94a3b8;">Rugcheck API timeout - check other metrics</div>';
          rugcheckInfo += '</div>';
        } else if (coin.enriched && coin.rugcheckError && !rugcheckAttempted) {
          // Rugcheck failed but will retry (not marked as processed)
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 3px solid #f97316; text-align: center;">';
          rugcheckInfo += '<div style="font-size: 0.8rem; color: #c2410c;">⏳ Security check in progress...</div>';
          rugcheckInfo += '<div style="font-size: 0.7rem; color: #ea580c; margin-top: 4px;">Rugcheck API can take a few seconds</div>';
          rugcheckInfo += '</div>';
        } else if (!rugcheckAttempted && coin.enriched) {
          // Coin is enriched but rugcheck hasn't completed yet (still waiting for API response)
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 3px solid #f97316; text-align: center;">';
          rugcheckInfo += '<div style="font-size: 0.8rem; color: #c2410c;">⏳ Analyzing security data...</div>';
          rugcheckInfo += '<div style="font-size: 0.7rem; color: #ea580c; margin-top: 4px;">This may take a few seconds</div>';
          rugcheckInfo += '</div>';
        } else {
          // Rugcheck not yet attempted (coin not enriched yet)
          rugcheckInfo = '<div style="margin-top: 16px; padding: 12px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 3px solid #f97316; text-align: center;">';
          rugcheckInfo += '<div style="font-size: 0.8rem; color: #c2410c;">⏳ Security data loading...</div>';
          rugcheckInfo += '</div>';
        }
        
        return {
          title: 'Liquidity',
          exact: `$${exactValue}`,
          description: 'The amount of money available for trading. Higher liquidity means easier buying/selling with less price impact.',
          example: `There's $${exactValue} available in trading pools for ${coin.symbol || 'this token'}, making it ${value > 100000 ? 'relatively easy' : value > 10000 ? 'moderately easy' : 'potentially difficult'} to trade large amounts.${rugcheckInfo}`,
          isHtml: true
        };
      case 'holders':
        return {
          title: 'Token Holders',
          exact: exactValue,
          description: 'The number of unique wallets that own this token. More holders can indicate wider distribution and adoption.',
          example: `${exactValue} different wallets currently hold ${coin.symbol || 'this token'}`
        };
      case 'age':
        const hours = Number(value);
        const days = Math.floor(hours / 24);
        return {
          title: 'Token Age',
          exact: hours < 24 ? `${hours} hours` : `${days} days (${hours} hours)`,
          description: 'How long ago this token was created. Newer tokens are often riskier but may have more growth potential.',
          example: `${coin.symbol || 'This token'} was created ${hours < 24 ? `${hours} hours` : `${days} days`} ago${hours < 24 ? ' (very new!)' : days < 7 ? ' (relatively new)' : days < 30 ? ' (established)' : ' (mature)'}`
        };
      case 'fdv':
        return {
          title: 'Fully Diluted Valuation',
          exact: `$${exactValue}`,
          description: 'The theoretical market cap if all tokens were in circulation. Helps assess potential future dilution.',
          example: `If all ${coin.symbol || 'tokens'} were released today, the total value would be $${exactValue}`
        };
      case 'txns':
        return {
          title: '24h Transactions',
          exact: exactValue,
          description: 'Total number of buy and sell transactions in the last 24 hours. More transactions indicate active trading.',
          example: `${exactValue} separate trades happened with ${coin.symbol || 'this token'} in the past 24 hours`
        };
      case 'buySell':
        const percentage = Number(value);
        return {
          title: 'Buy/Sell Ratio',
          exact: `${percentage}% buys`,
          description: 'Percentage of recent transactions that were buys vs sells. Higher percentage indicates buying pressure.',
          example: `${percentage}% of recent trades were purchases, ${100 - percentage}% were sales${percentage > 60 ? ' (bullish sentiment)' : percentage < 40 ? ' (bearish sentiment)' : ' (neutral sentiment)'}`
        };
      case 'boosts':
        return {
          title: 'DexScreener Boosts',
          exact: exactValue,
          description: 'Paid promotions on DexScreener that increase visibility. More boosts indicate marketing investment.',
          example: `${exactValue} active promotional boost${Number(value) !== 1 ? 's' : ''} running for ${coin.symbol || 'this token'}`
        };
      default:
        return {
          title: 'Metric',
          exact: exactValue,
          description: 'Financial metric for this token.',
          example: 'Additional context not available.'
        };
    }
  };

  // Expand toggle
  const handleExpandToggle = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    // Additional prevention of any bubbling
    if (e?.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    
    const next = !isExpanded;
    setIsExpanded(next);
    
    // When expanding info → collapse action buttons; when collapsing → restore them
    setShowActionButtons(!next);
    setHasToggledActions(true); // Mark that user has interacted (enables animation)
    
    // Call parent's expand change handler which should lock scrolling
    onExpandChange?.(next);
  };

  // Handle chart price hover - update main price display
  const handleChartPriceHover = (hoveredPrice) => {
    setChartHoveredPrice(hoveredPrice);
  };
  // � INSTANT RESPONSE: Zero thresholds, zero detection, just pure scroll
  useEffect(() => {
    // 🔥 MOBILE PERFORMANCE: Only attach heavy event listeners when card is visible AND expanded
    if (!isVisible || !isExpanded) return;
    
    const navContainer = chartNavRef.current;
    const chartsContainer = chartsContainerRef.current;
    
    if (!navContainer || !chartsContainer) return;

    // Helper function for snap-to-page behavior
    const snapToNearestPage = () => {
      const chartWidth = chartsContainer.clientWidth;
      const currentScroll = chartsContainer.scrollLeft;
      const currentPage = Math.round(currentScroll / chartWidth);
      const targetScroll = currentPage * chartWidth;
      
      chartsContainer.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    };

    // Touch handling - Optimized for smooth mobile scrolling with RAF manager
    let touchStartX = 0;
    let touchStartScrollLeft = 0;
    let isTouch = false;
    const rafId = `${componentId}-touch`;

    const handleTouchStart = (e) => {
      isTouch = true;
      touchStartX = e.touches[0].clientX;
      touchStartScrollLeft = chartsContainer.scrollLeft;
      // Cancel any ongoing animation
      rafManager.cancel(rafId);
    };

    const handleTouchMove = (e) => {
      if (!isTouch) return;
      
      // Use RAF manager for smoother scrolling and automatic cleanup
      rafManager.request(() => {
        const deltaX = touchStartX - e.touches[0].clientX;
        const maxScrollLeft = chartsContainer.scrollWidth - chartsContainer.clientWidth;
        
        chartsContainer.scrollLeft = Math.max(0, Math.min(
          touchStartScrollLeft + deltaX,
          maxScrollLeft
        ));
      }, rafId);
      
      // Only prevent default for horizontal swipes to allow native scrolling feel
      const deltaX = Math.abs(touchStartX - e.touches[0].clientX);
      if (deltaX > 10) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchEnd = () => {
      if (!isTouch) return;
      isTouch = false;
      // Snap to page with smooth animation using RAF manager
      rafManager.request(() => {
        snapToNearestPage();
      }, `${rafId}-snap`);
    };

    // Mouse drag handling - Optimized with RAF manager
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    const dragRafId = `${componentId}-drag`;

    const handleMouseDown = (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartScrollLeft = chartsContainer.scrollLeft;
      navContainer.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      // Use RAF manager for smooth dragging and automatic cleanup
      rafManager.request(() => {
        const deltaX = dragStartX - e.clientX;
        const maxScrollLeft = chartsContainer.scrollWidth - chartsContainer.clientWidth;
        
        chartsContainer.scrollLeft = Math.max(0, Math.min(
          dragStartScrollLeft + deltaX,
          maxScrollLeft
        ));
      }, dragRafId);
      
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      navContainer.style.cursor = 'grab';
      // Snap to page with smooth animation using RAF manager
      rafManager.request(() => {
        snapToNearestPage();
      }, `${dragRafId}-snap`);
    };

    // Wheel/trackpad handling - clean and fast
    const handleWheel = (e) => {
      // Horizontal scroll (trackpad two-finger swipe left/right)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 1) {
        const maxScroll = chartsContainer.scrollWidth - chartsContainer.clientWidth;
        chartsContainer.scrollLeft = Math.max(0, Math.min(
          chartsContainer.scrollLeft + e.deltaX, 
          maxScroll
        ));
        e.preventDefault();
        e.stopPropagation();
      }
      // Shift+wheel for horizontal scroll
      else if (e.shiftKey && Math.abs(e.deltaY) > 1) {
        const maxScroll = chartsContainer.scrollWidth - chartsContainer.clientWidth;
        chartsContainer.scrollLeft = Math.max(0, Math.min(
          chartsContainer.scrollLeft + e.deltaY, 
          maxScroll
        ));
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Attach listeners using event listener manager for automatic cleanup tracking
    eventListenerManager.add(navContainer, 'touchstart', handleTouchStart, { passive: false }, componentId);
    eventListenerManager.add(navContainer, 'touchmove', handleTouchMove, { passive: false }, componentId);
    eventListenerManager.add(navContainer, 'touchend', handleTouchEnd, { passive: true }, componentId);
    eventListenerManager.add(navContainer, 'mousedown', handleMouseDown, undefined, componentId);
    eventListenerManager.add(navContainer, 'wheel', handleWheel, { passive: false }, componentId);
    eventListenerManager.add(document, 'mousemove', handleMouseMove, undefined, componentId);
    eventListenerManager.add(document, 'mouseup', handleMouseUp, undefined, componentId);

    return () => {
      // Clean up all RAF IDs for this component
      rafManager.cancel(rafId);
      rafManager.cancel(`${rafId}-snap`);
      rafManager.cancel(dragRafId);
      rafManager.cancel(`${dragRafId}-snap`);
      
      // Clean up all event listeners for this component
      eventListenerManager.remove(componentId);
    };
  }, [isVisible, isExpanded]);

  // Component cleanup on unmount - CRITICAL FOR MOBILE
  useEffect(() => {
    // Register cleanup function
    cleanupManager.register(componentId, () => {
      // Cancel all RAF for this component
      rafManager.cancel(`${componentId}-touch`);
      rafManager.cancel(`${componentId}-touch-snap`);
      rafManager.cancel(`${componentId}-drag`);
      rafManager.cancel(`${componentId}-drag-snap`);
      
      // Remove all event listeners
      eventListenerManager.remove(componentId);
    });

    return () => {
      // 🔥 MOBILE PERFORMANCE: Aggressive cleanup on unmount
      // Execute registered cleanup
      cleanupManager.cleanup(componentId);
      
      // Clear any remaining refs
      if (prevPriceRef.current !== null) {
        prevPriceRef.current = null;
      }
      
      // Reset ALL state to free memory
      setPriceFlash('');
      setShowBannerModal(false);
      setShowProfileModal(false);
      setShowPriceChangeModal(false);
      setShowLiveTransactions(false);
      setShowTopTraders(false);
      setShowActionButtons(true);
      setSelectedWallet(null);
      setShowDescriptionModal(false);
      setIsExpanded(false);
      
      // Clear transactions
      if (clearTransactions) {
        clearTransactions();
      }
      
      // Log cleanup for debugging (dev only)
      if (import.meta.env.DEV) {
        console.log(`🧹 CoinCard cleanup: ${coin.symbol}`);
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  // Banner modal handlers
  const handleBannerClick = (e) => {
    if (coin.banner || coin.bannerImage || coin.header || coin.bannerUrl) {
      e.stopPropagation(); // Prevent event bubbling
      setShowBannerModal(true);
    }
  };

  const closeBannerModal = () => {
    setShowBannerModal(false);
  };

  // Profile modal handlers
  const handleProfileClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (coin.profileImage) {
      setShowProfileModal(true);
    }
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
  };

  // Copy address to clipboard handler
  const handleCopyAddress = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check for various address field names used in the coin data
    const address = coin.mintAddress || coin.mint || coin.address || coin.contract_address || coin.contractAddress || coin.tokenAddress;
    
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      // Optional: Show a brief success indicator
      // You could add a toast notification here if you have one
    } catch (err) {
      // Fallback method for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = address;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
    }
  };

  // Handle crosshair move from chart
  // 🔥 CRITICAL: Use useCallback to prevent stale closures
  const handleChartCrosshairMove = React.useCallback((data) => {
    // 🔥 ALWAYS LOG to debug - we need to see if this is being called
    console.log(`📊 [${coin.symbol}] Chart crosshair callback:`, data);
    
    if (data && data.price) {
      setChartHoveredData(data);
      setChartHoveredPrice(data.price);
      console.log(`✅ [${coin.symbol}] Set hovered price to: $${data.price.toFixed(8)}`);
    } else {
      // Restore live price
      setChartHoveredData(null);
      setChartHoveredPrice(null);
      console.log(`🔄 [${coin.symbol}] Cleared hovered price, back to live`);
    }
  }, [coin.symbol]); // Only recreate if coin symbol changes

  // Handle first visible price update from chart (for % calculation)
  const handleFirstPriceUpdate = React.useCallback((price) => {
    setChartFirstPrice(price);
  }, []);

  // Use live data when available, fallback to coin data
  // 🔥 CRITICAL FIX: Use displayPrice computed from useMemo which is reactive to coins Map
  // 🎯 CHART HOVER: Use chartHoveredPrice when hovering over chart (takes priority over everything)
  const price = chartHoveredPrice !== null ? chartHoveredPrice : displayPrice;
  
  // 🔥 DEBUG: Log price calculation to see what's happening
  if (import.meta.env.DEV && chartHoveredPrice !== null) {
    console.log(`📊 [${coin.symbol}] PRICE CALC:`, {
      chartHoveredPrice,
      displayPrice,
      finalPrice: price,
      usingHoveredPrice: chartHoveredPrice !== null
    });
  }
  
  // 🎯 NEW: Calculate percentage change dynamically when hovering over chart
  // If hovering, calculate % from first visible price to hovered price
  // Otherwise, use the live 24h change
  const changePct = chartHoveredData && chartFirstPrice 
    ? ((chartHoveredPrice - chartFirstPrice) / chartFirstPrice) * 100
    : (liveData?.change24h ?? coin.change_24h ?? coin.priceChange24h ?? coin.change24h ?? 0);
  const marketCap = liveData?.marketCap ?? coin.market_cap_usd ?? coin.market_cap ?? coin.marketCap ?? 0;
  const volume24h = liveData?.volume24h ?? coin.volume_24h_usd ?? coin.volume_24h ?? coin.volume24h ?? 0;
  const liquidity = liveData?.liquidity ?? coin.liquidity_usd ?? coin.liquidity ?? coin.liquidityUsd ?? 0;
  const holders = liveData?.holders ?? coin.holders ?? coin.holderCount ?? coin.holder_count ?? coin.dexscreener?.holders ?? 0;
  
  // 🔍 DEBUG: Specific coin debugging (disabled in production)
  if (import.meta.env.DEV && coin.mintAddress === 'BwbZ992sMqabbBYnEj4tfNBmtdYtjRkSqgAGCyCRpump') {
    debug.log('🔍 DEBUG - Coin Data for BwbZ992s...:', {
      symbol: coin.symbol,
      name: coin.name,
      mintAddress: coin.mintAddress,
      holders_data: {
        'liveData.holders': liveData?.holders,
        'coin.holders': coin.holders,
        'coin.holderCount': coin.holderCount,
        'coin.holder_count': coin.holder_count,
        'coin.dexscreener.holders': coin.dexscreener?.holders,
        'FINAL holders': holders
      },
      age_data: {
        'liveData.ageHours': liveData?.ageHours,
        'coin.ageHours': coin.ageHours,
        'coin.age': coin.age,
        'coin.created_timestamp': coin.created_timestamp,
        'coin.createdAt': coin.createdAt,
        'coin.dexscreener.pairCreatedAt': coin.dexscreener?.pairCreatedAt
      },
      full_coin_object: coin,
      full_liveData: liveData
    });
  }
  
  // Enhanced metrics from DexScreener with live data fallback
  const fdv = liveData?.fdv ?? coin.fdv ?? coin.fullyDilutedValuation ?? 0;
  const volume1h = liveData?.volume1h ?? coin.volume1h ?? coin.dexscreener?.volumes?.volume1h ?? 0;
  const volume6h = liveData?.volume6h ?? coin.volume6h ?? coin.dexscreener?.volumes?.volume6h ?? 0;
  const buys24h = liveData?.buys24h ?? coin.buys24h ?? coin.dexscreener?.transactions?.buys24h ?? 0;
  const sells24h = liveData?.sells24h ?? coin.sells24h ?? coin.dexscreener?.transactions?.sells24h ?? 0;
  const totalTxns24h = liveData?.totalTransactions ?? coin.totalTransactions ?? (buys24h + sells24h) ?? 0;
  
  // Calculate age from created_timestamp if available
  const calculateAgeHours = () => {
    if (liveData?.ageHours) return liveData.ageHours;
    if (coin.ageHours) return coin.ageHours;
    if (coin.age) return coin.age;
    if (coin.created_timestamp) {
      const ageMs = Date.now() - coin.created_timestamp;
      return Math.floor(ageMs / (1000 * 60 * 60)); // Convert to hours
    }
    if (coin.dexscreener?.poolInfo?.ageHours) return coin.dexscreener.poolInfo.ageHours;
    return 0;
  };
  
  const ageHours = calculateAgeHours();
  const boosts = liveData?.boosts ?? coin.boosts ?? coin.dexscreener?.boosts ?? 0;

  // 🎓 GRADUATING TOKENS: Calculate live graduation percentage
  let graduationPercentage = null;
  let graduationStatus = null;
  let graduationColor = null;
  
  if (isGraduating || coin.status === 'graduating' || coin.isPumpFun) {
    // Try to get live baseBalance from liveData or coin data
    const baseBalance = liveData?.baseBalance ?? coin.baseBalance ?? 0;
    
    if (baseBalance > 0) {
      // Calculate live graduation percentage
      graduationPercentage = calculateGraduationPercentage(baseBalance);
      graduationStatus = getGraduationStatus(graduationPercentage);
      graduationColor = getGraduationColor(graduationPercentage);
    } else if (coin.bondingCurveProgress) {
      // Fallback to static bonding curve progress from backend
      graduationPercentage = parseFloat(coin.bondingCurveProgress);
      graduationStatus = getGraduationStatus(graduationPercentage);
      graduationColor = getGraduationColor(graduationPercentage);
    }
  }

  // Debug log for social links - DISABLED to prevent console spam
  // if ((coin.socialLinks || coin.twitter || coin.telegram || coin.website) && Math.random() < 0.05) {
  //   console.log(`🔗 Social data available for ${coin.symbol}:`, { ... });
  // }

  // 🔍 PRODUCTION DEBUG: Log when CoinCard renders (only first coin to avoid spam)
  if (typeof window !== 'undefined' && !window.__COINCARD_RENDER_LOGGED__) {
    console.log('🎴 CoinCard RENDER:', {
      symbol: coin.symbol,
      name: coin.name,
      hasBanner: !!(coin.banner || coin.bannerImage || coin.header || coin.bannerUrl),
      hasProfileImage: !!(coin.profileImage || coin.image || coin.logo),
      isVisible,
      isExpanded,
      mintAddress: coin.mintAddress?.slice(0, 10) + '...'
    });
    window.__COINCARD_RENDER_LOGGED__ = true;
  }

  return (
    <div className="coin-card">
      {/* Desktop Split-Screen Layout */}
      {/* Left Panel - Coin Card Content */}
      <div className="coin-card-left-panel">
        {/* Connection status overlay */}
        {!connected && (
          <div className="connection-status-overlay" title="Disconnected from live data">
            <div className="connection-status-badge">⚠️ Offline</div>
          </div>
        )}
        
        {/* Enrichment status badge */}
        {!isEnriched && (
          <div className="enrichment-status-badge"
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 100,
              background: 'rgba(255, 165, 0, 0.9)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backdropFilter: 'blur(10px)',
              animation: 'pulse 2s ease-in-out infinite'
            }}
            title="Loading full coin data..."
          >
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%',
              background: 'currentColor',
              animation: 'blink 1s ease-in-out infinite'
            }}></span>
            Loading...
          </div>
        )}
        
        {/* Enhanced Banner with DexScreener support */}
        <div className="coin-banner" onClick={handleBannerClick} style={{ cursor: coin.banner || coin.bannerImage || coin.header || coin.bannerUrl ? 'pointer' : 'default' }}>
        {(() => {
          // 🐮 Hardcoded banner for $MOO token
          const MOO_ADDRESS = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';
          const isMooToken = coin.mintAddress === MOO_ADDRESS || coin.address === MOO_ADDRESS;
          const bannerUrl = isMooToken 
            ? '/assets/moonfeed banner.png' 
            : (coin.banner || coin.bannerImage || coin.header || coin.bannerUrl);
          
          return bannerUrl ? (
            <img 
              src={bannerUrl}
              alt={coin.name || 'Token banner'}
              loading="lazy"
              decoding="async"
              onError={(e) => { 
                // Image error logging (dev only)
                debug.log(`Banner image failed to load for ${coin.symbol}:`, e.currentTarget.src);
                e.currentTarget.style.display = 'none'; 
              }}
              onLoad={() => {
                // Image load logging (dev only)
                debug.log(`✅ Banner loaded successfully for ${coin.symbol}${isMooToken ? ' (custom $MOO banner)' : ''}`);
              }}
            />
          ) : (
            <div className="banner-placeholder">
              <div className="banner-placeholder-text">
                {coin.name || 'Meme coin discovery'}
              </div>
            </div>
          );
        })()}
        
        {/* Banner Text Overlay */}
        <div className="banner-text-overlay">
          <div className="banner-coin-info">
            <h2 
              className="banner-coin-name clickable-name" 
              onClick={handleCopyAddress}
              title={`Click to copy address: ${coin.mintAddress || coin.mint || coin.address || coin.contract_address || coin.contractAddress || coin.tokenAddress || 'No address available'}`}
            >
              {coin.name || 'Unknown Token'}
            </h2>
            <div className="banner-symbol-row">
              <p className="banner-coin-symbol">
                ${coin.symbol || coin.ticker || 'N/A'}
              </p>
              {coin.description && (
                <>
                  <span className="banner-coin-description-inline">
                    {coin.description}
                  </span>
                  {coin.description.length > 50 && (
                    <button 
                      className="read-more-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDescriptionModal(true);
                      }}
                      title="Read more"
                    >
                      read more
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Layer */}
      <div className={`coin-info-layer ${isExpanded ? 'expanded' : ''}`}>
        {/* Desktop-only: Coin name, symbol, and description at top */}
        <div className="desktop-coin-header">
          <h2 
            className="banner-coin-name clickable-name" 
            onClick={handleCopyAddress}
            title={`Click to copy address: ${coin.mintAddress || coin.mint || coin.address || coin.contract_address || coin.contractAddress || coin.tokenAddress || 'No address available'}`}
          >
            {coin.name || 'Unknown Token'}
          </h2>
          <div className="desktop-symbol-row">
            <p className="banner-coin-symbol">
              ${coin.symbol || coin.ticker || 'N/A'}
            </p>
            {coin.description && (
              <>
                <span className="banner-coin-description-inline desktop-description">
                  {coin.description}
                </span>
                {coin.description.length > 50 && (
                  <button 
                    className="read-more-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDescriptionModal(true);
                    }}
                    title="Read more"
                  >
                    read more
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="info-layer-header">
          {/* Top row: Profile, Price with Social Links, Expand Arrow */}
          <div className="header-top-row">
            <div className="header-left">
              <div 
                className="info-layer-profile-image" 
                onClick={handleProfileClick}
                style={{ cursor: coin.profileImage ? 'pointer' : 'default' }}
              >
                {coin.profileImage ? (
                  <img
                    src={coin.profileImage}
                    alt={coin.name || 'Token logo'}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.src = '/profile-placeholder.png'; }}
                  />
                ) : (
                  <div className="info-layer-profile-placeholder">{coin.name?.charAt(0) || 'M'}</div>
                )}
              </div>
              
              <div className="price-and-social-section">
                <div className="price-section">
                  <div className={`coin-price ${priceFlash}`}>
                    {/* Live indicators - only show when not hovering over chart */}
                    <div className="live-indicators">
                      {!chartHoveredData && (
                        <>
                          <div className={`live-indicator ${connected ? 'connected' : 'disconnected'}`} 
                               title={connected ? 'Connected to live data' : 'Disconnected from live data'}>
                            <div className="live-dot"></div>
                          </div>
                          {liveData?.jupiterLive && (
                            <div className="jupiter-live-indicator" 
                                 title="Live Jupiter pricing active">
                              🪐
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {formatPrice(price)}
                  </div>
                  <div 
                    className={`price-change ${Number(changePct) >= 0 ? 'positive' : 'negative'} clickable`}
                    onClick={() => setShowPriceChangeModal(true)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view price change history"
                  >
                    {formatPercent(changePct)}
                  </div>
                </div>
                
                {/* Social icons directly under price */}
                <div className="header-social-icons">
                  {(coin.socialLinks?.twitter || coin.twitter) && (
                    <a 
                      href={coin.socialLinks?.twitter || coin.twitter} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="header-social-icon twitter-icon" 
                      aria-label="Twitter/X"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>
                  )}
                  {(coin.socialLinks?.telegram || coin.telegram) && (
                    <a 
                      href={coin.socialLinks?.telegram || coin.telegram} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="header-social-icon telegram-icon" 
                      aria-label="Telegram"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0.02.27.02.39z"/>
                      </svg>
                    </a>
                  )}
                  {(coin.socialLinks?.discord || coin.discord) && (
                    <a 
                      href={coin.socialLinks?.discord || coin.discord} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="header-social-icon discord-icon" 
                      aria-label="Discord"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                    </a>
                  )}
                  {(coin.socialLinks?.tiktok || coin.tiktok) && (
                    <a 
                      href={coin.socialLinks?.tiktok || coin.tiktok} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="header-social-icon tiktok-icon" 
                      aria-label="TikTok"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </a>
                  )}
                  {(coin.socialLinks?.website || coin.website || coin.info?.website) && (
                    <a 
                      href={coin.socialLinks?.website || coin.website || coin.info?.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="header-social-icon website-icon" 
                      aria-label="Website"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                    </a>
                  )}
                  <button 
                    className={`banner-follow-button ${isFavorite ? 'following' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFavoriteToggle?.();
                    }}
                    title={isFavorite ? 'Click to unfollow' : 'Click to follow'}
                  >
                    {isFavorite ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            </div>

            <div className="header-right">
              <div 
                className={`expand-handle ${hasToggledActions ? (!showActionButtons ? 'absorbing' : 'releasing') : ''}`}
                onClick={handleExpandToggle}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                style={{ 
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none'
                }}
                aria-label="Expand coin details"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleExpandToggle(e);
                  }
                }}
              />
            </div>
          </div>

          {/* Bottom row: Full-width Metrics Grid */}
          <div className="header-metrics-row">
            <div className="header-metrics-grid">
              {/* Core metrics in priority order */}
              <div 
                className="header-metric"
                onMouseEnter={() => setHoveredMetric({ type: 'marketCap', value: marketCap, element: 'marketCap' })}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                <div className="header-metric-label">Market Cap</div>
                <div className="header-metric-value">${formatCompact(marketCap)}</div>
              </div>
              <div 
                className="header-metric"
                onMouseEnter={() => setHoveredMetric({ type: 'volume', value: volume24h, element: 'volume' })}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                <div className="header-metric-label">Volume</div>
                <div className="header-metric-value">${formatCompact(volume24h)}</div>
              </div>
              <div 
                className="header-metric"
                onMouseEnter={() => setHoveredMetric({ type: 'liquidity', value: liquidity, element: 'liquidity' })}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                <div className="header-metric-label">Liquidity</div>
                <div className="header-metric-value-with-icon">
                  <span>${formatCompact(liquidity)}</span>
                  {/* Show red flag if rugcheck verified and liquidity is unlocked */}
                  {coin.rugcheckVerified && !coin.liquidityLocked ? (
                    <span style={{ 
                      marginLeft: '4px', 
                      fontSize: '14px',
                      color: '#ef4444',
                      lineHeight: 1
                    }}>🚩</span>
                  ) : (
                    <LiquidityLockIndicator coin={coin} size="small" />
                  )}
                </div>
              </div>
              <div 
                className="header-metric"
                onMouseEnter={() => setHoveredMetric({ type: 'age', value: ageHours, element: 'age' })}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                <div className="header-metric-label">Age</div>
                <div className="header-metric-value">
                  {ageHours > 0 ? (ageHours < 24 ? `${ageHours}h` : `${Math.floor(ageHours / 24)}d`) : '-'}
                </div>
              </div>
              <div 
                className="header-metric"
                onMouseEnter={() => setHoveredMetric({ type: 'holders', value: holders, element: 'holders' })}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                <div className="header-metric-label">Holders</div>
                <div className="header-metric-value">{holders > 0 ? formatCompact(holders) : '-'}</div>
              </div>
              {/* Additional metrics when available */}
              {fdv > 0 && (
                <div 
                  className="header-metric"
                  onMouseEnter={() => setHoveredMetric({ type: 'fdv', value: fdv, element: 'fdv' })}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="header-metric-label">FDV</div>
                  <div className="header-metric-value">${formatCompact(fdv)}</div>
                </div>
              )}
              {totalTxns24h > 0 && (
                <div 
                  className="header-metric"
                  onMouseEnter={() => setHoveredMetric({ type: 'txns', value: totalTxns24h, element: 'txns' })}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="header-metric-label">Txns</div>
                  <div className="header-metric-value">{formatCompact(totalTxns24h)}</div>
                </div>
              )}
              {buys24h > 0 && sells24h > 0 && (
                <div 
                  className="header-metric"
                  onMouseEnter={() => setHoveredMetric({ type: 'buySell', value: ((buys24h / (buys24h + sells24h)) * 100).toFixed(0), element: 'buySell' })}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="header-metric-label">Buy/Sell</div>
                  <div className="header-metric-value">
                    {((buys24h / (buys24h + sells24h)) * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              {boosts > 0 && (
                <div 
                  className="header-metric"
                  onMouseEnter={() => setHoveredMetric({ type: 'boosts', value: boosts, element: 'boosts' })}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="header-metric-label">Boosts</div>
                  <div className="header-metric-value" style={{color: '#ff6b35'}}>{boosts}</div>
                </div>
              )}
              
              {/* Tooltip - Rendered via Portal to escape stacking contexts */}
              {hoveredMetric && createPortal(
                <div className="metric-tooltip">
                  {(() => {
                    const tooltipData = getTooltipContent(hoveredMetric.type, hoveredMetric.value, coin);
                    return (
                      <>
                        <div className="tooltip-title">{tooltipData.title}</div>
                        <div className="tooltip-exact">{tooltipData.exact}</div>
                        <div className="tooltip-description">{tooltipData.description}</div>
                        {tooltipData.isHtml ? (
                          <div className="tooltip-example" dangerouslySetInnerHTML={{ __html: tooltipData.example }} />
                        ) : (
                          <div className="tooltip-example">{tooltipData.example}</div>
                        )}
                      </>
                    );
                  })()}
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

        <div className="info-layer-content">
          {/* Price Charts - Mobile chart portal target */}
          <div className="charts-section">
            {/* Mobile chart renders here via portal */}
            <div className="twelve-chart-section mobile-chart-target" ref={mobileChartTargetRef}>
              {/* Chart portals here on mobile */}
            </div>
          </div> {/* Close charts-section */}

          {/* Live Transactions Section */}
          <div className="transactions-section">
            <div className="transactions-section-header">
              Transactions
            </div>
            {!showLiveTransactions ? (
              <div className="load-transactions-wrapper">
                <button 
                    className="load-live-transactions-btn"
                    onClick={() => setShowLiveTransactions(true)}
                  >
                    Load Live Transactions
                  </button>
                </div>
            ) : (
              <div className="live-transactions-content">
                  {txError && (
                    <div className="tx-error">
                      {txError}
                    </div>
                  )}

                  {/* Transaction table header */}
                  <div className="tx-table-header" style={{
                    display: 'grid',
                    gridTemplateColumns: '42px 52px 1fr 72px 72px 38px',
                    gap: '4px',
                    padding: '6px 10px',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <span>Type</span>
                    <span>DEX</span>
                    <span>Wallet</span>
                    <span style={{ textAlign: 'right' }}>SOL</span>
                    <span style={{ textAlign: 'right' }}>Tokens</span>
                    <span style={{ textAlign: 'right' }}>Time</span>
                  </div>

                  <div className="transactions-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {transactions.length === 0 ? (
                      <div className="transactions-empty">
                        <div className="empty-text">Waiting for transactions...</div>
                        <div className="empty-subtext">
                          {txConnected ? '🟢 Live monitoring active' : '⏳ Connecting...'}
                        </div>
                      </div>
                    ) : (
                      transactions.map((tx, index) => {
                        const isBuy = tx.side === 'buy';
                        const sideColor = isBuy ? '#4CAF50' : '#F44336';
                        const sideBg = isBuy ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)';
                        const wallet = tx.wallet || tx.feePayer || 'Unknown';
                        const solAmt = tx.solAmount || 0;
                        const tokenAmt = tx.tokenAmount || tx.amount || 0;
                        const age = tx.timestamp ? getTimeAgo(tx.timestamp) : '';
                        const dexName = tx.dex || '';
                        // Short DEX label for compact display
                        const dexShort = dexName.replace(' V4', '').replace(' V2', '').replace(' V3', '').substring(0, 6);

                        return (
                          <div 
                            key={`${tx.signature}-${index}`} 
                            className="transaction-item" 
                            style={{
                              animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none',
                              display: 'grid',
                              gridTemplateColumns: '42px 52px 1fr 72px 72px 38px',
                              gap: '4px',
                              padding: '7px 10px',
                              alignItems: 'center',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              backgroundColor: index === 0 ? sideBg : 'transparent',
                              transition: 'background-color 0.3s',
                            }}
                          >
                            {/* Buy/Sell badge */}
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: sideColor,
                              textTransform: 'uppercase',
                            }}>
                              {isBuy ? 'Buy' : 'Sell'}
                            </span>

                            {/* DEX badge */}
                            <span style={{
                              fontSize: '9px',
                              fontWeight: '600',
                              color: 'rgba(255,255,255,0.45)',
                              background: 'rgba(255,255,255,0.06)',
                              borderRadius: '3px',
                              padding: '1px 4px',
                              textAlign: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }} title={dexName}>
                              {dexShort || '—'}
                            </span>

                            {/* Wallet address */}
                            <span
                              onClick={() => wallet !== 'Unknown' && setSelectedWallet(wallet)}
                              style={{
                                fontSize: '11px',
                                color: '#4FC3F7',
                                cursor: wallet !== 'Unknown' ? 'pointer' : 'default',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={wallet}
                            >
                              {wallet !== 'Unknown' ? `${wallet.substring(0, 4)}...${wallet.substring(wallet.length - 4)}` : 'Unknown'}
                            </span>

                            {/* SOL amount */}
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: sideColor,
                              textAlign: 'right',
                              fontFamily: 'monospace',
                            }}>
                              {solAmt > 0 ? `${solAmt < 0.01 ? solAmt.toFixed(4) : solAmt.toFixed(2)}` : '—'}
                            </span>

                            {/* Token amount */}
                            <span style={{
                              fontSize: '11px',
                              color: 'rgba(255,255,255,0.6)',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {tokenAmt > 0 ? formatCompactNumber(tokenAmt) : '—'}
                            </span>

                            {/* Time + link */}
                            <a
                              href={`https://solscan.io/tx/${tx.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.35)',
                                textAlign: 'right',
                                textDecoration: 'none',
                              }}
                              title="View on Solscan"
                            >
                              {age}
                            </a>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Connection status footer */}
                  {txConnected && (
                    <div style={{
                      padding: '4px 10px',
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4CAF50' }}></span>
                      Live · {transactions.length} transactions
                      {transactions[0]?.dex && ` · via ${transactions[0].dex}`}
                    </div>
                  )}
                </div>
            )}
          </div>

          {/* Top Traders Section - Loaded when expanded */}
          <div className="top-traders-section">
            <div className="top-traders-section-header">Top Traders</div>
            <div className="top-traders-content">
              <TopTradersList coinAddress={mintAddress} isExpanded={isExpanded} />
            </div>
          </div>

          {/* Token Information - Comprehensive Solana Tracker Data */}
          <div className="token-info-grid-section">
            <h3 className="section-title">Token Information</h3>
            <div className="section-content">
              <div className="info-grid">
                {/* Row 1: Trading Activity */}
                {(coin.buys_24h > 0 || coin.sells_24h > 0 || coin.transactions_24h > 0) && (
                  <div className="info-card">
                    <div className="info-card-header">Trading Activity (24h)</div>
                    <div className="info-card-content">
                      {coin.buys_24h > 0 && (
                        <div className="info-row">
                          <span className="info-label">Buys:</span>
                          <span className="info-value positive">{coin.buys_24h.toLocaleString()}</span>
                        </div>
                      )}
                      {coin.sells_24h > 0 && (
                        <div className="info-row">
                          <span className="info-label">Sells:</span>
                          <span className="info-value negative">{coin.sells_24h.toLocaleString()}</span>
                        </div>
                      )}
                      {coin.transactions_24h > 0 && (
                        <div className="info-row">
                          <span className="info-label">Total Transactions:</span>
                          <span className="info-value">{coin.transactions_24h.toLocaleString()}</span>
                        </div>
                      )}
                      {coin.buys_24h > 0 && coin.sells_24h > 0 && (
                        <div className="info-row">
                          <span className="info-label">Buy/Sell Ratio:</span>
                          <span className={`info-value ${coin.buys_24h > coin.sells_24h ? 'positive' : 'negative'}`}>
                            {(coin.buys_24h / coin.sells_24h).toFixed(2)}x
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Row 2: Market Metrics */}
                <div className="info-card">
                  <div className="info-card-header">Market Metrics</div>
                  <div className="info-card-content">
                    {coin.market_cap_usd > 0 && (
                      <div className="info-row">
                        <span className="info-label">Market Cap:</span>
                        <span className="info-value">${formatCompact(coin.market_cap_usd)}</span>
                      </div>
                    )}
                    {coin.volume_24h_usd > 0 && (
                      <div className="info-row">
                        <span className="info-label">24h Volume:</span>
                        <span className="info-value">${formatCompact(coin.volume_24h_usd)}</span>
                      </div>
                    )}
                    {coin.liquidity_usd > 0 && (
                      <div className="info-row">
                        <span className="info-label">Liquidity:</span>
                        <span className="info-value">${formatCompact(coin.liquidity_usd)}</span>
                      </div>
                    )}
                    {coin.volume_24h_usd > 0 && coin.liquidity_usd > 0 && (
                      <div className="info-row">
                        <span className="info-label">Volume/Liquidity:</span>
                        <span className="info-value">{(coin.volume_24h_usd / coin.liquidity_usd).toFixed(2)}x</span>
                      </div>
                    )}
                    {(coin.holders || coin.holderCount) && (
                      <div className="info-row">
                        <span className="info-label">Holders:</span>
                        <span className="info-value">{formatCompact(coin.holders || coin.holderCount)}</span>
                      </div>
                    )}
                    {(coin.age || coin.ageHours) && (
                      <div className="info-row">
                        <span className="info-label">Age:</span>
                        <span className="info-value">
                          {(() => {
                            const hours = coin.age || coin.ageHours || 0;
                            if (hours < 24) return `${hours}h`;
                            const days = Math.floor(hours / 24);
                            const remainingHours = hours % 24;
                            return `${days}d ${remainingHours}h`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: Token Age & Creation */}
                {(coin.age || coin.ageHours || coin.created_timestamp) && (
                  <div className="info-card">
                    <div className="info-card-header">Token Age</div>
                    <div className="info-card-content">
                      {(coin.age || coin.ageHours) && (
                        <div className="info-row">
                          <span className="info-label">Age:</span>
                          <span className="info-value">
                            {(() => {
                              const hours = coin.age || coin.ageHours || 0;
                              if (hours < 24) return `${hours}h`;
                              const days = Math.floor(hours / 24);
                              const remainingHours = hours % 24;
                              return `${days}d ${remainingHours}h`;
                            })()}
                          </span>
                        </div>
                      )}
                      {coin.created_timestamp && (
                        <div className="info-row">
                          <span className="info-label">Created:</span>
                          <span className="info-value">
                            {new Date(coin.created_timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 4: Additional Metrics */}
                {(coin.holders || coin.holderCount || coin.priorityScore) && (
                  <div className="info-card">
                    <div className="info-card-header">Additional Metrics</div>
                    <div className="info-card-content">
                      {(coin.holders || coin.holderCount) && (
                        <div className="info-row">
                          <span className="info-label">Holders:</span>
                          <span className="info-value">{formatCompact(coin.holders || coin.holderCount)}</span>
                        </div>
                      )}
                      {coin.market || coin.dexId && (
                        <div className="info-row">
                          <span className="info-label">Exchange:</span>
                          <span className="info-value">{coin.market || coin.dexId || 'Unknown'}</span>
                        </div>
                      )}
                      {coin.priorityScore?.score && (
                        <div className="info-row">
                          <span className="info-label">Priority Score:</span>
                          <span className="info-value">{coin.priorityScore.score.toFixed(1)}</span>
                        </div>
                      )}
                      {coin.source && (
                        <div className="info-row">
                          <span className="info-label">Data Source:</span>
                          <span className="info-value" style={{fontSize: '0.8rem'}}>{coin.source}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Token Details */}
          <div className="token-details-section">
            <h3 className="section-title token-details-title">Token Details</h3>
            <div className="section-content">
              <div className="token-details-content">
                <div style={{marginBottom: '8px'}}>
                  <strong>Contract:</strong> <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{coin.mintAddress || coin.contract_address || coin.mint || coin.tokenAddress || 'N/A'}</span>
                </div>
                <div style={{marginBottom: '8px'}}>
                  <strong>Chain:</strong> {coin.chain || coin.chainId || 'Solana'}
                </div>
                {coin.dexId && (
                  <div style={{marginBottom: '8px'}}>
                    <strong>DEX:</strong> {coin.dexId}
                  </div>
                )}
                {coin.pairAddress && (
                  <div style={{marginBottom: '8px'}}>
                    <strong>Pair:</strong> <span style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{coin.pairAddress}</span>
                  </div>
                )}
                {coin.dexscreener?.poolInfo?.createdAt && (
                  <div style={{marginBottom: '8px'}}>
                    <strong>Pool Created:</strong> {new Date(coin.dexscreener.poolInfo.createdAt * 1000).toLocaleDateString()}
                  </div>
                )}
                {coin.dexscreener?.marketMetrics?.fdvToMcapRatio && (
                  <div style={{marginBottom: '8px'}}>
                    <strong>FDV/MC Ratio:</strong> {coin.dexscreener.marketMetrics.fdvToMcapRatio.toFixed(2)}x
                  </div>
                )}
                {coin.dexscreener?.poolInfo?.labels?.length > 0 && (
                  <div style={{marginBottom: '8px'}}>
                    <strong>Labels:</strong> {coin.dexscreener.poolInfo.labels.map(label => (
                      <span key={label} style={{
                        display: 'inline-block',
                        background: 'rgba(0,0,0,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        margin: '0 4px 4px 0'
                      }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {/* Detailed Data Sources Section */}
                <div className="data-sources-detailed">
                  <div className="sources-title">Data Sources:</div>
                  <div className="sources-list">
                    {/* DexScreener - Always show since we use it for charts and trading data */}
                    <div className="source-item">
                      <span className="source-name">DexScreener:</span>
                      <span className="source-info">
                        {coin.dexscreener ? (
                          [
                            coin.marketCap && 'Market Cap',
                            coin.liquidity?.usd && 'Liquidity',
                            coin.volume?.h24 && '24h Volume',
                            coin.priceChange && 'Price Changes',
                            coin.dexscreener.pairAddress && 'Pair Data',
                            coin.dexscreener.poolInfo && 'Pool Info',
                            'Charts & Trading Data'
                          ].filter(Boolean).join(', ')
                        ) : (
                          'Charts & Trading Data'
                        )}
                      </span>
                    </div>
                    
                    {/* Jupiter */}
                    {(coin.price_usd || coin.priceUsd) && (
                      <div className="source-item">
                        <span className="source-name">Jupiter:</span>
                        <span className="source-info">Live Price{coin.holderCount ? ', Holder Count' : ''}</span>
                      </div>
                    )}
                    
                    {/* Solana Tracker - For holder and token data */}
                    {(coin.holderCount || coin.mintAuthority !== undefined) && (
                      <div className="source-item">
                        <span className="source-name">Solana Tracker:</span>
                        <span className="source-info">
                          {[
                            coin.holderCount && 'Holder Analytics',
                            coin.mintAuthority !== undefined && 'Token Authority Data'
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Rugcheck */}
                    {coin.rugcheckVerified !== undefined && (
                      <div className="source-item">
                        <span className="source-name">Rugcheck:</span>
                        <span className="source-info">
                          {[
                            'Risk Analysis',
                            coin.liquidityLocked !== undefined && 'Liquidity Lock',
                            coin.burnPercentage !== undefined && 'Burn %',
                            coin.freezeAuthority !== undefined && 'Authority Checks',
                            coin.rugcheckScore !== undefined && 'Safety Score'
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {/* Helius - For RPC and transaction data */}
                    <div className="source-item">
                      <span className="source-name">Helius:</span>
                      <span className="source-info">
                        {coin.recentTransactions ? 
                          'Live Transactions, RPC Data' : 
                          'RPC & Blockchain Data'
                        }
                      </span>
                    </div>
                    
                    {/* Pump.fun */}
                    {coin.descriptionSource === 'pump.fun' && (
                      <div className="source-item">
                        <span className="source-name">Pump.fun:</span>
                        <span className="source-info">Token Description</span>
                      </div>
                    )}
                    
                    {/* Birdeye */}
                    {coin.birdeyeData && (
                      <div className="source-item">
                        <span className="source-name">Birdeye:</span>
                        <span className="source-info">
                          {[
                            coin.birdeyeData.historicalPrice && 'Historical Price',
                            coin.birdeyeData.tradingMetrics && 'Trading Metrics'
                          ].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Volume Analysis */}
          <div className="volume-analysis-section">
            <h3 className="section-title">Volume Analysis</h3>
            <div className="section-content">
              {coin.dexscreener?.volumes ? (
                <div>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '16px', textAlign: 'center'}}>
                    <div>
                      <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>5m Volume</div>
                      <div style={{fontSize: '0.95rem', fontWeight: '700'}}>${formatCompact(coin.dexscreener.volumes.volume5m)}</div>
                    </div>
                    <div>
                      <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>1h Volume</div>
                      <div style={{fontSize: '0.95rem', fontWeight: '700'}}>${formatCompact(coin.dexscreener.volumes.volume1h)}</div>
                    </div>
                    <div>
                      <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>6h Volume</div>
                      <div style={{fontSize: '0.95rem', fontWeight: '700'}}>${formatCompact(coin.dexscreener.volumes.volume6h)}</div>
                    </div>
                  </div>
                  {/* Volume Trend Analysis */}
                  {coin.dexscreener.volumes.volume24h > 0 && (
                    <div style={{fontSize: '0.9rem', color: 'rgba(0,0,0,0.7)'}}>
                      <div style={{marginBottom: '6px'}}>
                        <strong>24h Trend:</strong> 
                        {coin.dexscreener.volumes.volume6h > (coin.dexscreener.volumes.volume24h * 0.25) ? (
                          <span style={{color: '#22c55e', marginLeft: '6px'}}>📈 Strong</span>
                        ) : coin.dexscreener.volumes.volume6h > (coin.dexscreener.volumes.volume24h * 0.15) ? (
                          <span style={{color: '#f59e0b', marginLeft: '6px'}}>📊 Moderate</span>
                        ) : (
                          <span style={{color: '#ef4444', marginLeft: '6px'}}>📉 Weak</span>
                        )}
                      </div>
                      <div>
                        <strong>Liquidity Ratio:</strong> 
                        <span style={{marginLeft: '6px'}}>
                          {liquidity > 0 ? `${(volume24h / liquidity).toFixed(2)}x` : 'N/A'}
                        </span>
                      </div>
                      <div style={{marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px'}}>
                        <strong>Liquidity Security:</strong>
                        <div style={{marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <LiquidityLockIndicator coin={coin} size="medium" showText={true} />
                          {coin.rugcheckVerified && coin.rugcheckScore && (
                            <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)'}}>
                              Score: {coin.rugcheckScore}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="content-placeholder">Volume analysis will appear when available</div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div> {/* Close coin-card-left-panel */}

      {/* TikTok-style Action Buttons - Right side floating */}
      <div className={`tiktok-action-buttons ${showActionButtons ? '' : 'collapsed'}`}>
        {/* Favorite / Like */}
        <button 
          className={`tiktok-action-btn ${isFavorite ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle && onFavoriteToggle(coin); }}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <span className="tiktok-action-icon">
            {isFavorite ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff2d55" stroke="#ff2d55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            )}
          </span>
          <span className="tiktok-action-label">Fave</span>
        </button>

        {/* Live Transactions */}
        <button 
          className={`tiktok-action-btn ${showLiveTransactions ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowLiveTransactions(prev => !prev); }}
          title="Live Transactions"
        >
          <span className="tiktok-action-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </span>
          <span className="tiktok-action-label">Txns</span>
        </button>

        {/* Top Traders / PNL */}
        <button 
          className={`tiktok-action-btn ${showTopTraders ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowTopTraders(prev => !prev); }}
          title="Top PNL Traders"
        >
          <span className="tiktok-action-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </span>
          <span className="tiktok-action-label">PNL</span>
        </button>

        {/* Comments */}
        <button 
          className={`tiktok-action-btn ${showComments ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowComments(prev => !prev); }}
          title="Comments"
        >
          <span className="tiktok-action-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          <span className="tiktok-action-label">{comments.length > 0 ? comments.length : 'Chat'}</span>
        </button>

        {/* Trade */}
        <button 
          className="tiktok-action-btn trade-btn"
          onClick={(e) => { e.stopPropagation(); onTradeClick && onTradeClick(coin); }}
          title="Trade this token"
        >
          <span className="tiktok-action-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <span className="tiktok-action-label">Trade</span>
        </button>

        {/* Share / Copy Address */}
        <button 
          className="tiktok-action-btn"
          onClick={(e) => { 
            e.stopPropagation(); 
            const addr = coin.mintAddress || coin.mint || coin.address || '';
            if (addr) {
              navigator.clipboard.writeText(addr);
              // Brief visual feedback
              e.currentTarget.classList.add('copied');
              setTimeout(() => e.currentTarget.classList.remove('copied'), 1200);
            }
          }}
          title="Copy token address"
        >
          <span className="tiktok-action-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </span>
          <span className="tiktok-action-label">Copy</span>
        </button>
      </div>

      {/* Right Panel - Desktop only chart container */}
      <div className="coin-card-right-panel" ref={rightPanelRef}>
        {/* Desktop: Chart renders here */}
        {isDesktopMode && (
          <TwelveDataChart 
            key={`chart-desktop-${mintAddress}`}
            coin={coin}
            isActive={isExpanded && isVisible}
            isDesktopMode={true}
            onCrosshairMove={handleChartCrosshairMove}
            onFirstPriceUpdate={handleFirstPriceUpdate}
          />
        )}
      </div>

      {/* Mobile Chart - Rendered via portal into mobile-chart-target */}
      {!isDesktopMode && mobileChartTargetRef.current && createPortal(
        <TwelveDataChart 
          key={`chart-mobile-${mintAddress}`}
          coin={coin}
          isActive={isExpanded && isVisible}
          isDesktopMode={false}
          showPriceScale={isExpanded}
          onCrosshairMove={handleChartCrosshairMove}
          onFirstPriceUpdate={handleFirstPriceUpdate}
        />,
        mobileChartTargetRef.current
      )}

      {/* Banner Modal - Use Portal to render at document root */}
      {showBannerModal && createPortal(
        <div className="banner-modal-overlay" onClick={closeBannerModal}>
          <div className="banner-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="banner-modal-close" onClick={closeBannerModal}>
              ×
            </button>
            <img
              src={coin.banner || coin.bannerImage || coin.header || coin.bannerUrl}
              alt={coin.name || 'Token banner'}
              className="banner-modal-image"
            />
          </div>
        </div>,
        document.body
      )}

      {/* Profile Modal - Use Portal to render at document root */}
      {showProfileModal && createPortal(
        <div className="profile-modal-overlay" onClick={closeProfileModal}>
          <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={closeProfileModal}>
              ×
            </button>
            <img
              src={coin.profileImage}
              alt={coin.name || 'Token profile'}
              className="profile-modal-image"
            />
          </div>
        </div>,
        document.body
      )}

      {/* Price Change Modal */}
      {showPriceChangeModal && coin.dexscreener?.priceChanges && (
        <div className="price-change-modal-overlay" onClick={() => setShowPriceChangeModal(false)}>
          <div className="price-change-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="price-change-modal-close" onClick={() => setShowPriceChangeModal(false)}>
              ×
            </button>
            <h3 className="price-change-modal-title">
              {coin.symbol || coin.ticker || 'Token'} Price Changes
            </h3>
            <div className="price-change-modal-grid">
              <div className="price-change-modal-item">
                <div className="price-change-modal-label">5 Minutes</div>
                <div className={`price-change-modal-value ${coin.dexscreener.priceChanges.change5m >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(coin.dexscreener.priceChanges.change5m)}
                </div>
              </div>
              <div className="price-change-modal-item">
                <div className="price-change-modal-label">1 Hour</div>
                <div className={`price-change-modal-value ${coin.dexscreener.priceChanges.change1h >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(coin.dexscreener.priceChanges.change1h)}
                </div>
              </div>
              <div className="price-change-modal-item">
                <div className="price-change-modal-label">6 Hours</div>
                <div className={`price-change-modal-value ${coin.dexscreener.priceChanges.change6h >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(coin.dexscreener.priceChanges.change6h)}
                </div>
              </div>
              <div className="price-change-modal-item">
                <div className="price-change-modal-label">24 Hours</div>
                <div className={`price-change-modal-value ${coin.dexscreener.priceChanges.change24h >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercent(coin.dexscreener.priceChanges.change24h)}
                </div>
              </div>
            </div>
            <div className="price-change-modal-footer">
              <p>Data from DexScreener</p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Popup */}
      {selectedWallet && (
        <WalletPopup 
          walletAddress={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}

      {/* Loading Indicator - Shown when enrichment is in progress */}
      {!isEnriched && (
        <div className="enrichment-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Enriching data...</div>
        </div>
      )}

      {/* Description Modal - Use Portal to render at document root */}
      {showDescriptionModal && coin.description && createPortal(
        <div className="description-modal-overlay" onClick={() => setShowDescriptionModal(false)}>
          <div className="description-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="description-modal-close" onClick={() => setShowDescriptionModal(false)}>
              ×
            </button>
            <div className="description-modal-header">
              <h3 className="description-modal-title">
                {coin.symbol || coin.ticker || coin.name}
              </h3>
            </div>
            <div className="description-modal-body">
              {coin.description}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Graduation Info Tooltip */}
      {showGraduationInfo && graduationIconPosition && createPortal(
        <div
          className="graduation-info-tooltip"
          style={{
            position: 'fixed',
            top: `${graduationIconPosition.top + 8}px`,
            right: `${graduationIconPosition.right}px`,
            background: 'rgba(20, 20, 30, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            width: '280px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            zIndex: 9999999,
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            Pump.fun Graduation Process
          </div>
          
          <div style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: '1.6',
            marginBottom: '12px'
          }}>
            Pump.fun tokens use a bonding curve mechanism. As more SOL is deposited, the progress bar fills up.
          </div>
          
          <div style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.7)',
            lineHeight: '1.5',
            marginBottom: '12px',
            padding: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            borderLeft: `3px solid ${getGraduationColor(calculateGraduationPercentage(coin))}`
          }}>
            <strong style={{ color: getGraduationColor(calculateGraduationPercentage(coin)) }}>At 100%:</strong> The token "graduates" to Raydium, gaining full DEX liquidity and trading capabilities.
          </div>
          
          <div style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: getGraduationColor(calculateGraduationPercentage(coin))
            }}></div>
            Updates every 2 minutes
          </div>
          
          {/* Tooltip Arrow (pointing up) */}
          <div style={{
            position: 'absolute',
            top: '-6px',
            right: '8px',
            width: '12px',
            height: '12px',
            background: 'rgba(20, 20, 30, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: 'none',
            borderRight: 'none',
            transform: 'rotate(45deg)'
          }}></div>
        </div>,
        document.body
      )}

      {/* ====== TIKTOK-STYLE BOTTOM SHEET: Live Transactions ====== */}
      {showLiveTransactions && createPortal(
        <div className="tiktok-sheet-overlay" onClick={() => setShowLiveTransactions(false)}>
          <div className="tiktok-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="tiktok-sheet-handle">
              <div className="tiktok-sheet-handle-bar" />
            </div>

            {/* Header */}
            <div className="tiktok-sheet-header">
              <span className="tiktok-sheet-title">
                {transactions.length} Transactions
              </span>
              <button className="tiktok-sheet-close" onClick={() => setShowLiveTransactions(false)}>✕</button>
            </div>

            {/* Status bar */}
            <div className="tiktok-sheet-status">
              <span className={`tiktok-sheet-dot ${txConnected ? 'live' : ''}`} />
              {txConnected ? 'Live' : 'Connecting...'}
              {transactions[0]?.dex && <span className="tiktok-sheet-dex">via {transactions[0].dex}</span>}
            </div>

            {/* Transaction list */}
            <div className="tiktok-sheet-body">
              {transactions.length === 0 ? (
                <div className="tiktok-sheet-empty">
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                  <div>Waiting for transactions...</div>
                  <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                    {txConnected ? 'Monitoring live swaps' : 'Connecting to backend...'}
                  </div>
                </div>
              ) : (
                transactions.map((tx, index) => {
                  const isBuy = tx.side === 'buy';
                  const sideColor = isBuy ? '#4CAF50' : '#F44336';
                  const wallet = tx.wallet || tx.feePayer || 'Unknown';
                  const solAmt = tx.solAmount || 0;
                  const tokenAmt = tx.tokenAmount || tx.amount || 0;
                  const age = tx.timestamp ? getTimeAgo(tx.timestamp) : '';
                  const dexName = tx.dex || '';
                  const dexShort = dexName.replace(' V4', '').replace(' V2', '').replace(' V3', '').substring(0, 8);

                  return (
                    <div key={`${tx.signature}-${index}`} className="tiktok-tx-row">
                      {/* Left: side indicator + wallet */}
                      <div className="tiktok-tx-left">
                        <span className="tiktok-tx-side" style={{ color: sideColor }}>
                          {isBuy ? '● BUY' : '● SELL'}
                        </span>
                        <a
                          className="tiktok-tx-wallet"
                          href={`https://solscan.io/account/${wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {wallet.substring(0, 4)}...{wallet.slice(-4)}
                        </a>
                        {dexShort && <span className="tiktok-tx-dex">{dexShort}</span>}
                      </div>

                      {/* Right: amounts + time */}
                      <div className="tiktok-tx-right">
                        <div className="tiktok-tx-amounts">
                          {solAmt > 0 && (
                            <span className="tiktok-tx-sol" style={{ color: sideColor }}>
                              {solAmt < 0.01 ? solAmt.toFixed(4) : solAmt.toFixed(2)} SOL
                            </span>
                          )}
                          {tokenAmt > 0 && (
                            <span className="tiktok-tx-tokens">
                              {formatCompactNumber(tokenAmt)} tokens
                            </span>
                          )}
                        </div>
                        <a
                          className="tiktok-tx-time"
                          href={`https://solscan.io/tx/${tx.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {age}
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ====== TIKTOK-STYLE BOTTOM SHEET: Top PNL Traders ====== */}
      {showTopTraders && createPortal(
        <div className="tiktok-sheet-overlay" onClick={() => setShowTopTraders(false)}>
          <div className="tiktok-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="tiktok-sheet-handle">
              <div className="tiktok-sheet-handle-bar" />
            </div>

            {/* Header */}
            <div className="tiktok-sheet-header">
              <span className="tiktok-sheet-title">🏆 Top PNL Traders</span>
              <button className="tiktok-sheet-close" onClick={() => setShowTopTraders(false)}>✕</button>
            </div>

            {/* Top Traders content */}
            <div className="tiktok-sheet-body">
              <TopTradersList coinAddress={mintAddress} isExpanded={true} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ====== TIKTOK-STYLE BOTTOM SHEET: Comments ====== */}
      {showComments && createPortal(
        <div className="tiktok-sheet-overlay" onClick={() => setShowComments(false)}>
          <div className="tiktok-sheet tiktok-sheet-comments" onClick={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="tiktok-sheet-handle">
              <div className="tiktok-sheet-handle-bar" />
            </div>

            {/* Header */}
            <div className="tiktok-sheet-header">
              <span className="tiktok-sheet-title">
                💬 {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
              </span>
              <button className="tiktok-sheet-close" onClick={() => setShowComments(false)}>✕</button>
            </div>

            {/* Comment input */}
            <div className="tiktok-sheet-comment-input">
              {walletConnected ? (
                <form 
                  className="tiktok-comment-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const textarea = e.target.querySelector('textarea');
                    const text = textarea?.value?.trim();
                    if (!text || !walletAddress) return;
                    try {
                      const response = await fetch(`${API_CONFIG.baseUrl}/api/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          coinAddress: mintAddress,
                          coinSymbol: coin.symbol || coin.name || '',
                          walletAddress,
                          comment: text,
                        }),
                      });
                      if (response.ok) {
                        textarea.value = '';
                        // Refresh comments
                        const res = await fetch(`${API_CONFIG.baseUrl}/api/comments/${mintAddress}`);
                        if (res.ok) {
                          const data = await res.json();
                          setComments(data.comments || []);
                        }
                      }
                    } catch (err) {
                      console.error('Error posting comment:', err);
                    }
                  }}
                >
                  <textarea 
                    className="tiktok-comment-textarea"
                    placeholder="Share your thoughts..."
                    maxLength={500}
                    rows={1}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                  />
                  <button type="submit" className="tiktok-comment-send">↑</button>
                </form>
              ) : (
                <div className="tiktok-comment-connect">
                  🔒 Connect wallet to comment
                </div>
              )}
            </div>

            {/* Comments list */}
            <div className="tiktok-sheet-body">
              {comments.length === 0 ? (
                <div className="tiktok-sheet-empty">
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💭</div>
                  <div>No comments yet</div>
                  <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                    Be the first to share your thoughts!
                  </div>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id || comment.id} className="tiktok-comment-row">
                    <div className="tiktok-comment-header">
                      <span className="tiktok-comment-wallet">
                        👛 {comment.walletAddress ? 
                          `${comment.walletAddress.substring(0, 4)}..${comment.walletAddress.slice(-4)}` 
                          : 'Anon'}
                      </span>
                      <span className="tiktok-comment-time">
                        {comment.timestamp ? getTimeAgo(comment.timestamp) : ''}
                      </span>
                    </div>
                    <div className="tiktok-comment-text">{comment.comment}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

CoinCard.displayName = 'CoinCard';

export default CoinCard;