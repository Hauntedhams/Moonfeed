import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './MoonfeedInfoModal.css';

// Use the new logo from public folder
const moonfeedLogo = '/new logo.jpeg';

const MoonfeedInfoModal = ({ isVisible, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  if (!isVisible && !isClosing) return null;

  // Minimum swipe distance (in px) to trigger close
  const minSwipeDistance = 50;

  const handleClose = () => {
    console.log('🌙 Moonfeed modal closing...');
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 600); // Match animation duration (0.6s)
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    
    // Close if swiped left
    if (isLeftSwipe) {
      handleClose();
    }
  };

  return createPortal(
    <div 
      className={`moonfeed-info-overlay ${isClosing ? 'closing' : ''}`}
      onClick={(e) => {
        // Close if clicking on the overlay (not the panel)
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className={`moonfeed-info-modal ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div className="moonfeed-info-header">
          <div className="moonfeed-header-wrapper">
            <div className="moonfeed-logo-header">
              {moonfeedLogo ? (
                <img 
                  src={moonfeedLogo} 
                  alt="Moonfeed Logo" 
                  className="moonfeed-logo"
                />
              ) : (
                <span className="moonfeed-logo">🌙</span>
              )}
              <h2>Moonfeed</h2>
            </div>
            {/* Social Links - Below Title */}
            <div className="header-social-links">
              <a 
                href="https://discord.gg/pdSpJAz5" 
                target="_blank" 
                rel="noopener noreferrer"
                className="header-social-icon discord"
                title="Join our Discord"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
              <a 
                href="https://t.me/+KYOvhdMRv2BlMmVh" 
                target="_blank" 
                rel="noopener noreferrer"
                className="header-social-icon telegram"
                title="Join our Telegram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
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
          <div className="hero-image-section">
            <img 
              src="/moocow train.png" 
              alt="Moonfeed Train" 
              className="hero-image"
            />
          </div>

          <div className="info-section roadmap-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>Roadmap</h3>
            <div className="roadmap-timeline">
              <div className="roadmap-phase completed">
                <div className="phase-marker">✓</div>
                <div className="phase-content">
                  <h4>Phase 1: Launch</h4>
                  <p>Successfully launched Moonfeed with real-time tracking, safety checks, and seamless trading integration.</p>
                  <span className="phase-status">Completed</span>
                </div>
              </div>
              <div className="roadmap-phase in-progress">
                <div className="phase-marker">2</div>
                <div className="phase-content">
                  <h4>Phase 2: Mobile Apps</h4>
                  <p>Launch on iOS App Store and Google Play Store, bringing Moonfeed to mobile devices everywhere.</p>
                  <span className="phase-status">In Progress</span>
                </div>
              </div>
              <div className="roadmap-phase upcoming">
                <div className="phase-marker">3</div>
                <div className="phase-content">
                  <h4>Phase 3: Growth & Marketing</h4>
                  <p>Influencer partnerships, community expansion, and taking Moonfeed to the moon!</p>
                  <span className="phase-status">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>

          <div className="info-section welcome-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h2 style={{ background: 'none', backgroundColor: 'transparent' }}>Welcome to Moonfeed!</h2>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              We created an app that shows you feeds of meme coins going to the moon!
            </p>
          </div>

          <div className="info-section rug-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>Tired of getting rugged?</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              We do a personal rugcheck for <strong>EVERY</strong> coin we show you! Just hover over liquidity and we'll show you the juice.
            </p>
          </div>

          <div className="info-section how-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>How do we do it?</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              We aggregate real-time data from multiple trusted sources across the Solana blockchain to give you the most comprehensive view of the market:
            </p>
            <ul className="data-sources-list">
              <li><strong>DexScreener</strong> - Live price charts, trading volume, and market data</li>
              <li><strong>Pump.fun</strong> - Newly graduating tokens and trending launches</li>
              <li><strong>Rugcheck</strong> - Contract safety verification and liquidity lock status</li>
              <li><strong>Solana RPC</strong> - Direct blockchain data for holder distribution and on-chain metrics</li>
              <li><strong>Jupiter</strong> - Secure, trustless trading directly to your wallet</li>
            </ul>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              By combining these sources, we filter for coins with strong indicators like solid liquidity, active trading volume, and verified safety features - showing you opportunities before they take off!
            </p>
          </div>

          <div className="info-section" style={{ background: 'none', backgroundColor: 'transparent' }}>
            <h3 style={{ background: 'none', backgroundColor: 'transparent' }}>How Trading Works</h3>
            <p style={{ background: 'none', backgroundColor: 'transparent' }}>
              Trading is all handled through Jupiter, they are the most reliable and trusted company to handle trades on the Solana network, and they send trades directly to your wallet. We never hold your funds everything is done through Jupiter, they handle the swap and it gets sent directly to your hot wallet, which can be used anywhere else online!
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
                Only invest what you can afford to lose. Look for liquidity locks and verify token contracts.
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
    </div>,
    document.body
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
