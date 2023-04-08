import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { ChatMessage } from '@/components/ChatMessage';
import { DMessage, useActiveConversation, useChatStore } from '@/lib/store-chats';
import { PurposeSelector } from '@/components/util/PurposeSelector';
import { useSettingsStore } from '@/lib/store-settings';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: { disableSend: boolean, sx?: SxProps, runAssistant: (conversationId: string, history: DMessage[]) => void }) {
  // state
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // external state
  const { id: activeConversationId, messages } = useActiveConversation();
  const { editMessage, deleteMessage } = useChatStore(state => ({ editMessage: state.editMessage, deleteMessage: state.deleteMessage }), shallow);
  const { freeScroll, showSystemMessages } = useSettingsStore(state => ({ freeScroll: state.freeScroll, showSystemMessages: state.showSystemMessages }), shallow);


  // when messages change, scroll to bottom (aka: at every new token)
  React.useEffect(() => {
    if (freeScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [freeScroll, messages]);

  // hide system messages if the user chooses so
  const filteredMessages = messages
    .filter(m => m.role !== 'system' || showSystemMessages);

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length) return (
    <Box sx={props.sx || {}}>
      <PurposeSelector />
    </Box>
  );


  const handleMessageDelete = (messageId: string) =>
    deleteMessage(activeConversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    editMessage(activeConversationId, messageId, { text: newText }, true);

  const handleMessageRunAgain = (messageId: string) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
    props.runAssistant(activeConversationId, truncatedHistory);
  };


  return (
    <Box sx={props.sx || {}}>
      <List sx={{ p: 0 }}>

        {filteredMessages.map((message, idx) =>
          <ChatMessage
            key={'msg-' + message.id}
            message={message}
            disableSend={props.disableSend}
            lastMessage={idx === filteredMessages.length - 1}
            onDelete={() => handleMessageDelete(message.id)}
            onEdit={newText => handleMessageEdit(message.id, newText)}
            onRunAgain={() => handleMessageRunAgain(message.id)} />,
        )}

        <div ref={messagesEndRef}></div>
      </List>
    </Box>
  );
}