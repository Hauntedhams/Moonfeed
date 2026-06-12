import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getFullApiUrl } from '../config/api';
import { useWallet } from '../contexts/WalletContext';
import './TriggerOrderModal.css';

const TriggerOrderModal = ({ 
  isOpen, 
  onClose, 
  coin,
  onOrderCreated,
  initialInputAmount,
}) => {
  const { walletAddress, connected, signTransaction, recheckConnection, connect } = useWallet();
  const [orderType, setOrderType] = useState('limit'); // 'limit' or 'stop'
  const [side, setSide] = useState('buy'); // 'buy' or 'sell'
  const [inputAmount, setInputAmount] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [priceType, setPriceType] = useState('price'); // 'price' or 'percentage'
  const [percentage, setPercentage] = useState('');
  const [expiry, setExpiry] = useState('7d'); // '1h', '24h', '7d', '30d', 'custom'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [useSlider, setUseSlider] = useState(true); // Enable slider by default
  const [sliderValue, setSliderValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Stop Loss state
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [stopLossSliderValue, setStopLossSliderValue] = useState(0);
  const [stopLossPct, setStopLossPct] = useState(-20);

  // Force recheck wallet connection when modal opens
  useEffect(() => {
    if (isOpen && recheckConnection) {
      console.log('🔄 Modal opened - triggering wallet recheck...');
      recheckConnection();
      
      // Double-check after a short delay to ensure state has updated
      setTimeout(() => {
        console.log('🔄 Double-checking wallet state after delay...');
        recheckConnection();
      }, 100);
    }
  }, [isOpen, recheckConnection]);

  // Debug wallet state (with more detail)
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 TriggerOrderModal - Detailed Wallet State:', {
        'From Context - walletAddress': walletAddress || '❌ NULL',
        'From Context - connected': connected ? '✅ true' : '❌ false',
        'From Context - hasSignTransaction': !!signTransaction ? '✅ true' : '❌ false',
        'From Window - wallet': window.solana?.publicKey?.toString() || '❌ null',
        'From Window - isConnected': window.solana?.isConnected ? '✅ true' : '❌ false',
        'Button will be': (!walletAddress || !inputAmount || !triggerPrice) ? '🔒 DISABLED' : '✅ ENABLED'
      });
      // Pre-fill SOL amount if provided (e.g. from graduation snipe)
      if (initialInputAmount) {
        setInputAmount(String(initialInputAmount));
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current price from coin data - check multiple possible field names
  const currentPrice = coin?.priceUsd || coin?.price_usd || coin?.price || coin?.priceNative || 0;

  // Calculate price range for slider (50% below to 100% above current price)
  const priceRange = useMemo(() => {
    if (currentPrice <= 0) return { min: 0, max: 1, step: 0.01 };
    const min = currentPrice * 0.5;
    const max = currentPrice * 2;
    const step = (max - min) / 1000;
    return { min, max, step };
  }, [currentPrice]);

  // Stop-loss slider range: -80% to -1% of current price
  const slRange = useMemo(() => {
    if (currentPrice <= 0) return { min: 0, max: 1, step: 0.01 };
    const min = currentPrice * 0.20; // -80%
    const max = currentPrice * 0.99; // -1%
    const step = (max - min) / 500;
    return { min, max, step };
  }, [currentPrice]);

  // Initialize slider value when modal opens or price changes
  useEffect(() => {
    if (isOpen && currentPrice > 0 && sliderValue === 0) {
      setSliderValue(currentPrice);
      setTriggerPrice(currentPrice.toFixed(8));
    }
    // Init stop-loss at -20% of current price
    if (isOpen && currentPrice > 0 && stopLossSliderValue === 0) {
      const defaultSL = currentPrice * 0.80;
      setStopLossSliderValue(defaultSL);
      setStopLossPrice(defaultSL.toFixed(8));
    }
  }, [isOpen, currentPrice]);

  // Handle slider change
  const handleSliderChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setSliderValue(value);
    setTriggerPrice(value.toFixed(8));
    setPriceType('price');
    
    // Calculate and update percentage
    if (currentPrice > 0) {
      const pct = ((value - currentPrice) / currentPrice) * 100;
      setPercentage(pct.toFixed(2));
    }
  }, [currentPrice]);

  // Handle stop-loss slider change
  const handleStopLossSliderChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setStopLossSliderValue(value);
    setStopLossPrice(value.toFixed(8));
    if (currentPrice > 0) {
      const pct = ((value - currentPrice) / currentPrice) * 100;
      setStopLossPct(parseFloat(pct.toFixed(2)));
    }
  }, [currentPrice]);

  // Calculate percentage from current slider/trigger price
  const percentageFromCurrent = useMemo(() => {
    if (!triggerPrice || !currentPrice || currentPrice <= 0) return 0;
    return ((parseFloat(triggerPrice) - currentPrice) / currentPrice) * 100;
  }, [triggerPrice, currentPrice]);

  // Debug price on modal open
  useEffect(() => {
    if (isOpen) {
      console.log('💰 Coin Price Data:', {
        'coin.priceUsd': coin?.priceUsd,
        'coin.price_usd': coin?.price_usd,
        'coin.price': coin?.price,
        'coin.priceNative': coin?.priceNative,
        'currentPrice (selected)': currentPrice,
        'coin.symbol': coin?.symbol,
        'coin.mintAddress': coin?.mintAddress,
        'Available': currentPrice > 0 ? '✅ Yes' : '❌ No - Use manual entry',
        'Full coin object': coin
      });
    }
  }, [isOpen, coin, currentPrice]);

  // Calculate trigger price from percentage
  useEffect(() => {
    if (priceType === 'percentage' && percentage) {
      if (currentPrice > 0) {
        const calculatedPrice = currentPrice * (1 + parseFloat(percentage) / 100);
        setTriggerPrice(calculatedPrice.toFixed(8));
        console.log('💰 Calculated trigger price:', calculatedPrice, 'from', percentage, '% of', currentPrice);
      } else {
        // If no current price, clear trigger price and show error
        console.warn('⚠️ No current price available for percentage calculation');
        setTriggerPrice('');
        setError('Current price unavailable. Please enter a manual price.');
      }
    }
  }, [percentage, priceType, currentPrice]);

  // Calculate percentage from price
  useEffect(() => {
    if (priceType === 'price' && triggerPrice && currentPrice) {
      const calculatedPercentage = ((parseFloat(triggerPrice) - currentPrice) / currentPrice) * 100;
      setPercentage(calculatedPercentage.toFixed(2));
    }
  }, [triggerPrice, priceType, currentPrice]);

  const getExpiryTimestamp = () => {
    const now = Date.now();
    const expiryMap = {
      '1h': now + 60 * 60 * 1000,
      '24h': now + 24 * 60 * 60 * 1000,
      '7d': now + 7 * 24 * 60 * 60 * 1000,
      '30d': now + 30 * 24 * 60 * 60 * 1000,
    };
    return expiryMap[expiry] || null;
  };

  const handleCreateOrder = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!triggerPrice || parseFloat(triggerPrice) <= 0) {
      setError('Please enter a valid trigger price');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine input and output mints based on buy/sell
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const inputMint = side === 'buy' ? SOL_MINT : coin.mintAddress;
      const outputMint = side === 'buy' ? coin.mintAddress : SOL_MINT;

      // Fetch actual token decimals (Pump.fun tokens use 6, not 9)
      let tokenDecimals = 6; // safe default for meme/pump tokens
      try {
        const metaRes = await fetch(`https://tokens.jup.ag/token/${coin.mintAddress}`);
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (typeof meta.decimals === 'number') tokenDecimals = meta.decimals;
        }
      } catch (_) { /* use default */ }
      const tokenMultiplier = Math.pow(10, tokenDecimals);

      // Convert amounts to smallest unit using correct decimals
      // SOL always uses 9 decimals (lamports); token uses fetched decimals
      const makingAmount = side === 'buy'
        ? (parseFloat(inputAmount) * 1e9).toFixed(0)          // SOL → lamports
        : (parseFloat(inputAmount) * tokenMultiplier).toFixed(0); // token → smallest unit

      // Calculate minimum output based on trigger price
      // For buy:  outputAmount = inputAmount / triggerPrice  (tokens out)
      // For sell: outputAmount = inputAmount * triggerPrice  (SOL out in lamports)
      const minOutput = side === 'buy'
        ? (parseFloat(inputAmount) / parseFloat(triggerPrice)) * tokenMultiplier
        : (parseFloat(inputAmount) * parseFloat(triggerPrice)) * 1e9;
      const takingAmount = minOutput.toFixed(0);

      const expiredAt = getExpiryTimestamp();

      console.log('🎯 Creating trigger order:', {
        side,
        orderType,
        inputAmount,
        triggerPrice,
        expiredAt: expiredAt ? new Date(expiredAt).toISOString() : 'none'
      });

      // Call backend to create order transaction
      const response = await fetch(getFullApiUrl('/api/trigger/create-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maker: walletAddress,
          payer: walletAddress, // Add payer (same as maker for user orders)
          inputMint,
          outputMint,
          makingAmount,
          takingAmount,
          expiredAt,
          orderType
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      console.log('📝 Order transaction created, signing...');
      console.log('🔑 Request ID:', result.data?.requestId);

      // Sign the transaction with wallet
      const signedTx = await signTransaction(result.data.transaction);
      console.log('✅ Transaction signed');

      // Prepare order metadata for storage
      const orderMetadata = {
        maker: walletAddress,
        inputMint,
        outputMint,
        side,
        orderType,
        expiredAt
      };

      // Execute the order with requestId and metadata
      const executeResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTx,
          requestId: result.data.requestId, // MUST include requestId from createOrder response
          orderMetadata // Include metadata for potential storage
        })
      });

      const executeResult = await executeResponse.json();

      if (!executeResult.success) {
        throw new Error(executeResult.error || 'Failed to execute order');
      }

      console.log('✅ Order executed successfully!');
      console.log('📝 Transaction signature:', executeResult.signature);

      // Store signature in localStorage for future reference
      if (executeResult.signature && executeResult.orderId) {
        const { storeOrderSignature } = await import('../utils/orderStorage.js');
        storeOrderSignature({
          orderId: executeResult.orderId,
          signature: executeResult.signature,
          maker: walletAddress,
          orderType: 'create'
        });
      }

      // ── Stop Loss order (second Jupiter trigger order) ──────────────
      if (stopLossEnabled && side === 'sell' && stopLossPrice && parseFloat(stopLossPrice) > 0) {
        try {
          const slMakingAmount = (parseFloat(inputAmount) * tokenMultiplier).toFixed(0);
          const slTakingAmount = ((parseFloat(inputAmount) * parseFloat(stopLossPrice)) * 1e9).toFixed(0);
          const slResponse = await fetch(getFullApiUrl('/api/trigger/create-order'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              maker: walletAddress,
              payer: walletAddress,
              inputMint: coin.mintAddress,
              outputMint: 'So11111111111111111111111111111111111111112',
              makingAmount: slMakingAmount,
              takingAmount: slTakingAmount,
              expiredAt,
              orderType: 'stop'
            })
          });
          const slResult = await slResponse.json();
          if (slResult.success) {
            console.log('🛡️ Signing stop-loss order...');
            const slSignedTx = await signTransaction(slResult.data.transaction);
            await fetch(getFullApiUrl('/api/trigger/execute'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signedTransaction: slSignedTx,
                requestId: slResult.data.requestId,
              })
            });
            console.log('✅ Stop-loss order placed at', stopLossPrice);
          }
        } catch (slErr) {
          console.warn('⚠️ Stop-loss order failed (main order succeeded):', slErr.message);
        }
      }

      setSuccess(true);
      onOrderCreated?.({
        ...result,
        orderId: executeResult.orderId,
        signature: executeResult.signature
      });

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      console.error('❌ Error creating order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '0';
    const num = parseFloat(price);
    if (num < 0.00001) return num.toExponential(4);
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(6);
    return num.toFixed(4);
  };

  if (!isOpen) return null;

  return (
    <div className="trigger-modal-overlay" onClick={onClose}>
      <div className="trigger-modal-content compact-layout" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="success-message">
            <div className="success-icon">✅</div>
            <h3>Order Created!</h3>
            <p>Your limit order has been created successfully</p>
          </div>
        ) : (
          <>
            {/* Compact Header with Coin Info */}
            <div className="compact-header">
              <div className="header-left">
                <img 
                  src={coin?.image || '/default-coin.svg'} 
                  alt={coin?.symbol}
                  className="coin-image-small"
                  onError={(e) => e.target.src = '/default-coin.svg'}
                />
                <div className="coin-details">
                  <h3>{coin?.symbol}</h3>
                  <span className="current-price-badge">${formatPrice(currentPrice)}</span>
                </div>
              </div>
              <button className="close-btn-compact" onClick={onClose}>✕</button>
            </div>

            {/* Quick Action Row: Order Type + Buy/Sell */}
            <div className="action-row">
              <div className="action-group">
                <button 
                  className={`action-btn ${orderType === 'limit' ? 'active' : ''}`}
                  onClick={() => setOrderType('limit')}
                >
                  Limit
                </button>
                <button 
                  className={`action-btn ${orderType === 'stop' ? 'active' : ''}`}
                  onClick={() => setOrderType('stop')}
                >
                  Stop
                </button>
              </div>
              <div className="action-group">
                <button 
                  className={`action-btn buy-btn ${side === 'buy' ? 'active' : ''}`}
                  onClick={() => setSide('buy')}
                >
                  Buy
                </button>
                <button 
                  className={`action-btn sell-btn ${side === 'sell' ? 'active' : ''}`}
                  onClick={() => setSide('sell')}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* HERO: Price Slider Section */}
            <div className={`hero-slider-section ${side}`}>
              {currentPrice > 0 ? (
                <>
                  <div className="slider-hero-display">
                    <div className="price-main">
                      <span className="price-label">Target Price</span>
                      <span className="price-value">${formatPrice(triggerPrice || sliderValue)}</span>
                    </div>
                    <span className={`percentage-badge ${percentageFromCurrent >= 0 ? 'positive' : 'negative'}`}>
                      {percentageFromCurrent >= 0 ? '+' : ''}{percentageFromCurrent.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="slider-wrapper-hero">
                    <div 
                      className="slider-track-fill"
                      style={{
                        width: `${((sliderValue - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%`,
                        background: side === 'buy' 
                          ? 'linear-gradient(90deg, #10b981, #059669)'
                          : 'linear-gradient(90deg, #ef4444, #dc2626)'
                      }}
                    />
                    <div 
                      className="current-price-marker"
                      style={{ 
                        left: `${((currentPrice - priceRange.min) / (priceRange.max - priceRange.min)) * 100}%` 
                      }}
                    >
                      <span className="marker-dot"></span>
                    </div>
                    <input
                      type="range"
                      min={priceRange.min}
                      max={priceRange.max}
                      step={priceRange.step}
                      value={sliderValue || currentPrice}
                      onChange={handleSliderChange}
                      onMouseDown={() => setIsDragging(true)}
                      onMouseUp={() => setIsDragging(false)}
                      onTouchStart={() => setIsDragging(true)}
                      onTouchEnd={() => setIsDragging(false)}
                      className={`price-slider-input ${isDragging ? 'dragging' : ''}`}
                    />
                  </div>
                  
                  <div className="slider-labels">
                    <span>-50%</span>
                    <span className="current-marker">▼ Current</span>
                    <span>+100%</span>
                  </div>

                  {/* Quick Percentage Chips */}
                  <div className="quick-chips">
                    {[-25, -10, 10, 25, 50].map(pct => (
                      <button
                        key={pct}
                        className={`chip ${pct < 0 ? 'negative' : 'positive'} ${Math.abs(percentageFromCurrent - pct) < 1 ? 'selected' : ''}`}
                        onClick={() => {
                          const targetPrice = currentPrice * (1 + pct / 100);
                          setPercentage(pct.toString());
                          setTriggerPrice(targetPrice.toFixed(8));
                          setSliderValue(targetPrice);
                          setError(null);
                        }}
                      >
                        {pct > 0 ? '+' : ''}{pct}%
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="manual-price-input">
                  <label>Target Price (USD)</label>
                  <input
                    type="number"
                    value={triggerPrice}
                    onChange={(e) => setTriggerPrice(e.target.value)}
                    placeholder="Enter price..."
                    step="0.00000001"
                    min="0"
                  />
                </div>
              )}
            </div>

            {/* Stop Loss Section — shown when selling and price data available */}
            {side === 'sell' && currentPrice > 0 && (
              <div className={`stop-loss-section${stopLossEnabled ? ' sl-active' : ''}`}>
                <div className="sl-header">
                  <div className="sl-title-group">
                    <span className="sl-shield">🛡️</span>
                    <div>
                      <span className="sl-title">Stop Loss</span>
                      <span className="sl-subtitle">Auto-sell if price drops</span>
                    </div>
                  </div>
                  <label className="sl-toggle">
                    <input
                      type="checkbox"
                      checked={stopLossEnabled}
                      onChange={(e) => setStopLossEnabled(e.target.checked)}
                    />
                    <span className="sl-toggle-track">
                      <span className="sl-toggle-thumb" />
                    </span>
                  </label>
                </div>

                {stopLossEnabled && (
                  <div className="sl-body">
                    <div className="sl-display">
                      <div className="sl-price-group">
                        <span className="sl-label">Sell if price falls to</span>
                        <span className="sl-price-value">${formatPrice(stopLossPrice)}</span>
                      </div>
                      <span className="sl-pct-badge">{stopLossPct >= 0 ? '+' : ''}{stopLossPct.toFixed(1)}%</span>
                    </div>

                    <div className="slider-wrapper-hero sl-slider-wrapper">
                      <div
                        className="slider-track-fill sl-track-fill"
                        style={{
                          left: `${((stopLossSliderValue - slRange.min) / (slRange.max - slRange.min)) * 100}%`,
                          width: `${((slRange.max - stopLossSliderValue) / (slRange.max - slRange.min)) * 100}%`,
                        }}
                      />
                      <input
                        type="range"
                        min={slRange.min}
                        max={slRange.max}
                        step={slRange.step}
                        value={stopLossSliderValue || slRange.min}
                        onChange={handleStopLossSliderChange}
                        className="price-slider-input sl-slider-input"
                      />
                    </div>

                    <div className="slider-labels">
                      <span>-80%</span>
                      <span>-1%</span>
                    </div>

                    <div className="quick-chips sl-chips">
                      {[-5, -10, -20, -30, -50].map(pct => (
                        <button
                          key={pct}
                          className={`chip negative${Math.abs(stopLossPct - pct) < 0.5 ? ' selected' : ''}`}
                          onClick={() => {
                            const price = currentPrice * (1 + pct / 100);
                            setStopLossPct(pct);
                            setStopLossPrice(price.toFixed(8));
                            setStopLossSliderValue(price);
                          }}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compact Amount + Expiry Row */}
            <div className="input-row">
              <div className="input-group flex-2">
                <label>Amount ({side === 'buy' ? 'SOL' : coin?.symbol})</label>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="input-group flex-1">
                <label>Expires</label>
                <div className="expiry-chips">
                  {['24h', '7d', '30d'].map(exp => (
                    <button
                      key={exp}
                      className={`expiry-chip ${expiry === exp ? 'active' : ''}`}
                      onClick={() => setExpiry(exp)}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mini Order Summary */}
            {inputAmount && triggerPrice && parseFloat(triggerPrice) > 0 && (
              <div className="mini-summary">
                <span className="summary-text">
                  {side === 'buy' ? 'Buy' : 'Sell'} {inputAmount} {side === 'buy' ? 'SOL' : coin?.symbol} → Get ~{
                    side === 'buy' 
                      ? (parseFloat(inputAmount) / parseFloat(triggerPrice)).toFixed(2)
                      : (parseFloat(inputAmount) * parseFloat(triggerPrice)).toFixed(4)
                  } {side === 'buy' ? coin?.symbol : 'SOL'}
                </span>
              </div>
            )}

            {/* Error/Warning Messages */}
            {error && <div className="inline-error">{error}</div>}
            {!walletAddress && (
              <div className="inline-warning">
                <button className="connect-wallet-link" onClick={connect}>
                  Connect wallet
                </button>
                {' '}to create orders
              </div>
            )}

            {/* Sticky Create Button */}
            <div className="sticky-button-container">
              <button
                className={`create-order-btn-hero ${side}`}
                onClick={handleCreateOrder}
                disabled={loading || !walletAddress || !inputAmount || !triggerPrice || parseFloat(triggerPrice) <= 0}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    {side === 'buy' ? 'Buy' : 'Sell'} at ${formatPrice(triggerPrice)}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TriggerOrderModal;
