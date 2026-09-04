export function formatModelsCost(cost: number) {
  return cost < 1
    ? `${(cost * 100).toFixed(cost < 0.010 ? 2 : 2)} ¢`
    : `$ ${cost.toFixed(2)}`;
}

/** USD -> cents, 4 decimals (the metrics' $c unit) */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100 * 10000) / 10000;
}
