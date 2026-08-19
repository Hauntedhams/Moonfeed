import React, { useEffect, useRef, useState } from 'react';
import TriggerOrderModal from './TriggerOrderModal';
import { useWallet } from '../contexts/WalletContext';
import { useWallet as useJupiterWallet, useUnifiedWalletContext } from '@jup-ag/wallet-adapter';
import ReferralTracker from '../utils/ReferralTracker';
import { getFullApiUrl } from '../config/api';
import './JupiterTradeModal.css';

const JupiterTradeModal = ({ isOpen, onClose, coin, onSwapSuccess, onSwapError, initialTab, initialSolAmount, initialPercentage, initialSide }) => {
  const jupiterInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('swap'); // 'swap' or 'limit'
  const [swapSuccessInfo, setSwapSuccessInfo] = useState(null);
  const [showLimitPanel, setShowLimitPanel] = useState(false);
  const [limitPct, setLimitPct] = useState(5);
  const [limitPctInput, setLimitPctInput] = useState('5');
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [limitSuccess, setLimitSuccess] = useState(false);
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [pendingWallet, setPendingWallet] = useState(null); // Wallet name awaiting connect after select
  const { walletAddress, signTransaction } = useWallet();

  // Get the full Jupiter wallet adapter for passthrough to Terminal
  const jupiterWallet = useJupiterWallet();
  // Lets us open the wallet-selection modal from inside the Jupiter Terminal
  const { setShowModal } = useUnifiedWalletContext();

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

  // Track trade with affiliate system
  const trackTradeWithAffiliate = async (txid, swapResult) => {
    try {
      console.log('📊 Attempting to track trade for affiliate system...');
      
      // Extract trade info from swapResult
      const inputAmount = swapResult?.inputAmount || 0;
      const outputAmount = swapResult?.outputAmount || 0;
      
      // Calculate approximate trade volume and fee
      // Jupiter swaps show amounts in smallest units, need to convert
      const tradeVolume = inputAmount / 1e9; // Assuming SOL input (9 decimals)
      const feeEarned = tradeVolume * 0.01; // 1% fee
      
      const trackingData = {
        userWallet: walletAddress || 'unknown',
        tradeVolume: tradeVolume,
        feeEarned: feeEarned,
        tokenIn: swapResult?.inputMint || 'SOL',
        tokenOut: swapResult?.outputMint || coin?.mintAddress,
        transactionSignature: txid,
        metadata: {
          coinSymbol: coin?.symbol,
          coinName: coin?.name,
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
        // button that delegates to our unified wallet modal via onRequestConnectWallet.
        enableWalletPassthrough: true,
        passthroughWalletContextState: jupiterWallet,
        onRequestConnectWallet: () => setShowModal(true),

        formProps: {
          initialInputMint: "So11111111111111111111111111111111111111112", // SOL
          initialOutputMint: coin.mintAddress,
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
    setShowLimitPanel(false);
    setLimitPct(5);
    setLimitPctInput('5');
    setLimitLoading(false);
    setLimitError(null);
    setLimitSuccess(false);
    setLimitPriceInput('');
    onClose();
  };

  // When opened with initialTab='limit', jump straight to the limit page
  useEffect(() => {
    if (isOpen && initialTab === 'limit') {
      setActiveTab('limit');
    }
  }, [isOpen, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Base price from coin data (used for target price calculations)
  const basePrice = coin?.priceUsd || coin?.price_usd || coin?.price || coin?.priceNative || 0;

  const formatTargetPrice = (price) => {
    if (!price || price <= 0) return '';
    if (price < 0.000001) return price.toExponential(4);
    if (price < 0.001) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const handleLimitPctChange = (newPct) => {
    setLimitPct(newPct);
    setLimitPctInput(String(newPct));
    if (basePrice > 0) {
      setLimitPriceInput(formatTargetPrice(basePrice * (1 + newPct / 100)));
    }
  };

  const handleLimitPriceInputChange = (value) => {
    setLimitPriceInput(value);
    const tp = parseFloat(value);
    if (!isNaN(tp) && tp > 0 && basePrice > 0) {
      const newPct = parseFloat((((tp - basePrice) / basePrice) * 100).toFixed(2));
      if (newPct > 0) {
        setLimitPct(newPct);
        setLimitPctInput(newPct.toFixed(newPct % 1 === 0 ? 0 : 2));
      }
    }
  };

  const handleCreateLimitOrder = async () => {
    if (!swapSuccessInfo || !walletAddress) return;
    setLimitLoading(true);
    setLimitError(null);

    try {
      const { swapResult } = swapSuccessInfo;
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const makingAmount = String(swapResult.outputAmount); // tokens received, already in base units
      const takingAmount = String(Math.floor(parseFloat(swapResult.inputAmount) * (1 + limitPct / 100)));

      const response = await fetch(getFullApiUrl('/api/trigger/create-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maker: walletAddress,
          payer: walletAddress,
          inputMint: coin.mintAddress,
          outputMint: SOL_MINT,
          makingAmount,
          takingAmount,
          expiredAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          orderType: 'limit',
        }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to create order');

      const signedTx = await signTransaction(result.data.transaction);

      const executeResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTx,
          requestId: result.data.requestId,
          orderMetadata: {
            maker: walletAddress,
            inputMint: coin.mintAddress,
            outputMint: SOL_MINT,
            side: 'sell',
            orderType: 'limit',
          },
        }),
      });

      const executeResult = await executeResponse.json();
      if (!executeResult.success) throw new Error(executeResult.error || 'Failed to execute order');

      setLimitSuccess(true);
    } catch (err) {
      setLimitError(err.message);
    } finally {
      setLimitLoading(false);
    }
  };

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

  if (!isOpen) return null;

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
                </button>
              </div>
            </>
          )}

          {/* Wallet gate: show the "How to use Moonfeed" onboarding until a
              wallet is connected, then reveal a swipeable swap ⇄ limit UI. */}
          {!jupiterWallet.connected ? (
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
                        onClick={() => setShowModal(true)}
                      >
                        <span className="mf-wallet-name">Connect Wallet</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="mf-wallets-more"
                    onClick={() => setShowModal(true)}
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
                <div className="jt-swipe-page">
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
                </div>

                {/* Page 2 — Limit Order (swipe left to reach) */}
                <div className="jt-swipe-page jt-swipe-page--limit">
                  <TriggerOrderModal
                    embedded
                    isOpen={isOpen}
                    coin={coin}
                    onClose={handleClose}
                    onOrderCreated={handleOrderCreated}
                    initialInputAmount={initialSolAmount}
                    initialPercentage={initialPercentage}
                    initialSide={initialSide}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Success popup overlay after a swap - fixed position so it's always visible */}
          {swapSuccessInfo && (
            <div className="swap-success-fixed-overlay" onClick={(e) => e.stopPropagation()}>
                <div className="swap-success-banner">
                  <div className="success-banner-top">
                    <span className="success-banner-check">✓</span>
                    <span className="success-banner-title">Trade successful!</span>
                  </div>

                  {!showLimitPanel && !limitSuccess && (
                    <button
                      className="setup-limit-link"
                      onClick={() => {
                        setShowLimitPanel(true);
                        if (basePrice > 0) {
                          setLimitPriceInput(formatTargetPrice(basePrice * 1.05));
                        }
                      }}
                    >
                      Setup limit order? →
                    </button>
                  )}

                  {limitSuccess && (
                    <p className="limit-success-confirm">Limit order set! 🎯</p>
                  )}

                  {showLimitPanel && !limitSuccess && (
                    <div className="limit-order-panel">
                      <p className="limit-panel-heading">Auto-sell {coin?.symbol} at profit</p>

                      {/* Take Profit display */}
                      <div className="tp-display">
                        <div className="tp-display-side">
                          <span className="tp-display-label">Entry</span>
                          {basePrice > 0 && (
                            <span className="tp-display-price">${formatTargetPrice(basePrice)}</span>
                          )}
                        </div>
                        <div className="tp-display-arrow">→</div>
                        <div className="tp-display-side tp-display-side--profit">
                          <span className="tp-display-label">Take Profit</span>
                          <span className="tp-display-pct">+{limitPct}%</span>
                          {basePrice > 0 && (
                            <span className="tp-display-price">${formatTargetPrice(basePrice * (1 + limitPct / 100))}</span>
                          )}
                        </div>
                      </div>

                      {/* Single TP slider */}
                      <div className="tp-slider-wrap">
                        <input
                          type="range"
                          min={1}
                          max={200}
                          step={1}
                          value={Math.min(limitPct, 200)}
                          onChange={(e) => handleLimitPctChange(parseInt(e.target.value))}
                          className="tp-slider"
                        />
                        <div className="tp-slider-labels">
                          <span>+1%</span>
                          <span>+200%</span>
                        </div>
                      </div>

                      {/* Inputs: % gain and target price */}
                      <div className="tp-inputs">
                        <div className="limit-input-cell">
                          <span className="limit-input-label">% gain</span>
                          <div className="limit-custom-input-wrap dual-wrap--profit">
                            <input
                              type="number"
                              min="0.01"
                              step="0.1"
                              value={limitPctInput}
                              onChange={(e) => {
                                setLimitPctInput(e.target.value);
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0) {
                                  setLimitPct(v);
                                  if (basePrice > 0) {
                                    setLimitPriceInput(formatTargetPrice(basePrice * (1 + v / 100)));
                                  }
                                }
                              }}
                              className="limit-pct-input"
                            />
                            <span className="limit-pct-symbol">%</span>
                          </div>
                        </div>
                        <div className="limit-input-cell">
                          <span className="limit-input-label">Target price</span>
                          <div className="limit-custom-input-wrap dual-wrap--profit">
                            <span className="limit-pct-symbol">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={limitPriceInput}
                              onChange={(e) => handleLimitPriceInputChange(e.target.value)}
                              className="limit-pct-input limit-price-field"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>

                      {limitError && (
                        <p className="limit-error-text">{limitError}</p>
                      )}

                      <div className="limit-action-row">
                        <button
                          className="create-limit-btn"
                          onClick={handleCreateLimitOrder}
                          disabled={limitLoading}
                        >
                          {limitLoading ? 'Creating...' : `Take Profit +${limitPct}%`}
                        </button>
                        <button
                          className="limit-cancel-btn"
                          onClick={() => setShowLimitPanel(false)}
                          disabled={limitLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* Footer */}
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
      </div>
    </>
  );
};

export default JupiterTradeModal;
