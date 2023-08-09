import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Grid, IconButton, Sheet, Stack, styled, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CloseIcon from '@mui/icons-material/Close';

import { DEphemeral, useChatStore } from '~/common/state/store-chats';


const StateLine = styled(Typography)(({ theme }) => ({
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontSize: theme.fontSize.xs,
  fontFamily: theme.fontFamily.code,
  marginLeft: theme.spacing(1),
  lineHeight: 2,
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
  else if (typeof value === 'symbol')
    return <StateLine><b>{name}</b>: <b>{value.toString()}</b></StateLine>;
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
    <Stack>
      <Typography level='body-sm' sx={{ mb: 1 }}>
        Internal State
      </Typography>
      <Sheet>
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
    </Stack>
  );
}


function EphemeralItem({ conversationId, ephemeral }: { conversationId: string, ephemeral: DEphemeral }) {
  const theme = useTheme();
  return <Box
    sx={{
      p: { xs: 1, md: 2 },
      position: 'relative',
      // border: (i < ephemerals.length - 1) ? `2px solid ${theme.palette.divider}` : undefined,
      '&:hover > button': { opacity: 1 },
    }}>

    {/* Title */}
    {ephemeral.title && <Typography>
      {ephemeral.title} <b>Development Tools</b>
    </Typography>}

    {/* Vertical | split */}
    <Grid container spacing={2}>

      {/* Left pane (console) */}
      <Grid xs={12} md={ephemeral.state ? 6 : 12}>
        <Typography fontSize='smaller' sx={{ overflowWrap: 'anywhere', whiteSpace: 'break-spaces', lineHeight: 1.75 }}>
          {ephemeral.text}
        </Typography>
      </Grid>

      {/* Right pane (state) */}
      {!!ephemeral.state && <Grid
        xs={12} md={6}
        sx={{
          borderLeft: { md: `1px solid ${theme.palette.divider}` },
          borderTop: { xs: `1px solid ${theme.palette.divider}`, md: 'none' },
        }}>
        <StateRenderer state={ephemeral.state} />
      </Grid>}
    </Grid>

    {/* Close button (right of title) */}
    <IconButton
      size='sm'
      onClick={() => useChatStore.getState().deleteEphemeral(conversationId, ephemeral.id)}
      sx={{
        position: 'absolute', top: 8, right: 8,
        opacity: { xs: 1, sm: 0.5 }, transition: 'opacity 0.3s',
      }}>
      <CloseIcon />
    </IconButton>

  </Box>;
}


export function Ephemerals(props: { conversationId: string | null, sx?: SxProps }) {
  // global state
  const theme = useTheme();
  const ephemerals = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation ? conversation.ephemerals : [];
  }, shallow);

  if (!ephemerals?.length) return null;

  return (
    <Sheet
      variant='soft' color='success' invertedColors
      sx={{
        border: `4px dashed ${theme.palette.divider}`,
        ...(props.sx || {}),
      }}>

      {ephemerals.map((ephemeral, i) =>
        props.conversationId && <EphemeralItem key={`ephemeral-${i}`} conversationId={props.conversationId} ephemeral={ephemeral} />)}

    </Sheet>
  );
}
