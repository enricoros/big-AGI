import * as React from 'react';
import type { SxProps } from '@mui/joy/styles/types';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { BeamCard, beamCardClasses } from '../BeamCard';


const fusionRayCardSx: SxProps = {
  mx: 'var(--Pad)',
  mt: 'calc(-1 * var(--Pad))', // absorb gap to the prev-bottom

  // boxShadow: 'sm',
  // borderColor: 'success.outlinedBorder',
  borderTop: 'none',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
};

const fusionChatMessageSx: SxProps = {
  // style: to undo the style of ChatMessage
  backgroundColor: 'none',
  border: 'none',
  mx: -1.5, // compensates for the marging (e.g. RenderChatText, )
  my: 0,
  px: 0,
  py: 0,
} as const;


// const placeholderMessage = createDMessage('assistant', 'Click the Merge button to combine the Beams.');


export function BeamGatherOutput(props: {
  isMobile: boolean,
  beamStore: BeamStoreApi
}) {

  // external state
  const currentFusion = useBeamStore(props.beamStore, store => store.currentFusionId !== null ? store.fusions.find(fusion => fusion.fusionId === store.currentFusionId) ?? null : null);

  if (!currentFusion)
    return null;

  return (
    <BeamCard
      className={beamCardClasses.selectable}
      sx={fusionRayCardSx}
    >
      <ChatMessageMemo
        message={currentFusion.outputMessage}
        fitScreen={props.isMobile}
        showAvatar={false}
        adjustContentScaling={-1}
        sx={fusionChatMessageSx}
      />
    </BeamCard>
  );
}