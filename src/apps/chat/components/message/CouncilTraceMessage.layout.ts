export function getCouncilTraceBoardScrollerSx(cardCount: number) {
  return {
    overflowX: cardCount > 3 ? 'auto' : 'visible',
    pb: cardCount > 3 ? 0.5 : 0,
  } as const;
}

export function getCouncilTraceBoardGridSx(cardCount: number) {
  if (cardCount > 3) {
    return {
      display: 'grid',
      gap: 1,
      alignItems: 'start',
      gridAutoFlow: 'column',
      gridAutoColumns: 'minmax(16rem, 1fr)',
      minWidth: 'max-content',
    } as const;
  }

  return {
    display: 'grid',
    gap: 1,
    alignItems: 'start',
    gridTemplateColumns: {
      xs: '1fr',
      md: `repeat(${cardCount}, minmax(0, 1fr))`,
    },
  } as const;
}

export function getCouncilTraceStatusTone(status: 'accepted' | 'reviewing' | 'awaiting-leader-revision' | 'interrupted' | 'exhausted') {
  if (status === 'accepted')
    return 'success' as const;
  if (status === 'interrupted')
    return 'warning' as const;
  if (status === 'exhausted')
    return 'danger' as const;
  if (status === 'reviewing')
    return 'primary' as const;
  return 'neutral' as const;
}
