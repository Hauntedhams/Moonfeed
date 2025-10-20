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
            {moonfeedLogo ? (
              <img 
                src={moonfeedLogo} 
                alt="Moonfeed Logo" 
                className="moonfeed-logo"
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              />
            ) : (
              <span className="moonfeed-logo">🌙</span>
            )}
            <h2>Moonfeed</h2>
            <button className="interactive-mode-button" onClick={() => console.log('Interactive mode clicked')}>
              Interactive Mode
            </button>
          </div>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        {/* Social Links - Below Header */}
        <div className="moonfeed-social-section">
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

        {/* Content */}
        <div className="moonfeed-info-content">
          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>What is Moonfeed?</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              MoonFeed was created to make trading more accessible, people assume you need to be an insider to make money trading on solana, but much like any industry, if you have the right tools there's money to be made.
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>How it Works</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              Moonfeed pulls Solana coins from the blockchain with specific numeric values, these are what we've found to be strong indicators that a coin will go up, we want to show you coins going to the moon. in addition to our Trending, and New Feeds, we're adding graduating coins from Pump.fun. We encourage you to play with the filters to find coins that suit your trading style, as we intend to add more feeds in the future for different kinds of traders.
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>How Trading Works</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              Trading is all handled through Jupiter, they are the most reliable and trusted company to handle trades on the Solana network, and they send trades directly to your wallet. We never hold your funds everything is done through Jupiter, they handle the swap and it gets sent directly to your hot wallet, which can be used anywhere else online!
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>Where We Get Our Data</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              Moonfeed aggregates data from multiple trusted sources on the Solana blockchain. We pull real-time information from DexScreener for price charts and trading data, Pump.fun for newly graduating tokens, and use Rugcheck to verify liquidity locks and contract safety. All of this data is continuously updated to give you the most accurate view of what's happening in the market.
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>How We Load Coins</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              Our backend constantly scans the Solana blockchain looking for tokens that meet specific criteria. We analyze factors like liquidity depth, trading volume, holder distribution, and price momentum. Coins that show strong indicators are automatically added to our feeds. The Trending feed shows tokens with the highest recent activity, while the New feed displays fresh launches. Our filters let you narrow down results by market cap, liquidity, and other key metrics.
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>Understanding the Interface</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              Moonfeed uses a TikTok-style vertical scroll interface to make browsing tokens fast and intuitive. Each card displays essential information: current price, 24-hour change, market cap, volume, and liquidity. Tap on any wallet address to see detailed analytics including whale activity and top trader rankings. Use the star icon to save favorites, and the trade button for quick swaps through Jupiter. The chart shows real-time price action with multiple timeframes available.
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>Safety Features</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              We integrate Rugcheck to automatically scan tokens for common risks. A green lock icon indicates verified liquidity locks, meaning the liquidity can't be pulled by developers. We also display holder distribution, contract verification status, and flagged risks. However, these are tools to help you research - always do your own due diligence before trading any token.
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>Important Notes</h3>
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
            Okay
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
