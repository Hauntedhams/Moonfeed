import React, { useState, useEffect, useRef, useCallback } from 'react';
import CoinCard from './CoinCard';
import DexScreenerManager from './DexScreenerManager';
import AdvancedFilter from './AdvancedFilter';
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
  advancedFilters = null, // Add advanced filters prop
  // New props for filter handling
  onAdvancedFilter = null,
  isAdvancedFilterActive = false,
  showFiltersButton = false // Control whether to show the filters button
}) => {
  const [coins, setCoins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enrichedCoins, setEnrichedCoins] = useState(new Map()); // Cache for enriched coin data
  const [expandedCoin, setExpandedCoin] = useState(null); // Track which coin is expanded
  
  // Virtual scrolling state for mobile optimization
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 4 }); // Show 5 cards on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const scrollerRef = useRef(null);
  const dexManagerRef = useRef(null);
  const isScrollLocked = useRef(false);
  
  // API base configuration
  const API_BASE = API_CONFIG.COINS_API;

  // Calculate visible range for virtual scrolling on mobile
  const calculateVisibleRange = useCallback((index, totalCoins) => {
    if (!isMobile) return { start: 0, end: totalCoins - 1 }; // Desktop shows all coins
    
    const visibleCount = 5; // Show 5 cards on mobile
    const buffer = Math.floor(visibleCount / 2); // 2 cards before and after current
    
    let start = Math.max(0, index - buffer);
    let end = Math.min(totalCoins - 1, start + visibleCount - 1);
    
    // Adjust start if we're near the end
    if (end - start + 1 < visibleCount) {
      start = Math.max(0, end - visibleCount + 1);
    }
    
    return { start, end };
  }, [isMobile]);

  // Virtual scrolling performance stats
  const getVirtualScrollStats = useCallback(() => {
    if (!isMobile) return { rendered: coins.length, total: coins.length, percentage: 100 };
    const rendered = visibleRange.end - visibleRange.start + 1;
    const percentage = Math.round((rendered / coins.length) * 100);
    return { rendered, total: coins.length, percentage };
  }, [isMobile, visibleRange, coins.length]);

  // Update mobile detection on window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Reset visible range when switching between mobile/desktop
      if (!mobile && coins.length > 0) {
        setVisibleRange({ start: 0, end: coins.length - 1 });
      } else if (mobile && coins.length > 0) {
        const newRange = calculateVisibleRange(currentIndex, coins.length);
        setVisibleRange(newRange);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIndex, coins.length, calculateVisibleRange]);

  // Enrich coins with DexScreener data
  const enrichCoins = useCallback(async (mintAddresses) => {
    if (!mintAddresses || mintAddresses.length === 0) return;
    
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
  }, []);

  // Get coins around current index for enrichment (current + 2 ahead + 2 behind)
  const getCoinsToEnrich = useCallback((index) => {
    const start = Math.max(0, index - 2);
    const end = Math.min(coins.length, index + 3);
    const coinsToEnrich = coins.slice(start, end);
    return coinsToEnrich.map(coin => coin.mintAddress).filter(Boolean);
  }, [coins]);

  // Enrich coins around current index when it changes - throttled to prevent white flash
  useEffect(() => {
    if (coins.length > 0 && currentIndex >= 0) {
      const mintAddresses = getCoinsToEnrich(currentIndex);
      
      // Only enrich coins that aren't already enriched
      const needsEnrichment = mintAddresses.filter(addr => !enrichedCoins.has(addr));
      
      if (needsEnrichment.length > 0) {
        // Throttle enrichment to prevent frequent API calls during scrolling
        // Disable enrichment on mobile for better performance
        if (window.innerWidth >= 768) {
          const timer = setTimeout(() => {
            enrichCoins(needsEnrichment);
          }, 300);
          
          return () => clearTimeout(timer);
        }
      }
    }
  }, [currentIndex, coins]);

  // Get enriched coin data or fall back to original
  const getEnrichedCoin = useCallback((coin) => {
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
    
    // Mobile detection for reduced limits
    const limit = window.innerWidth < 768 ? 20 : 200;
    console.log(`📱 Device detection: ${window.innerWidth < 768 ? 'Mobile' : 'Desktop'}, using limit: ${limit}`);
    
    try {
      if (onlyFavorites) {
        // Use favorites from props
        setCoins(favorites);
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
        // Use filtered endpoint for custom filters (this will be slower but more comprehensive)
        endpoint = `${API_BASE}/filtered`;
        requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(advancedFilters)
        };
        console.log('🔍 Using custom filtered endpoint (comprehensive but slower):', endpoint);
        console.log('🔍 Request body:', JSON.stringify(advancedFilters, null, 2));
      } else {
        // For all other cases, use the fast endpoint with query parameters
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());
        
        if (filters.type === 'volume') {
          // Fast endpoint will return raw data, we'll sort client-side if needed
          queryParams.append('sortBy', 'volume');
        } else if (filters.type === 'latest') {
          queryParams.append('sortBy', 'latest');
        }
        
        endpoint += `?${queryParams.toString()}`;
        console.log('⚡ Using fast endpoint for immediate load:', endpoint);
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
        firstCoin: data.coins?.[0]?.symbol
      });
      
      if (!data.coins || !Array.isArray(data.coins)) {
        throw new Error('Invalid response format - no coins array');
      }
      
      console.log(`✅ TRENDING LOAD: Successfully loaded ${data.coins.length} trending coins`);
      
      // Use trending coins directly (they're already sorted by trending score)
      let sortedCoins = [...data.coins];
      
      setCoins(sortedCoins);
      
      // Start background enrichment immediately after fast load
      // Disable background enrichment on mobile for better performance
      if (data.source === 'fast-raw' && filters.type !== 'custom') {
        if (window.innerWidth >= 768) {
          console.log('🎨 Starting background enrichment after fast load...');
          startBackgroundEnrichment();
        } else {
          console.log('📱 Skipping background enrichment on mobile for better performance');
        }
      }
      
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
    console.log('🔄 ModernTokenScroller: Dependencies changed, calling fetchCoins');
    console.log('🔄 Dependencies:', { 
      filterType: filters.type, 
      hasAdvancedFilters: !!advancedFilters,
      onlyFavorites 
    });
    fetchCoins();
  }, [fetchCoins]);

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
    }  }, [coins.length, enrichCoins, getCoinsToEnrich]);

  // Update visible range for virtual scrolling when current index changes
  useEffect(() => {
    if (isMobile && coins.length > 0) {
      const newRange = calculateVisibleRange(currentIndex, coins.length);
      console.log(`📱 Virtual scrolling update: Index ${currentIndex}, Range ${newRange.start}-${newRange.end}, Total: ${coins.length}`);
      setVisibleRange(newRange);
      const stats = getVirtualScrollStats();
      console.log(`📱 Virtual scrolling stats: ${stats.rendered}/${stats.total} = ${stats.percentage}% rendered`);
    } else if (!isMobile && coins.length > 0) {
      console.log(`💻 Desktop mode: Rendering all ${coins.length} coins (100% rendered)`);
      setVisibleRange({ start: 0, end: coins.length - 1 });
    } else {
      console.log(`⏸️ No virtual scrolling: isMobile=${isMobile}, coins=${coins.length}`);
    }
  }, [currentIndex, coins.length, isMobile, calculateVisibleRange, getVirtualScrollStats]);

  // Handle expand state changes for coins
  const handleCoinExpandChange = useCallback((isExpanded, coinAddress) => {
    if (isExpanded) {
      setExpandedCoin(coinAddress);
      isScrollLocked.current = true;
    } else {
      setExpandedCoin(null);
      isScrollLocked.current = false;
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
    const newIndex = Math.round(scrollTop / cardHeight);
    
    // Only update if index actually changed and is valid
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < coins.length) {
      const currentCoin = coins[newIndex];
      setCurrentIndex(newIndex);
      
      // Trigger enrichment for the currently viewed coin if not already enriched
      // Use setTimeout to prevent blocking the scroll
      // Disable enrichment on mobile for better performance
      if (currentCoin && !enrichedCoins.has(currentCoin.mintAddress) && window.innerWidth >= 768) {
        setTimeout(() => {
          enrichCoins([currentCoin.mintAddress]);
        }, 100);
      }
    }
  }, [currentIndex, coins, enrichedCoins, enrichCoins, expandedCoin]);





  // Simple scroll listener - optimized for performance
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    
    let scrollTimeout;
    
    const throttledHandleScroll = () => {
      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Throttle scroll handling to prevent performance issues
      scrollTimeout = setTimeout(() => {
        handleScroll();
      }, 50); // 50ms throttle for smoother performance
    };
    
    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [handleScroll]);
  
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
  }, [currentIndex, coins, enrichedCoins, getEnrichedCoin, onCurrentCoinChange]);
  
  // Enrich current coin when currentIndex changes
  useEffect(() => {
    if (coins.length > 0 && currentIndex >= 0 && currentIndex < coins.length) {
      const currentCoin = coins[currentIndex];
      
      // If current coin isn't enriched, enrich it immediately
      if (currentCoin && !enrichedCoins.has(currentCoin.mintAddress) && window.innerWidth >= 768) {
        enrichCoins([currentCoin.mintAddress]);
      }
    }
  }, [currentIndex, coins, enrichedCoins, enrichCoins]);
  
  // Debug logging
  console.log(`📊 ModernTokenScroller render: coins=${coins.length}, loading=${loading}, error=${error}, isMobile=${isMobile}, visibleRange=${JSON.stringify(visibleRange)}`);
  
  if (loading && coins.length === 0) {
    return (
      <div className="modern-scroller-loading">
        <div className="loading-spinner"></div>
        <p>Loading moonfeed...</p>
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
        
        {/* Filters Button - top right (only show if enabled) */}
        {showFiltersButton && onAdvancedFilter && (
          <AdvancedFilter
            onFilter={onAdvancedFilter}
            isActive={isAdvancedFilterActive}
            hideButton={false}
            customClassName="banner-positioned"
          />
        )}
      </div>
      
      {/* DexScreener Manager */}
      <DexScreenerManager
        ref={dexManagerRef}
        visibleCoins={isMobile && coins.length > 0 ? coins.slice(visibleRange.start, visibleRange.end + 1) : coins}
        currentCoinIndex={currentIndex}
        preloadCount={3}
        cleanupThreshold={2}
      />
      
      {/* Scrollable container */}
      <div 
        ref={scrollerRef}
        className={`modern-scroller-container ${expandedCoin ? 'scroll-locked' : ''}`}
      >
        {/* Render coins - temporarily simplified for debugging */}
        {coins.length > 0 ? (
          isMobile ? (
            // Virtual scrolling for mobile
            (() => {
              const start = Math.max(0, visibleRange.start);
              const end = Math.min(coins.length - 1, visibleRange.end);
              console.log(`📱 Mobile rendering: ${start}-${end} from ${coins.length} coins`);
              
              if (start > end || start >= coins.length) {
                console.log(`❌ Invalid range: start=${start}, end=${end}, length=${coins.length}`);
                return <div>Invalid range detected</div>;
              }
              
              return coins.slice(start, end + 1).map((coin, relativeIndex) => {
                const absoluteIndex = start + relativeIndex;
                return renderCoinWithChart(coin, absoluteIndex);
              });
            })()
          ) : (
            // Desktop - render all coins
            coins.map((coin, index) => renderCoinWithChart(coin, index))
          )
        ) : (
          <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
            {loading ? 'Loading coins...' : 'No coins available'}
          </div>
        )}
      </div>
      

      
      {/* Scroll indicator */}
      <div className="scroll-indicator">
        <div className="indicator-track">
          <div 
            className="indicator-thumb"
            style={{
              transform: `translateY(${(currentIndex / Math.max(1, coins.length - 1)) * 100}%)`
            }}
          />
        </div>
        <div className="coin-counter">
          {currentIndex + 1} / {coins.length}
        </div>
      </div>
    </div>
  );
};

export default ModernTokenScroller;
