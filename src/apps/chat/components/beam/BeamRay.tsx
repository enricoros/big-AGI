import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, styled, Tooltip } from '@mui/joy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import type { DLLMId } from '~/modules/llms/store-llms';
import { ConversationHandler } from '~/common/chats/ConversationHandler';
import { createDMessage } from '~/common/state/store-chats';
import { useBeamStoreBeam } from '~/common/chats/store-beam';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { ChatMessageMemo } from '../message/ChatMessage';


const rayCardClasses = {
  active: 'beamRay-Active',
} as const;

export const RayCard = styled(Box)(({ theme }) => ({
  '--Card-padding': '1rem',

  padding: 'var(--Card-padding)',

  backgroundColor: theme.vars.palette.background.surface,

  border: '1px solid',
  borderColor: theme.vars.palette.neutral.outlinedBorder,
  borderRadius: theme.radius.md,

  [`&.${rayCardClasses.active}`]: {
    boxShadow: 'inset 0 0 0 2px #00f, inset 0 0 0 4px #00a',
  },

  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--Pad_2)',
}));
RayCard.displayName = 'RayCard';


const chatMessageEmbeddedSx: SxProps = {
  // style: to undo the style of ChatMessage
  border: 'none',
  m: 0,
  px: 0,
  py: 0,
} as const;


export function BeamRay(props: {
  conversationHandler: ConversationHandler
  index: number,
  isMobile: boolean,
  gatherLlmId: DLLMId | null,
}) {

  // external state
  const { beam, setRayLlmId, clearRayLlmId } = useBeamStoreBeam(props.conversationHandler, props.index);

  const isLinked = !!props.gatherLlmId && !beam.scatterLlmId;

  const [allChatLlm, allChatLlmComponent] = useLLMSelect(
    isLinked ? props.gatherLlmId : beam.scatterLlmId,
    setRayLlmId,
    '',
    true,
  );

  const msg = React.useMemo(() => createDMessage('assistant', 'test'), []);

  return (
    <RayCard>

      {/* Controls Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton disabled size='sm' sx={undefined /*{ ml: 'calc(-0.5 * var(--Card-padding))' }*/}>
          <DragIndicatorIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          {allChatLlmComponent}
        </Box>
        <Tooltip title={isLinked ? undefined : 'Link Model'}>
          <IconButton disabled={isLinked} size='sm' onClick={clearRayLlmId}>
            {isLinked ? <LinkIcon /> : <LinkOffIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <ChatMessageMemo
        message={msg}
        fitScreen={props.isMobile}
        showAvatar={false}
        adjustContentScaling={-1}
        sx={chatMessageEmbeddedSx}
      />

    </RayCard>
  );
}