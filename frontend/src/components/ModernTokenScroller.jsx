import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import CoinCard from './CoinCard';
import MoonfeedInfoButton from './MoonfeedInfoModal';
import InteractiveTutorial from './InteractiveTutorial';
import { API_CONFIG, getApiUrl } from '../config/api';
import { useWallet } from '../contexts/WalletContext';
import { useWalletConnectOnboarding } from './WalletConnectOnboarding';
import { useTrackedTrades } from '../contexts/TrackedTradesContext';
import './ModernTokenScroller.css';

const SWIPE_HINT_SEEN_KEY = 'moonfeed_swipe_hint_seen';
const FEED_HINT_SEEN_KEY = 'moonfeed_feed_hint_seen';
const EXPAND_HINT_SEEN_KEY = 'moonfeed_expand_hint_seen';
const TRADE_HINT_SEEN_KEY = 'moonfeed_trade_hint_seen';
const ANALYTICS_HINT_SEEN_KEY = 'moonfeed_analytics_hint_seen';
const HELP_HINT_SEEN_KEY = 'moonfeed_help_hint_seen';
const TOP_TRADERS_HINT_SEEN_KEY = 'moonfeed_top_traders_hint_seen';
const TRADER_ROW_HINT_SEEN_KEY = 'moonfeed_trader_row_hint_seen';
const TRADER_PROFILE_HINT_SEEN_KEY = 'moonfeed_trader_profile_hint_seen';
const PROFILE_CLOSE_HINT_SEEN_KEY = 'moonfeed_profile_close_hint_seen';
const LIVE_ZOOM_HINT_SEEN_KEY = 'moonfeed_live_zoom_hint_seen';

// Where the user left off in each feed — restored on remount (back from another
// page) and on cold app start, so scrolling position is never lost.
const FEED_POS_KEY = 'moonfeed_feed_pos';
const FEED_POS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Debounce utility for performance
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// First element matching `selector` whose box is actually inside the viewport.
// Multiple mounted CoinCards can portal duplicate action buttons — only the
// visible one is a valid tour target.
const pickVisibleElement = (selector) => {
  const elements = document.querySelectorAll(selector);
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (
      rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.top < window.innerHeight &&
      rect.right > 0 && rect.left < window.innerWidth
    ) {
      return element;
    }
  }
  return null;
};

const rectToTarget = (rect) => ({
  left: rect.left + rect.width / 2,
  top: rect.top + rect.height / 2,
  width: rect.width,
  height: rect.height
});

// Modern TikTok-style token scroller with DexScreener integration
const ModernTokenScroller = ({ 
  favorites = [], 
  onlyFavorites = false, 
  singleCoin = null, // Show just this one coin (e.g. from search) without treating `favorites` as the coin source
  onFavoritesChange, 
  filters = {}, 
  onTradeClick,
  onWalletClick, // Open a full profile page for a clicked wallet address
  onCurrentCoinChange, // Add this callback to notify parent about current coin
  onTotalCoinsChange, // Add this callback to notify parent about total coins
  feedOrder = [], // Preset feed order for continuous scrolling
  advancedFilters = null, // Add advanced filters prop
  // New props for filter handling
  onAdvancedFilter = null,
  isAdvancedFilterActive = false,
  onSearchClick = null, // Add search click handler
  showFiltersButton = true // Hide the top-left info/hamburger button (e.g. a fixed back button takes that spot instead)
}) => {
  const { connected: walletConnected } = useWallet();
  const { openWalletConnect } = useWalletConnectOnboarding();
  const { tradesByMint, tradesLoaded } = useTrackedTrades();
  // Debug: Log if onSearchClick is passed
  useEffect(() => {
    console.log('🔍 ModernTokenScroller: onSearchClick prop =', !!onSearchClick);
  }, [onSearchClick]);
  
  const [coins, setCoins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enrichedCoins, setEnrichedCoins] = useState(new Map()); // Cache for enriched coin data
  const [expandedCoin, setExpandedCoin] = useState(null); // Track which coin is expanded
  const [chartFullscreenLock, setChartFullscreenLock] = useState(false); // True while any chart is in fullscreen
  const isChartFullscreen = useRef(false); // Sync ref so IntersectionObserver sees it without stale closure
  const [retryCount, setRetryCount] = useState(0); // Track retry attempts
  const [isBackendLoading, setIsBackendLoading] = useState(false); // Track backend loading state
  const [isTutorialActive, setIsTutorialActive] = useState(false); // Interactive tutorial mode
  const [isFirstVisit, setIsFirstVisit] = useState(() => !InteractiveTutorial.hasCompleted()); // Show nudge for new users
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    try {
      return localStorage.getItem(SWIPE_HINT_SEEN_KEY) !== 'true';
    } catch (_) {
      return true;
    }
  });
  const [showExpandHint, setShowExpandHint] = useState(false);
  const [showFeedHint, setShowFeedHint] = useState(false);
  const [showTradeHint, setShowTradeHint] = useState(false);
  const [showAnalyticsHint, setShowAnalyticsHint] = useState(false);
  const [showHelpHint, setShowHelpHint] = useState(false);
  const [expandHintTargets, setExpandHintTargets] = useState({ top: null, bottom: null });
  const [feedHintTarget, setFeedHintTarget] = useState(null);
  const [analyticsHintTarget, setAnalyticsHintTarget] = useState(null);
  const [helpHintTarget, setHelpHintTarget] = useState(null);
  const [showTopTradersHint, setShowTopTradersHint] = useState(false);
  const [showTraderRowHint, setShowTraderRowHint] = useState(false);
  const [showTraderProfileHint, setShowTraderProfileHint] = useState(false);
  const [showProfileCloseHint, setShowProfileCloseHint] = useState(false);
  const [showLiveZoomHint, setShowLiveZoomHint] = useState(false);
  const [topTradersHintTarget, setTopTradersHintTarget] = useState(null);
  const [traderRowHintTarget, setTraderRowHintTarget] = useState(null);
  const [traderProfileHintTarget, setTraderProfileHintTarget] = useState(null);
  const [profileCloseHintTarget, setProfileCloseHintTarget] = useState(null);
  const [liveZoomHintTarget, setLiveZoomHintTarget] = useState(null);
  const liveZoomAutoCollapseRef = useRef(false); // one-shot: collapse the card so the zoom button exists
  
  // Chart preload: activate the next card's chart shortly after landing so it's
  // ready before the user scrolls. Only 1 card ahead — avoids simultaneous
  // WebSocket connections that cause DexScreener rate-limiting.
  const [preloadIndex, setPreloadIndex] = useState(null);

  // Chart-mount window index. This LAGS currentIndex and only catches up once the
  // user stops scrolling for a beat. Charts are mounted relative to this index so
  // no chart mounts/unmounts DURING a swipe — mutating the DOM mid-scroll makes
  // iOS abort scroll-snap (partial snaps / "leftover" chart from the prior card).
  // The chart appears the moment the swipe settles.
  const [settledIndex, setSettledIndex] = useState(0);

  // Virtual scrolling DISABLED - was causing blank UI issues
  // Render distance optimized: Mobile ±2, Desktop ±3
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const scrollerRef = useRef(null);
  const isScrollLocked = useRef(false);
  const feedEndTriggerRef = useRef(null);
  const loadedFeedTypesRef = useRef([]);
  const isLoadingMoreFeedRef = useRef(false);
  const trackedBuyAppliedRef = useRef(false); // one-shot per feed load: tracked-wallet buys woven in
  const pendingFeedRestoreRef = useRef(false); // restore saved position once after a feed (re)loads
  const lastSavedFeedPosRef = useRef(''); // dedupe localStorage writes

  // Live mirrors of state the IntersectionObserver reads. Keeping these in refs
  // lets the observer be created ONCE (see effect below) instead of being torn
  // down and re-registered on all 20 slides on every scroll / enrichment.
  const currentIndexRef = useRef(0);
  const coinsRef = useRef(coins);
  const enrichedCoinsRef = useRef(enrichedCoins);
  const expandedCoinRef = useRef(expandedCoin);
  const onCurrentCoinChangeRef = useRef(onCurrentCoinChange);
  currentIndexRef.current = currentIndex;
  coinsRef.current = coins;
  enrichedCoinsRef.current = enrichedCoins;
  expandedCoinRef.current = expandedCoin;
  onCurrentCoinChangeRef.current = onCurrentCoinChange;
  
  // API base configuration
  const API_BASE = API_CONFIG.COINS_API;

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
    try {
      localStorage.setItem(SWIPE_HINT_SEEN_KEY, 'true');
    } catch (_) {}
  }, []);

  const hasSeenExpandHint = useCallback(() => {
    try {
      return localStorage.getItem(EXPAND_HINT_SEEN_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const dismissExpandHint = useCallback(() => {
    setShowExpandHint(false);
    try {
      localStorage.setItem(EXPAND_HINT_SEEN_KEY, 'true');
    } catch (_) {}
  }, []);

  const hasSeenFeedHint = useCallback(() => {
    try {
      return localStorage.getItem(FEED_HINT_SEEN_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const dismissFeedHint = useCallback(() => {
    setShowFeedHint(false);
    try {
      localStorage.setItem(FEED_HINT_SEEN_KEY, 'true');
    } catch (_) {}
  }, []);

  const hasSeenTradeHint = useCallback(() => {
    try {
      return localStorage.getItem(TRADE_HINT_SEEN_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const dismissTradeHint = useCallback(() => {
    setShowTradeHint(false);
    try {
      localStorage.setItem(TRADE_HINT_SEEN_KEY, 'true');
    } catch (_) {}
  }, []);

  const hasSeenAnalyticsHint = useCallback(() => {
    try {
      return localStorage.getItem(ANALYTICS_HINT_SEEN_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const dismissAnalyticsHint = useCallback(() => {
    setShowAnalyticsHint(false);
    try {
      localStorage.setItem(ANALYTICS_HINT_SEEN_KEY, 'true');
    } catch (_) {}
  }, []);

  const hasSeenHelpHint = useCallback(() => {
    try {
      return localStorage.getItem(HELP_HINT_SEEN_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const dismissHelpHint = useCallback(() => {
    setShowHelpHint(false);
    try {
      localStorage.setItem(HELP_HINT_SEEN_KEY, 'true');
    } catch (_) {}
  }, []);

  // Generic seen/dismiss helpers + chain starters for the extended tour steps:
  // top traders button → tap a trader → trader profile → close → live 1m zoom.
  // Each starter silently skips steps the user has already seen and falls
  // through to the next sensible one.
  const hasSeenHintKey = useCallback((key) => {
    try {
      return localStorage.getItem(key) === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const markHintKeySeen = useCallback((key) => {
    try {
      localStorage.setItem(key, 'true');
    } catch (_) {}
  }, []);

  const dismissTopTradersHint = useCallback(() => {
    setShowTopTradersHint(false);
    markHintKeySeen(TOP_TRADERS_HINT_SEEN_KEY);
  }, [markHintKeySeen]);

  const dismissTraderRowHint = useCallback(() => {
    setShowTraderRowHint(false);
    markHintKeySeen(TRADER_ROW_HINT_SEEN_KEY);
  }, [markHintKeySeen]);

  const dismissTraderProfileHint = useCallback(() => {
    setShowTraderProfileHint(false);
    markHintKeySeen(TRADER_PROFILE_HINT_SEEN_KEY);
  }, [markHintKeySeen]);

  const dismissProfileCloseHint = useCallback(() => {
    setShowProfileCloseHint(false);
    markHintKeySeen(PROFILE_CLOSE_HINT_SEEN_KEY);
  }, [markHintKeySeen]);

  const dismissLiveZoomHint = useCallback(() => {
    setShowLiveZoomHint(false);
    markHintKeySeen(LIVE_ZOOM_HINT_SEEN_KEY);
  }, [markHintKeySeen]);

  const startHelpHint = useCallback(() => {
    if (!hasSeenHintKey(HELP_HINT_SEEN_KEY)) setShowHelpHint(true);
  }, [hasSeenHintKey]);

  const startLiveZoomHint = useCallback(() => {
    if (!hasSeenHintKey(LIVE_ZOOM_HINT_SEEN_KEY)) {
      setShowLiveZoomHint(true);
    } else {
      startHelpHint();
    }
  }, [hasSeenHintKey, startHelpHint]);

  const startProfileCloseHint = useCallback(() => {
    if (!hasSeenHintKey(PROFILE_CLOSE_HINT_SEEN_KEY)) {
      setShowProfileCloseHint(true);
    } else {
      startLiveZoomHint();
    }
  }, [hasSeenHintKey, startLiveZoomHint]);

  const startTraderProfileHint = useCallback(() => {
    if (!hasSeenHintKey(TRADER_PROFILE_HINT_SEEN_KEY)) {
      setShowTraderProfileHint(true);
    } else {
      startProfileCloseHint();
    }
  }, [hasSeenHintKey, startProfileCloseHint]);

  const startTraderRowHint = useCallback(() => {
    if (!hasSeenHintKey(TRADER_ROW_HINT_SEEN_KEY)) {
      setShowTraderRowHint(true);
    } else {
      startLiveZoomHint();
    }
  }, [hasSeenHintKey, startLiveZoomHint]);

  // Entry point for the extended section. If the button step was already seen
  // the mid-flow steps (row/profile/close) can't meaningfully resume, so the
  // fallthrough jumps straight to the live-zoom step.
  const startTraderTour = useCallback(() => {
    if (!hasSeenHintKey(TOP_TRADERS_HINT_SEEN_KEY)) {
      setShowTopTradersHint(true);
    } else {
      startLiveZoomHint();
    }
  }, [hasSeenHintKey, startLiveZoomHint]);

  const restartOnboardingHints = useCallback(() => {
    try {
      localStorage.removeItem(SWIPE_HINT_SEEN_KEY);
      localStorage.removeItem(FEED_HINT_SEEN_KEY);
      localStorage.removeItem(EXPAND_HINT_SEEN_KEY);
      localStorage.removeItem(TRADE_HINT_SEEN_KEY);
      localStorage.removeItem(ANALYTICS_HINT_SEEN_KEY);
      localStorage.removeItem(HELP_HINT_SEEN_KEY);
      localStorage.removeItem(TOP_TRADERS_HINT_SEEN_KEY);
      localStorage.removeItem(TRADER_ROW_HINT_SEEN_KEY);
      localStorage.removeItem(TRADER_PROFILE_HINT_SEEN_KEY);
      localStorage.removeItem(PROFILE_CLOSE_HINT_SEEN_KEY);
      localStorage.removeItem(LIVE_ZOOM_HINT_SEEN_KEY);
    } catch (_) {}
    setShowFeedHint(false);
    setShowExpandHint(false);
    setShowTradeHint(false);
    setShowAnalyticsHint(false);
    setShowHelpHint(false);
    setShowTopTradersHint(false);
    setShowTraderRowHint(false);
    setShowTraderProfileHint(false);
    setShowProfileCloseHint(false);
    setShowLiveZoomHint(false);
    liveZoomAutoCollapseRef.current = false;
    setCurrentIndex(0);
    setSettledIndex(0);
    setPreloadIndex(null);
    setExpandedCoin(null);
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    setShowSwipeHint(true);
  }, []);

  // Auto-dismiss nudge after 12 seconds so it doesn't persist forever
  useEffect(() => {
    if (!isFirstVisit) return;
    const nudgeTimer = setTimeout(() => {
      setIsFirstVisit(false);
    }, 12000);
    return () => clearTimeout(nudgeTimer);
  }, [isFirstVisit]);

  useEffect(() => {
    if (!showSwipeHint || onlyFavorites || coins.length < 2 || isTutorialActive) return;
    const hintTimer = setTimeout(dismissSwipeHint, 9000);
    return () => clearTimeout(hintTimer);
  }, [showSwipeHint, onlyFavorites, coins.length, isTutorialActive, dismissSwipeHint]);

  useEffect(() => {
    if (showSwipeHint && currentIndex > 0) {
      dismissSwipeHint();
      if (!hasSeenFeedHint()) {
        setShowFeedHint(true);
      } else if (!hasSeenExpandHint()) {
        setShowExpandHint(true);
      }
    }
  }, [showSwipeHint, currentIndex, dismissSwipeHint, hasSeenFeedHint, hasSeenExpandHint]);

  // Feed-switch hint: ring around the coin's name at the top of the card.
  useEffect(() => {
    if (!showFeedHint || onlyFavorites || isTutorialActive) return;

    const updateTarget = () => {
      const nameButton = document.querySelector('.modern-coin-slide.active .banner-coin-name');
      if (!nameButton) {
        setFeedHintTarget(null);
        return;
      }
      const rect = nameButton.getBoundingClientRect();
      setFeedHintTarget({
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      });
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    window.addEventListener('resize', updateTarget);

    return () => {
      clearInterval(targetTimer);
      window.removeEventListener('resize', updateTarget);
    };
  }, [showFeedHint, onlyFavorites, isTutorialActive]);

  useEffect(() => {
    if (!showFeedHint) return;
    const hintTimer = setTimeout(() => {
      dismissFeedHint();
      if (!hasSeenExpandHint()) setShowExpandHint(true);
    }, 10000);
    return () => clearTimeout(hintTimer);
  }, [showFeedHint, dismissFeedHint, hasSeenExpandHint]);

  // Tapping the coin's name (opens the feed-switch popup) completes this step.
  useEffect(() => {
    if (!showFeedHint) return;
    const handleNameClick = (event) => {
      if (event.target.closest('.banner-coin-name') || event.target.closest('.info-layer-token-ticker')) {
        dismissFeedHint();
        if (!hasSeenExpandHint()) {
          setShowExpandHint(true);
        }
      }
    };

    document.addEventListener('click', handleNameClick, true);
    return () => document.removeEventListener('click', handleNameClick, true);
  }, [showFeedHint, dismissFeedHint, hasSeenExpandHint]);

  // Skipping ahead: expanding the card while the feed hint is up moves the
  // chain straight to the trade hint.
  useEffect(() => {
    if (showFeedHint && expandedCoin) {
      dismissFeedHint();
      dismissExpandHint();
      if (isMobile && !hasSeenTradeHint()) {
        setShowTradeHint(true);
      }
    }
  }, [showFeedHint, expandedCoin, isMobile, dismissFeedHint, dismissExpandHint, hasSeenTradeHint]);

  useEffect(() => {
    if (!showExpandHint || onlyFavorites || isTutorialActive) return;

    const updateTargets = () => {
      const topButton = document.querySelector('.modern-coin-slide.active .expand-handle');
      const bottomButton = document.querySelector('.coin-expand-swipe-arrow') || document.querySelector('.chart-expand-card-btn');
      const toTarget = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left + rect.width / 2,
          top: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height
        };
      };

      setExpandHintTargets({
        top: toTarget(topButton),
        bottom: toTarget(bottomButton)
      });
    };

    updateTargets();
    const targetTimer = setInterval(updateTargets, 300);
    window.addEventListener('resize', updateTargets);

    return () => {
      clearInterval(targetTimer);
      window.removeEventListener('resize', updateTargets);
    };
  }, [showExpandHint, onlyFavorites, isTutorialActive]);

  useEffect(() => {
    if (!showExpandHint) return;
    const hintTimer = setTimeout(dismissExpandHint, 10000);
    return () => clearTimeout(hintTimer);
  }, [showExpandHint, dismissExpandHint]);

  useEffect(() => {
    if (showExpandHint && expandedCoin) {
      dismissExpandHint();
      if (isMobile && !hasSeenTradeHint()) {
        setShowTradeHint(true);
      } else if (!hasSeenAnalyticsHint()) {
        setShowAnalyticsHint(true);
      }
    }
  }, [showExpandHint, expandedCoin, isMobile, dismissExpandHint, hasSeenTradeHint, hasSeenAnalyticsHint]);

  // Trade hint: swipe right to buy / swipe left for the slide-over limit order.
  useEffect(() => {
    if (!showTradeHint) return;
    const hintTimer = setTimeout(() => {
      dismissTradeHint();
      if (!hasSeenAnalyticsHint()) setShowAnalyticsHint(true);
    }, 11000);
    return () => clearTimeout(hintTimer);
  }, [showTradeHint, dismissTradeHint, hasSeenAnalyticsHint]);

  // First interaction after the trade hint appears (a swipe or a tap) completes it.
  // Short grace period so the tap that expanded the card doesn't dismiss it unread.
  useEffect(() => {
    if (!showTradeHint || !expandedCoin) return;
    const shownAt = Date.now();
    const handleInteraction = () => {
      if (Date.now() - shownAt < 1200) return;
      dismissTradeHint();
      if (!hasSeenAnalyticsHint()) setShowAnalyticsHint(true);
    };

    document.addEventListener('touchend', handleInteraction, true);
    document.addEventListener('click', handleInteraction, true);
    return () => {
      document.removeEventListener('touchend', handleInteraction, true);
      document.removeEventListener('click', handleInteraction, true);
    };
  }, [showTradeHint, expandedCoin, dismissTradeHint, hasSeenAnalyticsHint]);

  useEffect(() => {
    if (!showAnalyticsHint || onlyFavorites || isTutorialActive || !expandedCoin) return;

    const updateTarget = () => {
      const metricsRow = document.querySelector('.modern-coin-slide.active .header-metrics-grid');
      if (!metricsRow) {
        setAnalyticsHintTarget(null);
        return;
      }

      const rect = metricsRow.getBoundingClientRect();
      setAnalyticsHintTarget({
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      });
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    window.addEventListener('resize', updateTarget);

    return () => {
      clearInterval(targetTimer);
      window.removeEventListener('resize', updateTarget);
    };
  }, [showAnalyticsHint, onlyFavorites, isTutorialActive, expandedCoin]);

  useEffect(() => {
    if (!showAnalyticsHint) return;
    const hintTimer = setTimeout(() => {
      dismissAnalyticsHint();
      startTraderTour();
    }, 10000);
    return () => clearTimeout(hintTimer);
  }, [showAnalyticsHint, dismissAnalyticsHint, startTraderTour]);

  useEffect(() => {
    if (!showAnalyticsHint) return;
    const handleMetricClick = (event) => {
      if (event.target.closest('.header-metric')) {
        dismissAnalyticsHint();
        startTraderTour();
      }
    };

    document.addEventListener('click', handleMetricClick, true);
    return () => document.removeEventListener('click', handleMetricClick, true);
  }, [showAnalyticsHint, dismissAnalyticsHint, startTraderTour]);

  useEffect(() => {
    const handleRestartOnboarding = () => {
      restartOnboardingHints();
    };

    window.addEventListener('moonfeed:restart-onboarding', handleRestartOnboarding);
    return () => window.removeEventListener('moonfeed:restart-onboarding', handleRestartOnboarding);
  }, [restartOnboardingHints]);

  useEffect(() => {
    if (!showHelpHint || onlyFavorites || isTutorialActive) return;

    const updateTarget = () => {
      const helpButton = document.querySelector('.moonfeed-hamburger-wrapper .moonfeed-info-button');
      if (!helpButton) {
        setHelpHintTarget(null);
        return;
      }

      const rect = helpButton.getBoundingClientRect();
      setHelpHintTarget({
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      });
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    window.addEventListener('resize', updateTarget);

    return () => {
      clearInterval(targetTimer);
      window.removeEventListener('resize', updateTarget);
    };
  }, [showHelpHint, onlyFavorites, isTutorialActive]);

  useEffect(() => {
    if (!showHelpHint) return;
    const hintTimer = setTimeout(dismissHelpHint, 10000);
    return () => clearTimeout(hintTimer);
  }, [showHelpHint, dismissHelpHint]);

  // Users who finished the original tour before the trader/live-zoom steps
  // existed: pick the chain up at the first unseen new step, once, shortly
  // after the feed loads. (Fresh users reach these steps through the chain
  // itself, so this only fires when the old chain's final step — the help
  // hint — was already seen.)
  useEffect(() => {
    if (onlyFavorites || isTutorialActive || coins.length === 0) return;
    if (!hasSeenHintKey(HELP_HINT_SEEN_KEY)) return;
    if (hasSeenHintKey(TOP_TRADERS_HINT_SEEN_KEY) && hasSeenHintKey(LIVE_ZOOM_HINT_SEEN_KEY)) return;
    const startTimer = setTimeout(startTraderTour, 2200);
    return () => clearTimeout(startTimer);
  }, [coins.length, onlyFavorites, isTutorialActive, hasSeenHintKey, startTraderTour]);

  // Top-traders hint: ring around the trophy action button. Completed by
  // tapping the button (or the panel opening via any other path).
  useEffect(() => {
    if (!showTopTradersHint || onlyFavorites || isTutorialActive) return;

    const updateTarget = () => {
      if (document.querySelector('.top-traders-container.open')) {
        dismissTopTradersHint();
        startTraderRowHint();
        return;
      }
      const button = pickVisibleElement('.tiktok-action-btn[aria-label="Open top PnL traders"]');
      setTopTradersHintTarget(button ? rectToTarget(button.getBoundingClientRect()) : null);
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    window.addEventListener('resize', updateTarget);

    return () => {
      clearInterval(targetTimer);
      window.removeEventListener('resize', updateTarget);
    };
  }, [showTopTradersHint, onlyFavorites, isTutorialActive, dismissTopTradersHint, startTraderRowHint]);

  useEffect(() => {
    if (!showTopTradersHint) return;
    const handleTopTradersClick = (event) => {
      if (event.target.closest('.tiktok-action-btn[aria-label="Open top PnL traders"]')) {
        dismissTopTradersHint();
        startTraderRowHint();
      }
    };

    document.addEventListener('click', handleTopTradersClick, true);
    return () => document.removeEventListener('click', handleTopTradersClick, true);
  }, [showTopTradersHint, dismissTopTradersHint, startTraderRowHint]);

  useEffect(() => {
    if (!showTopTradersHint) return;
    const hintTimer = setTimeout(() => {
      dismissTopTradersHint();
      startLiveZoomHint();
    }, 12000);
    return () => clearTimeout(hintTimer);
  }, [showTopTradersHint, dismissTopTradersHint, startLiveZoomHint]);

  // Trader-row hint: ring around the first row of the open Top Traders panel.
  // Completed by tapping a trader (or the profile opening via any path).
  useEffect(() => {
    if (!showTraderRowHint || isTutorialActive) return;
    let panelMisses = 0;

    const updateTarget = () => {
      // Tapping a top trader opens the wallet profile OR the position detail
      // sheet (when a mint is attached) — either counts for this step.
      if (document.querySelector('.wpv-root, .pdv-root')) {
        dismissTraderRowHint();
        startTraderProfileHint();
        return;
      }
      const panel = document.querySelector('.top-traders-container.open');
      if (!panel) {
        // The panel can take a beat to appear after the button tap (a
        // collapsed card expands first) — only skip ahead if it stays closed.
        panelMisses += 1;
        if (panelMisses >= 10) {
          dismissTraderRowHint();
          startLiveZoomHint();
        }
        return;
      }
      panelMisses = 0;
      const row = panel.querySelector('.traders-scroll-window .table-row');
      setTraderRowHintTarget(row ? rectToTarget(row.getBoundingClientRect()) : null);
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    return () => clearInterval(targetTimer);
  }, [showTraderRowHint, isTutorialActive, dismissTraderRowHint, startTraderProfileHint, startLiveZoomHint]);

  useEffect(() => {
    if (!showTraderRowHint) return;
    const handleTraderClick = (event) => {
      if (event.target.closest('.top-traders-container.open .col-wallet')) {
        dismissTraderRowHint();
        startTraderProfileHint();
      }
    };

    document.addEventListener('click', handleTraderClick, true);
    return () => document.removeEventListener('click', handleTraderClick, true);
  }, [showTraderRowHint, dismissTraderRowHint, startTraderProfileHint]);

  useEffect(() => {
    if (!showTraderRowHint) return;
    const hintTimer = setTimeout(() => {
      dismissTraderRowHint();
      startLiveZoomHint();
    }, 12000);
    return () => clearTimeout(hintTimer);
  }, [showTraderRowHint, dismissTraderRowHint, startLiveZoomHint]);

  // Trader-profile callout: shown while the wallet profile overlay is open.
  // Informational only — auto-advances to the close-button step.
  useEffect(() => {
    if (!showTraderProfileHint || isTutorialActive) return;
    let profileMisses = 0;

    const updateTarget = () => {
      const profile = document.querySelector('.wpv-root, .pdv-root');
      if (!profile) {
        // The profile opens a beat after the row tap (React render + slide-in
        // animation) — only skip ahead if it never shows up / stays closed.
        profileMisses += 1;
        if (profileMisses >= 8) {
          dismissTraderProfileHint();
          startLiveZoomHint();
        }
        return;
      }
      profileMisses = 0;
      const header = profile.querySelector('.pv-ig-top-row, .pdv-hero-banner');
      setTraderProfileHintTarget(header ? rectToTarget(header.getBoundingClientRect()) : null);
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 400);
    return () => clearInterval(targetTimer);
  }, [showTraderProfileHint, isTutorialActive, dismissTraderProfileHint, startLiveZoomHint]);

  useEffect(() => {
    if (!showTraderProfileHint) return;
    const hintTimer = setTimeout(() => {
      dismissTraderProfileHint();
      startProfileCloseHint();
    }, 5500);
    return () => clearTimeout(hintTimer);
  }, [showTraderProfileHint, dismissTraderProfileHint, startProfileCloseHint]);

  // Profile-close hint: ring around the profile's back button. Completed by
  // tapping it (or the profile closing via its swipe-back gesture).
  useEffect(() => {
    if (!showProfileCloseHint || isTutorialActive) return;
    let profileMisses = 0;

    const updateTarget = () => {
      const profile = document.querySelector('.wpv-root, .pdv-root');
      if (!profile) {
        profileMisses += 1;
        if (profileMisses >= 8) {
          dismissProfileCloseHint();
          startLiveZoomHint();
        }
        return;
      }
      profileMisses = 0;
      const back = profile.querySelector('.wpv-back, .pdv-back');
      setProfileCloseHintTarget(back ? rectToTarget(back.getBoundingClientRect()) : null);
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    return () => clearInterval(targetTimer);
  }, [showProfileCloseHint, isTutorialActive, dismissProfileCloseHint, startLiveZoomHint]);

  useEffect(() => {
    if (!showProfileCloseHint) return;
    const handleCloseClick = (event) => {
      if (event.target.closest('.wpv-back, .pdv-back')) {
        dismissProfileCloseHint();
        startLiveZoomHint();
      }
    };

    document.addEventListener('click', handleCloseClick, true);
    return () => document.removeEventListener('click', handleCloseClick, true);
  }, [showProfileCloseHint, dismissProfileCloseHint, startLiveZoomHint]);

  useEffect(() => {
    if (!showProfileCloseHint) return;
    const hintTimer = setTimeout(() => {
      dismissProfileCloseHint();
      startLiveZoomHint();
    }, 10000);
    return () => clearTimeout(hintTimer);
  }, [showProfileCloseHint, dismissProfileCloseHint, startLiveZoomHint]);

  // Live 1m zoom hint: ring around the collapsed chart's zoom button. The
  // button only exists on a collapsed, loaded chart, so this polls until it
  // appears and moves on to the help step if it never does.
  useEffect(() => {
    if (!showLiveZoomHint || onlyFavorites || isTutorialActive) return;

    const updateTarget = () => {
      const button = pickVisibleElement('.native-chart-live-zoom-btn');
      if (!button && isMobile && !liveZoomAutoCollapseRef.current) {
        // The tour reaches this step with the card still expanded (the top
        // traders flow expands it) — collapse it once so the button exists.
        const collapseControl = pickVisibleElement('.coin-expand-swipe-arrow');
        if (document.querySelector('.modern-coin-slide.expanded') && collapseControl) {
          liveZoomAutoCollapseRef.current = true;
          collapseControl.click();
        }
      }
      setLiveZoomHintTarget(button ? rectToTarget(button.getBoundingClientRect()) : null);
    };

    updateTarget();
    const targetTimer = setInterval(updateTarget, 300);
    window.addEventListener('resize', updateTarget);

    return () => {
      clearInterval(targetTimer);
      window.removeEventListener('resize', updateTarget);
    };
  }, [showLiveZoomHint, onlyFavorites, isTutorialActive, isMobile]);

  useEffect(() => {
    if (!showLiveZoomHint) return;
    const handleLiveZoomClick = (event) => {
      if (event.target.closest('.native-chart-live-zoom-btn')) {
        dismissLiveZoomHint();
        startHelpHint();
      }
    };

    document.addEventListener('click', handleLiveZoomClick, true);
    return () => document.removeEventListener('click', handleLiveZoomClick, true);
  }, [showLiveZoomHint, dismissLiveZoomHint, startHelpHint]);

  useEffect(() => {
    if (!showLiveZoomHint) return;
    const hintTimer = setTimeout(() => {
      dismissLiveZoomHint();
      startHelpHint();
    }, 12000);
    return () => clearTimeout(hintTimer);
  }, [showLiveZoomHint, dismissLiveZoomHint, startHelpHint]);

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
        
        // Skip if already in enrichment cache (backend will handle rugcheck retries)
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
          // Preserve image fields - never let enrichment overwrite with undefined/null
          profileImage: enrichedData.profileImage || coin.profileImage,
          image: enrichedData.image || coin.image,
          logo: enrichedData.logo || coin.logo,
          icon: enrichedData.icon || coin.icon,
          enriched: enrichedData.enriched || true,
          cleanChartData: enrichedData.cleanChartData,
          priceChange: enrichedData.priceChange || enrichedData.priceChanges,
          priceChanges: enrichedData.priceChanges || enrichedData.priceChange,
          // Rugcheck data (including unavailable flag)
          rugcheckScore: enrichedData.rugcheckScore,
          rugcheckVerified: enrichedData.rugcheckVerified,
          rugcheckProcessedAt: enrichedData.rugcheckProcessedAt,
          rugcheckError: enrichedData.rugcheckError,
          rugcheckUnavailable: enrichedData.rugcheckUnavailable, // NEW: Track when rugcheck times out
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

  // Cache merged coin+enrichment objects keyed by mintAddress so a re-render
  // triggered by ANY coin's enrichment arriving doesn't hand every other
  // already-enriched CoinCard a brand-new object reference (which would
  // defeat React.memo and re-render cards that didn't actually change).
  const mergedCoinCacheRef = useRef(new Map());

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
      const cached = mergedCoinCacheRef.current.get(coin.mintAddress);
      if (cached && cached.coin === coin && cached.enriched === enriched) {
        return cached.result; // same inputs — reuse the same object reference
      }
      // Merge enriched data with original, preserving image fields if enrichment didn't supply them
      const result = {
        ...coin,
        ...enriched,
        banner: enriched.banner || coin.banner,
        profileImage: enriched.profileImage || coin.profileImage,
        image: enriched.image || coin.image,
        logo: enriched.logo || coin.logo,
        icon: enriched.icon || coin.icon,
      };
      mergedCoinCacheRef.current.set(coin.mintAddress, { coin, enriched, result });
      return result;
    }
    return coin;
  }, [enrichedCoins]);
  
  const getFeedEndpoint = useCallback((feedType, customFilters = advancedFilters) => {
    let endpoint = `${API_BASE}/trending`;

    if (feedType === 'custom' && customFilters) {
      const queryParams = new URLSearchParams();
      Object.entries(customFilters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParams.append(key, value);
        }
      });
      endpoint = `${API_BASE}/custom?${queryParams.toString()}`;
    } else if (feedType === 'new') {
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const limit = isMobileDevice ? 30 : 50;
      endpoint = `${API_BASE}/new?limit=${limit}`;
    } else if (feedType === 'graduating') {
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const limit = isMobileDevice ? 50 : 100;
      endpoint = `${API_BASE}/graduating?limit=${limit}`;
    } else if (feedType === 'dextrending') {
      endpoint = `${API_BASE}/dextrending`;
    } else if (feedType === 'whalefeed') {
      endpoint = `${API_BASE}/whalefeed`;
    }

    return endpoint;
  }, [API_BASE, advancedFilters]);

  const normalizeFeedCoins = useCallback((feedCoins, feedType) => {
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    const maxCoins = isMobileDevice ? 20 : 50;
    let normalizedCoins = [...feedCoins];

    if (isMobileDevice && normalizedCoins.length > maxCoins) {
      console.log(`📱 MOBILE LIMIT: Reducing ${feedType} from ${normalizedCoins.length} to ${maxCoins} coins to prevent crashes`);
      normalizedCoins = normalizedCoins.slice(0, maxCoins);
    }

    return normalizedCoins.map((coin) => ({
      ...coin,
      _moonfeedFeedType: feedType
    }));
  }, []);

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
        // Use favorites from props, or a single explicitly-passed coin (search result, etc.)
        const singleCoinList = singleCoin ? [singleCoin] : favorites;
        setCoins(singleCoinList);
        onTotalCoinsChange?.(singleCoinList.length); // Notify parent of total coins
        setLoading(false);
        return;
      }
      
      const currentFeedType = filters.type || 'trending';
      let endpoint = getFeedEndpoint(currentFeedType);
      let requestOptions = { 
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      console.log('🔥 TRENDING LOADING: Using trending endpoint for coin data');
      console.log('🔍 Fetch request details:', {
        filterType: currentFeedType,
        hasAdvancedFilters: !!advancedFilters,
        advancedFilters: advancedFilters
      });

      if (currentFeedType === 'custom' && advancedFilters) {
        console.log('🔍 Using custom filter endpoint:', endpoint);
        console.log('🔍 Filter params:', advancedFilters);
      } else if (currentFeedType === 'new') {
        console.log('🆕 Using NEW endpoint for emerging coins:', endpoint);
      } else if (currentFeedType === 'graduating') {
        console.log('🎓 Using GRADUATING endpoint for Pump.fun graduating tokens:', endpoint);
      } else if (currentFeedType === 'dextrending') {
        console.log(`🔥 Using DEXTRENDING endpoint for Dexscreener trending tokens:`, endpoint);
      } else if (currentFeedType === 'whalefeed') {
        console.log(`🐋 Using WHALEFEED endpoint for large established coins:`, endpoint);
      } else {
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
      
      const sortedCoins = normalizeFeedCoins(data.coins, currentFeedType);
      
      setCoins(sortedCoins);
      onTotalCoinsChange?.(sortedCoins.length); // Notify parent of total coins
      
      // DISABLE background enrichment on mobile completely to prevent crashes
      // Desktop users get enrichment, mobile users get lightweight experience
      console.log('📱 Mobile optimization: Background enrichment DISABLED for performance');
      console.log(`📊 Loaded ${sortedCoins.length} coins`);
      
    } catch (err) {
      console.error('❌ Error fetching coins:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onlyFavorites, favorites, singleCoin, filters, advancedFilters, getFeedEndpoint, normalizeFeedCoins]);

  const appendNextFeed = useCallback(async () => {
    if (!feedOrder.length || isLoadingMoreFeedRef.current || loading) return;
    if (onlyFavorites || filters.type === 'custom' || advancedFilters) return;

    const startingFeedType = filters.type || feedOrder[0];
    const loadedFeedTypes = loadedFeedTypesRef.current.length ? loadedFeedTypesRef.current : [startingFeedType];
    const lastFeedType = loadedFeedTypes[loadedFeedTypes.length - 1];
    const lastFeedIndex = feedOrder.indexOf(lastFeedType);
    if (lastFeedIndex === -1) return;

    const nextFeedType = feedOrder[(lastFeedIndex + 1) % feedOrder.length];
    isLoadingMoreFeedRef.current = true;

    try {
      const endpoint = getFeedEndpoint(nextFeedType, null);
      console.log(`🔁 Appending next feed (${nextFeedType}) from:`, endpoint);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.coins || !Array.isArray(data.coins) || data.coins.length === 0) {
        console.warn(`⚠️ No coins available to append for ${nextFeedType}`);
        return;
      }

      const nextCoins = normalizeFeedCoins(data.coins, nextFeedType);
      setCoins((previousCoins) => {
        const existingMints = new Set(previousCoins.map((coin) => coin.mintAddress || coin.tokenAddress || coin.id).filter(Boolean));
        const uniqueNextCoins = nextCoins.filter((coin) => {
          const key = coin.mintAddress || coin.tokenAddress || coin.id;
          return !key || !existingMints.has(key);
        });

        const combinedCoins = [...previousCoins, ...uniqueNextCoins];
        onTotalCoinsChange?.(combinedCoins.length);
        console.log(`✅ Appended ${uniqueNextCoins.length} ${nextFeedType} coins (${combinedCoins.length} total)`);
        return combinedCoins;
      });

      loadedFeedTypesRef.current = [...loadedFeedTypes, nextFeedType];
    } catch (err) {
      console.error(`❌ Error appending ${nextFeedType} feed:`, err);
    } finally {
      isLoadingMoreFeedRef.current = false;
    }
  }, [feedOrder, loading, onlyFavorites, filters.type, advancedFilters, getFeedEndpoint, normalizeFeedCoins, onTotalCoinsChange]);
  
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
    setSettledIndex(0);
    setPreloadIndex(null);
    trackedBuyAppliedRef.current = false;
    feedEndTriggerRef.current = null;
    loadedFeedTypesRef.current = filters.type === 'custom' ? [] : [filters.type || feedOrder[0] || 'trending'];
    setExpandedCoin(null); // Close any expanded cards

    // Once the new feed's coins arrive, jump back to where the user last was in it
    pendingFeedRestoreRef.current = !onlyFavorites && !singleCoin && !advancedFilters && filters.type !== 'custom';
    
    // Force garbage collection hint (not guaranteed, but helps)
    if (window.gc) {
      console.log('🗑️ Running manual garbage collection...');
      window.gc();
    }
    
    // Fetch new feed data
    fetchCoins();
  }, [filters.type, onlyFavorites, JSON.stringify(advancedFilters)]); // Use specific dependencies instead of fetchCoins

  // ── Feed position persistence ────────────────────────────────────────────
  // Save the coin the user is on (per feed) so we can return them to the exact
  // same spot after visiting another page or fully closing the app.
  useEffect(() => {
    if (onlyFavorites || singleCoin || advancedFilters) return;
    // Don't clobber the saved spot with index 0 before the restore effect has run
    if (pendingFeedRestoreRef.current) return;
    const feedType = filters.type || 'trending';
    if (feedType === 'custom' || coins.length === 0) return;
    const coin = coins[currentIndex];
    if (!coin) return;
    const mint = coin.mintAddress || coin.tokenAddress || coin.address;
    const dedupeKey = `${feedType}:${mint}:${currentIndex}`;
    if (lastSavedFeedPosRef.current === dedupeKey) return;
    lastSavedFeedPosRef.current = dedupeKey;
    try {
      localStorage.setItem(FEED_POS_KEY, JSON.stringify({ feed: feedType, mint, index: currentIndex, ts: Date.now() }));
    } catch (_) {}
  }, [currentIndex, coins, filters.type, onlyFavorites, singleCoin, advancedFilters]);

  // Restore the saved position once the feed's coins have loaded. Matches by
  // mint first (feed order can change between sessions), falls back to index.
  useEffect(() => {
    if (!pendingFeedRestoreRef.current || loading || coins.length === 0) return;
    pendingFeedRestoreRef.current = false;
    const feedType = filters.type || 'trending';
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(FEED_POS_KEY) || 'null'); } catch (_) {}
    if (!saved || saved.feed !== feedType) return;
    if (saved.ts && Date.now() - saved.ts > FEED_POS_MAX_AGE_MS) return;
    const mintOf = (c) => c.mintAddress || c.tokenAddress || c.address;
    let idx = saved.mint ? coins.findIndex((c) => mintOf(c) === saved.mint) : -1;
    if (idx < 0 && Number.isInteger(saved.index)) idx = Math.min(saved.index, coins.length - 1);
    if (idx <= 0) return;
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    setSettledIndex(idx);
    const coin = coins[idx];
    if (coin) onCurrentCoinChangeRef.current?.(coin, idx);
    requestAnimationFrame(() => {
      const container = scrollerRef.current;
      if (!container) return;
      const slideHeight = container.querySelector('.modern-coin-slide')?.offsetHeight || container.clientHeight || window.innerHeight;
      container.scrollTop = idx * slideHeight;
    });
  }, [coins.length, loading]);

  // ── Tracked-wallet buys woven into the feed ──────────────────────────────
  // Once per feed load: tag feed coins a tracked wallet recently bought, and
  // inject (up to 4) recently-bought coins that aren't in the feed as standard
  // coin cards. CoinCard shows a "<wallet> recently bought in" banner for any
  // coin carrying `trackedWalletBuy`.
  useEffect(() => {
    if (onlyFavorites || singleCoin) return undefined;
    if (!tradesLoaded || loading || coins.length === 0) return undefined;
    if (trackedBuyAppliedRef.current) return undefined;
    trackedBuyAppliedRef.current = true;

    const RECENT_BUY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recentBuys = new Map(); // mint -> latest recent buy + distinct-wallet count
    for (const [mint, trades] of tradesByMint) {
      const buys = trades.filter((t) => t.type === 'buy' && now - t.time < RECENT_BUY_MS);
      if (!buys.length) continue;
      const latest = buys[buys.length - 1]; // trades are sorted ascending by time
      recentBuys.set(mint, {
        label: latest.label,
        walletAddress: latest.walletAddress,
        time: latest.time,
        solAmount: latest.solAmount,
        usdAmount: latest.usdAmount,
        symbol: latest.symbol,
        image: latest.image,
        othersCount: new Set(buys.map((t) => t.walletAddress)).size - 1,
      });
    }
    if (recentBuys.size === 0) return undefined;

    const coinMint = (c) => c.mintAddress || c.tokenAddress || c.address;

    const applyToFeed = (injectedCoins) => {
      setCoins((prev) => {
        const inFeed = new Set(prev.map(coinMint));
        let next = prev.map((c) => {
          const buy = recentBuys.get(coinMint(c));
          return buy && !c.trackedWalletBuy ? { ...c, trackedWalletBuy: buy } : c;
        });
        const fresh = injectedCoins.filter((c) => !inFeed.has(coinMint(c)));
        if (fresh.length) {
          // Inject below the user's current position so indices they've seen don't shift
          let pos = Math.max(currentIndexRef.current + 2, 2);
          for (const c of fresh) {
            next.splice(Math.min(pos, next.length), 0, c);
            pos += 4;
          }
          onTotalCoinsChange?.(next.length);
        }
        return next;
      });
    };

    const feedMints = new Set(coins.map(coinMint));
    const missing = [...recentBuys.entries()]
      .filter(([mint]) => !feedMints.has(mint))
      .sort((a, b) => b[1].time - a[1].time)
      .slice(0, 4);

    if (!missing.length) {
      applyToFeed([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const enrichedList = await Promise.all(missing.map(async ([mint, buy]) => {
        try {
          const response = await fetch(`${API_BASE}/enrich-single`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              coin: {
                mintAddress: mint,
                tokenAddress: mint,
                symbol: buy.symbol,
                name: buy.symbol,
                image: buy.image,
              },
            }),
          });
          if (!response.ok) return null;
          const data = await response.json();
          const full = data?.coin;
          // Skip coins that couldn't be priced — a bare card would look broken
          if (!full || !(Number(full.price_usd ?? full.priceUsd ?? full.price) > 0)) return null;
          return {
            ...full,
            mintAddress: full.mintAddress || mint,
            trackedWalletBuy: buy,
            _moonfeedFeedType: filters.type || 'trending',
          };
        } catch (_) {
          return null;
        }
      }));
      if (cancelled) return;
      applyToFeed(enrichedList.filter(Boolean));
    })();

    return () => { cancelled = true; };
  }, [coins.length, tradesLoaded, tradesByMint, loading, onlyFavorites, singleCoin]);

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
    const snapToCurrentSlide = () => {
      if (!container) return;
      const slideHeight = container.querySelector('.modern-coin-slide')?.offsetHeight || container.clientHeight || window.innerHeight;
      const targetTop = currentIndexRef.current * slideHeight;
      container.scrollTop = targetTop;
    };
    
    if (isExpanded) {
      snapToCurrentSlide();
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
      snapToCurrentSlide();
      
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

  useEffect(() => {
    const container = scrollerRef.current;
    if (!container || coins.length === 0) return;

    let snapTimer = null;
    const snapToNearestSlide = () => {
      if (isScrollLocked.current || expandedCoinRef.current || isChartFullscreen.current) return;
      const slideHeight = container.querySelector('.modern-coin-slide')?.offsetHeight || container.clientHeight || window.innerHeight;
      if (!slideHeight) return;

      const nearestIndex = Math.max(0, Math.min(coinsRef.current.length - 1, Math.round(container.scrollTop / slideHeight)));
      const targetTop = nearestIndex * slideHeight;
      if (Math.abs(container.scrollTop - targetTop) > 2) {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    };

    const handleScroll = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snapToNearestSlide, 160);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearTimeout(snapTimer);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [coins.length]);

  // 🎯 INDEX TRACKER: IntersectionObserver — never blocks the scroll thread.
  // Reads all mutable state through refs so it only re-registers when the number
  // of slides changes (not on every scroll/enrichment). This avoids disconnecting
  // and re-observing 20 slides on each frame, a major scroll-jank source.
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container || coins.length === 0) return;

    const slides = container.querySelectorAll('.modern-coin-slide');
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollLocked.current || expandedCoinRef.current || isChartFullscreen.current) return;

        // Find the slide with the highest intersection ratio (most visible)
        let best = null;
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }

        if (best && best.intersectionRatio > 0.5) {
          const idx = parseInt(best.target.dataset.index, 10);
          if (!isNaN(idx) && idx !== currentIndexRef.current) {
            // startTransition marks this update as non-urgent so React won't
            // interrupt the native scroll animation to process it.
            startTransition(() => {
              setCurrentIndex(idx);

              const coin = coinsRef.current[idx];
              if (coin) {
                const enriched = enrichedCoinsRef.current.get(coin.mintAddress);
                const enrichedCoin = enriched ? { ...coin, ...enriched } : coin;
                onCurrentCoinChangeRef.current?.(enrichedCoin, idx);
              }
            });
          }
        }
      },
      { root: container, threshold: 0.5 }
    );

    slides.forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, [coins.length]);
  
  // Handle favorite toggle
  // useCallback keeps this reference stable across renders so it doesn't
  // defeat CoinCard's React.memo for every mounted (off-screen) card.
  const handleFavoriteToggle = useCallback((coin, priceAtToggle) => {
    if (!walletConnected) {
      openWalletConnect();
      return;
    }

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
      // Stamp the exact price shown on the card at the moment of tracking —
      // more reliable than re-deriving it later from a possibly-stale coin.price_usd.
      const trackedAtPrice = Number(priceAtToggle) || Number(coin.price_usd) || Number(coin.priceUsd) || Number(coin.price) || 0;
      newFavorites = [...favorites, { ...coin, savedAt: Date.now(), trackedAtPrice }];
      console.log('🔥 Adding to favorites, new count:', newFavorites.length);
    }
    
    onFavoritesChange?.(newFavorites);
    console.log('🔥 onFavoritesChange called with:', newFavorites.length, 'favorites');
  }, [favorites, onFavoritesChange, walletConnected, openWalletConnect]);

  // Stable handler for chart fullscreen changes (no per-coin data needed).
  const handleChartFullscreenChange = useCallback((isFs) => {
    isChartFullscreen.current = isFs;
    setChartFullscreenLock(isFs);
  }, []);
  
  // Handle Buy $MOO button click
  const handleBuyMoo = useCallback(async () => {
    console.log('🐄 Buy $MOO button clicked!');
    const MOO_ADDRESS = 'FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon';
    
    try {
      // Create a minimal coin object for MOO
      const mooCoin = {
        mintAddress: MOO_ADDRESS,
        symbol: 'MOO',
        name: 'Moonfeed',
        address: MOO_ADDRESS,
        isPumpFun: true  // Show bonding curve progress bar
      };
      
      console.log('🔄 Enriching $MOO coin...');
      
      // Call backend enrichment API
      const response = await fetch(`${API_BASE}/enrich-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mintAddress: MOO_ADDRESS,
          coin: mooCoin 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.coin) {
          console.log('✅ $MOO coin enriched successfully!');
          
          // Preserve isPumpFun so bonding curve bar is always shown
          const enrichedMoo = { isPumpFun: true, ...data.coin };
          
          // Replace the feed with just the MOO coin
          setCoins([enrichedMoo]);
          setCurrentIndex(0);
          
          // Store enriched data
          setEnrichedCoins(prev => new Map(prev).set(MOO_ADDRESS, enrichedMoo));
          
          // Notify parent components
          onTotalCoinsChange?.(1);
          onCurrentCoinChange?.(enrichedMoo, 0);
        } else {
          console.error('❌ Failed to enrich $MOO coin:', data);
        }
      } else {
        console.error('❌ Enrichment API error:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading $MOO coin:', error);
    }
  }, [API_BASE, onTotalCoinsChange, onCurrentCoinChange]);
  
  // Check if coin is favorite
  const isFavorite = (coin) => {
    return favorites.some(fav => 
      (fav.mintAddress || fav.tokenAddress) === (coin.mintAddress || coin.tokenAddress)
    );
  };

  // The price the coin was tracked at lives on the favorites entry (persisted
  // to the account), not on the feed's own coin object — look it up so it
  // survives remounts/reloads instead of relying on local component state.
  const getTrackedAtPrice = (coin) => {
    const fav = favorites.find(f =>
      (f.mintAddress || f.tokenAddress) === (coin.mintAddress || coin.tokenAddress)
    );
    return Number(fav?.trackedAtPrice) || 0;
  };

  const getTrackedAtTime = (coin) => {
    const fav = favorites.find(f =>
      (f.mintAddress || f.tokenAddress) === (coin.mintAddress || coin.tokenAddress)
    );
    return fav?.savedAt || fav?.timestamp || null;
  };
  
  // Get DexScreener chart for current and nearby coins
  const renderCoinWithChart = (coin, index) => {
    const isCurrentCoin = index === currentIndex;
    const isPreloadCoin = index === preloadIndex;
    
    // 🔥 OPTIMIZED: Only run effects for visible coins (current ± N)
    // Mobile: ±1 (3 active cards) — reduces simultaneous effects & GPU layers
    // Desktop: ±2 (5 active cards) — richer prefetch window on fast hardware
    const renderDistance = isMobile ? 1 : 2;
    const shouldShowChart = Math.abs(index - currentIndex) <= renderDistance;
    const isVisible = Math.abs(index - currentIndex) <= renderDistance;
    // Chart mounting uses the SETTLED index so charts never mount/unmount mid-swipe
    // (which would break scroll-snap). It catches up ~140ms after scrolling stops.
    // Mobile keeps only the settled card + the NEXT card's chart (lightweight
    // preload so scrolling down is instant) — at most 2 GeckoTerminal iframes at
    // rest, and 0 during a fast scroll (settledIndex/preloadIndex are frozen while
    // swiping). Each iframe is a full external web page (~tens of MB in WKWebView);
    // holding more is what pushes iOS into the memory-pressure crash.
    const chartRenderDistance = isMobile ? 0 : 2;
    const mountChart = isMobile
      ? (index === settledIndex || index === settledIndex + 1)
      : Math.abs(index - settledIndex) <= chartRenderDistance;
    
    
    // Use enriched coin data if available
    const enrichedCoin = getEnrichedCoin(coin);
    
    return (
      <div 
        key={coin.mintAddress || coin.tokenAddress || index}
        className={`modern-coin-slide ${isCurrentCoin ? 'active' : ''} ${expandedCoin === (coin.mintAddress || coin.tokenAddress) ? 'expanded' : ''}`}
        data-index={index}
      >
        <CoinCard
          coin={enrichedCoin}
          isFavorite={isFavorite(coin)}
          trackedAtPrice={getTrackedAtPrice(coin)}
          trackedAtTime={getTrackedAtTime(coin)}
          onFavoriteToggle={handleFavoriteToggle}
          onTradeClick={onTradeClick}
          onWalletClick={onWalletClick}
          isGraduating={coin.status === 'graduating'}
          isTrending={coin.source?.includes('trending')}
          isVisible={isVisible}
          mountChart={mountChart}
          onExpandChange={handleCoinExpandChange}
          isCurrentCard={isCurrentCoin || isPreloadCoin}
          isActiveCard={isCurrentCoin}
          onEnrichmentComplete={handleEnrichmentComplete}
          onChartFullscreenChange={handleChartFullscreenChange}
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

  // Preload the next card's chart shortly after landing so it's ready before scroll
  useEffect(() => {
    setPreloadIndex(null); // reset immediately on index change
    const t = setTimeout(() => {
      const nextIdx = currentIndex + 1;
      if (nextIdx < coins.length) setPreloadIndex(nextIdx);
    }, 120);
    return () => clearTimeout(t);
  }, [currentIndex, coins.length]);

  // Move the chart-mount window to the current card only AFTER scrolling settles.
  // While the user keeps swiping, currentIndex changes rapidly and this timer keeps
  // resetting, so settledIndex (and therefore the mounted charts) stays put — no
  // DOM mutation mid-scroll, so scroll-snap lands cleanly every time.
  useEffect(() => {
    const t = setTimeout(() => setSettledIndex(currentIndex), 140);
    return () => clearTimeout(t);
  }, [currentIndex]);

  useEffect(() => {
    if (!feedOrder.length || onlyFavorites || filters.type === 'custom' || advancedFilters) return;
    if (loading || coins.length === 0 || currentIndex !== coins.length - 1) return;
    if (expandedCoin || chartFullscreenLock || isScrollLocked.current) return;

    const triggerKey = `${loadedFeedTypesRef.current.join('>')}:${coins.length}`;
    if (feedEndTriggerRef.current === triggerKey) return;
    feedEndTriggerRef.current = triggerKey;

    const timer = setTimeout(() => {
      appendNextFeed();
    }, 450);

    return () => clearTimeout(timer);
  }, [currentIndex, coins.length, filters.type, onlyFavorites, advancedFilters, loading, expandedCoin, chartFullscreenLock, feedOrder.length, appendNextFeed]);

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
  }, [currentIndex, coins.length]); // Keep dependencies minimal to avoid re-render loops
  
  // Debug logging - reduce frequency to prevent console spam
  const shouldLog = Math.random() < 0.1; // Only log 10% of renders
  if (shouldLog) {
  // DEBUG: Render logging disabled to prevent console spam
  // console.log(`📊 ModernTokenScroller render: coins=${coins.length}, loading=${loading}, error=${error}, isMobile=${isMobile}, visibleRange=${JSON.stringify(visibleRange)}`);
  }
  
  if (loading && coins.length === 0) {
    return (
      <div className="modern-scroller-loading">
        <div className="moonfeed-loader" aria-hidden="true">
          <div className="moonfeed-loader-ring"></div>
          <div className="moonfeed-loader-core"></div>
        </div>
        <p>Loading moonfeed...</p>
      </div>
    );
  }
  
  // Special loading state when backend is initializing (NEW feed)
  if (isBackendLoading && coins.length === 0) {
    return (
      <div className="modern-scroller-loading">
        <div className="moonfeed-loader" aria-hidden="true">
          <div className="moonfeed-loader-ring"></div>
          <div className="moonfeed-loader-core"></div>
        </div>
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

  const getExpandCalloutStyle = (target, verticalOffset = 0) => {
    if (!target) return {};
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const calloutWidth = Math.min(238, viewportWidth - 32);
    const targetIsRightSide = target.left > viewportWidth / 2;
    const preferredLeft = targetIsRightSide
      ? target.left - calloutWidth - 18
      : target.left + 18;
    const preferredTop = target.top + verticalOffset;

    return {
      left: Math.max(16, Math.min(viewportWidth - calloutWidth - 16, preferredLeft)),
      top: Math.max(18, Math.min(viewportHeight - 90, preferredTop)),
      width: calloutWidth
    };
  };

  const getAnalyticsCalloutStyle = (target) => {
    if (!target) return {};
    const viewportWidth = window.innerWidth;
    const calloutWidth = Math.min(310, viewportWidth - 32);
    const preferredTop = target.top + target.height / 2 + 18;

    return {
      left: Math.max(16, Math.min(viewportWidth - calloutWidth - 16, target.left - calloutWidth / 2)),
      top: Math.max(18, Math.min(window.innerHeight - 88, preferredTop)),
      width: calloutWidth
    };
  };

  const getFeedCalloutStyle = (target) => {
    if (!target) return {};
    const viewportWidth = window.innerWidth;
    const calloutWidth = Math.min(300, viewportWidth - 32);

    return {
      left: Math.max(16, Math.min(viewportWidth - calloutWidth - 16, target.left - calloutWidth / 2)),
      top: Math.max(18, target.top + target.height / 2 + 34),
      width: calloutWidth
    };
  };

  const getHelpCalloutStyle = (target) => {
    if (!target) return {};
    const viewportWidth = window.innerWidth;
    const calloutWidth = Math.min(300, viewportWidth - 32);

    return {
      left: Math.max(16, Math.min(viewportWidth - calloutWidth - 16, target.left + 18)),
      top: Math.max(18, target.top + target.height / 2 + 14),
      width: calloutWidth
    };
  };

  // Shared positioner for the extended tour callouts: sits above targets in
  // the bottom half of the screen, below targets in the top half, clamped to
  // the viewport.
  const getTourCalloutStyle = (target, placement = 'auto') => {
    if (!target) return {};
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const calloutWidth = Math.min(280, viewportWidth - 32);
    const above = placement === 'above' || (placement === 'auto' && target.top > viewportHeight / 2);
    const preferredTop = above
      ? target.top - target.height / 2 - 86
      : target.top + target.height / 2 + 20;

    return {
      left: Math.max(16, Math.min(viewportWidth - calloutWidth - 16, target.left - calloutWidth / 2)),
      top: Math.max(18, Math.min(viewportHeight - 96, preferredTop)),
      width: calloutWidth
    };
  };
  
  return (
    <div className="modern-token-scroller">
      {/* Banner overlay buttons */}
      <div className="banner-overlay-buttons">
        {/* Moonfeed Info Button - top left (hidden where a back button takes this spot) */}
        {showFiltersButton && (
          <MoonfeedInfoButton 
            className="banner-positioned-left"
            showNudge={isFirstVisit}
            onBuyMoo={handleBuyMoo}
            onStartTutorial={() => {
              console.log('🎓 Starting Interactive Tutorial...');
              setIsFirstVisit(false);
              setIsTutorialActive(true);
            }}
          />
        )}
        
        {/* Search Button - top right (only show on main feed) */}
        {onSearchClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('🔍 Banner search button clicked!');
              onSearchClick && onSearchClick(); // Open search modal
            }}
            className="banner-search-button"
            title="Search coins"
            aria-label="Search coins"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      
      {/* Scrollable container */}
      <div 
        ref={scrollerRef}
        className={`modern-scroller-container ${(expandedCoin || chartFullscreenLock) ? 'scroll-locked' : ''}`}
      >
        {/* Render all coins - no virtual scrolling to prevent black screen during scroll */}
        {/* Note: Backend already limits to 20 coins on mobile, so rendering all is safe */}
        {coins.length > 0 ? (
          coins.map((coin, index) => renderCoinWithChart(coin, index))
        ) : (
          <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
            {loading ? 'Loading coins...' : 'No coins available'}
          </div>
        )}
      </div>

      {showSwipeHint && !onlyFavorites && !isTutorialActive && coins.length > 1 && currentIndex === 0 && (
        <div className="swipe-up-hint" aria-hidden="true">
          <div className="swipe-up-hint-backdrop" />
          <div className="swipe-up-hint-card">
            <div className="swipe-up-phone">
              <div className="swipe-up-finger" />
            </div>
            <div className="swipe-up-text">Swipe up for more</div>
          </div>
        </div>
      )}

      {showFeedHint && !onlyFavorites && !isTutorialActive && !expandedCoin && feedHintTarget && (
        <div className="feed-switch-hint" aria-hidden="true">
          <div className="feed-switch-hint-backdrop" />
          <div
            className="feed-switch-target-ring"
            style={{
              left: feedHintTarget.left,
              top: feedHintTarget.top,
              width: Math.min(feedHintTarget.width + 26, window.innerWidth - 28),
              height: feedHintTarget.height + 14
            }}
          />
          <div className="feed-switch-callout" style={getFeedCalloutStyle(feedHintTarget)}>
            Tap the coin's name, then tap the feed pill to swipe between feeds
          </div>
        </div>
      )}

      {showExpandHint && !onlyFavorites && !isTutorialActive && !expandedCoin && (
        <div className="expand-card-hint" aria-hidden="true">
          <div className="expand-card-hint-backdrop" />
          {expandHintTargets.top && (
            <>
              <div
                className="expand-card-target-ring expand-card-target-ring-top"
                style={{ left: expandHintTargets.top.left, top: expandHintTargets.top.top }}
              />
              <div
                className="expand-card-callout expand-card-callout-top"
                style={getExpandCalloutStyle(expandHintTargets.top, 24)}
              >
                Expand coin card for more info
              </div>
            </>
          )}
          {expandHintTargets.bottom && (
            <>
              <div
                className="expand-card-target-ring expand-card-target-ring-bottom"
                style={{ left: expandHintTargets.bottom.left, top: expandHintTargets.bottom.top }}
              />
              <div
                className="expand-card-swipe-demo"
                style={{ left: expandHintTargets.bottom.left, top: expandHintTargets.bottom.top }}
              >
                <div className="expand-card-swipe-finger" />
              </div>
              <div
                className="expand-card-callout expand-card-callout-bottom"
                style={getExpandCalloutStyle(expandHintTargets.bottom, -66)}
              >
                or slide up from here
              </div>
            </>
          )}
        </div>
      )}

      {showTradeHint && !onlyFavorites && !isTutorialActive && expandedCoin && (
        <div className="trade-swipe-hint" aria-hidden="true">
          <div className="trade-swipe-hint-backdrop" />
          <div className="trade-swipe-hint-card">
            <div className="trade-swipe-row">
              <span className="trade-swipe-arrow trade-swipe-arrow-right">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </span>
              <span className="trade-swipe-row-text">Swipe <strong>right</strong> to buy instantly</span>
            </div>
            <div className="trade-swipe-row">
              <span className="trade-swipe-arrow trade-swipe-arrow-left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="M11 6l-6 6 6 6" />
                </svg>
              </span>
              <span className="trade-swipe-row-text">Swipe <strong>left</strong> to slide out a limit order</span>
            </div>
          </div>
        </div>
      )}

      {showAnalyticsHint && !onlyFavorites && !isTutorialActive && expandedCoin && analyticsHintTarget && (
        <div className="analytics-breakdown-hint" aria-hidden="true">
          <div className="analytics-breakdown-hint-backdrop" />
          <div
            className="analytics-breakdown-target-ring"
            style={{
              left: analyticsHintTarget.left,
              top: analyticsHintTarget.top,
              width: Math.min(analyticsHintTarget.width, window.innerWidth - 28),
              height: analyticsHintTarget.height + 12
            }}
          />
          <div className="analytics-breakdown-callout" style={getAnalyticsCalloutStyle(analyticsHintTarget)}>
            Tap any coin analytics for a breakdown
          </div>
        </div>
      )}

      {showTopTradersHint && !onlyFavorites && !isTutorialActive && topTradersHintTarget && (
        <div className="tour-hint" aria-hidden="true">
          <div className="tour-hint-backdrop" />
          <div
            className="tour-hint-ring tour-hint-ring--round"
            style={{ left: topTradersHintTarget.left, top: topTradersHintTarget.top }}
          />
          <div className="tour-hint-callout" style={getTourCalloutStyle(topTradersHintTarget)}>
            Tap <strong>Top Traders</strong> to see this coin's most profitable wallets
          </div>
        </div>
      )}

      {showTraderRowHint && !isTutorialActive && traderRowHintTarget && (
        <div className="tour-hint" aria-hidden="true">
          <div className="tour-hint-backdrop" />
          <div
            className="tour-hint-ring"
            style={{
              left: traderRowHintTarget.left,
              top: traderRowHintTarget.top,
              width: Math.min(traderRowHintTarget.width + 16, window.innerWidth - 20),
              height: traderRowHintTarget.height + 12
            }}
          />
          <div className="tour-hint-callout" style={getTourCalloutStyle(traderRowHintTarget, 'below')}>
            Tap a top trader to open their profile
          </div>
        </div>
      )}

      {showTraderProfileHint && !isTutorialActive && (
        <div className="tour-hint tour-hint--overlay" aria-hidden="true">
          {traderProfileHintTarget && (
            <div
              className="tour-hint-ring"
              style={{
                left: traderProfileHintTarget.left,
                top: traderProfileHintTarget.top,
                width: Math.min(traderProfileHintTarget.width + 18, window.innerWidth - 20),
                height: traderProfileHintTarget.height + 14
              }}
            />
          )}
          <div
            className="tour-hint-callout"
            style={traderProfileHintTarget
              ? getTourCalloutStyle(traderProfileHintTarget, 'below')
              : { left: 16, top: 120, width: window.innerWidth - 32 }}
          >
            Trader profile — their position, PnL & every coin they trade
          </div>
        </div>
      )}

      {showProfileCloseHint && !isTutorialActive && profileCloseHintTarget && (
        <div className="tour-hint tour-hint--overlay" aria-hidden="true">
          <div
            className="tour-hint-ring tour-hint-ring--round"
            style={{ left: profileCloseHintTarget.left, top: profileCloseHintTarget.top }}
          />
          <div className="tour-hint-callout" style={getTourCalloutStyle(profileCloseHintTarget, 'below')}>
            Close to jump right back into the action
          </div>
        </div>
      )}

      {showLiveZoomHint && !onlyFavorites && !isTutorialActive && liveZoomHintTarget && (
        <div className="tour-hint" aria-hidden="true">
          <div className="tour-hint-backdrop" />
          <div
            className="tour-hint-ring tour-hint-ring--round"
            style={{ left: liveZoomHintTarget.left, top: liveZoomHintTarget.top }}
          />
          <div className="tour-hint-callout" style={getTourCalloutStyle(liveZoomHintTarget)}>
            Zoom to the <strong>live 1m price</strong> — tap again to zoom back out
          </div>
        </div>
      )}

      {showHelpHint && !onlyFavorites && !isTutorialActive && helpHintTarget && (
        <div className="help-section-hint" onClick={dismissHelpHint}>
          <div className="help-section-hint-backdrop" />
          <div
            className="help-section-target-ring"
            style={{ left: helpHintTarget.left, top: helpHintTarget.top }}
          />
          <div className="help-section-callout" style={getHelpCalloutStyle(helpHintTarget)}>
            More guides & info anytime — tap the lines in the top-left
          </div>
        </div>
      )}
      

      
      {/* Scroll indicator removed - was blocking expand button interactions */}

      {/* Interactive Tutorial Overlay */}
      <InteractiveTutorial 
        isActive={isTutorialActive} 
        onClose={() => {
          console.log('🎓 Tutorial closed');
          setIsTutorialActive(false);
          setIsFirstVisit(false);
        }} 
      />
    </div>
  );
};

export default ModernTokenScroller;
