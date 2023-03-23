import React from 'react';

import { Box, Button, Card, Grid, IconButton, ListDivider, Menu, MenuItem, Stack, Textarea, Tooltip, Typography } from '@mui/joy';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import MicIcon from '@mui/icons-material/Mic';
import PanToolIcon from '@mui/icons-material/PanTool';
import PostAddIcon from '@mui/icons-material/PostAdd';
import TelegramIcon from '@mui/icons-material/Telegram';
import StopIcon from '@mui/icons-material/Stop';

import { useComposerStore } from '../utilities/store';
import { useSpeechRecognition } from '../utilities/speechRecognition';
import { NoSSR } from './NoSSR';


/// Text template helpers

const PromptTemplates = {
  PasteText: '{{input}}\n\n{{clipboard}}\n',
  PasteCode: '{{input}}\n\n```\n{{clipboard}}\n```\n',
  PasteFile: '{{input}}\n\n```{{fileName}}\n{{fileText}}\n```\n',
};

const expandPromptTemplate = (template: string, dict: object) => (inputValue: string): string => {
  let expanded = template.replaceAll('{{input}}', (inputValue || '').trim()).trim();
  for (const [key, value] of Object.entries(dict))
    expanded = expanded.replaceAll(`{{${key}}}`, value);
  return expanded;
};


/**
 * A React component for composing and sending messages in a chat-like interface.
 * Supports pasting text and code from the clipboard, and a local history of sent messages.
 *
 * Note: Useful bash trick to generate code from a list of files:
 *       $ for F in *.ts; do echo; echo "\`\`\`$F"; cat $F; echo; echo "\`\`\`"; done | clip
 *
 * @param {boolean} isDeveloper - Flag to indicate if the user is a developer.
 * @param {boolean} disableSend - Flag to disable the send button.
 * @param {(text: string) => void} sendMessage - Function to send the composed message.
 * @param {() => void} stopGeneration - Function to stop message generation
 */
export function Composer({ isDeveloper, disableSend, sendMessage, stopGeneration }: { isDeveloper: boolean; disableSend: boolean; sendMessage: (text: string) => void; stopGeneration: () => void; }) {
  // state
  const [composeText, setComposeText] = React.useState('');
  const { history, appendMessageToHistory } = useComposerStore(state => ({ history: state.history, appendMessageToHistory: state.appendMessageToHistory }));
  const [historyAnchor, setHistoryAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);


  const handleSendClicked = () => {
    const text = (composeText || '').trim();
    if (text.length) {
      setComposeText('');
      sendMessage(text);
      appendMessageToHistory(text);
    }
  };

  // Create a function to handle stop generation
  const handleStopGeneration = () => {
    stopGeneration();
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!disableSend)
        handleSendClicked();
      e.preventDefault();
    }
  };


  const onSpeechResultCallback = React.useCallback((transcript: string) => {
    setComposeText(current => current + ' ' + transcript);
  }, []);

  const { isSpeechEnabled, isRecordingSpeech, startRecording } = useSpeechRecognition(onSpeechResultCallback);

  const handleMicClicked = () => startRecording();


  const eatDragEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMessageDragEnter = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(true);
  };

  const handleOverlayDragLeave = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);
  };

  const handleOverlayDragOver = (e: React.DragEvent) => {
    eatDragEvent(e);
    // e.dataTransfer.dropEffect = 'copy';
  };

  const handleOverlayDrop = async (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);

    // paste Files
    let text = composeText;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      // Paste all files
      for (const file of files)
        text = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: file.name, fileText: await file.text() })(text);
      setComposeText(text);
      return;
    }

    // detect failure of dropping from VSCode
    if (e.dataTransfer.types.indexOf('codeeditors') >= 0) {
      setComposeText(text + '\nPasting from VSCode is not supported! Fixme. Anyone?');
      return;
    }

    // paste Text
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText) {
      text = expandPromptTemplate(PromptTemplates.PasteText, { clipboard: droppedText })(text);
      setComposeText(text);
      return;
    }

    // NOTE for VSCode - a Drag & Drop does not transfer the File object
    // https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    console.log('Unhandled Drop event. Contents: ', e.dataTransfer.types.map(t => `${t}: ${e.dataTransfer.getData(t)}`));
  };


  const handleAttachmentChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    let text = composeText;
    for (let i = 0; i < files.length; i++)
      text = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: files[i].name, fileText: await files[i].text() })(text);
    setComposeText(text);
  };

  const handleOpenAttachmentPicker = () => attachmentFileInputRef.current?.click();


  const pasteFromClipboard = async () => {
    const clipboardContent = (await navigator.clipboard.readText() || '').trim();
    if (clipboardContent) {
      const template = isDeveloper ? PromptTemplates.PasteCode : PromptTemplates.PasteText;
      setComposeText(expandPromptTemplate(template, { clipboard: clipboardContent }));
    }
  };

  const pasteFromHistory = (text: string) => {
    setComposeText(text);
    hideHistory();
  };


  const showHistory = (event: React.MouseEvent<HTMLAnchorElement>) => setHistoryAnchor(event.currentTarget);

  const hideHistory = () => setHistoryAnchor(null);


  const textPlaceholder: string = 'Type a message...'; // 'Enter your message...\n  <enter> send\n  <shift>+<enter> new line\n  ``` code';*/
  const hideOnMobile = { display: { xs: 'none', md: 'flex' } };
  const hideOnDesktop = { display: { xs: 'flex', md: 'none' } };

  return (
    <Grid container spacing={{ xs: 1, md: 2 }}>

      {/* Compose & VButtons */}
      <Grid xs={12} md={9}><Stack direction='row' spacing={{ xs: 1, md: 2 }}>

        {/* Vertical Buttons Bar */}
        <Box>

          <IconButton variant='plain' color='neutral' onClick={handleOpenAttachmentPicker} sx={{ ...hideOnDesktop }}>
            <PostAddIcon />
          </IconButton>
          <Tooltip title={<>Attach {isDeveloper ? 'code' : 'text'} files · also drag-and-drop 👇</>} variant='solid' placement='top-start'>
            <Button fullWidth variant='plain' color='neutral' onClick={handleOpenAttachmentPicker} startDecorator={<PostAddIcon />}
                    sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
              Attach
            </Button>
          </Tooltip>

          <Box sx={{ mt: { xs: 1, md: 2 } }} />

          <IconButton variant='plain' color='neutral' onClick={pasteFromClipboard} sx={{ ...hideOnDesktop }}>
            <ContentPasteGoIcon />
          </IconButton>
          <Button fullWidth variant='plain' color='neutral' startDecorator={<ContentPasteGoIcon />} onClick={pasteFromClipboard} sx={{ ...hideOnMobile }}>
            {isDeveloper ? 'Paste code' : 'Paste'}
          </Button>

          <input type='file' multiple hidden ref={attachmentFileInputRef} onChange={handleAttachmentChanged} />

        </Box>

        {/* Message edit box, with Drop overlay */}
        <Box sx={{ flexGrow: 1, position: 'relative' }}>

          <Textarea variant='soft' autoFocus placeholder={textPlaceholder}
                    minRows={5} maxRows={12}
                    onKeyDown={handleKeyPress}
                    onDragEnter={handleMessageDragEnter}
                    value={composeText} onChange={(e) => setComposeText(e.target.value)}
                    sx={{
                      fontSize: '16px',
                      lineHeight: 1.75,
                      pr: isSpeechEnabled ? { xs: 4, md: 5 } : 0, // accounts for the microphone icon when supported
                    }} />

          <Card color='primary' invertedColors variant='soft'
                sx={{
                  display: isDragging ? 'flex' : 'none',
                  position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                  alignItems: 'center', justifyContent: 'space-evenly',
                  border: '2px dashed',
                  zIndex: 10,
                }}
                onDragLeave={handleOverlayDragLeave}
                onDragOver={handleOverlayDragOver}
                onDrop={handleOverlayDrop}>
            <PanToolIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
            <Typography level='body2' sx={{ pointerEvents: 'none' }}>
              I will hold on to this for you
            </Typography>
          </Card>

          {isSpeechEnabled && (
            <IconButton
              onClick={handleMicClicked}
              color={isRecordingSpeech ? 'warning' : 'primary'}
              variant={isRecordingSpeech ? 'solid' : 'plain'}
              sx={{
                position: 'absolute',
                top: 0, right: 0,
                margin: 1, // 8px
              }}>
              <MicIcon />
            </IconButton>
          )}
        </Box>

      </Stack></Grid>

      {/* Other Buttons */}
      <Grid xs={12} md={3}>
        <Stack spacing={1}>

          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <NoSSR>
              {history.length > 0 && (
                <IconButton variant='plain' color='neutral' onClick={showHistory} sx={{ ...hideOnDesktop, mr: { xs: 1, md: 2 } }}>
                  <KeyboardArrowUpIcon />
                </IconButton>
              )}
            </NoSSR>
            <Button fullWidth variant='solid' color='primary' disabled={disableSend} onClick={handleSendClicked} endDecorator={<TelegramIcon />}>
              Chat
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <Button fullWidth variant='solid' color='primary' disabled={!disableSend} onClick={handleStopGeneration} endDecorator={<StopIcon />}>
              Stop Generation
            </Button>
          </Box>

          <Stack direction='row' spacing={1} sx={{ ...hideOnMobile, flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'flex-end' }}>
            <NoSSR>
              {history.length > 0 && (
                <Button variant='plain' color='neutral' startDecorator={<KeyboardArrowUpIcon />} onClick={showHistory}>
                  History
                </Button>
              )}
            </NoSSR>
          </Stack>

        </Stack>
      </Grid>

      {/* History menu with all the line items (only if shown) */}
      {!!historyAnchor && (
        <Menu size='md' anchorEl={historyAnchor} open onClose={hideHistory} sx={{ minWidth: 320 }}>
          <MenuItem color='neutral' selected>Reuse messages 💬</MenuItem>
          <ListDivider />
          {history.map((item, index) => (
            <MenuItem key={'compose-history-' + index} onClick={() => pasteFromHistory(item.text)}>
              {item.count > 1 && <Typography level='body2' color='neutral' sx={{ mr: 1 }}>{item.count}</Typography>}
              {item.text.length > 60 ? item.text.slice(0, 58) + '...' : item.text}
            </MenuItem>
          ))}
          {/*<ListDivider /><MenuItem><ListItemDecorator><ClearIcon /></ListItemDecorator>Clear</MenuItem>*/}
        </Menu>
      )}

    </Grid>
  );
}