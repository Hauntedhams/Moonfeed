import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './WalletButton.css';

const WalletButton = () => {
  const { 
    walletAddress, 
    connected, 
    connecting,
    connect, 
    disconnect,
    isPhantomAvailable,
    isSolflareAvailable,
    connectPhantom,
    connectSolflare
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  const handleConnect = async () => {
    // If both wallets available, show selector
    if (isPhantomAvailable && isSolflareAvailable) {
      setShowWalletSelector(true);
    } else {
      // Auto-connect to available wallet
      await connect();
    }
  };

  const handleSelectWallet = async (type) => {
    setShowWalletSelector(false);
    if (type === 'phantom') {
      await connectPhantom();
    } else {
      await connectSolflare();
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      alert('Address copied!');
    }
  };

  if (!connected) {
    return (
      <>
        <button 
          className="wallet-connect-btn"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <span className="spinner-small"></span>
              Connecting...
            </>
          ) : (
            <>
              👛 Connect Wallet
            </>
          )}
        </button>

        {/* Wallet Selector Modal */}
        {showWalletSelector && (
          <div 
            className="wallet-selector-overlay"
            onClick={() => setShowWalletSelector(false)}
          >
            <div 
              className="wallet-selector-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Select Wallet</h3>
              <div className="wallet-options">
                {isPhantomAvailable && (
                  <button
                    className="wallet-option"
                    onClick={() => handleSelectWallet('phantom')}
                  >
                    <img 
                      src="https://phantom.app/img/logo.png" 
                      alt="Phantom"
                      className="wallet-icon"
                    />
                    <div>
                      <div className="wallet-name">Phantom</div>
                      <div className="wallet-desc">Connect to Phantom</div>
                    </div>
                  </button>
                )}
                {isSolflareAvailable && (
                  <button
                    className="wallet-option"
                    onClick={() => handleSelectWallet('solflare')}
                  >
                    <img 
                      src="https://solflare.com/img/solflare-logo.svg" 
                      alt="Solflare"
                      className="wallet-icon"
                    />
                    <div>
                      <div className="wallet-name">Solflare</div>
                      <div className="wallet-desc">Connect to Solflare</div>
                    </div>
                  </button>
                )}
              </div>
              <button 
                className="close-selector"
                onClick={() => setShowWalletSelector(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="wallet-connected">
      <button 
        className="wallet-address-btn"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="wallet-icon-small">👛</span>
        {formatAddress(walletAddress)}
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-header">
            <span className="wallet-status">🟢 Connected</span>
          </div>
          <div className="wallet-dropdown-address">
            {walletAddress}
          </div>
          <button 
            className="wallet-dropdown-action"
            onClick={() => {
              copyAddress();
              setShowDropdown(false);
            }}
          >
            📋 Copy Address
          </button>
          <button 
            className="wallet-dropdown-action"
            onClick={() => {
              window.open(`https://solscan.io/account/${walletAddress}`, '_blank');
              setShowDropdown(false);
            }}
          >
            🔍 View on Solscan
          </button>
          <button 
            className="wallet-dropdown-action disconnect"
            onClick={() => {
              disconnect();
              setShowDropdown(false);
            }}
          >
            🚪 Disconnect
          </button>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div 
          className="wallet-dropdown-backdrop"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default WalletButton;
