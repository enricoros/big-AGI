import * as React from 'react';

import { Box, Button, Checkbox, FormControl, FormLabel, IconButton, Sheet, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import type { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import type { Immutable } from '~/common/types/immutable.types';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { humanReadableBytes } from '~/common/util/textUtils';

import { ClaudeCodeExport } from './claudeCode.export';


function _OptionCheckbox(props: { label: string, detail: string, checked: boolean, disabled?: boolean, onChange?: (checked: boolean) => void }) {
  return (
    <FormControl orientation='horizontal' sx={{ gap: 1 }}>
      <Checkbox
        size='md'
        color='neutral'
        checked={props.checked}
        disabled={props.disabled}
        onChange={event => props.onChange?.(event.target.checked)}
      />
      <FormLabel sx={{ fontWeight: 'sm', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: props.disabled ? 0.5 : 1 }}>
        {props.label}
        <Typography level='body-xs' sx={{ fontWeight: 'normal', color: 'text.secondary' }}>
          {props.detail}
        </Typography>
      </FormLabel>
    </FormControl>
  );
}


/**
 * Button + dialog: export the chat as a Claude Code session, or as a folder for Claude Code to work on.
 */
export function ExportClaudeCode(props: {
  conversationId: DConversationId | null,
  getConversation: (conversationId: DConversationId) => Immutable<DConversation> | null,
}) {

  // state
  const [content, setContent] = React.useState<ClaudeCodeExport.ContentSummary | null>(null);
  const [options, setOptions] = React.useState<ClaudeCodeExport.Options>({ includeImages: true, includeSystemPrompt: true, includeSessionInFolder: true });
  const [busyFormat, setBusyFormat] = React.useState<ClaudeCodeExport.Format | null>(null);
  const [saved, setSaved] = React.useState<ClaudeCodeExport.Saved | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const { conversationId, getConversation } = props;


  // handlers

  const handleOpen = React.useCallback(() => {
    const conversation = conversationId ? getConversation(conversationId) : null;
    if (!conversation) return;
    setContent(ClaudeCodeExport.summarizeContent(conversation));
    setSaved(null);
    setError(null);
  }, [conversationId, getConversation]);

  const handleClose = React.useCallback(() => setContent(null), []);

  const handleDownload = React.useCallback((format: ClaudeCodeExport.Format) => {
    const conversation = conversationId ? getConversation(conversationId) : null;
    if (!conversation || !content) return;
    setBusyFormat(format);
    setSaved(null);
    setError(null);
    ClaudeCodeExport.downloadOrThrow(conversation, format, {
      includeImages: options.includeImages && content.imageCount > 0,
      includeSystemPrompt: options.includeSystemPrompt && content.hasSystemPrompt,
      includeSessionInFolder: options.includeSessionInFolder,
    })
      .then(setSaved)
      .catch((error: any) => error?.name !== 'AbortError' && setError(error?.message || 'Could not save the export.'))
      .finally(() => setBusyFormat(null));
  }, [content, conversationId, getConversation, options]);

  const resumeCommand = saved?.resumePath ? `claude --resume "${saved.resumePath}"` : null;


  return <>

    <Button
      variant='soft' disabled={!conversationId}
      endDecorator={<FileDownloadOutlinedIcon />}
      sx={{ minWidth: 240, justifyContent: 'space-between' }}
      onClick={handleOpen}
    >
      Export · Claude Code
    </Button>

    {!!content && (
      <GoodModal open onClose={handleClose} title={<><b>Export</b> for Claude Code</>}>

        <Typography level='body-sm'>
          Resume this chat in Claude Code, or give Claude Code a folder to work on.
        </Typography>

        <Sheet variant='soft' sx={{ p: 2, borderRadius: 'md', display: 'grid', gap: 1.5 }}>
          <_OptionCheckbox
            label='Images'
            detail={content.imageCount ? `${content.imageCount} · ${humanReadableBytes(content.imageBytes)}` : 'none in this chat'}
            checked={options.includeImages && content.imageCount > 0}
            disabled={!content.imageCount}
            onChange={checked => setOptions(o => ({ ...o, includeImages: checked }))}
          />
          <_OptionCheckbox
            label='System prompt'
            detail={content.hasSystemPrompt ? 'as context at the start of the session' : 'none in this chat'}
            checked={options.includeSystemPrompt && content.hasSystemPrompt}
            disabled={!content.hasSystemPrompt}
            onChange={checked => setOptions(o => ({ ...o, includeSystemPrompt: checked }))}
          />
          <_OptionCheckbox
            label='Session in folder'
            detail='adds session.claude.jsonl to the zip, to resume from the folder'
            checked={options.includeSessionInFolder}
            onChange={checked => setOptions(o => ({ ...o, includeSessionInFolder: checked }))}
          />
          <_OptionCheckbox
            label='Reasoning'
            detail='not exported'
            checked={false}
            disabled
          />
        </Sheet>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant='soft' loading={busyFormat === 'folder'} disabled={!!busyFormat}
            endDecorator={<FileDownloadOutlinedIcon />}
            sx={{ flex: 1, minWidth: 200, justifyContent: 'space-between' }}
            onClick={() => handleDownload('folder')}
          >
            Folder · ZIP
          </Button>
          <Button
            variant='soft' loading={busyFormat === 'session'} disabled={!!busyFormat}
            endDecorator={<FileDownloadOutlinedIcon />}
            sx={{ flex: 1, minWidth: 200, justifyContent: 'space-between' }}
            onClick={() => handleDownload('session')}
          >
            Session · JSONL
          </Button>
        </Box>

        {!!saved && (
          <Typography level='body-sm' color='success' startDecorator={<DoneIcon />}>
            Saved {saved.fileName}
          </Typography>
        )}

        {!!resumeCommand && <Box>
          <Typography level='body-sm' sx={{ mb: 0.5 }}>
            Resume in Claude Code, from the folder where the {saved?.fileName.endsWith('.zip') ? 'zip was extracted' : 'file was saved'}:
          </Typography>
          <Sheet variant='outlined' sx={{ pl: 1.5, borderRadius: 'sm', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level='body-sm' sx={{ fontFamily: 'code', flex: 1, overflowWrap: 'anywhere' }}>
              {resumeCommand}
            </Typography>
            <IconButton size='sm' onClick={() => copyToClipboard(resumeCommand, 'Command')}>
              <ContentCopyIcon />
            </IconButton>
          </Sheet>
        </Box>}

        {!!error && (
          <Typography level='body-sm' color='danger'>
            {error}
          </Typography>
        )}

      </GoodModal>
    )}

  </>;
}
