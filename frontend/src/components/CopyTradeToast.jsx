import React, { useEffect, useRef } from 'react';
import { useCopyTrade } from '../contexts/CopyTradeContext';
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
 * Displays the top notification from the copy-trade queue.
 * Auto-dismisses after 10 seconds with an animated progress bar.
 * "Copy Trade" opens Jupiter pre-filled with the same token.
 */
const CopyTradeToast = () => {
  const { queue, dismiss, copyTrade } = useCopyTrade();
  const progressRef = useRef(null);
  const timerRef = useRef(null);

  const top = queue[0];

  // Reset progress bar animation and auto-dismiss timer whenever a new notification arrives
  useEffect(() => {
    if (!top) return;

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

  return (
    <div className="ctt-wrap">
      <div className={`ctt-toast ${isBuy ? 'ctt-buy' : 'ctt-sell'}`}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className="ctt-header">
          <span className="ctt-dot" />
          <span className="ctt-wallet-label">{top.walletLabel}</span>
          <span className="ctt-badge">{isBuy ? 'BUY' : 'SELL'}</span>
          <button
            className="ctt-close"
            onClick={() => dismiss(top.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────── */}
        <div className="ctt-body">
          <span className="ctt-verb">{isBuy ? 'Bought' : 'Sold'}</span>
          <span className="ctt-token">{top.tokenSymbol}</span>
          {solStr && (
            <span className="ctt-sol">
              {isBuy ? 'for' : '→'} {solStr}
            </span>
          )}
        </div>

        {/* ── Actions ────────────────────────────────────── */}
        <div className="ctt-actions">
          <button className="ctt-copy-btn" onClick={() => copyTrade(top)}>
            ⚡ Copy Trade
          </button>
          {queue.length > 1 && (
            <span className="ctt-more">+{queue.length - 1} more</span>
          )}
        </div>

        {/* ── Progress bar ───────────────────────────────── */}
        <div className="ctt-progress-track">
          <div className="ctt-progress-bar" ref={progressRef} />
        </div>

      </div>
    </div>
  );
};

export default CopyTradeToast;
