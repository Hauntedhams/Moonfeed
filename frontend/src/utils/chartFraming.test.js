import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLogicalRange, LIVE_CENTER_SHIFT, MAX_BAR_SPACING_PX, MIN_BAR_SPACING_PX } from './chartFraming.js';

const lastBarFraction = (range, dataLength) => ((dataLength - 1) - range.from) / (range.to - range.from);

test('large dataset: last bar sits at 58% of the pane and the window never ignores the data', () => {
  const range = defaultLogicalRange(1000, 334);
  assert.ok(range.from < 999 && range.to > 999, 'last bar must be inside the window');
  assert.ok(Math.abs(lastBarFraction(range, 1000) - (1 - LIVE_CENTER_SHIFT)) < 0.01);
  // 1000 bars in 334px would be 0.33px/bar — clamped to the 0.5px minimum, so ~668 bars visible.
  assert.ok(Math.abs((range.to - range.from) - 334 / MIN_BAR_SPACING_PX) < 0.01);
});

test('tiny fresh-coin dataset (the auto-density 1m case): every bar stays in view, live candle centred', () => {
  const range = defaultLogicalRange(6, 334);
  assert.ok(range.from < 5 && range.to > 5, 'last bar must be inside the window');
  assert.ok(range.from <= -0.5, 'first bar must be fully visible');
  assert.ok(Math.abs(lastBarFraction(range, 6) - (1 - LIVE_CENTER_SHIFT)) < 0.01);
});

test('medium dataset fits entirely in the left portion of the pane', () => {
  const range = defaultLogicalRange(48, 390);
  assert.ok(range.from <= -0.5 && range.to > 47);
  assert.ok(Math.abs(lastBarFraction(range, 48) - (1 - LIVE_CENTER_SHIFT)) < 0.01);
});

test('two bars: spacing clamps at the library maximum rather than stretching absurdly', () => {
  const range = defaultLogicalRange(2, 390);
  assert.ok(Math.abs((range.to - range.from) - 390 / MAX_BAR_SPACING_PX) < 0.01);
  assert.ok(range.to > 1, 'last bar inside the window');
});

test('does not depend on any previous range — same inputs, same answer', () => {
  assert.deepEqual(defaultLogicalRange(48, 390), defaultLogicalRange(48, 390));
  const a = defaultLogicalRange(48, 390);
  assert.ok(Math.abs(lastBarFraction(a, 48) - (1 - LIVE_CENTER_SHIFT)) < 0.01);
});

test('returns null when there is nothing (or no width) to frame', () => {
  assert.equal(defaultLogicalRange(0, 390), null);
  assert.equal(defaultLogicalRange(10, 0), null);
  assert.equal(defaultLogicalRange(undefined, 390), null);
});
