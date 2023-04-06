import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { Box, List, Button, Typography, Switch } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import { ChatMessage } from '@/components/ChatMessage';
import { DMessage, useActiveConversation, useChatStore } from '@/lib/store-chats';
import { useSettingsStore } from '@/lib/store-settings';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export function ChatMessageList(props: { disableSend: boolean, sx?: SxProps, runAssistant: (conversationId: string, history: DMessage[]) => void }) {
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const { id: activeConversationId, messages } = useActiveConversation();
  const { editMessage, deleteMessage } = useChatStore(state => ({ editMessage: state.editMessage, deleteMessage: state.deleteMessage }), shallow);
  const { freeScroll, setFreeScroll, showSystemMessages } = useSettingsStore(state => ({ freeScroll: state.freeScroll, setFreeScroll: state.setFreeScroll, showSystemMessages: state.showSystemMessages }));
  const [nearBottom, setNearBottom] = React.useState(false);
  

  React.useEffect(() => {
    const endRefCurrent = messagesEndRef.current
    const handleObserver: IntersectionObserverCallback = (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        setNearBottom(true);
        // setFreeScroll(false);
      } else {
        setNearBottom(false);
      }
    };

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '0px',
      threshold: 1.0,
    });

    if (messagesEndRef.current) {
      observer.observe(messagesEndRef.current);
    }

    return () => {
      if (endRefCurrent) {
        observer.unobserve(endRefCurrent);
      }
    };
  }, [messagesEndRef]);
  
  const handleScrollModeToggle = () => setFreeScroll(!freeScroll);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    console.debug('wtf')
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 0;
    console.debug('isnearbottom', isNearBottom)
    setNearBottom(isNearBottom);
    setFreeScroll(!isNearBottom);
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setFreeScroll(false);
  };

  React.useEffect(() => {
    if (freeScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [freeScroll, messages]);

  const filteredMessages = messages.filter(m => m.role !== 'system' || showSystemMessages);

  const handleMessageDelete = (messageId: string) => deleteMessage(activeConversationId, messageId);
  const handleMessageEdit = (messageId: string, newText: string) => editMessage(activeConversationId, messageId, { text: newText }, true);
  const handleMessageRunAgain = (messageId: string) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
    props.runAssistant(activeConversationId, truncatedHistory);
  };

  return (
    <Box sx={props.sx || {}}>
      <List
        sx={{
          p: 0,
          maxHeight: '100%', // Adjust the height as needed
          overflowY: 'auto',
          ...props.sx,
        }}
      >
        {filteredMessages.map(message =>
          <ChatMessage
            key={'msg-' + message.id} message={message} disableSend={props.disableSend}
            onDelete={() => handleMessageDelete(message.id)}
            onEdit={newText => handleMessageEdit(message.id, newText)}
            onRunAgain={() => handleMessageRunAgain(message.id)} />,
        )}
        <div ref={messagesEndRef}></div>
      </List>
        {!nearBottom ? (
            <Button
              color="primary"
              onClick={scrollToBottom}
              sx={{
                position: 'fixed',
                bottom: 200,
                right: 16,
                borderRadius: '50%',
                minWidth: 'auto',
                minHeight: 'auto',
                padding: '8px',
              }}
            >
              <ArrowDownwardIcon />
            </Button>
        ) : (
          <Box sx={{
            position: 'fixed',
            bottom: 200,
            right: 16,
            borderRadius: '50%',
            minWidth: 'auto',
            minHeight: 'auto',
            padding: '8px',
          }}>
             Free scroll
            <Switch checked={freeScroll} onChange={handleScrollModeToggle} sx={{ ml: 'auto' }} />
          </Box>
        )}
    </Box>
  );
}