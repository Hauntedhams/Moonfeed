// Default chart framing math — pure so it can be unit-tested.
//
// Shows the whole dataset (within lightweight-charts' bar-spacing limits) with
// the live candle a little right of centre instead of hugging the right edge.
// Computed from the data length + pane width, NOT from getVisibleLogicalRange():
// fitContent() is lazy (applied on the next frame), so reading the range right
// after it returns the PREVIOUS dataset's range — after a 1000-bar → 6-bar
// timeframe switch that produced a window entirely to the right of the data.

export const LIVE_CENTER_SHIFT = 0.42; // fraction of the visible span left empty right of the last bar
export const MIN_BAR_SPACING_PX = 0.5; // lightweight-charts' minBarSpacing default
export const MAX_BAR_SPACING_PX = 50;  // lightweight-charts' internal maximum
// Below this the chart hasn't really been laid out yet (createChart falls back
// to 1px when the container is still hidden/unmeasured).
export const MIN_FRAMEABLE_WIDTH_PX = 80;

/**
 * Logical range that places the last bar at (1 − LIVE_CENTER_SHIFT) of the
 * pane width. Bars are sized so the whole dataset fits in that left portion
 * when it can (clamped to the library's spacing limits), so a fresh coin with
 * six candles shows all six — not five and a half. Null when nothing to frame.
 */
export function defaultLogicalRange(dataLength, paneWidth) {
  if (!(dataLength > 0) || !(paneWidth > 0)) return null;
  const idealSpacing = (paneWidth * (1 - LIVE_CENTER_SHIFT)) / dataLength;
  const barSpacing = Math.min(MAX_BAR_SPACING_PX, Math.max(MIN_BAR_SPACING_PX, idealSpacing));
  const span = paneWidth / barSpacing;
  const to = (dataLength - 1) + span * LIVE_CENTER_SHIFT;
  return { from: to - span, to };
}
