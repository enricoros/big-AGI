import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { backendCaps } from '~/modules/backend/state-backend';

import { DConversationId, getConversation } from '~/common/state/store-chats';

import { ChatLinkExport } from './link/ChatLinkExport';
import { PublishExport } from './publish/PublishExport';
import { downloadAllConversationsJson, downloadConversation } from './trade.client';


export type ExportConfig = { dir: 'export', conversationId: DConversationId | null };


/**
 * Export Buttons and functionality
 */
export function ExportChats(props: { config: ExportConfig, onClose: () => void }) {

  // state
  const [downloadedJSONState, setDownloadedJSONState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedMarkdownState, setDownloadedMarkdownState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'ok' | 'fail' | null>(null);

  // external state
  const enableSharing = backendCaps().hasDB;


  // download chats

  const handleDownloadConversationJSON = () => {
    if (!props.config.conversationId) return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    downloadConversation(conversation, 'json')
      .then(() => setDownloadedJSONState('ok'))
      .catch(() => setDownloadedJSONState('fail'));
  };

  const handleDownloadConversationMarkdown = () => {
    if (!props.config.conversationId) return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    downloadConversation(conversation, 'markdown')
      .then(() => setDownloadedMarkdownState('ok'))
      .catch(() => setDownloadedMarkdownState('fail'));
  };

  const handleDownloadAllConversationsJSON = () => {
    downloadAllConversationsJson()
      .then(() => setDownloadedAllState('ok'))
      .catch(() => setDownloadedAllState('fail'));
  };


  const hasConversation = !!props.config.conversationId;

  return <>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 1 }}>

      <Typography level='title-sm'>
        Share / Download <strong>current chat</strong>:
      </Typography>

      <Button variant='soft' disabled={!hasConversation}
              color={downloadedJSONState === 'ok' ? 'success' : downloadedJSONState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedJSONState === 'ok' ? <DoneIcon /> : downloadedJSONState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadConversationJSON}>
        Download · JSON
      </Button>

      <Button variant='soft' disabled={!hasConversation}
              color={downloadedMarkdownState === 'ok' ? 'success' : downloadedMarkdownState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedMarkdownState === 'ok' ? <DoneIcon /> : downloadedMarkdownState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadConversationMarkdown}>
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


      {/*<Button variant='soft' size='md' disabled sx={{ minWidth: 240, justifyContent: 'space-between', fontWeight: 400 }}>*/}
      {/*  Publish to ShareGPT*/}
      {/*</Button>*/}

      <Typography level='title-sm' sx={{ mt: 2 }}>
        Store / Transfer <strong>all chats</strong>:
      </Typography>
      <Button variant='soft' size='md'
              color={downloadedAllState === 'ok' ? 'success' : downloadedAllState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedAllState === 'ok' ? <DoneIcon /> : downloadedAllState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadAllConversationsJSON}>
        Download All · JSON
      </Button>
    </Box>

  </>;
}