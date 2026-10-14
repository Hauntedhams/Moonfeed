// Shown in place of a full-screen overlay (wallet profile, trade detail) when
// it crashes — so the user gets a way back instead of a blank screen.
import React from 'react';
import './OverlayCrashFallback.css';

export default function OverlayCrashFallback({ title = 'Something went wrong', error, onRetry, onClose }) {
  const message = String(error?.message || '').slice(0, 160);
  return (
    <div className="ocf-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ocf-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ocf-icon" aria-hidden="true">⚠️</div>
        <h3 className="ocf-title">{title}</h3>
        <p className="ocf-sub">We’ve logged the problem. You can try again or go back.</p>
        {message && <code className="ocf-detail">{message}</code>}
        <div className="ocf-actions">
          {onRetry && <button type="button" className="ocf-btn ocf-btn--ghost" onClick={onRetry}>Try again</button>}
          <button type="button" className="ocf-btn ocf-btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
