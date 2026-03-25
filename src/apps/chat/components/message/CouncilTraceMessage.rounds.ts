export function getNextAutoExpandedRounds(args: {
  previousExpandedRounds: ReadonlySet<number>;
  latestRoundIndex: number | null;
  autoCollapsePreviousRounds: boolean;
  autoExpandNewestRound: boolean;
  manuallyExpandedRounds: ReadonlySet<number>;
}): Set<number> {
  if (args.latestRoundIndex === null)
    return new Set(args.previousExpandedRounds);

  const next = new Set(args.previousExpandedRounds);
  if (args.autoCollapsePreviousRounds) {
    for (const roundIndex of [...next]) {
      if (roundIndex !== args.latestRoundIndex && !args.manuallyExpandedRounds.has(roundIndex))
        next.delete(roundIndex);
    }
  }
  if (args.autoExpandNewestRound)
    next.add(args.latestRoundIndex);
  return next;
}
