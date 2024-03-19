import * as React from 'react';
import type { SxProps } from '@mui/joy/styles/types';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { createDMessage } from '~/common/state/store-chats';

import type { BeamStoreApi } from './store-beam.hooks';
import { RayCard, rayCardClasses } from './BeamRay';


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


export function BeamFusion(props: {
  fusionIndex: number | null, isMobile: boolean, beamStore: BeamStoreApi
}) {

  return (
    <RayCard
      className={rayCardClasses.selectable}
      sx={fusionRayCardSx}
    >
      <ChatMessageMemo
        message={createDMessage('assistant', 'Gather the messages you want to merge.')}
        fitScreen={props.isMobile}
        showAvatar={false}
        adjustContentScaling={-1}
        sx={fusionChatMessageSx}
      />
    </RayCard>
  );
}