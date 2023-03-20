import * as React from 'react';

import { Button, Card, Grid, ListDivider, Menu, MenuItem, Stack, Textarea, Typography } from '@mui/joy';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PanToolIcon from '@mui/icons-material/PanTool';
import TelegramIcon from '@mui/icons-material/Telegram';


/// localStorage (your browser) : Log of sent messages

const LOCALSTORAGE_KEY_COMPOSER_HISTORY = 'app-composer-history';

const loadMessagesFromHistory = (): string[] => {
  if (typeof localStorage === 'undefined') return [];
  const storedData = localStorage.getItem(LOCALSTORAGE_KEY_COMPOSER_HISTORY);
  return storedData ? JSON.parse(storedData) : [];
};

const appendMessageToHistory = (composeText: string, maxMessages: number = 20) => {
  if (typeof localStorage === 'undefined') return;
  // prepend message to list, removing duplicates (effectually 'bubbling to the top')
  const optimizedText = composeText.trim();
  const composedMessages = loadMessagesFromHistory().filter(m => m.trim() !== optimizedText);
  composedMessages.unshift(composeText);
  localStorage.setItem(LOCALSTORAGE_KEY_COMPOSER_HISTORY, JSON.stringify(composedMessages.slice(0, maxMessages)));
};


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
 */
export function Composer({ isDeveloper, disableSend, sendMessage }: { isDeveloper: boolean; disableSend: boolean; sendMessage: (text: string) => void; }) {
  // state
  const [composeText, setComposeText] = React.useState('');
  const [historyAnchor, setHistoryAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleSendClicked = () => {
    const text = (composeText || '').trim();
    if (text.length) {
      setComposeText('');
      sendMessage(text);
      appendMessageToHistory(text);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!disableSend)
        handleSendClicked();
      e.preventDefault();
    }
  };

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

    // paste Text
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText) {
      text = expandPromptTemplate(PromptTemplates.PasteText, { clipboard: droppedText })(text);
      setComposeText(text);
    }
  };

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

  return (
    <Grid container spacing={{ xs: 1, md: 2 }}>

      <Grid xs={12} sm={9} sx={{ position: 'relative' }}>

        {/* Message edit box */}
        <Textarea variant='soft' autoFocus placeholder={textPlaceholder}
                  minRows={5} maxRows={16}
                  onKeyDown={handleKeyPress}
                  onDragEnter={handleMessageDragEnter}
                  value={composeText} onChange={(e) => setComposeText(e.target.value)}
                  sx={{ fontSize: '16px', lineHeight: 1.75 }} />

        {/* drop target overlay (display: none by default) */}
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
              onDrop={handleOverlayDrop}
        >
          <PanToolIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
          <Typography level='body2' sx={{ pointerEvents: 'none' }}>
            I will hold on to this for you
          </Typography>
        </Card>

      </Grid>

      <Grid xs={12} sm={3}>
        <Stack spacing={2}>

          <Button fullWidth variant='solid' color='primary' disabled={disableSend} onClick={handleSendClicked} endDecorator={<TelegramIcon />}>
            Chat
          </Button>

          <Stack direction='row' spacing={1} sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between' }}>
            <Button variant='plain' color='neutral' startDecorator={<ContentPasteGoIcon />} onClick={pasteFromClipboard}>
              {isDeveloper ? 'Code' : 'Paste'}
            </Button>
            <Button variant='plain' color='neutral' startDecorator={<KeyboardArrowUpIcon />} onClick={showHistory}>
              History
            </Button>
          </Stack>

        </Stack>
      </Grid>

      {/* History menu with all the line items (only if shown) */}
      {!!historyAnchor && (
        <Menu size='md' anchorEl={historyAnchor} open onClose={hideHistory} sx={{ minWidth: 320 }}>
          <MenuItem color='neutral' selected>Reuse messages 💬</MenuItem>
          <ListDivider />
          {loadMessagesFromHistory().map((text, index) => (
            <MenuItem key={'compose-history-' + index} onClick={() => pasteFromHistory(text)}>
              {text.length > 60 ? text.slice(0, 58) + '...' : text}
            </MenuItem>
          ))}
          {/*<ListDivider /><MenuItem><ListItemDecorator><ClearIcon /></ListItemDecorator>Clear</MenuItem>*/}
        </Menu>
      )}

    </Grid>
  );
}