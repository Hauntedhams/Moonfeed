import test from 'node:test';
import assert from 'node:assert/strict';
import { includeTradeLevels } from './chartPriceRange.js';

test('frames buy-in and both 25% exits beyond the visible candles', () => {
  const base = { priceRange: { minValue: 0.16, maxValue: 0.18 }, margins: { above: 4, below: 4 } };
  const result = includeTradeLevels(base, [0.17, 0.17 * 0.75, 0.17 * 1.25]);
  assert.ok(result.priceRange.minValue < 0.1275);
  assert.ok(result.priceRange.maxValue > 0.2125);
  assert.equal(result.margins, base.margins);
  assert.deepEqual(base.priceRange, { minValue: 0.16, maxValue: 0.18 });
});

test('includes a distant take-profit target rather than silently hiding it', () => {
  const result = includeTradeLevels({ priceRange: { minValue: 1, maxValue: 1.1 } }, [6]);
  assert.ok(result.priceRange.maxValue > 6);
  assert.ok(result.priceRange.minValue >= 0);
});

test('ignores invalid levels and preserves an empty candle range', () => {
  const base = { priceRange: { minValue: 1, maxValue: 2 } };
  assert.equal(includeTradeLevels(base, [null, 0, -1, NaN, Infinity]), base);
  assert.equal(includeTradeLevels(base, []), base);
  assert.equal(includeTradeLevels(null, [1]), null);
});

test('does not retain old exit levels after orders are removed', () => {
  const base = { priceRange: { minValue: 0.16, maxValue: 0.18 } };
  const withOrders = includeTradeLevels(base, [0.17, 0.1275, 0.2125]);
  const withoutOrders = includeTradeLevels(base, [0.17]);
  assert.ok(withoutOrders.priceRange.minValue > withOrders.priceRange.minValue);
  assert.ok(withoutOrders.priceRange.maxValue < withOrders.priceRange.maxValue);
});
