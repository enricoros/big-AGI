import * as React from 'react';
import TimeAgo from 'react-timeago';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';

import { Box, Button, Card, List, ListItem, Tooltip, Typography } from '@mui/joy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { AppLayout } from '~/common/layout/AppLayout';
import { Brand } from '~/common/brand';
import { DConversation, useChatStore } from '~/common/state/store-chats';
import { InlineError } from '~/common/components/InlineError';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { navigateToChat } from '~/common/routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { createConversationFromJsonV1 } from '../../src/apps/chat/trade/trade.client';

import { ChatMessage } from '../../src/apps/chat/components/message/ChatMessage';
import { LogoProgress } from '../launch';
import { conversationTitle } from '../../src/apps/chat/components/applayout/ConversationItem';


function ConversationPreview(props: { conversation: DConversation, sharedAt: Date, expiresAt: Date | null }) {

  // state
  const [cloning, setCloning] = React.useState<boolean>(false);

  // external state
  const { push: routerPush } = useRouter();
  const showSystemMessages = useUIPreferencesStore(state => state.showSystemMessages);
  const conversationId = props.conversation.id;
  const existingId = useChatStore(state => state.conversations.some(c => c.id === conversationId));

  // derived state
  const messages = props.conversation.messages;
  let filteredMessages = messages
    .filter(m => m.role !== 'system' || showSystemMessages);


  const handleClone = async (canOverwrite: boolean) => {
    setCloning(true);
    useChatStore.getState().importConversation({ ...props.conversation }, !canOverwrite);
    await navigateToChat(routerPush);
    setCloning(false);
  };

  const handleCloneClicked = async () => handleClone(false);

  const handleOverwriteClicked = async () => handleClone(true);


  // filteredMessages = [];
  const hasMessages = filteredMessages.length > 0;
  // const isCloning = cloningState.state !== 'idle';

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
      }}>
        <Typography level='h3' startDecorator={<TelegramIcon sx={{ fontSize: 'xl3', mr: 0.5 }} />}>
          {conversationTitle(props.conversation)}
        </Typography>
        <Typography level='title-sm'>
          Uploaded <TimeAgo date={props.sharedAt} />
          {!!props.expiresAt && <>, expires <TimeAgo date={props.expiresAt} /></>}.
        </Typography>
      </Box>

      {/* Messages */}
      <Card sx={{
        overflowY: 'auto', // overflowY: 'hidden'
        borderRadius: 'xl', boxShadow: 'md',
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
            <Typography level='body-sm'>
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
          onClick={handleCloneClicked}
          sx={{ boxShadow: 'md' }}
        >
          Clone on {Brand.Title.Base}
        </Button>

        {existingId && (
          <Tooltip title='This conversation is already present, enabling Overwrite'>
            <Button
              variant='soft' color='warning'
              disabled={!hasMessages || cloning} loading={cloning}
              endDecorator={<TelegramIcon />}
              onClick={handleOverwriteClicked}
            >
              Replace Existing
            </Button>
          </Tooltip>
        )}
      </Box>

    </Box>

  );
}


function AppSharedConversationPreview() {

  // input params
  const { query } = useRouter();
  const sharedId = query.sharedId as string ?? '';

  // load the shared chat
  const { data, isError, error, isLoading } = useQuery({
    enabled: !!sharedId,
    queryKey: ['shared', sharedId],
    queryFn: async () => {
      // fetch
      const result = await apiAsyncNode.trade.shareGet.query({ sharedId });

      // validate
      if (result.type === 'error')
        throw result.error;
      if (result.dataType !== 'CHAT_V1')
        throw new Error(`Unsupported data type: ${result.dataType}`);

      // convert to DConversation
      const restored = createConversationFromJsonV1(result.dataObject as any);
      if (!restored)
        throw new Error('Failed to restore conversation');
      return {
        conversation: restored,
        sharedAt: result.sharedAt,
        expiresAt: result.expiresAt,
      };
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Loading
  if (isLoading)
    return (
      <Box sx={{
        backgroundColor: 'background.level3',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexGrow: 1,
      }}>
        <LogoProgress showProgress={true} />
        <Typography level='title-sm' sx={{ mt: 2 }}>
          Loading Chat...
        </Typography>
      </Box>
    );

  // Error
  if (isError)
    return (
      <Box sx={{
        backgroundColor: 'background.level2',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexGrow: 1,
      }}>
        <InlineError error={error} severity='warning' />
      </Box>
    );

  // Success
  if (data?.conversation)
    return <ConversationPreview conversation={data.conversation} sharedAt={data.sharedAt} expiresAt={data.expiresAt} />;

  // No sharedId
  return (
    <Box sx={{
      backgroundColor: 'background.level4',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexGrow: 1,
    }}>
      ...
    </Box>
  );
}


export default function SharedViewerPage() {
  return (
    <AppLayout suspendAutoModelsSetup>
      <AppSharedConversationPreview />
    </AppLayout>
  );
}