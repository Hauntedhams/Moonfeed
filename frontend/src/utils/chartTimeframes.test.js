import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMEFRAMES, DEFAULT_TF_INDEX, tfSeconds, tfIndexForEntryTime } from './chartTimeframes.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

test('timeframe table and interval lengths are intact', () => {
  assert.deepEqual(TIMEFRAMES.map((t) => t.label), ['1m', '5m', '15m', '1h', '4h', '1d']);
  assert.deepEqual(TIMEFRAMES.map(tfSeconds), [60, 300, 900, 3600, 14400, 86400]);
  assert.equal(DEFAULT_TF_INDEX, 2);
});

test('picks the smallest timeframe that keeps the entry inside ~700 candles', () => {
  const now = Date.now();
  assert.equal(tfIndexForEntryTime(now - 5 * 60 * 1000), 0);          // 5 minutes ago → 1m
  assert.equal(tfIndexForEntryTime(now - 20 * HOUR), 1);              // 20h → 5m (1200 1m bars too many)
  assert.equal(tfIndexForEntryTime(now - 6 * DAY), 2);                // 6d → 15m
  assert.equal(tfIndexForEntryTime(now - 14 * DAY), 3);               // 2w → 1h
  assert.equal(tfIndexForEntryTime(now - 60 * DAY), 4);               // 2mo → 4h
  assert.equal(tfIndexForEntryTime(now - 400 * DAY), 5);              // >116d → 1d
  assert.equal(tfIndexForEntryTime(now - 3 * 365 * DAY), 5);          // capped at 1d
});

test('accepts second-precision timestamps too', () => {
  const now = Date.now();
  assert.equal(tfIndexForEntryTime(Math.floor((now - 14 * DAY) / 1000)), 3);
});

test('falls back when the entry time is unknown or in the future', () => {
  assert.equal(tfIndexForEntryTime(null), DEFAULT_TF_INDEX);
  assert.equal(tfIndexForEntryTime(undefined, 4), 4);
  assert.equal(tfIndexForEntryTime(0, 1), 1);
  assert.equal(tfIndexForEntryTime(Date.now() + DAY, 3), 3);
});
