import * as React from 'react';

import type { DConversationId } from '~/common/state/store-chats';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';


export function ChatDropdowns(props: {
  conversationId: DConversationId | null
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown();
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId);

  return <>

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Persona selector */}
    {personaDropdown}

  </>;
}
