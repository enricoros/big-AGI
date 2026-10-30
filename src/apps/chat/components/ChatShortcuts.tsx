import * as React from 'react';

import { useIsBeamOpenForConversation } from '~/modules/beam/store-module-beam';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { useConversationIsEmpty, useConversationLastMessageRole } from '~/common/stores/chat/hooks/app-chat/useConversationAppChat';


export const ChatShortcutsMemo = React.memo(ChatShortcuts);

/**
 * Shortcuts gated on the content and the Beam state of the focused chat. Subscribes by id, so AppChat does not
 * re-render for it, and registers the entries reactively, so the StatusBar shows them only when they apply. Renders nothing.
 */
function ChatShortcuts(props: {
  conversationId: DConversationId | null,
  llmDropdownRef: React.RefObject<OptimaBarControlMethods>,
  personaDropdownRef: React.RefObject<OptimaBarControlMethods>,
  onConversationReset: (conversationId: DConversationId) => Promise<void>,
  onConversationSave: (conversationId: DConversationId | null) => void,
  onConversationsImport: () => Promise<void>,
  onMessageBeamLast: () => Promise<unknown>,
  onMessageRegenerateLast: () => Promise<void>,
}) {

  // external state
  const isBeamOpen = useIsBeamOpenForConversation(props.conversationId);
  const isEmpty = useConversationIsEmpty(props.conversationId);
  const lastMessageRole = useConversationLastMessageRole(props.conversationId);

  // derived state
  const canRegenerate = lastMessageRole === 'user' || lastMessageRole === 'assistant';

  const { conversationId, llmDropdownRef, personaDropdownRef, onConversationReset, onConversationSave, onConversationsImport, onMessageBeamLast, onMessageRegenerateLast } = props;

  useGlobalShortcuts('ChatShortcuts', React.useMemo(() => [
    // focused conversation shortcuts (disabled when Beam is open)
    ...(isBeamOpen ? [/* disable all shortcuts when Beam is open */] : [
      ...(!isEmpty ? [
        ...(canRegenerate ? [
          { key: 'z', ctrl: true, shift: true, action: onMessageRegenerateLast, description: 'Retry' },
          { key: 'b', ctrl: true, shift: true, action: onMessageBeamLast, description: 'Beam Edit' },
        ] : []),
        { key: 'x', ctrl: true, shift: true, action: () => isEmpty || (conversationId && onConversationReset(conversationId)) },
      ] : []),
      { key: 'o', ctrl: true, action: onConversationsImport },
      { key: 's', ctrl: true, action: () => onConversationSave(conversationId) },
      // open the dropdowns
      { key: 'p', ctrl: true, action: () => personaDropdownRef.current?.openListbox() /*, description: 'Open Persona Dropdown'*/ },
      { key: 'l', ctrl: true, action: () => llmDropdownRef.current?.openListbox() /*, description: 'Open Models Dropdown'*/ },
    ]),
  ], [canRegenerate, conversationId, isBeamOpen, isEmpty, llmDropdownRef, onConversationReset, onConversationSave, onConversationsImport, onMessageBeamLast, onMessageRegenerateLast, personaDropdownRef]));

  return null;
}
