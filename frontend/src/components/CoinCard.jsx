import React, { memo, useState, useRef, useEffect } from 'react';
import './CoinCard.css';
import DexScreenerChart from './DexScreenerChart';
import PriceHistoryChart from './PriceHistoryChart';
import LiquidityLockIndicator from './LiquidityLockIndicator';
import TopTradersList from './TopTradersList';
import WalletModal from './WalletModal';
import { useLiveData } from '../hooks/useLiveDataContext.jsx';
import { useHeliusTransactions } from '../hooks/useHeliusTransactions.jsx';

const CoinCard = memo(({ 
  coin, 
  isFavorite, 
  onFavoriteToggle, 
  onTradeClick, 
  isTrending,
  onExpandChange,
  isVisible = true,
  chartComponent, // optional preloaded chart from manager
  autoLoadTransactions = false // NEW: auto-load transactions when true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPriceChangeModal, setShowPriceChangeModal] = useState(false);
  const [currentChartPage, setCurrentChartPage] = useState(0);
  const [hoveredMetric, setHoveredMetric] = useState(null);
  const [priceFlash, setPriceFlash] = useState('');
  const [showLiveTransactions, setShowLiveTransactions] = useState(false);
  const [showTopTraders, setShowTopTraders] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const chartsContainerRef = useRef(null);
  const chartNavRef = useRef(null);
  const prevPriceRef = useRef(null);

  // 🔥 MOBILE PERFORMANCE FIX: Detect mobile and disable live data
  const isMobile = useRef(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)).current;

  // Get live data from WebSocket (disabled on mobile for performance)
  const { getCoin, getChart, connected, connectionStatus } = useLiveData();
  const liveData = isMobile ? null : getCoin(coin.mintAddress || coin.address);
  const chartData = isMobile ? null : getChart(coin.mintAddress || coin.address);

  // Helius live transactions - auto-load when autoLoadTransactions is true
  const mintAddress = coin.mintAddress || coin.mint || coin.address || coin.contract_address || coin.contractAddress || coin.tokenAddress;
  const { transactions, isConnected: txConnected, error: txError, clearTransactions } = useHeliusTransactions(
    mintAddress,
    showLiveTransactions || autoLoadTransactions // Connect when manually shown OR auto-loaded
  );

  // Auto-show transactions UI when autoLoadTransactions is true
  useEffect(() => {
    if (autoLoadTransactions && !showLiveTransactions) {
      console.log(`🔄 Auto-loading transactions for coin: ${coin.symbol || coin.name}`);
      setShowLiveTransactions(true);
    }
    // Clean up when no longer auto-loading
    if (!autoLoadTransactions && showLiveTransactions) {
      console.log(`🛑 Stopping auto-loaded transactions for coin: ${coin.symbol || coin.name}`);
      setShowLiveTransactions(false);
      clearTransactions();
    }
  }, [autoLoadTransactions, coin.symbol, coin.name]);

  // Handle price flash animation (disabled on mobile for performance)
  useEffect(() => {
    // 🔥 MOBILE PERFORMANCE FIX: Skip animations on mobile
    if (isMobile) return;
    
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
  }, [liveData?.price, coin.price_usd, coin.priceUsd, coin.price]);

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
        return {
          title: '24h Trading Volume',
          exact: `$${exactValue}`,
          description: 'The total dollar value of tokens traded in the last 24 hours. Higher volume indicates more activity and liquidity.',
          example: `$${exactValue} worth of ${coin.symbol || 'tokens'} have been bought and sold in the past 24 hours`
        };
      case 'liquidity':
        // Build comprehensive rugcheck security information
        let rugcheckInfo = '';
        if (coin.rugcheckVerified) {
          rugcheckInfo = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
          rugcheckInfo += '\n🔐 SECURITY ANALYSIS (Rugcheck)';
          rugcheckInfo += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
          
          // Liquidity Lock Status
          if (coin.liquidityLocked) {
            rugcheckInfo += '\n\n✅ LIQUIDITY STATUS: LOCKED';
            if (coin.lockPercentage > 0) {
              rugcheckInfo += `\n   🔒 Locked: ${coin.lockPercentage}%`;
            }
            if (coin.burnPercentage > 0) {
              rugcheckInfo += `\n   🔥 Burned: ${coin.burnPercentage}%`;
            }
            const totalSecured = Math.max(coin.lockPercentage || 0, coin.burnPercentage || 0);
            rugcheckInfo += `\n   � Total Secured: ${totalSecured}%`;
          } else {
            rugcheckInfo += '\n\n⚠️ LIQUIDITY STATUS: UNLOCKED';
            rugcheckInfo += '\n   ⚡ Developers can remove liquidity';
          }
          
          // Risk Assessment
          if (coin.riskLevel && coin.riskLevel !== 'unknown') {
            const riskEmoji = coin.riskLevel === 'low' ? '🟢' : 
                             coin.riskLevel === 'medium' ? '🟡' : '🔴';
            rugcheckInfo += `\n\n${riskEmoji} RISK LEVEL: ${coin.riskLevel.toUpperCase()}`;
          }
          
          // Rugcheck Score
          if (coin.rugcheckScore) {
            const scoreEmoji = coin.rugcheckScore >= 1000 ? '🌟' :
                              coin.rugcheckScore >= 500 ? '⭐' : '⚡';
            rugcheckInfo += `\n${scoreEmoji} Rugcheck Score: ${coin.rugcheckScore}/5000`;
          }
          
          // Token Authorities
          rugcheckInfo += '\n\n🔑 TOKEN AUTHORITIES:';
          if (coin.freezeAuthority !== undefined) {
            rugcheckInfo += `\n   ${coin.freezeAuthority ? '❌ Freeze Authority: Active' : '✅ Freeze Authority: Revoked'}`;
          }
          if (coin.mintAuthority !== undefined) {
            rugcheckInfo += `\n   ${coin.mintAuthority ? '❌ Mint Authority: Active' : '✅ Mint Authority: Revoked'}`;
          }
          
          // Top Holder
          if (coin.topHolderPercent > 0) {
            const holderWarning = coin.topHolderPercent > 20 ? '⚠️' : 
                                 coin.topHolderPercent > 10 ? '⚡' : '✅';
            rugcheckInfo += `\n\n${holderWarning} TOP HOLDER: ${coin.topHolderPercent.toFixed(1)}% of supply`;
            if (coin.topHolderPercent > 20) {
              rugcheckInfo += '\n   (High concentration - potential dump risk)';
            }
          }
          
          // Honeypot Warning (Critical)
          if (coin.isHoneypot) {
            rugcheckInfo += '\n\n🚨 CRITICAL WARNING: HONEYPOT DETECTED';
            rugcheckInfo += '\n   ⛔ You may not be able to sell this token!';
            rugcheckInfo += '\n   ⛔ DO NOT BUY - This is likely a scam!';
          }
          
          // DexScreener Liquidity Comparison (if available)
          if (coin.dexscreenerLiquidity && coin.dexscreenerLiquidity !== value) {
            rugcheckInfo += '\n\n📊 DATA COMPARISON:';
            rugcheckInfo += `\n   Solana Tracker: $${formatCompact(value)} (shown)`;
            rugcheckInfo += `\n   DexScreener: $${formatCompact(coin.dexscreenerLiquidity)}`;
          }
          
          rugcheckInfo += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
          rugcheckInfo += '\n✅ Verified by Rugcheck API';
          
        } else {
          rugcheckInfo = '\n\n⏳ Security data not yet verified';
          rugcheckInfo += '\n   Rugcheck analysis in progress...';
        }
        
        return {
          title: 'Liquidity',
          exact: `$${exactValue}`,
          description: 'The amount of money available for trading. Higher liquidity means easier buying/selling with less price impact.',
          example: `There's $${exactValue} available in trading pools for ${coin.symbol || 'this token'}, making it ${value > 100000 ? 'relatively easy' : value > 10000 ? 'moderately easy' : 'potentially difficult'} to trade large amounts${rugcheckInfo}`
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
    
    console.log('🔄 Expand toggle clicked, current state:', isExpanded);
    const next = !isExpanded;
    setIsExpanded(next);
    
    // Call parent's expand change handler which should lock scrolling
    onExpandChange?.(next);
    console.log('🔄 Expand toggle new state:', next);
  };

  // Chart navigation functions
  const handleChartScroll = () => {
    if (!chartsContainerRef.current) return;
    
    const container = chartsContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const currentPage = Math.round(scrollLeft / containerWidth);
    
    setCurrentChartPage(currentPage);
  };

  const navigateToChartPage = (pageIndex) => {
    const navigationStartTime = Date.now();
    console.log('🔍 [NAVIGATION DIAGNOSTIC] Navigating to chart page:', pageIndex);
    
    if (!chartsContainerRef.current) {
      console.log('❌ [NAVIGATION DIAGNOSTIC] No chart container ref');
      return;
    }
    
    const container = chartsContainerRef.current;
    const containerWidth = container.clientWidth;
    const targetScrollLeft = pageIndex * containerWidth;
    
    console.log('🔍 [NAVIGATION DIAGNOSTIC] Container info:', {
      containerWidth,
      currentScrollLeft: container.scrollLeft,
      targetScrollLeft,
      pageIndex
    });
    
    container.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
    
    setCurrentChartPage(pageIndex);
    
    const navigationDuration = Date.now() - navigationStartTime;
    console.log('🔍 [NAVIGATION DIAGNOSTIC] Navigation completed in', navigationDuration, 'ms');
  };

  // Add scroll listener for chart navigation
  useEffect(() => {
    const container = chartsContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleChartScroll);
    return () => container.removeEventListener('scroll', handleChartScroll);
  }, []);

  // Handle touch/swipe on nav dots area to control chart navigation
  useEffect(() => {
    const navContainer = chartNavRef.current;
    const chartsContainer = chartsContainerRef.current;
    if (!navContainer || !chartsContainer) return;

    let lastX = 0;
    let lastY = 0;
    let isDragging = false;
    let isHorizontalSwipe = false;

    const handleTouchStart = (e) => {
      // Only start tracking if touch is directly on the nav dots container
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      isDragging = true;
      isHorizontalSwipe = false;
      console.log('🔍 [NAV DOTS] Touch start:', { lastX, lastY });
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = Math.abs(currentX - lastX);
      const deltaY = Math.abs(currentY - lastY);
      
      // Only enable horizontal swipe if horizontal movement is dominant
      if (!isHorizontalSwipe && deltaX > 10 && deltaX > (deltaY * 2)) {
        isHorizontalSwipe = true;
      }
      
      // If it's a horizontal swipe, handle chart scrolling
      if (isHorizontalSwipe) {
        const scrollDelta = lastX - currentX;
        const newScroll = chartsContainer.scrollLeft + (scrollDelta * 1.5);
        chartsContainer.scrollLeft = newScroll;
        
        lastX = currentX;
        
        // Prevent default only for horizontal swipes
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchEnd = () => {
      console.log('🔍 [NAV DOTS] Touch end, was horizontal swipe:', isHorizontalSwipe);
      isDragging = false;
      isHorizontalSwipe = false;
    };

    // Mouse events for desktop
    let isDown = false;
    let mouseLastX = 0;

    const handleMouseDown = (e) => {
      isDown = true;
      navContainer.style.cursor = 'grabbing';
      mouseLastX = e.clientX;
      e.preventDefault();
      console.log('🔍 [NAV DOTS] Mouse down:', { mouseLastX });
    };

    const handleMouseMove = (e) => {
      if (!isDown) return;
      
      const currentX = e.clientX;
      const deltaX = mouseLastX - currentX;
      
      const newScroll = chartsContainer.scrollLeft + (deltaX * 1.5);
      chartsContainer.scrollLeft = newScroll;
      
      mouseLastX = currentX;
      e.preventDefault();
    };

    const handleMouseUp = () => {
      isDown = false;
      navContainer.style.cursor = 'grab';
    };

    const handleMouseLeave = () => {
      isDown = false;
      navContainer.style.cursor = 'grab';
    };

    // Add event listeners with capture phase for touch events
    navContainer.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    navContainer.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    navContainer.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    navContainer.addEventListener('mousedown', handleMouseDown);
    navContainer.addEventListener('mousemove', handleMouseMove);
    navContainer.addEventListener('mouseup', handleMouseUp);
    navContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      navContainer.removeEventListener('touchstart', handleTouchStart, true);
      navContainer.removeEventListener('touchmove', handleTouchMove, true);
      navContainer.removeEventListener('touchend', handleTouchEnd, true);
      navContainer.removeEventListener('mousedown', handleMouseDown);
      navContainer.removeEventListener('mousemove', handleMouseMove);
      navContainer.removeEventListener('mouseup', handleMouseUp);
      navContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Component cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any remaining refs
      if (prevPriceRef.current !== null) {
        prevPriceRef.current = null;
      }
      
      // Reset any state to prevent memory leaks
      setPriceFlash('');
      setShowBannerModal(false);
      setShowProfileModal(false);
    };
  }, []);

  // Banner modal handlers
  const handleBannerClick = (e) => {
    console.log('Banner clicked!', coin.name);
    if (coin.banner || coin.bannerImage || coin.header || coin.bannerUrl) {
      console.log('Opening banner modal');
      setShowBannerModal(true);
    } else {
      console.log('No banner image available');
    }
  };

  const closeBannerModal = () => {
    setShowBannerModal(false);
  };

  // Profile modal handlers
  const handleProfileClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Profile clicked!', coin.name);
    if (coin.profileImage) {
      console.log('Opening profile modal');
      setShowProfileModal(true);
    } else {
      console.log('No profile image available');
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
    
    console.log('🔍 Checking for address in coin object:', {
      mintAddress: coin.mintAddress,
      mint: coin.mint,
      address: coin.address,
      contract_address: coin.contract_address,
      contractAddress: coin.contractAddress,
      tokenAddress: coin.tokenAddress,
      selectedAddress: address
    });
    
    if (!address) {
      console.log('❌ No address available for', coin.name || coin.symbol);
      console.log('Full coin object:', coin);
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      console.log('✅ Address copied to clipboard:', address);
      
      // Optional: Show a brief success indicator
      // You could add a toast notification here if you have one
    } catch (err) {
      console.error('Failed to copy address:', err);
      
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
        console.log('✅ Address copied using fallback method:', address);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
    }
  };

  // Use live data when available, fallback to coin data
  const price = liveData?.price ?? coin.price_usd ?? coin.priceUsd ?? coin.price ?? 0;
  const changePct = liveData?.change24h ?? coin.change_24h ?? coin.priceChange24h ?? coin.change24h ?? 0;
  const marketCap = liveData?.marketCap ?? coin.market_cap_usd ?? coin.market_cap ?? coin.marketCap ?? 0;
  const volume24h = liveData?.volume24h ?? coin.volume_24h_usd ?? coin.volume_24h ?? coin.volume24h ?? 0;
  const liquidity = liveData?.liquidity ?? coin.liquidity_usd ?? coin.liquidity ?? coin.liquidityUsd ?? 0;
  const holders = liveData?.holders ?? coin.holders ?? 0;
  
  // Enhanced metrics from DexScreener with live data fallback
  const fdv = liveData?.fdv ?? coin.fdv ?? coin.fullyDilutedValuation ?? 0;
  const volume1h = liveData?.volume1h ?? coin.volume1h ?? coin.dexscreener?.volumes?.volume1h ?? 0;
  const volume6h = liveData?.volume6h ?? coin.volume6h ?? coin.dexscreener?.volumes?.volume6h ?? 0;
  const buys24h = liveData?.buys24h ?? coin.buys24h ?? coin.dexscreener?.transactions?.buys24h ?? 0;
  const sells24h = liveData?.sells24h ?? coin.sells24h ?? coin.dexscreener?.transactions?.sells24h ?? 0;
  const totalTxns24h = liveData?.totalTransactions ?? coin.totalTransactions ?? (buys24h + sells24h) ?? 0;
  const ageHours = liveData?.ageHours ?? coin.ageHours ?? coin.dexscreener?.poolInfo?.ageHours ?? 0;
  const boosts = liveData?.boosts ?? coin.boosts ?? coin.dexscreener?.boosts ?? 0;

  // Debug log for social links - DISABLED to prevent console spam
  // if ((coin.socialLinks || coin.twitter || coin.telegram || coin.website) && Math.random() < 0.05) {
  //   console.log(`🔗 Social data available for ${coin.symbol}:`, { ... });
  // }

  return (
    <div className="coin-card">
      {/* Connection status overlay */}
      {!connected && (
        <div className="connection-status-overlay" title="Disconnected from live data">
          <div className="connection-status-badge">⚠️ Offline</div>
        </div>
      )}
      
      {/* Enhanced Banner with DexScreener support */}
      <div className="coin-banner" onClick={handleBannerClick} style={{ cursor: coin.banner || coin.bannerImage || coin.header || coin.bannerUrl ? 'pointer' : 'default' }}>
        {coin.banner || coin.bannerImage || coin.header || coin.bannerUrl ? (
          <img 
            src={coin.banner || coin.bannerImage || coin.header || coin.bannerUrl}
            alt={coin.name || 'Token banner'}
            loading="lazy"
            decoding="async"
            onError={(e) => { 
              // Reduce image error logging to prevent spam
              if (Math.random() < 0.1) {
                console.log(`Banner image failed to load for ${coin.symbol}:`, e.currentTarget.src);
              }
              e.currentTarget.style.display = 'none'; 
            }}
            onLoad={() => {
              // Reduce successful load logging
              if (Math.random() < 0.05) {
                console.log(`✅ Banner loaded successfully for ${coin.symbol}`);
              }
            }}
          />
        ) : (
          <div className="banner-placeholder">
            {coin.name ? `${coin.name} meme coin` : 'Meme coin discovery'}
          </div>
        )}
        
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
            <p className="banner-coin-symbol">
              ${coin.symbol || coin.ticker || 'N/A'}
            </p>
            <button 
              className={`banner-favorites-button ${isFavorite ? 'favorited' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.();
              }}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M10 3L12.4721 7.94454L17.9445 8.52786L13.9722 12.0555L15.2361 17.4721L10 14.5L4.76393 17.4721L6.02778 12.0555L2.05548 8.52786L7.52786 7.94454L10 3Z" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinejoin="round"
                  fill={isFavorite ? 'currentColor' : 'none'}
                />
              </svg>
            </button>
          </div>
          {coin.description && (
            <p className="banner-coin-description">{coin.description}</p>
          )}
        </div>
      </div>

      {/* Info Layer */}
      <div className={`coin-info-layer ${isExpanded ? 'expanded' : ''}`}>
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
                    {/* Live indicators */}
                    <div className="live-indicators">
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
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
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
                </div>
              </div>
            </div>

            <div className="header-right">
              <div 
                className="expand-handle" 
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
                  <LiquidityLockIndicator coin={coin} size="small" />
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
              
              {/* Tooltip */}
              {hoveredMetric && (
                <div className="metric-tooltip">
                  {(() => {
                    const tooltipData = getTooltipContent(hoveredMetric.type, hoveredMetric.value, coin);
                    return (
                      <>
                        <div className="tooltip-title">{tooltipData.title}</div>
                        <div className="tooltip-exact">{tooltipData.exact}</div>
                        <div className="tooltip-description">{tooltipData.description}</div>
                        <div className="tooltip-example">{tooltipData.example}</div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="info-layer-content">
          {/* Price Charts - Horizontal Scrollable with Snap */}
          <div className="charts-section">
            {/* Navigation Dots Above Chart - Swipe area to control charts */}
            <div 
              className="chart-nav-dots-top" 
              ref={chartNavRef}
            >
              <div 
                className={`nav-dot ${currentChartPage === 0 ? 'active' : ''}`}
                onClick={() => navigateToChartPage(0)}
              ></div>
              <div 
                className={`nav-dot ${currentChartPage === 1 ? 'active' : ''}`}
                onClick={() => navigateToChartPage(1)}
              ></div>
            </div>
            
            <div className="charts-horizontal-container" ref={chartsContainerRef}>
              {/* Graph Page */}
              <div className="chart-page">
                <div className="price-history-wrapper">
                  {currentChartPage === 0 ? (
                    <PriceHistoryChart 
                      coin={coin} 
                      width="100%" 
                      height={200} 
                    />
                  ) : (
                    <div className="chart-placeholder" style={{ 
                      background: 'white', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#666',
                      fontSize: '14px'
                    }}>
                      Chart will load when tab is selected
                    </div>
                  )}
                </div>
              </div>
              
              {/* Advanced View Page */}
              <div className="chart-page">
                <div className="advanced-chart-wrapper">
                  {currentChartPage === 1 ? (
                    coin.pairAddress || coin.tokenAddress ? (
                      <DexScreenerChart 
                        coin={{
                          ...coin,
                          chainId: coin.chainId || 'solana',
                          pairAddress: coin.pairAddress || coin.tokenAddress || coin.mintAddress,
                          tokenAddress: coin.tokenAddress || coin.mintAddress || coin.pairAddress,
                          symbol: coin.symbol || coin.baseToken?.symbol
                        }} 
                        isPreview={false}
                      />
                    ) : chartComponent ? (
                      chartComponent
                    ) : (
                      <div className="chart-placeholder">Chart data unavailable</div>
                    )
                  ) : (
                    <div className="chart-placeholder" style={{ 
                      background: 'white', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#666',
                      fontSize: '14px'
                    }}>
                      Advanced chart will load when tab is selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                      ⚠️ {txError}
                    </div>
                  )}

                  <div className="transactions-list">
                    {transactions.length === 0 ? (
                      <div className="transactions-empty">
                        <div className="empty-text">Waiting for transactions...</div>
                        <div className="empty-subtext">Live monitoring is active</div>
                      </div>
                    ) : (
                      transactions.map((tx, index) => (
                        <div key={tx.signature} className="transaction-item" style={{
                          animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none'
                        }}>
                          <div className="tx-wallet">
                            <span 
                              onClick={() => tx.feePayer && setSelectedWallet(tx.feePayer)}
                              style={{ 
                                cursor: tx.feePayer ? 'pointer' : 'default',
                                color: tx.feePayer ? '#4FC3F7' : 'inherit',
                                textDecoration: tx.feePayer ? 'underline' : 'none'
                              }}
                            >
                              {tx.feePayer ? `${tx.feePayer.substring(0, 4)}..${tx.feePayer.substring(tx.feePayer.length - 4)}` : 'Unknown'}
                            </span>
                          </div>
                          <div className="tx-type-col">
                            <span className="tx-type">{tx.type}</span>
                          </div>
                          {tx.err && (
                            <div className="tx-error-col">
                              <span className="tx-error-badge">Failed</span>
                            </div>
                          )}
                          <div className="tx-time-col">
                            <a 
                              href={`https://solscan.io/tx/${tx.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tx-link"
                              title="View on Solscan"
                            >
                              {new Date(tx.timestamp).toLocaleTimeString()}
                              <span className="external-icon" style={{ marginLeft: '4px' }}>↗</span>
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* Top Traders Section - Separate from Transactions */}
          <div className="top-traders-section">
            <div className="top-traders-section-header">Top Traders</div>
            {!showTopTraders ? (
              <div className="load-top-traders-wrapper">
                <button 
                  className="load-top-traders-btn"
                  onClick={() => setShowTopTraders(true)}
                >
                  Load Top Traders
                </button>
              </div>
            ) : (
              <div className="top-traders-content">
                <TopTradersList coinAddress={mintAddress} />
              </div>
            )}
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

          {/* Transaction Analytics */}
          <div className="transactions-section">
            <h3 className="section-title">Transaction Analytics</h3>
            <div className="section-content">
              {coin.dexscreener?.transactions ? (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', textAlign: 'center'}}>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>5m</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#22c55e'}}>{coin.dexscreener.transactions.buys5m}B</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#ef4444'}}>{coin.dexscreener.transactions.sells5m}S</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>1h</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#22c55e'}}>{coin.dexscreener.transactions.buys1h}B</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#ef4444'}}>{coin.dexscreener.transactions.sells1h}S</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>6h</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#22c55e'}}>{coin.dexscreener.transactions.buys6h}B</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#ef4444'}}>{coin.dexscreener.transactions.sells6h}S</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>24h</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#22c55e'}}>{coin.dexscreener.transactions.buys24h}B</div>
                    <div style={{fontSize: '0.9rem', fontWeight: '600', color: '#ef4444'}}>{coin.dexscreener.transactions.sells24h}S</div>
                  </div>
                </div>
              ) : (
                <div className="content-placeholder">Transaction data will appear when available</div>
              )}
            </div>
          </div>

          {/* Token Details */}
          <div className="token-details-section">
            <h3 className="section-title">Token Details</h3>
            <div className="section-content">
              <div style={{fontSize: '0.9rem', lineHeight: '1.6'}}>
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
                {coin.enrichmentSource && (
                  <div style={{marginTop: '12px', fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)'}}>
                    Data source: {coin.enrichmentSource}
                    {coin.enriched && <span style={{marginLeft: '8px', color: '#22c55e'}}>✓ Enriched</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price Changes */}
          <div className="price-changes-section">
            <h3 className="section-title">Price Changes</h3>
            <div className="section-content">
              {coin.dexscreener?.priceChanges ? (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '12px', textAlign: 'center'}}>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>5m</div>
                    <div className={`price-change ${coin.dexscreener.priceChanges.change5m >= 0 ? 'positive' : 'negative'}`} style={{fontSize: '0.9rem', padding: '2px 6px', borderRadius: '6px'}}>
                      {formatPercent(coin.dexscreener.priceChanges.change5m)}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>1h</div>
                    <div className={`price-change ${coin.dexscreener.priceChanges.change1h >= 0 ? 'positive' : 'negative'}`} style={{fontSize: '0.9rem', padding: '2px 6px', borderRadius: '6px'}}>
                      {formatPercent(coin.dexscreener.priceChanges.change1h)}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>6h</div>
                    <div className={`price-change ${coin.dexscreener.priceChanges.change6h >= 0 ? 'positive' : 'negative'}`} style={{fontSize: '0.9rem', padding: '2px 6px', borderRadius: '6px'}}>
                      {formatPercent(coin.dexscreener.priceChanges.change6h)}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', marginBottom: '4px'}}>24h</div>
                    <div className={`price-change ${coin.dexscreener.priceChanges.change24h >= 0 ? 'positive' : 'negative'}`} style={{fontSize: '0.9rem', padding: '2px 6px', borderRadius: '6px'}}>
                      {formatPercent(coin.dexscreener.priceChanges.change24h)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="content-placeholder">Price change data will appear when available</div>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="activity-section">
            <h3 className="section-title">Activity</h3>
            <div className="section-content">
              <div className="content-placeholder">Activity feed coming soon</div>
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

      {/* Banner Modal */}
      {showBannerModal && (
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
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
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
            <div className="profile-modal-info">
              <h3 className="profile-modal-name">{coin.name || 'Unknown Token'}</h3>
              <p className="profile-modal-symbol">{coin.symbol || coin.ticker || 'N/A'}</p>
            </div>
          </div>
        </div>
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

      {/* Wallet Modal */}
      {selectedWallet && (
        <WalletModal 
          walletAddress={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}
    </div>
  );
});

CoinCard.displayName = 'CoinCard';

export default CoinCard;