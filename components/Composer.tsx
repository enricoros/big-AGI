import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, Card, Grid, IconButton, ListDivider, Menu, MenuItem, Stack, Textarea, Tooltip, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import DataArrayIcon from '@mui/icons-material/DataArray';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import MicIcon from '@mui/icons-material/Mic';
import PanToolIcon from '@mui/icons-material/PanTool';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { ChatModels } from '@/lib/data';
import { ContentReducerModal } from '@/components/dialogs/ContentReducerModal';
import { TokenBadge } from '@/components/util/TokenBadge';
import { convertHTMLTableToMarkdown } from '@/lib/markdown';
import { countModelTokens } from '@/lib/tokens';
import { extractPdfText } from '@/lib/pdf';
import { useChatStore } from '@/lib/store-chats';
import { useComposerStore, useSettingsStore } from '@/lib/store-settings';
import { useSpeechRecognition } from '@/components/util/useSpeechRecognition';


/// Text template helpers

const PromptTemplates = {
  Concatenate: '{{input}}\n\n{{text}}',
  PasteFile: '{{input}}\n\n```{{fileName}}\n{{fileText}}\n```\n',
  PasteMarkdown: '{{input}}\n\n```\n{{clipboard}}\n```\n',
};

const expandPromptTemplate = (template: string, dict: object) => (inputValue: string): string => {
  let expanded = template.replaceAll('{{input}}', (inputValue || '').trim()).trim();
  for (const [key, value] of Object.entries(dict))
    expanded = expanded.replaceAll(`{{${key}}}`, value.trim());
  return expanded;
};


const attachFileLegend =
  <Stack sx={{ p: 1, gap: 1, fontSize: '16px', fontWeight: 400 }}>
    <Box sx={{ mb: 1, textAlign: 'center' }}>
      Attach a file to the message
    </Box>
    <table>
      <tbody>
      <tr>
        <td width={36}><PictureAsPdfIcon sx={{ width: 24, height: 24 }} /></td>
        <td><b>PDF</b></td>
        <td width={36} align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📝 Text (split manually)</td>
      </tr>
      <tr>
        <td><DataArrayIcon sx={{ width: 24, height: 24 }} /></td>
        <td><b>Code</b></td>
        <td align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📚 Markdown</td>
      </tr>
      <tr>
        <td><FormatAlignCenterIcon sx={{ width: 24, height: 24 }} /></td>
        <td><b>Text</b></td>
        <td align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📝 As-is</td>
      </tr>
      </tbody>
    </table>
    <Box sx={{ mt: 1, fontSize: '14px' }}>
      Drag & drop in chat for faster loads ⚡
    </Box>
  </Stack>;

const pasteClipboardLegend =
  <Box sx={{ p: 1, fontSize: '14px', fontWeight: 400 }}>
    Converts Code and Tables to 📚 Markdown
  </Box>;


/**
 * A React component for composing and sending messages in a chat-like interface.
 * Supports pasting text and code from the clipboard, and a local history of sent messages.
 *
 * Note: Useful bash trick to generate code from a list of files:
 *       $ for F in *.ts; do echo; echo "\`\`\`$F"; cat $F; echo; echo "\`\`\`"; done | clip
 *
 * @param {boolean} props.disableSend - Flag to disable the send button.
 * @param {(text: string, conversationId: string | null) => void} props.sendMessage - Function to send the message. conversationId is null for the Active conversation
 * @param {() => void} props.stopGeneration - Function to stop response generation
 */
export function Composer(props: {
  conversationId: string | null; messageId: string | null;
  isDeveloperMode: boolean;
  onSendMessage: (conversationId: string, text: string) => void;
  sx?: SxProps;
}) {
  // state
  const [composeText, setComposeText] = React.useState('');
  const [isDragging, setIsDragging] = React.useState(false);
  const [reducerText, setReducerText] = React.useState('');
  const [reducerTextTokens, setReducerTextTokens] = React.useState(0);
  const [historyAnchor, setHistoryAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);

  // external state
  const theme = useTheme();
  const { history, appendMessageToHistory } = useComposerStore(state => ({ history: state.history, appendMessageToHistory: state.appendMessageToHistory }), shallow);
  const stopTyping = useChatStore(state => state.stopTyping);
  const modelMaxResponseTokens = useSettingsStore(state => state.modelMaxResponseTokens);


  const { assistantTyping, chatModelId, tokenCount: conversationTokenCount } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      assistantTyping: conversation ? !!conversation.abortController : false,
      chatModelId: conversation ? conversation.chatModelId : null,
      tokenCount: conversation ? conversation.tokenCount : 0,
    };
  }, shallow);


  // derived state
  const tokenLimit = chatModelId ? ChatModels[chatModelId]?.contextWindowSize || 8192 : 0;
  const directTokens = React.useMemo(() => {
    return (!composeText || !chatModelId) ? 0 : countModelTokens(composeText, chatModelId, 'composer text');
  }, [chatModelId, composeText]);
  const indirectTokens = modelMaxResponseTokens + conversationTokenCount;
  const remainingTokens = tokenLimit - directTokens - indirectTokens;


  const handleSendClicked = () => {
    const text = (composeText || '').trim();
    if (text.length && props.conversationId) {
      setComposeText('');
      props.onSendMessage(props.conversationId, text);
      appendMessageToHistory(text);
    }
  };

  const handleStopClicked = () => props.conversationId && stopTyping(props.conversationId);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      if (!assistantTyping)
        handleSendClicked();
      e.preventDefault();
    }
  };


  const onSpeechResultCallback = React.useCallback((transcript: string) => {
    setComposeText(current => {
      current = current.trim();
      transcript = transcript.trim();
      if ((!current || current.endsWith('.') || current.endsWith('!') || current.endsWith('?')) && transcript.length)
        transcript = transcript[0].toUpperCase() + transcript.slice(1);
      return current ? current + ' ' + transcript : transcript;
    });
  }, []);

  const { isSpeechEnabled, isSpeechError, isRecordingAudio, isRecordingSpeech, toggleRecording } = useSpeechRecognition(onSpeechResultCallback);

  const handleMicClicked = () => toggleRecording();

  const micColor = isSpeechError ? 'danger' : isRecordingSpeech ? 'warning' : isRecordingAudio ? 'warning' : 'neutral';
  const micVariant = isRecordingSpeech ? 'solid' : isRecordingAudio ? 'soft' : 'plain';

  async function loadAndAttachFiles(files: FileList) {

    // perform loading and expansion
    let newText = '';
    for (let file of files) {
      let fileText = '';
      try {
        if (file.type === 'application/pdf')
          fileText = await extractPdfText(file);
        else
          fileText = await file.text();
        newText = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: file.name, fileText })(newText);
      } catch (error) {
        // show errors in the prompt box itself - FUTURE: show in a toast
        console.error(error);
        newText = `${newText}\n\nError loading file ${file.name}: ${error}\n`;
      }
    }

    // see how we fare on budget
    if (chatModelId) {
      const newTextTokens = countModelTokens(newText, chatModelId, 'reducer trigger');

      // simple trigger for the reduction dialog
      if (newTextTokens > remainingTokens) {
        setReducerTextTokens(newTextTokens);
        setReducerText(newText);
        return;
      }
    }

    // update the text: just
    setComposeText(text => expandPromptTemplate(PromptTemplates.Concatenate, { text: newText })(text));
  }

  const handleContentReducerClose = () => {
    setReducerText('');
  };

  const handleContentReducerText = (newText: string) => {
    handleContentReducerClose();
    setComposeText(text => text + newText);
  };

  const handleShowFilePicker = () => attachmentFileInputRef.current?.click();

  const handleLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (files && files.length >= 1)
      await loadAndAttachFiles(files);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };


  const handlePasteFromClipboard = async () => {
    for (let clipboardItem of await navigator.clipboard.read()) {

      // find the text/html item if any
      try {
        const htmlItem = await clipboardItem.getType('text/html');
        const htmlString = await htmlItem.text();
        // paste tables as markdown
        if (htmlString.indexOf('<table') == 0) {
          const markdownString = convertHTMLTableToMarkdown(htmlString);
          setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: markdownString }));
          continue;
        }
        // TODO: paste html to markdown (tried Turndown, but the gfm plugin is not good - need to find another lib with minimal footprint)
      } catch (error) {
        // ignore missing html
      }

      // find the text/plain item if any
      try {
        const textItem = await clipboardItem.getType('text/plain');
        const textString = await textItem.text();
        setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: textString }));
        continue;
      } catch (error) {
        // ignore missing text
      }

      // no text/html or text/plain item found
      console.log('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  };


  const pasteFromHistory = (text: string) => {
    setComposeText(text);
    hideHistory();
  };

  const showHistory = (event: React.MouseEvent<HTMLAnchorElement>) => setHistoryAnchor(event.currentTarget);

  const hideHistory = () => setHistoryAnchor(null);


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

    // dropped files
    if (e.dataTransfer.files?.length >= 1)
      return loadAndAttachFiles(e.dataTransfer.files);

    // special case: detect failure of dropping from VSCode
    // VSCode: Drag & Drop does not transfer the File object: https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    if ('codeeditors' in e.dataTransfer.types)
      return setComposeText(test => test + 'Pasting from VSCode is not supported! Fixme. Anyone?');

    // dropped text
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText?.length >= 1)
      return setComposeText(text => expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: droppedText })(text));

    // future info for dropping
    console.log('Unhandled Drop event. Contents: ', e.dataTransfer.types.map(t => `${t}: ${e.dataTransfer.getData(t)}`));
  };


  const textPlaceholder: string = `Type ${props.isDeveloperMode ? 'your message and drop source files' : 'a message, or drop text files'}...`;
  const hideOnMobile = { display: { xs: 'none', md: 'flex' } };
  const hideOnDesktop = { display: { xs: 'flex', md: 'none' } };


  return (
    <Box sx={props.sx}>
      <Grid container spacing={{ xs: 1, md: 2 }}>

        {/* Left pane (buttons and Textarea) */}
        <Grid xs={12} md={9}><Stack direction='row' spacing={{ xs: 1, md: 2 }}>

          {/* Vertical Buttons Bar */}
          <Stack>

            {/*<Typography level='body3' sx={{mb: 2}}>Context</Typography>*/}

            <IconButton variant='plain' color='neutral' onClick={handleShowFilePicker} sx={{ ...hideOnDesktop }}>
              <UploadFileIcon />
            </IconButton>
            <Tooltip
              variant='solid' placement='top-start'
              title={attachFileLegend}>
              <Button fullWidth variant='plain' color='neutral' onClick={handleShowFilePicker} startDecorator={<UploadFileIcon />}
                      sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
                Attach
              </Button>
            </Tooltip>

            <Box sx={{ mt: { xs: 1, md: 2 } }} />

            <IconButton variant='plain' color='neutral' onClick={handlePasteFromClipboard} sx={{ ...hideOnDesktop }}>
              <ContentPasteGoIcon />
            </IconButton>
            <Tooltip
              variant='solid' placement='top-start'
              title={pasteClipboardLegend}>
              <Button fullWidth variant='plain' color='neutral' startDecorator={<ContentPasteGoIcon />} onClick={handlePasteFromClipboard}
                      sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
                {props.isDeveloperMode ? 'Paste code' : 'Paste'}
              </Button>
            </Tooltip>

            {isSpeechEnabled && <Box sx={{ mt: { xs: 1, md: 2 }, ...hideOnDesktop }}>
              <IconButton variant={micVariant} color={micColor} onClick={handleMicClicked}>
                <MicIcon />
              </IconButton>
            </Box>}

            <input type='file' multiple hidden ref={attachmentFileInputRef} onChange={handleLoadFile} />

          </Stack>

          {/* Edit box, with Drop overlay */}
          <Box sx={{ flexGrow: 1, position: 'relative' }}>

            <Textarea
              variant='outlined' autoFocus placeholder={textPlaceholder}
              minRows={4} maxRows={12}
              onKeyDown={handleKeyPress}
              onDragEnter={handleMessageDragEnter}
              value={composeText} onChange={(e) => setComposeText(e.target.value)}
              slotProps={{
                textarea: {
                  sx: {
                    ...(isSpeechEnabled ? { pr: { md: 5 } } : {}),
                  },
                },
              }}
              sx={{
                background: theme.vars.palette.background.level1,
                fontSize: '16px',
                lineHeight: 1.75,
              }} />

            {!!tokenLimit && <TokenBadge directTokens={directTokens} indirectTokens={indirectTokens} tokenLimit={tokenLimit} absoluteBottomRight />}

            <Card
              color='primary' invertedColors variant='soft'
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
                variant={micVariant} color={micColor}
                onClick={handleMicClicked}
                sx={{
                  ...hideOnMobile,
                  position: 'absolute',
                  top: 0, right: 0,
                  margin: 1, // 8px
                }}>
                <MicIcon />
              </IconButton>
            )}
          </Box>

        </Stack></Grid>

        {/* Send pane */}
        <Grid xs={12} md={3}>
          <Stack spacing={2}>

            <Box sx={{ display: 'flex', flexDirection: 'row' }}>

              {/* [mobile-only] History arrow */}
              {history.length > 0 && (
                <IconButton variant='plain' color='neutral' onClick={showHistory} sx={{ ...hideOnDesktop, mr: { xs: 1, md: 2 } }}>
                  <KeyboardArrowUpIcon />
                </IconButton>
              )}

              {/* Send / Stop */}
              {assistantTyping
                ? <Button fullWidth variant='soft' color='primary' disabled={!props.conversationId} onClick={handleStopClicked} endDecorator={<StopOutlinedIcon />}>
                  Stop
                </Button>
                : <Button fullWidth variant='solid' color='primary' disabled={!props.conversationId} onClick={handleSendClicked} endDecorator={<TelegramIcon />}>
                  Chat
                </Button>}
            </Box>

            {/* [desktop-only] row with History button */}
            <Stack direction='row' spacing={1} sx={{ ...hideOnMobile, flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'flex-end' }}>
              {history.length > 0 && (
                <Button fullWidth variant='plain' color='neutral' startDecorator={<KeyboardArrowUpIcon />} onClick={showHistory}>
                  History
                </Button>
              )}
            </Stack>

          </Stack>
        </Grid>

        {/* History menu with all the line items (only if shown) */}
        {!!historyAnchor && (
          <Menu
            variant='plain' color='neutral' size='md' placement='top-end' sx={{ minWidth: 320 }}
            open anchorEl={historyAnchor} onClose={hideHistory}>
            <MenuItem color='neutral' selected>Reuse messages 💬</MenuItem>
            <ListDivider />
            {history.map((item, index) => (
              <MenuItem key={'compose-history-' + index} onClick={() => pasteFromHistory(item.text)}>
                {item.count > 1 && <Typography level='body2' color='neutral' sx={{ mr: 1 }}>({item.count})</Typography>}
                {item.text.length > 60 ? item.text.slice(0, 58) + '...' : item.text}
              </MenuItem>
            ))}
            {/*<ListDivider /><MenuItem><ListItemDecorator><ClearIcon /></ListItemDecorator>Clear</MenuItem>*/}
          </Menu>
        )}

        {/* Content reducer modal */}
        {reducerText?.length >= 1 && chatModelId &&
          <ContentReducerModal
            initialText={reducerText} initialTokens={reducerTextTokens} tokenLimit={remainingTokens} chatModelId={chatModelId}
            onReducedText={handleContentReducerText} onClose={handleContentReducerClose}
          />
        }

      </Grid>
    </Box>
  );
}