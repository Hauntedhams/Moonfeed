import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CoinReelSheet.css';

const CLOSE_MS = 240;
const CLOSE_DRAG_PX = 110;

export const REEL_TABS = [
  {
    id: 'comments',
    label: 'Comments',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    id: 'transactions',
    label: 'Trades',
    icon: (
      <>
        <path d="M17 3l4 4-4 4" />
        <path d="M3 7h18" />
        <path d="M7 21l-4-4 4-4" />
        <path d="M21 17H3" />
      </>
    ),
  },
  {
    id: 'topTraders',
    label: 'Top Traders',
    icon: (
      <>
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M17 4h3a2 2 0 0 1-2 4h-1" />
        <path d="M7 4H4a2 2 0 0 0 2 4h1" />
      </>
    ),
  },
];

export const formatReelCount = (n) => {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return '0';
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}K`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(v));
};

/**
 * Instagram-Reels-style panel: the chart keeps running, shrunk to the top of the
 * screen, while comments / trades / top traders scroll in a sheet underneath.
 */
function CoinReelSheet({ panel, onPanelChange, onClose, counts = {}, header, chart, footer, children }) {
  const rootRef = useRef(null);
  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.4, 0, 1, 1)`;
      sheet.style.transform = 'translate3d(0, 100%, 0)';
    }
    rootRef.current?.classList.add('crs-closing');
    setTimeout(() => onCloseRef.current?.(), CLOSE_MS);
  }, []);

  useEffect(() => {
    document.body.classList.add('crs-open');
    return () => document.body.classList.remove('crs-open');
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [panel]);

  // Pull the sheet down to dismiss — from the handle/tabs, or from the list when it's scrolled to the top.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;
    let drag = null;

    const onStart = (e) => {
      if (closingRef.current || e.touches.length !== 1) return;
      if (e.target.closest('input, textarea, .crs-footer')) return;
      const inBody = bodyRef.current?.contains(e.target);
      if (inBody && bodyRef.current.scrollTop > 0) return;
      const t = e.touches[0];
      drag = { y: t.clientY, x: t.clientX, dy: 0, active: false, lastY: t.clientY, lastT: performance.now(), vy: 0 };
    };

    const onMove = (e) => {
      if (!drag) return;
      const t = e.touches[0];
      const dy = t.clientY - drag.y;
      const dx = t.clientX - drag.x;
      if (!drag.active) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
        drag.active = true;
        sheet.style.transition = 'none';
      }
      e.preventDefault();
      const now = performance.now();
      const dt = now - drag.lastT;
      if (dt >= 4) {
        drag.vy = drag.vy * 0.6 + ((t.clientY - drag.lastY) / dt) * 0.4;
        drag.lastY = t.clientY;
        drag.lastT = now;
      }
      drag.dy = Math.max(0, dy);
      sheet.style.transform = `translate3d(0, ${drag.dy}px, 0)`;
    };

    const onEnd = () => {
      const d = drag;
      drag = null;
      if (!d?.active) return;
      const paused = performance.now() - d.lastT > 100;
      if (d.dy > CLOSE_DRAG_PX || (!paused && d.vy > 0.5 && d.dy > 30)) {
        close();
        return;
      }
      sheet.style.transition = 'transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1)';
      sheet.style.transform = 'translate3d(0, 0, 0)';
      setTimeout(() => {
        if (closingRef.current) return;
        sheet.style.transition = '';
        sheet.style.transform = '';
      }, 260);
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [close]);

  return createPortal(
    <div className="crs-root" ref={rootRef}>
      <div className="crs-top">
        <div className="crs-top-header">
          <button className="crs-back" onClick={close} aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {header}
        </div>
        <div className="crs-chart">{chart}</div>
      </div>

      <div className="crs-sheet" ref={sheetRef} role="dialog" aria-label={REEL_TABS.find((t) => t.id === panel)?.label}>
        <div className="crs-handle" onClick={close}>
          <div className="crs-handle-bar" />
        </div>
        <div className="crs-tabs" role="tablist">
          {REEL_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={panel === tab.id}
              className={`crs-tab${panel === tab.id ? ' active' : ''}`}
              onClick={() => onPanelChange(tab.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tab.icon}
              </svg>
              <span>{tab.label}</span>
              {counts[tab.id] > 0 && <span className="crs-tab-count">{formatReelCount(counts[tab.id])}</span>}
            </button>
          ))}
        </div>
        <div className="crs-body" ref={bodyRef}>{children}</div>
        {footer && <div className="crs-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export default CoinReelSheet;
