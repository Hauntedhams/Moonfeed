import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './FeedFilterStrip.css';

const SLOT_W = 92;
const AXIS_LOCK_PX = 8;
const FLICK_VX = 0.35; // px/ms
const CONFIRM_PULL_PX = 44;
const MAX_PULL_PX = 72;
const SNAP_MS = 240;
const OUT_MS = 180;
const IN_MS = 260;
const REVERT_MS = 4500;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Top-center feed picker for the home screen. Swipe left/right on it to browse
 * feeds; slide it down to confirm and switch to the browsed feed.
 */
function FeedFilterStrip({ feeds, activeFeed, onConfirm }) {
  const activeIndex = Math.max(0, feeds.findIndex((f) => f.id === activeFeed));
  const maxIndex = feeds.length - 1;

  const [browseIndex, setBrowseIndex] = useState(activeIndex);
  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | drag | settle | confirm | jump
  const [windowW, setWindowW] = useState(220);

  const windowRef = useRef(null);
  const dragRef = useRef(null);
  const timersRef = useRef([]);
  const revertTimerRef = useRef(null);
  const browseRef = useRef(browseIndex);
  browseRef.current = browseIndex;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => () => {
    clearTimers();
    clearTimeout(revertTimerRef.current);
  }, [clearTimers]);

  useLayoutEffect(() => {
    const measure = () => {
      if (windowRef.current) setWindowW(windowRef.current.offsetWidth || 220);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Follow feed changes made elsewhere (FeedSelector, coin-info picker, auto-scroll).
  useEffect(() => {
    if (dragRef.current) return;
    setBrowseIndex(activeIndex);
  }, [activeIndex]);

  const snapTo = useCallback((index) => {
    clearTimers();
    setPhase('settle');
    setBrowseIndex(index);
    setPullY(0);
    timersRef.current.push(setTimeout(() => setPhase('idle'), SNAP_MS));
  }, [clearTimers]);

  // Browsing without confirming drifts back to the live feed after a while.
  const armRevert = useCallback(() => {
    clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      if (!dragRef.current && Math.round(browseRef.current) !== activeIndex) snapTo(activeIndex);
    }, REVERT_MS);
  }, [activeIndex, snapTo]);

  const confirm = useCallback((index) => {
    const feed = feeds[index];
    if (!feed) return;
    clearTimers();
    clearTimeout(revertTimerRef.current);
    setPhase('confirm');
    setPullY(MAX_PULL_PX * 0.8);
    onConfirm?.(feed.id);
    timersRef.current.push(setTimeout(() => {
      setPhase('jump');
      setPullY(-18);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setPhase('settle-in');
        setPullY(0);
        timersRef.current.push(setTimeout(() => setPhase('idle'), IN_MS));
      }));
    }, OUT_MS));
  }, [clearTimers, feeds, onConfirm]);

  const handlePointerDown = useCallback((e) => {
    if (phase === 'confirm' || phase === 'jump' || phase === 'settle-in') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearTimers();
    clearTimeout(revertTimerRef.current);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startIndex: browseRef.current,
      axis: null,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      vx: 0,
      vy: 0,
    };
  }, [clearTimers, phase]);

  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    const now = performance.now();
    const dt = now - d.lastT;
    if (dt >= 4) {
      d.vx = d.vx * 0.7 + clamp((e.clientX - d.lastX) / dt, -4, 4) * 0.3;
      d.vy = d.vy * 0.7 + clamp((e.clientY - d.lastY) / dt, -4, 4) * 0.3;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastT = now;
    }

    if (!d.axis) {
      if (Math.abs(dx) > AXIS_LOCK_PX && Math.abs(dx) > Math.abs(dy)) d.axis = 'x';
      else if (dy > AXIS_LOCK_PX && dy > Math.abs(dx)) d.axis = 'y';
      else if (dy < -AXIS_LOCK_PX) d.axis = 'none';
      else return;
      setPhase('drag');
    }

    if (d.axis === 'x') {
      let raw = d.startIndex - dx / SLOT_W;
      if (raw < 0) raw *= 0.3;
      else if (raw > maxIndex) raw = maxIndex + (raw - maxIndex) * 0.3;
      setBrowseIndex(raw);
    } else if (d.axis === 'y') {
      const canConfirm = Math.round(browseRef.current) !== activeIndex;
      const limit = canConfirm ? MAX_PULL_PX : 20;
      const pull = Math.max(0, dy);
      setPullY(limit * (1 - Math.exp(-pull / limit)));
    }
  }, [activeIndex, maxIndex]);

  const handlePointerUp = useCallback((e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const paused = performance.now() - d.lastT > 100;

    if (d.axis === 'x') {
      let target = browseRef.current;
      const vx = paused ? 0 : d.vx;
      if (Math.abs(vx) > FLICK_VX) target -= Math.sign(vx) * 0.5;
      target = clamp(Math.round(target), 0, maxIndex);
      snapTo(target);
      if (target !== activeIndex) armRevert();
      return;
    }

    if (d.axis === 'y') {
      const index = Math.round(browseRef.current);
      const dy = e.clientY - d.startY;
      const vy = paused ? 0 : d.vy;
      if (index !== activeIndex && (dy > CONFIRM_PULL_PX || (vy > 0.5 && dy > 20))) {
        confirm(index);
      } else {
        snapTo(index);
        if (index !== activeIndex) armRevert();
      }
      return;
    }

    // Tap on a neighbouring label browses to it.
    const slot = e.target?.closest?.('[data-feed-index]');
    const tapped = slot ? Number(slot.dataset.feedIndex) : NaN;
    if (d.axis === null && Number.isFinite(tapped) && tapped !== Math.round(browseRef.current)) {
      snapTo(tapped);
      if (tapped !== activeIndex) armRevert();
    } else {
      setPhase('idle');
      if (Math.round(browseRef.current) !== activeIndex) armRevert();
    }
  }, [activeIndex, armRevert, confirm, maxIndex, snapTo]);

  const handlePointerCancel = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    snapTo(clamp(Math.round(browseRef.current), 0, maxIndex));
  }, [maxIndex, snapTo]);

  const roundedIndex = clamp(Math.round(browseIndex), 0, maxIndex);
  const pendingFeed = roundedIndex !== activeIndex ? feeds[roundedIndex] : null;
  const showHint = !!pendingFeed && phase !== 'confirm' && phase !== 'jump' && phase !== 'settle-in';
  const pullProgress = clamp(pullY / CONFIRM_PULL_PX, 0, 1);

  const trackX = windowW / 2 - SLOT_W / 2 - browseIndex * SLOT_W;
  const stripStyle = {
    transform: `translate3d(0, ${pullY}px, 0)`,
    opacity: phase === 'confirm' || phase === 'jump' ? 0 : 1,
  };
  if (phase === 'confirm') stripStyle.transition = `transform ${OUT_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${OUT_MS}ms ease-in`;
  else if (phase === 'settle-in') stripStyle.transition = `transform ${IN_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${IN_MS}ms ease-out`;
  else if (phase === 'settle') stripStyle.transition = `transform ${SNAP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;

  return (
    <div className="feed-filter-anchor">
      <div
        className={`feed-filter-strip${pendingFeed ? ' pending' : ''}${pullProgress >= 1 && pendingFeed ? ' armed' : ''}`}
        style={stripStyle}
        role="tablist"
        aria-label="Feeds — swipe to browse, slide down to switch"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="feed-filter-window" ref={windowRef}>
          <div
            className="feed-filter-track"
            style={{
              transform: `translate3d(${trackX}px, 0, 0)`,
              transition: phase === 'settle' ? `transform ${SNAP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none',
            }}
          >
            {feeds.map((feed, i) => {
              const dist = Math.min(1, Math.abs(i - browseIndex));
              return (
                <span
                  key={feed.id}
                  data-feed-index={i}
                  role="tab"
                  aria-selected={i === activeIndex}
                  className={`feed-filter-item${i === roundedIndex ? ' centered' : ''}${i === activeIndex ? ' live' : ''}`}
                  style={{ width: SLOT_W, opacity: 1 - dist * 0.6 }}
                >
                  {feed.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className={`feed-filter-hint${showHint ? ' visible' : ''}`}
        style={{ opacity: showHint ? 0.6 + pullProgress * 0.4 : 0 }}
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span>{pullProgress >= 1 ? 'Release to switch' : 'Slide down to switch'}</span>
      </div>
    </div>
  );
}

export default FeedFilterStrip;
