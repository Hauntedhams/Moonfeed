import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'
import './App.css'
import { useWallet } from '@jup-ag/wallet-adapter'
import { getFullApiUrl } from './config/api'
import ModernTokenScroller from './components/ModernTokenScroller'
import TrackedView from './components/TrackedView'
import BottomNavBar from './components/BottomNavBar'
import FeedSelector, { FEED_ORDER } from './components/FeedSelector'
import ErrorBoundary from './components/ErrorBoundary'
import { WalletProvider } from './contexts/WalletContext'
import { TrackedWalletsProvider } from './contexts/TrackedWalletsContext'
import { TrackedTradesProvider } from './contexts/TrackedTradesContext'
import { DarkModeProvider } from './contexts/DarkModeContext'
import { CopyTradeProvider } from './contexts/CopyTradeContext'
import { AlertsProvider } from './contexts/AlertsContext'
import CopyTradeToast from './components/CopyTradeToast'
import ReferralTracker from './utils/ReferralTracker'
import MobileOptimizer from './utils/mobileOptimizer'
import { initializePerformanceMonitoring } from './utils/mobileOptimizations'
import { storeTransaction } from './utils/transactionStorage'
import { fetchTokenDecimals } from './utils/triggerOrders'
import { getSolUsdPrice } from './utils/orderFillTracking'
import useOrderFillNotifications from './hooks/useOrderFillNotifications'

// Lazy load heavy components that aren't needed immediately
const WalletDebug = lazy(() => import('./components/WalletDebug'))
const CoinSearchModal = lazy(() => import('./components/CoinSearchModal'))
const CoinListModal = lazy(() => import('./components/CoinListModal'))
const ProfileView = lazy(() => import('./components/ProfileView'))
const OrdersView = lazy(() => import('./components/OrdersView'))
const JupiterTradeModal = lazy(() => import('./components/JupiterTradeModal'))
const AdvancedFilter = lazy(() => import('./components/AdvancedFilter'))
const WalletProfileView = lazy(() => import('./components/WalletProfileView'))
const PositionDetailView = lazy(() => import('./components/PositionDetailView'))

// CommentsSection now integrated into CoinCard's TikTok action bar

// In the extension build VITE_IS_EXTENSION is injected as 'true' by vite.extension.config.js
const IS_EXTENSION = import.meta.env.VITE_IS_EXTENSION === 'true';
const openFullSite = (path = '') => window.open(`https://moonfeed.app${path}`, '_blank');

// Per-account cache so switching wallets never shows the previous account's coins.
const favoritesCacheKey = (address) => `moonfeed_tracked_coins_${address}`;

function App() {
  // Build timestamp - only log once on initial load
  if (!window.__MOONFEED_LOGGED__) {
    console.log('%cMoonfeed Mobile Fix v2.3: ' + '2025-10-11-mobile-tab-click-fix', 'background: #00ff88; color: black; padding:4px; font-weight: bold;');
    console.log('%c✅ Mobile Tab Fix: Taps on active tab now show modal (not switch tabs)', 'color: #00ff88; font-weight: bold;');
    console.log('%c🔥 React Hooks: All hooks before conditional returns (Rules of Hooks)', 'color: #ff4444;');
    console.log('%c🎨 Dark Theme: DexScreener chart backgrounds match embed theme', 'color: #a855f7;');
    console.log('%c📊 Memory: ~865MB → ~65MB | Charts: On-demand (~8-10MB each)', 'color: #00d4ff;');
    window.__MOONFEED_LOGGED__ = true;
  }


  const [activeTab, setActiveTab] = useState('home');
  const [favorites, setFavorites] = useState([]);
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toString() || null;
  useOrderFillNotifications(); // background: notifies when a limit order fills
  const favoritesSyncedWalletRef = useRef(null); // account address we've already pulled synced favorites for
  const skipNextFavoritesSaveRef = useRef(false); // true right after loading remote data, to avoid an immediate re-save
  const favoritesHydratedRef = useRef(false); // blocks saving until the first remote read settles
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [filters, setFilters] = useState({ type: 'dextrending' }); // Start with DEXtrending (fastest loading)
  const [advancedFilters, setAdvancedFilters] = useState(null); // For advanced filtering
  const [isAdvancedFilterActive, setIsAdvancedFilterActive] = useState(false);
  const [advancedFilterModalOpen, setAdvancedFilterModalOpen] = useState(false); // Control modal open/close
  const [selectedCoin, setSelectedCoin] = useState(null); // For full coin view
  const [currentViewedCoin, setCurrentViewedCoin] = useState(null); // For current viewing
  const [visibleCoins, setVisibleCoins] = useState([]); // Track currently visible coins
  const [tradeModalOpen, setTradeModalOpen] = useState(false); // Jupiter trade modal
  const [coinToTrade, setCoinToTrade] = useState(null); // Coin selected for trading
  const [tradeModalOptions, setTradeModalOptions] = useState({}); // Extra options (initialTab, initialSolAmount)
  const [coinListModalOpen, setCoinListModalOpen] = useState(false); // Coin list modal
  const [coinListModalFilter, setCoinListModalFilter] = useState(null); // Filter type for coin list modal
  const [currentCoinIndex, setCurrentCoinIndex] = useState(0); // Current coin index in scroller
  const [totalCoinsInList, setTotalCoinsInList] = useState(0); // Total coins in current list
  const [previousTab, setPreviousTab] = useState('home'); // Tab to go back to from coin-detail
  const [walletProfile, setWalletProfile] = useState(null); // Wallet profile overlay state: { address, displayName? }
  const [positionDetail, setPositionDetail] = useState(null); // { wallet, mint } to show a single position's entry/exit detail

  // Initialize referral tracking, mobile optimizer, and performance monitoring on app load
  useEffect(() => {
    ReferralTracker.initialize();
    
    // Initialize performance monitoring for mobile
    initializePerformanceMonitoring();
    
    // Log mobile optimizer status
    if (MobileOptimizer.isMobile) {
      console.log('📱 Mobile mode active - aggressive optimizations enabled');
      console.log('💾 Memory:', MobileOptimizer.getMemoryStats());
      console.log('🔍 Performance monitoring initialized');
    }
  }, []);

  // Listen for favorites changes from TokenScroller
  const handleFavoritesChange = (newFavs) => {
    // Stamp the price at the moment tracking starts so the UI can show performance since then.
    setFavorites(newFavs.map(c => (
      Number(c.trackedAtPrice) > 0
        ? c
        : { ...c, trackedAtPrice: Number(c.price_usd) || Number(c.priceUsd) || Number(c.price) || 0 }
    )));
  };

  // Coin tracking belongs to the connected account. Clear legacy guest records
  // so a signed-out user can never see or manage a tracked coin.
  useEffect(() => {
    if (!connected || !walletAddress) {
      setFavorites([]);
      localStorage.removeItem('favorites');
    }
  }, [connected, walletAddress]);

  // When a wallet signs in, pull this account's synced tracked-coins (favorites) list
  // from the backend so tracked coins follow the user across devices.
  useEffect(() => {
    if (!connected || !walletAddress) {
      favoritesSyncedWalletRef.current = null;
      favoritesHydratedRef.current = false;
      return;
    }
    if (favoritesSyncedWalletRef.current === walletAddress) return;
    favoritesSyncedWalletRef.current = walletAddress;
    favoritesHydratedRef.current = false;

    // Show the cached list immediately; the remote read reconciles it.
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(favoritesCacheKey(walletAddress)) || '[]');
    } catch (_) { /* ignore corrupt cache */ }
    if (Array.isArray(cached) && cached.length) {
      skipNextFavoritesSaveRef.current = true;
      setFavorites(cached);
    }

    fetch(getFullApiUrl(`/api/users/${walletAddress}/tracked-coins`))
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const remote = Array.isArray(data?.trackedCoins) ? data.trackedCoins : [];
        // An empty account must not wipe a device that still holds the list.
        if (remote.length) {
          skipNextFavoritesSaveRef.current = true;
          setFavorites(remote);
        }
        console.log(`☁️ Synced ${remote.length} tracked coins from account`);
      })
      .catch(err => console.warn('Could not load tracked coins from account:', err.message))
      .finally(() => { favoritesHydratedRef.current = true; });
  }, [connected, walletAddress]);

  // Cache the active account's list for an instant reload before the remote read lands.
  useEffect(() => {
    if (connected && walletAddress) {
      localStorage.setItem(favoritesCacheKey(walletAddress), JSON.stringify(favorites));
    }
  }, [favorites, connected, walletAddress]);

  // Save tracked coins to the signed-in account (minimal fields — full coin data
  // is re-enriched from the feed when displayed) whenever they change.
  useEffect(() => {
    if (!connected || !walletAddress) return;
    // Saving before the remote read lands would push an empty list over real data.
    if (!favoritesHydratedRef.current) return;
    if (skipNextFavoritesSaveRef.current) {
      skipNextFavoritesSaveRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const minimal = favorites.slice(0, 500).map(c => ({
        mintAddress: c.mintAddress || c.address,
        symbol: c.symbol || '',
        name: c.name || '',
        image: c.image || c.logo || c.profileImage || '',
        addedAt: c.addedAt || Date.now(),
        trackedAtPrice: Number(c.trackedAtPrice) || Number(c.price_usd) || Number(c.priceUsd) || 0,
      }));
      fetch(getFullApiUrl(`/api/users/${walletAddress}/tracked-coins`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedCoins: minimal }),
      }).catch(err => console.warn('Could not save tracked coins to account:', err.message));
    }, 800);
    return () => clearTimeout(timer);
  }, [favorites, connected, walletAddress]);

  // Handle coin click from favorites grid
  const handleCoinClick = (coin) => {
    setPreviousTab('tracked');
    setSelectedCoin(coin);
    setCurrentViewedCoin(coin);
    setActiveTab('coin-detail');
  };

  // Handle trade button click - open Jupiter modal with the coin
  const handleTradeClick = (coin, options = {}) => {
    if (IS_EXTENSION) { openFullSite(); return; }
    console.log('🚀 Trade button clicked for:', coin?.symbol);
    if (coin) {
      setCoinToTrade(coin);
      setTradeModalOptions(options);
      setTradeModalOpen(true);
    }
  };

  // Handle global trade button click - trade current viewed coin
  const handleGlobalTradeClick = () => {
    if (IS_EXTENSION) { openFullSite(); return; }
    console.log('🚀 Global trade button clicked!');
    if (currentViewedCoin) {
      setCoinToTrade(currentViewedCoin);
      setTradeModalOpen(true);
    } else {
      console.log('⚠️ No coin currently viewed for trading');
    }
  };

  // Set up a limit order for a coin from a triggered alert, pre-filling the
  // target percentage and a sensible side (take-profit on a rise, buy the dip).
  const handleSetupOrder = (coin, level) => {
    if (!coin) return;
    handleTradeClick(coin, {
      tab: 'limit',
      percentage: level,
      side: level >= 0 ? 'sell' : 'buy',
    });
  };

  // Handle visible coins update from TokenScroller
  const handleVisibleCoinsChange = (coins) => {
    setVisibleCoins(coins);
  };

  // Handle total coins update from TokenScroller
  const handleTotalCoinsChange = (total) => {
    setTotalCoinsInList(total);
  };

  // Handle current coin change from TokenScroller (for auto-tracking the coin in view)
  const handleCurrentCoinChange = (coin, index) => {
    // DEBUG: Disabled to reduce console spam
    // console.log('🎯 APP: Current coin changed:', { symbol: coin?.symbol, ... });
    
    setCurrentViewedCoin(coin);
    setCurrentCoinIndex(index); // Track the current coin index
  };

  // Ensure the current viewed coin is set when viewing a specific coin detail
  React.useEffect(() => {
    if (activeTab === 'coin-detail' && selectedCoin) {
      setCurrentViewedCoin(selectedCoin);
    }
  }, [activeTab, selectedCoin]);

  // Handle top tab filter changes
  const handleTopTabFilterChange = (newFilters) => {
    setFilters(newFilters);
    // Clear advanced filters when using top tabs
    setAdvancedFilters(null);
    setIsAdvancedFilterActive(false);
  };

  // Handle advanced filter changes
  const handleAdvancedFilter = (advancedFilterParams) => {
    // If called with null, it means open the modal (triggered by banner button click)
    if (advancedFilterParams === null) {
      setAdvancedFilterModalOpen(true);
      return;
    }
    
    console.log('🔧 APP: Advanced filters applied:', advancedFilterParams);
    setAdvancedFilters(advancedFilterParams);
    setIsAdvancedFilterActive(true);
    // Switch to custom tab when advanced filters are applied
    console.log('🔧 APP: Switching to custom tab');
    setFilters({ type: 'custom' });
  };

  // Handle active tab click - show coin list modal
  const handleActiveTabClick = (filterType) => {
    console.log('📋 Active tab clicked, showing coin list for:', filterType);
    setCoinListModalFilter(filterType);
    setCoinListModalOpen(true);
  };

  // Handle coin selection from coin list modal
  const handleCoinFromList = (coin) => {
    console.log('🪙 Coin selected from list:', coin.symbol);
    setPreviousTab('home');
    setSelectedCoin(coin);
    setCurrentViewedCoin(coin);
    setActiveTab('coin-detail');
    setCoinListModalOpen(false);
  };

  // Handle search modal
  const handleSearchClick = () => {
    console.log('🔍 APP: handleSearchClick called!');
    setSearchModalOpen(true);
  };

  const handleSearchClose = () => {
    setSearchModalOpen(false);
  };

  // Handle found coin from search
  const handleCoinFound = (coinData) => {
    // IMPORTANT: Always create a new object reference to force React re-render
    // This ensures memoized components (CoinCard) detect changes
    const newCoinData = { ...coinData };
    
    console.log('🔍 Coin selected from search:', {
      symbol: newCoinData.symbol,
      hasEnrichment: !!(newCoinData.banner || newCoinData.website || newCoinData.rugcheck),
      enriched: newCoinData.enriched
    });
    
    // Set the found coin as selected and navigate to coin detail view
    setPreviousTab('home');
    setSelectedCoin(newCoinData);
    setCurrentViewedCoin(newCoinData);
    setActiveTab('coin-detail');
  };

  // Handle Jupiter swap success
  const handleSwapSuccess = async ({ txid, swapResult, quoteResponseMeta, coin, walletAddress }) => {
    console.log('🎉 Swap successful for', coin.symbol, 'TX:', txid);

    // Lets a card that queued a follow-up action (e.g. the sell-at buy-in) react.
    window.dispatchEvent(new CustomEvent('moonfeed:swap-success', {
      detail: { txid, swapResult, coin, walletAddress }
    }));
    
    // Store the transaction in localStorage for transaction history
    if (txid && coin) {
      try {
        // Extract swap details from swapResult if available
        const inputAmount = swapResult?.inputAmount 
          ? parseFloat(swapResult.inputAmount) / 1e9 // Convert lamports to SOL
          : 0;
        // A wrong decimals guess here silently corrupts the cost basis used for fill %.
        const decimals = Number.isInteger(coin.decimals)
          ? coin.decimals
          : await fetchTokenDecimals(coin.mintAddress || coin.address);
        const outputAmount = swapResult?.outputAmount 
          ? parseFloat(swapResult.outputAmount) / (10 ** decimals)
          : 0;
        
        // Calculate price per token
        const pricePerToken = outputAmount > 0 ? inputAmount / outputAmount : 0;
        // Charts are denominated in USD, so pin the entry to USD at buy time too.
        const pricePerTokenUsd = pricePerToken * (await getSolUsdPrice());
        
        // Try to get wallet address from different sources
        const wallet = walletAddress || swapResult?.walletAddress || null;
        
        if (wallet) {
          storeTransaction({
            walletAddress: wallet,
            signature: txid,
            type: 'buy',
            tokenMint: coin.mintAddress || coin.address,
            tokenSymbol: coin.symbol || 'Unknown',
            tokenName: coin.name || coin.symbol || 'Unknown',
            tokenImage: coin.image || coin.logoURI || null,
            inputAmount,
            outputAmount,
            inputMint: 'So11111111111111111111111111111111111111112', // SOL
            outputMint: coin.mintAddress || coin.address,
            pricePerToken,
            pricePerTokenUsd,
          });
          console.log('📝 Transaction stored for history');
        } else {
          console.log('⚠️ No wallet address available, transaction not stored');
        }
      } catch (error) {
        console.error('Failed to store transaction:', error);
      }
    }
  };

  // Handle Jupiter swap error
  const handleSwapError = ({ error, quoteResponseMeta, coin }) => {
    console.error('❌ Swap failed for', coin.symbol, error);
    // You can add error notifications, analytics, etc. here
  };

  // Handle Jupiter modal close
  const handleTradeModalClose = () => {
    setTradeModalOpen(false);
    setCoinToTrade(null);
    setTradeModalOptions({});
  };

  // Handle copy trade — builds a minimal coin object and opens Jupiter pre-filled
  const handleCopyTrade = (notification) => {
    const coin = {
      mintAddress: notification.tokenMint,
      symbol: notification.tokenSymbol || notification.tokenMint.slice(0, 6),
      name: notification.tokenSymbol || 'Unknown Token',
    };
    handleTradeClick(coin);
  };

  // Handle Orders button click - navigate to orders page
  const handleOrdersClick = () => {
    if (IS_EXTENSION) { openFullSite(); return; }
    console.log('📋 Orders button clicked - navigating to orders page');
    setActiveTab('orders');
  };

  // Open a full-screen profile view for any wallet address (from tx / PNL clicks)
  const handleWalletClick = (address, profileHint = {}) => {
    if (!address) return;
    if (profileHint.mint) {
      setPositionDetail({ wallet: address, mint: profileHint.mint, profileHint });
      return;
    }
    setWalletProfile({ address, ...profileHint });
  };

  // Open the FOMO-style entry/exit position detail for a wallet's specific trade
  const handleOpenPosition = (wallet, mint) => {
    if (wallet && mint) setPositionDetail({ wallet, mint });
  };

  return (
    <DarkModeProvider>
      <TrackedWalletsProvider>
        <TrackedTradesProvider>
        <WalletProvider>
          <AlertsProvider>
          <CopyTradeProvider onCopyTrade={handleCopyTrade}>
          <CopyTradeToast />
          <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
        {/* Feed selector + search - only show on home screen */}
        {activeTab !== 'tracked' && activeTab !== 'coin-detail' && activeTab !== 'profile' && activeTab !== 'orders' && (
          <FeedSelector
            activeFilter={filters.type || 'graduating'}
            onFilterChange={handleTopTabFilterChange}
            onCoinSelect={handleCoinFound}
            hasCustomFilters={isAdvancedFilterActive}
            onFeedListOpen={handleActiveTabClick}
            onAdvancedFilterClick={() => setAdvancedFilterModalOpen(true)}
          />
        )}
      
      <div style={{ paddingTop: '0' }}>
        {activeTab === 'tracked' ? (
        <TrackedView
          favorites={favorites}
          onFavoritesChange={handleFavoritesChange}
          onTradeClick={handleTradeClick}
          onWalletClick={handleWalletClick}
          onOpenPosition={handleOpenPosition}
          onCurrentCoinChange={handleCurrentCoinChange}
        />
      ) : activeTab === 'profile' ? (
        <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
          <ProfileView onTradeClick={handleTradeClick} />
        </Suspense>
      ) : activeTab === 'orders' ? (
        <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
          <OrdersView
            onCoinClick={(coinData) => {
              setPreviousTab('orders');
              setSelectedCoin(coinData);
              setCurrentViewedCoin(coinData);
              setActiveTab('coin-detail');
            }}
            onTradeClick={(coinData) => {
              handleTradeClick({
                mintAddress: coinData.mintAddress,
                address: coinData.address,
                symbol: coinData.symbol,
                name: coinData.name,
                image: coinData.image,
                banner: coinData.banner,
                pairAddress: coinData.pairAddress,
              });
            }}
          />
        </Suspense>
      ) : activeTab === 'coin-detail' && selectedCoin ? (
        <div style={{ position: 'relative' }}>
          {/* Back button for coin detail view */}
          <button
            onClick={() => setActiveTab(previousTab || 'home')}
            style={{
              position: 'fixed',
              top: 20,
              left: 20, // Moved back to left edge since dark mode toggle is removed
              zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.9)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              width: 44,
              height: 44,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(0, 0, 0, 0.9)';
              e.target.style.transform = 'scale(1)';
            }}
            title={`Back to ${previousTab || 'home'}`}
          >
            ←
          </button>
          <ModernTokenScroller
            onFavoritesChange={handleFavoritesChange}
            favorites={[selectedCoin]} // Show only the selected coin
            filters={{}}
            onlyFavorites={true}
            onTradeClick={handleTradeClick}
            onWalletClick={handleWalletClick}
            onCurrentCoinChange={handleCurrentCoinChange}
            advancedFilters={null}
            showFiltersButton={false} // Don't show filters in coin detail view
            onSearchClick={null} // No search button in coin detail view
          />
        </div>
      ) : (
        <ErrorBoundary>
          <ModernTokenScroller
            onFavoritesChange={handleFavoritesChange}
            favorites={favorites}
            filters={filters}
            onlyFavorites={false}
            onTradeClick={handleTradeClick}
            onWalletClick={handleWalletClick}
            onVisibleCoinsChange={handleVisibleCoinsChange}
            onCurrentCoinChange={handleCurrentCoinChange}
            onTotalCoinsChange={handleTotalCoinsChange}
            feedOrder={FEED_ORDER}
            advancedFilters={advancedFilters}
            onAdvancedFilter={handleAdvancedFilter}
            isAdvancedFilterActive={isAdvancedFilterActive}
            showFiltersButton={true} // Show filters button on home view
            onSearchClick={null} // Search is handled by the top-right FeedSelector pill
          />
        </ErrorBoundary>
      )}
      </div>
      
      <BottomNavBar 
        activeTab={activeTab === 'coin-detail' ? 'tracked' : activeTab} 
        setActiveTab={(tab) => {
          if (tab === 'trade') {
            handleGlobalTradeClick();
          } else if (IS_EXTENSION && (tab === 'profile' || tab === 'orders')) {
            openFullSite();
          } else {
            setActiveTab(tab);
          }
        }}
        onSearchClick={handleSearchClick}
        onOrdersClick={handleOrdersClick}
      />
      <Suspense fallback={null}>
        <CoinSearchModal
          visible={searchModalOpen}
          onClose={handleSearchClose}
          onCoinSelect={handleCoinFound}
          onAdvancedFilterClick={() => setAdvancedFilterModalOpen(true)}
        />
      </Suspense>

      {/* Wallet Profile overlay — shows a full profile page for any wallet */}
      {walletProfile?.address && (
        <Suspense fallback={null}>
          <WalletProfileView
            walletAddress={walletProfile.address}
            profileHint={walletProfile}
            onBack={() => setWalletProfile(null)}
          />
        </Suspense>
      )}

      {/* Position Detail overlay — FOMO-style entry/exit chart for one wallet+token trade */}
      {positionDetail && (
        <Suspense fallback={null}>
          <PositionDetailView
            walletAddress={positionDetail.wallet}
            mint={positionDetail.mint}
            profileHint={positionDetail.profileHint}
            onBack={() => setPositionDetail(null)}
            onOpenProfile={(profileHint = {}) => {
              setWalletProfile({ address: positionDetail.wallet, ...profileHint });
              setPositionDetail(null);
            }}
            onMimicTrade={(coin) => { setPositionDetail(null); handleTradeClick(coin); }}
          />
        </Suspense>
      )}
      
      {/* Coin List Modal */}
      <Suspense fallback={null}>
        <CoinListModal
          visible={coinListModalOpen}
          onClose={() => setCoinListModalOpen(false)}
          filterType={coinListModalFilter}
          onCoinSelect={handleCoinFromList}
          currentCoinIndex={currentCoinIndex}
          totalCoins={totalCoinsInList}
        />
      </Suspense>
      
      {/* Jupiter Trade Modal */}
      <Suspense fallback={null}>
        <JupiterTradeModal
          isOpen={tradeModalOpen}
          onClose={handleTradeModalClose}
          coin={coinToTrade}
          onSwapSuccess={handleSwapSuccess}
          onSwapError={handleSwapError}
          initialTab={tradeModalOptions?.tab}
          initialSolAmount={tradeModalOptions?.solAmount}
          initialPercentage={tradeModalOptions?.percentage}
          initialSide={tradeModalOptions?.side}
          initialTriggerPrice={tradeModalOptions?.targetPrice}
        />
      </Suspense>
      
      {/* Advanced Filter Modal */}
      <Suspense fallback={null}>
        <AdvancedFilter
          onFilter={handleAdvancedFilter}
          isActive={isAdvancedFilterActive}
          hideButton={true}
          isModalOpen={advancedFilterModalOpen}
          onModalClose={() => setAdvancedFilterModalOpen(false)}
        />
      </Suspense>
      
      {/* Wallet Debug Component - logs connection events to console */}
      <Suspense fallback={null}>
        <WalletDebug />
      </Suspense>
        </div>
          </CopyTradeProvider>
          </AlertsProvider>
        </WalletProvider>
        </TrackedTradesProvider>
    </TrackedWalletsProvider>
    </DarkModeProvider>
  )
}

export default App

