import * as React from 'react';

import type { DConversationId } from '~/common/state/store-chats';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './folders/useFolderDropdown';


export function ChatBarDropdowns(props: {
  conversationId: DConversationId | null
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown();
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId);
  const { folderDropdown } = useFolderDropdown(props.conversationId);

  return <>

    {/* Persona selector */}
    {personaDropdown}

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
