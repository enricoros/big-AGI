import * as React from 'react';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';

import { Box, Button, Card, CardContent, Divider, Input, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { forgetChatLinkItem, useSharedChatLinkItems } from '~/modules/trade/link/store-share-link';

import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { DataAtRestV1 } from '~/common/stores/chat/chats.converters';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { LogoProgress } from '~/common/components/LogoProgress';
import { OptimaDrawerIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle } from '~/common/stores/chat/chat.conversation';
import { navigateToChatLinkList } from '~/common/app.routes';
import { themeBgAppDarker } from '~/common/app.theme';
import { useSetOptimaAppMenu } from '~/common/layout/optima/useOptima';

import { LinkChatAppMenuItems } from './LinkChatAppMenuItems';
import { LinkChatDrawer } from './LinkChatDrawer';
import { LinkChatViewer } from './LinkChatViewer';


const SPECIAL_LIST_PAGE_ID = 'list';


const Centerer = (props: { backgroundColor: string, children?: React.ReactNode }) =>
  <Box sx={{
    backgroundColor: props.backgroundColor,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    flexGrow: 1,
  }}>
    {props.children}
  </Box>;

const ListPlaceholder = (props: { hasLinks: boolean }) =>
  <Box sx={{ p: { xs: 3, md: 6 } }}>
    <Card>
      <CardContent>
        <Typography level='title-md'>
          Shared Conversations
        </Typography>
        <Typography level='body-sm'>
          {props.hasLinks
            ? 'Here you can see formely exported shared conversations. Please select a conversation from the drawer.'
            : 'No shared conversations found. Please export a conversation from this browser first.'}
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
  const restored = DataAtRestV1.recreateConversation(dataObject as any);
  if (!restored)
    throw new Error('Could not restore conversation');

  return { conversation: restored, storedAt, expiresAt };
}


export function AppLinkChat(props: { chatLinkId: string | null }) {

  // state
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = React.useState<string | null>(null);

  // derived state 1
  const isListPage = props.chatLinkId === SPECIAL_LIST_PAGE_ID;
  const linkId = isListPage ? null : props.chatLinkId;

  // external state
  const sharedChatLinkItems = useSharedChatLinkItems();
  const { data, isError, error, isPending } = useQuery({
    enabled: !!linkId,
    queryKey: ['chat-link', linkId],
    queryFn: () => fetchStoredChatV1(linkId),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  // derived state 2
  const hasLinks = sharedChatLinkItems.length > 0;
  const pageTitle = (data?.conversation && conversationTitle(data.conversation)) || 'Shared Chat'; // also the (nav) App title


  const handleDelete = React.useCallback(async (objectId: string, deletionKey: string) => {
    setDeleteConfirmId(null);
    setDeleteConfirmKey(null);

    // delete from storage
    let err: string | null = null;
    try {
      const response = await apiAsyncNode.trade.storageDelete.mutate({ objectId, deletionKey });
      if (response.type === 'error')
        err = response.error || 'unknown error';
    } catch (error: any) {
      err = error?.message ?? error?.toString() ?? 'unknown error';
    }

    // delete from local store
    if (!err)
      forgetChatLinkItem(objectId);

    // UI feedback
    addSnackbar({
      key: err ? 'chatlink-deletion-issue' : 'chatlink-deletion-success',
      type: err ? 'issue' : 'success',
      message: err ? 'Could not delete link: ' + err : 'Link deleted successfully',
    });

    // move to the list page
    if (!err)
      void navigateToChatLinkList();
  }, []);


  // Delete: ID confirmation

  const handleConfirmDeletion = React.useCallback((linkId: string) => linkId && setDeleteConfirmId(linkId), []);

  const handleCancelDeletion = React.useCallback(() => setDeleteConfirmId(null), []);

  // Delete: Key confirmation

  const handleConfirmDeletionKey = React.useCallback(() => {
    if (!deleteConfirmId) return;

    // if we already have the key, we can delete right away
    const item = sharedChatLinkItems.find(i => i.objectId === deleteConfirmId);
    let deletionKey = (item && item.deletionKey) ? item.deletionKey : null;
    if (deletionKey)
      return handleDelete(deleteConfirmId, deletionKey);

    // otherwise ask for the key
    setDeleteConfirmKey('');
  }, [deleteConfirmId, handleDelete, sharedChatLinkItems]);

  const handleCancelDeletionKey = React.useCallback(() => {
    setDeleteConfirmId(null);
    setDeleteConfirmKey(null);
  }, []);

  const handleDeletionKeyConfirmed = React.useCallback(() => {
    deleteConfirmId && deleteConfirmKey && handleDelete(deleteConfirmId, deleteConfirmKey);
  }, [deleteConfirmId, deleteConfirmKey, handleDelete]);


  // pluggable UI

  const drawerContent = React.useMemo(() => <LinkChatDrawer
    activeLinkId={linkId}
    sharedChatLinkItems={sharedChatLinkItems}
    onDeleteLink={handleConfirmDeletion}
  />, [handleConfirmDeletion, linkId, sharedChatLinkItems]);

  const appMenuItems = React.useMemo(() => <LinkChatAppMenuItems
    activeLinkId={linkId}
    onDeleteLink={handleConfirmDeletion}
  />, [handleConfirmDeletion, linkId]);

  useSetOptimaAppMenu(appMenuItems, 'AppChatLink');


  return <>

    <Head>
      <title>{capitalizeFirstLetter(pageTitle)} · {Brand.Title.Base} 🚀</title>
    </Head>

    <OptimaDrawerIn>{drawerContent}</OptimaDrawerIn>

    {isListPage
      ? <ListPlaceholder hasLinks={hasLinks} />
      : isPending
        ? <ShowLoading />
        : isError
          ? <ShowError error={error} />
          : !!data?.conversation
            ? <LinkChatViewer conversation={data.conversation} storedAt={data.storedAt} expiresAt={data.expiresAt} />
            : <Centerer backgroundColor={themeBgAppDarker} />}


    {/* Delete confirmation */}
    {!!deleteConfirmId && (deleteConfirmKey === null) && (
      <ConfirmationModal
        onClose={handleCancelDeletion} onPositive={handleConfirmDeletionKey}
        confirmationText='Are you sure you want to delete this link?'
        positiveActionText={'Yes, Delete'}
      />
    )}

    {/* Deletion Key Input */}
    {!!deleteConfirmId && (deleteConfirmKey !== null) && (
      <GoodModal
        open title='Enter Deletion Key'
        titleStartDecorator={<WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />}
        onClose={handleCancelDeletionKey}
        hideBottomClose
      >
        <Divider />
        <Typography level='body-md'>
          You need to enter the original deletion key to delete this conversation.
        </Typography>
        <Input
          value={deleteConfirmKey}
          onChange={event => setDeleteConfirmKey(event.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button autoFocus variant='plain' color='neutral' onClick={handleCancelDeletionKey}>
            Cancel
          </Button>
          <Button
            variant='solid' color='danger'
            disabled={!deleteConfirmKey.trim()}
            onClick={handleDeletionKeyConfirmed}
            sx={{ lineHeight: '1.5em' }}
          >
            Delete
          </Button>
        </Box>
      </GoodModal>
    )}

  </>;
}