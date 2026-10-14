// Universal trade PnL bar — shown on every holding and history card.
// Entry sits at the centre. Gains fill right (green), losses fill left (red).
// The right edge is +100% unless a take-profit target is higher; the left
// edge is −100% unless a stop is set (then it's the stop). A gain beyond the
// right edge "maxes out": the bar fills completely and the label flips to
// the full percentage with a rocket, so a +559% exit reads as a big win at a
// glance. Optional stop / take-profit markers keep the sell-order context.
import React from 'react';
import './TradePnlBar.css';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const formatPct = (pct) => {
  if (!Number.isFinite(pct)) return '—';
  const abs = Math.abs(pct);
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  if (abs >= 1000) return `${sign}${Math.round(abs).toLocaleString()}%`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}%`;
  return `${sign}${abs.toFixed(1)}%`;
};

export default function TradePnlBar({
  pnlPct,                 // number | null — null renders a neutral "pending" bar
  stopPct = null,         // negative number (e.g. -25) when a stop-loss is set
  takeProfitPct = null,   // positive number (e.g. +50) when a take-profit is set
  status = 'open',        // 'open' | 'closed' — closed = realized (history)
  size = 'md',            // 'md' | 'sm'
  showLabels = true,
}) {
  const has = Number.isFinite(pnlPct);
  const rightEdge = Math.max(100, Number(takeProfitPct) || 0);
  const leftEdge = Number(stopPct) < 0 ? Math.max(-100, Number(stopPct)) : -100;
  const maxed = has && pnlPct >= rightEdge;
  const floored = has && pnlPct <= leftEdge;

  // Fill width as a share of the half it occupies
  let fill = 0; // 0..50 (% of track)
  if (has) {
    fill = pnlPct >= 0
      ? 50 * clamp(pnlPct / rightEdge, 0, 1)
      : 50 * clamp(pnlPct / leftEdge, 0, 1);
  }
  const dir = !has ? 'flat' : pnlPct > 0 ? 'up' : pnlPct < 0 ? 'down' : 'flat';
  const markerLeft = has ? (pnlPct >= 0 ? 50 + fill : 50 - fill) : 50;
  const stopLeft = Number(stopPct) < 0 ? 50 - 50 * clamp(stopPct / leftEdge, 0, 1) : null;
  const tpLeft = Number(takeProfitPct) > 0 ? 50 + 50 * clamp(takeProfitPct / rightEdge, 0, 1) : null;

  return (
    <div className={`tpb tpb--${dir} tpb--${size}${maxed ? ' tpb--maxed' : ''}${floored ? ' tpb--floored' : ''}${status === 'closed' ? ' tpb--closed' : ''}`} aria-label={has ? `${formatPct(pnlPct)} ${status === 'closed' ? 'realized' : 'unrealized'}` : 'PnL pending'}>
      {showLabels && (
        <div className="tpb-labels">
          <span className="tpb-edge tpb-edge--left">{Number(stopPct) < 0 ? `Stop ${formatPct(stopPct)}` : '−100%'}</span>
          <span className="tpb-center">{status === 'closed' ? 'ENTRY → EXIT' : 'ENTRY'}</span>
          <span className="tpb-edge tpb-edge--right">{Number(takeProfitPct) > 0 ? `Target ${formatPct(takeProfitPct)}` : `+${rightEdge}%`}</span>
        </div>
      )}
      <div className="tpb-track">
        <span className="tpb-mid" />
        {has && pnlPct !== 0 && (
          <span
            className="tpb-fill"
            style={pnlPct > 0 ? { left: '50%', width: `${fill}%` } : { right: '50%', width: `${fill}%` }}
          />
        )}
        {stopLeft !== null && <span className="tpb-tick tpb-tick--stop" style={{ left: `${stopLeft}%` }} title={`Stop ${formatPct(stopPct)}`} />}
        {tpLeft !== null && <span className="tpb-tick tpb-tick--tp" style={{ left: `${tpLeft}%` }} title={`Target ${formatPct(takeProfitPct)}`} />}
        <span className="tpb-marker" style={{ left: `${clamp(markerLeft, 1.5, 98.5)}%` }} />
      </div>
    </div>
  );
}
