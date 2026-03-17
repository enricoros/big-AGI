import * as React from 'react';

import { Box, Button, Chip, Divider, ListItem, Typography } from '@mui/joy';

import type { CouncilTraceRenderItem, CouncilTraceReviewerCard, CouncilTraceRoundItem } from '../ChatMessageList.councilTrace';

import {
  getCouncilTraceBoardGridSx,
  getCouncilTraceBoardScrollerSx,
  getCouncilTraceStatusTone,
} from './CouncilTraceMessage.layout';


function getCouncilTraceSummaryLabel(trace: CouncilTraceRenderItem): string {
  switch (trace.summaryStatus) {
    case 'accepted':
      return 'Accepted';
    case 'reviewing':
      return 'Reviewing';
    case 'awaiting-leader-revision':
      return 'Awaiting leader revision';
    case 'interrupted':
      return 'Interrupted';
    case 'exhausted':
      return 'Exhausted';
  }
}

function getRoundSummary(round: CouncilTraceRoundItem): string {
  const rejectCount = round.reviewerCards.filter(card => card.decision === 'reject').length;
  const acceptCount = round.reviewerCards.filter(card => card.decision === 'accept').length;
  const pendingCount = round.reviewerCards.filter(card => card.decision === 'pending').length;

  if (rejectCount)
    return rejectCount === 1 ? '1 rejection' : `${rejectCount} rejections`;
  if (pendingCount)
    return pendingCount === 1 ? '1 review pending' : `${pendingCount} reviews pending`;
  if (acceptCount)
    return acceptCount === round.reviewerCards.length
      ? 'Accepted unanimously'
      : `${acceptCount} acceptances`;
  return 'Awaiting review';
}

function getDecisionTone(decision: CouncilTraceReviewerCard['decision']) {
  switch (decision) {
    case 'accept':
      return 'success' as const;
    case 'reject':
      return 'danger' as const;
    case 'pending':
      return 'warning' as const;
  }
}

function getDecisionLabel(decision: CouncilTraceReviewerCard['decision']) {
  switch (decision) {
    case 'accept':
      return 'Accept';
    case 'reject':
      return 'Reject';
    case 'pending':
      return 'Pending';
  }
}

export function CouncilTraceMessage(props: {
  trace: CouncilTraceRenderItem;
  defaultExpanded?: boolean;
  defaultExpandedRoundIndexes?: number[];
}) {
  const { trace, defaultExpanded = false, defaultExpandedRoundIndexes } = props;
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [expandedRounds, setExpandedRounds] = React.useState(() => new Set(
    defaultExpandedRoundIndexes ?? trace.rounds
      .filter(round => round.defaultExpanded)
      .map(round => round.roundIndex),
  ));

  const toggleRound = React.useCallback((roundIndex: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundIndex))
        next.delete(roundIndex);
      else
        next.add(roundIndex);
      return next;
    });
  }, []);

  const summaryLabel = getCouncilTraceSummaryLabel(trace);
  const latestRound = trace.rounds[0] ?? null;
  const latestRoundText = latestRound
    ? `Round ${latestRound.roundIndex + 1} ${getRoundSummary(latestRound).toLowerCase()}`
    : 'No rounds recorded';

  return (
    <ListItem sx={{ display: 'block', px: 0, py: 0.75 }}>
      <Box
        sx={{
          mx: 2,
          borderRadius: 'lg',
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.level1',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'grid', gap: 1, p: 1.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              <Typography level='title-sm'>Council trace</Typography>
              <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
                {latestRoundText}
              </Typography>
            </Box>

            <Button
              size='sm'
              variant={expanded ? 'solid' : 'soft'}
              color='neutral'
              onClick={() => setExpanded(value => !value)}
            >
              {expanded ? 'Hide workflow' : 'Show workflow'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip size='sm' variant='soft' color={getCouncilTraceStatusTone(trace.summaryStatus)}>
              {summaryLabel}
            </Chip>
            <Chip size='sm' variant='soft' color='neutral'>
              {trace.totalRounds} round{trace.totalRounds === 1 ? '' : 's'}
            </Chip>
            <Chip size='sm' variant='soft' color='neutral'>
              {trace.reviewerCount} reviewer{trace.reviewerCount === 1 ? '' : 's'}
            </Chip>
          </Box>
        </Box>

        {expanded && (
          <>
            <Divider />
            <Box sx={{ display: 'grid', gap: 1, p: 1.25 }}>
              {trace.rounds.map(round => {
                const boardCardCount = 1 + round.reviewerCards.length;
                const roundExpanded = expandedRounds.has(round.roundIndex);

                return (
                  <Box
                    key={`council-trace-round-${round.roundIndex}`}
                    sx={{
                      borderRadius: 'md',
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'background.surface',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', alignItems: 'center', p: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography level='title-sm'>Round {round.roundIndex + 1}</Typography>
                        <Chip size='sm' variant='soft' color='neutral'>
                          {getRoundSummary(round)}
                        </Chip>
                      </Box>

                      <Button
                        size='sm'
                        variant={roundExpanded ? 'solid' : 'soft'}
                        color='neutral'
                        onClick={() => toggleRound(round.roundIndex)}
                      >
                        {roundExpanded ? 'Collapse round' : 'Expand round'}
                      </Button>
                    </Box>

                    {roundExpanded && (
                      <>
                        <Divider />
                        <Box sx={{ display: 'grid', gap: 1, p: 1 }}>
                          <Box sx={getCouncilTraceBoardScrollerSx(boardCardCount)}>
                            <Box sx={getCouncilTraceBoardGridSx(boardCardCount)}>
                              <Box sx={agentCardSx}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <Typography level='title-sm'>{round.leaderParticipantName}</Typography>
                                  <Chip size='sm' variant='solid' color='primary'>Leader proposal</Chip>
                                </Box>
                                <Typography level='body-sm' sx={{ whiteSpace: 'pre-wrap' }}>
                                  {round.proposalText || 'Proposal pending.'}
                                </Typography>
                              </Box>

                              {round.reviewerCards.map(reviewerCard => (
                                <Box key={`round-${round.roundIndex}-reviewer-${reviewerCard.participantId}`} sx={agentCardSx}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Typography level='title-sm'>{reviewerCard.participantName}</Typography>
                                    <Chip size='sm' variant='soft' color={getDecisionTone(reviewerCard.decision)}>
                                      {getDecisionLabel(reviewerCard.decision)}
                                    </Chip>
                                  </Box>

                                  {reviewerCard.reason ? (
                                    <Box
                                      sx={{
                                        borderRadius: 'md',
                                        backgroundColor: 'background.level1',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        px: 1,
                                        py: 0.75,
                                      }}
                                    >
                                      <Typography level='body-sm' sx={{ whiteSpace: 'pre-wrap' }}>
                                        {reviewerCard.reason}
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
                                      {reviewerCard.decision === 'accept' ? 'Approved this proposal.' : 'Waiting for reviewer ballot.'}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          </Box>

                          {round.sharedReasons && (
                            <Box
                              sx={{
                                borderRadius: 'md',
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'background.level1',
                                p: 1,
                                display: 'grid',
                                gap: 0.75,
                              }}
                            >
                              <Typography level='title-sm'>{round.sharedReasons.label}</Typography>
                              <Box component='ol' sx={{ m: 0, pl: 2, display: 'grid', gap: 0.5 }}>
                                {round.sharedReasons.reasons.map((reason, index) => (
                                  <Typography key={`round-${round.roundIndex}-reason-${index}`} component='li' level='body-sm' sx={{ whiteSpace: 'pre-wrap' }}>
                                    {reason}
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </Box>
    </ListItem>
  );
}

const agentCardSx = {
  display: 'grid',
  gap: 1,
  minWidth: 0,
  borderRadius: 'md',
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.surface',
  p: 1,
} as const;
