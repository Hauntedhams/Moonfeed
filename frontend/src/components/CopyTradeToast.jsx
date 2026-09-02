import React, { useEffect, useRef, useState } from 'react';
import { useCopyTrade } from '../contexts/CopyTradeContext';
import { AnimalSilhouetteAvatar, gradientForWallet, shortWalletAddress } from '../utils/walletIdentity';
import './CopyTradeToast.css';

const AUTO_DISMISS_MS = 10000;

function formatSol(n) {
  if (!n || n <= 0) return null;
  if (n < 0.001) return '<0.001 SOL';
  return `${n.toFixed(3)} SOL`;
}

/**
 * CopyTradeToast
 *
 * TikTok-style floating speech bubble pop-up positioned directly over the Tracked tab button.
 * Clicking the bubble opens the transaction on an interactive candlestick chart with full trade info.
 */
const CopyTradeToast = ({ onShowTransaction }) => {
  const { queue, dismiss, copyTrade } = useCopyTrade();
  const [isExpanded, setIsExpanded] = useState(false);
  const progressRef = useRef(null);
  const timerRef = useRef(null);

  const top = queue[0];

  // Reset progress bar animation and auto-dismiss timer whenever a new notification arrives
  useEffect(() => {
    if (!top) return;
    setIsExpanded(false);

    // Restart the CSS animation by briefly resetting width
    if (progressRef.current) {
      progressRef.current.style.transition = 'none';
      progressRef.current.style.width = '100%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (progressRef.current) {
            progressRef.current.style.transition = `width ${AUTO_DISMISS_MS}ms linear`;
            progressRef.current.style.width = '0%';
          }
        });
      });
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => dismiss(top.id), AUTO_DISMISS_MS);

    return () => clearTimeout(timerRef.current);
  }, [top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!top) return null;

  const isBuy = top.type === 'buy';
  const solStr = formatSol(top.solAmount);

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowTransaction) {
      clearTimeout(timerRef.current);
      onShowTransaction(top);
      dismiss(top.id);
    } else {
      setIsExpanded(true);
    }
  };

  const walletDisplayName = top.walletLabel || (top.walletAddress ? shortWalletAddress(top.walletAddress) : 'Tracked Wallet');

  return (
    <div className="ctt-wrap">
      {/* ── Collapsed Icon-Only Trigger ── */}
      {!isExpanded ? (
        <button
          type="button"
          className={`ctt-bubble-icon-only ${isBuy ? 'buy' : 'sell'}`}
          onClick={handleTriggerClick}
          title="View this trade on the chart"
        >
          <svg className="ctt-money-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 7.5v9M14.5 9.5c-.45-.75-1.3-1.15-2.4-1.15-1.25 0-2.1.58-2.1 1.45 0 2.25 4.5.82 4.5 3.05 0 .93-.85 1.55-2.2 1.55-1.1 0-2.05-.42-2.55-1.2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
          </svg>
          {queue.length > 1 && (
            <span className="ctt-badge-count">{queue.length}</span>
          )}
        </button>
      ) : (
        /* ── Expanded Detail Card ── */
        <div className={`ctt-toast ${isBuy ? 'ctt-buy' : 'ctt-sell'}`}>
          <div className="ctt-header">
            <span
              className="ctt-avatar-mini"
              style={top.walletAddress ? { background: gradientForWallet(top.walletAddress) } : undefined}
            >
              {top.walletAddress ? (
                <AnimalSilhouetteAvatar address={top.walletAddress} className="ctt-animal-avatar-mini" />
              ) : (
                <span className="ctt-dot" />
              )}
            </span>
            <span className="ctt-wallet-label">{walletDisplayName}</span>
            <span className="ctt-badge">{isBuy ? 'BUY' : 'SELL'}</span>
            <button
              className="ctt-close"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="ctt-body" onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
            <span className="ctt-verb">{isBuy ? 'Bought' : 'Sold'}</span>
            <span className="ctt-token">{top.tokenSymbol}</span>
            {solStr && (
              <span className="ctt-sol">
                {isBuy ? 'for' : '→'} {solStr}
              </span>
            )}
          </div>

          <div className="ctt-actions">
            {onShowTransaction && (
              <button className="ctt-chart-btn" onClick={handleTriggerClick}>
                📊 View Chart
              </button>
            )}
            <button className="ctt-copy-btn" onClick={() => copyTrade(top)}>
              ⚡ Copy Trade
            </button>
            {queue.length > 1 && (
              <span className="ctt-more">+{queue.length - 1} more</span>
            )}
          </div>

          <div className="ctt-progress-track">
            <div className="ctt-progress-bar" ref={progressRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyTradeToast;
