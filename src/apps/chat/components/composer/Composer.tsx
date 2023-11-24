import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, ButtonGroup, Card, CircularProgress, Grid, IconButton, Stack, Textarea, Tooltip, Typography } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import CallIcon from '@mui/icons-material/Call';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import MicIcon from '@mui/icons-material/Mic';
import PanToolIcon from '@mui/icons-material/PanTool';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import type { ChatModeId } from '../../AppChat';

import { CmdRunReact } from '~/modules/aifn/react/react';
import { ContentReducer } from '~/modules/aifn/summarize/ContentReducer';
import { LLMOptionsOpenAI } from '~/modules/llms/vendors/openai/openai.vendor';
import { callBrowseFetchPage } from '~/modules/browse/browse.client';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';
import { useChatLLM } from '~/modules/llms/store-llms';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { KeyStroke } from '~/common/components/KeyStroke';
import { SpeechResult, useSpeechRecognition } from '~/common/components/useSpeechRecognition';
import { asValidURL } from '~/common/util/urlUtils';
import { countModelTokens } from '~/common/util/token-counter';
import { extractFilePathsWithCommonRadix } from '~/common/util/dropTextUtils';
import { getClipboardItems, supportsClipboardRead } from '~/common/util/clipboardUtils';
import { htmlTableToMarkdown } from '~/common/util/htmlTableToMarkdown';
import { launchAppCall } from '~/common/app.routes';
import { openLayoutPreferences } from '~/common/layout/store-applayout';
import { pdfToText } from '~/common/util/pdfToText';
import { playSoundUrl } from '~/common/util/audioUtils';
import { useDebouncer } from '~/common/components/useDebouncer';
import { useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { ButtonCameraCapture } from './ButtonCameraCapture';
import { ButtonClipboardPaste } from './ButtonClipboardPaste';
import { ButtonFileAttach } from './ButtonFileAttach';
import { ChatModeMenu } from './ChatModeMenu';
import { TokenBadge } from './TokenBadge';
import { TokenProgressbar } from './TokenProgressbar';
import { useComposerStartupText } from './store-composer';


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


const MicButton = (props: { variant: VariantProp, color: ColorPaletteProp, onClick: () => void, sx?: SxProps }) =>
  <Tooltip placement='top' title={
    <Box sx={{ p: 1, lineHeight: 2, gap: 1 }}>
      Voice input<br />
      <KeyStroke combo='Ctrl + M' />
    </Box>
  }>
    <IconButton variant={props.variant} color={props.color} onClick={props.onClick} sx={props.sx}>
      <MicIcon />
    </IconButton>
  </Tooltip>;

const MicContinuationButton = (props: { variant: VariantProp, color: ColorPaletteProp, onClick: () => void, sx?: SxProps }) =>
  <Tooltip placement='bottom' title={
    <Box sx={{ p: 1, lineHeight: 2, gap: 1 }}>
      Voice Continuation
    </Box>
  }>
    <IconButton variant={props.variant} color={props.color} onClick={props.onClick} sx={props.sx}>
      <AutoModeIcon />
    </IconButton>
  </Tooltip>;

const CallButtonMobile = (props: { disabled?: boolean, onClick: () => void, sx?: SxProps }) =>
  <IconButton variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} sx={props.sx}>
    <CallIcon />
  </IconButton>;

const CallButtonDesktop = (props: { disabled?: boolean, onClick: () => void, sx?: SxProps }) =>
  <Button variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} endDecorator={<CallIcon />} sx={props.sx}>
    Call
  </Button>;

const DrawOptionsButtonMobile = (props: { onClick: () => void, sx?: SxProps }) =>
  <IconButton variant='soft' color='warning' onClick={props.onClick} sx={props.sx}>
    <FormatPaintIcon />
  </IconButton>;

const DrawOptionsButtonDesktop = (props: { onClick: () => void, sx?: SxProps }) =>
  <Button variant='soft' color='warning' onClick={props.onClick} endDecorator={<FormatPaintIcon />} sx={props.sx}>
    Options
  </Button>;


/**
 * A React component for composing and sending messages in a chat-like interface.
 *
 * Note: Useful bash trick to generate code from a list of files:
 *       $ for F in *.ts; do echo; echo "\`\`\`$F"; cat $F; echo; echo "\`\`\`"; done | clip
 *
 * @param {boolean} props.disableSend - Flag to disable the send button.
 * @param {(text: string, conversationId: string | null) => void} props.sendMessage - Function to send the message. conversationId is null for the Active conversation
 * @param {() => void} props.stopGeneration - Function to stop response generation
 */
export function Composer(props: {
  conversationId: DConversationId | null;
  composerTextAreaRef: React.RefObject<HTMLTextAreaElement>;
  isDeveloperMode: boolean;
  onNewMessage: (chatModeId: ChatModeId, conversationId: DConversationId, text: string) => void;
  sx?: SxProps;
}) {

  // state
  const [composeText, debouncedText, setComposeText] = useDebouncer('', 300, 1200, true);
  const [micContinuation, setMicContinuation] = React.useState(false);
  const [speechInterimResult, setSpeechInterimResult] = React.useState<SpeechResult | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [reducerText, setReducerText] = React.useState('');
  const [reducerTextTokens, setReducerTextTokens] = React.useState(0);
  const [chatModeMenuAnchor, setChatModeMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // external state
  const isMobile = useIsMobile();
  const labsCalling = useUXLabsStore(state => state.labsCalling);
  const [chatModeId, setChatModeId] = React.useState<ChatModeId>('immediate');
  const [startupText, setStartupText] = useComposerStartupText();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);
  const { inComposer: browsingInComposer } = useBrowseCapability();
  const { assistantTyping, systemPurposeId, tokenCount: conversationTokenCount, stopTyping } = useChatStore(state => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      assistantTyping: conversation ? !!conversation.abortController : false,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      tokenCount: conversation ? conversation.tokenCount : 0,
      stopTyping: state.stopTyping,
    };
  }, shallow);
  const { chatLLMId, chatLLM } = useChatLLM();

  // derived state
  const isDesktop = !isMobile;
  const tokenLimit = chatLLM?.contextTokens || 0;
  const directTokens = React.useMemo(() => {
    return (!debouncedText || !chatLLMId) ? 4 : 4 + countModelTokens(debouncedText, chatLLMId, 'composer text');
  }, [chatLLMId, debouncedText]);
  const historyTokens = conversationTokenCount;
  const responseTokens = (chatLLM?.options as LLMOptionsOpenAI /* FIXME: BIG ASSUMPTION */)?.llmResponseTokens || 0;
  const remainingTokens = tokenLimit - directTokens - historyTokens - responseTokens;


  // Effect: load initial text if queued up (e.g. by /link/share_targe)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [setComposeText, setStartupText, startupText]);


  // Primary button

  const handleSendClicked = (_chatModeId: ChatModeId) => {
    const text = (composeText || '').trim();
    if (text.length && props.conversationId && chatLLMId) {
      setComposeText('');
      props.onNewMessage(_chatModeId, props.conversationId, text);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter')
      return;

    // Alt: append the message
    if (e.altKey) {
      handleSendClicked('write-user');
      return e.preventDefault();
    }

    // Shift: toggles the 'enter is newline'
    if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
      if (!assistantTyping)
        handleSendClicked(chatModeId);
      return e.preventDefault();
    }
  };


  // Secondary buttons

  const handleCallClicked = () => props.conversationId && systemPurposeId && launchAppCall(props.conversationId, systemPurposeId);

  const handleDrawOptionsClicked = () => openLayoutPreferences(2);


  // Mode menu

  const handleModeSelectorHide = () => setChatModeMenuAnchor(null);

  const handleModeSelectorShow = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setChatModeMenuAnchor(anchor => anchor ? null : event.currentTarget);

  const handleModeChange = (_chatModeId: ChatModeId) => {
    handleModeSelectorHide();
    setChatModeId(_chatModeId);
  };

  const handleStopClicked = () => props.conversationId && stopTyping(props.conversationId);


  // Mic typing & continuation mode

  const onSpeechResultCallback = React.useCallback((result: SpeechResult) => {
    setSpeechInterimResult(result.done ? null : { ...result });
    if (result.done) {
      // append the transcript
      const transcript = result.transcript.trim();
      let newText = (composeText || '').trim();
      newText = newText ? newText + ' ' + transcript : transcript;

      // auto-send if requested
      const autoSend = micContinuation && newText.length >= 1 && !!props.conversationId; //&& assistantTyping;
      if (autoSend) {
        props.onNewMessage(chatModeId, props.conversationId!, newText);
        if (result.doneReason !== 'manual')
          playSoundUrl('/sounds/mic-off-mid.mp3');
      } else {
        if (newText)
          props.composerTextAreaRef.current?.focus();
        if (!micContinuation && result.doneReason !== 'manual')
          playSoundUrl('/sounds/mic-off-mid.mp3');
      }

      // set the text (or clear if auto-sent)
      setComposeText(autoSend ? '' : newText);
    }
  }, [chatModeId, composeText, micContinuation, props, setComposeText]);

  const { isSpeechEnabled, isSpeechError, isRecordingAudio, isRecordingSpeech, toggleRecording } =
    useSpeechRecognition(onSpeechResultCallback, 2000, 'm');

  const micIsRunning = !!speechInterimResult;
  const micContinuationTrigger = micContinuation && !micIsRunning && !assistantTyping;
  const micColor: ColorPaletteProp = isSpeechError ? 'danger' : isRecordingSpeech ? 'primary' : isRecordingAudio ? 'neutral' : 'neutral';
  const micVariant: VariantProp = isRecordingSpeech ? 'solid' : isRecordingAudio ? 'outlined' : 'plain';

  const handleToggleMic = () => {
    if (micIsRunning && micContinuation)
      setMicContinuation(false);
    toggleRecording();
  };

  const handleToggleMicContinuation = () => setMicContinuation(continued => !continued);

  React.useEffect(() => {
    // autostart the microphone if the assistant stopped typing
    if (micContinuationTrigger)
      toggleRecording();
  }, [toggleRecording, micContinuationTrigger]);


  // Attachments: Files

  const handleAttachWebpage = React.useCallback(async (url: string, fileName: string) => {
    setIsDownloading(true);
    let urlContent: string | null;
    try {
      urlContent = await callBrowseFetchPage(url);
    } catch (error: any) {
      // ignore errors
      urlContent = `[Web Download] Issue loading website: ${error?.message || typeof error === 'string' ? error : JSON.stringify(error)}`;
    }
    setIsDownloading(false);
    if (urlContent) {
      setComposeText(expandPromptTemplate(PromptTemplates.PasteFile, { fileName, fileText: urlContent }));
      return true;
    }
    return false;
  }, [setComposeText]);

  const handleAttachFiles = async (files: FileList, overrideFileNames?: string[]): Promise<void> => {

    // NOTE: we tried to get the common 'root prefix' of the files here, so that we could attach files with a name that's relative
    //       to the common root, but the files[].webkitRelativePath property is not providing that information

    // perform loading and expansion
    let newText = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = overrideFileNames?.length === files.length ? overrideFileNames[i] : file.name;
      let fileText = '';
      try {
        if (file.type === 'application/pdf')
          fileText = await pdfToText(file);
        else
          fileText = await file.text();
        newText = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: fileName, fileText })(newText);
      } catch (error: any) {
        // show errors in the prompt box itself - FUTURE: show in a toast
        console.error(error);
        newText = `${newText}\n\nError loading file ${fileName}: ${JSON.stringify(error)}\n`;
      }
    }

    // see how we fare on budget
    if (chatLLMId) {
      const newTextTokens = countModelTokens(newText, chatLLMId, 'reducer trigger');

      // simple trigger for the reduction dialog
      if (newTextTokens > remainingTokens) {
        setReducerTextTokens(newTextTokens);
        setReducerText(newText);
        return;
      }
    }

    // within the budget, so just append
    setComposeText(text => expandPromptTemplate(PromptTemplates.Concatenate, { text: newText })(text));
  };

  const handleTextareaCtrlV = async (event: React.ClipboardEvent) => {

    // if 'pasting' a file, attach it
    if (event.clipboardData.files?.length) {
      event.preventDefault();
      await handleAttachFiles(event.clipboardData.files, []);
      return;
    }

    // if the clipboard contains a single url, download and attach it
    if (event.clipboardData.types.includes('text/plain')) {
      const textString = event.clipboardData.getData('text/plain');
      const textIsUrl = asValidURL(textString);
      if (browsingInComposer) {
        if (!isDownloading && textIsUrl && !composeText.startsWith(CmdRunReact[0])) {
          // if we wanted to stop the paste of the URL itself, we can call e.preventDefault() here (before the await)
          // e.preventDefault();
          await handleAttachWebpage(textIsUrl, textString);
        }
      }
    }

    // paste not intercepted, continue with default behavior
  };


  // Attachments: Text

  const handleReducerClose = () => setReducerText('');

  const handleReducedText = (text: string) => {
    handleReducerClose();
    setComposeText(_t => _t + text);
  };

  const handleCameraOCRText = (text: string) => {
    text && setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: text }));
  };

  const handlePasteFromClipboard = React.useCallback(async () => {
    for (const clipboardItem of await getClipboardItems()) {

      // when pasting html, only process tables as markdown (e.g. from Excel), or fallback to text
      try {
        const htmlItem = await clipboardItem.getType('text/html');
        const htmlString = await htmlItem.text();
        // paste tables as markdown
        if (htmlString.startsWith('<table')) {
          const markdownString = htmlTableToMarkdown(htmlString);
          setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: markdownString }));
          continue;
        }
        // TODO: paste html to markdown (tried Turndown, but the gfm plugin is not good - need to find another lib with minimal footprint)
      } catch (error) {
        // ignore missing html: fallback to text/plain
      }

      // find the text/plain item if any
      try {
        const textItem = await clipboardItem.getType('text/plain');
        const textString = await textItem.text();
        const textIsUrl = asValidURL(textString);
        if (browsingInComposer) {
          if (textIsUrl && await handleAttachWebpage(textIsUrl, textString))
            continue;
        }
        setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: textString }));
        continue;
      } catch (error) {
        // ignore missing text
      }

      // no text/html or text/plain item found
      console.log('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [browsingInComposer, handleAttachWebpage, setComposeText]);

  useGlobalShortcut(supportsClipboardRead ? 'v' : false, true, true, false, handlePasteFromClipboard);


  // Drag & Drop

  const eatDragEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTextareaDragEnter = (e: React.DragEvent) => {
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
    if (e.dataTransfer.files?.length >= 1) {
      // Workaround: as we don't have the full path in the File object, we need to get it from the text/plain data
      let overrideFileNames: string[] = [];
      if (e.dataTransfer.types?.includes('text/plain')) {
        const plainText = e.dataTransfer.getData('text/plain');
        overrideFileNames = extractFilePathsWithCommonRadix(plainText);
      }
      return handleAttachFiles(e.dataTransfer.files, overrideFileNames);
    }

    // special case: detect failure of dropping from VSCode
    // VSCode: Drag & Drop does not transfer the File object: https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    if (e.dataTransfer.types?.includes('codeeditors'))
      return setComposeText(test => test + 'Pasting from VSCode is not supported! Fixme. Anyone?');

    // dropped text
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText?.length >= 1)
      return setComposeText(text => expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: droppedText })(text));

    // future info for dropping
    console.log('Unhandled Drop event. Contents: ', e.dataTransfer.types.map(t => `${t}: ${e.dataTransfer.getData(t)}`));
  };


  const isImmediate = chatModeId === 'immediate';
  const isWriteUser = chatModeId === 'write-user';
  const isChat = isImmediate || isWriteUser;
  const isReAct = chatModeId === 'react';
  const isDraw = chatModeId === 'draw-imagine';
  const isDrawPlus = chatModeId === 'draw-imagine-plus';

  const textPlaceholder: string =
    isDrawPlus
      ? 'Write a subject, and we\'ll add detail...'
      : isDraw
        ? 'Describe an idea or a drawing...'
        : isReAct
          ? 'Multi-step reasoning question...'
          : props.isDeveloperMode
            ? 'Chat with me · drop source files · attach code...'
            : /*isProdiaConfigured ?*/ 'Chat · /react · /imagine · drop text files...' /*: 'Chat · /react · drop text files...'*/;


  return (
    <Box sx={props.sx}>
      <Grid container spacing={{ xs: 1, md: 2 }}>

        {/* Button column and composer Text (mobile: top, desktop: left and center) */}
        <Grid xs={12} md={9}><Stack direction='row' spacing={{ xs: 1, md: 2 }}>

          {/* Vertical buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0, md: 2 } }}>

            {/* [mobile] Mic button */}
            {isMobile && isSpeechEnabled && <MicButton variant={micVariant} color={micColor} onClick={handleToggleMic} />}

            {/* Responsive Camera OCR button */}
            <ButtonCameraCapture isMobile={isMobile} onOCR={handleCameraOCRText} />

            {/* Responsive Attach button */}
            <ButtonFileAttach isMobile={isMobile} onAttachFiles={handleAttachFiles} />

            {/* Responsive Paste button */}
            {supportsClipboardRead && <ButtonClipboardPaste isMobile={isMobile} isDeveloperMode={props.isDeveloperMode} onPaste={handlePasteFromClipboard} />}

          </Box>

          {/* Edit box, with Drop overlay */}
          <Box sx={{ flexGrow: 1, position: 'relative' }}>

            <Box sx={{ position: 'relative' }}>

              <Textarea
                variant='outlined' color={(isDraw || isDrawPlus) ? 'warning' : isReAct ? 'success' : 'neutral'}
                autoFocus
                minRows={5} maxRows={10}
                placeholder={textPlaceholder}
                value={composeText}
                onChange={(event) => setComposeText(event.target.value)}
                onDragEnter={handleTextareaDragEnter}
                onKeyDown={handleTextareaKeyDown}
                onPasteCapture={handleTextareaCtrlV}
                slotProps={{
                  textarea: {
                    enterKeyHint: enterIsNewline ? 'enter' : 'send',
                    sx: {
                      ...(isSpeechEnabled && { pr: { md: 5 } }),
                      mb: 0.5,
                    },
                    ref: props.composerTextAreaRef,
                  },
                }}
                sx={{
                  backgroundColor: 'background.level1',
                  '&:focus-within': {
                    backgroundColor: 'background.popup',
                  },
                  // fontSize: '16px',
                  lineHeight: 1.75,
                }} />

              {tokenLimit > 0 && (directTokens > 0 || (historyTokens + responseTokens) > 0) && <TokenProgressbar history={historyTokens} response={responseTokens} direct={directTokens} limit={tokenLimit} />}

            </Box>

            {isSpeechEnabled && (
              <Box sx={{
                position: 'absolute', top: 0, right: 0,
                zIndex: 21,
                m: 1,
                display: 'flex', flexDirection: 'column', gap: 1,
              }}>
                {isDesktop && <MicButton variant={micVariant} color={micColor} onClick={handleToggleMic} />}

                {micIsRunning && (
                  <MicContinuationButton
                    variant={micContinuation ? 'plain' : 'plain'} color={micContinuation ? 'primary' : 'neutral'}
                    onClick={handleToggleMicContinuation}
                  />
                )}
              </Box>
            )}

            {!!tokenLimit && (
              <TokenBadge
                directTokens={directTokens} indirectTokens={historyTokens + responseTokens} tokenLimit={tokenLimit}
                showExcess absoluteBottomRight
              />
            )}

            {micIsRunning && (
              <Card
                color='primary' invertedColors variant='soft'
                sx={{
                  display: 'flex',
                  position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                  // alignItems: 'center', justifyContent: 'center',
                  border: `1px solid`,
                  borderColor: 'primary.solidBg',
                  borderRadius: 'sm',
                  zIndex: 20,
                  px: 1.5, py: 1,
                }}>
                <Typography>
                  {speechInterimResult.transcript}{' '}
                  <span style={{ opacity: 0.8 }}>{speechInterimResult.interimTranscript}</span>
                </Typography>
              </Card>
            )}

            <Card
              color='primary' invertedColors variant='soft'
              sx={{
                display: isDragging ? 'flex' : 'none',
                position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                alignItems: 'center', justifyContent: 'space-evenly',
                border: '2px dashed',
                borderRadius: 'xs',
                zIndex: 10,
              }}
              onDragLeave={handleOverlayDragLeave}
              onDragOver={handleOverlayDragOver}
              onDrop={handleOverlayDrop}>
              <PanToolIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
              <Typography level='body-sm' sx={{ pointerEvents: 'none' }}>
                I will hold on to this for you
              </Typography>
            </Card>

            {isDownloading && <Card
              color='success' invertedColors variant='soft'
              sx={{
                display: 'flex',
                position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                alignItems: 'center', justifyContent: 'center',
                border: '1px solid',
                borderColor: 'success.solidBg',
                borderRadius: 'xs',
                zIndex: 20,
              }}>
              <CircularProgress />
              <Typography level='title-md' sx={{ mt: 1 }}>
                Loading & Attaching Website
              </Typography>
              <Typography level='body-xs'>
                This will take up to 15 seconds
              </Typography>
            </Card>}

          </Box>

        </Stack></Grid>

        {/* Send pane (mobile: bottom, desktop: right) */}
        <Grid xs={12} md={3}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>

            {/* first row of buttons */}
            <Box sx={{ display: 'flex' }}>

              {/* [mobile] bottom-corner secondary button */}
              {isMobile && (isChat
                  ? <CallButtonMobile disabled={!labsCalling || !props.conversationId || !chatLLM} onClick={handleCallClicked} sx={{ mr: { xs: 1, md: 2 } }} />
                  : (isDraw || isDrawPlus)
                    ? <DrawOptionsButtonMobile onClick={handleDrawOptionsClicked} sx={{ mr: { xs: 1, md: 2 } }} />
                    : <IconButton disabled variant='plain' color='neutral' sx={{ mr: { xs: 1, md: 2 } }} />
              )}

              {/* Responsive Send/Stop buttons */}
              {assistantTyping
                ? (
                  <Button
                    fullWidth variant='soft' color={isReAct ? 'success' : 'primary'} disabled={!props.conversationId}
                    onClick={handleStopClicked}
                    endDecorator={<StopOutlinedIcon />}
                  >
                    Stop
                  </Button>
                ) : (
                  <ButtonGroup variant={isWriteUser ? 'solid' : 'solid'} color={isReAct ? 'success' : (isDraw || isDrawPlus) ? 'warning' : 'primary'} sx={{ flexGrow: 1 }}>
                    <Button
                      fullWidth variant={isWriteUser ? 'soft' : 'solid'} color={isReAct ? 'success' : (isDraw || isDrawPlus) ? 'warning' : 'primary'} disabled={!props.conversationId || !chatLLM}
                      onClick={() => handleSendClicked(chatModeId)}
                      endDecorator={micContinuation ? <AutoModeIcon /> : isWriteUser ? <SendIcon sx={{ fontSize: 18 }} /> : isReAct ? <PsychologyIcon /> : <TelegramIcon />}
                    >
                      {micContinuation && 'Voice '}
                      {isWriteUser ? 'Write' : isReAct ? 'ReAct' : isDraw ? 'Draw' : isDrawPlus ? 'Draw+' : 'Chat'}
                    </Button>
                    <IconButton disabled={!props.conversationId || !chatLLM || !!chatModeMenuAnchor} onClick={handleModeSelectorShow}>
                      <ExpandLessIcon />
                    </IconButton>
                  </ButtonGroup>
                )}
            </Box>


            {/* [desktop] secondary buttons (aligned to bottom for now, and mutually exclusive) */}
            {isDesktop && <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'flex-end' }}>

              {/* [desktop] Call secondary button */}
              {isChat && <CallButtonDesktop disabled={!labsCalling || !props.conversationId || !chatLLM} onClick={handleCallClicked} />}

              {/* [desktop] Draw Options secondary button */}
              {(isDraw || isDrawPlus) && <DrawOptionsButtonDesktop onClick={handleDrawOptionsClicked} />}

            </Box>}

          </Box>
        </Grid>


        {/* Mode selector */}
        {!!chatModeMenuAnchor && (
          <ChatModeMenu
            anchorEl={chatModeMenuAnchor} onClose={handleModeSelectorHide}
            chatModeId={chatModeId} onSetChatModeId={handleModeChange}
          />
        )}

        {/* Content reducer modal */}
        {reducerText?.length >= 1 &&
          <ContentReducer
            initialText={reducerText} initialTokens={reducerTextTokens} tokenLimit={remainingTokens}
            onReducedText={handleReducedText} onClose={handleReducerClose}
          />
        }

      </Grid>
    </Box>
  );
}