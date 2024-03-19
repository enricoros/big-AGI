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


export function BeamFusion(props: {
  fusionIndex: number | null,
  isMobile: boolean,
  beamStore: BeamStoreApi
}) {

  // external state
  const fusion = useBeamStore(props.beamStore, store => props.fusionIndex !== null ? store.fusions[props.fusionIndex] ?? null : null);

  if (!fusion)
    return null;

  return (
    <BeamCard
      className={beamCardClasses.selectable}
      sx={fusionRayCardSx}
    >
      <ChatMessageMemo
        message={fusion.outputMessage}
        fitScreen={props.isMobile}
        showAvatar={false}
        adjustContentScaling={-1}
        sx={fusionChatMessageSx}
      />
    </BeamCard>
  );
}