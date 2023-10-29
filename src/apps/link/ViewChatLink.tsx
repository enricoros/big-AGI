import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, Card, List, ListItem, Tooltip, Typography } from '@mui/joy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessage } from '../chat/components/message/ChatMessage';

import { Brand } from '~/common/brand';
import { conversationTitle, DConversation, useChatStore } from '~/common/state/store-chats';
import { navigateToChat } from '~/common/routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';


/**
 * Renders a chat link view with conversation details and messages.
 */
export function ViewChatLink(props: { conversation: DConversation, storedAt: Date, expiresAt: Date | null }) {

  // state
  const [cloning, setCloning] = React.useState<boolean>(false);
  const listBottomRef = React.useRef<HTMLDivElement>(null);

  // external state
  const showSystemMessages = useUIPreferencesStore(state => state.showSystemMessages);
  const hasExistingChat = useChatStore(state => state.conversations.some(c => c.id === props.conversation.id));

  // derived state
  const messages = props.conversation.messages;
  const filteredMessages = messages.filter(m => m.role !== 'system' || showSystemMessages);
  const hasMessages = filteredMessages.length > 0;


  // Effect: Turn on Markdown (globally) if there are tables in the chat

  React.useEffect(() => {
    const { renderMarkdown, setRenderMarkdown } = useUIPreferencesStore.getState();
    if (!renderMarkdown) {
      const hasMarkdownTables = messages.some(m => m.text.includes('|---'));
      if (hasMarkdownTables) {
        setRenderMarkdown(true);
        console.log('Turning on Markdown because of tables');
      }
    }
  }, [messages]);

  // Effect: Scroll to bottom of list when messages change

  /*React.useEffect(() => {
    setTimeout(() => {
      if (listBottomRef.current)
        listBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 1000);
  }, [messages]);*/


  const handleClone = async (canOverwrite: boolean) => {
    setCloning(true);
    useChatStore.getState().importConversation({ ...props.conversation }, !canOverwrite);
    await navigateToChat();
    setCloning(false);
  };


  return (

    <Box sx={{
      flexGrow: 1,
      backgroundColor: 'background.level3',
      display: 'flex', flexFlow: 'column nowrap', minHeight: 96, alignItems: 'center',
      gap: { xs: 4, md: 5, xl: 6 },
      px: { xs: 2 },
      py: { xs: 4, md: 5, xl: 6 },
    }}>

      {/* Heading */}
      <Box sx={{
        display: 'flex', flexDirection: 'column',
        backgroundColor: 'background.level1', borderRadius: 'xl', boxShadow: 'xs',
        gap: 1,
        px: { xs: 2.5, md: 3.5 },
        py: { xs: 2, md: 3 },
        // animation: `${cssMagicSwapKeyframes} 0.4s cubic-bezier(0.22, 1, 0.36, 1)`,
      }}>
        <Typography level='h3' startDecorator={<TelegramIcon sx={{ fontSize: 'xl3', mr: 0.5 }} />}>
          {conversationTitle(props.conversation, 'Chat')}
        </Typography>
        <Typography level='title-sm'>
          Uploaded <TimeAgo date={props.storedAt} />
          {!!props.expiresAt && <>, expires <TimeAgo date={props.expiresAt} /></>}.
        </Typography>
      </Box>

      {/* Messages */}
      <Card sx={{
        borderRadius: 'xl', boxShadow: 'md',
        maxWidth: '100%', // fixes the card growing out of bounds
        overflowY: 'auto',
        p: 0,
      }}>

        <List sx={{
          p: 0,
          display: 'flex', flexDirection: 'column',
          flexGrow: 1,
        }}>

          <ListItem sx={{
            // backgroundColor: 'background.surface',
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
            borderBottomStyle: 'dashed',
            // justifyContent: 'center',
            px: { xs: 2.5, md: 3.5 }, py: 2,
          }}>
            <Typography level='body-md'>
              Welcome to the chat! 👋
            </Typography>
          </ListItem>

          {filteredMessages.map((message, idx) =>
            <ChatMessage
              key={'msg-' + message.id} message={message}
              showDate={idx === 0 || idx === filteredMessages.length - 1}
              onMessageEdit={text => message.text = text}
            />,
          )}

          <ListItem sx={{
            px: { xs: 2.5, md: 3.5 }, py: 2,
          }}>
            <Typography level='body-sm' ref={listBottomRef}>
              Like the chat? Clone it and keep the talk going! 🚀
            </Typography>
          </ListItem>

        </List>
      </Card>

      {/* Buttons */}
      <Box sx={{ display: 'flex', flexFlow: 'row wrap', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Button
          variant='solid' color='neutral' size='lg'
          disabled={!hasMessages || cloning} loading={cloning}
          endDecorator={<TelegramIcon />}
          onClick={() => handleClone(false)}
          sx={{
            boxShadow: 'md',
          }}
        >
          Clone on {Brand.Title.Base}
        </Button>

        {hasExistingChat && (
          <Tooltip title='This conversation is already present, enabling Overwrite'>
            <Button
              variant='soft' color='warning'
              disabled={!hasMessages || cloning} loading={cloning}
              endDecorator={<TelegramIcon />}
              onClick={() => handleClone(true)}
            >
              Replace Existing
            </Button>
          </Tooltip>
        )}
      </Box>

    </Box>

  );
}
