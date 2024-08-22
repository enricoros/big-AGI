export function formatModelsCost(cost: number) {
  return cost < 1
    ? `${(cost * 100).toFixed(cost < 0.010 ? 2 : 2)} ¢`
    : `$ ${cost.toFixed(2)}`;
}