import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { ExportPublishedModal } from './ExportPublishedModal';
import { PublishedSchema } from '~/modules/sharing/sharing.router';
import { apiAsync } from '~/modules/trpc/trpc.client';

import { Brand } from '~/common/brand';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { conversationToMarkdown } from './trade.markdown';
import { useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { downloadDAllJson, downloadDConversationJson } from './trade.json';


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
 * Supports Share to Paste.gg and Download in own format
 */
export function ExportChats(props: { config: ExportConfig, onClose: () => void }) {

  // state
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishResponse, setPublishResponse] = React.useState<PublishedSchema | null>(null);
  const [downloadedState, setDownloadedState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'ok' | 'fail' | null>(null);


  // publish

  const handlePublishConversation = () => setPublishConversationId(props.config.conversationId);

  const handlePublishConfirmed = async () => {
    if (!publishConversationId) return;

    const conversation = findConversation(publishConversationId);
    setPublishConversationId(null);
    if (!conversation) return;

    const markdownContent = conversationToMarkdown(conversation, !useUIPreferencesStore.getState().showSystemMessages);
    try {
      const paste = await apiAsync.sharing.publishTo.mutate({
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
    downloadDConversationJson(conversation)
      .then(() => setDownloadedState('ok'))
      .catch(() => setDownloadedState('fail'));
  };

  const handleDownloadAllConversations = () => {
    downloadDAllJson()
      .then(() => setDownloadedAllState('ok'))
      .catch(() => setDownloadedAllState('fail'));
  };

  const hasConversation = !!props.config.conversationId;

  return <>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 1 }}>
      <Typography level='body-sm'>
        Share or download this conversation
      </Typography>

      <Button variant='soft' size='md' disabled={!hasConversation} endDecorator={<ExitToAppIcon />} sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handlePublishConversation}>
        Share to Paste.gg
      </Button>

      <Button variant='soft' size='md' disabled={!hasConversation} sx={{ minWidth: 240, justifyContent: 'space-between' }}
              color={downloadedState === 'ok' ? 'success' : downloadedState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedState === 'ok' ? '✔' : downloadedState === 'fail' ? '✘' : <FileDownloadIcon />}
              onClick={handleDownloadConversation}>
        Download JSON
      </Button>

      <Typography level='body-sm' sx={{ mt: 2 }}>
        Store or transfer between devices
      </Typography>
      <Button variant='soft' size='md' sx={{ minWidth: 240, justifyContent: 'space-between' }}
              color={downloadedAllState === 'ok' ? 'success' : downloadedAllState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedAllState === 'ok' ? '✔' : downloadedAllState === 'fail' ? '✘' : <FileDownloadIcon />}
              onClick={handleDownloadAllConversations}>
        Backup all
      </Button>
    </Box>

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