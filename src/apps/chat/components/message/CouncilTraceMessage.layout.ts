export function getCouncilTraceLeaderRowSx() {
  return {
    display: 'flex',
    justifyContent: 'center',
  } as const;
}

export function getCouncilTraceReviewerRowScrollerSx() {
  return {
    overflowX: 'auto',
    pb: 0.5,
  } as const;
}

export function getCouncilTraceReviewerRowSx(_cardCount: number) {
  return {
    display: 'grid',
    gap: 1,
    alignItems: 'start',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(18rem, 22rem)',
    minWidth: 'max-content',
  } as const;
}

export function getCouncilTraceAgentCardSx(role: 'leader' | 'reviewer') {
  return {
    display: 'grid',
    gap: 1,
    width: role === 'leader' ? '100%' : '22rem',
    maxWidth: role === 'leader' ? '46rem' : '22rem',
    minWidth: role === 'leader' ? 0 : '18rem',
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.surface',
    p: 1,
  } as const;
}

export function getCouncilTraceStatusTone(status: 'accepted' | 'reviewing' | 'awaiting-leader-revision' | 'interrupted' | 'stopped' | 'exhausted') {
  if (status === 'accepted')
    return 'success' as const;
  if (status === 'interrupted')
    return 'warning' as const;
  if (status === 'stopped')
    return 'danger' as const;
  if (status === 'exhausted')
    return 'danger' as const;
  if (status === 'reviewing')
    return 'primary' as const;
  return 'neutral' as const;
}
