import React, { useEffect, useState } from 'react';
import { useWallet as useJupiterWallet, useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import { useDemoMode } from '../contexts/DemoModeContext';
import './JupiterTradeModal.css';
import './WalletConnectOnboarding.css';

const WalletConnectOnboarding = ({ children }) => {
  const { enableDemoMode } = useDemoMode();
  const { setShowModal } = useUnifiedWalletContext();
  const wallet = useJupiterWallet();
  const [open, setOpen] = useState(false);
  const [pendingWallet, setPendingWallet] = useState(null);

  useEffect(() => {
    if (!pendingWallet || wallet.connected || wallet.connecting) return;
    if (wallet.wallet?.adapter?.name === pendingWallet) {
      wallet.connect().catch(() => {});
      setPendingWallet(null);
    }
  }, [pendingWallet, wallet.wallet, wallet.connected, wallet.connecting]);

  useEffect(() => {
    if (wallet.connected) setOpen(false);
  }, [wallet.connected]);

  const selectWallet = (name) => {
    try {
      if (wallet.wallet?.adapter?.name === name) {
        wallet.connect().catch(() => {});
      } else {
        wallet.select(name);
        setPendingWallet(name);
      }
    } catch (_) {}
  };

  const openOnboarding = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <div onClickCapture={openOnboarding}>
        {React.cloneElement(children, { onClick: openOnboarding })}
      </div>
      {open && !wallet.connected && (
        <div className="wallet-onboarding-overlay" onClick={() => setOpen(false)}>
          <div className="wallet-onboarding-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mf-onboarding">
              <button className="mf-onboarding-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              <h2 className="mf-onboarding-title">How to use Moonfeed</h2>
              <p className="mf-onboarding-subtitle">Connect a hot wallet to start trading in three simple steps.</p>

              <div className="mf-flow">
                <div className="mf-flow-step">
                  <div className="mf-flow-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M14.5 9.2c-.4-1-1.4-1.7-2.7-1.7-1.6 0-2.8.9-2.8 2.2 0 1.1.8 1.7 2.4 2.1l.9.2c1.6.4 2.4 1 2.4 2.1 0 1.3-1.2 2.2-2.9 2.2-1.4 0-2.5-.7-2.8-1.8" />
                      <path d="M12 6v12" />
                    </svg>
                  </div>
                  <span className="mf-flow-label">USD</span>
                </div>
                <div className="mf-flow-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="12" x2="18" y2="12" />
                    <polyline points="13 7 18 12 13 17" />
                  </svg>
                </div>
                <div className="mf-flow-step">
                  <div className="mf-flow-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="6" width="18" height="13" rx="2.5" />
                      <path d="M3 9h18" />
                      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  <span className="mf-flow-label">Hot Wallet</span>
                </div>
                <div className="mf-flow-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="12" x2="18" y2="12" />
                    <polyline points="13 7 18 12 13 17" />
                  </svg>
                </div>
                <div className="mf-flow-step">
                  <div className="mf-flow-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 3 21 7 17 11" />
                      <path d="M21 7H8" />
                      <polyline points="7 21 3 17 7 13" />
                      <path d="M3 17h13" />
                    </svg>
                  </div>
                  <span className="mf-flow-label">Trade</span>
                </div>
              </div>

              <div className="mf-wallets-heading">Choose your wallet</div>
              <div className="mf-wallets-grid">
                {wallet.wallets?.length > 0 ? wallet.wallets.map((item) => (
                  <button key={item.adapter.name} type="button" className="mf-wallet-option" onClick={() => selectWallet(item.adapter.name)}>
                    {item.adapter.icon && <img src={item.adapter.icon} alt={item.adapter.name} className="mf-wallet-icon" />}
                    <span className="mf-wallet-name">{item.adapter.name}</span>
                  </button>
                )) : (
                  <button type="button" className="mf-wallet-option mf-wallet-option--full" onClick={() => setShowModal(true)}>
                    <span className="mf-wallet-name">Connect Wallet</span>
                  </button>
                )}
              </div>
              <button type="button" className="mf-wallets-more" onClick={() => setShowModal(true)}>More wallet options</button>
              <div className="wallet-onboarding-footer-actions">
                <button type="button" onClick={() => setOpen(false)}>Browse without a wallet</button>
                <button type="button" onClick={() => { enableDemoMode(); setOpen(false); }}>Explore demo account</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletConnectOnboarding;
