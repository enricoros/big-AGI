import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';

import { Box, Button, Card, List, Tooltip, Typography } from '@mui/joy';
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


function ConversationPreview(props: { conversation: DConversation }) {

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
    .filter(m => m.role !== 'system' || showSystemMessages)
    .reverse();


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
      p: { xs: 2, md: 3, xl: 5 },
      gap: { xs: 2, md: 3, xl: 5 },
      // position: 'relative',
    }}>

      <Typography level='h2'>
        Chat: {conversationTitle(props.conversation)}
      </Typography>

      <Card sx={{
        overflowY: 'auto', // overflowY: 'hidden'
        borderRadius: 'xl', boxShadow: 'md',
        // p: 4,
        p: 0,
      }}>

        <List sx={{
          p: 0,
          // this makes sure that the the window is scrolled to the bottom (column-reverse)
          display: 'flex', flexDirection: 'column-reverse',
          flexGrow: 1,
        }}>

          {filteredMessages.map((message, idx) =>
            <ChatMessage
              key={'msg-' + message.id} message={message}
              isBottom={idx === 0}
              onMessageEdit={text => message.text = text}
            />,
          )}

        </List>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Button
          variant='solid' color='neutral' size='lg'
          disabled={!hasMessages || cloning} loading={cloning}
          endDecorator={<TelegramIcon />}
          onClick={handleCloneClicked}
        >
          Clone on {Brand.Title.Base}
        </Button>

        {existingId && (
          <Tooltip title='This conversation is already present, enabling Overwrite'>
            <Button
              variant='soft' color='danger' size='lg'
              disabled={!hasMessages || cloning} loading={cloning}
              endDecorator={<TelegramIcon />}
              onClick={handleOverwriteClicked}
            >
              Overwrite
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
  const { data: conversation, isError, error, isLoading } = useQuery({
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
      return restored;
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
  if (conversation)
    return <ConversationPreview conversation={conversation} />;

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