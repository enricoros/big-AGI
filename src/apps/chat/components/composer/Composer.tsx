import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { fileOpen, FileWithHandle } from 'browser-fs-access';

import { Box, Button, ButtonGroup, Card, Grid, IconButton, Stack, Textarea, Tooltip, Typography } from '@mui/joy';
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
import { useChatMicTimeoutMsValue } from '../../store-app-chat';

import type { LLMOptionsOpenAI } from '~/modules/llms/vendors/openai/openai.vendor';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';
import { useChatLLM } from '~/modules/llms/store-llms';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { KeyStroke } from '~/common/components/KeyStroke';
import { SpeechResult, useSpeechRecognition } from '~/common/components/useSpeechRecognition';
import { countModelTokens } from '~/common/util/token-counter';
import { launchAppCall } from '~/common/app.routes';
import { openLayoutPreferences } from '~/common/layout/store-applayout';
import { playSoundUrl } from '~/common/util/audioUtils';
import { supportsClipboardRead } from '~/common/util/clipboardUtils';
import { useDebouncer } from '~/common/components/useDebouncer';
import { useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { Attachments } from './attachments/Attachments';
import { ButtonCameraCapture } from './ButtonCameraCapture';
import { ButtonClipboardPaste } from './ButtonClipboardPaste';
import { ButtonFileAttach } from './ButtonFileAttach';
import { ChatModeMenu } from './ChatModeMenu';
import { TokenBadge } from './TokenBadge';
import { TokenProgressbar } from './TokenProgressbar';
import { useAttachments } from './attachments/useAttachments';
import { useComposerStartupText } from './store-composer';


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
  const [isDragging, setIsDragging] = React.useState(false);
  const [chatModeMenuAnchor, setChatModeMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // external state
  const isMobile = useIsMobile();
  const { labsCalling, labsCameraDesktop } = useUXLabsStore(state => ({
    labsCalling: state.labsCalling,
    labsCameraDesktop: state.labsCameraDesktop,
  }), shallow);
  const [chatModeId, setChatModeId] = React.useState<ChatModeId>('immediate');
  const [startupText, setStartupText] = useComposerStartupText();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);
  const chatMicTimeoutMs = useChatMicTimeoutMsValue();
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
  const {
    attachAppendClipboardItems,
    attachAppendDataTransfer,
    attachAppendFile,
    attachments,
    attachmentsReady,
    clearAttachments,
  } = useAttachments(browsingInComposer && !composeText.startsWith('/'));

  // derived state
  const isDesktop = !isMobile;
  const tokenLimit = chatLLM?.contextTokens || 0;
  const directTokens = React.useMemo(() => {
    return (!debouncedText || !chatLLMId) ? 4 : 4 + countModelTokens(debouncedText, chatLLMId, 'composer text');
  }, [chatLLMId, debouncedText]);
  const historyTokens = conversationTokenCount;
  const responseTokens = (chatLLM?.options as LLMOptionsOpenAI /* FIXME: BIG ASSUMPTION */)?.llmResponseTokens || 0;
  // const remainingTokens = tokenLimit - directTokens - historyTokens - responseTokens;


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
    useSpeechRecognition(onSpeechResultCallback, chatMicTimeoutMs || 2000, 'm');

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


  // Attachments

  const handleAttachCtrlV = React.useCallback((event: React.ClipboardEvent) => {
    if (attachAppendDataTransfer(event.clipboardData, 'paste', false) === 'as_files')
      event.preventDefault();
  }, [attachAppendDataTransfer]);

  const handleAttachCameraImage = React.useCallback((file: FileWithHandle) => {
    void attachAppendFile('camera', file);
  }, [attachAppendFile]);

  const handleAttachFilePicker = React.useCallback(async () => {
    try {
      const selectedFiles: FileWithHandle[] = await fileOpen({ multiple: true });
      selectedFiles.forEach(file =>
        void attachAppendFile('file-open', file),
      );
    } catch (error) {
      // ignore...
    }
  }, [attachAppendFile]);

  useGlobalShortcut(supportsClipboardRead ? 'v' : false, true, true, false, attachAppendClipboardItems);


  // Drag & Drop

  const eatDragEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTextareaDragEnter = (e: React.DragEvent) => {
    const isFromSelf = e.dataTransfer.types.includes('x-app/agi');
    if (!isFromSelf) {
      eatDragEvent(e);
      setIsDragging(true);
    }
  };

  const handleTextareaDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('x-app/agi', 'do-not-intercept');
  };

  const handleOverlayDragLeave = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);
  };

  const handleOverlayDragOver = (e: React.DragEvent) => {
    eatDragEvent(e);
    // e.dataTransfer.dropEffect = 'copy';
  };

  const handleOverlayDrop = React.useCallback(async (event: React.DragEvent) => {
    eatDragEvent(event);
    setIsDragging(false);

    // VSCode: detect failure of dropping from VSCode, details below:
    //         https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    const { dataTransfer } = event;
    if (dataTransfer.types.includes('codeeditors'))
      return setComposeText(test => test + 'Dragging files from VSCode is not supported! Fixme: anyone?');

    // textarea drop
    attachAppendDataTransfer(dataTransfer, 'drop', true);
  }, [attachAppendDataTransfer, setComposeText]);


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

          {/* Vertical (insert) buttons */}
          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { md: 2 } }}>

              {/* [mobile] Mic button */}
              {isSpeechEnabled && <MicButton variant={micVariant} color={micColor} onClick={handleToggleMic} />}

              {/* Responsive Camera OCR button */}
              <ButtonCameraCapture isMobile onAttachImage={handleAttachCameraImage} />

              {/* Responsive Open Files button */}
              <ButtonFileAttach isMobile onAttachFilePicker={handleAttachFilePicker} />

              {/* Responsive Paste button */}
              {supportsClipboardRead && <ButtonClipboardPaste isMobile onPaste={attachAppendClipboardItems} />}

            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { md: 2 } }}>

              {/*<FormHelperText sx={{ mx: 'auto' }}>*/}
              {/*  Attach*/}
              {/*</FormHelperText>*/}

              {/* Responsive Open Files button */}
              <ButtonFileAttach onAttachFilePicker={handleAttachFilePicker} />

              {/* Responsive Paste button */}
              {supportsClipboardRead && <ButtonClipboardPaste onPaste={attachAppendClipboardItems} />}

              {/* Responsive Camera OCR button */}
              {labsCameraDesktop && <ButtonCameraCapture onAttachImage={handleAttachCameraImage} />}

            </Box>
          )}

          {/* Vertical stacked Edit box and Attachments */}
          <Box sx={{
            flexGrow: 1,
            display: 'flex', flexDirection: 'column', gap: 1,
            overflowX: 'clip',
          }}>

            {/* Edit box + Overlays + Mic buttons */}
            <Box sx={{ position: 'relative' }}>

              {/* Edit box with inner Token Progress bar */}
              <Box sx={{ position: 'relative' }}>

                <Textarea
                  variant='outlined' color={(isDraw || isDrawPlus) ? 'warning' : isReAct ? 'success' : 'neutral'}
                  autoFocus
                  minRows={5} maxRows={10}
                  placeholder={textPlaceholder}
                  value={composeText}
                  onChange={(event) => setComposeText(event.target.value)}
                  onDragEnter={handleTextareaDragEnter}
                  onDragStart={handleTextareaDragStart}
                  onKeyDown={handleTextareaKeyDown}
                  onPasteCapture={handleAttachCtrlV}
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

                {tokenLimit > 0 && (directTokens > 0 || (historyTokens + responseTokens) > 0) && (
                  <TokenProgressbar history={historyTokens} response={responseTokens} direct={directTokens} limit={tokenLimit} />
                )}

                {!!tokenLimit && (
                  <TokenBadge
                    directTokens={directTokens} indirectTokens={historyTokens + responseTokens} tokenLimit={tokenLimit}
                    showExcess absoluteBottomRight
                  />
                )}

              </Box>

              {/* Mic & Mic Continuation Buttons */}
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

              {/* overlay: Mic */}
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

              {/* overlay: Drag & Drop*/}
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

            </Box>

            {/* Render any Attachments & menu items */}
            <Attachments
              attachments={attachments}
              onAttachmentsClear={clearAttachments}
              onAttachmentsInline={() => console.warn('TODO: inline attachments')}
            />

          </Box>

        </Stack></Grid>

        {/* Send pane (mobile: bottom, desktop: right) */}
        <Grid xs={12} md={3}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>

            {/* Send/Stop (and mobile corner buttons) */}
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
                      fullWidth variant={isWriteUser ? 'soft' : 'solid'} color={isReAct ? 'success' : (isDraw || isDrawPlus) ? 'warning' : 'primary'} disabled={!props.conversationId || !chatLLM || !attachmentsReady}
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

      </Grid>
    </Box>
  );
}