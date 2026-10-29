import * as React from 'react';

import { useIsBeamOpenForConversation } from '~/modules/beam/store-module-beam';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { useConversationTitle } from '~/common/stores/chat/hooks/useConversationTitle';

import { ChatBarBeam } from './ChatBarBeam';
import { ChatBarChat } from './ChatBarChat';


export const ChatToolbarMemo = React.memo(ChatToolbar);

/**
 * Toolbar of the focused chat: derives its state from the conversation id, so AppChat does not re-render for it.
 */
function ChatToolbar(props: {
  conversationId: DConversationId | null,
  isMobile: boolean,
  llmDropdownRef: React.Ref<OptimaBarControlMethods>,
  personaDropdownRef: React.Ref<OptimaBarControlMethods>,
}) {

  // external state
  const cHandler = React.useMemo(() => !props.conversationId ? null : ConversationsManager.getHandler(props.conversationId), [props.conversationId]);
  const { title } = useConversationTitle(props.conversationId);
  const isBeamOpen = useIsBeamOpenForConversation(props.conversationId);

  // Alt: Beam bar
  if (isBeamOpen && cHandler)
    return <ChatBarBeam conversationTitle={title ?? 'No Chat'} beamStore={cHandler.getBeamStore()} isMobile={props.isMobile} />;

  // Chat bar
  return (
    <ChatBarChat
      conversationId={props.conversationId}
      llmDropdownRef={props.llmDropdownRef}
      personaDropdownRef={props.personaDropdownRef}
    />
  );
}
