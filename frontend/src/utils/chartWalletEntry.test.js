import test from 'node:test';
import assert from 'node:assert/strict';
import { selectChartWallet, confirmedEntryPrice } from './chartWalletEntry.js';

test('instant mode uses only its selected trading wallet, not the connected wallet', () => {
  assert.equal(selectChartWallet('connected', 'trading', true), 'trading');
  assert.equal(selectChartWallet('connected', 'trading', false), 'connected');
  assert.equal(selectChartWallet(null, 'trading', false), 'trading');
  assert.equal(selectChartWallet(null, null, true), null);
});

test('entry restores from indexed history when local history is absent', () => {
  assert.equal(confirmedEntryPrice({ amount: 100 }, { quantity: 0 }, { avgCostUsd: 0.0009 }), 0.0009);
});

test('confirmed local cost is preferred over lagging indexed history', () => {
  assert.equal(confirmedEntryPrice({ amount: 100 }, { quantity: 100, averagePriceUsd: 0.0009 }, { avgCostUsd: 0.0008 }), 0.0009);
});

test('no entry is drawn for an empty wallet, despite stale local buys or existing exits', () => {
  assert.equal(confirmedEntryPrice({ amount: 0 }, { quantity: 100, averagePriceUsd: 0.0009 }, { avgCostUsd: 0.0008 }), null);
  assert.equal(confirmedEntryPrice(undefined, { quantity: 100, averagePriceUsd: 0.0009 }, null), null);
});
