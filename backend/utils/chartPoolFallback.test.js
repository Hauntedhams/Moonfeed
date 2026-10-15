const test = require('node:test');
const assert = require('node:assert/strict');
const { rankAlternatePools, isUsableOhlcv, intervalSeconds } = require('./chartPoolFallback');

// Real shape from the "Jack" case: top-liquidity PumpSwap pool quoted in GRND had
// zero candles at the provider; the coin also had thin Meteora pools and the
// graduated pump.fun bonding curve.
const jackPairs = [
  { chainId: 'solana', pairAddress: 'PUMPSWAP_GRND', dexId: 'pumpswap', liquidity: { usd: 29954 }, volumeH24: 852035 },
  { chainId: 'solana', pairAddress: 'METEORA_SOL', dexId: 'meteora', liquidity: { usd: 126.95 }, volumeH24: 129 },
  { chainId: 'solana', pairAddress: 'METEORA_DUST', dexId: 'meteora', liquidity: { usd: 0.03 }, volumeH24: 2.7 },
  { chainId: 'solana', pairAddress: 'PUMPFUN_CURVE', dexId: 'pumpfun', liquidity: { usd: 0 }, volumeH24: 88519 },
];

test('thin pools are not offered as chart alternates (they misprice the coin)', () => {
  assert.deepEqual(rankAlternatePools(jackPairs, 'PUMPSWAP_GRND'), []);
});

test('liquid alternates are ranked by liquidity and exclude the failed primary', () => {
  const pairs = [
    { chainId: 'solana', pairAddress: 'PRIMARY', liquidity: { usd: 50000 } },
    { chainId: 'solana', pairAddress: 'SMALL', liquidity: { usd: 1500 } },
    { chainId: 'solana', pairAddress: 'BIG', liquidity: { usd: 9000 } },
    { chainId: 'solana', pairAddress: 'MID', liquidity: { usd: 4000 } },
    { chainId: 'ethereum', pairAddress: 'WRONG_CHAIN', liquidity: { usd: 99999 } },
  ];
  assert.deepEqual(rankAlternatePools(pairs, 'PRIMARY'), ['BIG', 'MID']);
});

test('tolerates missing or malformed pair lists', () => {
  assert.deepEqual(rankAlternatePools(undefined, 'X'), []);
  assert.deepEqual(rankAlternatePools([null, {}, { chainId: 'solana' }], 'X'), []);
});

test('empty candle lists are never usable', () => {
  assert.equal(isUsableOhlcv([], 900), false);
  assert.equal(isUsableOhlcv(undefined, 900), false);
  assert.equal(isUsableOhlcv([[NaN, 1, 1, 1, 1]], 900), false);
});

test('recent candles are usable; a graduated bonding curve that stopped hours ago is not', () => {
  const now = 1_792_040_000;
  const recent = [[now - 2000, 1, 1, 1, 1, 0], [now - 60, 1, 1, 1, 1, 0]];
  assert.equal(isUsableOhlcv(recent, 900, now), true);
  const graduatedCurve = [[now - 5 * 3600, 1, 1, 1, 1, 0]];
  assert.equal(isUsableOhlcv(graduatedCurve, 900, now), false);
});

test('staleness window scales with bar size but never drops below 30 minutes', () => {
  const now = 1_792_040_000;
  // 1m bars: 3 intervals = 3 min, but the floor is 30 min, so a 20-min-old candle is fine.
  assert.equal(isUsableOhlcv([[now - 20 * 60, 1, 1, 1, 1]], 60, now), true);
  assert.equal(isUsableOhlcv([[now - 40 * 60, 1, 1, 1, 1]], 60, now), false);
  // 1d bars: 3 days of quiet is still a usable chart.
  assert.equal(isUsableOhlcv([[now - 2 * 86400, 1, 1, 1, 1]], 86400, now), true);
});

test('interval seconds follow the provider timeframe + aggregate', () => {
  assert.equal(intervalSeconds('minute', 15), 900);
  assert.equal(intervalSeconds('minute', '1'), 60);
  assert.equal(intervalSeconds('hour', 4), 14400);
  assert.equal(intervalSeconds('day', 1), 86400);
  assert.equal(intervalSeconds('minute', 'junk'), 60);
});
