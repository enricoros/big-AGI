import * as React from 'react';

import { Box, Grid, IconButton, Sheet, styled, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { DConversationId } from '~/common/state/store-chats';
import { DEphemeral } from '~/common/chats/EphemeralsStore';
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


function EphemeralItem({ conversationId, ephemeral }: { conversationId: string, ephemeral: DEphemeral }) {

  const handleDelete = React.useCallback(() => {
    ConversationsManager.getHandler(conversationId).ephemeralsStore.delete(ephemeral.id);
  }, [conversationId, ephemeral.id]);

  return <Box
    sx={{
      p: { xs: 1, md: 2 },
      position: 'relative',
      // border: (i < ephemerals.length - 1) ? `2px solid ${theme.palette.divider}` : undefined,
      '&:hover > button': { opacity: 1 },
    }}>

    {/* Title */}
    {ephemeral.title && <Typography level='title-sm' sx={{ mb: 1.5 }}>
      {ephemeral.title} Development Tools
    </Typography>}

    {/* Vertical | split */}
    <Grid container spacing={2}>

      {/* Left pane (console) */}
      <Grid xs={12} md={ephemeral.state ? 6 : 12}>
        <Typography fontSize='smaller' sx={{ overflowWrap: 'anywhere', whiteSpace: 'break-spaces', lineHeight: lineHeightChatTextMd }}>
          {ephemeral.text}
        </Typography>
      </Grid>

      {/* Right pane (state) */}
      {!!ephemeral.state && <Grid
        xs={12} md={6}
        sx={{
          borderLeft: { md: `1px dashed` },
          borderTop: { xs: `1px dashed`, md: 'none' },
        }}>
        <StateRenderer state={ephemeral.state} />
      </Grid>}
    </Grid>

    {/* Close button (right of title) */}
    <IconButton
      size='sm'
      onClick={handleDelete}
      sx={{
        position: 'absolute', top: 8, right: 8,
        opacity: { xs: 1, sm: 0.5 }, transition: 'opacity 0.3s',
      }}>
      <CloseRoundedIcon />
    </IconButton>

  </Box>;
}

// const dashedBorderSVG = encodeURIComponent(`
//   <svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>
//     <rect x='0' y='0' width='100%' height='100%' fill='none' stroke='currentColor' stroke-width='2' stroke-dasharray='16, 2' />
//   </svg>
// `);


export function Ephemerals(props: { ephemerals: DEphemeral[], conversationId: DConversationId | null, sx?: SxProps }) {
  // global state
  // const ephemerals = useChatStore(state => {
  //   const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
  //   return conversation ? conversation.ephemerals : [];
  // }, shallow);

  const ephemerals = props.ephemerals;
  // if (!ephemerals?.length) return null;

  return (
    <Sheet
      variant='soft' color='success' invertedColors
      sx={{
        borderTop: '1px solid',
        borderTopColor: 'divider',
        // backgroundImage: `url("data:image/svg+xml,${dashedBorderSVG.replace('currentColor', '%23A1E8A1')}")`,
        // backgroundSize: '100% 100%',
        // backgroundRepeat: 'no-repeat',
        ...(props.sx || {}),
      }}>

      {ephemerals.map((ephemeral, i) =>
        props.conversationId && <EphemeralItem key={`ephemeral-${i}`} conversationId={props.conversationId} ephemeral={ephemeral} />)}

    </Sheet>
  );
}
