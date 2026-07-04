import * as React from 'react';

import { Box, Button, Grid, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { getConversation } from '~/common/stores/chat/store-chats';
import { humanReadableBytes } from '~/common/util/textUtils';

import { ChatLinkExport } from './link/ChatLinkExport';
import { FlashBackup } from './BackupRestore';
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
  const [downloadedJSONState, setDownloadedJSONState] = React.useState<'busy' | 'ok' | 'fail' | null>(null);
  const [downloadedMarkdownState, setDownloadedMarkdownState] = React.useState<'busy' | 'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'busy' | 'ok' | 'fail' | null>(null);
  const [downloadAllError, setDownloadAllError] = React.useState<string | null>(null);
  const [downloadAllInfo, setDownloadAllInfo] = React.useState<string | null>(null);

  // external state
  const enableSharing = getBackendCapabilities().hasDB;

  // derived state
  const { exportAll } = props.config;


  // download chats

  const handleDownloadConversationJSON = () => {
    if (!props.config.conversationId || downloadedJSONState === 'busy') return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    setDownloadedJSONState('busy');
    downloadSingleChat(conversation, 'json')
      .then(() => setDownloadedJSONState('ok'))
      .catch((error: any) => setDownloadedJSONState(error?.name === 'AbortError' ? null : 'fail'));
  };

  const handleDownloadConversationMarkdown = () => {
    if (!props.config.conversationId || downloadedMarkdownState === 'busy') return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    setDownloadedMarkdownState('busy');
    downloadSingleChat(conversation, 'markdown')
      .then(() => setDownloadedMarkdownState('ok'))
      .catch((error: any) => setDownloadedMarkdownState(error?.name === 'AbortError' ? null : 'fail'));
  };

  const handleDownloadAllConversationsJSON = () => {
    if (downloadedAllState === 'busy') return;
    setDownloadedAllState('busy');
    setDownloadAllError(null);
    setDownloadAllInfo(null);
    downloadAllJsonV1B()
      .then(({ conversationCount, sizeBytes }) => {
        setDownloadedAllState('ok');
        setDownloadAllInfo(`Saved ${conversationCount.toLocaleString()} chats · ${humanReadableBytes(sizeBytes)}`);
      })
      .catch((error: any) => {
        // user closed the save dialog: back to idle, not an error
        if (error?.name === 'AbortError')
          return setDownloadedAllState(null);
        setDownloadedAllState('fail');
        setDownloadAllError(error?.message || 'Unknown error saving the backup.');
      });
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
              variant='soft' disabled={!hasConversation || downloadedJSONState === 'busy'} loading={downloadedJSONState === 'busy'}
              color={downloadedJSONState === 'ok' ? 'success' : downloadedJSONState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedJSONState === 'ok' ? <DoneIcon /> : downloadedJSONState === 'fail' ? '✘' : <FileDownloadOutlinedIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadConversationJSON}
            >
              Download · JSON
            </Button>
          </GoodTooltip>

          <Button
            variant='soft' disabled={!hasConversation || downloadedMarkdownState === 'busy'} loading={downloadedMarkdownState === 'busy'}
            color={downloadedMarkdownState === 'ok' ? 'success' : downloadedMarkdownState === 'fail' ? 'warning' : 'primary'}
            endDecorator={downloadedMarkdownState === 'ok' ? <DoneIcon /> : downloadedMarkdownState === 'fail' ? '✘' : <FileDownloadOutlinedIcon />}
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
              variant='soft' disabled={downloadedAllState === 'busy'} loading={downloadedAllState === 'busy'}
              color={downloadedAllState === 'ok' ? 'success' : downloadedAllState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedAllState === 'ok' ? <DoneIcon /> : downloadedAllState === 'fail' ? '✘' : <FileDownloadOutlinedIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadAllConversationsJSON}
            >
              Backup All Chats
            </Button>

            {!!downloadAllInfo && (
              <Typography level='body-xs' color='success' sx={{ maxWidth: 240 }}>
                {downloadAllInfo}
              </Typography>
            )}

            {!!downloadAllError && (
              <Typography level='body-xs' color='danger' sx={{ maxWidth: 240 }}>
                {downloadAllError}
              </Typography>
            )}

            {/* Insert to Download a Flash */}
            <FlashBackup />

          </Box>
        </Grid>
      )}

    </Grid>

  </>;
}