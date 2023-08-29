import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { useChatLLM } from '~/modules/llms/store-llms';

import { createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatMessage } from './message/ChatMessage';
import { CleanerMessage, MessagesSelectionHeader } from './message/CleanerMessage';
import { PersonaSelector } from './persona-selector/PersonaSelector';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: string | null,
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onExecuteChatHistory: (conversationId: string, history: DMessage[]) => void,
  onImagineFromText: (conversationId: string, userText: string) => void,
  sx?: SxProps
}) {
  // state
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
  const showSystemMessages = useUIPreferencesStore(state => state.showSystemMessages);
  const { messages, editMessage, deleteMessage, historyTokenCount } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      messages: conversation ? conversation.messages : [],
      editMessage: state.editMessage, deleteMessage: state.deleteMessage,
      historyTokenCount: conversation ? conversation.tokenCount : 0,
    };
  }, shallow);
  const { chatLLM } = useChatLLM();

  const handleMessageDelete = (messageId: string) =>
    props.conversationId && deleteMessage(props.conversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    props.conversationId && editMessage(props.conversationId, messageId, { text: newText }, true);

  const handleImagineFromText = (messageText: string) =>
    props.conversationId && props.onImagineFromText(props.conversationId, messageText);

  const handleRestartFromMessage = (messageId: string, offset: number) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + offset + 1);
    props.conversationId && props.onExecuteChatHistory(props.conversationId, truncatedHistory);
  };

  const handleRunExample = (text: string) =>
    props.conversationId && props.onExecuteChatHistory(props.conversationId, [...messages, createDMessage('user', text)]);


  // hide system messages if the user chooses so
  // NOTE: reverse is because we'll use flexDirection: 'column-reverse' to auto-snap-to-bottom
  const filteredMessages = messages.filter(m => m.role !== 'system' || showSystemMessages).reverse();

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length)
    return props.conversationId ? (
      <Box sx={props.sx || {}}>
        <PersonaSelector conversationId={props.conversationId} runExample={handleRunExample} />
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
      for (const message of messages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleDeleteSelectedMessages = () => {
    if (props.conversationId)
      for (const selectedMessage of selectedMessages)
        deleteMessage(props.conversationId, selectedMessage);
    setSelectedMessages(new Set());
  };


  // scrollbar style
  // const scrollbarStyle: SxProps = {
  //   '&::-webkit-scrollbar': {
  //     md: {
  //       width: 8,
  //       background: theme.palette.neutral.plainHoverBg,
  //     },
  //   },
  //   '&::-webkit-scrollbar-thumb': {
  //     background: theme.palette.neutral.solidBg,
  //     borderRadius: 6,
  //   },
  //   '&::-webkit-scrollbar-thumb:hover': {
  //     background: theme.palette.neutral.solidHoverBg,
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

          <CleanerMessage
            key={'sel-' + message.id} message={message}
            isBottom={idx === 0} remainingTokens={(chatLLM ? chatLLM.contextTokens : 0) - historyTokenCount}
            selected={selectedMessages.has(message.id)} onToggleSelected={handleToggleSelected}
          />

        ) : (

          <ChatMessage
            key={'msg-' + message.id} message={message}
            isBottom={idx === 0}
            onMessageDelete={() => handleMessageDelete(message.id)}
            onMessageEdit={newText => handleMessageEdit(message.id, newText)}
            onMessageRunFrom={(offset: number) => handleRestartFromMessage(message.id, offset)}
            onImagine={handleImagineFromText}
          />

        ),
      )}

      {/* Header at the bottom because of 'row-reverse' */}
      {props.isMessageSelectionMode && (
        <MessagesSelectionHeader
          hasSelected={selectedMessages.size > 0}
          isBottom={filteredMessages.length === 0}
          sumTokens={historyTokenCount}
          onClose={() => props.setIsMessageSelectionMode(false)}
          onSelectAll={handleSelectAllMessages}
          onDeleteMessages={handleDeleteSelectedMessages}
        />
      )}

    </List>
  );
}