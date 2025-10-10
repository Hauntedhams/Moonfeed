import React, { useState } from 'react';
import './MoonfeedInfoModal.css';

// Try to import the logo, fallback to null if it doesn't exist
let moonfeedLogo;
try {
  moonfeedLogo = new URL('../assets/moonfeedlogo.png', import.meta.url).href;
} catch {
  moonfeedLogo = null;
}

const MoonfeedInfoModal = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const handleClose = () => {
    console.log('🌙 Moonfeed modal closing...');
    onClose();
  };

  return (
    <div 
      className="moonfeed-info-overlay" 
      onClick={(e) => {
        // Only close if clicking directly on the overlay, not on any child elements
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="moonfeed-info-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="moonfeed-info-header">
          <div className="moonfeed-logo-header">
            <span className="moonfeed-logo">🌙</span>
            <h2>Moonfeed</h2>
            <div className="header-social-links">
              <a 
                href="https://discord.gg/pdSpJAz5" 
                target="_blank" 
                rel="noopener noreferrer"
                className="header-social-icon discord"
                title="Join our Discord"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a 
                href="https://x.com/moonfeedapp" 
                target="_blank" 
                rel="noopener noreferrer"
                className="header-social-icon twitter"
                title="Follow us on Twitter"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a 
                href="https://www.tiktok.com/@mooonfeed" 
                target="_blank" 
                rel="noopener noreferrer"
                className="header-social-icon tiktok"
                title="Follow us on TikTok"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div className="moonfeed-info-content">
          <div className="info-section">
            <h3>🚀 What is Moonfeed?</h3>
            <p>
              Moonfeed is a modern meme coin discovery app that helps you find trending Solana tokens 
              with a TikTok-style vertical scroll interface. Discover the next moonshot before it takes off!
            </p>
          </div>

          <div className="info-section">
            <h3>📱 How to Use</h3>
            <div className="feature-list">
              <div className="feature-item">
                <span className="feature-icon">👆</span>
                <div>
                  <strong>Swipe to Browse:</strong> Scroll vertically through trending tokens, just like TikTok
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">⭐</span>
                <div>
                  <strong>Add Favorites:</strong> Tap the star icon to save coins you're interested in
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔍</span>
                <div>
                  <strong>Advanced Filters:</strong> Use the filters button to find coins by market cap, volume, liquidity, and more
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <div>
                  <strong>Live Charts:</strong> View real-time price charts and trading data for each token
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <div>
                  <strong>Safety Checks:</strong> Green locks indicate verified liquidity locks via Rugcheck
                </div>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💱</span>
                <div>
                  <strong>Quick Trade:</strong> Tap the trade button to swap tokens directly through Jupiter
                </div>
              </div>
            </div>
          </div>

          <div className="info-section">
            <h3>🔥 Navigation Tabs</h3>
            <div className="tabs-explanation">
              <div className="tab-item">
                <strong>Trending:</strong> Hottest tokens by volume and activity
              </div>
              <div className="tab-item">
                <strong>Latest:</strong> Newest tokens just hitting the market
              </div>
              <div className="tab-item">
                <strong>Custom:</strong> Your filtered results
              </div>
              <div className="tab-item">
                <strong>Favorites:</strong> Your saved tokens
              </div>
            </div>
          </div>

          <div className="info-section">
            <h3>⚠️ Important Notes</h3>
            <div className="warning-box">
              <p>
                <strong>Always DYOR (Do Your Own Research)!</strong> Meme coins are highly volatile and risky. 
                Only invest what you can afford to lose. Look for liquidity locks (🔒) and verify token contracts.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="moonfeed-info-footer">
          <button className="got-it-button" onClick={handleClose}>
            Got it! 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

// Main button component
const MoonfeedInfoButton = ({ className = '' }) => {
  const [showModal, setShowModal] = useState(false);

  const handleOpenModal = () => {
    console.log('🌙 Opening Moonfeed info modal...');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    console.log('🌙 Closing Moonfeed info modal...');
    setShowModal(false);
  };

  return (
    <>
      <button
        className={`moonfeed-info-button ${className}`}
        onClick={handleOpenModal}
        title="How to use Moonfeed"
      >
        {moonfeedLogo ? (
          <img 
            src={moonfeedLogo} 
            alt="Moonfeed Logo" 
            className="moonfeed-logo-image"
          />
        ) : (
          <span className="moonfeed-logo-fallback">🌙</span>
        )}
      </button>
      
      <MoonfeedInfoModal 
        isVisible={showModal} 
        onClose={handleCloseModal} 
      />
    </>
  );
};

export default MoonfeedInfoButton;
