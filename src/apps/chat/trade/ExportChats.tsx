import * as React from 'react';

import { Badge, Box, Button, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import IosShareIcon from '@mui/icons-material/IosShare';

import { Brand } from '~/common/brand';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { useChatStore } from '~/common/state/store-chats';
import { useUICounter, useUIPreferencesStore } from '~/common/state/store-ui';

import type { PublishedSchema, SharePutSchema } from './server/trade.router';
import { ExportPublishedModal } from './ExportPublishedModal';
import { ExportSharedModal } from './ExportSharedModal';
import { conversationToJsonV1, conversationToMarkdown, downloadAllConversationsJson, downloadConversationJson } from './trade.client';


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
 * Supports Share locally, Pulish to Paste.gg and Download in own format
 */
export function ExportChats(props: { config: ExportConfig, onClose: () => void }) {

  // state
  const [downloadedState, setDownloadedState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'ok' | 'fail' | null>(null);
  const [shareConversationId, setShareConversationId] = React.useState<string | null>(null);
  const [shareUploading, setShareUploading] = React.useState(false);
  const [shareResponse, setShareResponse] = React.useState<SharePutSchema | null>(null);
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishUploading, setPublishUploading] = React.useState(false);
  const [publishResponse, setPublishResponse] = React.useState<PublishedSchema | null>(null);

  // external state
  const { novel: shareWebBadge, touch: shareWebTouch } = useUICounter('share-web');


  // share

  const handleShareConversation = () => setShareConversationId(props.config.conversationId);

  const handleShareConfirmed = async () => {
    if (!shareConversationId) return;

    const conversation = findConversation(shareConversationId);
    setShareConversationId(null);
    if (!conversation) return;

    setShareUploading(true);
    try {
      const chatV1 = conversationToJsonV1(conversation);
      const response: SharePutSchema = await apiAsyncNode.trade.sharePut.mutate({
        ownerId: undefined, // TODO: save owner id and reuse every time
        dataType: 'CHAT_V1',
        dataObject: chatV1,
      });
      setShareResponse(response);
      shareWebTouch();
    } catch (error: any) {
      setShareResponse({
        type: 'error',
        error: error?.message ?? error?.toString() ?? 'unknown error',
      });
    }
    setShareUploading(false);
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

      {!!Brand.URIs.PrivacyPolicy && <Badge color='danger' invisible={!shareWebBadge}>
        <Button variant='soft' size='md' disabled={!hasConversation || shareUploading}
                loading={shareUploading}
                color={shareResponse ? 'success' : 'primary'}
                endDecorator={shareResponse ? <DoneIcon /> : <IosShareIcon />}
                sx={{ minWidth: 240, justifyContent: 'space-between' }}
                onClick={handleShareConversation}>
          Share on {Brand.Title.Base}
        </Button>
      </Badge>}

      <Button variant='soft' size='md' disabled={!hasConversation || publishUploading}
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

      <Button variant='soft' size='md' disabled={!hasConversation}
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

    {/* [share] confirmation */}
    {shareConversationId && !!Brand.URIs.PrivacyPolicy && <ConfirmationModal
      open onClose={() => setShareConversationId(null)} onPositive={handleShareConfirmed}
      confirmationText={<>
        Everyone with the link will be able to see it. It will be automatically deleted after 30 days.
        For more information, please see the <Link href={Brand.URIs.PrivacyPolicy} target='_blank'>privacy
        policy</Link> of this server. <br />
        Are you sure you want to proceed?
      </>} positiveActionText={'Understood, share on ' + Brand.Title.Base}
    />}

    {/* [share] outcome */}
    {!!shareResponse && <ExportSharedModal open onClose={() => setShareResponse(null)} response={shareResponse} />}

    {/* [publish] confirmation */}
    {publishConversationId && <ConfirmationModal
      open onClose={() => setPublishConversationId(null)} onPositive={handlePublishConfirmed}
      confirmationText={<>
        Share your conversation anonymously on <Link href='https://paste.gg' target='_blank'>paste.gg</Link>?
        It will be unlisted and available to share and read for 30 days. Keep in mind, deletion may not be possible.
        Are you sure you want to proceed?
      </>} positiveActionText={'Understood, upload to paste.gg'}
    />}

    {/* [publish] outcome */}
    {!!publishResponse && <ExportPublishedModal open onClose={handlePublishResponseClosed} response={publishResponse} />}

  </>;
}