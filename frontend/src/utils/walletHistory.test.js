import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoryItems } from './walletHistory.js';

const NOW = 1_760_000_000_000;
const sec = (ms) => Math.floor(ms / 1000);

const position = (over = {}) => ({
  mint: 'MintA',
  symbol: 'AAA',
  name: 'Coin A',
  image: 'https://img/a.png',
  holding: false,
  invested: 120,
  proceeds: 90,
  pnl: { total: -30, realized: -30, unrealized: 0 },
  counts: { buys: 3, sells: 2, total: 5 },
  lastBuy: sec(NOW - 3 * 86_400_000),
  lastSell: sec(NOW - 86_400_000),
  lastTrade: sec(NOW - 86_400_000),
  ...over,
});

test('shows every on-chain position, not just Moonfeed-recorded swaps', () => {
  const positions = Array.from({ length: 40 }, (_, i) => position({ mint: `Mint${i}`, lastTrade: sec(NOW - i * 3_600_000) }));
  const items = buildHistoryItems(positions, [{ tokenMint: 'Mint3', type: 'buy', timestamp: NOW - 3 * 3_600_000 - 5_000, inputAmount: 0.1 }]);
  assert.equal(items.length, 40);
  assert.deepEqual(items.slice(0, 3).map((i) => i.key), ['Mint0', 'Mint1', 'Mint2']);
});

test('one tile per coin — duplicate local swaps collapse into the position', () => {
  const items = buildHistoryItems(
    [position()],
    [
      { tokenMint: 'MintA', type: 'buy', timestamp: NOW - 2 * 86_400_000, inputAmount: 0.19 },
      { tokenMint: 'MintA', type: 'sell', timestamp: NOW - 86_400_000, outputAmount: 0.01 },
    ]
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'sell');
  assert.equal(items[0].pnlUsd, -30);
  assert.equal(items[0].sub, '$90.00 out');
  assert.equal(items[0].trades, 5);
});

test('a swap made seconds ago appears even before the upstream indexer sees it', () => {
  const items = buildHistoryItems(
    [position()],
    [{ tokenMint: 'MintNew', tokenSymbol: 'NEW', type: 'buy', timestamp: NOW, inputAmount: 0.05, tokenImage: 'https://img/new.png' }],
    new Map()
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].key, 'MintNew');
  assert.equal(items[0].holding, true);
  assert.equal(items[0].pnlUsd, null);
  assert.equal(items[0].sub, '−0.05 SOL');
  assert.equal(items[0].tokenImage, 'https://img/new.png');
});

test('a newer local sell bumps a stale position tile to the top as a sell', () => {
  const items = buildHistoryItems(
    [position({ mint: 'Old', lastTrade: sec(NOW - 10 * 86_400_000) }), position({ mint: 'Recent', lastTrade: sec(NOW - 86_400_000) })],
    [{ tokenMint: 'Old', type: 'sell', timestamp: NOW, outputAmount: 0.2 }]
  );
  assert.equal(items[0].key, 'Old');
  assert.equal(items[0].type, 'sell');
  assert.equal(items[0].timestamp, NOW);
});

test('open positions read as holding with invested amount and theoretical PnL', () => {
  const [item] = buildHistoryItems([position({ holding: true, proceeds: 0, pnl: { total: 42 }, lastSell: null, lastTrade: sec(NOW) })], []);
  assert.equal(item.holding, true);
  assert.equal(item.type, 'buy');
  assert.equal(item.sub, '$120 in');
  assert.equal(item.pnlUsd, 42);
});

test('local-only tiles use the per-mint PnL fallback when present', () => {
  const fallback = new Map([['MintB', { pnlTotal: 7.5, holding: false, image: 'https://img/b.png' }]]);
  const [item] = buildHistoryItems([], [{ tokenMint: 'MintB', type: 'buy', timestamp: NOW, inputAmount: 0.3 }], fallback);
  assert.equal(item.pnlUsd, 7.5);
  assert.equal(item.holding, false);
  assert.equal(item.tokenImage, 'https://img/b.png');
});

test('ignores malformed rows and tolerates missing inputs', () => {
  assert.deepEqual(buildHistoryItems(), []);
  assert.deepEqual(buildHistoryItems([{}, null, { mint: '' }], [{}, { tokenMint: null }]), []);
});
