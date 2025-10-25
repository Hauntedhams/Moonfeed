import React, { useState, useEffect } from 'react';
import './InteractiveTutorial.css';

const tutorialSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Interactive Mode!',
    description: 'Click on the right half of the screen to learn about each feature. Click the left half to go back.',
    targetSelector: null,
    position: 'center',
  },
  {
    id: 'coin-name',
    title: 'Coin Name',
    description: 'Click on the coin name to copy its contract address to your clipboard. Perfect for quick access when you want to check the token elsewhere!',
    targetSelector: '.banner-coin-name',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'coin-symbol',
    title: 'Token Symbol ($)',
    description: 'This is the trading symbol for the token. It helps you quickly identify the coin across different platforms.',
    targetSelector: '.banner-coin-symbol',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'favorite-button',
    title: 'Favorites ⭐',
    description: 'Tap the star to add this coin to your favorites list. Access your saved coins anytime from the bottom navigation.',
    targetSelector: '.banner-favorites-button',
    position: 'left',
    highlight: true,
  },
  {
    id: 'description',
    title: 'Coin Description',
    description: 'Tap here to view the full description and details about the project. Learn what the token is about before trading.',
    targetSelector: '.banner-coin-description-inline',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'tabs',
    title: 'Information Tabs',
    description: 'Switch between different views: Overview for quick stats, Graph for price charts, Top Traders to see whale activity, and View Orders for Jupiter trading interface.',
    targetSelector: '.tabs-wrapper',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'market-cap',
    title: 'Market Cap',
    description: 'Shows the total value of all tokens in circulation. Higher market cap often indicates more stability, while lower cap means higher risk/reward potential.',
    targetSelector: '.market-cap-number',
    position: 'top',
    highlight: true,
  },
  {
    id: 'metrics',
    title: 'Key Metrics',
    description: 'View important data like 24h volume, liquidity, and price changes. These indicators help you assess trading activity and token health.',
    targetSelector: '.coin-stats',
    position: 'top',
    highlight: true,
  },
  {
    id: 'price',
    title: 'Live Price',
    description: 'Real-time price updates with visual indicators showing when the price changes. The green dot means the price feed is live!',
    targetSelector: '.coin-price',
    position: 'top',
    highlight: true,
  },
  {
    id: 'chart',
    title: 'Price Chart',
    description: 'Real-time price chart powered by DexScreener. Switch timeframes to analyze price movements and identify trends.',
    targetSelector: '.chart-container',
    position: 'top',
    highlight: true,
  },
  {
    id: 'liquidity-lock',
    title: 'Safety Indicators',
    description: 'Look for the green lock (🔒) which means liquidity is locked and cannot be removed by developers. Also check the Rugcheck score for contract safety.',
    targetSelector: '.liquidity-item',
    position: 'top',
    highlight: true,
  },
  {
    id: 'trade-button',
    title: 'Trade Button',
    description: 'Ready to trade? Tap here to open Jupiter\'s swap interface. All trades are processed securely through Jupiter and sent directly to your wallet.',
    targetSelector: '.bottom-trade-button',
    position: 'top',
    highlight: true,
  },
  {
    id: 'scroll-navigation',
    title: 'Scroll Navigation',
    description: 'Swipe up or down to browse through tokens. Each card shows a different coin that meets our criteria for potential mooners!',
    targetSelector: '.coin-scroller',
    position: 'center',
    highlight: false,
  },
  {
    id: 'filters',
    title: 'Filters & Feeds',
    description: 'Use the top tabs to switch between Trending, New, and Pump.fun feeds. Tap the filter icon to set custom parameters like market cap and liquidity ranges.',
    targetSelector: '.tabs-container',
    position: 'bottom',
    highlight: true,
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'You now know how to use Moonfeed! Remember: Always DYOR (Do Your Own Research), check for liquidity locks, and only invest what you can afford to lose. Happy trading!',
    targetSelector: null,
    position: 'center',
  },
];

const InteractiveTutorial = ({ isActive, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [arrowPosition, setArrowPosition] = useState({ x: 0, y: 0 });
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  const step = tutorialSteps[currentStep];

  useEffect(() => {
    if (!isActive) return;

    // Calculate arrow and popup positions based on target element
    const updatePositions = () => {
      if (step.targetSelector) {
        const element = document.querySelector(step.targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          setArrowPosition({ x: centerX, y: centerY });

          // Add highlight styling to element
          if (step.highlight) {
            const highlight = document.querySelector('.tutorial-highlight');
            if (highlight) {
              highlight.style.left = `${rect.left - 6}px`;
              highlight.style.top = `${rect.top - 6}px`;
              highlight.style.width = `${rect.width + 12}px`;
              highlight.style.height = `${rect.height + 12}px`;
            }
          }

          // Position popup based on step.position
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
              // center
              popupX = window.innerWidth / 2;
              popupY = window.innerHeight / 2;
          }

          setPopupPosition({ x: popupX, y: popupY });
        }
      } else {
        // Center position for welcome and complete screens
        setPopupPosition({ 
          x: window.innerWidth / 2, 
          y: window.innerHeight / 2 
        });
      }
    };

    updatePositions();
    // Update positions on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(updatePositions);
    };
    
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true); // Use capture to catch all scrolls
    
    // Also update periodically in case elements move
    const interval = setInterval(updatePositions, 100);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      clearInterval(interval);
    };
  }, [currentStep, step, isActive]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Tutorial complete
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleScreenClick = (e) => {
    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    // Right half = next, left half = previous
    if (clickX > screenWidth / 2) {
      handleNext();
    } else {
      handlePrevious();
    }
  };

  if (!isActive) return null;

  const isWelcomeOrComplete = step.id === 'welcome' || step.id === 'complete';
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <div className="interactive-tutorial-overlay" onClick={handleScreenClick}>
      {/* Dark overlay with cutout for highlighted element */}
      <div className="tutorial-backdrop" />
      
      {/* Highlight element if needed */}
      {step.highlight && step.targetSelector && (
        <div className="tutorial-highlight" data-target={step.targetSelector} />
      )}

      {/* Arrow pointing to element */}
      {step.targetSelector && !isWelcomeOrComplete && (
        <div 
          className="tutorial-arrow"
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
        className={`tutorial-popup ${step.position}`}
        style={!isWelcomeOrComplete ? {
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
        } : {}}
      >
        <div className="tutorial-popup-content">
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          
          {/* Progress indicator */}
          <div className="tutorial-progress">
            <div className="progress-bar">
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
              <button className="tutorial-close-button" onClick={onClose}>
                Close Tutorial
              </button>
            )}
          </div>

          {/* Skip button */}
          {!isWelcomeOrComplete && (
            <button className="tutorial-skip-button" onClick={onClose}>
              Skip Tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveTutorial;
