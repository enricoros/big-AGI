import * as React from 'react';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { DMessage, DMessageId, MESSAGE_FLAG_AIX_SKIP, messageHasUserFlag } from '~/common/stores/chat/chat.message';

import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';


/**
 * Cleanup controls and message selection. The parent retains selection across cleanup sessions.
 */
export function ChatCleanupControls(props: {
  isMobile: boolean,
  conversationHandler: Pick<ConversationHandler, 'messagesDelete' | 'messageSetUserFlag'> | null,
  conversationMessages: ReadonlyArray<DMessage>,
  filteredMessages: ReadonlyArray<DMessage>,
  historyTokenCount: number,
  remainingTokens?: number,
  selectedMessages: ReadonlySet<DMessageId>,
  setSelectedMessages: (selectedMessages: Set<DMessageId>) => void,
  onClose: () => void,
}) {

  const { showPromisedOverlay } = useOverlayComponents();

  // derived state
  const { conversationHandler, conversationMessages, historyTokenCount, onClose, selectedMessages, setSelectedMessages } = props;

  const areAllSelectedMessagesHidden = React.useMemo(() => {
    if (selectedMessages.size === 0) return false;
    for (const messageId of selectedMessages) {
      const message = conversationMessages.find(m => m.id === messageId);
      if (message && !messageHasUserFlag(message, MESSAGE_FLAG_AIX_SKIP))
        return false;
    }
    return true;
  }, [selectedMessages, conversationMessages]);


  // handlers

  const handleSelectAll = React.useCallback((selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (const message of conversationMessages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  }, [conversationMessages, setSelectedMessages]);

  const handleSelectMessage = React.useCallback((messageId: DMessageId, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  }, [selectedMessages, setSelectedMessages]);

  const handleSelectionDelete = React.useCallback(async () => {
    if (!conversationHandler || !selectedMessages.size) return;
    const messageIds = Array.from(selectedMessages);
    const confirmed = await showPromisedOverlay('chat-message-delete-confirmation', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Delete Messages'
        confirmationText={`Permanently delete ${messageIds.length} selected message${messageIds.length === 1 ? '' : 's'}? This cannot be undone.`}
        positiveActionText='Delete'
      />,
    );
    if (!confirmed) return;
    conversationHandler.messagesDelete(messageIds);
    setSelectedMessages(new Set());
  }, [conversationHandler, selectedMessages, setSelectedMessages, showPromisedOverlay]);

  const handleSelectionToggleVisibility = React.useCallback(() => {
    for (let selectedMessage of Array.from(selectedMessages))
      conversationHandler?.messageSetUserFlag(selectedMessage, MESSAGE_FLAG_AIX_SKIP, !areAllSelectedMessagesHidden, true);
    setSelectedMessages(new Set());
  }, [conversationHandler, selectedMessages, setSelectedMessages, areAllSelectedMessagesHidden]);


  const handleDeleteMessage = React.useCallback((messageId: DMessageId) => {
    conversationHandler?.messagesDelete([messageId]);
    if (selectedMessages.has(messageId)) {
      const newSelected = new Set(selectedMessages);
      newSelected.delete(messageId);
      setSelectedMessages(newSelected);
    }
  }, [conversationHandler, selectedMessages, setSelectedMessages]);


  return <>

    <MessagesSelectionHeader
      hasSelected={selectedMessages.size > 0}
      sumTokens={historyTokenCount}
      onClose={onClose}
      onSelectAll={handleSelectAll}
      onDeleteMessages={handleSelectionDelete}
      onToggleVisibility={handleSelectionToggleVisibility}
      areAllMessagesHidden={areAllSelectedMessagesHidden}
    />

    {props.filteredMessages.map((message) => (
      <CleanerMessage
        key={'sel-' + message.id}
        message={message}
        remainingTokens={props.remainingTokens}
        selected={selectedMessages.has(message.id)} onToggleSelected={handleSelectMessage}
        onDeleteMessage={props.isMobile || !conversationHandler ? undefined : handleDeleteMessage}
      />
    ))}

  </>;
}
