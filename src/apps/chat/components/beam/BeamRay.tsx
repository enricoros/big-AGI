import * as React from 'react';

import { Card } from '@mui/joy';
import { ChatMessageMemo } from '../message/ChatMessage';
import { createDMessage } from '~/common/state/store-chats';
import { useLLMSelect, useLLMSelectLocalState } from '~/common/components/forms/useLLMSelect';
import { DLLMId } from '~/modules/llms/store-llms';

// const beamClasses = {
//   active: 'beam-Active',
// } as const;
//
// const BeamSheet = styled(Sheet)(({ theme }) => ({
//   // --Bar is defined in InvertedBar
//   // '--MarginX': '0.25rem',
//
//   // active
//   [`&.${beamClasses.active}`]: {
//     // two inset shadows, one light blue and another deep blue
//     boxShadow: 'inset 0 0 0 2px #00f, inset 0 0 0 4px #00a',
//   },
// })) as typeof Sheet;


export function BeamRay(props: { parentLlmId: DLLMId | null, isMobile: boolean, children: React.ReactNode }) {

  const [personaLlmId, setPersonaLlmId] = useLLMSelectLocalState(false);
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(
    personaLlmId ?? props.parentLlmId,
    setPersonaLlmId,
    '',
    true,
  );

  const msg = createDMessage('assistant', 'test');

  return (
    <Card
      sx={{}}
    >

      {allChatLlmComponent}

      <ChatMessageMemo
        message={msg}
        fitScreen={props.isMobile}
        isBottom={true}
        sx={{
          p: 0,
          m: 0,
          border: 'none',
          // border: '1px solid',
          // borderColor: 'neutral.outlinedBorder',
          // borderRadius: 'lg',
          // borderBottomRightRadius: 0,
          // boxShadow: 'sm',
        }}
      />
    </Card>
  );
}