import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Grid, IconButton, Sheet, styled, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PushPinIcon from '@mui/icons-material/PushPin';

import type { DEphemeral } from '~/common/chat-overlay/store-ephemeralsoverlay-slice';
import { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { lineHeightChatTextMd } from '~/common/app.theme';


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


function StateRenderer(props: { state: object }) {
  if (typeof props.state !== 'object')
    return <pre>Developer Warning: state is not an object: {JSON.stringify(props.state, null, 2)}</pre>;

  const entries = Object.entries(props.state);

  return (
    <Box>
      <Typography fontSize='smaller' sx={{ mb: 1 }}>
        ## Internal State
      </Typography>
      <Sheet sx={{ p: 1 }}>
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
      </Sheet>
    </Box>
  );
}


function EphemeralItem(props: {
  ephemeral: DEphemeral,
  conversationHandler: ConversationHandler,
}) {

  const { ephemeral, conversationHandler } = props;

  const handleDelete = React.useCallback(() => {
    conversationHandler.overlayActions.ephemeralsDelete(ephemeral.id);
  }, [conversationHandler, ephemeral.id]);

  const handleTogglePinned = React.useCallback(() => {
    conversationHandler.overlayActions.ephemeralsTogglePinned(ephemeral.id);
  }, [conversationHandler, ephemeral.id]);

  return <Box
    sx={{
      p: { xs: 1, md: 2 },
      position: 'relative',
      borderTop: '1px solid',
      borderTopColor: 'divider',
      // border: (i < ephemerals.length - 1) ? `2px solid ${theme.palette.divider}` : undefined,
    }}>

    {/* Title */}
    {ephemeral.title && (
      <Typography level='title-sm' sx={{ mb: 1.5 }}>
        {ephemeral.title} Internal Monologue
      </Typography>
    )}

    {/* Vertical | split */}
    <Grid container spacing={2}>

      {/* Left pane (console) */}
      <Grid xs={12} md={ephemeral.state ? 6 : 12}>
        <Typography fontSize='smaller' sx={{ overflowWrap: 'anywhere', whiteSpace: 'break-spaces', lineHeight: lineHeightChatTextMd }}>
          {ephemeral.text}
        </Typography>
      </Grid>

      {/* Right pane (state) */}
      {!!ephemeral.state && (
        <Grid
          xs={12} md={6}
          sx={{
            borderLeft: { md: `1px dashed` },
            borderTop: { xs: `1px dashed`, md: 'none' },
          }}>
          <StateRenderer state={ephemeral.state} />
        </Grid>
      )}
    </Grid>


    {/* Buttons */}
    <Box sx={{
      position: 'absolute',
      top: 0,
      right: 0,
      m: 1,
      display: 'flex',
      gap: 1,
    }}>

      {/* Pin button */}
      <IconButton
        size='sm'
        variant={ephemeral.pinned ? 'soft' : 'outlined'}
        color={ephemeral.pinned ? 'primary' : 'neutral'}
        onClick={handleTogglePinned}
        sx={{
          '& > *': { transition: 'transform 0.2s' },
        }}
      >
        <PushPinIcon sx={ephemeral.pinned ? { transform: 'rotate(45deg)' } : undefined} />
      </IconButton>

      {/* Close button */}
      <IconButton
        size='sm'
        variant={ephemeral.done ? 'solid' : 'outlined'}
        onClick={handleDelete}
      >
        <CloseRoundedIcon />
      </IconButton>

    </Box>

  </Box>;
}

// const dashedBorderSVG = encodeURIComponent(`
//   <svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>
//     <rect x='0' y='0' width='100%' height='100%' fill='none' stroke='currentColor' stroke-width='2' stroke-dasharray='16, 2' />
//   </svg>
// `);


export function Ephemerals(props: {
  ephemerals: DEphemeral[],
  conversationHandler: ConversationHandler,
  sx?: SxProps
}) {
  return (
    <Sheet variant='soft' color='success' invertedColors sx={props.sx}>

      {props.ephemerals.map((ephemeral, i) => (
        <EphemeralItem
          key={`ephemeral-${i}`}
          ephemeral={ephemeral}
          conversationHandler={props.conversationHandler}
        />
      ))}

    </Sheet>
  );
}
