import React, { useCallback, useEffect, useRef, useState } from 'react';
import './FeedSwipeContainer.css';

const AXIS_LOCK_PX = 12;
const HORIZONTAL_DOMINANCE = 1.2;
const OUT_MS = 200;
const IN_MS = 240;
const FLICK_VX = 0.5; // px/ms
const EASE_OUT = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

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
  const widthRef = useRef(window.innerWidth || 1);
  const settleRef = useRef({ dur: IN_MS, ease: EASE_OUT });

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
    widthRef.current = window.innerWidth || 1;
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: false,
      abort: false,
      width: widthRef.current,
      lastX: touch.clientX,
      lastT: performance.now(),
      vx: 0,
    };
  }, [canSwipe]);

  const handleTouchMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || drag.abort || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - drag.startX;
    const deltaY = touch.clientY - drag.startY;

    const now = performance.now();
    const dt = now - drag.lastT;
    if (dt >= 4) {
      // Clamp: back-to-back events with tiny dt produce bogus velocity spikes.
      const inst = Math.max(-4, Math.min(4, (touch.clientX - drag.lastX) / dt));
      drag.vx = drag.vx * 0.7 + inst * 0.3;
      drag.lastX = touch.clientX;
      drag.lastT = now;
    }

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

  const finishDrag = useCallback((deltaX, vx = 0) => {
    const drag = dragRef.current;
    const width = drag?.width || window.innerWidth || 1;
    dragRef.current = null;

    const threshold = Math.min(90, width * 0.22);
    const flick = Math.abs(vx) >= FLICK_VX && Math.abs(deltaX) > 30 && Math.sign(vx) === Math.sign(deltaX);
    if (Math.abs(deltaX) < threshold && !flick) {
      // Spring back — duration proportional to how far it was dragged.
      const dur = Math.max(120, Math.min(240, Math.abs(deltaX) * 1.4));
      settleRef.current = { dur, ease: EASE_OUT };
      setPhase('settle');
      setDx(0);
      timersRef.current.push(setTimeout(() => setPhase('idle'), dur));
      return;
    }

    const sign = deltaX > 0 ? 1 : -1;
    // Swipe right = move up the feed list.
    const direction = -sign;

    // Exit at (roughly) the finger's release speed so a flick doesn't crawl.
    const remaining = Math.max(0, width - Math.abs(deltaX));
    const speed = Math.max(Math.abs(vx), 0.75); // px/ms floor for slow releases
    const outMs = Math.max(80, Math.min(OUT_MS, Math.round(remaining / speed)));
    settleRef.current = { dur: outMs, ease: EASE_IN };
    setPhase('settle');
    setDx(sign * width);

    timersRef.current.push(setTimeout(() => {
      onSwitch?.(direction);
      setPhase('jump');
      setDx(-sign * width);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        settleRef.current = { dur: IN_MS, ease: EASE_OUT };
        setPhase('settle');
        setDx(0);
        timersRef.current.push(setTimeout(() => setPhase('idle'), IN_MS));
      }));
    }, outMs));
  }, [onSwitch]);

  const handleTouchEnd = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.locked || drag.abort) {
      dragRef.current = null;
      return;
    }
    const touch = e.changedTouches?.[0];
    // A finger that paused before lifting is not a flick.
    const vx = performance.now() - drag.lastT > 100 ? 0 : drag.vx;
    finishDrag(touch ? touch.clientX - drag.startX : 0, vx);
  }, [finishDrag]);

  const handleTouchCancel = useCallback(() => {
    if (!dragRef.current) return;
    const locked = dragRef.current.locked;
    dragRef.current = null;
    if (locked) finishDrag(0);
  }, [finishDrag]);

  let style;
  if (phase !== 'idle') {
    const width = widthRef.current || 1;
    const progress = Math.min(Math.abs(dx) / width, 1);
    style = {
      transform: `translate3d(${dx}px, 0, 0) scale(${1 - progress * 0.04})`,
      opacity: 1 - progress * 0.45,
    };
    if (phase === 'settle') {
      const { dur, ease } = settleRef.current;
      style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
    }
  }

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
