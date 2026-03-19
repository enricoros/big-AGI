export function getNextAutoExpandedCouncilGroupKeys(params: {
  previousLatestCouncilGroupKey: string | null;
  latestCouncilGroupKey: string | null;
  showCouncilDeliberation: boolean;
  hasCouncilTrace: boolean;
}): Set<string> | null {
  const {
    previousLatestCouncilGroupKey,
    latestCouncilGroupKey,
    showCouncilDeliberation,
    hasCouncilTrace,
  } = params;

  if (!showCouncilDeliberation || hasCouncilTrace || !latestCouncilGroupKey)
    return null;

  if (previousLatestCouncilGroupKey === latestCouncilGroupKey)
    return null;

  return new Set([latestCouncilGroupKey]);
}

export function getCouncilGroupLabel(passIndex: number | null | undefined): string {
  return typeof passIndex === 'number' ? `Round ${passIndex + 1}` : '';
}
