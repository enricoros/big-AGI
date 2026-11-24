import * as React from 'react';

import { Box, Button, Grid, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { hasServerConf } from '~/common/app.serverconf';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { getConversation } from '~/common/stores/chat/store-chats';
import { ExportClaudeCode } from './claude-code/ExportClaudeCode';

import { ChatLinkExport } from './link/ChatLinkExport';
import { FlashBackup } from './BackupRestore';
import { TradeExportAll } from './TradeExportAll';
import { downloadSingleChat } from './trade.client';


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
  const [downloadedJSONFailure, setDownloadedJSONFailure] = React.useState<string | null>(null);
  const [downloadedMarkdownState, setDownloadedMarkdownState] = React.useState<'busy' | 'ok' | 'fail' | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // external state
  const enableSharing = hasServerConf('hasDB');

  // derived state
  const { exportAll } = props.config;


  // download chats

  const handleDownloadConversationJSON = () => {
    if (!props.config.conversationId || downloadedJSONState === 'busy') return;
    const conversation = getConversation(props.config.conversationId);
    if (!conversation) return;
    setDownloadedJSONState('busy');
    setDownloadedJSONFailure(null);
    downloadSingleChat(conversation, 'json')
      .then(() => setDownloadedJSONState('ok'))
      .catch((error: any) => {
        // closing the save dialog is not a failure; a conversation this device does not export is one, and says why
        const failure = error?.name === 'AbortError' ? null : error?.message || 'Could not save the file';
        setDownloadedJSONState(failure ? 'fail' : null);
        setDownloadedJSONFailure(failure);
      });
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
          {!!downloadedJSONFailure && <Typography level='body-xs' color='warning' sx={{ maxWidth: 240 }}>{downloadedJSONFailure}</Typography>}

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

          <ExportClaudeCode conversationId={props.config.conversationId} getConversation={getConversation} />

        </Box>
      </Grid>

      {/* All Chats */}
      {exportAll && (
        <Grid xs={12} md={6} sx={{ display: 'flex', alignItems: 'flex-start', py: 2 }}>
          <Box sx={{ display: 'grid', gap: 1, mx: 'auto' }}>

            <TradeExportAll />

            <Button variant='plain' color='neutral' size='sm' startDecorator={showAdvanced ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />} onClick={() => setShowAdvanced(on => !on)} sx={{ mt: 2, justifyContent: 'flex-start', fontWeight: 'md' }}>
              Device backup (legacy)
            </Button>

            {/* Insert to Download a Flash */}
            {showAdvanced && <FlashBackup />}

          </Box>
        </Grid>
      )}

    </Grid>

  </>;
}