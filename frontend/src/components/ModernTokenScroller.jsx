import React, { useState, useEffect, useRef, useCallback } from 'react';
import CoinCard from './CoinCard';
import DexScreenerManager from './DexScreenerManager';
import MoonfeedInfoButton from './MoonfeedInfoModal';
import { API_CONFIG, getApiUrl, getFullApiUrl } from '../config/api';
import './ModernTokenScroller.css';

// Modern TikTok-style token scroller with DexScreener integration
const ModernTokenScroller = ({ 
  favorites = [], 
  onlyFavorites = false, 
  onFavoritesChange, 
  filters = {}, 
  onTradeClick,
  onCurrentCoinChange, // Add this callback to notify parent about current coin
  onTotalCoinsChange, // Add this callback to notify parent about total coins
  advancedFilters = null, // Add advanced filters prop
  // New props for filter handling
  onAdvancedFilter = null,
  isAdvancedFilterActive = false
}) => {
  const [coins, setCoins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enrichedCoins, setEnrichedCoins] = useState(new Map()); // Cache for enriched coin data
  const [expandedCoin, setExpandedCoin] = useState(null); // Track which coin is expanded
  const [retryCount, setRetryCount] = useState(0); // Track retry attempts
  const [isBackendLoading, setIsBackendLoading] = useState(false); // Track backend loading state
  
  // Virtual scrolling: Render only visible coins + buffer to prevent memory issues on mobile
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 5 }); // Start with small range
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const scrollerRef = useRef(null);
  const dexManagerRef = useRef(null);
  const isScrollLocked = useRef(false);
  
  // API base configuration
  const API_BASE = API_CONFIG.COINS_API;

  // PERFORMANCE FIX: Calculate visible range for virtual scrolling
  const calculateVisibleRange = useCallback((index, totalCoins) => {
    const isMobile = window.innerWidth < 768;
    const buffer = isMobile ? 2 : 3; // Smaller buffer on mobile to save memory
    
    const start = Math.max(0, index - buffer);
    const end = Math.min(totalCoins - 1, index + buffer);
    
    console.log(`📊 Virtual scrolling: Index ${index}, rendering ${start}-${end} (${end - start + 1} cards)`);
    return { start, end };
  }, []);

  // PERFORMANCE FIX: Get virtual scrolling stats for debugging
  const getVirtualScrollStats = useCallback(() => {
    const rendered = visibleRange.end - visibleRange.start + 1;
    const total = coins.length;
    const percentage = total > 0 ? ((rendered / total) * 100).toFixed(1) : 0;
    return { rendered, total, percentage };
  }, [coins.length, visibleRange]);

  // DISABLED: Update mobile detection on window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Recalculate visible range on resize
      if (coins.length > 0) {
        const newRange = calculateVisibleRange(currentIndex, coins.length);
        setVisibleRange(newRange);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIndex, coins.length, calculateVisibleRange]);

  // Enrich coins with DexScreener data (ON-DEMAND via backend)
  const enrichCoins = useCallback(async (mintAddresses) => {
    if (!mintAddresses || mintAddresses.length === 0) return;
    
    // Use on-demand enrichment for each coin as user scrolls to it
    console.log(`🎨 On-demand enriching ${mintAddresses.length} coin(s)...`);
    
    try {
      // Enrich each coin using the fast on-demand endpoint
      const enrichmentPromises = mintAddresses.map(async (mintAddress) => {
        const coin = coins.find(c => c.mintAddress === mintAddress);
        if (!coin) return null;
        
        // Skip if already in enrichment cache
        if (enrichedCoins.has(mintAddress)) {
          console.log(`📦 Already enriched: ${coin.symbol}`);
          return null;
        }
        
        const response = await fetch(`${API_BASE}/enrich-single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin })
        });
        
        if (!response.ok) {
          console.warn(`⚠️ Enrichment failed for ${coin.symbol}: ${response.status}`);
          return null;
        }
        
        const data = await response.json();
        if (data.success && data.coin) {
          console.log(`✅ Enriched ${coin.symbol} in ${data.enrichmentTime}ms`);
          return { mintAddress, enrichedData: data.coin };
        }
        
        return null;
      });
      
      const results = await Promise.all(enrichmentPromises);
      
      // Update enriched coins map
      results.forEach(result => {
        if (result && result.enrichedData) {
          setEnrichedCoins(prev => new Map(prev).set(result.mintAddress, result.enrichedData));
        }
      });
      
    } catch (error) {
      console.error('❌ On-demand enrichment error:', error);
    }
  }, [coins, enrichedCoins, API_BASE]);

  // Handle enrichment completion from CoinCard
  const handleEnrichmentComplete = useCallback((mintAddress, enrichedData) => {
    console.log(`📦 Storing enrichment data for ${enrichedData.symbol || mintAddress}`);
    console.log(`📊 Enriched data includes:`, {
      hasCleanChartData: !!enrichedData.cleanChartData,
      hasRugcheck: !!enrichedData.rugcheckScore || !!enrichedData.liquidityLocked,
      hasBanner: !!enrichedData.banner,
      hasPriceChange: !!enrichedData.priceChange || !!enrichedData.priceChanges,
      enriched: enrichedData.enriched
    });
    
    // PERFORMANCE FIX: Limit enrichment cache to prevent memory leaks
    const MAX_ENRICHMENT_CACHE = 50;
    
    // Update the enrichedCoins cache with size limit
    setEnrichedCoins(prev => {
      const newCache = new Map(prev);
      
      // If cache is full, remove oldest entry (first in Map)
      if (newCache.size >= MAX_ENRICHMENT_CACHE) {
        const firstKey = newCache.keys().next().value;
        newCache.delete(firstKey);
        console.log(`🗑️ Enrichment cache full, removed oldest entry: ${firstKey.slice(0, 8)}...`);
      }
      
      newCache.set(mintAddress, enrichedData);
      console.log(`📊 Enrichment cache size: ${newCache.size}/${MAX_ENRICHMENT_CACHE}`);
      return newCache;
    });
    
    // 🔥 CRITICAL FIX: Also update the coins array so React re-renders with the enriched data
    // This ensures banner, clean chart, AND rugcheck data load together immediately
    setCoins(prevCoins => prevCoins.map(coin => {
      if (coin.mintAddress === mintAddress) {
        // Merge ALL enriched data, ensuring nothing is lost
        const mergedCoin = {
          ...coin,
          ...enrichedData,
          // Preserve original banner if enriched doesn't have one
          banner: enrichedData.banner || coin.banner,
          // Ensure these critical fields are present
          enriched: enrichedData.enriched || true,
          cleanChartData: enrichedData.cleanChartData,
          priceChange: enrichedData.priceChange || enrichedData.priceChanges,
          priceChanges: enrichedData.priceChanges || enrichedData.priceChange,
          // Rugcheck data
          rugcheckScore: enrichedData.rugcheckScore,
          rugcheckVerified: enrichedData.rugcheckVerified,
          liquidityLocked: enrichedData.liquidityLocked,
          lockPercentage: enrichedData.lockPercentage,
          burnPercentage: enrichedData.burnPercentage,
          riskLevel: enrichedData.riskLevel,
          freezeAuthority: enrichedData.freezeAuthority,
          mintAuthority: enrichedData.mintAuthority,
          topHolderPercent: enrichedData.topHolderPercent,
          isHoneypot: enrichedData.isHoneypot
        };
        
        console.log(`✅ Updated coin in array for ${coin.symbol}:`, {
          hasCleanChartData: !!mergedCoin.cleanChartData,
          hasRugcheck: !!mergedCoin.rugcheckScore || !!mergedCoin.liquidityLocked,
          hasBanner: !!mergedCoin.banner
        });
        
        return mergedCoin;
      }
      return coin;
    }));
  }, []);

  // OLD BATCH ENRICHMENT CODE - DISABLED
  /* DISABLED - Old batch enrichment endpoint doesn't exist
  const enrichCoinsOld = useCallback(async (mintAddresses) => {
    return;
    
    /* DISABLED - Old batch enrichment endpoint doesn't exist
    // MOBILE FIX: Disable enrichment completely in production to prevent 404 errors
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile || import.meta.env.PROD) {
      console.log('📱 Enrichment disabled (mobile/production mode)');
      return;
    }
    
    try {
      console.log(`🎨 Enriching ${mintAddresses.length} coins with DexScreener data (including banners)...`);
      
      const response = await fetch(getApiUrl('/enrich'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          mintAddresses,
          includeBanners: true // Request banner enrichment
        })
      });
      
      if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.coins) {
        console.log(`✅ Successfully enriched ${data.coins.length} coins from DexScreener`);
        
        // Update enriched coins cache
        setEnrichedCoins(prev => {
          const newEnrichedCoins = new Map(prev);
          data.coins.forEach(coin => {
            newEnrichedCoins.set(coin.mintAddress, coin);
            
            // Log banner status for debugging
            if (coin.banner) {
              const isPlaceholder = coin.banner.includes('dicebear.com') || coin.banner.includes('placeholder');
              console.log(`🎨 ${coin.symbol}: ${isPlaceholder ? 'Placeholder' : 'Real'} banner - ${coin.banner}`);
            }
          });
          return newEnrichedCoins;
        });
      }
      
    } catch (error) {
      console.error('❌ Error enriching coins with DexScreener data:', error);
    }
    */

  // Get coins around current index for enrichment (current + 2 ahead + 2 behind)
  const getCoinsToEnrich = useCallback((index) => {
    const start = Math.max(0, index - 2);
    const end = Math.min(coins.length, index + 3);
    const coinsToEnrich = coins.slice(start, end);
    return coinsToEnrich.map(coin => coin.mintAddress).filter(Boolean);
  }, [coins]);

  // DISABLED: Scroll-based enrichment removed - using on-view enrichment only
  // This ensures clean, simple enrichment like the search feature
  /*
  // Enrich coins around current index when it changes - throttled to prevent white flash
  useEffect(() => {
    if (coins.length > 0 && currentIndex >= 0) {
      const mintAddresses = getCoinsToEnrich(currentIndex);
      
      // Only enrich coins that aren't already enriched
      const needsEnrichment = mintAddresses.filter(addr => !enrichedCoins.has(addr));
      
      if (needsEnrichment.length > 0) {
        // Throttle enrichment to prevent frequent API calls during scrolling
        // NOW ENABLED ON ALL DEVICES (mobile + desktop)
        const timer = setTimeout(() => {
          enrichCoins(needsEnrichment);
        }, 300);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentIndex, coins]);
  */

  // Get enriched coin data or fall back to original
  const getEnrichedCoin = useCallback((coin) => {
    // First check if the coin itself already has COMPLETE enrichment data (e.g., from search)
    // Only consider fully enriched if it has the 'enriched' flag AND price change data (for charts)
    const isFullyEnriched = coin.enriched === true && coin.priceChange;
    if (isFullyEnriched) {
      console.log(`📱 Using pre-enriched data for ${coin.symbol}`);
      return coin;
    }
    
    // Otherwise check the enrichment cache
    const enriched = enrichedCoins.get(coin.mintAddress);
    if (enriched) {
      // Merge enriched data with original, preserving original banner if enriched doesn't have one
      return {
        ...coin,
        ...enriched,
        banner: enriched.banner || coin.banner // Preserve original banner if enriched doesn't have one
      };
    }
    return coin;
  }, [enrichedCoins]);
  
  // Fetch coins from backend with fast loading approach
  const fetchCoins = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    // REMOVED: No need to limit coins on frontend - backend handles this
    // Just fetch ALL coins the backend has cached and enriched
    const isMobile = window.innerWidth < 768;
    console.log(`📱 Device: ${isMobile ? 'Mobile' : 'Desktop'}, fetching ALL coins from backend`);
    
    try {
      if (onlyFavorites) {
        // Use favorites from props
        setCoins(favorites);
        onTotalCoinsChange?.(favorites.length); // Notify parent of total coins
        setLoading(false);
        return;
      }
      
      // Determine endpoint based on filters - USE TRENDING ENDPOINT FOR COMPATIBILITY
      let endpoint = `${API_BASE}/trending`; // Use trending endpoint that works on backend
      let requestOptions = { 
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      console.log('🔥 TRENDING LOADING: Using trending endpoint for coin data');
      console.log('🔍 Fetch request details:', {
        filterType: filters.type,
        hasAdvancedFilters: !!advancedFilters,
        advancedFilters: advancedFilters
      });
      
      // Handle different filter types
      if (filters.type === 'custom' && advancedFilters) {
        // Use custom endpoint with query parameters
        const queryParams = new URLSearchParams();
        Object.entries(advancedFilters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            queryParams.append(key, value);
          }
        });
        endpoint = `${API_BASE}/custom?${queryParams.toString()}`;
        console.log('🔍 Using custom filter endpoint:', endpoint);
        console.log('🔍 Filter params:', advancedFilters);
      } else if (filters.type === 'new') {
        // Use the new endpoint for "new" tab
        // 🔥 MOBILE FIX: Add limit for mobile devices to prevent memory issues
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const limit = isMobile ? 30 : 50; // Limit to 30 on mobile, 50 on desktop
        endpoint = `${API_BASE}/new?limit=${limit}`;
        console.log(`🆕 Using NEW endpoint for emerging coins (limit: ${limit} for ${isMobile ? 'mobile' : 'desktop'}):`, endpoint);
      } else if (filters.type === 'graduating') {
        // Use the graduating endpoint for "graduating" tab
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const limit = isMobile ? 50 : 100; // Limit to 50 on mobile, 100 on desktop
        endpoint = `${API_BASE}/graduating?limit=${limit}`;
        console.log(`🎓 Using GRADUATING endpoint for Pump.fun graduating tokens (limit: ${limit} for ${isMobile ? 'mobile' : 'desktop'}):`, endpoint);
      } else if (filters.type === 'dextrending') {
        // Use the dextrending endpoint for "dextrending" tab
        endpoint = `${API_BASE}/dextrending`;
        console.log(`🔥 Using DEXTRENDING endpoint for Dexscreener trending tokens:`, endpoint);
      } else {
        // For all other cases, use the trending endpoint WITHOUT limit
        // Backend will return all coins it has cached
        console.log('⚡ Using trending endpoint for immediate load:', endpoint);
      }
      
      console.log('🌐 Making request to:', endpoint, 'with options:', requestOptions);
      
      // Fetch coins with appropriate method
      const response = await fetch(endpoint, requestOptions);
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Response data preview:', {
        coinsCount: data.coins?.length,
        firstCoin: data.coins?.[0]?.symbol,
        loading: data.loading
      });
      
      // MOBILE FIX: Handle loading state when backend is initializing
      if (data.loading && data.coins?.length === 0) {
        console.log('⏳ Backend still loading NEW feed, will retry (attempt', retryCount + 1, '/10)...');
        
        // Limit retries to prevent infinite loop
        if (retryCount >= 10) {
          console.error('❌ Backend NEW feed took too long to load (10 retries). Showing loading state.');
          setIsBackendLoading(true);
          setLoading(false);
          setError(null); // Clear error to show loading UI instead
          return;
        }
        
        // Increment retry count and retry after 3 seconds
        setRetryCount(prev => prev + 1);
        setIsBackendLoading(true);
        setLoading(false); // Stop showing loading spinner to prevent flash
        
        setTimeout(() => {
          fetchCoins();
        }, 3000); // Increased from 2 to 3 seconds to reduce spam
        return;
      }
      
      // Reset retry count on success
      setRetryCount(0);
      setIsBackendLoading(false);
      
      if (!data.coins || !Array.isArray(data.coins)) {
        throw new Error('Invalid response format - no coins array');
      }
      
      console.log(`✅ TRENDING LOAD: Successfully loaded ${data.coins.length} trending coins`);
      
      // Use trending coins directly (they're already sorted by trending score)
      let sortedCoins = [...data.coins];
      
      setCoins(sortedCoins);
      onTotalCoinsChange?.(sortedCoins.length); // Notify parent of total coins
      
      // DISABLE background enrichment on mobile completely to prevent crashes
      // Desktop users get enrichment, mobile users get lightweight experience
      console.log('📱 Mobile optimization: Background enrichment DISABLED for performance');
      
    } catch (err) {
      console.error('❌ Error fetching coins:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onlyFavorites, favorites, filters, advancedFilters]);
  
  // Background enrichment function - progressively adds banners and security data (silent)
  const startBackgroundEnrichment = useCallback(async () => {
    try {
      console.log('🎨 Starting silent background enrichment...');
      
      let startIndex = 0;
      const batchSize = 10;
      let hasMore = true;
      let batchCount = 0;
      
      while (hasMore) {
        batchCount++;
        console.log(`🎨 Silent enrichment batch ${batchCount} starting at index ${startIndex}`);
        
        const response = await fetch(getApiUrl('/background-enrich'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            startIndex,
            batchSize,
            includeBanners: true,
            includeRugcheck: true
          })
        });
        
        if (!response.ok) {
          console.error('❌ Background enrichment batch failed:', response.status);
          break;
        }
        
        const data = await response.json();
        
        if (data.success) {
          const progressPercentage = data.progress?.percentage || 0;
          
          console.log(`✅ Silent enrichment batch ${batchCount} complete:`, {
            processed: data.batch?.processed,
            bannersAdded: data.batch?.bannersAdded,
            rugcheckAdded: data.batch?.rugcheckAdded,
            totalProgress: `${progressPercentage}%`
          });
          
          // Update coins with enriched data by refetching (fast endpoint will now have enriched data)
          if (progressPercentage % 30 === 0 && progressPercentage > 0) { // Refresh every 30%
            console.log('🔄 Silently refreshing UI with enriched data...');
            fetchCoins();
          }
          
          startIndex = data.next?.startIndex;
          hasMore = !data.progress?.completed;
          
          // Add delay between batches to avoid overwhelming the APIs
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          console.error('❌ Background enrichment batch failed:', data.error);
          break;
        }
      }
      
      console.log('🎉 Silent background enrichment complete! Final refresh...');
      fetchCoins(); // Final refresh to get all enriched data
      
    } catch (error) {
      console.error('❌ Background enrichment failed:', error);
    }
  }, [fetchCoins]);
  
  // Force enrichment of all current coins
  const forceEnrichAllCoins = useCallback(async () => {
    if (coins.length === 0) return;
    
    try {
      console.log('🚀 Force enriching all coins with DexScreener data...');
      
      const response = await fetch(getApiUrl('/force-enrich'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ includeBanners: true })
      });
      
      if (!response.ok) {
        throw new Error(`Force enrichment failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Force enrichment complete:`, data);
        console.log(`🎨 Banners: ${data.banners?.total || 0} total, ${data.banners?.real || 0} real from DexScreener`);
        
        // Refresh coins to get the updated data
        await fetchCoins();
      }
      
    } catch (error) {
      console.error('❌ Error in force enrichment:', error);
    }
  }, [coins.length, fetchCoins]);

  // Initial load and refetch when dependencies change
  useEffect(() => {
    console.log('🔄 ModernTokenScroller: Feed changed, clearing state and fetching new data');
    console.log('🔄 Dependencies:', { 
      filterType: filters.type, 
      hasAdvancedFilters: !!advancedFilters,
      onlyFavorites 
    });
    
    // PERFORMANCE FIX: Clear all state before loading new feed to prevent memory leaks
    console.log('🗑️ Clearing previous feed data...');
    setCoins([]);
    setEnrichedCoins(new Map());
    setCurrentIndex(0);
    setVisibleRange({ start: 0, end: 5 });
    
    // Fetch new feed data
    fetchCoins();
  }, [filters.type, onlyFavorites, JSON.stringify(advancedFilters)]); // Use specific dependencies instead of fetchCoins

  // Force enrich all coins after initial load - DISABLED to prevent white flash
  // useEffect(() => {
  //   if (coins.length > 0) {
  //     // Wait a moment after coins load, then force enrich all
  //     const timer = setTimeout(() => {
  //       forceEnrichAllCoins();
  //     }, 2000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [coins.length, forceEnrichAllCoins]);
  
  // Initial enrichment when coins are loaded
  useEffect(() => {
    if (coins.length > 0 && currentIndex === 0 && window.innerWidth >= 768) {
      const mintAddresses = getCoinsToEnrich(0);
      if (mintAddresses.length > 0) {
        enrichCoins(mintAddresses);
      }
    }
  }, [coins.length]); // Remove enrichCoins and getCoinsToEnrich dependencies to prevent infinite loop

  // ✅ MOBILE FIX: Update visible range when coins load or index changes
  useEffect(() => {
    if (coins.length > 0) {
      const newRange = calculateVisibleRange(currentIndex, coins.length);
      setVisibleRange(newRange);
      
      // Only log on significant changes to reduce console spam
      if (currentIndex % 10 === 0 || currentIndex === 0) {
        console.log(`🎯 Virtual scrolling: Index ${currentIndex}, rendering ${newRange.end - newRange.start + 1} of ${coins.length} coins`);
      }
    }
  }, [coins.length, currentIndex, calculateVisibleRange]);

  // Handle expand state changes for coins
  const handleCoinExpandChange = useCallback((isExpanded, coinAddress) => {
    const container = scrollerRef.current;
    
    if (isExpanded) {
      // Lock scrolling when coin expands
      setExpandedCoin(coinAddress);
      isScrollLocked.current = true;
      
      // Save current scroll position to prevent jumping
      if (container) {
        const scrollTop = container.scrollTop;
        // Immediately restore scroll position to prevent drift
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = scrollTop;
          }
        });
      }
    } else {
      // Unlock scrolling when coin collapses
      setExpandedCoin(null);
      isScrollLocked.current = false;
      
      // Restore scroll position after collapse animation
      if (container) {
        const scrollTop = container.scrollTop;
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = scrollTop;
          }
        });
      }
    }
  }, []);

  // Handle scroll events for snap scrolling - optimized to prevent white flash
  const handleScroll = useCallback(() => {
    // Don't handle scroll if a coin is expanded
    if (isScrollLocked.current || expandedCoin) return;
    
    if (!scrollerRef.current || coins.length === 0) return;
    
    const container = scrollerRef.current;
    const cardHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    
    // 🐛 MOBILE FIX: More precise index calculation to prevent off-by-one errors
    // Add a threshold to account for partial scrolls and ensure we're closer to the target
    const rawIndex = scrollTop / cardHeight;
    const threshold = 0.4; // Must be at least 40% into the next card to count as scrolled
    let newIndex;
    
    // If we're within threshold of the previous card, snap back
    if (rawIndex - Math.floor(rawIndex) < threshold) {
      newIndex = Math.floor(rawIndex);
    } else {
      newIndex = Math.ceil(rawIndex);
    }
    
    // Clamp to valid range
    newIndex = Math.max(0, Math.min(newIndex, coins.length - 1));
    
    // Only update if index actually changed and is valid
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < coins.length) {
      const currentCoin = coins[newIndex];
      setCurrentIndex(newIndex);
      
      // ✅ CRITICAL FIX: Update visible range for virtual scrolling
      const newVisibleRange = calculateVisibleRange(newIndex, coins.length);
      setVisibleRange(newVisibleRange);
      
      // Log scroll progress occasionally (every 5th coin)
      if (newIndex % 5 === 0) {
        const stats = getVirtualScrollStats();
        console.log(`📜 Scrolling: Coin ${newIndex + 1}/${coins.length} - ${currentCoin?.symbol || 'Unknown'} | Rendering: ${stats.rendered}/${stats.total} (${stats.percentage}%)`);
      }
      
      // Trigger enrichment for the currently viewed coin if not already enriched
      // Use setTimeout to prevent blocking the scroll
      // ✅ UNIFORM ENRICHMENT: Enable on all devices for consistent Age/Holders display
      if (currentCoin && !enrichedCoins.has(currentCoin.mintAddress)) {
        setTimeout(() => {
          enrichCoins([currentCoin.mintAddress]);
        }, 100);
      }
    }
  }, [currentIndex, coins, enrichedCoins, enrichCoins, expandedCoin, calculateVisibleRange, getVirtualScrollStats]);





  // Simple scroll listener - optimized for performance
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    
    let scrollTimeout;
    let scrollEndTimeout;
    
    const throttledHandleScroll = () => {
      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Throttle scroll handling to prevent performance issues
      scrollTimeout = setTimeout(() => {
        handleScroll();
      }, 50); // 50ms throttle for smoother performance
      
      // 🐛 MOBILE FIX: Snap to correct position after scrolling stops
      if (scrollEndTimeout) {
        clearTimeout(scrollEndTimeout);
      }
      
      scrollEndTimeout = setTimeout(() => {
        if (isScrollLocked.current || expandedCoin) return;
        
        const cardHeight = container.clientHeight;
        const scrollTop = container.scrollTop;
        const targetIndex = Math.round(scrollTop / cardHeight);
        const targetScrollTop = targetIndex * cardHeight;
        
        // Only snap if we're off by more than 5px
        if (Math.abs(scrollTop - targetScrollTop) > 5) {
          console.log(`📍 Snap correction: ${scrollTop}px → ${targetScrollTop}px (index ${targetIndex})`);
          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }
      }, 150); // Wait 150ms after scrolling stops to snap
    };
    
    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (scrollEndTimeout) {
        clearTimeout(scrollEndTimeout);
      }
    };
  }, [handleScroll, expandedCoin]);
  
  // Handle favorite toggle
  const handleFavoriteToggle = (coin) => {
    console.log('🔥 Favorite toggle called for:', coin.symbol, coin.mintAddress || coin.tokenAddress);
    
    const isFavorite = favorites.some(fav => 
      (fav.mintAddress || fav.tokenAddress) === (coin.mintAddress || coin.tokenAddress)
    );
    
    console.log('🔥 Is currently favorite:', isFavorite);
    console.log('🔥 Current favorites count:', favorites.length);
    
    let newFavorites;
    if (isFavorite) {
      newFavorites = favorites.filter(fav => 
        (fav.mintAddress || fav.tokenAddress) !== (coin.mintAddress || coin.tokenAddress)
      );
      console.log('🔥 Removing from favorites, new count:', newFavorites.length);
    } else {
      newFavorites = [...favorites, coin];
      console.log('🔥 Adding to favorites, new count:', newFavorites.length);
    }
    
    onFavoritesChange?.(newFavorites);
    console.log('🔥 onFavoritesChange called with:', newFavorites.length, 'favorites');
  };
  
  // Check if coin is favorite
  const isFavorite = (coin) => {
    return favorites.some(fav => 
      (fav.mintAddress || fav.tokenAddress) === (coin.mintAddress || coin.tokenAddress)
    );
  };
  
  // Get DexScreener chart for current and nearby coins
  const renderCoinWithChart = (coin, index) => {
    const isCurrentCoin = index === currentIndex;
    const shouldShowChart = Math.abs(index - currentIndex) <= 2; // Show chart for current and 2 adjacent
    const isVisible = Math.abs(index - currentIndex) <= 1; // Coin is visible if it's current or adjacent
    
    // Auto-load transactions for current coin and 2 ahead (3 total)
    // This gives users a preview of recent transaction activity
    const shouldAutoLoadTransactions = index >= currentIndex && index <= currentIndex + 2;
    
    // Use enriched coin data if available
    const enrichedCoin = getEnrichedCoin(coin);
    
    // Get chart component from DexScreener manager
    let chartComponent = null;
    if (shouldShowChart && dexManagerRef.current) {
      chartComponent = dexManagerRef.current.getChartForCoin(enrichedCoin, index);
    }
    
    return (
      <div 
        key={coin.mintAddress || coin.tokenAddress || index}
        className={`modern-coin-slide ${isCurrentCoin ? 'active' : ''} ${expandedCoin === (coin.mintAddress || coin.tokenAddress) ? 'expanded' : ''}`}
        data-index={index}
      >
        <CoinCard
          coin={enrichedCoin}
          isFavorite={isFavorite(coin)}
          onFavoriteToggle={() => handleFavoriteToggle(coin)}
          onTradeClick={onTradeClick}
          isGraduating={coin.status === 'graduating'}
          isTrending={coin.source?.includes('trending')}
          chartComponent={chartComponent}
          isVisible={isVisible}
          onExpandChange={(isExpanded) => handleCoinExpandChange(isExpanded, coin.mintAddress || coin.tokenAddress)}
          autoLoadTransactions={shouldAutoLoadTransactions}
          onEnrichmentComplete={handleEnrichmentComplete} // Pass handler to CoinCard
        />
      </div>
    );
  };
  
  // Notify parent about current coin changes
  useEffect(() => {
    if (coins.length > 0 && currentIndex >= 0 && currentIndex < coins.length) {
      const currentCoin = coins[currentIndex];
      const enrichedCoin = getEnrichedCoin(currentCoin);
      
      // Notify parent component
      onCurrentCoinChange?.(enrichedCoin, currentIndex);
    }
  }, [currentIndex, coins.length]); // Remove getEnrichedCoin and enrichedCoins dependencies
  
  // Enrich current coin when currentIndex changes
  useEffect(() => {
    if (coins.length > 0 && currentIndex >= 0 && currentIndex < coins.length) {
      const currentCoin = coins[currentIndex];
      
      // Always enrich current coin + next 2 coins for smooth scrolling
      const coinsToEnrich = [];
      
      // Current coin
      if (currentCoin && !enrichedCoins.has(currentCoin.mintAddress)) {
        coinsToEnrich.push(currentCoin.mintAddress);
      }
      
      // Next 2 coins (prefetch for smooth scrolling)
      for (let i = 1; i <= 2; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < coins.length) {
          const nextCoin = coins[nextIndex];
          if (nextCoin && !enrichedCoins.has(nextCoin.mintAddress)) {
            coinsToEnrich.push(nextCoin.mintAddress);
          }
        }
      }
      
      if (coinsToEnrich.length > 0) {
        console.log(`🔄 Enriching current coin + ${coinsToEnrich.length - 1} ahead...`);
        enrichCoins(coinsToEnrich);
      }
    }
  }, [currentIndex, coins.length]); // Remove enrichedCoins and enrichCoins dependencies
  
  // Debug logging - reduce frequency to prevent console spam
  const shouldLog = Math.random() < 0.1; // Only log 10% of renders
  if (shouldLog) {
  // DEBUG: Render logging disabled to prevent console spam
  // console.log(`📊 ModernTokenScroller render: coins=${coins.length}, loading=${loading}, error=${error}, isMobile=${isMobile}, visibleRange=${JSON.stringify(visibleRange)}`);
  }
  
  if (loading && coins.length === 0) {
    return (
      <div className="modern-scroller-loading">
        <div className="loading-spinner"></div>
        <p>Loading moonfeed...</p>
      </div>
    );
  }
  
  // Special loading state when backend is initializing (NEW feed)
  if (isBackendLoading && coins.length === 0) {
    return (
      <div className="modern-scroller-loading">
        <div className="loading-spinner"></div>
        <p>Backend is loading NEW coins...</p>
        <p style={{fontSize: '12px', opacity: 0.7, marginTop: '10px'}}>
          This may take up to 30 seconds on first load
        </p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="modern-scroller-error">
        <div className="error-icon">⚠️</div>
        <h3>Failed to load coins</h3>
        <p>{error}</p>
        <button onClick={fetchCoins} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }
  
  if (coins.length === 0) {
    return (
      <div className="modern-scroller-empty">
        <div className="empty-icon">🌙</div>
        <h3>No coins found</h3>
        <p>Try adjusting your filters or check back later</p>
      </div>
    );
  }
  
  return (
    <div className="modern-token-scroller">
      {/* Banner overlay buttons */}
      <div className="banner-overlay-buttons">
        {/* Moonfeed Info Button - top left */}
        <MoonfeedInfoButton className="banner-positioned-left" />
        
        {/* Filter Button - top right (only show on main feed) */}
        {onAdvancedFilter && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('🔥 Banner filter button clicked!');
              onAdvancedFilter && onAdvancedFilter(null); // Open modal by triggering callback
            }}
            className={`banner-filter-button ${isAdvancedFilterActive ? 'active' : ''}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4.5H21V6H3V4.5ZM6 10.5H18V12H6V10.5ZM9 16.5H15V18H9V16.5Z" fill="currentColor"/>
            </svg>
            Filter
          </button>
        )}
      </div>
      
      {/* DexScreener Manager */}
      <DexScreenerManager
        ref={dexManagerRef}
        visibleCoins={coins}
        currentCoinIndex={currentIndex}
        preloadCount={3}
        cleanupThreshold={2}
      />
      
      {/* Scrollable container */}
      <div 
        ref={scrollerRef}
        className={`modern-scroller-container ${expandedCoin ? 'scroll-locked' : ''}`}
      >
        {/* ✅ MOBILE FIX: Render placeholders for non-visible coins to maintain scroll position */}
        {coins.length > 0 ? (
          coins.map((coin, index) => {
            // Check if this coin is in the visible range
            const isInVisibleRange = index >= visibleRange.start && index <= visibleRange.end;
            
            // Render full CoinCard only for visible coins
            if (isInVisibleRange) {
              return renderCoinWithChart(coin, index);
            }
            
            // Render lightweight placeholder for non-visible coins (for scroll-snap to work)
            return (
              <div 
                key={coin.mintAddress || coin.tokenAddress || index}
                className="modern-coin-slide"
                data-index={index}
                style={{
                  height: '100vh',
                  scrollSnapAlign: 'start',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent'
                }}
              >
                {/* Empty placeholder - will load when scrolled into view */}
              </div>
            );
          })
        ) : (
          <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
            {loading ? 'Loading coins...' : 'No coins available'}
          </div>
        )}
      </div>
      

      
      {/* Scroll indicator removed - was blocking expand button interactions */}
    </div>
  );
};

export default ModernTokenScroller;
