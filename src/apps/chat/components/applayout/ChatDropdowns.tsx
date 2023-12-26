import * as React from 'react';

import type { DConversationId } from '~/common/state/store-chats';
import { DFolder } from '~/common/state/store-folders';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './useFolderDropdown';


export function ChatDropdowns(props: {
  conversationId: DConversationId | null
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown();
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId);
  const { folderDropdown } = useFolderDropdown(props.conversationId);

  return <>

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Persona selector */}
    {personaDropdown}

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
