import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import './InteractiveTutorial.css';

const TUTORIAL_COMPLETED_KEY = 'moonfeed_tutorial_completed';

const tutorialSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Interactive Mode! 🎓',
    description: 'This guided tour will help you understand the Moonfeed interface. Tap the right side of the screen to go forward, or the left side to go back. You can also use arrow keys or Escape to exit.',
    targetSelector: null,
    position: 'center',
  },
  {
    id: 'coin-name',
    title: 'Coin Name',
    description: 'This is the name of the token. You can click on it to copy the token\'s contract address to your clipboard — useful for looking it up on other platforms like Solscan or Birdeye.',
    targetSelector: '.banner-coin-name',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'coin-symbol',
    title: 'Token Ticker ($)',
    description: 'The ticker symbol (like $MOO or $DOGE) is how traders quickly identify a token. Think of it like a stock ticker — it\'s the shorthand everyone uses.',
    targetSelector: '.banner-coin-symbol',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'description',
    title: 'Coin Description',
    description: 'This short blurb tells you what the token is about — its theme, community, or purpose. Tap "read more" if available to see the full story. Understanding the narrative helps you decide if it\'s worth watching.',
    targetSelector: '.banner-coin-description-inline',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'follow-button',
    title: 'Follow Button ⭐',
    description: 'Tap "Follow" to save this coin to your favorites list. Following a coin lets you quickly check back on it later without scrolling through the feed.',
    targetSelector: '.banner-follow-button',
    position: 'left',
    highlight: true,
  },
  {
    id: 'price',
    title: 'Live Price',
    description: 'This is the real-time price of the token in USD. The green dot means the price feed is live. When it flashes green or red, the price just changed!',
    targetSelector: '.coin-price',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'price-change',
    title: 'Price Change %',
    description: 'Shows how much the price has changed in the last 24 hours. Green = price went up, Red = price went down. Tap it to see changes over multiple timeframes (5m, 1h, 6h, 24h).',
    targetSelector: '.price-change',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'metrics',
    title: 'Key Metrics',
    description: 'These numbers give you a quick health check: Market Cap (total value), Volume (trading activity), Liquidity (how easy to buy/sell), Age, and Holders. Higher numbers generally mean more established tokens.',
    targetSelector: '.header-metrics-grid',
    position: 'top',
    highlight: true,
  },
  {
    id: 'social-links',
    title: 'Social Links',
    description: 'Check the token\'s Twitter/X, Telegram, Discord, and website. Active social presence is a good sign — dead socials can be a red flag. Always verify the community before investing.',
    targetSelector: '.header-social-icons',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'chart',
    title: 'Price Chart 📈',
    description: 'The live price chart shows historical price movement. Hover or touch to see the price at any point in time. Use this to spot trends and patterns before making a decision.',
    targetSelector: '.twelve-chart-section',
    position: 'top',
    highlight: true,
  },
  {
    id: 'liquidity-lock',
    title: 'Liquidity & Safety 🔒',
    description: 'Look for the lock icon next to Liquidity — a green lock means the liquidity is locked and developers can\'t pull it (a "rug pull"). A red flag 🚩 means it\'s unlocked — be cautious!',
    targetSelector: '.header-metric-value-with-icon',
    position: 'top',
    highlight: true,
  },
  {
    id: 'scroll-navigation',
    title: 'Swipe to Discover 🚀',
    description: 'Swipe up or down to browse through tokens — each card is a different coin that meets our discovery criteria. It\'s like TikTok but for crypto!',
    targetSelector: null,
    position: 'center',
    highlight: false,
  },
  {
    id: 'complete',
    title: 'You\'re Ready! 🌙',
    description: 'You now know the basics of Moonfeed! Remember: Always DYOR (Do Your Own Research), check for liquidity locks, and only invest what you can afford to lose. Happy exploring!',
    targetSelector: null,
    position: 'center',
  },
];

/**
 * Clamp a popup rect so it stays inside the viewport with padding.
 */
const clampToViewport = (x, y, popupWidth, popupHeight, padding = 16) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Clamp horizontal — keep popup fully visible
  let clampedX = Math.max(padding + popupWidth / 2, Math.min(x, vw - padding - popupWidth / 2));
  // Clamp vertical
  let clampedY = Math.max(padding, Math.min(y, vh - padding - popupHeight));

  return { x: clampedX, y: clampedY };
};

const InteractiveTutorial = ({ isActive, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [arrowPosition, setArrowPosition] = useState({ x: 0, y: 0 });
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [missingTarget, setMissingTarget] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const popupRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  const step = tutorialSteps[currentStep];

  // Reset to step 0 when tutorial opens
  useEffect(() => {
    if (isActive) {
      setCurrentStep(0);
      setMissingTarget(false);
      setTransitioning(false);
    }
    return () => {
      clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [isActive]);

  // Auto-advance after a delay when target element is missing
  // Gives user time to read the "(not visible)" note, then moves on
  useEffect(() => {
    clearTimeout(autoAdvanceTimerRef.current);
    if (isActive && missingTarget && step?.targetSelector) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleNext();
      }, 3000); // 3 seconds to read, then skip
    }
    return () => clearTimeout(autoAdvanceTimerRef.current);
  }, [missingTarget, currentStep, isActive]);

  // Lock body scroll while tutorial is active
  useEffect(() => {
    if (isActive) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isActive]);

  // Keyboard navigation: arrow keys + Escape
  useEffect(() => {
    if (!isActive) return;

    const handleKey = (e) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          handlePrevious();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, currentStep]);

  // Position calculations with viewport clamping
  useEffect(() => {
    if (!isActive) return;

    const updatePositions = () => {
      if (step.targetSelector) {
        const element = document.querySelector(step.targetSelector);
        if (!element) {
          // Target element is missing — show popup centered with a note
          setMissingTarget(true);
          setPopupPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
          return;
        }

        setMissingTarget(false);
        const rect = element.getBoundingClientRect();

        // If the element is completely off-screen, treat as missing
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
          setMissingTarget(true);
          setPopupPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
          return;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        setArrowPosition({ x: centerX, y: centerY });

        // Highlight positioning
        if (step.highlight) {
          const highlight = document.querySelector('.tutorial-highlight');
          if (highlight) {
            highlight.style.left = `${rect.left - 6}px`;
            highlight.style.top = `${rect.top - 6}px`;
            highlight.style.width = `${rect.width + 12}px`;
            highlight.style.height = `${rect.height + 12}px`;
          }
        }

        // Estimate popup size for clamping (measured or fallback)
        const popupEl = popupRef.current;
        const pw = popupEl ? popupEl.offsetWidth : 300;
        const ph = popupEl ? popupEl.offsetHeight : 200;

        let popupX = centerX;
        let popupY = centerY;

        switch (step.position) {
          case 'top':
            popupY = rect.top - 20;
            break;
          case 'bottom':
            popupY = rect.bottom + 20;
            break;
          case 'left':
            popupX = rect.left - 20;
            popupY = centerY;
            break;
          case 'right':
            popupX = rect.right + 20;
            popupY = centerY;
            break;
          default:
            popupX = window.innerWidth / 2;
            popupY = window.innerHeight / 2;
        }

        // Clamp so the popup never goes off-screen
        const clamped = clampToViewport(popupX, popupY, pw, ph);
        setPopupPosition(clamped);
      } else {
        setMissingTarget(false);
        setPopupPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }
    };

    updatePositions();

    const handleUpdate = () => requestAnimationFrame(updatePositions);
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    // Also listen on the main scroller container (for TikTok-style scrolling)
    const scrollerEl = document.querySelector('.modern-scroller-container');
    if (scrollerEl) {
      scrollerEl.addEventListener('scroll', handleUpdate, { passive: true });
    }

    const interval = setInterval(updatePositions, 300);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      if (scrollerEl) {
        scrollerEl.removeEventListener('scroll', handleUpdate);
      }
      clearInterval(interval);
    };
  }, [currentStep, step, isActive]);

  const handleNext = useCallback(() => {
    if (transitioning) return;
    if (currentStep < tutorialSteps.length - 1) {
      setTransitioning(true);
      setCurrentStep((s) => s + 1);
      setTimeout(() => setTransitioning(false), 250);
    } else {
      // Mark tutorial as completed
      try {
        localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      } catch (_) { /* localStorage may be unavailable */ }
      onClose();
    }
  }, [currentStep, onClose, transitioning]);

  const handlePrevious = useCallback(() => {
    if (transitioning) return;
    if (currentStep > 0) {
      setTransitioning(true);
      setCurrentStep((s) => s - 1);
      setTimeout(() => setTransitioning(false), 250);
    }
  }, [currentStep, transitioning]);

  const handleScreenClick = useCallback((e) => {
    // Don't navigate if user clicked a button inside the popup
    if (e.target.closest('.tutorial-skip-button') || e.target.closest('.tutorial-close-button')) {
      return;
    }

    const clickX = e.clientX;
    if (clickX > window.innerWidth / 2) {
      handleNext();
    } else {
      handlePrevious();
    }
  }, [handleNext, handlePrevious]);

  // Touch swipe navigation for mobile
  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchEndRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchEndRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const dx = touchEndRef.current.x - touchStartRef.current.x;
    const dy = touchEndRef.current.y - touchStartRef.current.y;
    const MIN_SWIPE = 50;
    // Only register horizontal swipes (ignore vertical)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MIN_SWIPE) {
      if (dx < 0) {
        // Swipe left → next
        handleNext();
      } else {
        // Swipe right → previous
        handlePrevious();
      }
    }
    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [handleNext, handlePrevious]);

  if (!isActive) return null;

  const isWelcomeOrComplete = step.id === 'welcome' || step.id === 'complete';
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return createPortal(
    <div
      className="interactive-tutorial-overlay"
      onClick={handleScreenClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={`Interactive tutorial — Step ${currentStep + 1} of ${tutorialSteps.length}: ${step.title}`}
    >
      {/* Dark backdrop */}
      <div className="tutorial-backdrop" />

      {/* Highlight element if needed */}
      {step.highlight && step.targetSelector && !missingTarget && (
        <div className="tutorial-highlight" data-target={step.targetSelector} aria-hidden="true" />
      )}

      {/* Arrow pointing to element */}
      {step.targetSelector && !isWelcomeOrComplete && !missingTarget && (
        <div
          className="tutorial-arrow"
          aria-hidden="true"
          style={{
            left: `${arrowPosition.x}px`,
            top: `${arrowPosition.y}px`,
          }}
        >
          <div className="arrow-pointer">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <path
                d="M20 5 L20 25 M20 25 L15 20 M20 25 L25 20"
                stroke="#4a90e2"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Tutorial popup */}
      <div
        ref={popupRef}
        className={`tutorial-popup ${step.position} ${missingTarget ? 'center' : ''} ${transitioning ? 'step-transitioning' : ''}`}
        style={!isWelcomeOrComplete && !missingTarget ? {
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
        } : {}}
        role="status"
        aria-live="polite"
      >
        <div className="tutorial-popup-content">
          <h3>{step.title}</h3>
          <p>
            {missingTarget
              ? `${step.description} (This element isn't visible right now — skipping in a moment...)`
              : step.description}
          </p>

          {/* Progress indicator */}
          <div className="tutorial-progress">
            <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="progress-text">
              {currentStep + 1} / {tutorialSteps.length}
            </span>
          </div>

          {/* Navigation hints */}
          <div className="tutorial-nav-hints">
            {currentStep > 0 && (
              <span className="nav-hint left">← Tap left to go back</span>
            )}
            {currentStep < tutorialSteps.length - 1 && (
              <span className="nav-hint right">Tap right to continue →</span>
            )}
            {currentStep === tutorialSteps.length - 1 && (
              <button className="tutorial-close-button" onClick={(e) => {
                e.stopPropagation();
                try { localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true'); } catch (_) {}
                onClose();
              }}>
                Close Tutorial
              </button>
            )}
          </div>

          {/* Skip button */}
          {!isWelcomeOrComplete && (
            <button className="tutorial-skip-button" onClick={(e) => {
              e.stopPropagation();
              try { localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true'); } catch (_) {}
              onClose();
            }}>
              Skip Tutorial
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Check if the tutorial has been completed before */
InteractiveTutorial.hasCompleted = () => {
  try {
    return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
  } catch (_) {
    return false;
  }
};

/** Reset tutorial completion (for testing) */
InteractiveTutorial.resetCompletion = () => {
  try {
    localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
  } catch (_) {}
};

export default InteractiveTutorial;
