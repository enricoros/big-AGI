import * as React from 'react';

import { Badge, Box, Button, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import IosShareIcon from '@mui/icons-material/IosShare';

import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { conversationTitle, useChatStore } from '~/common/state/store-chats';
import { useUICounter, useUIPreferencesStore } from '~/common/state/store-ui';

import type { PublishedSchema, StoragePutSchema } from '../server/trade.router';

import { addChatLinkItem, useLinkStorageOwnerId } from '../store-sharing';
import { conversationToJsonV1, conversationToMarkdown, downloadAllConversationsJson, downloadConversationJson } from '../trade.client';

import { ExportedChatLink } from './ExportedChatLink';
import { ExportedPublish } from './ExportedPublish';


// global flag to enable/disable the sharing mechanics
const ENABLE_SHARING = process.env.HAS_SERVER_DB_PRISMA;


export type ExportConfig = { dir: 'export', conversationId: string | null };

/// Returns a pretty link to the current page, for promo
function linkToOrigin() {
  let origin = (typeof window !== 'undefined') ? window.location.href : '';
  if (!origin || origin.includes('//localhost'))
    origin = Brand.URIs.OpenRepo;
  origin = origin.replace('https://', '');
  if (origin.endsWith('/'))
    origin = origin.slice(0, -1);
  return origin;
}

function findConversation(conversationId: string) {
  return conversationId ? useChatStore.getState().conversations.find(c => c.id === conversationId) ?? null : null;
}


/**
 * Export Buttons and functionality
 */
export function ExportChats(props: { config: ExportConfig, onClose: () => void }) {

  // state
  const [downloadedState, setDownloadedState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'ok' | 'fail' | null>(null);
  const [chatLinkConfirmId, setChatLinkConfirmId] = React.useState<string | null>(null);
  const [chatLinkUploading, setChatLinkUploading] = React.useState(false);
  const [chatLinkResponse, setChatLinkResponse] = React.useState<StoragePutSchema | null>(null);
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishUploading, setPublishUploading] = React.useState(false);
  const [publishResponse, setPublishResponse] = React.useState<PublishedSchema | null>(null);

  // external state
  const { novel: chatLinkBadge, touch: clearChatLinkBadge } = useUICounter('share-chat-link');
  const { linkStorageOwnerId, setLinkStorageOwnerId } = useLinkStorageOwnerId();


  // chat link

  const handleChatLinkCreate = () => setChatLinkConfirmId(props.config.conversationId);

  const handleChatLinkConfirmed = async () => {
    if (!chatLinkConfirmId) return;

    const conversation = findConversation(chatLinkConfirmId);
    setChatLinkConfirmId(null);
    if (!conversation) return;

    setChatLinkUploading(true);
    try {
      const chatV1 = conversationToJsonV1(conversation);
      const chatTitle = conversationTitle(conversation) || undefined;
      const response: StoragePutSchema = await apiAsyncNode.trade.storagePut.mutate({
        ownerId: linkStorageOwnerId,
        dataType: 'CHAT_V1',
        dataTitle: chatTitle,
        dataObject: chatV1,
      });
      setChatLinkResponse(response);
      if (response.type === 'success') {
        addChatLinkItem(chatTitle, response.objectId, response.createdAt, response.expiresAt, response.deletionKey);
        if (!linkStorageOwnerId)
          setLinkStorageOwnerId(response.ownerId);
      }
      clearChatLinkBadge();
    } catch (error: any) {
      setChatLinkResponse({
        type: 'error',
        error: error?.message ?? error?.toString() ?? 'unknown error',
      });
    }
    setChatLinkUploading(false);
  };


  // publish

  const handlePublishConversation = () => setPublishConversationId(props.config.conversationId);

  const handlePublishConfirmed = async () => {
    if (!publishConversationId) return;

    const conversation = findConversation(publishConversationId);
    setPublishConversationId(null);
    if (!conversation) return;

    setPublishUploading(true);
    const markdownContent = conversationToMarkdown(conversation, !useUIPreferencesStore.getState().showSystemMessages);
    try {
      const paste = await apiAsyncNode.trade.publishTo.mutate({
        to: 'paste.gg',
        title: '🤖💬 Chat Conversation',
        fileContent: markdownContent,
        fileName: 'my-chat.md',
        origin: linkToOrigin(),
      });
      setPublishResponse(paste);
    } catch (error: any) {
      alert(`Failed to publish conversation: ${error?.message ?? error?.toString() ?? 'unknown error'}`);
      setPublishResponse(null);
    }
    setPublishUploading(false);
  };

  const handlePublishResponseClosed = () => {
    setPublishResponse(null);
    props.onClose();
  };


  // download

  const handleDownloadConversation = () => {
    if (!props.config.conversationId) return;
    const conversation = findConversation(props.config.conversationId);
    if (!conversation) return;
    downloadConversationJson(conversation)
      .then(() => setDownloadedState('ok'))
      .catch(() => setDownloadedState('fail'));
  };

  const handleDownloadAllConversations = () => {
    downloadAllConversationsJson()
      .then(() => setDownloadedAllState('ok'))
      .catch(() => setDownloadedAllState('fail'));
  };


  const hasConversation = !!props.config.conversationId;

  return <>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 1 }}>
      <Typography level='body-sm'>
        Share or download this conversation
      </Typography>

      {ENABLE_SHARING && (
        <Badge color='danger' invisible={!chatLinkBadge}>
          <Button variant='soft' disabled={!hasConversation || chatLinkUploading}
                  loading={chatLinkUploading}
                  color={chatLinkResponse ? 'success' : 'primary'}
                  endDecorator={chatLinkResponse ? <DoneIcon /> : <IosShareIcon />}
                  sx={{ minWidth: 240, justifyContent: 'space-between' }}
                  onClick={handleChatLinkCreate}>
            Share on {Brand.Title.Base}
          </Button>
        </Badge>
      )}

      <Button variant='soft' disabled={!hasConversation || publishUploading}
              loading={publishUploading}
              color={publishResponse ? 'success' : 'primary'}
              endDecorator={<ExitToAppIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handlePublishConversation}>
        Publish to Paste.gg
      </Button>

      {/*<Button variant='soft' size='md' disabled sx={{ minWidth: 240, justifyContent: 'space-between', fontWeight: 400 }}>*/}
      {/*  Publish to ShareGPT*/}
      {/*</Button>*/}

      <Button variant='soft' disabled={!hasConversation}
              color={downloadedState === 'ok' ? 'success' : downloadedState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedState === 'ok' ? <DoneIcon /> : downloadedState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadConversation}>
        Download chat
      </Button>

      <Typography level='body-sm' sx={{ mt: 2 }}>
        Store or transfer between devices
      </Typography>
      <Button variant='soft' size='md'
              color={downloadedAllState === 'ok' ? 'success' : downloadedAllState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedAllState === 'ok' ? <DoneIcon /> : downloadedAllState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadAllConversations}>
        Download all chats
      </Button>
    </Box>


    {/* [chat link] confirmation */}
    {ENABLE_SHARING && !!chatLinkConfirmId && (
      <ConfirmationModal
        open onClose={() => setChatLinkConfirmId(null)} onPositive={handleChatLinkConfirmed}
        title='Upload Confirmation'
        confirmationText={<>
          Everyone who has the unlisted link will be able to access this chat.
          It will be automatically deleted after 30 days.
          For more information, please see the <Link href={Brand.URIs.PrivacyPolicy} target='_blank'>privacy
          policy</Link> of this server. <br />
          Do you wish to continue?
        </>} positiveActionText={'Yes, Create Link'}
      />
    )}

    {/* [chat link] response */}
    {ENABLE_SHARING && !!chatLinkResponse && (
      <ExportedChatLink open onClose={() => setChatLinkResponse(null)} response={chatLinkResponse} />
    )}


    {/* [publish] confirmation */}
    {publishConversationId && (
      <ConfirmationModal
        open onClose={() => setPublishConversationId(null)} onPositive={handlePublishConfirmed}
        confirmationText={<>
          Share your conversation anonymously on <Link href='https://paste.gg' target='_blank'>paste.gg</Link>?
          It will be unlisted and available to share and read for 30 days. Keep in mind, deletion may not be possible.
          Do you wish to continue?
        </>} positiveActionText={'Understood, Upload to Paste.gg'}
      />
    )}

    {/* [publish] response */}
    {!!publishResponse && (
      <ExportedPublish open onClose={handlePublishResponseClosed} response={publishResponse} />
    )}

  </>;
}