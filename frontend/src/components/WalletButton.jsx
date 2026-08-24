import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useDemoMode } from '../contexts/DemoModeContext';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import WalletConnectOnboarding from './WalletConnectOnboarding';
import './WalletButton.css';

/**
 * Universal Wallet Button
 * Uses Jupiter's UnifiedWalletButton for connection which handles:
 * - Phantom, Solflare, Coinbase, and other Solana wallets
 * - Jupiter Mobile wallet via QR code
 * - Consistent wallet state across the app
 */
const WalletButton = () => {
  const { 
    walletAddress, 
    connected, 
    disconnect
  } = useWallet();
  const { isDemoMode, disableDemoMode } = useDemoMode();

  const [showDropdown, setShowDropdown] = useState(false);

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

  // When not connected, show Jupiter's unified wallet button
  if (!connected) {
    return (
      <div className="wallet-connect-wrapper">
        <WalletConnectOnboarding>
          <UnifiedWalletButton />
        </WalletConnectOnboarding>
      </div>
    );
  }

  // When connected, show custom dropdown with wallet info
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
            <span className="wallet-status">{isDemoMode ? 'Demo Account' : '� Connected'}</span>
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
          {isDemoMode && (
            <button
              className="wallet-dropdown-action"
              onClick={() => {
                disableDemoMode();
                setShowDropdown(false);
              }}
            >
              ✕ Exit Demo Mode
            </button>
          )}
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
