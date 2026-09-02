// Checks whether Jupiter's crafted deposit carries a FRESH blockhash.
// A stale one explains everything: wallet simulation fails -> Solflare
// refreshes/modifies the tx -> Jupiter's byte-exact check rejects it.
const { Keypair, VersionedTransaction } = require('@solana/web3.js');
const nacl = require('tweetnacl');
require('dotenv').config();

const BASE = 'http://localhost:3001/api/trigger';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const HELIUS = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58encode(bytes) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

async function post(url, body, jwt) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  const kp = Keypair.generate();
  const wallet = kp.publicKey.toBase58();

  const ch = await post(`${BASE}/v2/auth/challenge`, { walletPubkey: wallet, type: 'message' });
  const sig = nacl.sign.detached(new TextEncoder().encode(ch.json.challenge), kp.secretKey);
  const ver = await post(`${BASE}/v2/auth/verify`, { type: 'message', walletPubkey: wallet, signature: b58encode(sig) });
  const jwt = ver.json.token;
  await fetch(`${BASE}/v2/vault`, { headers: { Authorization: `Bearer ${jwt}` } });

  const dep = await post(`${BASE}/v2/deposit`, {
    inputMint: SOL, outputMint: USDC, userAddress: wallet,
    amount: '100000000', orderType: 'price', orderSubType: 'single',
  }, jwt);
  if (!dep.json.transaction) { console.log('craft failed:', dep.json); process.exit(1); }

  const tx = VersionedTransaction.deserialize(Buffer.from(dep.json.transaction, 'base64'));
  const bh = tx.message.recentBlockhash;
  console.log('deposit blockhash:', bh);

  // Decode the crafted tx's instructions — if it lacks ComputeBudget
  // (priority fee) instructions, mobile wallets inject their own, which
  // changes the message bytes and breaks Jupiter's byte-exact check.
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  console.log('version:', tx.version, '| signatures required:', tx.message.header.numRequiredSignatures);
  console.log('address table lookups:', tx.message.addressTableLookups?.length || 0);
  tx.message.compiledInstructions.forEach((ix, i) => {
    const prog = keys[ix.programIdIndex];
    let detail = '';
    if (prog === 'ComputeBudget111111111111111111111111111111') {
      const d = Buffer.from(ix.data);
      if (d[0] === 2) detail = ` setComputeUnitLimit(${d.readUInt32LE(1)})`;
      else if (d[0] === 3) detail = ` setComputeUnitPrice(${d.readBigUInt64LE(1)} microLamports)`;
      else detail = ` discriminator=${d[0]}`;
    }
    console.log(`  ix[${i}] program=${prog}${detail}`);
  });
  const hasComputeBudget = tx.message.compiledInstructions.some(
    (ix) => keys[ix.programIdIndex] === 'ComputeBudget111111111111111111111111111111'
  );
  console.log('has ComputeBudget instructions:', hasComputeBudget);

  // Round-trip fidelity check of our own deserialize->serialize path
  const roundTrip = Buffer.from(tx.serialize()).toString('base64');
  console.log('deserialize->serialize byte-identical:', roundTrip === dep.json.transaction);

  // Legacy-recompile check: wallets that parse a LEGACY tx into web3.js's
  // Transaction and re-serialize will RECOMPILE the message (canonical account
  // re-sort). If that alone changes the bytes, every such wallet "modifies"
  // the tx without touching it — and Jupiter's byte-exact check fails.
  try {
    const { Transaction } = require('@solana/web3.js');
    const legacyTx = Transaction.from(Buffer.from(dep.json.transaction, 'base64'));
    const recompiled = legacyTx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const identical = recompiled.toString('base64') === dep.json.transaction;
    console.log('legacy Transaction.from -> serialize byte-identical:', identical);
    if (!identical) {
      const re = VersionedTransaction.deserialize(recompiled);
      const origKeys = tx.message.staticAccountKeys.map((k) => k.toBase58());
      const reKeys = re.message.staticAccountKeys.map((k) => k.toBase58());
      console.log('  original accounts:', origKeys.length, '| recompiled accounts:', reKeys.length);
      console.log('  account order changed:', JSON.stringify(origKeys) !== JSON.stringify(reKeys));
      console.log('  orig ix count:', tx.message.compiledInstructions.length, '| recompiled ix count:', re.message.compiledInstructions.length);
    }
  } catch (e) {
    console.log('legacy recompile check failed:', e.message);
  }

  const rpc = async (method, params) => {
    const res = await fetch(HELIUS, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    return (await res.json()).result;
  };

  const valid = await rpc('isBlockhashValid', [bh, { commitment: 'processed' }]);
  const latest = await rpc('getLatestBlockhash', [{ commitment: 'processed' }]);
  console.log('blockhash valid right now:', valid?.value, '| checked at slot', valid?.context?.slot);
  console.log('latest blockhash lastValidBlockHeight:', latest?.value?.lastValidBlockHeight);

  // Simulate the (unsigned) deposit the way a wallet would
  const sim = await rpc('simulateTransaction', [dep.json.transaction, {
    encoding: 'base64', sigVerify: false, replaceRecentBlockhash: false, commitment: 'processed',
  }]);
  console.log('simulation (as-is blockhash):', sim?.value?.err ? JSON.stringify(sim.value.err) : 'OK');
  const sim2 = await rpc('simulateTransaction', [dep.json.transaction, {
    encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed',
  }]);
  console.log('simulation (replaced blockhash):', sim2?.value?.err ? JSON.stringify(sim2.value.err) : 'OK', sim2?.value?.logs?.slice(-3));
})();
