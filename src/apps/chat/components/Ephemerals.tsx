import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Grid, IconButton, Sheet, styled, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MaximizeIcon from '@mui/icons-material/Maximize';
import MinimizeIcon from '@mui/icons-material/Minimize';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { DEphemeral } from '~/common/chat-overlay/store-perchat-ephemerals_slice';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { adjustContentScaling, ContentScaling, lineHeightChatTextMd } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';


// State Pane

const StateLine = styled(Typography)(({ theme }) => ({
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontSize: theme.fontSize.xs,
  fontFamily: theme.fontFamily.code,
  marginLeft: theme.spacing(1),
  lineHeight: lineHeightChatTextMd,
}));

function isPrimitive(value: any): boolean {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean' || t === 'symbol' || value === null || value === undefined;
}

function PrimitiveRender({ name, value }: { name: string, value: string | number | boolean | symbol | null | undefined }) {
  if (value === null || value === undefined)
    return <StateLine><b>{name}</b>: <i>{value === null ? 'null' : 'undefined'}</i></StateLine>;
  else if (typeof value === 'string')
    return <StateLine><b>{name}</b>: &lsquo;{value}&rsquo;</StateLine>;
  else if (typeof value === 'number')
    return <StateLine><b>{name}</b>: <b>{value}</b></StateLine>;
  else if (typeof value === 'boolean')
    return <StateLine><b>{name}</b>: <b>{value ? 'true' : 'false'}</b></StateLine>;
  else
    return <StateLine><b>{name}</b>: unknown?</StateLine>;
}

function ListRenderer({ name, list }: { name: string, list: any[] }) {
  return <StateLine><b>{name}</b>[{list.length ? list.length : ''}]: {list.length ? '(not displayed)' : 'empty'}</StateLine>;
}

function ObjectRenderer({ name }: { name: string }) {
  return <StateLine><b>{name}</b>: <i>object not displayed</i></StateLine>;
}

function StateRenderer(props: { state: object, contentScaling: ContentScaling }) {
  if (typeof props.state !== 'object')
    return <pre>Developer Warning: state is not an object: {JSON.stringify(props.state, null, 2)}</pre>;

  const entries = Object.entries(props.state);

  return (
    <Box>
      <ScaledTextBlockRenderer
        text='**Internal State**'
        contentScaling={props.contentScaling}
        textRenderVariant='markdown'
      />
      <Box sx={{
        mt: 1,
        p: 1,
        borderRadius: 'md',
        background: 'linear-gradient(180deg, var(--joy-palette-success-softHoverBg), transparent)',
      }}>
        {!entries && <Typography level='body-sm'>No state variables</Typography>}
        {entries.map(([key, value]) =>
          isPrimitive(value)
            ? <PrimitiveRender key={'state-' + key} name={key} value={value} />
            : Array.isArray(value)
              ? <ListRenderer key={'state-' + key} name={key} list={value} />
              : typeof value === 'object'
                ? <ObjectRenderer key={'state-' + key} name={key} />
                : <Typography key={'state-' + key} level='body-sm'>{key}: {value}</Typography>,
        )}
      </Box>
    </Box>
  );
}


const leftPaneSx = {
  // <pre> looks
  overflowWrap: 'anywhere',
  whiteSpace: 'break-spaces',
  // 'undo' some of the github-markdown CSS customizations
  '.markdown-body': { mx: '0!important' },
  '.markdown-body p': { mb: 0 },
};

const rightPaneSx = {
  borderLeft: { md: `1px dashed` },
  borderTop: { xs: `1px dashed`, md: 'none' },
};


function EphemeralItem(props: {
  ephemeral: DEphemeral,
  conversationHandler: ConversationHandler,
  contentScaling: ContentScaling,
}) {

  const { ephemeral, conversationHandler } = props;

  // Event handlers
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

  return (
    <Box sx={{
      borderTop: '1px solid',
      borderTopColor: 'divider',
      // border: (i < ephemerals.length - 1) ? `2px solid ${theme.palette.divider}` : undefined,
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Top Line - Title and Buttons */}
      <Box sx={{
        py: 1,
        px: { xs: 1, md: 2 },
        backgroundColor: 'success.softHoverBg',
        display: 'flex',
        gap: 1,
        alignItems: 'center'
      }}>

        <Typography level='title-sm' sx={{ flex: 1, color: 'success.solidBg' }}>
          {ephemeral.title} Internal Monologue
        </Typography>

        {/* Show State */}
        {!ephemeral.minimized && (
          <IconButton
            size='sm'
            variant={ephemeral.showStatePane ? 'solid' : 'outlined'}
            onClick={handleToggleShowState}
          >
            {ephemeral.showStatePane ? <VerticalSplitIcon /> : <VerticalSplitOutlinedIcon />}
          </IconButton>
        )}

        {/* Minimize/Expand Button */}
        <IconButton
          size='sm'
          variant={'outlined'}
          onClick={handleToggleMinimized}
        >
          {ephemeral.minimized ? <MaximizeIcon /> : <MinimizeIcon />}
        </IconButton>

        {/* Close */}
        <IconButton
          size='sm'
          variant={ephemeral.done ? 'solid' : 'outlined'}
          onClick={handleDelete}
        >
          <CloseRoundedIcon />
        </IconButton>

      </Box>

      {/* Content */}
      {!ephemeral.minimized && <Box sx={{
        py: 1,
        px: { xs: 1, md: 2 },
      }}>

        {/* Content Grid */}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>

          {/* Left pane (log) */}
          <Grid xs={12} md={showStatePane ? 6 : 12}>
            {/* New renderer, with */}
            <Box sx={leftPaneSx}>
              <ScaledTextBlockRenderer
                text={ephemeral.text}
                contentScaling={props.contentScaling}
                textRenderVariant='markdown'
              />
            </Box>
          </Grid>

          {/* Right pane (state) */}
          {showStatePane && (
            <Grid xs={12} md={6} sx={rightPaneSx}>
              <StateRenderer
                state={ephemeral.state}
                contentScaling={props.contentScaling}
              />
            </Grid>
          )}

        </Grid>
      </Box>}

    </Box>
  );
}


export function Ephemerals(props: {
  ephemerals: DEphemeral[],
  conversationHandler: ConversationHandler,
  sx?: SxProps
}) {

  // external state
  const adjContentScaling = useUIPreferencesStore(state => adjustContentScaling(state.contentScaling, -1));

  return (
    <Sheet variant='soft' color='success' invertedColors sx={props.sx}>

      {props.ephemerals.map((ephemeral, i) => (
        <EphemeralItem
          key={ephemeral.id}
          ephemeral={ephemeral}
          conversationHandler={props.conversationHandler}
          contentScaling={adjContentScaling}
        />
      ))}

    </Sheet>
  );
}
