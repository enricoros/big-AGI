/*

THIS FILE IS A PLACEHOLDER for the DRAW App

import { DConversationId, DMessage } from '~/common/state/store-chats';
import { Sheet } from '@mui/joy';


export type PromptFXInput = {
  origin: {
    type: 'app-draw',
    singleGenRequestId: SingleGenRequest['id'],
  } | {
    type: 'chat',
    conversationId: DConversationId,
    messageId: DMessage['id'],
  },
  prompt: string,
}

interface SingleGenRequest {
  id: string,

}

interface MultiGenRequest {
  requests: SingleGenRequest[],
  requestIdx: number | null,
}


export type PromptFXOutput = {
  input: PromptFXInput,
  output: {
    promptMatrix: MultiGenRequest,
  }
}

interface IPromptFX {

  onCancel: () => void,
  onDone: (output: PromptFXOutput) => void,

}

function PromptFX(props: {}) {

  return <>

    <Sheet>
      a
    </Sheet>

  </>;
}


const usePromptFX = (input: PromptFXInput) => {



  return {
    test: 3,
    PromptFX,
  };
};
*/