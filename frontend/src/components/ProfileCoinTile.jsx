// Shared coin tile for the profile grids (own history + other-wallet feed).
// Instagram-style square: sharp cover image, symbol bottom-left, PnL pill
// bottom-right. `holding` marks a still-open position whose PnL is
// theoretical (unrealized at the current price) — shown as an outlined pill
// with an OPEN tag instead of the filled realized pill.
import React from 'react';
import { formatUsdPnl } from '../utils/walletPositions';
import './ProfileCoinTile.css';


const gradientFor = (seed = '') => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  return `linear-gradient(145deg, hsl(${h1}, 45%, 28%) 0%, hsl(${(h1 + 50) % 360}, 45%, 16%) 100%)`;
};

export function ProfileCoinTileSkeleton() {
  return <div className="pct-tile pct-tile--skeleton" aria-hidden="true" />;
}

export default function ProfileCoinTile({
  image,
  symbol,
  mint,
  pnlUsd = null,       // number | null — null hides the pill (still loading / no data)
  pnlLoading = false,  // show a tiny shimmer pill while PnL resolves
  holding = false,     // open position → theoretical PnL styling
  badge = null,        // 'buy' | 'sell' | null
  sub = null,          // small line under the symbol (e.g. "−0.012 SOL")
  meta = null,         // top-left chip when not holding (e.g. "5m" time-ago)
  onClick,
}) {
  const hasPnl = Number.isFinite(pnlUsd);
  const dir = hasPnl ? (pnlUsd > 0 ? 'up' : pnlUsd < 0 ? 'down' : 'flat') : null;
  return (
    <div
      className={`pct-tile${dir ? ` pct-tile--${dir}` : ''}${holding ? ' pct-tile--open' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(e); }}
    >
      {image ? (
        <img src={image} alt="" className="pct-img" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      ) : null}
      <div className="pct-ph" style={{ background: gradientFor(mint || symbol || '') }}>
        <span>{(symbol || '?').slice(0, 3)}</span>
      </div>
      <div className="pct-fade" />

      {badge && <span className={`pct-badge pct-badge--${badge}`}>{badge === 'sell' ? 'Sell' : 'Buy'}</span>}
      {holding ? <span className="pct-open"><i />Open</span> : meta ? <span className="pct-meta">{meta}</span> : null}

      <div className="pct-bottom">
        <span className="pct-symbol">{symbol || 'Unknown'}</span>
        <div className="pct-row">
          {sub ? <span className="pct-sub">{sub}</span> : <span />}
          {hasPnl ? (
            <span className={`pct-pnl pct-pnl--${dir}${holding ? ' pct-pnl--theoretical' : ''}`}>{formatUsdPnl(pnlUsd)}</span>
          ) : pnlLoading ? (
            <span className="pct-pnl pct-pnl--loading" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
