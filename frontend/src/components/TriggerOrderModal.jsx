import React, { useState, useEffect } from 'react';
import { getFullApiUrl } from '../config/api';
import { useWallet } from '../contexts/WalletContext';
import './TriggerOrderModal.css';

const TriggerOrderModal = ({ 
  isOpen, 
  onClose, 
  coin,
  onOrderCreated 
}) => {
  const { walletAddress, connected, signTransaction, recheckConnection } = useWallet();
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
    }
  }, [isOpen, walletAddress, connected, inputAmount, triggerPrice]);

  // Get current price from coin data - check multiple possible field names
  const currentPrice = coin?.priceUsd || coin?.price_usd || coin?.price || coin?.priceNative || 0;

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

      // Convert amounts to smallest unit (assuming 9 decimals for SOL and token)
      const makingAmount = (parseFloat(inputAmount) * 1e9).toFixed(0);
      
      // Calculate minimum output based on trigger price
      // For buy: outputAmount = inputAmount / triggerPrice
      // For sell: outputAmount = inputAmount * triggerPrice
      const minOutput = side === 'buy' 
        ? (parseFloat(inputAmount) / parseFloat(triggerPrice)) * 1e9
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

      // Sign the transaction with wallet
      const signedTx = await signTransaction(result.transaction);
      console.log('✅ Transaction signed');

      // Execute the order
      const executeResponse = await fetch(getFullApiUrl('/api/trigger/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTx
        })
      });

      const executeResult = await executeResponse.json();

      if (!executeResult.success) {
        throw new Error(executeResult.error || 'Failed to execute order');
      }

      console.log('✅ Order executed:', executeResult.orderId);

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
      <div className="trigger-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="trigger-modal-header">
          <h2>🎯 Limit Order</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="success-message">
            <div className="success-icon">✅</div>
            <h3>Order Created!</h3>
            <p>Your limit order has been created successfully</p>
          </div>
        ) : (
          <>
            {/* Coin Info */}
            <div className="coin-info-section">
              <img 
                src={coin?.image || '/default-coin.svg'} 
                alt={coin?.symbol}
                className="coin-image"
                onError={(e) => e.target.src = '/default-coin.svg'}
              />
              <div>
                <h3>{coin?.symbol}</h3>
                <p className="current-price">
                  Current: ${formatPrice(currentPrice)}
                </p>
              </div>
            </div>

            {/* Order Type Toggle */}
            <div className="order-type-section">
              <label>Order Type</label>
              <div className="toggle-group">
                <button 
                  className={`toggle-btn ${orderType === 'limit' ? 'active' : ''}`}
                  onClick={() => setOrderType('limit')}
                >
                  Limit
                </button>
                <button 
                  className={`toggle-btn ${orderType === 'stop' ? 'active' : ''}`}
                  onClick={() => setOrderType('stop')}
                >
                  Stop
                </button>
              </div>
              <p className="help-text">
                {orderType === 'limit' 
                  ? 'Execute when price reaches your target' 
                  : 'Execute when price drops to your stop level'}
              </p>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="side-section">
              <label>Action</label>
              <div className="toggle-group">
                <button 
                  className={`toggle-btn ${side === 'buy' ? 'active buy' : ''}`}
                  onClick={() => setSide('buy')}
                >
                  Buy
                </button>
                <button 
                  className={`toggle-btn ${side === 'sell' ? 'active sell' : ''}`}
                  onClick={() => setSide('sell')}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="input-section">
              <label>
                Amount ({side === 'buy' ? 'SOL' : coin?.symbol})
              </label>
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.0"
                step="0.01"
                min="0"
              />
            </div>

            {/* Trigger Price */}
            <div className="trigger-price-section">
              <label>Trigger Price</label>
              
              <div className="price-toggle">
                <button 
                  className={`price-toggle-btn ${priceType === 'price' ? 'active' : ''}`}
                  onClick={() => setPriceType('price')}
                >
                  Price
                </button>
                <button 
                  className={`price-toggle-btn ${priceType === 'percentage' ? 'active' : ''}`}
                  onClick={() => setPriceType('percentage')}
                >
                  %
                </button>
              </div>

              {priceType === 'price' ? (
                <input
                  type="number"
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  placeholder="0.0"
                  step="0.00000001"
                  min="0"
                />
              ) : (
                <input
                  type="number"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="0"
                  step="0.1"
                />
              )}

              {percentage && (
                <p className="price-preview">
                  {percentage > 0 ? '+' : ''}{percentage}% = ${formatPrice(triggerPrice)}
                </p>
              )}
            </div>

            {/* Quick Percentage Buttons */}
            <div className="quick-percentage-section">
              <label>Quick Select {side === 'buy' ? '(Buy at Lower/Higher Price)' : '(Sell at Lower/Higher Price)'}</label>
              <div className="quick-buttons">
                {[-50, -25, -10, 10, 25, 50, 100].map(pct => {
                  // For BUY: negative = buy dip, positive = buy pump
                  // For SELL: negative = sell dip, positive = sell pump
                  const isNegative = pct < 0;
                  const buttonLabel = isNegative 
                    ? `${pct}%` 
                    : `+${pct}%`;
                  
                  return (
                    <button
                      key={pct}
                      className={`quick-btn ${isNegative ? 'negative' : 'positive'}`}
                      onClick={() => {
                        if (currentPrice > 0) {
                          setPriceType('percentage');
                          setPercentage(pct.toString());
                          setError(null);
                          
                          // Calculate and show the target price
                          const targetPrice = currentPrice * (1 + pct / 100);
                          console.log(`🎯 Quick select ${buttonLabel}:`, {
                            currentPrice,
                            targetPrice,
                            side,
                            action: side === 'buy' 
                              ? (pct > 0 ? 'Buy when price pumps' : 'Buy the dip')
                              : (pct > 0 ? 'Sell the pump' : 'Sell before it dips more')
                          });
                        } else {
                          // No current price available
                          setError(`Current price unavailable. Please enter a manual price instead.`);
                          setPriceType('price');
                          console.warn('⚠️ Quick select failed: No current price for', coin?.symbol);
                        }
                      }}
                      title={`${side === 'buy' ? 'Buy' : 'Sell'} when price ${pct > 0 ? 'increases' : 'decreases'} by ${Math.abs(pct)}%`}
                    >
                      {buttonLabel}
                    </button>
                  );
                })}
              </div>
              {currentPrice <= 0 ? (
                <p className="help-text warning">
                  ⚠️ Current price unavailable. Please switch to "Price" mode and enter a manual price.
                </p>
              ) : (
                <p className="help-text">
                  💡 {side === 'buy' 
                    ? 'Negative % = buy dip, Positive % = buy pump' 
                    : 'Negative % = sell before dip, Positive % = sell pump'}
                </p>
              )}
            </div>

            {/* Expiry */}
            <div className="expiry-section">
              <label>Expires In</label>
              <div className="expiry-options">
                {['1h', '24h', '7d', '30d'].map(exp => (
                  <button
                    key={exp}
                    className={`expiry-btn ${expiry === exp ? 'active' : ''}`}
                    onClick={() => setExpiry(exp)}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            {inputAmount && triggerPrice && (
              <div className="order-summary">
                <h4>Order Summary</h4>
                <div className="summary-row">
                  <span>You {side}</span>
                  <span>{inputAmount} {side === 'buy' ? 'SOL' : coin?.symbol}</span>
                </div>
                <div className="summary-row">
                  <span>When price {orderType === 'limit' ? 'reaches' : 'drops to'}</span>
                  <span>${formatPrice(triggerPrice)}</span>
                </div>
                <div className="summary-row">
                  <span>Estimated {side === 'buy' ? 'receive' : 'get'}</span>
                  <span>
                    {side === 'buy' 
                      ? (parseFloat(inputAmount) / parseFloat(triggerPrice)).toFixed(4)
                      : (parseFloat(inputAmount) * parseFloat(triggerPrice)).toFixed(4)
                    } {side === 'buy' ? coin?.symbol : 'SOL'}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            {/* Warning about wallet */}
            {!walletAddress && (
              <div className="warning-message">
                ⚠️ Please connect your Solana wallet to create limit orders
              </div>
            )}

            {/* Create Order Button */}
            <button
              className="create-order-btn"
              onClick={handleCreateOrder}
              disabled={loading || !walletAddress || !inputAmount || !triggerPrice || parseFloat(triggerPrice) <= 0}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating Order...
                </>
              ) : (
                `Create ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order`
              )}
            </button>

            {/* Help Text */}
            <p className="help-note">
              💡 Your order will execute automatically when the price reaches your trigger level
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default TriggerOrderModal;
