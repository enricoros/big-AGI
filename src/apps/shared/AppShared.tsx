import * as React from 'react';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';

import { Box, Typography } from '@mui/joy';

import { createConversationFromJsonV1 } from '../chat/trade/trade.client';

import { Brand } from '~/common/brand';
import { InlineError } from '~/common/components/InlineError';
import { LogoProgress } from '~/common/components/LogoProgress';
import { apiAsyncNode } from '~/common/util/trpc.client';

import { ViewSharedConversation } from './ViewSharedConversation';


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
 * Fetches the shared conversation from the server
 * Note: we don't have react-query for the Node functions, so we use the immediate API here,
 *       and wrap it in a react-query hook
 */
async function fetchSharedConversation(sharedId: string) {
  // fetch
  const result = await apiAsyncNode.trade.shareGet.query({ sharedId });

  // validate
  if (result.type === 'error')
    throw result.error;
  if (result.dataType !== 'CHAT_V1')
    throw new Error('Unsupported data type: ' + result.dataType);

  // convert to DConversation
  const restored = createConversationFromJsonV1(result.dataObject as any);
  if (!restored)
    throw new Error('Could not restore conversation');

  return {
    conversation: restored,
    sharedAt: result.sharedAt,
    expiresAt: result.expiresAt,
  };
}


export function AppShared() {

  // state
  const { query } = useRouter();
  const sharedId = query.sharedId as string ?? '';

  // external state
  const { data, isError, error, isLoading } = useQuery({
    enabled: !!sharedId,
    queryKey: ['app-shared-chat', sharedId],
    queryFn: () => fetchSharedConversation(sharedId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading)
    return <ShowLoading />;

  if (isError)
    return <ShowError error={error} />;

  if (!data?.conversation)
    return <Centerer backgroundColor='background.level3' />;

  return <>
    <Head>
      <title>{Brand.Title.Common} - Shared Chat</title>
    </Head>
    <ViewSharedConversation conversation={data.conversation} sharedAt={data.sharedAt} expiresAt={data.expiresAt} />
  </>;
}