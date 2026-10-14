import test from 'node:test';
import assert from 'node:assert/strict';
import { savePendingTrade, readPendingTrades, reconcilePendingTrades } from './pendingTrades.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const record = { signature: 'signature', walletAddress: 'wallet', tokenMint: 'mint', status: 'pending', lastValidBlockHeight: 100 };

test('pending trade persists across reopening and confirms exactly once', async () => {
  const storage = memoryStorage();
  savePendingTrade(record, storage);
  let settled = 0;
  const callbacks = {
    wallet: 'wallet', storage,
    getStatus: async (signature, height) => {
      assert.equal(signature, 'signature');
      assert.equal(height, 100);
      return { status: 'confirmed' };
    },
    onConfirmed: async () => { settled++; },
    onFailed: () => assert.fail('not failed'),
  };
  await reconcilePendingTrades(callbacks);
  await reconcilePendingTrades(callbacks);
  assert.equal(settled, 1);
  assert.deepEqual(readPendingTrades(storage), []);
});

for (const status of ['pending', 'unknown']) {
  test(`${status} does not create history or exits`, async () => {
    const storage = memoryStorage();
    savePendingTrade(record, storage);
    await reconcilePendingTrades({
      wallet: 'wallet', storage, getStatus: async () => ({ status }),
      onConfirmed: () => assert.fail('unconfirmed trade finalized'),
      onFailed: () => assert.fail('unresolved trade discarded'),
    });
    assert.equal(readPendingTrades(storage).length, 1);
  });
}

for (const status of ['failed', 'expired']) {
  test(`${status} is reported and removed without creating a position`, async () => {
    const storage = memoryStorage();
    savePendingTrade(record, storage);
    let reported = false;
    await reconcilePendingTrades({
      wallet: 'wallet', storage, getStatus: async () => ({ status }),
      onConfirmed: () => assert.fail('failed trade finalized'),
      onFailed: (_record, result) => { reported = result.status === status; },
    });
    assert.equal(reported, true);
    assert.equal(readPendingTrades(storage).length, 0);
  });
}

test('wallet switching never finalizes a different wallet transaction', async () => {
  const storage = memoryStorage();
  savePendingTrade(record, storage);
  await reconcilePendingTrades({
    wallet: 'different-wallet', storage,
    getStatus: () => assert.fail('queried wrong wallet'),
    onConfirmed: () => assert.fail('settled wrong wallet'),
  });
  assert.equal(readPendingTrades(storage).length, 1);
});

test('failed bookkeeping keeps confirmed signature for retry without resending', async () => {
  const storage = memoryStorage();
  savePendingTrade(record, storage);
  await assert.rejects(reconcilePendingTrades({
    wallet: 'wallet', storage, getStatus: async () => ({ status: 'confirmed' }),
    onConfirmed: async () => { throw new Error('exit-order request failed'); },
  }), /exit-order request failed/);
  assert.equal(readPendingTrades(storage)[0].status, 'confirmed');
  await reconcilePendingTrades({
    wallet: 'wallet', storage,
    getStatus: () => assert.fail('confirmed transaction must not be resent or rechecked'),
    onConfirmed: async () => {},
  });
  assert.equal(readPendingTrades(storage).length, 0);
});

test('one provider error does not starve other pending trades', async () => {
  const storage = memoryStorage();
  savePendingTrade(record, storage);
  savePendingTrade({ ...record, signature: 'second' }, storage);
  let errors = 0;
  await reconcilePendingTrades({
    wallet: 'wallet', storage,
    getStatus: async (signature) => {
      if (signature === 'signature') throw new Error('RPC temporarily unavailable');
      return { status: 'confirmed' };
    },
    onConfirmed: async () => {},
    onError: () => { errors++; },
  });
  assert.equal(errors, 1);
  assert.deepEqual(readPendingTrades(storage).map((item) => item.signature), ['signature']);
});

test('storage errors prevent recording a submission rather than silently losing it', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('storage blocked'); } };
  assert.throws(() => savePendingTrade(record, storage), /storage blocked/);
  assert.throws(() => readPendingTrades({ getItem: () => '[null]' }), /unreadable/);
});
