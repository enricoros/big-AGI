import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography } from '@mui/joy';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import type { DMessage, DMessageId } from '~/common/stores/chat/chat.message';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { hasSystemMessageInHistory } from '~/common/stores/chat/chat.conversation';

import { BEAM_INVERT_BACKGROUND } from '../beam.config';
import { useModuleBeamStore } from '../store-module-beam';


const userMessageWrapperSx: SxProps = {
  mb: 'calc(-1 * var(--Pad))', // absorb parent 'gap' to next
  px: 'var(--Pad)',
  pt: 'var(--Pad)',

  // sticky user message, only displaced by the scatter controls
  // NOTE: disabled: should feel good but feels weird
  // position: 'sticky',
  // top: 0,
};

const userMessageWrapperINVSx: SxProps = {
  ...userMessageWrapperSx,
  backgroundColor: 'neutral.solidBg',
  pt: 0,
};

const userChatMessageSx: SxProps = {
  border: 'none',
  // border: '1px solid',
  // borderBottom: 'none',
  // borderColor: 'primary.outlinedBorder',
  borderRadius: 'md',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  // px: '0.5rem',
  pr: '0.125rem',
  // boxShadow: 'sm',
  // the following make it end-aligned
  // borderBottomRightRadius: 0,
  // borderRight: 'none',
  // px: 'var(--Pad)',
} as const;


export function BeamScatterInput(props: {
  isMobile: boolean,
  history: DMessage[] | null,
  onMessageFragmentReplace: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
}) {

  // state
  // const [showHistoryMessage, setShowHistoryMessage] = React.useState(true);

  // external state
  const scatterShowPrevMessages = useModuleBeamStore(state => state.scatterShowPrevMessages);

  // derived state

  const lastHistoryMessage = props.history?.slice(-1)[0] || null;

  const isFirstMessageSystem = hasSystemMessageInHistory(props.history || []);

  const otherHistoryCount = Math.max(0, (props.history?.length || 0) - 1);


  // user message decorator

  const userMessageDecorator = React.useMemo(() => {
    return (/*showHistoryMessage &&*/ otherHistoryCount >= 1 && scatterShowPrevMessages) ? (
      // <Chip color='primary' variant='outlined' endDecorator={<ChipDelete />} sx={{ my: 1 }}>
      <Typography level='body-xs' sx={{ my: 1, textAlign: 'center', color: 'neutral.softColor' }} onClick={undefined /*() => setShowHistoryMessage(on => !on)*/}>
        ... {otherHistoryCount === 1 ? (isFirstMessageSystem ? '1 system message' : '1 message') : `${otherHistoryCount} messages`} before this one ...
      </Typography>
      // </Chip>
    ) : null;
  }, [scatterShowPrevMessages, isFirstMessageSystem, otherHistoryCount/*, showHistoryMessage*/]);


  // skip rendering if no message
  if (!lastHistoryMessage)
    return null;

  return (
    <Box sx={BEAM_INVERT_BACKGROUND ? userMessageWrapperINVSx : userMessageWrapperSx}>
      <ChatMessageMemo
        message={lastHistoryMessage}
        fitScreen={props.isMobile}
        isMobile={props.isMobile}
        adjustContentScaling={-1}
        topDecorator={userMessageDecorator}
        onMessageFragmentReplace={props.onMessageFragmentReplace}
        sx={userChatMessageSx}
      />
    </Box>
  );
}