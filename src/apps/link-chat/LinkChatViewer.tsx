import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, Card, CardContent, List, ListItem, Tooltip, Typography } from '@mui/joy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../chat/components/message/ChatMessage';
import { useChatShowSystemMessages } from '../chat/store-app-chat';

import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { DMessageId } from '~/common/stores/chat/chat.message';
import { Brand } from '~/common/app.config';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { WorkspaceIdProvider } from '~/common/stores/workspace/WorkspaceIdProvider';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle, DConversation, excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { launchAppChat } from '~/common/app.routes';
import { themeBgAppDarker } from '~/common/app.theme';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useIsMobile } from '~/common/components/useMatchMedia';


/**
 * Renders a chat link view with conversation details and messages.
 */
export function LinkChatViewer(props: { conversation: DConversation, storedAt: Date, expiresAt: Date | null }) {

  // state
  const [cloning, setCloning] = React.useState<boolean>(false);
  const listBottomRef = React.useRef<HTMLDivElement>(null);

  // external state
  const isMobile = useIsMobile();
  const [showSystemMessages] = useChatShowSystemMessages();
  const hasExistingChat = useChatStore(state => state.conversations.some(c => c.id === props.conversation.id));

  // derived state
  const messages = props.conversation.messages;
  const filteredMessages = excludeSystemMessages(messages, showSystemMessages);
  const hasMessages = filteredMessages.length > 0;

  // Effect: Scroll to bottom of list when messages change

  /*React.useEffect(() => {
    setTimeout(() => {
      if (listBottomRef.current)
        listBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 1000);
  }, [messages]);*/


  const handleClone = async (canOverwrite: boolean) => {
    setCloning(true);
    const importedId = useChatStore.getState().importConversation({ ...props.conversation }, !canOverwrite);
    void launchAppChat(importedId);
    setCloning(false);
  };


  return (

    <Box sx={{
      flexGrow: 1,
      backgroundColor: themeBgAppDarker,
      display: 'flex', flexFlow: 'column nowrap', minHeight: 96, alignItems: 'center',
      gap: { xs: 3, md: 5, xl: 6 },
      px: { xs: 2 },
      py: { xs: 3, md: 5, xl: 6 },
    }}>

      {/* Title Card */}
      <Card sx={{
        display: 'flex', flexDirection: 'column',
        // backgroundColor: 'background.level1',
        // borderRadius: 'xl',
        // boxShadow: 'xs',
        px: 2.5,
        maxWidth: '100%',
        // animation: `${cssMagicSwapKeyframes} 0.4s cubic-bezier(0.22, 1, 0.36, 1)`,
      }}>
        <CardContent sx={{ gap: 1 }}>
          <Typography level='h4' startDecorator={<TelegramIcon sx={{ fontSize: 'xl2' }} />}>
            {capitalizeFirstLetter(conversationTitle(props.conversation, 'Chat'))}
          </Typography>
          <Typography level='body-xs'>
            Uploaded <TimeAgo date={props.storedAt} />
            {!!props.expiresAt && <>, expires <TimeAgo date={props.expiresAt} /></>}.
          </Typography>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card sx={{
        borderRadius: 'xl', boxShadow: 'md',
        maxWidth: '100%', // fixes the card growing out of bounds
        overflowY: 'hidden',
        p: 0,
      }}>

        <WorkspaceIdProvider conversationId={null}>

          <ScrollToBottom bootToBottom bootSmoothly>

            <List sx={{
              minHeight: '100%',
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
                <ChatMessageMemo
                  key={'msg-' + message.id}
                  message={message}
                  fitScreen={isMobile}
                  isMobile={isMobile}
                  showBlocksDate={idx === 0 || idx === filteredMessages.length - 1 /* first and last message */}
                  onMessageFragmentReplace={(_messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
                    message.fragments = message.fragments.map(f => (f.fId === fragmentId) ? newFragment : f);
                  }}
                />,
              )}

              <ListItem sx={{
                px: { xs: 2.5, md: 3.5 }, py: 2,
              }}>
                <Typography level='body-sm' ref={listBottomRef}>
                  Like the chat? Import it and keep the talk going! 🚀
                </Typography>
              </ListItem>

            </List>

          </ScrollToBottom>

        </WorkspaceIdProvider>

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
          {hasExistingChat
            ? `Import as New`
            : `Import on ${Brand.Title.Base}`}
        </Button>

        {hasExistingChat && (
          <Tooltip title='This conversation is already present, enabling Overwrite'>
            <Button
              variant='soft' color='warning'
              disabled={!hasMessages || cloning} loading={cloning}
              endDecorator={<TelegramIcon />}
              onClick={() => handleClone(true)}
            >
              Import Over
            </Button>
          </Tooltip>
        )}
      </Box>

    </Box>

  );
}
