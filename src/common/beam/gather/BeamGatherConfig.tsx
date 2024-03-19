import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography } from '@mui/joy';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { createDMessage } from '~/common/state/store-chats';
import { BeamStoreApi, useBeamStore } from '~/common/beam/store-beam.hooks';
import { GATHER_DEBUG_NONCUSTOM } from '~/common/beam/beam.config';


const gatherConfigWrapperSx: SxProps = {
  mx: 'var(--Pad)',
  // px: '0.5rem',
  mb: 'calc(-1 * var(--Pad))', // absorb gap to the next-top

  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,

  // backgroundColor: 'background.surface',
  backgroundColor: 'success.softBg',
  overflow: 'hidden',
};

const configChatInstructionSx: SxProps = {
  backgroundColor: 'transparent',
  borderBottom: 'none',
  px: '0.25rem',
  flex: 1,
};


export function BeamGatherConfig(props: {
  beamStore: BeamStoreApi
  isMobile: boolean,
}) {

  // state
  const [viewInstructionIndex, setViewInstructionIndex] = React.useState(0);

  // external state
  const fusion = useBeamStore(props.beamStore, store => {
    const fusion = store.fusionIndex !== null ? store.fusions[store.fusionIndex] ?? null : null;
    return (fusion?.isEditable || GATHER_DEBUG_NONCUSTOM) ? fusion : null;
  });


  // [effect] sync the fusion program index to the viewInstructionIndex
  React.useEffect(() => {
    fusion && setViewInstructionIndex(fusion.currentInstructionIndex);
  }, [fusion]);


  // derived state
  const instruction = React.useMemo(() => {
    return fusion?.instructions[viewInstructionIndex] ?? null;
  }, [fusion, viewInstructionIndex]);


  // render instruction
  const instructionComponent = React.useMemo(() => {
    if (instruction && instruction.type === 'chat-generate') {
      return <>
        {instruction.systemPrompt && (
          <Box sx={{ display: 'flex', alignItems: 'center', mx: 'var(--Pad)' }}>
            <Typography level='body-xs'>
              System Prompt:
            </Typography>
            <ChatMessageMemo
              message={createDMessage('assistant', instruction.systemPrompt)}
              fitScreen={props.isMobile}
              showAvatar={false}
              adjustContentScaling={-1}
              sx={configChatInstructionSx}
            />
          </Box>
        )}
        {instruction.userPrompt && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 'var(--Pad)' }}>
            <Typography level='body-xs'>
              User Prompt:
            </Typography>
            <ChatMessageMemo
              message={createDMessage('assistant', instruction.userPrompt)}
              fitScreen={props.isMobile}
              showAvatar={false}
              adjustContentScaling={-1}
              sx={configChatInstructionSx}
            />

          </Box>
        )}
      </>;
    }
    return null;
  }, [instruction, props.isMobile]);


  if (!instructionComponent)
    return null;

  return (
    <Box sx={gatherConfigWrapperSx}>
      {instructionComponent}
    </Box>
  );
}