import React from 'react';
import './CautionTapeBanner.css';

export default function CautionTapeBanner({ message = 'IN PROGRESS — LIMIT ORDERS UNDER MAINTENANCE', compact = false }) {
  return (
    <div className={`caution-tape-banner ${compact ? 'compact' : ''}`}>
      <div className="caution-tape-stripes" />
      <div className="caution-tape-content">
        <span className="caution-tape-icon" role="img" aria-label="caution">🚧</span>
        <span className="caution-tape-text">{message}</span>
        <span className="caution-tape-icon" role="img" aria-label="caution">🚧</span>
      </div>
    </div>
  );
}
