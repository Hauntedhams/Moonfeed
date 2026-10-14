const test = require('node:test');
const assert = require('node:assert/strict');
const { requestJupiterSwap, retryDelay } = require('./jupiterSwapClient');

const response = (status, data = {}, headers = {}) => new Response(JSON.stringify(data), { status, headers });

test('authenticated quote and swap use server-only API key', async () => {
  for (const path of ['quote?inputMint=SOL', 'swap']) {
    const result = await requestJupiterSwap(path, {}, {
      apiKey: 'test-only-key',
      fetchImpl: async (url, options) => {
        assert.equal(url, `https://api.jup.ag/swap/v1/${path}`);
        assert.equal(options.headers['x-api-key'], 'test-only-key');
        assert.ok(options.signal);
        return response(200, { outAmount: '100' });
      },
    });
    assert.equal(result.outAmount, '100');
  }
});

test('keyless fallback does not send an API key header', async () => {
  await requestJupiterSwap('quote', {}, {
    apiKey: '',
    fetchImpl: async (url, options) => {
      assert.ok(url.startsWith('https://lite-api.jup.ag/'));
      assert.equal(options.headers['x-api-key'], undefined);
      return response(200, {});
    },
  });
});

test('429 backs off according to retry-after then succeeds', async () => {
  const waits = [];
  let calls = 0;
  await requestJupiterSwap('quote', {}, {
    apiKey: '', wait: async (ms) => waits.push(ms),
    fetchImpl: async () => ++calls === 1 ? response(429, {}, { 'retry-after': '3' }) : response(200, {}),
  });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [3000]);
});

test('long rate-limit window returns actionable 429 without premature retry', async () => {
  let calls = 0;
  await assert.rejects(requestJupiterSwap('quote', {}, {
    apiKey: '', wait: () => assert.fail('must not sleep past bounded retry window'),
    fetchImpl: async () => { calls++; return response(429, {}, { 'retry-after': '60' }); },
  }), (error) => error.status === 429 && error.retryAfterMs === 60000 && /No transaction was submitted/.test(error.message));
  assert.equal(calls, 1);
});

test('429 attempts are bounded and do not retry indefinitely', async () => {
  let calls = 0;
  await assert.rejects(requestJupiterSwap('swap', {}, {
    apiKey: '', wait: async () => {},
    fetchImpl: async () => { calls++; return response(429); },
  }), (error) => error.status === 429);
  assert.equal(calls, 3);
});

test('auth and no-route errors are not retried', async () => {
  for (const status of [401, 400]) {
    let calls = 0;
    await assert.rejects(requestJupiterSwap('quote', {}, {
      apiKey: '', wait: () => assert.fail('must not retry deterministic errors'),
      fetchImpl: async () => { calls++; return response(status, { error: 'Unavailable' }); },
    }), /Unavailable/);
    assert.equal(calls, 1);
  }
});

test('provider 5xx build errors retry safely before any transaction is signed', async () => {
  let calls = 0;
  await requestJupiterSwap('swap', {}, {
    apiKey: '', wait: async () => {},
    fetchImpl: async () => ++calls === 1 ? response(503) : response(200, { swapTransaction: 'unsigned' }),
  });
  assert.equal(calls, 2);
});

test('rate-limit reset Unix seconds and retry-after dates determine backoff', () => {
  assert.equal(retryDelay(response(429, {}, { 'x-ratelimit-reset': '104' }), 0, 100000), 4000);
  assert.equal(retryDelay(response(429, {}, { 'retry-after': new Date(105000).toUTCString() }), 0, 100000), 5000);
});
