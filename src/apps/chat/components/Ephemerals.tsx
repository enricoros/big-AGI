import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MaximizeIcon from '@mui/icons-material/Maximize';
import MinimizeIcon from '@mui/icons-material/Minimize';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { DEphemeral } from '~/common/chat-overlay/store-perchat-ephemerals_slice';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { adjustContentScaling, ContentScaling } from '~/common/app.theme';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import { useFragmentBuckets } from '~/common/stores/chat/hooks/useFragmentBuckets';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { ContentFragments } from './message/fragments-content/ContentFragments';
import { DocumentAttachmentFragments } from './message/fragments-attachment-doc/DocumentAttachmentFragments';
import { ImageAttachmentFragments } from './message/fragments-attachment-image/ImageAttachmentFragments';
import { VoidFragments } from './message/fragments-void/VoidFragments';


function formatStateValue(value: unknown): string {
  if (value === null)
    return 'null';
  if (value === undefined)
    return 'undefined';
  if (typeof value === 'string')
    return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'symbol')
    return String(value);
  if (Array.isArray(value))
    return value.length ? `${value.length} item${value.length === 1 ? '' : 's'}` : 'empty list';
  if (typeof value === 'object')
    return 'Object';
  return String(value);
}

function StateRenderer(props: { state: object, contentScaling: ContentScaling }) {
  if (typeof props.state !== 'object')
    return <pre>Developer Warning: state is not an object: {JSON.stringify(props.state, null, 2)}</pre>;

  const entries = Object.entries(props.state).filter(([key]) => key !== 'messageFragments');

  return (
    <Box sx={{ display: 'grid', gap: 0.9 }}>
      <ScaledTextBlockRenderer
        text='**Internal State**'
        contentScaling={props.contentScaling}
        textRenderVariant='markdown'
      />

      {entries.length ? (
        <Box component='dl' sx={{ m: 0, display: 'grid', gap: 0.75 }}>
          {entries.map(([key, value]) => (
            <Box
              key={`state-${key}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(6rem, auto) minmax(0, 1fr)',
                gap: 1,
                alignItems: 'start',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.level1',
                px: 0.9,
                py: 0.8,
              }}
            >
              <Typography
                component='dt'
                level='body-xs'
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 'lg',
                  color: 'text.tertiary',
                }}
              >
                {key}
              </Typography>
              <Typography
                component='dd'
                level='body-sm'
                sx={{
                  m: 0,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  color: 'text.primary',
                  fontFamily: typeof value === 'number' || typeof value === 'boolean'
                    ? 'var(--joy-fontFamily-code)'
                    : 'var(--joy-fontFamily-body)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatStateValue(value)}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
          No state variables
        </Typography>
      )}
    </Box>
  );
}

function isMessageFragmentsValue(value: unknown): value is DMessageFragment[] {
  return Array.isArray(value) && value.every(fragment => !!fragment && typeof fragment === 'object' && 'ft' in fragment);
}

function EphemeralFragmentsPreview(props: {
  messageFragments: DMessageFragment[];
  contentScaling: ContentScaling;
  messagePendingIncomplete: boolean;
}) {
  const {
    annotationFragments,
    interleavedFragments,
    imageAttachments,
    nonImageAttachments,
  } = useFragmentBuckets(props.messageFragments);

  if (!props.messageFragments.length)
    return null;

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Typography level='body-xs' sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'lg', color: 'text.tertiary' }}>
        Subagent output
      </Typography>

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


const leftPaneSx = {
  overflowWrap: 'anywhere',
  whiteSpace: 'break-spaces',
  '.markdown-body': { mx: '0!important' },
  '.markdown-body p': { mb: 0 },
};


function EphemeralItem(props: {
  ephemeral: DEphemeral,
  conversationHandler: ConversationHandler,
  contentScaling: ContentScaling,
}) {

  const { ephemeral, conversationHandler } = props;

  const handleDelete = React.useCallback(() => {
    conversationHandler.overlayActions.ephemeralsDelete(ephemeral.id);
  }, [conversationHandler, ephemeral.id]);

  const handleToggleMinimized = React.useCallback(() => {
    conversationHandler.overlayActions.ephemeralsToggleMinimized(ephemeral.id);
  }, [conversationHandler, ephemeral.id]);

  const handleToggleShowState = React.useCallback(() => {
    conversationHandler.overlayActions.ephemeralsToggleShowStatePane(ephemeral.id);
  }, [conversationHandler, ephemeral.id]);

  const showStatePane = ephemeral.showStatePane && !!ephemeral.state;
  const stateRecord = (ephemeral.state ?? {}) as Record<string, unknown>;
  const promptPreview = typeof stateRecord.prompt === 'string' ? stateRecord.prompt : null;
  const phaseLabel = typeof stateRecord.phase === 'string' ? stateRecord.phase : null;
  const depthValue = typeof stateRecord.depth === 'number' ? stateRecord.depth : null;
  const rawStatus = typeof stateRecord.status === 'string' ? stateRecord.status : null;
  const messageFragments = isMessageFragmentsValue(stateRecord.messageFragments) ? stateRecord.messageFragments : [];
  const showFragmentsPreview = messageFragments.length > 0;
  const isPending = rawStatus === 'running' || rawStatus === 'streaming' || rawStatus === 'finalizing';
  const statusColor = rawStatus === 'failed'
    ? 'danger'
    : rawStatus === 'done'
      ? 'success'
      : rawStatus === 'finalizing'
        ? 'primary'
        : ephemeral.minimized
          ? 'neutral'
          : 'warning';
  const statusLabel = rawStatus === 'failed'
    ? 'Failed'
    : rawStatus === 'done'
      ? 'Complete'
      : rawStatus === 'finalizing'
        ? 'Finalizing'
        : rawStatus === 'streaming'
          ? 'Streaming'
          : ephemeral.minimized
            ? 'Minimized'
            : 'Running';

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'grid',
        gap: 0.75,
        borderRadius: 'xl',
        border: '1px solid',
        borderColor: ephemeral.done ? 'success.outlinedBorder' : 'rgba(var(--joy-palette-success-mainChannel) / 0.24)',
        background: 'linear-gradient(180deg, rgba(var(--joy-palette-success-mainChannel) / 0.07) 0%, var(--joy-palette-background-surface) 34%)',
        boxShadow: 'sm',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '14px auto 14px 10px',
          width: '0.28rem',
          borderRadius: '999px',
          background: ephemeral.done ? 'var(--joy-palette-success-solidBg)' : 'var(--joy-palette-warning-solidBg)',
        },
      }}
    >

      <Box
        sx={{
          px: { xs: 1, md: 1.25 },
          pt: 1,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'grid', gap: 0.45, pl: 1.25, minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography level='title-sm' sx={{ minWidth: 0 }}>
              {ephemeral.title} Internal Monologue
            </Typography>
            <Chip size='sm' variant='soft' color={statusColor}>
              {statusLabel}
            </Chip>
            {!!depthValue && (
              <Chip size='sm' variant='soft' color='neutral'>
                Depth {depthValue}
              </Chip>
            )}
            {showStatePane && (
              <Chip size='sm' variant='soft' color='neutral'>
                State visible
              </Chip>
            )}
          </Box>
          <Box sx={{ display: 'grid', gap: 0.35 }}>
            <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
              {phaseLabel || 'Live execution trace and structured state snapshot'}
            </Typography>
            {promptPreview && (
              <Typography
                level='body-xs'
                sx={{
                  color: 'text.secondary',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {promptPreview}
              </Typography>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 0.4,
            alignItems: 'center',
            p: 0.35,
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.level1',
          }}
        >
          {!ephemeral.minimized && (
            <IconButton
              size='sm'
              aria-label={ephemeral.showStatePane ? 'Hide state panel' : 'Show state panel'}
              variant={ephemeral.showStatePane ? 'soft' : 'plain'}
              color='neutral'
              onClick={handleToggleShowState}
            >
              {ephemeral.showStatePane ? <VerticalSplitIcon /> : <VerticalSplitOutlinedIcon />}
            </IconButton>
          )}

          <IconButton
            size='sm'
            aria-label={ephemeral.minimized ? 'Expand internal monologue' : 'Minimize internal monologue'}
            variant='plain'
            color='neutral'
            onClick={handleToggleMinimized}
          >
            {ephemeral.minimized ? <MaximizeIcon /> : <MinimizeIcon />}
          </IconButton>

          <IconButton
            size='sm'
            aria-label='Close internal monologue'
            variant={ephemeral.done ? 'soft' : 'plain'}
            color={ephemeral.done ? 'success' : 'neutral'}
            onClick={handleDelete}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </Box>

      {!ephemeral.minimized && (
        <Box sx={{ px: { xs: 1, md: 1.25 }, pb: 1.25, pl: { xs: 2.25, md: 2.5 } }}>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: showStatePane ? 'minmax(0, 1.7fr) minmax(18rem, 24rem)' : 'minmax(0, 1fr)',
              },
            }}
          >
            <Box
              sx={{
                borderRadius: 'lg',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.level1',
                p: 1,
                display: 'grid',
                gap: 1,
              }}
            >
              {showFragmentsPreview && (
                <EphemeralFragmentsPreview
                  messageFragments={messageFragments}
                  contentScaling={props.contentScaling}
                  messagePendingIncomplete={isPending}
                />
              )}

              {!!ephemeral.text && (
                <Box sx={{ display: 'grid', gap: 0.6 }}>
                  <Typography level='body-xs' sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'lg', color: 'text.tertiary' }}>
                    Activity log
                  </Typography>
                  <Box sx={leftPaneSx}>
                    <ScaledTextBlockRenderer
                      text={ephemeral.text}
                      contentScaling={props.contentScaling}
                      textRenderVariant='markdown'
                    />
                  </Box>
                </Box>
              )}
            </Box>

            {showStatePane && ephemeral.state && (
              <Box
                sx={{
                  borderRadius: 'lg',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.level2',
                  p: 1,
                }}
              >
                <StateRenderer
                  state={ephemeral.state}
                  contentScaling={props.contentScaling}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

    </Box>
  );
}


export function Ephemerals(props: {
  ephemerals: DEphemeral[],
  conversationHandler: ConversationHandler,
  sx?: SxProps
}) {

  const adjContentScaling = useUIPreferencesStore(state => adjustContentScaling(state.contentScaling, -1));

  return (
    <Box sx={{ display: 'grid', gap: 1, ...props.sx }}>
      {props.ephemerals.map(ephemeral => (
        <EphemeralItem
          key={ephemeral.id}
          ephemeral={ephemeral}
          conversationHandler={props.conversationHandler}
          contentScaling={adjContentScaling}
        />
      ))}
    </Box>
  );
}
