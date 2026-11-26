import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Chip, ChipDelete, Link, Tooltip, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { aixIssueDetailAddingToText, type DAixIssue } from '~/modules/aix/shared/aix.issues';
import { aixIssuePresentation, type AixIssuePresentation } from '~/modules/aix/shared/aix.issues.policy';
import { findModelVendor, type ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import { adjustContentScaling, ContentScaling, themeScalingMap } from '~/common/app.theme';
import { extractUrlsFromText } from '~/common/util/urlUtils';
import { prettyDuration } from '~/common/util/timeUtils';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useModelServiceClientSideFetch } from '~/common/stores/llms/hooks/useModelServiceClientSideFetch';

import { BlockPartError_DirectConnectionRow } from './BlockPartError_DirectConnectionRow';
import { BlockPartError_NetDisconnected } from './BlockPartError_NetDisconnected';
import { BlockPartError_RequestExceeded } from './BlockPartError_RequestExceeded';


// configuration
const DETAIL_INLINE_LINES = 3; // an inline detail is clamped to this many lines until Details is open


const _styles = {
  block: {
    mx: 1.5, // aligns with the text blocks (RenderPlainText)
    pl: 1.5,
    borderLeft: '3px solid',
    display: 'grid',
    justifyItems: 'start',
    gap: 0.5,
    overflowWrap: 'anywhere',
  },
  headline: {
    fontWeight: 'md',
    whiteSpace: 'break-spaces',
  },
  secondary: {
    whiteSpace: 'pre-wrap',
  },
  secondaryClamped: {
    whiteSpace: 'pre-wrap',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: DETAIL_INLINE_LINES,
    overflow: 'hidden',
  },
  toggle: {
    minHeight: 0,
    px: 0.5,
    ml: -0.5,
    py: 0.25,
    fontWeight: 'md',
  },
  facts: {
    fontFamily: 'code',
    color: 'text.tertiary',
  },
  notice: {
    my: '1px',
    pl: 1.5,
    pr: 1.75,
    minHeight: '1.5rem',
    gap: 1,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  },
  noticeTooltip: {
    maxWidth: '32rem',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
} as const satisfies Record<string, SxProps>;


/**
 * One issue record of a generation (aix.issues.ts), as its presentation says (aixIssuePresentation): the two recovery
 * cards, a block (danger: the generation failed; warning: lost output on a response that stands), or a dismissible
 * notice chip. Reads the record and the presentation only. `text` and `detail` are plain text, never markdown: vendor words.
 */
export function BlockPartAixIssue(props: {
  issue: DAixIssue,
  messageGeneratorVendorId?: ModelVendorId | null, // names the service; else the generator model's vendor, while the model exists
  messageGeneratorLlmId?: string | null,
  contentScaling: ContentScaling,
  showNotice: boolean, // the notice form follows the visibility of notices
  onNoticeDismiss?: () => void,
}) {
  const { issue } = props;
  const presentation = aixIssuePresentation(issue);
  switch (presentation.form) {
    case 'card-cutoff':
      return <BlockPartError_NetDisconnected elapsedMs={issue.atMs} messageGeneratorLlmId={props.messageGeneratorLlmId} contentScaling={props.contentScaling} />;
    case 'card-size':
      return <BlockPartError_RequestExceeded messageGeneratorLlmId={props.messageGeneratorLlmId} contentScaling={props.contentScaling} />;
    case 'notice':
      return !props.showNotice ? null : <IssueNotice issue={issue} presentation={presentation} vendorId={props.messageGeneratorVendorId} llmId={props.messageGeneratorLlmId} onDismiss={props.onNoticeDismiss} />;
    case 'block':
      return <IssueBlock issue={issue} presentation={presentation} vendorId={props.messageGeneratorVendorId} llmId={props.messageGeneratorLlmId} contentScaling={props.contentScaling} />;
    default: {
      const _exhaustiveCheck: never = presentation.form;
      return null;
    }
  }
}


function IssueBlock(props: {
  issue: DAixIssue,
  presentation: AixIssuePresentation,
  vendorId?: ModelVendorId | null,
  llmId?: string | null,
  contentScaling: ContentScaling,
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const { issue, presentation: { label, byService, tint, advice, directConnection, detail: detailPlace } } = props;
  const llm = useLLM(props.llmId) ?? null;
  const csf = useModelServiceClientSideFetch(!!directConnection, llm);

  // derived
  const name = (byService && findModelVendor(props.vendorId ?? llm?.vId)?.name) || label;
  const detail = aixIssueDetailAddingToText(issue);
  const detailInline = !!detail && detailPlace === 'inline';
  const facts = _factsLine(issue);

  const scaling = themeScalingMap[props.contentScaling];
  const smallScaling = themeScalingMap[adjustContentScaling(props.contentScaling, -1)];

  return (
    <Box sx={{ ..._styles.block, borderColor: `${tint}.outlinedBorder` }}>

      <Typography component='div' color={tint} sx={{ ..._styles.headline, fontSize: scaling?.blockFontSize, lineHeight: scaling?.blockLineHeight }}>
        <b>{name}</b>: {_withLinks(issue.text)}
      </Typography>

      {detailInline && (
        <Typography component='div' textColor='text.secondary' sx={{ ...(!expanded ? _styles.secondaryClamped : _styles.secondary), fontSize: smallScaling?.blockFontSize }}>
          {_withLinks(detail)}
        </Typography>
      )}

      {advice && (
        <Typography component='div' textColor='text.secondary' sx={{ fontSize: smallScaling?.blockFontSize }}>
          {advice}
        </Typography>
      )}

      <Button
        size='sm' variant='plain' color='neutral'
        aria-expanded={expanded}
        startDecorator={expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        onClick={() => setExpanded(on => !on)}
        sx={{ ..._styles.toggle, fontSize: smallScaling?.blockFontSize }}
      >
        Details
      </Button>

      {expanded && <>
        {!!detail && !detailInline && (
          <Typography component='div' textColor='text.secondary' sx={{ ..._styles.secondary, fontSize: smallScaling?.blockFontSize }}>
            {_withLinks(detail)}
          </Typography>
        )}
        <Typography component='div' level='body-xs' sx={_styles.facts}>
          {facts}
        </Typography>
      </>}

      {directConnection && <BlockPartError_DirectConnectionRow csf={csf} direction={directConnection} />}

    </Box>
  );
}


function IssueNotice(props: {
  issue: DAixIssue,
  presentation: AixIssuePresentation,
  vendorId?: ModelVendorId | null,
  llmId?: string | null,
  onDismiss?: () => void,
}) {
  const { issue, presentation: { label, byService, tint } } = props;
  const llm = useLLM(byService && !props.vendorId ? props.llmId : null);
  const name = (byService && findModelVendor(props.vendorId ?? llm?.vId)?.name) || label;
  const tooltip = aixIssueDetailAddingToText(issue);

  const chip = (
    <Chip
      size='sm'
      color={tint}
      variant='soft'
      startDecorator={<WarningRoundedIcon />}
      endDecorator={!props.onDismiss ? undefined : <ChipDelete onDelete={props.onDismiss} />}
      sx={_styles.notice}
    >
      {name}: {issue.text}
    </Chip>
  );
  return !tooltip ? chip : (
    <Tooltip title={<Box sx={_styles.noticeTooltip}>{tooltip}</Box>} variant='outlined' placement='top' arrow>
      {chip}
    </Tooltip>
  );
}


/** Plain text with its bare http(s) URLs as anchors (vendor help pages): no markup is interpreted */
function _withLinks(text: string): React.ReactNode {
  const urls = extractUrlsFromText(text);
  if (!urls.length) return text;
  const nodes: React.ReactNode[] = [];
  let at = 0;
  for (const url of urls) {
    const start = text.indexOf(url, at);
    if (start < 0) continue;
    if (start > at) nodes.push(text.slice(at, start));
    nodes.push(<Link key={start} href={url} target='_blank' rel='noopener noreferrer'>{url}</Link>);
    at = start + url.length;
  }
  if (at < text.length) nodes.push(text.slice(at));
  return nodes;
}

/** The record's facts on one line, for a bug report: the code first, then what the record holds */
function _factsLine(issue: DAixIssue): string {
  return [
    issue.code,
    issue.causeCode,
    issue.httpStatus !== undefined && `HTTP ${issue.httpStatus}`,
    issue.retryAfterMs !== undefined && `retry after ${prettyDuration(issue.retryAfterMs)}`,
    // where the executor ran when it failed to connect or read
    issue.runtime === 'client' ? 'in browser' : issue.runtime === 'relay' ? 'on server' : undefined,
    issue.atMs !== undefined && `at ${issue.atMs < 1000 ? `${issue.atMs}ms` : prettyDuration(issue.atMs, true)}`,
    issue.offline && 'offline',
  ].filter(Boolean).join(' | ');
}
