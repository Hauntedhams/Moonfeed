import { useRef } from 'react';
import '../styles/swipeBack.css';

// Reusable iOS-style "swipe from the left edge to go back" gesture.
// The page follows the finger 1:1, then either slides out (committing the back
// navigation) or springs back into place. Any full-page view can opt in:
//
//   const swipeBack = useSwipeBack({ onBack });
//   <div {...swipeBack.bind}>…</div>
//
// `bind` carries the ref + touch handlers + the base class name.

const DEFAULTS = {
  edgeWidth: 44,        // px from the left edge where the gesture may start (0 = anywhere)
  commitRatio: 0.3,     // fraction of the page width that commits the back nav
  commitMaxPx: 110,     // …capped so wide screens don't require a huge drag
  flickVelocity: 0.5,   // px/ms rightward flick that commits early
  flickMinPx: 40,
  closeMs: 220,
  settleMs: 240,
  axisLockPx: 12,
  ignoreSelector: null, // e.g. '.native-chart' — elements that own horizontal drags
  classPrefix: 'swipe-back',
};

export default function useSwipeBack({ onBack, enabled = true, onProgress, ...options } = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const closingRef = useRef(false);
  const timersRef = useRef([]);

  const dragClass = `${cfg.classPrefix}-dragging`;
  const settleClass = `${cfg.classPrefix}-settling`;
  const closeClass = `${cfg.classPrefix}-closing`;

  const pushTimer = (fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  };

  const report = (progress) => {
    if (onProgress) onProgress(progress);
  };

  const closeWithSlide = () => {
    const el = rootRef.current;
    if (closingRef.current) return;
    if (!el) { onBack?.(); return; }
    closingRef.current = true;
    el.classList.remove(dragClass, settleClass);
    el.classList.add(closeClass);
    el.style.transform = 'translateX(100%)';
    report(1);
    pushTimer(() => {
      onBack?.();
      // Views that stay mounted must not keep a stale transform — it would
      // become the containing block for their fixed-position children.
      requestAnimationFrame(() => {
        closingRef.current = false;
        if (!rootRef.current) return;
        rootRef.current.classList.remove(closeClass);
        rootRef.current.style.transform = '';
        report(0);
      });
    }, cfg.closeMs);
  };

  const handleTouchStart = (e) => {
    dragRef.current = null;
    if (!enabled || closingRef.current) return;
    if (e.touches.length > 1) return;
    const t = e.touches[0];
    if (cfg.edgeWidth > 0 && t.clientX > cfg.edgeWidth) return;
    if (cfg.ignoreSelector && e.target?.closest?.(cfg.ignoreSelector)) return;
    dragRef.current = { x: t.clientX, y: t.clientY, dragging: false, lastX: t.clientX, lastT: e.timeStamp, vx: 0 };
  };

  const handleTouchMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.dragging) {
      if (Math.abs(dy) > cfg.axisLockPx && Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; return; }
      if (dx > cfg.axisLockPx && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.dragging = true;
        rootRef.current?.classList.add(dragClass);
      } else {
        return;
      }
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.vx = (t.clientX - d.lastX) / dt;
    d.lastX = t.clientX;
    d.lastT = e.timeStamp;
    const el = rootRef.current;
    if (!el) return;
    const offset = Math.max(0, dx);
    el.style.transform = `translateX(${offset}px)`;
    report(Math.min(1, offset / (el.clientWidth || window.innerWidth || 1)));
  };

  const handleTouchEnd = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.dragging) return;
    const el = rootRef.current;
    if (!el) return;
    const t = e.changedTouches[0];
    const dx = Math.max(0, t.clientX - d.x);
    const width = el.clientWidth || window.innerWidth;
    const flick = d.vx > cfg.flickVelocity && dx > cfg.flickMinPx;
    el.classList.remove(dragClass);
    if (dx > Math.min(cfg.commitMaxPx, width * cfg.commitRatio) || flick) {
      closeWithSlide();
      return;
    }
    el.classList.add(settleClass);
    el.style.transform = 'translateX(0px)';
    report(0);
    pushTimer(() => {
      const node = rootRef.current;
      if (!node) return;
      node.classList.remove(settleClass);
      node.style.transform = '';
    }, cfg.settleMs);
  };

  return {
    ref: rootRef,
    closeWithSlide,
    bind: {
      ref: rootRef,
      className: `${cfg.classPrefix}-page`,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  };
}
