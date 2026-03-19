export function getCouncilTraceLeaderRowSx() {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    justifyItems: 'center',
  } as const;
}

export function getCouncilTraceReviewerRowScrollerSx() {
  return {
    overflowX: 'auto',
    mx: { xs: -0.25, md: 0 },
    pb: 0.5,
    scrollbarWidth: 'thin',
  } as const;
}

export function getCouncilTraceReviewerRowSx(_cardCount: number) {
  return {
    display: 'grid',
    gap: 1,
    alignItems: 'start',
    gridAutoFlow: { xs: 'row', md: 'column' },
    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'none' },
    gridAutoColumns: { md: 'minmax(18rem, 22rem)' },
    minWidth: { xs: 0, md: 'max-content' },
  } as const;
}

export function getCouncilTraceAgentCardSx(role: 'leader' | 'reviewer') {
  return {
    '--trace-card-accentBg': role === 'leader'
      ? 'rgba(var(--joy-palette-primary-mainChannel) / 0.12)'
      : 'rgba(var(--joy-palette-neutral-mainChannel) / 0.08)',
    '--trace-card-accentBorder': role === 'leader'
      ? 'var(--joy-palette-primary-outlinedBorder)'
      : 'rgba(var(--joy-palette-neutral-mainChannel) / 0.16)',
    display: 'grid',
    gap: 1,
    position: 'relative',
    width: '100%',
    maxWidth: role === 'leader' ? '48rem' : '22rem',
    minWidth: role === 'leader' ? 0 : { xs: 0, md: '18rem' },
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'var(--trace-card-accentBorder)',
    background: 'linear-gradient(180deg, var(--trace-card-accentBg) 0%, var(--joy-palette-background-surface) 44%)',
    boxShadow: 'sm',
    p: 1.1,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0 auto 0 0',
      width: '0.25rem',
      borderTopLeftRadius: 'inherit',
      borderBottomLeftRadius: 'inherit',
      background: role === 'leader'
        ? 'var(--joy-palette-primary-solidBg)'
        : 'rgba(var(--joy-palette-neutral-mainChannel) / 0.55)',
    },
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
