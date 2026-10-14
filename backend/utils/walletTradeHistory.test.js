const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIndexedTrade, mergeWalletTrades } = require('./walletTradeHistory');

const SOL = 'So11111111111111111111111111111111111111112';
const buy = {
  tx: 'buy-signature', wallet: 'wallet', time: 1792011860000,
  from: { address: SOL, amount: 0.0291 },
  to: { address: 'mint', amount: 3238.325255, priceUsd: 0.0009337195983162642, token: { symbol: 'CFLARE', name: 'Claudiaflare ' } },
};
const sell = {
  tx: 'sell-signature', wallet: 'wallet', time: 1792012798000,
  from: buy.to, to: { address: SOL, amount: 0.036555921 },
};

test('recent buy and cloud sell omitted by one index are both restored', () => {
  const transactions = mergeWalletTrades([], [normalizeIndexedTrade(buy, 'wallet'), normalizeIndexedTrade(sell, 'wallet')]);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].type, 'sell');
  assert.equal(transactions[1].type, 'buy');
  assert.equal(transactions[1].inputAmount, 0.0291);
  assert.equal(transactions[0].outputAmount, 0.036555921);
  assert.equal(transactions[1].tokenName, 'Claudiaflare');
});

test('signature merging never duplicates a locally/indexed known trade', () => {
  const canonical = normalizeIndexedTrade(buy, 'wallet');
  const result = mergeWalletTrades([{ ...canonical, tokenSymbol: 'Unknown', outputAmount: 1000 }], [canonical]);
  assert.equal(result.length, 1);
  assert.equal(result[0].outputAmount, 3238.325255);
});

test('timestamps accept seconds and milliseconds without shifting the trade', () => {
  assert.equal(normalizeIndexedTrade({ ...buy, time: 1792011860 }, 'wallet').timestamp, buy.time);
});

test('unrelated wallet or invalid SOL/token quantities cannot become a user trade', () => {
  assert.throws(() => normalizeIndexedTrade(buy, 'other-wallet'), /invalid wallet/);
  assert.throws(() => normalizeIndexedTrade({ ...buy, from: { address: SOL, amount: 0 } }, 'wallet'), /invalid wallet/);
});

test('non-SOL swaps are not misrepresented as SOL buys', () => {
  assert.equal(normalizeIndexedTrade({ ...buy, from: { address: 'USDC', amount: 10 } }, 'wallet'), null);
});
