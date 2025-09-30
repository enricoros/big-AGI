import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';

import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './useFolderDropdown';
import { useModelParamsDropdowns } from './useModelParamsDropdowns';


export function ChatBarChat(props: {
  conversationId: DConversationId | null;
  llmDropdownRef: React.Ref<OptimaBarControlMethods>;
  personaDropdownRef: React.Ref<OptimaBarControlMethods>;
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown(props.llmDropdownRef);
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId, props.personaDropdownRef);
  const { folderDropdown } = useFolderDropdown(props.conversationId);
  const { verbosityDropdown, reasoningDropdown } = useModelParamsDropdowns();

  return <>

    {/* Persona selector */}
    {personaDropdown}

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Reasoning selector (conditional) */}
    {reasoningDropdown}

    {/* Verbosity selector (conditional) */}
    {verbosityDropdown}

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
