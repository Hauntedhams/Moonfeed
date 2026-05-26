import React, { useEffect, useRef, useState } from 'react';
import TriggerOrderModal from './TriggerOrderModal';
import { useWallet } from '../contexts/WalletContext';
import { useWallet as useJupiterWallet, UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import ReferralTracker from '../utils/ReferralTracker';
import './JupiterTradeModal.css';

const JupiterTradeModal = ({ isOpen, onClose, coin, onSwapSuccess, onSwapError }) => {
  const jupiterInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('swap'); // 'swap' or 'limit'
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const { walletAddress } = useWallet();
  
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
