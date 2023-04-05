import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Badge, Box, Button, Card, Grid, IconButton, ListDivider, Menu, MenuItem, Stack, Textarea, Tooltip, Typography } from '@mui/joy';
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
import { convertHTMLTableToMarkdown } from '@/lib/markdown';
import { countModelTokens } from '@/lib/tokens';
import { extractPdfText } from '@/lib/pdf';
import { useActiveConfiguration } from '@/lib/store-chats';
import { useComposerStore, useSettingsStore } from '@/lib/store-settings';
import { useSpeechRecognition } from '@/components/util/useSpeechRecognition';


/// Text template helpers

const PromptTemplates = {
  PasteFile: '{{input}}\n\n```{{fileName}}\n{{fileText}}\n```\n',
  PasteMarkdown: '{{input}}\n\n```\n{{clipboard}}\n```\n',
};

const expandPromptTemplate = (template: string, dict: object) => (inputValue: string): string => {
  let expanded = template.replaceAll('{{input}}', (inputValue || '').trim()).trim();
  for (const [key, value] of Object.entries(dict))
    expanded = expanded.replaceAll(`{{${key}}}`, value);
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
export function Composer(props: { disableSend: boolean; isDeveloperMode: boolean; sendMessage: (text: string, conversationId: string | null) => void; stopGeneration: () => void }) {
  // state
  const [composeText, setComposeText] = React.useState('');
  const [isDragging, setIsDragging] = React.useState(false);
  const [historyAnchor, setHistoryAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);

  // external state
  const { history, appendMessageToHistory } = useComposerStore(state => ({ history: state.history, appendMessageToHistory: state.appendMessageToHistory }), shallow);
  const { chatModelId } = useActiveConfiguration();
  const modelMaxResponseTokens = useSettingsStore(state => state.modelMaxResponseTokens);


  const handleSendClicked = () => {
    const text = (composeText || '').trim();
    if (text.length) {
      setComposeText('');
      props.sendMessage(text, null);
      appendMessageToHistory(text);
    }
  };

  const handleStopClicked = () => props.stopGeneration();

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      if (!props.disableSend)
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

  async function loadAndAttachFiles(files: FileList) {

    // perform loading and expansion
    let text = composeText;
    for (let file of files) {
      let fileText = '';
      try {
        if (file.type === 'application/pdf')
          fileText = await extractPdfText(file);
        else
          fileText = await file.text();
        text = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: file.name, fileText })(text);
      } catch (error) {
        // show errors in the prompt box itself - FUTURE: show in a toast
        console.error(error);
        text = `${text}\n\nError loading file ${file.name}: ${error}\n`;
      }
    }

    // update the text
    setComposeText(text);
  }

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


  const handleOpenFilePicker = () => attachmentFileInputRef.current?.click();

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


  const textPlaceholder: string = `Type ${props.isDeveloperMode ? 'your message and drop source files' : 'a message, or drop text files'}...`;
  const hideOnMobile = { display: { xs: 'none', md: 'flex' } };
  const hideOnDesktop = { display: { xs: 'flex', md: 'none' } };

  // compute tokens (warning: slow - shall have a toggle)
  const modelComposerTokens = countModelTokens(composeText, chatModelId);
  const modelRestOfChatTokens = 0;
  const estimatedTokens = modelComposerTokens + modelRestOfChatTokens;
  const modelContextTokens = ChatModels[chatModelId]?.contextWindowSize || 8192;
  const remainingTokens = modelContextTokens - estimatedTokens - modelMaxResponseTokens;
  const tokensString = `model: ${modelContextTokens.toLocaleString()} - chat: ${estimatedTokens.toLocaleString()} - response: ${modelMaxResponseTokens.toLocaleString()} = remaining: ${remainingTokens.toLocaleString()} ${remainingTokens < 0 ? '⚠️' : ''}`;
  const tokenColor = remainingTokens < 1 ? 'danger' : remainingTokens < modelComposerTokens / 4 ? 'warning' : 'primary';

  return (
    <Grid container spacing={{ xs: 1, md: 2 }}>

      {/* Compose & V-Buttons */}
      <Grid xs={12} md={9}><Stack direction='row' spacing={{ xs: 1, md: 2 }}>

        {/* Vertical Buttons Bar */}
        <Stack>

          {/*<Typography level='body3' sx={{mb: 2}}>Context</Typography>*/}

          <IconButton variant='plain' color='neutral' onClick={handleOpenFilePicker} sx={{ ...hideOnDesktop }}>
            <UploadFileIcon />
          </IconButton>
          <Tooltip
            variant='solid' placement='top-start'
            title={attachFileLegend}>
            <Button fullWidth variant='plain' color='neutral' onClick={handleOpenFilePicker} startDecorator={<UploadFileIcon />}
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
            <IconButton variant={!isRecordingSpeech ? 'plain' : 'solid'} color={!isRecordingSpeech ? 'neutral' : 'warning'} onClick={handleMicClicked}>
              <MicIcon />
            </IconButton>
          </Box>}

          <input type='file' multiple hidden ref={attachmentFileInputRef} onChange={handleLoadFile} />

        </Stack>

        {/* Edit box, with Drop overlay */}
        <Box sx={{ flexGrow: 1, position: 'relative' }}>

          <Textarea
            variant='soft' autoFocus placeholder={textPlaceholder}
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
              fontSize: '16px',
              lineHeight: 1.75,
            }} />

          <Badge
            size='md' variant='solid' max={65535} showZero={false}
            badgeContent={estimatedTokens > 0 ? <Tooltip title={tokensString} color={tokenColor}><span>{estimatedTokens.toLocaleString()}</span></Tooltip> : 0}
            color={tokenColor}
            sx={{
              position: 'absolute', bottom: 8, right: 8,
            }}
            slotProps={{
              badge: {
                sx: {
                  position: 'static', transform: 'none',
                },
              },
            }}
          />

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
              variant={!isRecordingSpeech ? 'plain' : 'solid'} color={!isRecordingSpeech ? 'primary' : 'warning'}
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
            <Button fullWidth variant={props.disableSend ? 'soft' : 'solid'} color='primary'
                    onClick={props.disableSend ? handleStopClicked : handleSendClicked}
                    endDecorator={props.disableSend ? <StopOutlinedIcon /> : <TelegramIcon />}>
              {props.disableSend ? 'Stop' : 'Chat'}
            </Button>
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

    </Grid>
  );
}