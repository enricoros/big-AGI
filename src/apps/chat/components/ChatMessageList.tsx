import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { createDMessage, DMessage, useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';

import { ChatMessage } from './message/ChatMessage';
import { ChatMessageSelectable, MessagesSelectionHeader } from './message/ChatMessageSelectable';
import { PurposeSelector } from './PurposeSelector';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: { conversationId: string | null, isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void, onExecuteConversation: (conversationId: string, history: DMessage[]) => void, onImagineFromText: (conversationId: string, userText: string) => void, sx?: SxProps }) {
  // state
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
  const showSystemMessages = useSettingsStore(state => state.showSystemMessages);
  const { editMessage, deleteMessage } = useChatStore(state => ({ editMessage: state.editMessage, deleteMessage: state.deleteMessage }), shallow);
  const messages = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation ? conversation.messages : [];
  }, shallow);


  const handleMessageDelete = (messageId: string) =>
    props.conversationId && deleteMessage(props.conversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    props.conversationId && editMessage(props.conversationId, messageId, { text: newText }, true);

  const handleImagineFromText = (messageText: string) =>
    props.conversationId && props.onImagineFromText(props.conversationId, messageText);

  const handleRestartFromMessage = (messageId: string, offset: number) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
    props.conversationId && props.onExecuteConversation(props.conversationId, truncatedHistory);
  };

  const handleRunExample = (text: string) =>
    props.conversationId && props.onExecuteConversation(props.conversationId, [...messages, createDMessage('user', text)]);


  // hide system messages if the user chooses so
  // NOTE: reverse is because we'll use flexDirection: 'column-reverse' to auto-snap-to-bottom
  const filteredMessages = messages.filter(m => m.role !== 'system' || showSystemMessages).reverse();

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length)
    return props.conversationId ? (
      <Box sx={props.sx || {}}>
        <PurposeSelector conversationId={props.conversationId} runExample={handleRunExample} />
      </Box>
    ) : null;


  const handleToggleSelected = (messageId: string, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  };

  const handleSelectAllMessages = (selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (let message of messages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleDeleteSelectedMessages = () => {
    if (props.conversationId)
      for (let selectedMessage of selectedMessages)
        deleteMessage(props.conversationId, selectedMessage);
    setSelectedMessages(new Set());
  };


  // scrollbar style
  // const scrollbarStyle: SxProps = {
  //   '&::-webkit-scrollbar': {
  //     md: {
  //       width: 8,
  //       background: theme.vars.palette.neutral.plainHoverBg,
  //     },
  //   },
  //   '&::-webkit-scrollbar-thumb': {
  //     background: theme.vars.palette.neutral.solidBg,
  //     borderRadius: 6,
  //   },
  //   '&::-webkit-scrollbar-thumb:hover': {
  //     background: theme.vars.palette.neutral.solidHoverBg,
  //   },
  // };

  return (
    <List sx={{
      p: 0, ...(props.sx || {}),
      // this makes sure that the the window is scrolled to the bottom (column-reverse)
      display: 'flex', flexDirection: 'column-reverse',
      // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
      marginBottom: '-1px',
    }}>

      {filteredMessages.map((message, idx) =>
        props.isMessageSelectionMode ? (
          <ChatMessageSelectable
            key={'sel-' + message.id} message={message}
            isBottom={idx === 0}
            selected={selectedMessages.has(message.id)} onToggleSelected={handleToggleSelected}
          />
        ) : (
          <ChatMessage
            key={'msg-' + message.id} message={message}
            isBottom={idx === 0}
            onMessageDelete={() => handleMessageDelete(message.id)}
            onMessageEdit={newText => handleMessageEdit(message.id, newText)}
            onMessageRunFrom={(offset: number) => handleRestartFromMessage(message.id, offset)}
            onImagine={handleImagineFromText} />
        ),
      )}

      {/* Header at the bottom because of 'row-reverse' */}
      {props.isMessageSelectionMode && (
        <MessagesSelectionHeader
          hasSelected={selectedMessages.size > 0}
          isBottom={filteredMessages.length === 0}
          onClose={() => props.setIsMessageSelectionMode(false)}
          onSelectAll={handleSelectAllMessages}
          onDeleteMessages={handleDeleteSelectedMessages}
        />
      )}

    </List>
  );
}