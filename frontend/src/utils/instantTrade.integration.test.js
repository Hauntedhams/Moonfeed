import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

const require = createRequire(import.meta.url);
const mockedExports = {
  '../config/api': ['getFullApiUrl'],
  './instantTradeWallet': ['loadTradingWallet', 'getTradingKeypair', 'getPresets'],
  './transactionStorage': ['storeTransaction', 'getTransactions'],
  './walletPositions': ['invalidateWalletPositions'],
  './orderFillTracking': ['getSolUsdPrice'],
  './triggerOrders': ['fetchTokenDecimals'],
  './softOrders': ['createSoftOrder', 'fetchSoftOrders', 'cancelSoftOrder'],
  './analytics': ['track'],
};
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('./instantTrade.js', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['@solana/web3.js'],
  plugins: [{
    name: 'isolated-trading-dependencies',
    setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => {
        if (args.path in mockedExports || args.path === './ReferralTracker') {
          return { path: args.path, namespace: 'trade-test' };
        }
      });
      builder.onLoad({ filter: /.*/, namespace: 'trade-test' }, (args) => ({
        contents: args.path === './ReferralTracker'
          ? `export default { trackTrade: async () => {} };`
          : mockedExports[args.path].map((name) =>
            `export const ${name} = (...args) => globalThis.mocks[${JSON.stringify(args.path)}].${name}(...args);`
          ).join('\n'),
      }));
    },
  }],
});

function fixture({ storage: sharedStorage, sendMode = 'confirmed', bracketFailure = false, keypair = Keypair.generate(), mint = Keypair.generate().publicKey.toBase58() } = {}) {
  const coin = { mintAddress: mint, symbol: 'TEST' };
  const history = [];
  const exits = new Map();
  const events = [];
  const requests = [];
  let failBrackets = bracketFailure;
  const state = new Map();
  const storage = sharedStorage || {
    getItem: (key) => state.get(key) || null,
    setItem: (key, value) => state.set(key, value),
  };
  const wallet = { publicKey: keypair.publicKey.toBase58() };
  const mocks = {
    '../config/api': { getFullApiUrl: (path) => `http://trade.test${path}` },
    './instantTradeWallet': {
      loadTradingWallet: async () => wallet,
      getTradingKeypair: async () => keypair,
      getPresets: () => ({ buySol: 0.01, slippagePct: 3, autoSellPct: 25, stopLossPct: 25 }),
    },
    './transactionStorage': {
      getTransactions: () => history,
      storeTransaction: (record) => { history.push(record); return true; },
    },
    './walletPositions': { invalidateWalletPositions: () => {} },
    './orderFillTracking': { getSolUsdPrice: async () => 100 },
    './triggerOrders': { fetchTokenDecimals: async () => 6 },
    './softOrders': {
      createSoftOrder: async (order) => {
        if (failBrackets) throw new Error('Exit provider unavailable');
        if (!exits.has(order.clientOrderId)) exits.set(order.clientOrderId, order);
        return exits.get(order.clientOrderId);
      },
      fetchSoftOrders: async () => [],
      cancelSoftOrder: async () => {},
    },
    './analytics': { track: () => {} },
  };
  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 })],
  }).compileToV0Message();
  const unsigned = Buffer.from(new VersionedTransaction(message).serialize()).toString('base64');
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, require, mocks, localStorage: storage,
    console, atob, btoa, Uint8Array, Buffer,
    setTimeout: (fn) => { queueMicrotask(fn); return 0; },
    window: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    fetch: async (url, options) => {
      const path = new URL(url).pathname;
      requests.push(path);
      if (path.includes('/limits/')) return Response.json({
        balanceLamports: 1000000000, rentMinLamports: 1000000,
        buyOverheadLamports: 6000000, sellOverheadLamports: 4000000, maxBuyLamports: 993000000,
      });
      if (path.endsWith('/balance')) return Response.json({ success: true, sol: 1, amount: 1, amountRaw: '1000000', decimals: 6 });
      if (path.endsWith('/build')) {
        if (sendMode === 'quoteFailed') return Response.json({ success: false, error: 'Quote failed (429)' }, { status: 429 });
        return Response.json({ success: true, swapTransaction: unsigned, lastValidBlockHeight: 100, outputDecimals: 6, quote: { outAmount: '1000000' } });
      }
      if (path.endsWith('/send')) {
        assert.ok(storage.getItem('moonfeed_pending_trades_v1'), 'signature must be durable before broadcast');
        if (sendMode === 'ambiguous') throw new Error('Response connection lost');
        const transaction = VersionedTransaction.deserialize(Buffer.from(JSON.parse(options.body).signedTransaction, 'base64'));
        assert.ok(transaction.signatures[0].some((byte) => byte !== 0), 'test transaction must actually be signed');
        const records = JSON.parse(storage.getItem('moonfeed_pending_trades_v1'));
        return Response.json({ success: true, signature: records.at(-1).signature, status: sendMode, confirmed: sendMode === 'confirmed' });
      }
      if (path.includes('/status/')) return Response.json({ success: true, status: sendMode === 'pending' ? 'pending' : 'confirmed' });
      if (path.includes('/tokens/')) return Response.json({ success: true, tokens: [{ mint, amount: 1 }] });
      throw new Error(`Unexpected mocked request ${path}`);
    },
  };
  vm.runInNewContext(bundled.outputFiles[0].text, context);
  return { api: module.exports, coin, wallet, keypair, history, exits, events, requests, storage, mocks, allowBrackets: () => { failBrackets = false; } };
}

test('quote failure never signs, submits, stores a buy or creates exits', async () => {
  const f = fixture({ sendMode: 'quoteFailed' });
  await assert.rejects(f.api.executeInstantBuy(f.coin), /429/);
  assert.equal(f.requests.some((path) => path.endsWith('/send')), false);
  assert.equal(f.history.length, 0);
  assert.equal(f.exits.size, 0);
  assert.equal(f.storage.getItem('moonfeed_pending_trades_v1'), null);
});

test('confirmed buy creates history and both exits keyed by its actual signed signature', async () => {
  const f = fixture();
  const result = await f.api.executeInstantBuy(f.coin);
  assert.equal(result.confirmed, true);
  assert.equal(f.history.length, 1);
  assert.equal(f.history[0].signature, result.signature);
  assert.equal(f.exits.size, 2);
  assert.ok(f.exits.has(`${result.signature}:tp`));
  assert.ok(f.exits.has(`${result.signature}:sl`));
  assert.deepEqual(JSON.parse(f.storage.getItem('moonfeed_pending_trades_v1')), []);
});

test('unconfirmed buy creates no position or exits and blocks a duplicate buy', async () => {
  const f = fixture({ sendMode: 'pending' });
  const result = await f.api.executeInstantBuy(f.coin);
  assert.equal(result.confirmed, false);
  assert.equal(f.history.length, 0);
  assert.equal(f.exits.size, 0);
  await assert.rejects(f.api.executeInstantBuy(f.coin), /still awaiting confirmation/);
  assert.equal(f.requests.filter((path) => path.endsWith('/send')).length, 1);
});

test('lost submission response recovers confirmation without a second broadcast', async () => {
  const f = fixture({ sendMode: 'ambiguous' });
  const result = await f.api.executeInstantBuy(f.coin);
  assert.equal(result.confirmed, false);
  assert.match(result.warning, /Do not buy again/);
  assert.equal(f.history.length, 0);
  await f.api.recoverPendingInstantTrades();
  assert.equal(f.history.length, 1);
  assert.equal(f.exits.size, 2);
  assert.equal(f.requests.filter((path) => path.endsWith('/send')).length, 1);
});

test('failed bracket setup is visible and retry does not duplicate the buy or its exits', async () => {
  const f = fixture({ bracketFailure: true });
  const result = await f.api.executeInstantBuy(f.coin);
  assert.equal(result.confirmed, true);
  assert.match(result.warning, /Exit provider unavailable/);
  assert.equal(f.history.length, 1);
  await assert.rejects(f.api.executeInstantBuy(f.coin), /history\/exit setup is still being recovered/);
  f.allowBrackets();
  await f.api.recoverPendingInstantTrades();
  assert.equal(f.history.length, 1);
  assert.equal(f.exits.size, 2);
  assert.equal(f.requests.filter((path) => path.endsWith('/send')).length, 1);
});

test('wallet change before signing cannot submit from a different wallet', async () => {
  const f = fixture();
  f.mocks['./instantTradeWallet'].getTradingKeypair = async () => Keypair.generate();
  await assert.rejects(f.api.executeInstantBuy(f.coin), /wallet changed/);
  assert.equal(f.requests.some((path) => path.endsWith('/send')), false);
  assert.equal(f.history.length, 0);
});

test('app reopening restores a pending buy from storage without signing or broadcasting again', async () => {
  const original = fixture({ sendMode: 'pending' });
  await original.api.executeInstantBuy(original.coin);
  const reopened = fixture({
    storage: original.storage, keypair: original.keypair, mint: original.coin.mintAddress,
  });
  await reopened.api.recoverPendingInstantTrades();
  assert.equal(reopened.history.length, 1);
  assert.equal(reopened.exits.size, 2);
  assert.equal(reopened.requests.some((path) => path.endsWith('/send') || path.endsWith('/build')), false);
});

test('on-chain failed buy is discarded and never creates a position', async () => {
  const f = fixture({ sendMode: 'failed' });
  await assert.rejects(f.api.executeInstantBuy(f.coin), /did not go through/);
  assert.equal(f.history.length, 0);
  assert.equal(f.exits.size, 0);
  assert.deepEqual(JSON.parse(f.storage.getItem('moonfeed_pending_trades_v1')), []);
});

test('parallel trade surfaces cannot submit two buys for the same wallet', async () => {
  const f = fixture();
  const first = f.api.executeInstantBuy(f.coin);
  await assert.rejects(f.api.executeInstantBuy(f.coin), /already in progress/);
  await first;
  assert.equal(f.requests.filter((path) => path.endsWith('/send')).length, 1);
});

test('confirmed full sell stores a sell and clears only older exits for that mint', async () => {
  const f = fixture();
  const cancelled = [];
  f.mocks['./softOrders'].fetchSoftOrders = async () => [
    { orderId: 'old-exit', type: 'sell', tokenMint: f.coin.mintAddress, createdAt: new Date(0).toISOString() },
    { orderId: 'future-exit', type: 'sell', tokenMint: f.coin.mintAddress, createdAt: new Date(Date.now() + 60000).toISOString() },
    { orderId: 'other-mint', type: 'sell', tokenMint: 'other', createdAt: new Date(0).toISOString() },
  ];
  f.mocks['./softOrders'].cancelSoftOrder = async (id) => cancelled.push(id);
  const result = await f.api.executeInstantSell(f.coin, 100);
  assert.equal(result.confirmed, true);
  assert.equal(f.history[0].type, 'sell');
  assert.deepEqual(cancelled, ['old-exit']);
});

test('unconfirmed sell does not change history or cancel protection prematurely', async () => {
  const f = fixture({ sendMode: 'pending' });
  f.mocks['./softOrders'].cancelSoftOrder = () => assert.fail('must not cancel before confirmation');
  const result = await f.api.executeInstantSell(f.coin, 100);
  assert.equal(result.confirmed, false);
  assert.equal(f.history.length, 0);
});

test('unavailable live price prevents a buy with fabricated exit levels', async () => {
  const f = fixture();
  f.mocks['./orderFillTracking'].getSolUsdPrice = async () => { throw new Error('Live SOL price unavailable'); };
  await assert.rejects(f.api.executeInstantBuy(f.coin), /Live SOL price/);
  assert.equal(f.requests.some((path) => path.endsWith('/send')), false);
  assert.equal(f.exits.size, 0);
});
