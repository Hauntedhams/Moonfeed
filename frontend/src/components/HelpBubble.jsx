import React, { useState, useEffect, useRef } from 'react';
import './HelpBubble.css';

const HelpBubble = ({ currentPage = 'home' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [helpContent, setHelpContent] = useState(null);
  const bubbleRef = useRef(null);

  // Help content for each page
  const helpPages = {
    'home': {
      title: '🏠 Home Feed',
      content: (
        <>
          <p><strong>Welcome to your personalized meme coin feed!</strong></p>
          <ul>
            <li><strong>Swipe/Scroll:</strong> Navigate through trending tokens</li>
            <li><strong>Expand Card:</strong> Click the arrow to see detailed metrics</li>
            <li><strong>Follow Tokens:</strong> Click "Follow" to add to favorites</li>
            <li><strong>Live Data:</strong> Green dot = real-time price updates</li>
            <li><strong>Chart Navigation:</strong> Use "Clean" and "Advanced" buttons to switch chart views</li>
            <li><strong>Swipe Charts:</strong> Drag left/right on the chart area to switch between views</li>
          </ul>
          <p className="help-tip">💡 <em>Tip: Tokens are sorted by market activity and potential!</em></p>
        </>
      )
    },
    'orders': {
      title: '📊 Orders',
      content: (
        <>
          <p><strong>Track your trading activity</strong></p>
          <ul>
            <li><strong>Open Orders:</strong> View pending buy/sell orders</li>
            <li><strong>Order History:</strong> Review completed transactions</li>
            <li><strong>Status Updates:</strong> Real-time order execution tracking</li>
            <li><strong>Quick Actions:</strong> Cancel or modify active orders</li>
          </ul>
          <p className="help-tip">💡 <em>Tip: Orders are processed through Jupiter aggregator for best prices!</em></p>
        </>
      )
    },
    'trade': {
      title: '💱 Trade',
      content: (
        <>
          <p><strong>Execute trades with ease</strong></p>
          <ul>
            <li><strong>Token Selection:</strong> Search or paste contract address</li>
            <li><strong>Smart Routing:</strong> Best prices via Jupiter</li>
            <li><strong>Slippage Settings:</strong> Adjust tolerance for trade execution</li>
            <li><strong>Price Impact:</strong> See estimated impact before trading</li>
            <li><strong>Quick Amounts:</strong> Use preset buttons (25%, 50%, 75%, 100%)</li>
          </ul>
          <p className="help-tip">💡 <em>Tip: Always check liquidity before large trades!</em></p>
        </>
      )
    },
    'favorites': {
      title: '⭐ Favorites',
      content: (
        <>
          <p><strong>Your watchlist of followed tokens</strong></p>
          <ul>
            <li><strong>Quick Access:</strong> All your followed tokens in one place</li>
            <li><strong>Live Monitoring:</strong> Real-time price updates</li>
            <li><strong>Performance Tracking:</strong> See how your picks are doing</li>
            <li><strong>Instant Trading:</strong> Quick access to trade your favorites</li>
            <li><strong>Remove Tokens:</strong> Click "Following" to unfollow</li>
          </ul>
          <p className="help-tip">💡 <em>Tip: Build a diverse watchlist to track market trends!</em></p>
        </>
      )
    },
    'profile': {
      title: '👤 Profile',
      content: (
        <>
          <p><strong>Manage your account and settings</strong></p>
          <ul>
            <li><strong>Wallet Connection:</strong> Connect/disconnect Solana wallet</li>
            <li><strong>Portfolio View:</strong> Track your token holdings</li>
            <li><strong>Transaction History:</strong> Review past trades</li>
            <li><strong>Settings:</strong> Customize your experience</li>
            <li><strong>Dark Mode:</strong> Toggle light/dark theme</li>
          </ul>
          <p className="help-tip">💡 <em>Tip: Keep your wallet secure and never share your seed phrase!</em></p>
        </>
      )
    }
  };

  // Update help content based on current page
  useEffect(() => {
    const content = helpPages[currentPage] || helpPages['home'];
    setHelpContent(content);
  }, [currentPage]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const toggleHelp = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="help-bubble-container" ref={bubbleRef}>
      {/* Help Tooltip */}
      {isOpen && helpContent && (
        <div className="help-tooltip">
          <div className="help-tooltip-header">
            <h3>{helpContent.title}</h3>
            <button 
              className="help-close-btn" 
              onClick={toggleHelp}
              aria-label="Close help"
            >
              ×
            </button>
          </div>
          <div className="help-tooltip-content">
            {helpContent.content}
          </div>
          {/* Arrow pointing down to the button */}
          <div className="help-tooltip-arrow"></div>
        </div>
      )}

      {/* Help Button */}
      <button
        className={`help-bubble-button ${isOpen ? 'active' : ''}`}
        onClick={toggleHelp}
        aria-label="Get help"
        title="Need help?"
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
    </div>
  );
};

export default HelpBubble;
