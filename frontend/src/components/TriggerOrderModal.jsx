import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getFullApiUrl } from '../config/api';
import { useWallet } from '../contexts/WalletContext';
import { useWalletConnectOnboarding } from './WalletConnectOnboarding';
import { getSolUsdPrice } from '../utils/orderFillTracking';
import { createSoftOrder } from '../utils/softOrders';
import NotificationPromptBanner from './NotificationPromptBanner';
import './TriggerOrderModal.css';

const TriggerOrderModal = ({ 
  isOpen, 
  onClose, 
  coin,
  onOrderCreated,
  initialInputAmount,
  initialPercentage,
  initialSide,
  initialTriggerPrice,
  embedded = false, // When true, render inline (no overlay) as a swipeable page
}) => {
  const { walletAddress, connected, signTransaction, signMessage, recheckConnection } = useWallet();
  const { openWalletConnect } = useWalletConnectOnboarding();
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

  // Live price fetched on-demand when the coin arrives without price data
  // (e.g. opened from a price alert, which only carries basic coin info).
  const [fetchedPrice, setFetchedPrice] = useState(0);

  // SOL/USD rate for the USD-first order summary line.
  const [solUsd, setSolUsd] = useState(0);
  useEffect(() => {
    if (isOpen) getSolUsdPrice().then(setSolUsd).catch(() => {});
  }, [isOpen]);

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
      // Pre-fill side + target percentage if provided (e.g. from an alert "Set up order")
      if (initialSide) {
        setSide(initialSide);
      }
      if (initialPercentage !== undefined && initialPercentage !== null) {
        setPriceType('percentage');
        setPercentage(String(initialPercentage));
      }
      if (initialTriggerPrice !== undefined && initialTriggerPrice !== null) {
        const targetPrice = Number(initialTriggerPrice);
        if (Number.isFinite(targetPrice) && targetPrice > 0) {
          setPriceType('price');
          setTriggerPrice(targetPrice.toFixed(8));
          setSliderValue(targetPrice);
        }
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to a side prefill arriving while already mounted (e.g. "Setup limit
  // order?" after a swap switches the pager to this page in sell mode).
  useEffect(() => {
    if (isOpen && initialSide) setSide(initialSide);
  }, [initialSide]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current price from coin data - check multiple possible field names
  const currentPrice = coin?.priceUsd || coin?.price_usd || coin?.price || coin?.priceNative || fetchedPrice || 0;

  // Fetch a live USD price when the coin has none (e.g. opened from an alert)
  useEffect(() => {
    if (!isOpen) return;
    const hasPrice = coin?.priceUsd || coin?.price_usd || coin?.price || coin?.priceNative;
    const mint = coin?.mintAddress || coin?.address;
    if (hasPrice || !mint) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        if (!res.ok) return;
        const data = await res.json();
        const price = Number(data?.pairs?.[0]?.priceUsd);
        if (!cancelled && price > 0) {
          setFetchedPrice(price);
          setError(null);
        }
      } catch (_) { /* silent — user can still enter a manual price */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, coin?.mintAddress, coin?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset any previously fetched price when switching coins
  useEffect(() => {
    setFetchedPrice(0);
  }, [coin?.mintAddress, coin?.address]);

  // Buy and Sell remember their own last-picked target % independently, so
  // switching tabs doesn't leave a percentage that only made sense for the
  // other side (e.g. a Sell take-profit target showing up under Buy).
  // Defaults: Buy -> "buy the dip" (-10%), Sell -> take-profit (+25%).
  const buyPctRef = useRef(-10);
  const sellPctRef = useRef(25);
  const prevSideRef = useRef(side);

  const applyTargetPercent = useCallback((pct) => {
    if (currentPrice <= 0) return;
    const price = currentPrice * (1 + pct / 100);
    setPercentage(pct.toString());
    setTriggerPrice(price.toFixed(8));
    setSliderValue(price);
  }, [currentPrice]);

  // Snap to the other side's remembered (or default) target whenever the
  // Buy/Sell tab changes — skipped on the very first render.
  useEffect(() => {
    if (prevSideRef.current === side) return;
    prevSideRef.current = side;
    applyTargetPercent(side === 'buy' ? buyPctRef.current : sellPctRef.current);
  }, [side, applyTargetPercent]);

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
      applyTargetPercent(side === 'buy' ? buyPctRef.current : sellPctRef.current);
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
      if (side === 'buy') buyPctRef.current = pct; else sellPctRef.current = pct;
    }
  }, [currentPrice, side]);

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

  // The Stop Loss section only applies alongside an upside target — if the main
  // target drops to a downside exit, turn off any pending stop-loss so it doesn't
  // silently place a hidden second order the user can no longer see.
  useEffect(() => {
    if (stopLossEnabled && percentageFromCurrent <= 0) {
      setStopLossEnabled(false);
    }
  }, [percentageFromCurrent, stopLossEnabled]);

  const handleAmountPctClick = async (pct) => {
    if (!walletAddress) {
      openWalletConnect();
      return;
    }
    try {
      if (side === 'buy') {
        const res = await fetch(getFullApiUrl(`/api/wallet/${walletAddress}/balance`));
        const d = await res.json();
        if (!d.success) throw new Error(d.error || 'Failed to fetch balance');
        const reserve = pct === 100 ? 0.01 : 0;
        const calc = Math.max(0, (d.sol - reserve) * (pct / 100));
        setInputAmount(calc.toFixed(3));
        setError(null);
      } else {
        const mint = coin?.mintAddress || coin?.address;
        if (!mint) return;
        const res = await fetch(getFullApiUrl(`/api/wallet/${walletAddress}/balance?mint=${mint}`));
        const d = await res.json();
        if (!d.success) throw new Error(d.error || 'Failed to fetch balance');
        // Round DOWN — rounding up at 100% asks to sell more than the wallet holds
        // and the wallet rejects with "insufficient balance".
        const calc = d.amount * (pct / 100);
        const dp = calc < 1 ? 4 : 2;
        const floored = Math.floor(calc * 10 ** dp) / 10 ** dp;
        setInputAmount(floored.toFixed(dp));
        setError(d.amount === 0 ? `You don't hold any ${coin?.symbol || 'this token'} in this wallet yet` : null);
      }
    } catch (e) {
      console.warn('Could not calculate balance percentage:', e);
      setError('Could not read wallet balance — enter the amount manually');
    }
  };

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
      const expiredAt = getExpiryTimestamp();

      console.log('🎯 Creating soft order:', {
        side,
        inputAmount,
        triggerPrice,
        stopLoss: stopLossEnabled && side === 'sell' ? stopLossPrice : 'none',
        expiredAt: expiredAt ? new Date(expiredAt).toISOString() : 'none'
      });

      // Soft orders: server-monitored price alerts — no escrow, no wallet
      // signing, so every wallet works (V2 deposits get broken by Lighthouse).
      const orderMeta = {
        walletAddress,
        mint: coin.mintAddress,
        tokenSymbol: coin.symbol || null,
        tokenName: coin.name || null,
        tokenImage: coin.image || coin.profileImage || coin.logo || null,
        currentPriceUsd: currentPrice > 0 ? currentPrice : null,
        expiresAt: expiredAt,
      };
      const result = await createSoftOrder({
        ...orderMeta,
        side,
        triggerPriceUsd: parseFloat(triggerPrice),
        amountSol: side === 'buy' ? parseFloat(inputAmount) : null,
        amountTokens: side === 'sell' ? parseFloat(inputAmount) : null,
      });

      // Stop loss = a second downside sell alert (both are just notifications,
      // so no OCO pairing is needed).
      if (stopLossEnabled && side === 'sell' && parseFloat(stopLossPrice) > 0) {
        await createSoftOrder({
          ...orderMeta,
          side: 'sell',
          triggerPriceUsd: parseFloat(stopLossPrice),
          amountTokens: parseFloat(inputAmount),
        });
      }

      console.log('✅ Order created!', result.id);

      setSuccess(true);
      onOrderCreated?.({
        orderId: result.id
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

  if (!isOpen && !embedded) return null;

  const modalInner = (
      <div className={`trigger-modal-content compact-layout${embedded ? ' embedded' : ''}`} onClick={(e) => e.stopPropagation()}>
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
                  src={coin?.image || coin?.profileImage || coin?.logo || coin?.icon || '/default-coin.svg'} 
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

            <NotificationPromptBanner compact />

            {/* Quick Action Row: Buy/Sell */}
            <div className="action-row">
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
                      <span className="price-label">
                        {side === 'sell' ? 'Sell When Price Reaches' : 'Buy When Price Reaches'}
                      </span>
                      <span className="price-value">${formatPrice(triggerPrice || sliderValue)}</span>
                    </div>
                    <span className={`percentage-badge ${percentageFromCurrent >= 0 ? 'positive' : 'negative'}`}>
                      {percentageFromCurrent >= 0 ? '+' : ''}{percentageFromCurrent.toFixed(1)}%
                    </span>
                  </div>
                  <p className="hero-slider-hint">
                    {side === 'sell'
                      ? 'One order — works for either a take-profit above, or a downside exit below, the current price.'
                      : 'Order fills automatically once the price drops to (or rises to) this level.'}
                  </p>
                  
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
                          if (side === 'buy') buyPctRef.current = pct; else sellPctRef.current = pct;
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

            {/* Buy mode has no Stop Loss (it protects a SELL, not a purchase) —
                a short note here instead of just silently omitting the section,
                so it doesn't look like something went missing. */}
            {side === 'buy' && currentPrice > 0 && (
              <div className="buy-note-section">
                <span className="buy-note-icon">💡</span>
                <p className="buy-note-text">
                  No Stop Loss here — that protects a position you're <strong>selling</strong>. Switch to the Sell tab once this buy fills to set one up.
                </p>
              </div>
            )}

            {/* Stop Loss Section — only offered alongside an UPSIDE target (take-profit).
                If the main target is already a downside exit (negative %), it already does
                what Stop Loss would do, so showing both would just be confusing. */}
            {side === 'sell' && currentPrice > 0 && percentageFromCurrent > 0 && (
              <div className={`stop-loss-section${stopLossEnabled ? ' sl-active' : ''}`}>
                <div className="sl-header">
                  <div className="sl-title-group">
                    <span className="sl-shield">🛡️</span>
                    <div>
                      <span className="sl-title">Also Protect Against a Drop</span>
                      <span className="sl-subtitle">Optional second order — sells if price falls instead</span>
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
                <div className="amount-pct-chips">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className="amount-pct-chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAmountPctClick(pct);
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
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

            {/* Mini Order Summary — USD first, SOL second. triggerPrice is USD per token. */}
            {inputAmount && triggerPrice && parseFloat(triggerPrice) > 0 && (() => {
              const amt = parseFloat(inputAmount);
              const px = parseFloat(triggerPrice);
              if (side === 'buy') {
                const usdSpend = solUsd > 0 ? amt * solUsd : null;
                const tokens = usdSpend != null ? usdSpend / px : null;
                return (
                  <div className="mini-summary">
                    <span className="summary-text">
                      Buy {usdSpend != null ? `~$${usdSpend.toFixed(2)} (${amt} SOL)` : `${amt} SOL`}
                      {tokens != null ? ` → Get ~${tokens >= 100 ? tokens.toFixed(0) : tokens.toFixed(2)} ${coin?.symbol}` : ''}
                    </span>
                  </div>
                );
              }
              const usdValue = amt * px;
              const solValue = solUsd > 0 ? usdValue / solUsd : null;
              return (
                <div className="mini-summary">
                  <span className="summary-text">
                    Sell {amt} {coin?.symbol} → Get ~${usdValue.toFixed(2)}{solValue != null ? ` (${solValue.toFixed(4)} SOL)` : ''}
                  </span>
                </div>
              );
            })()}

            {/* Error/Warning Messages */}
            {error && <div className="inline-error">{error}</div>}
            {!walletAddress && (
              <div className="inline-warning">
                <button className="connect-wallet-link" onClick={openWalletConnect}>
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
              <p className="jup-powered-by">Powered by Jupiter</p>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) return modalInner;

  return (
    <div className="trigger-modal-overlay" onClick={onClose}>
      {modalInner}
    </div>
  );
};

export default TriggerOrderModal;
