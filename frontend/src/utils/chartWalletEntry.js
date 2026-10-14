export function selectChartWallet(connectedWallet, tradingWallet, instantEnabled) {
  return instantEnabled && tradingWallet ? tradingWallet : connectedWallet || tradingWallet || null;
}

export function confirmedEntryPrice(balance, localPosition, indexedPosition) {
  if (!(Number(balance?.amount) > 0)) return null;
  const local = Number(localPosition?.averagePriceUsd);
  if (Number(localPosition?.quantity) > 0 && local > 0) return local;
  const indexed = Number(indexedPosition?.avgCostUsd);
  return indexed > 0 ? indexed : null;
}
