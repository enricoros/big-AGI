import * as React from 'react';

import { Box, Button, Grid, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { getConversation } from '~/common/stores/chat/store-chats';

import { ChatLinkExport } from './link/ChatLinkExport';
import { PublishExport } from './publish/PublishExport';
import { downloadAllJsonV1B, downloadSingleChat } from './trade.client';


export type ExportConfig = {
  dir: 'export',
  conversationId: DConversationId | null,
  exportAll: boolean,
};


/**
 * Export Buttons and functionality
 */
export function ExportChats(props: { config: ExportConfig, onClose: () => void }) {

  // state
  const [downloadedJSONState, setDownloadedJSONState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedMarkdownState, setDownloadedMarkdownState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'ok' | 'fail' | null>(null);

  // external state
  const enableSharing = getBackendCapabilities().hasDB;

  // derived state
  const { exportAll } = props.config;


  // download chats

  const handleDownloadConversationJSON = () => {
    if (!props.config.conversationId) return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    downloadSingleChat(conversation, 'json')
      .then(() => setDownloadedJSONState('ok'))
      .catch(() => setDownloadedJSONState('fail'));
  };

  const handleDownloadConversationMarkdown = () => {
    if (!props.config.conversationId) return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    downloadSingleChat(conversation, 'markdown')
      .then(() => setDownloadedMarkdownState('ok'))
      .catch(() => setDownloadedMarkdownState('fail'));
  };

  const handleDownloadAllConversationsJSON = () => {
    downloadAllJsonV1B()
      .then(() => setDownloadedAllState('ok'))
      .catch(() => setDownloadedAllState('fail'));
  };


  const hasConversation = !!props.config.conversationId;

  return <>

    <Grid container spacing={3}>

      {/* Current Chat */}
      <Grid xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-start', py: 2 }}>
        <Box sx={{ display: 'grid', gap: 1, mx: 'auto' }}>

          {exportAll && (
            <Typography level='body-sm'>
              Download or share <strong>this chat</strong>:
            </Typography>
          )}

          <GoodTooltip title={<KeyStroke variant='solid' combo='Ctrl + S' />}>
            <Button
              variant='soft' disabled={!hasConversation}
              color={downloadedJSONState === 'ok' ? 'success' : downloadedJSONState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedJSONState === 'ok' ? <DoneIcon /> : downloadedJSONState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadConversationJSON}
            >
              Download · JSON
            </Button>
          </GoodTooltip>

          <Button
            variant='soft' disabled={!hasConversation}
            color={downloadedMarkdownState === 'ok' ? 'success' : downloadedMarkdownState === 'fail' ? 'warning' : 'primary'}
            endDecorator={downloadedMarkdownState === 'ok' ? <DoneIcon /> : downloadedMarkdownState === 'fail' ? '✘' : <FileDownloadIcon />}
            sx={{ minWidth: 240, justifyContent: 'space-between' }}
            onClick={handleDownloadConversationMarkdown}
          >
            Export · Markdown
          </Button>

          {enableSharing && (
            <ChatLinkExport
              conversationId={props.config.conversationId}
              enableSharing={enableSharing}
              onClose={props.onClose}
            />
          )}

          <PublishExport
            conversationId={props.config.conversationId}
            onClose={props.onClose}
          />

          {/*<Button*/}
          {/*  variant='soft'*/}
          {/*  endDecorator={<ExitToAppIcon />}*/}
          {/*  sx={{ minWidth: 240, justifyContent: 'space-between' }}*/}
          {/*>*/}
          {/*  Share Copy · ShareGPT*/}
          {/*</Button>*/}

        </Box>
      </Grid>

      {/* All Chats */}
      {exportAll && (
        <Grid xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-start', py: 2 }}>
          <Box sx={{ display: 'grid', gap: 1, mx: 'auto' }}>

            <Typography level='body-sm'>
              Backup or transfer <strong>all chats</strong>:
            </Typography>

            <Button
              variant='soft'
              color={downloadedAllState === 'ok' ? 'success' : downloadedAllState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedAllState === 'ok' ? <DoneIcon /> : downloadedAllState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadAllConversationsJSON}
            >
              Backup All · JSON
            </Button>

          </Box>
        </Grid>
      )}

    </Grid>

  </>;
}