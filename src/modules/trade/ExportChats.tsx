import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { backendCaps } from '~/modules/backend/state-backend';

import { DConversationId, getConversation } from '~/common/state/store-chats';

import { ChatLinkExport } from './chatlink/ChatLinkExport';
import { PublishExport } from './publish/PublishExport';
import { downloadAllConversationsJson, downloadConversationJson } from './trade.client';


export type ExportConfig = { dir: 'export', conversationId: DConversationId | null };


/**
 * Export Buttons and functionality
 */
export function ExportChats(props: { config: ExportConfig, onClose: () => void }) {

  // state
  const [downloadedState, setDownloadedState] = React.useState<'ok' | 'fail' | null>(null);
  const [downloadedAllState, setDownloadedAllState] = React.useState<'ok' | 'fail' | null>(null);

  // external state
  const enableSharing = backendCaps().hasDB;


  // download chats

  const handleDownloadConversation = () => {
    if (!props.config.conversationId) return;
    const conversation = getConversation(props.config.conversationId);
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

      <Typography level='title-sm'>
        Share / Download current chat:
      </Typography>

      <Button variant='soft' disabled={!hasConversation}
              color={downloadedState === 'ok' ? 'success' : downloadedState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedState === 'ok' ? <DoneIcon /> : downloadedState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadConversation}>
        Download chat
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
        Store / Transfer between devices:
      </Typography>
      <Button variant='soft' size='md'
              color={downloadedAllState === 'ok' ? 'success' : downloadedAllState === 'fail' ? 'warning' : 'primary'}
              endDecorator={downloadedAllState === 'ok' ? <DoneIcon /> : downloadedAllState === 'fail' ? '✘' : <FileDownloadIcon />}
              sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleDownloadAllConversations}>
        Download all chats
      </Button>
    </Box>

  </>;
}