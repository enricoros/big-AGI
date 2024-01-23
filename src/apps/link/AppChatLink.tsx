import * as React from 'react';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';

import { Box, Card, CardContent, Typography } from '@mui/joy';

import { createConversationFromJsonV1 } from '~/modules/trade/trade.client';

import { Brand } from '~/common/app.config';
import { InlineError } from '~/common/components/InlineError';
import { LogoProgress } from '~/common/components/LogoProgress';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle } from '~/common/state/store-chats';
import { themeBgAppDarker } from '~/common/app.theme';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import { AppChatLinkDrawerContent } from './AppChatLinkDrawerContent';
import { AppChatLinkMenuItems } from './AppChatLinkMenuItems';
import { ViewChatLink } from './ViewChatLink';


const SPECIAL_LIST_PAGE_ID = 'list';


const Centerer = (props: { backgroundColor: string, children?: React.ReactNode }) =>
  <Box sx={{
    backgroundColor: props.backgroundColor,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    flexGrow: 1,
  }}>
    {props.children}
  </Box>;

const ListPlaceholder = () =>
  <Box sx={{ p: { xs: 3, md: 6 } }}>
    <Card>
      <CardContent>
        <Typography level='title-md'>
          Shared Conversations
        </Typography>
        <Typography level='body-sm'>
          Here you can see formely exported shared conversations. Please select a conversation from the drawer.
        </Typography>
      </CardContent>
    </Card>
  </Box>;


const ShowLoading = () =>
  <Centerer backgroundColor={themeBgAppDarker}>
    <LogoProgress showProgress={true} />
    <Typography level='title-sm' sx={{ mt: 2 }}>
      Loading Chat...
    </Typography>
  </Centerer>;

const ShowError = (props: { error: any }) =>
  <Centerer backgroundColor={themeBgAppDarker}>
    <InlineError error={props.error} severity='warning' />
  </Centerer>;


/**
 * Fetches the object using tRPC
 * Note: we don't have react-query for the Node functions, so we use the immediate API here,
 *       and wrap it in a react-query hook
 */
async function fetchStoredChatV1(objectId: string | null) {
  if (!objectId)
    throw new Error('No Stored Chat');

  // fetch
  const result = await apiAsyncNode.trade.storageGet.query({ objectId });
  if (result.type === 'error')
    throw result.error;

  // validate a CHAT_V1
  const { dataType, dataObject, storedAt, expiresAt } = result;
  if (dataType !== 'CHAT_V1')
    throw new Error('Unsupported data type: ' + dataType);

  // convert to DConversation
  const restored = createConversationFromJsonV1(dataObject as any);
  if (!restored)
    throw new Error('Could not restore conversation');

  return { conversation: restored, storedAt, expiresAt };
}


export function AppChatLink(props: { chatLinkId: string | null }) {

  // derived state
  const isListPage = props.chatLinkId === SPECIAL_LIST_PAGE_ID;
  const linkId = isListPage ? null : props.chatLinkId;

  // external state
  const { data, isError, error, isLoading } = useQuery({
    enabled: !!linkId,
    queryKey: ['chat-link', linkId],
    queryFn: () => fetchStoredChatV1(linkId),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
  // const hasLinkItems = useHasChatLinkItems();


  // pluggable UI

  const drawerContent = React.useMemo(() => <AppChatLinkDrawerContent />, []);
  const menuItems = React.useMemo(() => <AppChatLinkMenuItems />, []);
  usePluggableOptimaLayout(drawerContent, null, menuItems, 'AppChatLink');


  const pageTitle = (data?.conversation && conversationTitle(data.conversation)) || 'Chat Link';

  return <>

    <Head>
      <title>{capitalizeFirstLetter(pageTitle)} · {Brand.Title.Base} 🚀</title>
    </Head>

    {isListPage
      ? <ListPlaceholder />
      : isLoading
        ? <ShowLoading />
        : isError
          ? <ShowError error={error} />
          : !!data?.conversation
            ? <ViewChatLink conversation={data.conversation} storedAt={data.storedAt} expiresAt={data.expiresAt} />
            : <Centerer backgroundColor={themeBgAppDarker} />}

  </>;
}