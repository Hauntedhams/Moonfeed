export function includeTradeLevels(baseInfo, levels) {
  if (!baseInfo?.priceRange) return baseInfo;
  const prices = levels.map(Number).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) return baseInfo;
  const min = Math.min(baseInfo.priceRange.minValue, ...prices);
  const max = Math.max(baseInfo.priceRange.maxValue, ...prices);
  const pad = (max - min) * 0.12 || max * 0.05;
  return {
    ...baseInfo,
    priceRange: { minValue: Math.max(0, min - pad), maxValue: max + pad },
  };
}
