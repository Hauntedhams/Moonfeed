import React, { useEffect, useRef, useState } from 'react';
import TriggerOrderModal from './TriggerOrderModal';
import { useWallet } from '../contexts/WalletContext';
import ReferralTracker from '../utils/ReferralTracker';
import './JupiterTradeModal.css';

const JupiterTradeModal = ({ isOpen, onClose, coin, onSwapSuccess, onSwapError }) => {
  const jupiterInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('swap'); // 'swap' or 'limit'
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const { walletAddress } = useWallet();

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

  useEffect(() => {
    if (isOpen && coin && activeTab === 'swap') {
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
    
    // Clean up on close or tab change
    if ((!isOpen || activeTab === 'limit') && jupiterInitialized.current) {
      jupiterInitialized.current = false;
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, coin, activeTab]);

  const initializeJupiter = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Validate coin
      if (!coin?.mintAddress) {
        throw new Error('Invalid coin');
      }
      
      console.log('🪐 Loading Jupiter for', coin.symbol);
      
      // Close existing instance
      if (window.Jupiter._instance) {
        try {
          window.Jupiter.close();
        } catch (e) {
          // Ignore close errors
        }
      }

      // Fetch referral configuration from backend
      let referralConfig = null;
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/jupiter/referral/config/${coin.mintAddress}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            referralConfig = data;
            console.log('✅ Loaded referral config:', {
              feeAccount: data.feeAccount,
              feeBps: data.feeBps
            });
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not load referral config:', error.message);
      }

      // Initialize Jupiter Terminal v4
      // NOTE: v4 automatically detects and uses connected wallets (Phantom/Solflare)
      // No need to manually pass wallet - it uses Unified Wallet Kit
      
      // Build feeAccounts Map with both SOL and the token
      // This ensures fees work for both buy (SOL→Token) and sell (Token→SOL) directions
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const feeAccountsMap = new Map();
      
      if (referralConfig?.feeAccount) {
        // Add the token's fee account from backend
        feeAccountsMap.set(coin.mintAddress, referralConfig.feeAccount);
        console.log('📊 Fee account mapping:', coin.mintAddress, '→', referralConfig.feeAccount);
      }
      
      console.log('🔑 Jupiter config - referralFee: 100 (1%), referralAccount:', "42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt");
      
      const jupiterConfig = {
        displayMode: "integrated",
        integratedTargetId: "jupiter-container",
        endpoint: "https://api.mainnet-beta.solana.com",
      };
      
      // Add formProps with referral configuration
      // NEW Jupiter Plugin API uses referralAccount and referralFee inside formProps
      jupiterConfig.formProps = {
        // Set default direction: Buy token with SOL
        initialInputMint: "So11111111111111111111111111111111111111112", // SOL
        initialOutputMint: coin.mintAddress, // Meme token
        
        // 🔑 KEY FIX: Don't fix the mints - allow Jupiter's swap arrow to work
        // This enables the built-in swap direction button in Jupiter UI
        fixedInputMint: false,
        fixedOutputMint: false,
        
        // 🔑 REFERRAL FEE CONFIGURATION (1% = 100 BPS)
        // According to Jupiter Plugin docs: https://dev.jup.ag/tool-kits/plugin/customization
        // This is the Jupiter Ultra Referral Account (PDA)
        referralAccount: "42DqmQMZrVeZkP2Btj2cS96Ej81jVxFqwUZWazVvhUPt",
        referralFee: 100, // 100 BPS = 1%
      };

      jupiterConfig.strictTokenList = false;
      
      jupiterConfig.containerStyles = {
        borderRadius: '16px',
        backgroundColor: 'rgba(16, 23, 31, 0.95)',
      };

      jupiterConfig.onSuccess = ({ txid, swapResult }) => {
        console.log('✅ Swap success:', txid);
        
        // Track trade for affiliate system
        trackTradeWithAffiliate(txid, swapResult);
        
        onSwapSuccess?.({ txid, swapResult, coin });
      };

      jupiterConfig.onError = ({ error }) => {
        console.error('❌ Swap error:', error);
        onSwapError?.({ error, coin });
      };

      jupiterConfig.onScreenUpdate = (screen) => {
        if (screen) {
          setIsLoading(false);
        }
      };

      // Initialize Jupiter with the config
      window.Jupiter.init(jupiterConfig);

      jupiterInitialized.current = true;
      
      // Fallback to hide loading
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
    onClose();
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
              {isLoading && (
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
              
              <div 
                id="jupiter-container"
                style={{ 
                  width: '100%', 
                  height: '600px',
                  minHeight: '600px',
                  opacity: isLoading || error ? 0 : 1,
                  transition: 'opacity 0.3s'
                }}
              />
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
      />
    </>
  );
};

export default JupiterTradeModal;
