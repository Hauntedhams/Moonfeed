import React from 'react';
import { useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import { useDemoMode } from '../contexts/DemoModeContext';
import './WalletModalTopActions.css';

/**
 * Actions injected into Jupiter's "Connect Wallet" modal (via the provider's
 * walletModalAttachments.footer slot) and lifted to the TOP of the modal with
 * CSS (see WalletModalTopActions.css).
 *
 * Purpose: make it obvious — to users and to App Review — that a third-party
 * wallet is NOT required to use the app. Two options sit above the wallet list:
 *   1. "Browse without a wallet" — dismisses the modal; the feed, charts,
 *      search and favorites all work with no wallet.
 *   2. "Explore demo account" — enables a preview account so every trading
 *      screen can be reviewed without installing any external wallet app.
 */
const WalletModalTopActions = () => {
  const { enableDemoMode } = useDemoMode();
  const { setShowModal } = useUnifiedWalletContext();

  const handleBrowse = () => {
    setShowModal(false);
  };

  const handleDemo = () => {
    enableDemoMode();
    setShowModal(false);
  };

  return (
    <div className="moonfeed-wallet-modal-top">
      <div className="moonfeed-wallet-modal-top__links">
        <button
          type="button"
          onClick={handleBrowse}
          className="moonfeed-wallet-modal-top__link"
        >
          Browse without a wallet
        </button>
        <span className="moonfeed-wallet-modal-top__sep">·</span>
        <button
          type="button"
          onClick={handleDemo}
          className="moonfeed-wallet-modal-top__link"
        >
          Explore demo account
        </button>
      </div>
    </div>
  );
};

export default WalletModalTopActions;
