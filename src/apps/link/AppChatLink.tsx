import * as React from 'react';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';

import { Box, Typography } from '@mui/joy';

import { createConversationFromJsonV1 } from '../chat/trade/trade.client';
import { useHasChatLinkItems } from '../chat/trade/store-sharing';

import { Brand } from '~/common/brand';
import { InlineError } from '~/common/components/InlineError';
import { LogoProgress } from '~/common/components/LogoProgress';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle } from '~/common/state/store-chats';
import { useLayoutPluggable } from '~/common/layout/store-applayout';

import { AppChatLinkDrawerItems } from './AppChatLinkDrawerItems';
import { AppChatLinkMenuItems } from './AppChatLinkMenuItems';
import { ViewChatLink } from './ViewChatLink';


const Centerer = (props: { backgroundColor: string, children?: React.ReactNode }) =>
  <Box sx={{
    backgroundColor: props.backgroundColor,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    flexGrow: 1,
  }}>
    {props.children}
  </Box>;

const ShowLoading = () =>
  <Centerer backgroundColor='background.level3'>
    <LogoProgress showProgress={true} />
    <Typography level='title-sm' sx={{ mt: 2 }}>
      Loading Chat...
    </Typography>
  </Centerer>;

const ShowError = (props: { error: any }) =>
  <Centerer backgroundColor='background.level2'>
    <InlineError error={props.error} severity='warning' />
  </Centerer>;


/**
 * Fetches the object using tRPC
 * Note: we don't have react-query for the Node functions, so we use the immediate API here,
 *       and wrap it in a react-query hook
 */
async function fetchStoredChatV1(objectId: string) {
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


export function AppChatLink(props: { linkId: string }) {

  // external state
  const { data, isError, error, isLoading } = useQuery({
    enabled: !!props.linkId,
    queryKey: ['chat-link', props.linkId],
    queryFn: () => fetchStoredChatV1(props.linkId),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
  const hasLinkItems = useHasChatLinkItems();


  // pluggable UI

  const drawerItems = React.useMemo(() => <AppChatLinkDrawerItems />, []);
  const menuItems = React.useMemo(() => <AppChatLinkMenuItems />, []);
  useLayoutPluggable(null, hasLinkItems ? drawerItems : null, menuItems);


  const pageTitle = (data?.conversation && conversationTitle(data.conversation)) || 'Chat Link';

  return <>

    <Head>
      <title>{capitalizeFirstLetter(pageTitle)} · {Brand.Title.Base} 🚀</title>
    </Head>

    {isLoading
      ? <ShowLoading />
      : isError
        ? <ShowError error={error} />
        : !!data?.conversation
          ? <ViewChatLink conversation={data.conversation} storedAt={data.storedAt} expiresAt={data.expiresAt} />
          : <Centerer backgroundColor='background.level3' />}

  </>;
}