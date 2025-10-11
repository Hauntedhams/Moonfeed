import React, { useEffect, useRef, useState } from 'react';
import './JupiterTradeModal.css';

const JupiterTradeModal = ({ isOpen, onClose, coin, onSwapSuccess, onSwapError }) => {
  const jupiterInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && coin) {
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
    
    // Clean up on close
    if (!isOpen && jupiterInitialized.current) {
      jupiterInitialized.current = false;
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, coin]);

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

      // Initialize - simplified for mobile
      window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "jupiter-container",
        endpoint: "https://api.mainnet-beta.solana.com",
        
        formProps: {
          initialOutputMint: coin.mintAddress,
          initialInputMint: "So11111111111111111111111111111111111111112", // SOL
        },

        strictTokenList: false,
        
        containerStyles: {
          borderRadius: '16px',
          backgroundColor: 'rgba(16, 23, 31, 0.95)',
        },

        onSuccess: ({ txid, swapResult }) => {
          console.log('✅ Swap success:', txid);
          onSwapSuccess?.({ txid, swapResult, coin });
        },

        onError: ({ error }) => {
          console.error('❌ Swap error:', error);
          onSwapError?.({ error, coin });
        },

        onScreenUpdate: (screen) => {
          if (screen) {
            setIsLoading(false);
          }
        },
      });

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
    onClose();
  };

  if (!isOpen) return null;

  return (
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

        {/* Jupiter Container */}
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

        {/* Footer */}
        <div className="jupiter-modal-footer">
          <p className="powered-by">Powered by Jupiter</p>
        </div>
      </div>
    </div>
  );
};

export default JupiterTradeModal;
