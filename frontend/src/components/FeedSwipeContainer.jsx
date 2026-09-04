import React, { useCallback, useEffect, useRef, useState } from 'react';
import './FeedSwipeContainer.css';

const AXIS_LOCK_PX = 12;
const HORIZONTAL_DOMINANCE = 1.2;
const OUT_MS = 200;
const IN_MS = 220;

// Anything that owns its own horizontal gesture must not trigger a feed switch.
const BAIL_SELECTOR = [
  '.native-chart',
  '.coin-info-popup',
  '.coin-info-popup-feed',
  '.coin-buy-drawer',
  '.coin-buy-swipe-hotzone',
  '.transactions-section',
  '.tx-filter-menu',
  '.feed-selector',
  '.traders-scroll-window',
  '.tw-sort-bar',
  'input',
  'textarea',
].join(',');

const OVERLAY_BODY_CLASSES = ['wpv-open', 'pdv-open', 'odv-open'];

/**
 * Wraps the home feed so a horizontal swipe drags the whole card sideways and
 * switches feeds on release. Swipe right moves UP the feed list, swipe left
 * moves down; both wrap around.
 */
function FeedSwipeContainer({ enabled = true, onSwitch, children }) {
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | drag | settle | jump
  const dragRef = useRef(null);
  const timersRef = useRef([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const canSwipe = useCallback(() => {
    if (!enabled || !onSwitch) return false;
    if (phase !== 'idle') return false;
    if (OVERLAY_BODY_CLASSES.some((cls) => document.body.classList.contains(cls))) return false;
    // Expanded cards use horizontal drags for the buy/limit-order drawer.
    if (document.querySelector('.coin-info-layer.expanded')) return false;
    return true;
  }, [enabled, onSwitch, phase]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1 || !canSwipe()) return;
    if (e.target?.closest?.(BAIL_SELECTOR)) return;
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: false,
      abort: false,
      width: window.innerWidth || 1,
    };
  }, [canSwipe]);

  const handleTouchMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || drag.abort || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - drag.startX;
    const deltaY = touch.clientY - drag.startY;

    if (!drag.locked) {
      if (Math.abs(deltaY) > AXIS_LOCK_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
        drag.abort = true; // vertical feed scroll wins
        return;
      }
      if (Math.abs(deltaX) < AXIS_LOCK_PX || Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_DOMINANCE) return;
      drag.locked = true;
      setPhase('drag');
    }

    setDx(deltaX);
  }, []);

  const finishDrag = useCallback((deltaX) => {
    const drag = dragRef.current;
    const width = drag?.width || window.innerWidth || 1;
    dragRef.current = null;

    const threshold = Math.min(90, width * 0.22);
    if (Math.abs(deltaX) < threshold) {
      setPhase('settle');
      setDx(0);
      timersRef.current.push(setTimeout(() => setPhase('idle'), IN_MS));
      return;
    }

    const sign = deltaX > 0 ? 1 : -1;
    // Swipe right = move up the feed list.
    const direction = -sign;

    setPhase('settle');
    setDx(sign * width);

    timersRef.current.push(setTimeout(() => {
      onSwitch?.(direction);
      setPhase('jump');
      setDx(-sign * width);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setPhase('settle');
        setDx(0);
        timersRef.current.push(setTimeout(() => setPhase('idle'), IN_MS));
      }));
    }, OUT_MS));
  }, [onSwitch]);

  const handleTouchEnd = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.locked || drag.abort) {
      dragRef.current = null;
      return;
    }
    const touch = e.changedTouches?.[0];
    finishDrag(touch ? touch.clientX - drag.startX : 0);
  }, [finishDrag]);

  const handleTouchCancel = useCallback(() => {
    if (!dragRef.current) return;
    const locked = dragRef.current.locked;
    dragRef.current = null;
    if (locked) finishDrag(0);
  }, [finishDrag]);

  const style = phase === 'idle' ? undefined : { transform: `translate3d(${dx}px, 0, 0)` };

  return (
    <div
      className={`feed-swipe-container${phase === 'idle' ? '' : ` feed-swipe-${phase}`}`}
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {children}
    </div>
  );
}

export default FeedSwipeContainer;
