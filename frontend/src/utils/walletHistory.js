// Pure helpers for the profile history grid — no app imports so they run
// under plain Node for tests.

const fmtUsdShort = (n) => {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toFixed(abs >= 100 ? 0 : 2)}`;
};

const toMs = (t) => (Number(t) > 0 ? (Number(t) < 1e12 ? Number(t) * 1000 : Number(t)) : 0);

// Upstream indexing lags a little behind a swap we just made.
const INDEX_LAG_MS = 60_000;

/**
 * Builds the own-profile history grid: one tile per coin, every on-chain
 * position first (full wallet history with PnL), then any Moonfeed-recorded
 * swap the positions feed doesn't know about yet. Newest activity first.
 *
 * @param {Array} positions      normalized rows from /api/wallet/:w/positions
 * @param {Array} transactions   local Moonfeed swap records (transactionStorage)
 * @param {Map}   positionPnl    mint -> { pnlTotal, holding, image } fallback PnL
 */
export function buildHistoryItems(positions = [], transactions = [], positionPnl = new Map()) {
  const byMint = new Map();
  for (const p of positions) {
    if (!p?.mint) continue;
    const lastBuy = toMs(p.lastBuy);
    const lastSell = toMs(p.lastSell);
    const soldLast = lastSell > 0 && lastSell >= lastBuy;
    const invested = Number(p.invested) || 0;
    const proceeds = Number(p.proceeds) || 0;
    byMint.set(p.mint, {
      key: p.mint,
      tokenMint: p.mint,
      tokenSymbol: p.symbol || 'Unknown',
      tokenName: p.name || p.symbol || 'Unknown',
      tokenImage: p.image || null,
      type: soldLast ? 'sell' : 'buy',
      holding: Boolean(p.holding),
      pnlUsd: Number.isFinite(Number(p.pnl?.total)) ? Number(p.pnl.total) : null,
      sub: p.holding
        ? (invested > 0 ? `${fmtUsdShort(invested)} in` : null)
        : (proceeds > 0 ? `${fmtUsdShort(proceeds)} out` : (invested > 0 ? `${fmtUsdShort(invested)} in` : null)),
      timestamp: toMs(p.lastTrade) || Math.max(lastBuy, lastSell),
      trades: Number(p.counts?.total) || 0,
    });
  }
  for (const tx of transactions) {
    if (!tx?.tokenMint) continue;
    const ts = toMs(tx.timestamp);
    const type = tx.type === 'sell' ? 'sell' : 'buy';
    const existing = byMint.get(tx.tokenMint);
    if (existing) {
      if (ts > (existing.timestamp || 0) + INDEX_LAG_MS) {
        existing.timestamp = ts;
        existing.type = type;
        if (!existing.tokenImage && tx.tokenImage) existing.tokenImage = tx.tokenImage;
      }
      continue;
    }
    const pos = positionPnl.get(tx.tokenMint);
    const solAmt = type === 'sell' ? Number(tx.outputAmount || 0) : Number(tx.inputAmount || 0);
    byMint.set(tx.tokenMint, {
      key: tx.tokenMint,
      tokenMint: tx.tokenMint,
      tokenSymbol: tx.tokenSymbol || 'Unknown',
      tokenName: tx.tokenName || tx.tokenSymbol || 'Unknown',
      tokenImage: tx.tokenImage || pos?.image || null,
      type,
      holding: pos ? Boolean(pos.holding) : type !== 'sell',
      pnlUsd: Number.isFinite(pos?.pnlTotal) ? pos.pnlTotal : null,
      sub: solAmt > 0 ? `${type === 'sell' ? '+' : '−'}${solAmt >= 0.01 ? solAmt.toFixed(2) : solAmt.toFixed(3)} SOL` : null,
      timestamp: ts,
      trades: 1,
    });
  }
  return [...byMint.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
