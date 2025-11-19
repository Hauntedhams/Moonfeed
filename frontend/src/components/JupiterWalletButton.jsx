import React from 'react';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import './JupiterWalletButton.css';

/**
 * Jupiter Wallet Connect Button
 * Provides a styled button for users to connect their Jupiter Mobile wallet
 * or other supported wallets via QR code scanning
 */
export const JupiterWalletButton = ({ className = '', style = {} }) => {
  return (
    <div className={`jupiter-wallet-button-container ${className}`} style={style}>
      <UnifiedWalletButton />
    </div>
  );
};

export default JupiterWalletButton;
