import { useRef, useState, useEffect, useCallback } from 'react';

// Pull-to-refresh for any scrollable container. Attach `containerRef` to the
// scrolling element (native listeners, so it composes with other gesture
// hooks bound to the same node via JSX props, e.g. useSwipeBack).
//
//   const { containerRef, pullY, refreshing } = usePullToRefresh({ onRefresh });
//   <div ref={containerRef}>
//     <PullIndicator height={refreshing ? 48 : pullY} spinning={refreshing} />
//     …content…
//   </div>

const PULL_THRESHOLD = 70; // raw px dragged before release triggers a refresh
const MAX_VISUAL_PULL = 80; // cap on the indicator's travel
const RESISTANCE = 0.5;

export default function usePullToRefresh({ onRefresh, disabled = false } = {}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await onRefresh?.(); } finally {
      setRefreshing(false);
      setPullY(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return undefined;

    const onTouchStart = (e) => {
      if (refreshing || e.touches.length > 1 || el.scrollTop > 0) { dragRef.current = null; return; }
      dragRef.current = { startY: e.touches[0].clientY, dy: 0, dragging: false };
    };

    const onTouchMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const dy = e.touches[0].clientY - d.startY;
      if (dy <= 0 || el.scrollTop > 0) { dragRef.current = null; setPullY(0); return; }
      d.dragging = true;
      d.dy = dy;
      if (e.cancelable) e.preventDefault(); // own the gesture once pulling down from the top
      setPullY(Math.min(MAX_VISUAL_PULL, dy * RESISTANCE));
    };

    const onTouchEnd = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d?.dragging) { setPullY(0); return; }
      if (d.dy >= PULL_THRESHOLD) runRefresh();
      else setPullY(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, refreshing, runRefresh]);

  return { containerRef, pullY, refreshing };
}
