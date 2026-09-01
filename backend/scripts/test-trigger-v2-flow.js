// Diagnostic: runs the full Trigger V2 flow through the local backend proxy with
// a throwaway keypair (signs the deposit UNMODIFIED, unlike a browser wallet that
// may inject priority-fee/guard instructions). Proves whether the pipeline is
// correct independent of wallet transaction-modification behavior.
const { Keypair, VersionedTransaction } = require('@solana/web3.js');
const nacl = require('tweetnacl');

const BASE = 'http://localhost:3001/api/trigger';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

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

async function post(path, body, jwt) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path, jwt) {
  const res = await fetch(`${BASE}${path}`, { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  const kp = Keypair.generate();
  const wallet = kp.publicKey.toBase58();
  console.log('Wallet:', wallet);

  // 1. Auth
  const ch = await post('/v2/auth/challenge', { walletPubkey: wallet, type: 'message' });
  console.log('challenge:', ch.status, ch.json.challenge ? 'OK' : ch.json);
  if (!ch.json.challenge) process.exit(1);
  const sig = nacl.sign.detached(new TextEncoder().encode(ch.json.challenge), kp.secretKey);
  const ver = await post('/v2/auth/verify', { type: 'message', walletPubkey: wallet, signature: b58encode(sig) });
  console.log('verify:', ver.status, ver.json.token ? 'JWT OK' : ver.json);
  if (!ver.json.token) process.exit(1);
  const jwt = ver.json.token;

  // 2. Vault
  const vault = await get('/v2/vault', jwt);
  console.log('vault:', vault.status, vault.json.vaultPubkey || vault.json);

  // 3. Deposit craft (0.1 SOL ≈ >$10 so it passes the min check; wallet is empty
  //    so landing will fail later, but the "accounts modified" validation happens first)
  const dep = await post('/v2/deposit', {
    inputMint: SOL,
    outputMint: USDC,
    userAddress: wallet,
    amount: '100000000',
    orderType: 'price',
    orderSubType: 'single',
  }, jwt);
  console.log('deposit craft:', dep.status, dep.json.requestId ? `requestId OK, tokenDecimals=${dep.json.tokenDecimals}` : dep.json);
  if (!dep.json.transaction) process.exit(1);

  // Inspect the crafted tx: version, feePayer, whether it has compute-budget ixs
  const tx = VersionedTransaction.deserialize(Buffer.from(dep.json.transaction, 'base64'));
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  console.log('tx version:', tx.version, '| numSignatures:', tx.signatures.length, '| feePayer:', keys[0]);
  console.log('has ComputeBudget ix:', keys.includes('ComputeBudget111111111111111111111111111111'));
  console.log('programs:', tx.message.compiledInstructions.map((ix) => keys[ix.programIdIndex]));

  // 4. Sign UNMODIFIED and create the order
  tx.sign([kp]);
  const depositSignedTx = Buffer.from(tx.serialize()).toString('base64');
  const order = await post('/v2/order', {
    orderType: 'single',
    depositRequestId: dep.json.requestId,
    depositSignedTx,
    userPubkey: wallet,
    inputMint: SOL,
    outputMint: USDC,
    inputAmount: '100000000',
    triggerMint: SOL,
    triggerCondition: 'below',
    triggerPriceUsd: 50,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  }, jwt);
  console.log('create order:', order.status, JSON.stringify(order.json));
})();
