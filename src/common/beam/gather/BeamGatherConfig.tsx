import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography } from '@mui/joy';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { createDMessage } from '~/common/state/store-chats';

import type { TInstruction } from './beam.gather';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_DEBUG_NONCUSTOM } from '../beam.config';


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

function InstructionWrapper(props: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', mx: 'var(--Pad)' }}>
      {props.children}
    </Box>
  );
}


function ReadOnlyInstruction(props: { instruction: TInstruction, isMobile: boolean }) {
  const { instruction } = props;

  // render 'chat-generate'
  if (instruction.type === 'chat-generate') {
    return (
      <InstructionWrapper>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
      </InstructionWrapper>
    );
  }

  // render 'user-input-checklist'
  if (instruction.type === 'user-input-checklist') {
    return (
      <InstructionWrapper>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography level='body-xs'>
            Checklist:
          </Typography>
          <ChatMessageMemo
            message={createDMessage('assistant', '#### Test\n- [ ] test\n- [ ] ...')}
            fitScreen={props.isMobile}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={configChatInstructionSx}
          />
        </Box>
      </InstructionWrapper>
    );
  }

  return (
    <InstructionWrapper>
      <Typography level='body-xs'>
        Unknown Instruction
      </Typography>
    </InstructionWrapper>
  );
}


export function BeamGatherConfig(props: {
  beamStore: BeamStoreApi
  isMobile: boolean,
}) {

  // state
  // const [viewInstructionIndex, setViewInstructionIndex] = React.useState(0);

  // external state
  const fusion = useBeamStore(props.beamStore, store => {
    const fusion = store.fusionIndex !== null ? store.fusions[store.fusionIndex] ?? null : null;
    return (fusion?.isEditable || GATHER_DEBUG_NONCUSTOM) ? fusion : null;
  });

  // // [effect] sync the fusion program index to the viewInstructionIndex
  // React.useEffect(() => {
  //   fusion && setViewInstructionIndex(fusion.currentInstructionIndex);
  // }, [fusion]);

  // derived state
  // const instructions = React.useMemo(() => {
  //   return fusion?.instructions ?? null;
  // }, [fusion]);

  const instructions = fusion?.instructions ?? null;

  return !!instructions?.length ? (
    <Box sx={gatherConfigWrapperSx}>
      {instructions.map((instruction, stepIndex) =>
        <ReadOnlyInstruction key={'step-' + stepIndex} instruction={instruction} isMobile={props.isMobile} />,
      )}
    </Box>
  ) : null;
}