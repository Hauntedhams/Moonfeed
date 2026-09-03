import React, { useEffect, useRef, useState } from 'react';
import TriggerOrderModal from './TriggerOrderModal';
import CautionTapeBanner from './CautionTapeBanner';
import { useWallet } from '../contexts/WalletContext';
import { useWallet as useJupiterWallet } from '@jup-ag/wallet-adapter';
import { useWalletConnectOnboarding } from './WalletConnectOnboarding';
import ReferralTracker from '../utils/ReferralTracker';
import './JupiterTradeModal.css';

const JupiterTradeModal = ({ isOpen, onClose, coin, onSwapSuccess, onSwapError, initialTab, initialSolAmount, initialPercentage, initialSide, initialTriggerPrice, autoSellOrder }) => {
  const jupiterInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('swap'); // 'swap' or 'limit'
  const [swapSuccessInfo, setSwapSuccessInfo] = useState(null);
  // Side to preselect on the Limit Order page when jumping there post-swap
  const [limitPrefillSide, setLimitPrefillSide] = useState(null);
  // Live status of the sell order queued by the slide-out "Sell at" flow
  // (CoinCard places it automatically after this swap — no manual setup needed).
  const [autoOrderStatus, setAutoOrderStatus] = useState(null); // { status, triggerPrice, error }
  const [pendingWallet, setPendingWallet] = useState(null); // Wallet name awaiting connect after select
  const { walletAddress } = useWallet();

  // Get the full Jupiter wallet adapter for passthrough to Terminal
  const jupiterWallet = useJupiterWallet();
  const { openWalletConnect } = useWalletConnectOnboarding();

  // Selecting a wallet only sets it as active; we must call connect() once the
  // adapter is selected (autoConnect is off on desktop) to trigger the wallet
  // extension's approval prompt.
  const handleSelectWallet = (name) => {
    try {
      if (jupiterWallet.wallet?.adapter?.name === name) {
        jupiterWallet.connect().catch((err) => console.warn('Wallet connect failed:', err));
      } else {
        jupiterWallet.select(name);
        setPendingWallet(name);
      }
    } catch (err) {
      console.warn('Wallet select failed:', err);
    }
  };

  useEffect(() => {
    if (!pendingWallet) return;
    if (jupiterWallet.connected || jupiterWallet.connecting) {
      setPendingWallet(null);
      return;
    }
    if (jupiterWallet.wallet?.adapter?.name === pendingWallet) {
      jupiterWallet.connect().catch((err) => console.warn('Wallet connect failed:', err));
      setPendingWallet(null);
    }
  }, [pendingWallet, jupiterWallet.wallet, jupiterWallet.connected, jupiterWallet.connecting]);

  useEffect(() => {
    if (isOpen && !jupiterWallet.connected) openWalletConnect({ onDismiss: onClose });
  }, [isOpen, jupiterWallet.connected, openWalletConnect]);

  // Track trade with affiliate system
  const trackTradeWithAffiliate = async (txid, swapResult) => {
    try {
      console.log('📊 Attempting to track trade for affiliate system...');

      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      // Do NOT default missing mints to SOL — that once mislabeled a sell as a
      // buy and reported the raw TOKEN amount as SOL volume (20,000x inflated).
      const inputMint = swapResult?.inputMint || null;
      const outputMint = swapResult?.outputMint || null;

      // Volume = the SOL side of the swap (input on buys, output on sells).
      // The backend re-verifies this against the on-chain transaction anyway.
      let lamports = 0;
      if (inputMint === SOL_MINT) {
        lamports = Number(swapResult?.inputAmount) || 0;
      } else if (outputMint === SOL_MINT) {
        lamports = Number(swapResult?.outputAmount) || 0;
      }
      const tradeVolume = lamports / 1e9;
      const feeEarned = tradeVolume * 0.01; // 1% fee

      const trackingData = {
        userWallet: walletAddress || 'unknown',
        tradeVolume: tradeVolume,
        feeEarned: feeEarned,
        tokenIn: inputMint || undefined,
        tokenOut: outputMint || coin?.mintAddress,
        transactionSignature: txid,
        metadata: {
          coinSymbol: coin?.symbol,
          coinName: coin?.name,
          side: inputMint === SOL_MINT ? 'buy' : (outputMint === SOL_MINT ? 'sell' : 'unknown'),
          timestamp: new Date().toISOString()
        }
      };
      
      const result = await ReferralTracker.trackTrade(trackingData);
      
      if (result.success) {
        console.log('✅ Trade tracked successfully:', result.trade);
      } else {
        console.log('📊 Trade not tracked:', result.reason || result.error);
      }
    } catch (error) {
      console.error('❌ Error tracking trade:', error);
    }
  };

  // Sync Jupiter Terminal with app's wallet state whenever it changes
  // This enables bidirectional wallet sync:
  // - Connect via app buttons → Jupiter Terminal sees it
  // - Connect via Jupiter Terminal → App sees it (via UnifiedWalletProvider)
  useEffect(() => {
    if (window.Jupiter && jupiterInitialized.current) {
      console.log('🔄 Syncing wallet state to Jupiter Terminal:', {
        connected: jupiterWallet.connected,
        publicKey: jupiterWallet.publicKey?.toString()
      });
      
      // Sync the wallet state to Jupiter Terminal
      window.Jupiter.syncProps({
        passthroughWalletContextState: jupiterWallet
      });
    }
  }, [jupiterWallet.connected, jupiterWallet.publicKey]);

  useEffect(() => {
    // Only initialize the Jupiter Terminal once a wallet is connected. Before
    // that we show the "How to use Moonfeed" onboarding screen instead.
    // Not gated on the active tab: the swap panel stays mounted while the user
    // swipes to the limit page, so the Terminal is never torn down mid-session.
    if (isOpen && coin && jupiterWallet.connected) {
      // Simple check and initialize
      if (window.Jupiter && !jupiterInitialized.current) {
        initializeJupiter();
      } else if (!window.Jupiter) {
        // Wait for Jupiter script to load
        const checkJupiter = setInterval(() => {
          if (window.Jupiter && !jupiterInitialized.current) {
            clearInterval(checkJupiter);
            initializeJupiter();
          }
        }, 100);
        
        const timeout = setTimeout(() => {
          clearInterval(checkJupiter);
          setError('Jupiter failed to load.');
          setIsLoading(false);
        }, 5000);
        
        return () => {
          clearInterval(checkJupiter);
          clearTimeout(timeout);
        };
      }
    }
    
    // Clean up on close or when the wallet disconnects
    if ((!isOpen || !jupiterWallet.connected) && jupiterInitialized.current) {
      jupiterInitialized.current = false;
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, coin, jupiterWallet.connected]);

  const initializeJupiter = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!coin?.mintAddress) {
        throw new Error('Invalid coin');
      }
      
      console.log('🪐 Loading Jupiter Plugin for', coin.symbol);
      const initialAmountLamports = Number(initialSolAmount) > 0
        ? Math.round(Number(initialSolAmount) * 1_000_000_000)
        : undefined;
      
      // Close existing instance
      if (window.Jupiter._instance) {
        try {
          window.Jupiter.close();
        } catch (e) {
          // Ignore close errors
        }
      }

      // Jupiter Plugin v1 (RPC-less Ultra Swap)
      // No endpoint needed — Plugin uses Jupiter's Ultra API for all routing/balance/tx.
      // referralAccount + referralFee go in formProps per the official Plugin API.
      window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "jupiter-container",

        // Wallet passthrough — shares the app's connected wallet with the Plugin.
        // When no wallet is connected, the Terminal shows a "Connect Wallet"
        // button that delegates to Moonfeed's shared onboarding modal.
        enableWalletPassthrough: true,
        passthroughWalletContextState: jupiterWallet,
        onRequestConnectWallet: openWalletConnect,

        formProps: {
          initialInputMint: "So11111111111111111111111111111111111111112", // SOL
          initialOutputMint: coin.mintAddress,
          ...(initialAmountLamports ? { initialAmount: initialAmountLamports } : {}),
          // Referral fees: collected via Jupiter Referral Program
          // Fee accounts must be created at https://referral.jup.ag/dashboard first
          referralAccount: "Gy6SuRWnn4garDXHwXc9usuF7rKrbQS7TxKH9rJjGfxt",
          referralFee: 100, // 100 BPS = 1%
        },

        containerStyles: {
          borderRadius: '16px',
          backgroundColor: 'rgba(16, 23, 31, 0.95)',
        },

        onSuccess: ({ txid, swapResult }) => {
          console.log('✅ Swap success:', txid);
          trackTradeWithAffiliate(txid, swapResult);
          setSwapSuccessInfo({ txid, swapResult });
          onSwapSuccess?.({ txid, swapResult, coin, walletAddress });
        },

        onSwapError: ({ error }) => {
          console.error('❌ Swap error:', error);
          onSwapError?.({ error, coin });
        },

        onScreenUpdate: (screen) => {
          if (screen) setIsLoading(false);
        },
      });

      jupiterInitialized.current = true;
      setTimeout(() => setIsLoading(false), 1000);
      
    } catch (err) {
      console.error('Jupiter init error:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (window.Jupiter) {
      try {
        window.Jupiter.close();
      } catch (e) {
        // Ignore
      }
    }
    jupiterInitialized.current = false;
    setIsLoading(true);
    setError(null);
    setActiveTab('swap');
    setSwapSuccessInfo(null);
    setLimitPrefillSide(null);
    setAutoOrderStatus(null);
    onClose();
  };

  // Track the auto-placed sell order's progress (slide-out "Sell at" flow)
  useEffect(() => {
    if (!isOpen) return;
    const handleAutoOrder = (e) => setAutoOrderStatus(e.detail || null);
    window.addEventListener('moonfeed:auto-sell-order', handleAutoOrder);
    return () => window.removeEventListener('moonfeed:auto-sell-order', handleAutoOrder);
  }, [isOpen]);

  // When opened with initialTab='limit', jump straight to the limit page
  useEffect(() => {
    if (isOpen && initialTab === 'limit') {
      setActiveTab('limit');
    }
  }, [isOpen, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Horizontal swipe between the swap and limit pages.
  const swipeStart = useRef(null);
  const handleSwipeStart = (e) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleSwipeEnd = (e) => {
    if (!swipeStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStart.current.x;
    const dy = t.clientY - swipeStart.current.y;
    // Require a clearly horizontal gesture so it doesn't fight vertical scrolls
    // or the Jupiter Terminal's own touch interactions.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setActiveTab(dx < 0 ? 'limit' : 'swap');
    }
    swipeStart.current = null;
  };

  const handleOrderCreated = (result) => {
    console.log('✅ Limit order created:', result);
    // You can add success notification here
  };

  if (!isOpen || !jupiterWallet.connected) return null;

  return (
    <>
      <div className="jupiter-modal-overlay" onClick={handleClose}>
        <div className="jupiter-modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Header + tabs are hidden on the wallet-gate onboarding screen */}
          {jupiterWallet.connected && (
            <>
              <div className="jupiter-modal-header">
                <div className="coin-info">
                  <img 
                    src={coin?.image || '/default-coin.svg'} 
                    alt={coin?.symbol || 'Coin'} 
                    className="coin-image"
                    onError={(e) => e.target.src = '/default-coin.svg'}
                  />
                  <div>
                    <h3>{coin?.name || 'Unknown'}</h3>
                    <p className="coin-symbol">{coin?.symbol || 'N/A'}</p>
                  </div>
                </div>
                <button className="close-button" onClick={handleClose}>
                  ✕
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="jupiter-tab-nav">
                <button 
                  className={`tab-btn ${activeTab === 'swap' ? 'active' : ''}`}
                  onClick={() => handleTabChange('swap')}
                >
                  <span className="tab-icon">⚡</span>
                  Instant Swap
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'limit' ? 'active' : ''}`}
                  onClick={() => handleTabChange('limit')}
                >
                  <span className="tab-icon">🎯</span>
                  Limit Order
                  <span className="caution-tape-badge">IN PROGRESS</span>
                </button>
              </div>
            </>
          )}

          {/* Wallet gate: show the "How to use Moonfeed" onboarding until a
              wallet is connected, then reveal a swipeable swap ⇄ limit UI. */}
          {!jupiterWallet.connected && false ? (
            <div className="jupiter-widget-wrapper">
                <div className="mf-onboarding">
                  <button className="mf-onboarding-close" onClick={handleClose} aria-label="Close">✕</button>
                  <h2 className="mf-onboarding-title">How to use Moonfeed</h2>
                  <p className="mf-onboarding-subtitle">
                    Connect a hot wallet to start trading in three simple steps.
                  </p>

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
                    {(jupiterWallet.wallets && jupiterWallet.wallets.length > 0) ? (
                      jupiterWallet.wallets.map((w) => (
                        <button
                          key={w.adapter.name}
                          type="button"
                          className="mf-wallet-option"
                          onClick={() => handleSelectWallet(w.adapter.name)}
                        >
                          {w.adapter.icon && (
                            <img src={w.adapter.icon} alt={w.adapter.name} className="mf-wallet-icon" />
                          )}
                          <span className="mf-wallet-name">{w.adapter.name}</span>
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="mf-wallet-option mf-wallet-option--full"
                        onClick={openWalletConnect}
                      >
                        <span className="mf-wallet-name">Connect Wallet</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="mf-wallets-more"
                    onClick={openWalletConnect}
                  >
                    More wallet options
                  </button>
                </div>
            </div>
          ) : (
            <div
              className="jt-swipe-viewport"
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
            >
              <div className={`jt-swipe-track ${activeTab === 'limit' ? 'at-limit' : ''}`}>
                {/* Page 1 — Instant Swap (Jupiter Terminal) */}
                <div className="jt-swipe-page jt-swipe-page--swap">
                  <div className="jupiter-widget-wrapper">
                    {/* Loading state while the Terminal boots */}
                    {isLoading && !error && (
                      <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading...</p>
                      </div>
                    )}

                    {error && (
                      <div className="error-state">
                        <p>Failed to load</p>
                        <button onClick={initializeJupiter} className="retry-button">
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Jupiter container - full swap UI, shown once connected. */}
                    <div 
                      id="jupiter-container"
                      style={{ 
                        width: '100%', 
                        height: '600px',
                        minHeight: '600px',
                        opacity: (isLoading || error) ? 0 : 1,
                        display: error ? 'none' : 'block',
                        transition: 'opacity 0.3s'
                      }}
                    />
                  </div>
                  <div className="jupiter-modal-footer">
                    <p className="non-custodial-disclaimer">
                      Moonfeed is a non-custodial interface. Swaps are executed on-chain by{' '}
                      <a
                        href="https://jup.ag"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="disclaimer-link"
                      >
                        Jupiter
                      </a>{' '}
                      using your own self-custody wallet. Moonfeed never holds, controls, or has
                      access to your funds.
                    </p>
                    <p className="risk-disclaimer">
                      Crypto trading involves substantial risk. You are solely responsible for your
                      transactions.
                    </p>
                    <p className="powered-by">Powered by Jupiter</p>
                  </div>
                </div>

                {/* Page 2 — Limit Order (swipe left to reach) */}
                <div className="jt-swipe-page jt-swipe-page--limit">
                  <CautionTapeBanner message="IN PROGRESS — LIMIT ORDERS UNDER MAINTENANCE" />
                  <TriggerOrderModal
                    embedded
                    isOpen={isOpen}
                    coin={coin}
                    onClose={handleClose}
                    onOrderCreated={handleOrderCreated}
                    initialInputAmount={initialSolAmount}
                    initialPercentage={initialPercentage}
                    initialSide={limitPrefillSide || initialSide}
                    initialTriggerPrice={initialTriggerPrice}
                  />
                  <div className="jupiter-modal-footer limit-order-footer">
                    <p className="non-custodial-disclaimer">
                      Moonfeed is a non-custodial interface. Swaps are executed on-chain by{' '}
                      <a
                        href="https://jup.ag"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="disclaimer-link"
                      >
                        Jupiter
                      </a>{' '}
                      using your own self-custody wallet. Moonfeed never holds, controls, or has
                      access to your funds.
                    </p>
                    <p className="risk-disclaimer">
                      Crypto trading involves substantial risk. You are solely responsible for your
                      transactions.
                    </p>
                    <p className="powered-by">Powered by Jupiter</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success popup overlay after a swap - fixed position so it's always visible */}
          {swapSuccessInfo && (
            <div className="swap-success-fixed-overlay" onClick={(e) => e.stopPropagation()}>
                <div className="swap-success-banner">
                  <button
                    className="swap-success-close"
                    onClick={handleClose}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                  <div className="success-banner-top">
                    <span className="success-banner-check">✓</span>
                    <span className="success-banner-title">Trade successful!</span>
                  </div>

                  {autoSellOrder ? (
                    // The sell order was already queued from the "Sell at" slide-out —
                    // show its live progress instead of offering to set one up again.
                    <div className={`auto-order-status auto-order-${autoOrderStatus?.status || 'placing'}`}>
                      {(!autoOrderStatus || autoOrderStatus.status === 'placing') && (
                        <>Placing your sell order… approve the prompts in your wallet</>
                      )}
                      {autoOrderStatus?.status === 'placed' && (
                        <>✓ Sell order placed — view it in the Orders tab</>
                      )}
                      {autoOrderStatus?.status === 'failed' && (
                        <>
                          ⚠ Sell order failed: {autoOrderStatus.error}
                          <button
                            className="setup-limit-link"
                            onClick={() => {
                              setLimitPrefillSide('sell');
                              setSwapSuccessInfo(null);
                              setActiveTab('limit');
                            }}
                          >
                            Retry in Limit Order tab →
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      className="setup-limit-link"
                      onClick={() => {
                        const SOL_MINT = 'So11111111111111111111111111111111111111112';
                        const swapResult = swapSuccessInfo?.swapResult;
                        // After a buy, preselect sell (take-profit) on the limit page
                        if (swapResult?.inputMint === SOL_MINT || swapResult?.outputMint === coin?.mintAddress) {
                          setLimitPrefillSide('sell');
                        }
                        setSwapSuccessInfo(null);
                        setActiveTab('limit');
                      }}
                    >
                      Setup limit order? →
                    </button>
                  )}
                </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default JupiterTradeModal;
