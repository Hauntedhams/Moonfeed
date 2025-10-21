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
  
  // Virtual scrolling DISABLED - was causing blank UI issues
  // const [visibleRange, setVisibleRange] = useState({ start: 0, end: 5 }); // Start with small range
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const scrollerRef = useRef(null);
  const dexManagerRef = useRef(null);
  const isScrollLocked = useRef(false);
  
  // API base configuration
  const API_BASE = API_CONFIG.COINS_API;

  // Virtual scrolling DISABLED - rendering all coins now
  /*
  const calculateVisibleRange = useCallback((index, totalCoins) => {
    const isMobile = window.innerWidth < 768;
    const buffer = isMobile ? 2 : 3; // Smaller buffer on mobile to save memory
    
    const start = Math.max(0, index - buffer);
    const end = Math.min(totalCoins - 1, index + buffer);
    
    console.log(`📊 Virtual scrolling: Index ${index}, rendering ${start}-${end} (${end - start + 1} cards)`);
    return { start, end };
  }, []);
  */

  // Virtual scrolling stats DISABLED - not using virtual scrolling anymore
  /*
  const getVirtualScrollStats = useCallback(() => {
    const rendered = visibleRange.end - visibleRange.start + 1;
    const total = coins.length;
    const percentage = total > 0 ? ((rendered / total) * 100).toFixed(1) : 0;
    return { rendered, total, percentage };
  }, [coins.length, visibleRange]);
  */

  // Update mobile detection on window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    
    // 🔥 MOBILE PERFORMANCE FIX: Limit enrichment cache aggressively on mobile
    const isMobileDevice = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const MAX_ENRICHMENT_CACHE = isMobileDevice ? 10 : 30; // 10 on mobile, 30 on desktop (reduced from 50)
    
    // Update the enrichedCoins cache with size limit
    setEnrichedCoins(prev => {
      const newCache = new Map(prev);
      
      // If cache is full, remove oldest entries (keep only most recent)
      if (newCache.size >= MAX_ENRICHMENT_CACHE) {
        const entriesToRemove = newCache.size - MAX_ENRICHMENT_CACHE + 1;
        const keys = Array.from(newCache.keys());
        for (let i = 0; i < entriesToRemove; i++) {
          newCache.delete(keys[i]);
          console.log(`🗑️ Enrichment cache full, removed entry: ${keys[i].slice(0, 8)}...`);
        }
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
      
      // 🔥 MOBILE PERFORMANCE: Limit total coins on mobile to prevent memory crashes
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
      const maxCoins = isMobileDevice ? 20 : 50; // Mobile: 20 coins max, Desktop: 50 coins max
      
      // Use trending coins directly (they're already sorted by trending score)
      let sortedCoins = [...data.coins];
      
      // Limit coins on mobile
      if (isMobileDevice && sortedCoins.length > maxCoins) {
        console.log(`📱 MOBILE LIMIT: Reducing from ${sortedCoins.length} to ${maxCoins} coins to prevent crashes`);
        sortedCoins = sortedCoins.slice(0, maxCoins);
      }
      
      setCoins(sortedCoins);
      onTotalCoinsChange?.(sortedCoins.length); // Notify parent of total coins
      
      // DISABLE background enrichment on mobile completely to prevent crashes
      // Desktop users get enrichment, mobile users get lightweight experience
      console.log('📱 Mobile optimization: Background enrichment DISABLED for performance');
      console.log(`📊 Loaded ${sortedCoins.length} coins (${isMobileDevice ? 'mobile' : 'desktop'} mode)`);
      
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
    
    // 🔥 MOBILE PERFORMANCE FIX: Aggressively clear all state before loading new feed
    console.log('🗑️ Clearing previous feed data and freeing memory...');
    setCoins([]);
    setEnrichedCoins(new Map()); // Clear enrichment cache
    setCurrentIndex(0);
    setExpandedCoin(null); // Close any expanded cards
    
    // Force garbage collection hint (not guaranteed, but helps)
    if (window.gc) {
      console.log('🗑️ Running manual garbage collection...');
      window.gc();
    }
    
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

  // Virtual scrolling DISABLED - was causing blank UI
  /* 
  useEffect(() => {
    if (coins.length > 0) {
      const newRange = calculateVisibleRange(currentIndex, coins.length);
      setVisibleRange(newRange);
      
      console.log(`🎯 Virtual scrolling: Index ${currentIndex}, rendering ${newRange.end - newRange.start + 1} of ${coins.length} coins (start=${newRange.start}, end=${newRange.end})`);
    }
  }, [coins.length, currentIndex, calculateVisibleRange]);
  */

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
    
    // 🐛 MOBILE FIX V2: Use simple rounding but rely on snap correction
    // The scroll-end handler will fix any misalignment
    const newIndex = Math.round(scrollTop / cardHeight);
    
    // Clamp to valid range
    const clampedIndex = Math.max(0, Math.min(newIndex, coins.length - 1));
    
    // Only update if index actually changed and is valid
    if (clampedIndex !== currentIndex && clampedIndex >= 0 && clampedIndex < coins.length) {
      const currentCoin = coins[clampedIndex];
      setCurrentIndex(clampedIndex);
      
      // Log scroll progress occasionally (every 5th coin)
      if (clampedIndex % 5 === 0) {
        console.log(`📜 Scrolling: Coin ${clampedIndex + 1}/${coins.length} - ${currentCoin?.symbol || 'Unknown'}`);
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
  }, [currentIndex, coins, enrichedCoins, enrichCoins, expandedCoin]);





  // Snapping state to prevent concurrent snaps
  const isSnapping = useRef(false);

  // Touch gesture detection for responsive mobile swiping
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container || !isMobile) return;
    
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchStartScrollTop = 0;
    
    const handleTouchStart = (e) => {
      if (isScrollLocked.current || expandedCoin) return;
      
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchStartScrollTop = container.scrollTop;
    };
    
    const handleTouchEnd = (e) => {
      if (isScrollLocked.current || expandedCoin) return;
      
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();
      const touchEndScrollTop = container.scrollTop;
      
      // Calculate swipe metrics
      const distance = touchStartY - touchEndY; // Positive = swipe up, negative = swipe down
      const duration = touchEndTime - touchStartTime;
      const velocity = Math.abs(distance) / duration; // pixels per ms
      
      const cardHeight = container.clientHeight;
      const scrollDistance = Math.abs(touchEndScrollTop - touchStartScrollTop);
      
      // Responsive swipe detection:
      // - Fast swipe (velocity > 0.5 px/ms) with at least 50px distance
      // - OR scroll distance > 30% of card height
      const isFastSwipe = velocity > 0.5 && Math.abs(distance) > 50;
      const isSignificantScroll = scrollDistance > cardHeight * 0.3;
      
      if (isFastSwipe || isSignificantScroll) {
        // Determine direction and snap to next/prev card
        const currentScrollIndex = Math.round(touchStartScrollTop / cardHeight);
        let targetIndex;
        
        if (distance > 0) {
          // Swipe up - go to next coin
          targetIndex = Math.min(currentScrollIndex + 1, coins.length - 1);
        } else {
          // Swipe down - go to previous coin
          targetIndex = Math.max(currentScrollIndex - 1, 0);
        }
        
        // Smooth scroll to target
        const targetScrollTop = targetIndex * cardHeight;
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
        
        // Update state
        if (targetIndex !== currentIndex) {
          setCurrentIndex(targetIndex);
          
          const currentCoin = coins[targetIndex];
          const enriched = enrichedCoins.get(currentCoin.mintAddress);
          const enrichedCoin = enriched ? { ...currentCoin, ...enriched } : currentCoin;
          onCurrentCoinChange?.(enrichedCoin, targetIndex);
        }
      }
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, expandedCoin, currentIndex, coins, enrichedCoins, onCurrentCoinChange]);

  // Simple scroll listener - optimized for performance
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    
    let scrollTimeout;
    let snapTimeout;
    
    const performSnap = () => {
      if (isScrollLocked.current || expandedCoin || isSnapping.current) return;
      
      const cardHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      const targetIndex = Math.round(scrollTop / cardHeight);
      const targetScrollTop = targetIndex * cardHeight;
      
      // Always snap to exact position
      if (Math.abs(scrollTop - targetScrollTop) > 0.5) {
        isSnapping.current = true;
        container.scrollTop = targetScrollTop;
        
        // Update state immediately
        if (targetIndex !== currentIndex && targetIndex >= 0 && targetIndex < coins.length) {
          setCurrentIndex(targetIndex);
          
          const currentCoin = coins[targetIndex];
          const enriched = enrichedCoins.get(currentCoin.mintAddress);
          const enrichedCoin = enriched ? { ...currentCoin, ...enriched } : currentCoin;
          onCurrentCoinChange?.(enrichedCoin, targetIndex);
        }
        
        setTimeout(() => {
          isSnapping.current = false;
        }, 50);
      }
    };
    
    const throttledHandleScroll = () => {
      // Don't process if we're currently snapping
      if (isSnapping.current) return;
      
      // Clear previous timeouts
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (snapTimeout) clearTimeout(snapTimeout);
      
      // Update index during scroll
      scrollTimeout = setTimeout(() => {
        handleScroll();
      }, 50);
      
      // Snap when scrolling stops (faster response)
      snapTimeout = setTimeout(performSnap, 50);
    };
    
    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    // Also snap on touchend for immediate response
    const handleTouchEnd = () => {
      setTimeout(performSnap, 10);
    };
    
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      container.removeEventListener('touchend', handleTouchEnd);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (snapTimeout) clearTimeout(snapTimeout);
    };
  }, [handleScroll, expandedCoin, currentIndex, coins.length, onCurrentCoinChange]);
  
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
    
    // 🔥 MOBILE PERFORMANCE: Only render charts for visible coins (current ± 1)
    const isMobileDevice = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const chartRenderDistance = isMobileDevice ? 1 : 2; // Render fewer charts on mobile
    const shouldShowChart = Math.abs(index - currentIndex) <= chartRenderDistance;
    const isVisible = Math.abs(index - currentIndex) <= 1; // Coin is visible if it's current or adjacent
    
    // Auto-load transactions for current coin only on mobile, current + 2 on desktop
    const shouldAutoLoadTransactions = isMobileDevice 
      ? index === currentIndex // Only current coin on mobile
      : (index >= currentIndex && index <= currentIndex + 2); // Current + 2 ahead on desktop
    
    // Use enriched coin data if available
    const enrichedCoin = getEnrichedCoin(coin);
    
    // Get chart component from DexScreener manager (only for visible coins)
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
        {/* 🔥 MOBILE PERFORMANCE V6: Virtual scrolling - only render visible coins */}
        {coins.length > 0 ? (
          coins.map((coin, index) => {
            // 🔥 CRITICAL: Only render coins within render distance to save memory
            const isMobileDevice = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const renderDistance = isMobileDevice ? 2 : 3; // Mobile: current ± 2, Desktop: current ± 3
            const shouldRender = Math.abs(index - currentIndex) <= renderDistance;
            
            // Don't render coins outside the visible range
            if (!shouldRender) {
              // Render placeholder div to maintain scroll position
              return (
                <div 
                  key={coin.mintAddress || coin.tokenAddress || index}
                  className="modern-coin-slide"
                  data-index={index}
                  style={{ height: '100vh', background: 'transparent' }}
                />
              );
            }
            
            // Render actual coin card for visible coins
            return renderCoinWithChart(coin, index);
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
