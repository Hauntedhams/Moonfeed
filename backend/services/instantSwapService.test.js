const test = require('node:test');
const assert = require('node:assert/strict');
const { sendAndConfirm, getSignatureStatus, getConnection } = require('./instantSwapService');

test('processed status at blockhash expiry is pending, not confirmed', async (t) => {
  t.mock.method(getConnection(), 'sendRawTransaction', async () => 'signature');
  t.mock.method(getConnection(), 'getSignatureStatuses', async () => ({
    value: [{ err: null, confirmationStatus: 'processed' }],
  }));
  t.mock.method(getConnection(), 'getBlockHeight', async () => 101);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const pending = sendAndConfirm(Buffer.from('test'), { lastValidBlockHeight: 100 });
  await new Promise(setImmediate);
  t.mock.timers.tick(1200);
  assert.equal((await pending).status, 'pending');
});

test('only confirmed/finalized status is a successful settlement', async (t) => {
  for (const confirmationStatus of ['processed', 'confirmed', 'finalized']) {
    t.mock.method(getConnection(), 'getSignatureStatuses', async () => ({
      value: [{ err: null, confirmationStatus }],
    }));
    const result = await getSignatureStatus('signature');
    assert.equal(result.status, confirmationStatus === 'processed' ? 'pending' : 'confirmed');
    t.mock.restoreAll();
  }
});

test('on-chain errors override any confirmation status', async (t) => {
  t.mock.method(getConnection(), 'getSignatureStatuses', async () => ({
    value: [{ err: { InstructionError: [0, 'error'] }, confirmationStatus: 'finalized' }],
  }));
  assert.equal((await getSignatureStatus('signature')).status, 'failed');
});
