import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { ChatMessage } from '@/components/ChatMessage';
import { PurposeSelector } from '@/components/util/PurposeSelector';
import { createDMessage, DMessage, useChatStore } from '@/lib/store-chats';
import { useSettingsStore } from '@/lib/store-settings';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: { conversationId: string | null, onRestartConversation: (conversationId: string, history: DMessage[]) => void, sx?: SxProps }) {
  // state
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // external state
  const { freeScroll, showSystemMessages } = useSettingsStore(state => ({ freeScroll: state.freeScroll, showSystemMessages: state.showSystemMessages }), shallow);
  const { editMessage, deleteMessage } = useChatStore(state => ({ editMessage: state.editMessage, deleteMessage: state.deleteMessage }), shallow);
  const messages = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation ? conversation.messages : [];
  }, shallow);

  // when messages change, scroll to bottom (aka: at every new token)
  React.useEffect(() => {
    if (freeScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [freeScroll, messages]);


  const handleMessageDelete = (messageId: string) =>
    props.conversationId && deleteMessage(props.conversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    props.conversationId && editMessage(props.conversationId, messageId, { text: newText }, true);

  const handleRunFromMessage = (messageId: string) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
    props.conversationId && props.onRestartConversation(props.conversationId, truncatedHistory);
  };

  const handleRunPurposeExample = (text: string) =>
    props.conversationId && props.onRestartConversation(props.conversationId, [...messages, createDMessage('user', text)]);


  // hide system messages if the user chooses so
  const filteredMessages = messages.filter(m => m.role !== 'system' || showSystemMessages);

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length)
    return !props.conversationId ? null
      : <Box sx={props.sx || {}}>
        <PurposeSelector conversationId={props.conversationId} runExample={handleRunPurposeExample} />
      </Box>;

  return (
    <Box sx={props.sx || {}}>
      <List sx={{ p: 0 }}>

        {filteredMessages.map((message, idx) =>
          <ChatMessage
            key={'msg-' + message.id}
            message={message}
            isLast={idx === filteredMessages.length - 1}
            onMessageDelete={() => handleMessageDelete(message.id)}
            onMessageEdit={newText => handleMessageEdit(message.id, newText)}
            onMessageRunFrom={() => handleRunFromMessage(message.id)} />,
        )}

        <div ref={messagesEndRef}></div>
      </List>
    </Box>
  );
}