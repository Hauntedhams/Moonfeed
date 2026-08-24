import { getFullApiUrl } from '../config/api';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const EXPIRY_OPTIONS = [
  { id: '1h', label: '1H', ms: 60 * 60 * 1000 },
  { id: '24h', label: '24H', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
];

export function getExpiryTimestamp(id) {
  const option = EXPIRY_OPTIONS.find((o) => o.id === id);
  return option ? Date.now() + option.ms : null;
}

// Pump.fun tokens use 6 decimals, so that's the safe fallback when metadata is unavailable.
export async function fetchTokenDecimals(mint) {
  try {
    const res = await fetch(`https://tokens.jup.ag/token/${mint}`);
    if (res.ok) {
      const meta = await res.json();
      if (typeof meta.decimals === 'number') return meta.decimals;
    }
  } catch (_) { /* fall through */ }
  return 6;
}

/**
 * Create → sign → execute a Jupiter trigger (limit/stop) order.
 * Returns { orderId, signature, decimals }.
 */
export async function placeTriggerOrder({
  walletAddress,
  signTransaction,
  mintAddress,
  side,
  inputAmount,
  triggerPrice,
  expiredAt = null,
  orderType = 'limit',
  tokenDecimals = null,
}) {
  if (!walletAddress) throw new Error('Please connect your wallet first');
  if (!signTransaction) throw new Error('Wallet cannot sign transactions');
  if (!mintAddress) throw new Error('Missing token address');

  const amount = parseFloat(inputAmount);
  const price = parseFloat(triggerPrice);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter a valid amount');
  if (!Number.isFinite(price) || price <= 0) throw new Error('Please enter a valid trigger price');

  const decimals = tokenDecimals ?? await fetchTokenDecimals(mintAddress);
  const tokenMultiplier = Math.pow(10, decimals);

  const inputMint = side === 'buy' ? SOL_MINT : mintAddress;
  const outputMint = side === 'buy' ? mintAddress : SOL_MINT;
  const makingAmount = (side === 'buy' ? amount * 1e9 : amount * tokenMultiplier).toFixed(0);
  const takingAmount = (side === 'buy'
    ? (amount / price) * tokenMultiplier
    : amount * price * 1e9
  ).toFixed(0);

  const createRes = await fetch(getFullApiUrl('/api/trigger/create-order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      maker: walletAddress,
      payer: walletAddress,
      inputMint,
      outputMint,
      makingAmount,
      takingAmount,
      expiredAt,
      orderType,
    }),
  });
  const created = await createRes.json();
  if (!created.success) throw new Error(created.error || 'Failed to create order');

  const signedTransaction = await signTransaction(created.data.transaction);

  const executeRes = await fetch(getFullApiUrl('/api/trigger/execute'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedTransaction,
      requestId: created.data.requestId,
      orderMetadata: { maker: walletAddress, inputMint, outputMint, side, orderType, expiredAt },
    }),
  });
  const executed = await executeRes.json();
  if (!executed.success) throw new Error(executed.error || 'Failed to execute order');

  if (executed.signature && executed.orderId) {
    const { storeOrderSignature } = await import('./orderStorage.js');
    storeOrderSignature({
      orderId: executed.orderId,
      signature: executed.signature,
      maker: walletAddress,
      orderType: 'create',
    });
  }

  return { orderId: executed.orderId, signature: executed.signature, decimals };
}
