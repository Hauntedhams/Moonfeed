import React, { useEffect, useRef, useState } from 'react';
import TriggerOrderModal from './TriggerOrderModal';
import { useWallet } from '../contexts/WalletContext';
import { useWallet as useJupiterWallet, UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import ReferralTracker from '../utils/ReferralTracker';
import { getFullApiUrl } from '../config/api';
import './JupiterTradeModal.css';

const JupiterTradeModal = ({ isOpen, onClose, coin, onSwapSuccess, onSwapError, initialTab, initialSolAmount }) => {
  const jupiterInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('swap'); // 'swap' or 'limit'
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [swapSuccessInfo, setSwapSuccessInfo] = useState(null);
  const [showLimitPanel, setShowLimitPanel] = useState(false);
  const [limitPct, setLimitPct] = useState(5);
  const [limitPctInput, setLimitPctInput] = useState('5');
  const [limitLoading, setLimitLoading] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [limitSuccess, setLimitSuccess] = useState(false);
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPct, setStopLossPct] = useState(20);
  const [stopLossPctInput, setStopLossPctInput] = useState('20');
  const [stopLossPriceInput, setStopLossPriceInput] = useState('');
  const { walletAddress, signTransaction } = useWallet();
  
  // Get the full Jupiter wallet adapter for passthrough to Terminal
  const jupiterWallet = useJupiterWallet();

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
    // Only initialize Jupiter when wallet is connected
    if (isOpen && coin && activeTab === 'swap' && jupiterWallet.connected) {
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
    
    // Clean up on close or tab change or disconnect
    if ((!isOpen || activeTab === 'limit' || !jupiterWallet.connected) && jupiterInitialized.current) {
      jupiterInitialized.current = false;
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, coin, activeTab, jupiterWallet.connected]);

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

        // Wallet passthrough — shares the app's connected wallet with the Plugin
        enableWalletPassthrough: true,
        passthroughWalletContextState: jupiterWallet,

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
    setStopLossEnabled(false);
    setStopLossPct(20);
    setStopLossPctInput('20');
    setStopLossPriceInput('');
    onClose();
  };

  // When opened with initialTab='limit', jump straight to TriggerOrderModal
  useEffect(() => {
    if (isOpen && initialTab === 'limit') {
      setShowTriggerModal(true);
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

  const handleStopLossPctChange = (newPct) => {
    setStopLossPct(newPct);
    setStopLossPctInput(String(newPct));
    if (basePrice > 0) {
      setStopLossPriceInput(formatTargetPrice(basePrice * (1 - newPct / 100)));
    }
  };

  const handleStopLossPriceInputChange = (value) => {
    setStopLossPriceInput(value);
    const tp = parseFloat(value);
    if (!isNaN(tp) && tp > 0 && basePrice > 0) {
      const newPct = parseFloat((((basePrice - tp) / basePrice) * 100).toFixed(2));
      if (newPct > 0) {
        setStopLossPct(newPct);
        setStopLossPctInput(newPct.toFixed(newPct % 1 === 0 ? 0 : 2));
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

      // Place stop-loss order
      if (stopLossPct > 0) {
        try {
          const slTakingAmount = String(Math.floor(parseFloat(swapResult.inputAmount) * (1 - stopLossPct / 100)));

          const slResponse = await fetch(getFullApiUrl('/api/trigger/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              maker: walletAddress,
              payer: walletAddress,
              inputMint: coin.mintAddress,
              outputMint: SOL_MINT,
              makingAmount,
              takingAmount: slTakingAmount,
              expiredAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
              orderType: 'stop',
            }),
          });

          const slResult = await slResponse.json();
          if (!slResult.success) throw new Error(slResult.error || 'Failed to create stop-loss order');

          const slSignedTx = await signTransaction(slResult.data.transaction);

          const slExecuteResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signedTransaction: slSignedTx,
              requestId: slResult.data.requestId,
              orderMetadata: {
                maker: walletAddress,
                inputMint: coin.mintAddress,
                outputMint: SOL_MINT,
                side: 'sell',
                orderType: 'stop',
              },
            }),
          });

          const slExecuteResult = await slExecuteResponse.json();
          if (!slExecuteResult.success) throw new Error(slExecuteResult.error || 'Failed to execute stop-loss order');
        } catch (slErr) {
          console.warn('⚠️ Stop-loss order failed (take-profit succeeded):', slErr.message);
          // Don't fail the whole operation if stop-loss fails
        }
      }

      setLimitSuccess(true);
    } catch (err) {
      setLimitError(err.message);
    } finally {
      setLimitLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    if (tab === 'limit') {
      setShowTriggerModal(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleTriggerModalClose = () => {
    setShowTriggerModal(false);
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
          {/* Header */}
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

          {/* Jupiter Container - only shown when swap tab is active */}
          {activeTab === 'swap' && (
            <div className="jupiter-widget-wrapper">
              {/* Show connect wallet prompt if not connected */}
              {!jupiterWallet.connected && (
                <div className="jupiter-connect-prompt">
                  <div className="connect-prompt-content">
                    <div className="connect-icon">👛</div>
                    <h3>Connect Your Wallet</h3>
                    <p>Connect your Solana wallet to start trading {coin?.symbol || 'tokens'}</p>
                    <div className="connect-button-container">
                      <UnifiedWalletButton />
                    </div>
                    <p className="connect-hint">
                      Supports Phantom, Solflare, and other Solana wallets
                    </p>
                  </div>
                </div>
              )}
              
              {/* Show loading/error states only when connected */}
              {jupiterWallet.connected && isLoading && (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading...</p>
                </div>
              )}
              
              {jupiterWallet.connected && error && (
                <div className="error-state">
                  <p>Failed to load</p>
                  <button onClick={initializeJupiter} className="retry-button">
                    Retry
                  </button>
                </div>
              )}
              
              {/* Jupiter container - hidden when not connected */}
              <div 
                id="jupiter-container"
                style={{ 
                  width: '100%', 
                  height: '600px',
                  minHeight: '600px',
                  opacity: (!jupiterWallet.connected || isLoading || error) ? 0 : 1,
                  display: !jupiterWallet.connected ? 'none' : 'block',
                  transition: 'opacity 0.3s'
                }}
              />
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
                          setStopLossPriceInput(formatTargetPrice(basePrice * 0.80));
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
                      <p className="limit-panel-heading">Auto-sell {coin?.symbol}</p>

                      {/* ── Dual Exit Targets ── */}
                      <div className="dual-exit-display">
                        <div className="dual-exit-side dual-exit-side--loss">
                          <span className="dual-exit-label">Stop Loss</span>
                          <span className="dual-exit-pct">-{stopLossPct}%</span>
                          {basePrice > 0 && (
                            <span className="dual-exit-price">${formatTargetPrice(basePrice * (1 - stopLossPct / 100))}</span>
                          )}
                        </div>
                        <div className="dual-exit-center">
                          <span className="dual-exit-current-label">Entry</span>
                          {basePrice > 0 && (
                            <span className="dual-exit-current-price">${formatTargetPrice(basePrice)}</span>
                          )}
                        </div>
                        <div className="dual-exit-side dual-exit-side--profit">
                          <span className="dual-exit-label">Take Profit</span>
                          <span className="dual-exit-pct">+{limitPct}%</span>
                          {basePrice > 0 && (
                            <span className="dual-exit-price">${formatTargetPrice(basePrice * (1 + limitPct / 100))}</span>
                          )}
                        </div>
                      </div>

                      {/* Dual range slider */}
                      <div className="dual-range-slider">
                        <div className="dual-range-track-bg">
                          <div
                            className="dual-range-zone dual-range-zone--loss"
                            style={{ width: `${((80 - Math.min(stopLossPct, 79)) / 180) * 100}%` }}
                          />
                          <div
                            className="dual-range-zone dual-range-zone--profit"
                            style={{ left: `${((80 + Math.min(limitPct, 100)) / 180) * 100}%`, right: 0 }}
                          />
                          <div className="dual-range-current" style={{ left: `${(80 / 180) * 100}%` }} />
                        </div>
                        {/* Stop loss handle (red, left side) */}
                        <input
                          type="range"
                          min={-80}
                          max={100}
                          step={1}
                          value={-Math.min(stopLossPct, 80)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val < 0) handleStopLossPctChange(-val);
                          }}
                          className="dual-range-input dual-range-input--loss"
                        />
                        {/* Take profit handle (green, right side) */}
                        <input
                          type="range"
                          min={-80}
                          max={100}
                          step={1}
                          value={Math.min(limitPct, 100)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0) handleLimitPctChange(val);
                          }}
                          className="dual-range-input dual-range-input--profit"
                        />
                        <div className="dual-range-labels">
                          <span>-80%</span>
                          <span>▲ Entry</span>
                          <span>+100%</span>
                        </div>
                      </div>

                      {/* Input fields: stop loss left, take profit right */}
                      <div className="dual-inputs-grid">
                        <div className="limit-input-cell">
                          <span className="limit-input-label dual-label--loss">% loss</span>
                          <div className="limit-custom-input-wrap dual-wrap--loss">
                            <input
                              type="number"
                              min="1"
                              max="80"
                              step="1"
                              value={stopLossPctInput}
                              onChange={(e) => {
                                setStopLossPctInput(e.target.value);
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0) {
                                  setStopLossPct(v);
                                  if (basePrice > 0) {
                                    setStopLossPriceInput(formatTargetPrice(basePrice * (1 - v / 100)));
                                  }
                                }
                              }}
                              className="limit-pct-input"
                            />
                            <span className="limit-pct-symbol">%</span>
                          </div>
                        </div>
                        <div className="limit-input-cell">
                          <span className="limit-input-label dual-label--profit">% gain</span>
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
                          <span className="limit-input-label dual-label--loss">Stop price</span>
                          <div className="limit-custom-input-wrap dual-wrap--loss">
                            <span className="limit-pct-symbol">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={stopLossPriceInput}
                              onChange={(e) => handleStopLossPriceInputChange(e.target.value)}
                              className="limit-pct-input limit-price-field"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="limit-input-cell">
                          <span className="limit-input-label dual-label--profit">Target price</span>
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
                          {limitLoading ? 'Creating...' : `Set -${stopLossPct}% / +${limitPct}%`}
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
            <p className="powered-by">Powered by Jupiter</p>
          </div>
        </div>
      </div>

      {/* Trigger Order Modal */}
      <TriggerOrderModal
        isOpen={showTriggerModal}
        onClose={handleTriggerModalClose}
        coin={coin}
        onOrderCreated={handleOrderCreated}
        initialInputAmount={initialSolAmount}
      />
    </>
  );
};

export default JupiterTradeModal;
