import * as React from 'react';

import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import { Box, Button, Checkbox, Chip, Divider, ListItem, Typography } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';

import { PerfProfiler } from '~/common/components/perf/PerfProfiler';
import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { useFragmentBuckets } from '~/common/stores/chat/hooks/useFragmentBuckets';
import { preloadMarkdownRenderer, RenderMarkdown } from '~/modules/blocks/markdown/RenderMarkdown';
import type {
  CouncilTraceAgentCard,
  CouncilTraceAgentDetailItem,
  CouncilTraceRenderItem,
  CouncilTraceReviewerCard,
  CouncilTraceRoundItem,
} from '../ChatMessageList.councilTrace';

import {
  getCouncilTraceAgentCardSx,
  getCouncilTraceLeaderRowSx,
  getCouncilTraceReviewerRowScrollerSx,
  getCouncilTraceReviewerRowSx,
  getCouncilTraceStatusTone,
} from './CouncilTraceMessage.layout';
import { getNextAutoExpandedRounds } from './CouncilTraceMessage.rounds';
import { ContentFragments } from './fragments-content/ContentFragments';
import { DocumentAttachmentFragments } from './fragments-attachment-doc/DocumentAttachmentFragments';
import { ImageAttachmentFragments } from './fragments-attachment-image/ImageAttachmentFragments';
import { VoidFragments } from './fragments-void/VoidFragments';

const COUNCIL_ACCEPT_LABEL = 'Accept()';
const COUNCIL_IMPROVE_LABEL = 'Improve()';

if (typeof window !== 'undefined')
  preloadMarkdownRenderer();


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
    case 'stopped':
      return 'Stopped';
    case 'exhausted':
      return 'Exhausted';
  }
}

function getRoundSummary(round: CouncilTraceRoundItem): string {
  if (round.leaderProposalFailed)
    return 'Proposal failed';
  if ('reviewerPlanProgress' in round && round.phase === 'leader-proposal')
    return 'Leader drafting proposal';
  if ('reviewerPlanProgress' in round && round.phase === 'reviewer-plans')
    return `${round.reviewerPlanProgress.completed}/${round.reviewerPlanProgress.total} reviewer analyses`;
  if ('reviewerVoteProgress' in round && round.phase === 'reviewer-votes' && !round.reviewerVoteProgress.isShared)
    return `${round.reviewerVoteProgress.completed}/${round.reviewerVoteProgress.total} reviewer reviews`;

  const reviewerCards = round.reviewerCards ?? round.reviewerVoteCards ?? [];
  let rejectCount = 0;
  let acceptCount = 0;
  let pendingCount = 0;

  for (const card of reviewerCards) {
    if (card.decision === 'reject')
      rejectCount++;
    else if (card.decision === 'accept')
      acceptCount++;
    else
      pendingCount++;
  }

  if (rejectCount)
    return rejectCount === 1 ? '1 improvement request' : `${rejectCount} improvement requests`;
  if (pendingCount)
    return pendingCount === 1 ? '1 review pending' : `${pendingCount} reviews pending`;
  if (acceptCount)
    return acceptCount === reviewerCards.length
      ? 'Accepted unanimously'
      : `${acceptCount} acceptances`;
  return 'Awaiting review';
}

function getRoundSummaryTone(round: CouncilTraceRoundItem): 'neutral' | 'danger' {
  return round.leaderProposalFailed ? 'danger' : 'neutral';
}

function getRoundLeadSummary(
  round: CouncilTraceRoundItem,
  proposalCard: CouncilTraceAgentCard | null,
  reviewerReviewCardsCount: number,
): string {
  if (round.leaderProposalFailed)
    return 'Leader failed before reviewer review began.';

  if (proposalCard) {
    return `${proposalCard.participantName} leads this round${reviewerReviewCardsCount ? ` with ${reviewerReviewCardsCount} reviewer${reviewerReviewCardsCount === 1 ? '' : 's'}` : ''}.`;
  }

  if (reviewerReviewCardsCount)
    return `${reviewerReviewCardsCount} reviewer${reviewerReviewCardsCount === 1 ? '' : 's'} active in this round.`;

  return 'Waiting for round details.';
}

function getRoundDecisionCounts(round: CouncilTraceRoundItem) {
  const reviewerCards = round.reviewerCards ?? round.reviewerVoteCards ?? [];
  let rejectCount = 0;
  let acceptCount = 0;
  let pendingCount = 0;

  for (const card of reviewerCards) {
    if (card.decision === 'reject')
      rejectCount++;
    else if (card.decision === 'accept')
      acceptCount++;
    else
      pendingCount++;
  }

  return { rejectCount, acceptCount, pendingCount };
}

function getReviewerDecisionTone(decision: CouncilTraceReviewerCard['decision']) {
  switch (decision) {
    case 'accept':
      return 'success' as const;
    case 'reject':
      return 'danger' as const;
    case 'pending':
      return 'warning' as const;
  }
}

function isSyntheticReviewerFailureCard(card: CouncilTraceAgentCard | CouncilTraceReviewerCard): boolean {
  return isReviewerCard(card) && (
    card.terminalLabel === 'Missing verdict'
    || card.terminalLabel === 'Missing analysis'
    || card.terminalLabel === 'Review failed'
  );
}

function getAgentStatusTone(status: CouncilTraceAgentCard['status']) {
  switch (status) {
    case 'proposal-ready':
      return 'primary' as const;
    case 'accepted':
      return 'success' as const;
    case 'rejected':
      return 'danger' as const;
    case 'failed':
      return 'danger' as const;
    case 'waiting':
      return 'warning' as const;
  }
}

function getAgentStatusLabel(card: CouncilTraceAgentCard): string {
  return card.terminalLabel ?? (
    card.status === 'proposal-ready'
      ? 'Proposal ready'
      : card.status === 'accepted'
        ? COUNCIL_ACCEPT_LABEL
        : card.status === 'rejected'
          ? COUNCIL_IMPROVE_LABEL
          : card.status === 'failed'
            ? 'Proposal failed'
          : 'Waiting'
  );
}

function getAgentRoleLabel(card: CouncilTraceAgentCard | CouncilTraceReviewerCard): string {
  if (card.role === 'leader')
    return card.status === 'failed' ? 'Leader failure' : 'Leader proposal';

  if (!isReviewerCard(card))
    return 'Reviewer analysis';

  if (isSyntheticReviewerFailureCard(card))
    return 'Reviewer failure';

  if (card.decision === 'reject')
    return 'Reviewer improvement request';
  if (card.decision === 'accept')
    return 'Reviewer approval';
  return 'Reviewer analysis';
}

function getAgentSummaryLabel(card: CouncilTraceAgentCard | CouncilTraceReviewerCard, showRejectReason: boolean): string {
  if (showRejectReason)
    return 'Improvement request';
  if (card.status === 'failed' || isSyntheticReviewerFailureCard(card))
    return 'Failure note';
  return card.role === 'leader' ? 'Draft snapshot' : 'Review note';
}

function getAgentPersistenceBadge(
  card: CouncilTraceAgentCard | CouncilTraceReviewerCard,
  hasVisibleContent: boolean,
): { label: 'Persisted' | 'Streaming'; color: 'success' | 'warning' } | null {
  if (card.status === 'failed' && card.messageFragments.length === 0)
    return null;
  if (isSyntheticReviewerFailureCard(card) && card.messageFragments.length === 0)
    return null;

  const shouldShowBadge = hasVisibleContent || card.status !== 'waiting';
  if (!shouldShowBadge)
    return null;

  return card.messagePendingIncomplete
    ? { label: 'Streaming', color: 'warning' }
    : { label: 'Persisted', color: 'success' };
}

function isReviewerCard(card: CouncilTraceAgentCard | CouncilTraceReviewerCard): card is CouncilTraceReviewerCard {
  return 'decision' in card;
}

const noAgentDetailItems: CouncilTraceAgentDetailItem[] = [];
const councilTraceMarkdownSx: SxProps = {
  marginInline: '0 !important',
  fontSize: 'var(--joy-fontSize-sm)',
  lineHeight: 'var(--joy-lineHeight-md)',
  '& > :first-of-type': { marginTop: 0 },
  '& > :last-child': { marginBottom: 0 },
};

function CouncilTraceMarkdownText(props: {
  content: string;
  sx?: SxProps;
}) {
  if (typeof window === 'undefined') {
    return (
      <Box sx={props.sx}>
        <Typography
          level='body-sm'
          aria-hidden='true'
          sx={{
            whiteSpace: 'pre-wrap',
            visibility: 'hidden',
          }}
        >
          {props.content}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={props.sx}>
      <RenderMarkdown
        content={props.content}
        sx={councilTraceMarkdownSx}
      />
    </Box>
  );
}

function CouncilTraceLabeledCallout(props: {
  label: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  const tone = props.tone ?? 'neutral';

  return (
    <Box
      sx={{
        borderRadius: 'md',
        border: '1px solid',
        borderColor: tone === 'danger' ? 'danger.outlinedBorder' : 'divider',
        backgroundColor: tone === 'danger' ? 'danger.softBg' : 'background.level1',
        px: 1,
        py: 0.9,
        display: 'grid',
        gap: 0.6,
      }}
    >
      <Typography
        level='body-xs'
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 'lg',
          color: tone === 'danger' ? 'danger.plainColor' : 'text.tertiary',
        }}
      >
        {props.label}
      </Typography>
      {props.children}
    </Box>
  );
}

function CouncilTraceRoundToggleButton(props: {
  roundExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size='sm'
      variant={props.roundExpanded ? 'solid' : 'soft'}
      color='neutral'
      endDecorator={props.roundExpanded ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowRightRoundedIcon />}
      onClick={props.onToggle}
    >
      {props.roundExpanded ? 'Collapse round' : 'Expand round'}
    </Button>
  );
}

function CouncilTraceAgentMessageBody(props: {
  fragments: CouncilTraceAgentCard['messageFragments'];
  messagePendingIncomplete: boolean;
}) {
  const {
    annotationFragments,
    interleavedFragments,
    imageAttachments,
    nonImageAttachments,
  } = useFragmentBuckets(props.fragments);

  if (!props.fragments.length)
    return null;

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {annotationFragments.length >= 1 && (
        <VoidFragments
          voidFragments={annotationFragments}
          nonVoidFragmentsCount={interleavedFragments.filter(fragment => fragment.ft === 'content').length}
          contentScaling='sm'
          uiComplexityMode='pro'
          messageRole='assistant'
          messagePendingIncomplete={props.messagePendingIncomplete}
        />
      )}

      {imageAttachments.length >= 1 && (
        <ImageAttachmentFragments
          imageAttachments={imageAttachments}
          contentScaling='sm'
          messageRole='assistant'
          disabled
        />
      )}

      <ContentFragments
        contentFragments={interleavedFragments}
        showEmptyNotice={false}
        contentScaling='sm'
        uiComplexityMode='pro'
        fitScreen={false}
        isMobile={false}
        messageRole='assistant'
        messagePendingIncomplete={props.messagePendingIncomplete}
        optiAllowSubBlocksMemo={false}
        disableMarkdownText={false}
        textEditsState={null}
        onEditsApply={() => {}}
        onEditsCancel={() => {}}
      />

      {nonImageAttachments.length >= 1 && (
        <DocumentAttachmentFragments
          attachmentFragments={nonImageAttachments}
          messageRole='assistant'
          contentScaling='sm'
          isMobile={false}
          zenMode={false}
          allowSelection
          disableMarkdownText={false}
        />
      )}
    </Box>
  );
}

function renderAgentDetailItems(detailItems: readonly CouncilTraceAgentDetailItem[], participantId: string) {
  if (!detailItems.length)
    return null;

  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      {detailItems.map((detailItem, index) => (
        detailItem.type === 'text-output' ? (
          <Box
            key={`${participantId}-detail-text-${index}`}
            sx={{
              borderRadius: 'md',
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.level1',
              px: 1,
              py: 0.75,
            }}
          >
            <CouncilTraceMarkdownText content={detailItem.text} />
          </Box>
        ) : (
          <Box
            key={`${participantId}-detail-terminal-${index}`}
            sx={{
              borderRadius: 'md',
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.level1',
              px: 1,
              py: 0.75,
              display: 'grid',
              gap: 0.5,
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size='sm' variant='soft' color={detailItem.action === 'proposal' ? 'primary' : detailItem.action === 'accept' ? 'success' : 'danger'}>
                {detailItem.action === 'proposal' ? 'Proposal ready' : detailItem.action === 'accept' ? COUNCIL_ACCEPT_LABEL : COUNCIL_IMPROVE_LABEL}
              </Chip>
            </Box>
            {!!detailItem.text && (
              <CouncilTraceMarkdownText content={detailItem.text} />
            )}
            {!!detailItem.reason && (
              <CouncilTraceMarkdownText content={detailItem.reason} />
            )}
          </Box>
        )
      ))}
    </Box>
  );
}

function normalizeCouncilTraceCardText(text: string | null | undefined): string | null {
  const normalizedText = text?.trim();
  return normalizedText ? normalizedText : null;
}

function hasStructuredDetailsToReveal(
  card: CouncilTraceAgentCard | CouncilTraceReviewerCard,
  visibleTexts: ReadonlySet<string>,
): boolean {
  return card.messageFragments.some(fragment => {
    if (!isTextContentFragment(fragment))
      return true;

    const fragmentText = normalizeCouncilTraceCardText(fragment.part.text);
    return !!fragmentText && !visibleTexts.has(fragmentText);
  });
}

function cardHasStructuredTextFragment(
  card: CouncilTraceAgentCard | CouncilTraceReviewerCard,
  text: string | null,
): boolean {
  if (!text)
    return false;

  return card.messageFragments.some(fragment => (
    isTextContentFragment(fragment) &&
    normalizeCouncilTraceCardText(fragment.part.text) === text
  ));
}

function getStructuredVisibleTexts(card: CouncilTraceAgentCard | CouncilTraceReviewerCard): Set<string> {
  const texts = new Set<string>();

  for (const fragment of card.messageFragments) {
    if (!isTextContentFragment(fragment))
      continue;

    const fragmentText = normalizeCouncilTraceCardText(fragment.part.text);
    if (fragmentText)
      texts.add(fragmentText);
  }

  return texts;
}

function filterVisibleDuplicateDetailItems(
  detailItems: readonly CouncilTraceAgentDetailItem[],
  visibleTexts: ReadonlySet<string>,
): CouncilTraceAgentDetailItem[] {
  return detailItems.filter(detailItem => {
    if (detailItem.type === 'text-output')
      return !visibleTexts.has(normalizeCouncilTraceCardText(detailItem.text) ?? '');

    const detailText = normalizeCouncilTraceCardText(detailItem.text);
    const detailReason = normalizeCouncilTraceCardText(detailItem.reason);
    const hasHiddenText = !!detailText && !visibleTexts.has(detailText);
    const hasHiddenReason = !!detailReason && !visibleTexts.has(detailReason);
    return hasHiddenText || hasHiddenReason;
  });
}

function CouncilTraceAgentCardView(props: {
  roundIndex: number;
  card: CouncilTraceAgentCard | CouncilTraceReviewerCard;
  defaultExpanded: boolean;
}) {
  const { roundIndex, card } = props;
  const hasStructuredMessage = card.messageFragments.length > 0;
  const rejectReason = isReviewerCard(card) && card.decision === 'reject'
    ? card.reason
    : null;
  const showRejectReason = !!rejectReason;
  const showRejectReasonBox = showRejectReason && rejectReason !== card.excerpt;
  const visibleTexts = React.useMemo(() => {
    const texts = new Set<string>();
    const excerptText = normalizeCouncilTraceCardText(card.excerpt);
    if (excerptText)
      texts.add(excerptText);
    const rejectReasonText = showRejectReasonBox ? normalizeCouncilTraceCardText(rejectReason) : null;
    if (rejectReasonText)
      texts.add(rejectReasonText);
    return texts;
  }, [card.excerpt, rejectReason, showRejectReasonBox]);
  const structuredVisibleTexts = React.useMemo(() => hasStructuredMessage ? getStructuredVisibleTexts(card) : new Set<string>(), [card, hasStructuredMessage]);
  const showDetails = card.hasDetails && (!hasStructuredMessage || hasStructuredDetailsToReveal(card, visibleTexts));
  const excerptText = normalizeCouncilTraceCardText(card.excerpt);
  const hideExcerptAsDuplicate = hasStructuredMessage && showDetails && cardHasStructuredTextFragment(card, excerptText);
  const showExcerpt = !!excerptText && !hideExcerptAsDuplicate;
  const persistenceBadge = React.useMemo(() => getAgentPersistenceBadge(card, showExcerpt || showRejectReasonBox || showDetails), [card, showDetails, showExcerpt, showRejectReasonBox]);
  const detailItems = React.useMemo(() => {
    if (!showDetails)
      return noAgentDetailItems;

    const renderedTexts = new Set(visibleTexts);
    if (hasStructuredMessage)
      structuredVisibleTexts.forEach(text => renderedTexts.add(text));

    return filterVisibleDuplicateDetailItems(card.detailItems, renderedTexts);
  }, [card, hasStructuredMessage, showDetails, structuredVisibleTexts, visibleTexts]);

  return (
    <PerfProfiler id='CouncilTraceAgentCardView'>
      <Box sx={getCouncilTraceAgentCardSx(card.role)}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.75, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'grid', gap: 0.2 }}>
            <Typography
              level='body-xs'
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 'lg',
                color: card.role === 'leader' ? 'primary.plainColor' : 'text.tertiary',
              }}
            >
              {getAgentRoleLabel(card)}
            </Typography>
            <Typography level='title-sm'>{card.participantName}</Typography>
            {(card.participantModelLabel || card.participantReasoningLabel) && (
              <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
                {[card.participantModelLabel, card.participantReasoningLabel].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip size='sm' variant='soft' color={getAgentStatusTone(card.status)}>
              {getAgentStatusLabel(card)}
            </Chip>
            {persistenceBadge && (
              <Chip size='sm' variant='soft' color={persistenceBadge.color}>
                {persistenceBadge.label}
              </Chip>
            )}
          </Box>
        </Box>

        {showExcerpt ? (
          <CouncilTraceLabeledCallout label={getAgentSummaryLabel(card, false)}>
            <CouncilTraceMarkdownText content={excerptText!} />
          </CouncilTraceLabeledCallout>
        ) : !showRejectReason && !showDetails ? (
          <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
            {card.status === 'waiting' ? 'Waiting for output.' : 'No visible output.'}
          </Typography>
        ) : null}

        {showRejectReasonBox && rejectReason && (
          <CouncilTraceLabeledCallout label={getAgentSummaryLabel(card, true)} tone='danger'>
            <CouncilTraceMarkdownText content={rejectReason} />
          </CouncilTraceLabeledCallout>
        )}

        {showDetails && (
          <Box
            key={`agent-details-${roundIndex}-${card.participantId}`}
            sx={{
              display: 'grid',
              gap: 0.75,
              borderRadius: 'md',
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.surface',
              p: 0.9,
            }}
          >
            <Typography
              level='body-xs'
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 'lg',
                color: 'text.tertiary',
              }}
            >
              Structured trace
            </Typography>
            {hasStructuredMessage && (
              <CouncilTraceAgentMessageBody
                fragments={card.messageFragments}
                messagePendingIncomplete={card.messagePendingIncomplete}
              />
            )}
            {detailItems.length > 0 && (
              renderAgentDetailItems(detailItems, card.participantId)
            )}
          </Box>
        )}
      </Box>
    </PerfProfiler>
  );
}

function CouncilTraceSection(props: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <Typography level='title-sm'>{props.title}</Typography>
      {props.children}
    </Box>
  );
}

function CouncilTracePreferenceToggle(props: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: props.checked ? 'primary.softBorder' : 'divider',
        backgroundColor: props.checked ? 'primary.softBg' : 'background.level1',
        boxShadow: 'xs',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        px: 1,
        py: 0.9,
      }}
    >
      <Checkbox
        checked={props.checked}
        label={
          <Typography level='body-sm' sx={{ fontWeight: 'md', color: 'text.primary' }}>
            {props.label}
          </Typography>
        }
        onChange={event => props.onChange(event.target.checked)}
        size='sm'
        sx={{
          alignItems: 'center',
          width: '100%',
          '--Checkbox-gap': '0.75rem',
          '& .MuiCheckbox-label': {
            flex: 1,
            minWidth: 0,
          },
        }}
      />
    </Box>
  );
}

export function CouncilTraceMessage(props: {
  trace: CouncilTraceRenderItem;
  defaultExpanded?: boolean;
  defaultExpandedRoundIndexes?: number[];
  defaultExpandedAgentKeys?: string[];
  autoCollapsePreviousRounds?: boolean;
  autoExpandNewestRound?: boolean;
  onAutoCollapsePreviousRoundsChange?: (value: boolean) => void;
  onAutoExpandNewestRoundChange?: (value: boolean) => void;
}) {
  const {
    trace,
    defaultExpanded = false,
    defaultExpandedRoundIndexes,
    defaultExpandedAgentKeys,
    autoCollapsePreviousRounds = true,
    autoExpandNewestRound = true,
    onAutoCollapsePreviousRoundsChange,
    onAutoExpandNewestRoundChange,
  } = props;
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [expandedRounds, setExpandedRounds] = React.useState(() => new Set(
    defaultExpandedRoundIndexes ?? trace.rounds
      .filter(round => round.defaultExpanded)
      .map(round => round.roundIndex),
  ));
  const allRoundIndexes = React.useMemo(() => trace.rounds.map(round => round.roundIndex), [trace.rounds]);
  const latestRoundIndex = trace.rounds[trace.rounds.length - 1]?.roundIndex ?? null;
  const previousLatestRoundIndexRef = React.useRef<number | null>(latestRoundIndex);
  const manuallyExpandedRoundsRef = React.useRef<Set<number>>(new Set());

  const expandedAgentKeys = React.useMemo(() => new Set(defaultExpandedAgentKeys ?? []), [defaultExpandedAgentKeys]);

  React.useEffect(() => {
    const previousLatestRoundIndex = previousLatestRoundIndexRef.current;
    previousLatestRoundIndexRef.current = latestRoundIndex;

    if (latestRoundIndex === null || latestRoundIndex === previousLatestRoundIndex)
      return;

    setExpandedRounds(prev => {
      return getNextAutoExpandedRounds({
        previousExpandedRounds: prev,
        latestRoundIndex,
        autoCollapsePreviousRounds,
        autoExpandNewestRound,
        manuallyExpandedRounds: manuallyExpandedRoundsRef.current,
      });
    });
  }, [autoCollapsePreviousRounds, autoExpandNewestRound, latestRoundIndex]);

  const toggleRound = React.useCallback((roundIndex: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundIndex)) {
        next.delete(roundIndex);
        manuallyExpandedRoundsRef.current.delete(roundIndex);
      } else {
        next.add(roundIndex);
        manuallyExpandedRoundsRef.current.add(roundIndex);
      }
      return next;
    });
  }, []);
  const expandAllRounds = React.useCallback(() => {
    manuallyExpandedRoundsRef.current = new Set(allRoundIndexes);
    setExpandedRounds(new Set(allRoundIndexes));
  }, [allRoundIndexes]);
  const collapseAllRounds = React.useCallback(() => {
    manuallyExpandedRoundsRef.current.clear();
    setExpandedRounds(new Set());
  }, []);
  const allRoundsExpanded = trace.rounds.length > 0 && allRoundIndexes.every(roundIndex => expandedRounds.has(roundIndex));
  const allRoundsCollapsed = expandedRounds.size === 0;

  const summaryLabel = getCouncilTraceSummaryLabel(trace);
  const latestRound = trace.rounds[trace.rounds.length - 1] ?? null;
  const latestRoundText = latestRound
    ? `Round ${latestRound.roundIndex + 1} ${getRoundSummary(latestRound).toLowerCase()}`
    : 'No rounds recorded';

  return (
    <PerfProfiler id='CouncilTraceMessage'>
      <ListItem data-chat-minimap-entry='trace' sx={{ display: 'block', px: 0, py: 0.75 }}>
        <Box
          sx={{
            mx: 2,
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(180deg, rgba(var(--joy-palette-primary-mainChannel) / 0.06) 0%, var(--joy-palette-background-level1) 18%, var(--joy-palette-background-surface) 100%)',
            boxShadow: 'sm',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ display: 'grid', gap: 1, p: 1.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'grid', gap: 0.35 }}>
                <Typography
                  level='body-xs'
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 'lg',
                    color: 'primary.plainColor',
                  }}
                >
                  Structured workflow audit
                </Typography>
                <Typography level='title-md'>Council trace</Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {expanded && onAutoCollapsePreviousRoundsChange && onAutoExpandNewestRoundChange && (
                  <>
                    <CouncilTracePreferenceToggle
                      checked={autoCollapsePreviousRounds}
                      label='Auto-collapse previous rounds'
                      onChange={onAutoCollapsePreviousRoundsChange}
                    />
                    <CouncilTracePreferenceToggle
                      checked={autoExpandNewestRound}
                      label='Auto-expand newest round'
                      onChange={onAutoExpandNewestRoundChange}
                    />
                  </>
                )}
                {expanded && trace.rounds.length > 0 && (
                  <>
                    <Button
                      size='sm'
                      variant='soft'
                      color='neutral'
                      disabled={allRoundsExpanded}
                      startDecorator={<KeyboardArrowDownRoundedIcon />}
                      onClick={expandAllRounds}
                    >
                      Expand all
                    </Button>
                    <Button
                      size='sm'
                      variant='soft'
                      color='neutral'
                      disabled={allRoundsCollapsed}
                      startDecorator={<KeyboardArrowRightRoundedIcon />}
                      onClick={collapseAllRounds}
                    >
                      Collapse all
                    </Button>
                  </>
                )}
                <Button
                  size='sm'
                  variant={expanded ? 'solid' : 'soft'}
                  color='neutral'
                  startDecorator={<AccountTreeRoundedIcon />}
                  endDecorator={expanded ? <KeyboardArrowDownRoundedIcon /> : <KeyboardArrowRightRoundedIcon />}
                  onClick={() => setExpanded(value => !value)}
                >
                  {expanded ? 'Hide workflow' : 'Show workflow'}
                </Button>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 0.9,
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
                alignItems: 'center',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.surface',
                px: 1,
                py: 0.95,
              }}
            >
              <Box sx={{ display: 'grid', gap: 0.25 }}>
                <Typography
                  level='body-xs'
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 'lg',
                    color: 'text.tertiary',
                  }}
                >
                  Latest outcome
                </Typography>
                <Typography level='title-sm'>{latestRoundText}</Typography>
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
          </Box>

          {expanded && (
            <>
              <Divider />
              <Box sx={{ display: 'grid', gap: 1, p: 1.25 }}>
                {trace.rounds.map(round => {
                  const roundExpanded = expandedRounds.has(round.roundIndex);
                  const proposalCard = round.proposalCard ?? round.leaderCard ?? null;
                  const reviewerVoteProgress = round.reviewerVoteProgress ?? {
                    completed: (round.reviewerCards ?? []).filter(card => card.decision !== 'pending').length,
                    total: trace.reviewerCount,
                    isShared: true,
                  };
                  const reviewerReviewCards = round.reviewerCards?.length
                    ? round.reviewerCards
                    : round.reviewerVoteCards?.length
                      ? round.reviewerVoteCards
                      : round.reviewerPlanCards ?? [];
                  const shouldShowReviewerReviews = !round.leaderProposalFailed;
                  const { acceptCount, rejectCount, pendingCount } = getRoundDecisionCounts(round);

                  return (
                    <Box
                      key={`council-trace-round-${round.roundIndex}`}
                      data-chat-minimap-entry='trace'
                      data-chat-minimap-id={`council-trace-${trace.phaseId}-round-${round.roundIndex}`}
                      sx={{
                        borderRadius: 'md',
                        border: '1px solid',
                        borderColor: roundExpanded ? 'primary.outlinedBorder' : 'divider',
                        backgroundColor: 'background.surface',
                        boxShadow: roundExpanded ? 'sm' : 'xs',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 0.9,
                          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
                          alignItems: 'center',
                          p: 1,
                          backgroundColor: roundExpanded ? 'rgba(var(--joy-palette-primary-mainChannel) / 0.05)' : 'transparent',
                        }}
                      >
                        <Box sx={{ display: 'grid', gap: 0.45 }}>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Typography level='title-sm'>Round {round.roundIndex + 1}</Typography>
                            <Chip size='sm' variant='soft' color={getRoundSummaryTone(round)}>
                              {getRoundSummary(round)}
                            </Chip>
                            {!!rejectCount && (
                              <Chip size='sm' variant='soft' color='danger'>
                                {rejectCount} improvement request{rejectCount === 1 ? '' : 's'}
                              </Chip>
                            )}
                            {!!acceptCount && (
                              <Chip size='sm' variant='soft' color='success'>
                                {acceptCount} accept{acceptCount === 1 ? '' : 's'}
                              </Chip>
                            )}
                            {!!pendingCount && (
                              <Chip size='sm' variant='soft' color='warning'>
                                {pendingCount} pending
                              </Chip>
                            )}
                          </Box>

                          <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
                            {getRoundLeadSummary(round, proposalCard, reviewerReviewCards.length)}
                          </Typography>
                        </Box>

                        <CouncilTraceRoundToggleButton
                          roundExpanded={roundExpanded}
                          onToggle={() => toggleRound(round.roundIndex)}
                        />
                      </Box>

                      {roundExpanded && (
                        <>
                          <Divider />
                          <Box sx={{ display: 'grid', gap: 1, p: 1 }}>
                            {!!proposalCard && (
                              <CouncilTraceSection title='Proposal'>
                                <Box sx={getCouncilTraceLeaderRowSx()}>
                                  <CouncilTraceAgentCardView
                                    roundIndex={round.roundIndex}
                                    card={proposalCard}
                                    defaultExpanded={expandedAgentKeys.has(`${round.roundIndex}:${proposalCard.participantId}`)}
                                  />
                                </Box>
                              </CouncilTraceSection>
                            )}

                            {shouldShowReviewerReviews && (
                              <CouncilTraceSection title='Reviewer reviews'>
                                {reviewerReviewCards.length ? (
                                  <>
                                    {!reviewerVoteProgress.isShared && (
                                      <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
                                        {reviewerVoteProgress.completed}/{reviewerVoteProgress.total} reviews complete.
                                      </Typography>
                                    )}
                                    <Box sx={getCouncilTraceReviewerRowScrollerSx()}>
                                      <Box sx={getCouncilTraceReviewerRowSx(reviewerReviewCards.length)}>
                                        {reviewerReviewCards.map(voteCard => (
                                          <CouncilTraceAgentCardView
                                            key={`round-${round.roundIndex}-vote-${voteCard.participantId}`}
                                            roundIndex={round.roundIndex}
                                            card={voteCard}
                                            defaultExpanded={expandedAgentKeys.has(`${round.roundIndex}:${voteCard.participantId}`)}
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  </>
                                ) : (
                                  <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
                                    {reviewerVoteProgress.completed}/{reviewerVoteProgress.total} reviews complete.
                                  </Typography>
                                )}
                              </CouncilTraceSection>
                            )}

                            {round.sharedReasons && (
                              <Box
                                sx={{
                                  borderRadius: 'md',
                                  border: '1px solid',
                                  borderColor: round.sharedReasons.label === 'Final improvement reasons' ? 'danger.outlinedBorder' : 'divider',
                                  backgroundColor: round.sharedReasons.label === 'Final improvement reasons' ? 'danger.softBg' : 'background.level1',
                                  p: 1,
                                  display: 'grid',
                                  gap: 0.75,
                                }}
                              >
                                <Typography
                                  level='body-xs'
                                  sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    fontWeight: 'lg',
                                    color: round.sharedReasons.label === 'Final improvement reasons' ? 'danger.plainColor' : 'text.tertiary',
                                  }}
                                >
                                  Carry-forward feedback
                                </Typography>
                                <Typography level='title-sm'>{round.sharedReasons.label}</Typography>
                                <Box component='ol' sx={{ m: 0, pl: 2, display: 'grid', gap: 0.5 }}>
                                  {round.sharedReasons.reasons.map((reason, index) => (
                                    <Box key={`round-${round.roundIndex}-reason-${index}`} component='li'>
                                      <CouncilTraceMarkdownText content={reason} />
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <CouncilTraceRoundToggleButton
                                roundExpanded={roundExpanded}
                                onToggle={() => toggleRound(round.roundIndex)}
                              />
                            </Box>
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
    </PerfProfiler>
  );
}
