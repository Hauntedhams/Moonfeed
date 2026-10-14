const SOL_MINT = 'So11111111111111111111111111111111111111112';

function normalizeIndexedTrade(trade, wallet) {
  const isBuy = trade.from?.address === SOL_MINT;
  const isSell = trade.to?.address === SOL_MINT;
  if (!isBuy && !isSell) return null; // This history surface represents SOL/token trades.
  const token = isBuy ? trade.to : trade.from;
  const inputAmount = Number(trade.from?.amount);
  const outputAmount = Number(trade.to?.amount);
  const time = Number(trade.time);
  if (!trade.tx || (trade.wallet && trade.wallet !== wallet) || !token?.address ||
      token.address === SOL_MINT || !(inputAmount > 0) || !Number.isFinite(inputAmount) ||
      !(outputAmount > 0) || !Number.isFinite(outputAmount) || !(time > 0) || !Number.isFinite(time)) {
    throw new Error('Indexed swap has invalid wallet, amounts, mint or timestamp');
  }
  const timestamp = time < 1e12 ? time * 1000 : time;
  const quantity = isBuy ? outputAmount : inputAmount;
  const sol = isBuy ? inputAmount : outputAmount;
  const unitUsd = Number(token.priceUsd) || Number(trade.volume?.usd) / quantity;
  return {
    id: `${trade.tx}_${timestamp}`,
    signature: trade.tx,
    walletAddress: wallet,
    status: 'confirmed',
    type: isBuy ? 'buy' : 'sell',
    tokenMint: token.address,
    tokenSymbol: token.token?.symbol || 'Unknown',
    tokenName: token.token?.name?.trim() || token.token?.symbol || 'Unknown',
    tokenImage: token.token?.image || null,
    inputMint: trade.from.address,
    outputMint: trade.to.address,
    inputAmount,
    outputAmount,
    pricePerToken: sol / quantity,
    pricePerTokenUsd: unitUsd > 0 && Number.isFinite(unitUsd) ? unitUsd : null,
    timestamp,
    createdAt: new Date(timestamp).toISOString(),
  };
}

function mergeWalletTrades(heliusTrades, indexedTrades) {
  const bySignature = new Map();
  for (const trade of [...heliusTrades, ...indexedTrades]) {
    if (trade?.signature) bySignature.set(trade.signature, trade);
  }
  return [...bySignature.values()].sort((a, b) => b.timestamp - a.timestamp);
}

module.exports = { normalizeIndexedTrade, mergeWalletTrades };
