import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { useConversationTitle } from '~/common/stores/chat/hooks/useConversationTitle';

import { CHAT_NOVEL_TITLE } from '../../AppChat';
import { useChatShowToolbarNavigation } from '../../store-app-chat';

import { ChatBarBreadcrumbs } from './ChatBarBreadcrumbs';
import { useChatLLMDropdown } from './useLLMDropdown';
import { usePersonaIdDropdown } from './usePersonaDropdown';
import { useFolderDropdown } from './useFolderDropdown';


export function ChatBarChat(props: {
  conversationId: DConversationId | null;
  llmDropdownRef: React.Ref<OptimaBarControlMethods>;
  personaDropdownRef: React.Ref<OptimaBarControlMethods>;
}) {

  // state
  const showNavigation = useChatShowToolbarNavigation();
  const { title } = useConversationTitle(props.conversationId);
  const { chatLLMDropdown } = useChatLLMDropdown(props.llmDropdownRef);
  const { personaDropdown } = usePersonaIdDropdown(props.conversationId, props.personaDropdownRef);
  const { folderDropdown } = useFolderDropdown(props.conversationId);

  return <>

    {/* Context breadcrumbs (chat title leaf; future parent/sub-context crumbs) - left of the selectors so the group stays centered */}
    {showNavigation && (
      <ChatBarBreadcrumbs
        conversationId={props.conversationId}
        conversationTitle={title ?? CHAT_NOVEL_TITLE}
      />
    )}

    {/* Persona selector */}
    {personaDropdown}

    {/* Model selector */}
    {chatLLMDropdown}

    {/* Folder selector */}
    {folderDropdown}

  </>;
}
