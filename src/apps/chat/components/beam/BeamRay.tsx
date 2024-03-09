import * as React from 'react';

import { Box, styled } from '@mui/joy';

import type { DLLMId } from '~/modules/llms/store-llms';
import { createDMessage } from '~/common/state/store-chats';
import { useLLMSelect, useLLMSelectLocalState } from '~/common/components/forms/useLLMSelect';

import { ChatMessageMemo } from '../message/ChatMessage';
import { SxProps } from '@mui/joy/styles/types';


const beamRayClasses = {
  active: 'beamRay-Active',
} as const;

const BeamRayCard = styled(Box)(({ theme }) => ({
  '--Card-padding': '1rem',

  padding: 'var(--Card-padding)',

  backgroundColor: theme.vars.palette.background.surface,

  border: '1px solid',
  borderColor: theme.vars.palette.neutral.outlinedBorder,
  borderRadius: theme.radius.md,

  [`&.${beamRayClasses.active}`]: {
    boxShadow: 'inset 0 0 0 2px #00f, inset 0 0 0 4px #00a',
  },

  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--Pad_2)',
}));
BeamRayCard.displayName = 'BeamRayCard';

const chatMessageSx: SxProps = {
  p: 0,
  m: 0,
  border: 'none',
  // border: '1px solid',
  // borderColor: 'neutral.outlinedBorder',
  // borderRadius: 'lg',
  // borderBottomRightRadius: 0,
  // boxShadow: 'sm',
} as const;


export function BeamRay(props: {
  index: number,
  parentLlmId: DLLMId | null,
  isMobile: boolean,
}) {

  const [personaLlmId, setPersonaLlmId] = useLLMSelectLocalState(false);
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(
    personaLlmId ?? props.parentLlmId,
    setPersonaLlmId,
    '',
    true,
  );

  const msg = React.useMemo(() => createDMessage('assistant', 'test'), []);

  return (
    <BeamRayCard>

      {allChatLlmComponent}

      <ChatMessageMemo message={msg} fitScreen={props.isMobile} sx={chatMessageSx} />

    </BeamRayCard>
  );
}