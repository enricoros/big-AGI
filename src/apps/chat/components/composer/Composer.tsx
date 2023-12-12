import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import { keyframes } from '@emotion/react';

import { Box, Button, ButtonGroup, Card, Grid, IconButton, Stack, Textarea, Typography } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import type { ChatModeId } from '../../AppChat';
import { useChatMicTimeoutMsValue } from '../../store-app-chat';

import type { DLLM } from '~/modules/llms/store-llms';
import type { LLMOptionsOpenAI } from '~/modules/llms/vendors/openai/openai.vendor';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
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

import type { AttachmentId } from './attachments/store-attachments';
import { Attachments } from './attachments/Attachments';
import { getTextBlockText, useLLMAttachments } from './attachments/useLLMAttachments';
import { useAttachments } from './attachments/useAttachments';

import type { ComposerOutputMultiPart } from './composer.types';
import { ButtonAttachCameraMemo } from './ButtonAttachCamera';
import { ButtonAttachClipboardMemo } from './ButtonAttachClipboard';
import { ButtonAttachFileMemo } from './ButtonAttachFile';
import { ButtonCall } from './ButtonCall';
import { ButtonMicContinuationMemo } from './ButtonMicContinuation';
import { ButtonMicMemo } from './ButtonMic';
import { ButtonOptionsDraw } from './ButtonOptionsDraw';
import { ChatModeMenu } from './ChatModeMenu';
import { TokenBadgeMemo } from './TokenBadge';
import { TokenProgressbarMemo } from './TokenProgressbar';
import { useComposerStartupText } from './store-composer';


const animationStopEnter = keyframes`
    from {
        opacity: 0;
        transform: translateY(8px)
    }
    to {
        opacity: 1;
        transform: translateY(0)
    }
`;


/**
 * A React component for composing messages, with attachments and different modes.
 */
export function Composer(props: {
  chatLLM: DLLM | null;
  composerTextAreaRef: React.RefObject<HTMLTextAreaElement>;
  conversationId: DConversationId | null;
  isDeveloperMode: boolean;
  onAction: (chatModeId: ChatModeId, conversationId: DConversationId, multiPartMessage: ComposerOutputMultiPart) => boolean;
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
  const { assistantTyping, systemPurposeId, tokenCount: _historyTokenCount, stopTyping } = useChatStore(state => {
    const conversation = state.conversations.find(_c => _c.id === props.conversationId);
    return {
      assistantTyping: conversation ? !!conversation.abortController : false,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      tokenCount: conversation ? conversation.tokenCount : 0,
      stopTyping: state.stopTyping,
    };
  }, shallow);
  const { inComposer: browsingInComposer } = useBrowseCapability();
  const { attachAppendClipboardItems, attachAppendDataTransfer, attachAppendFile, attachments: _attachments, clearAttachments, removeAttachment } =
    useAttachments(browsingInComposer && !composeText.startsWith('/'));

  // derived state

  const isDesktop = !isMobile;
  const chatLLMId = props.chatLLM?.id || null;

  // attachments derived state

  const llmAttachments = useLLMAttachments(_attachments, chatLLMId);

  // tokens derived state

  const tokensComposerText = React.useMemo(() => {
    if (!debouncedText || !chatLLMId)
      return 0;
    return countModelTokens(debouncedText, chatLLMId, 'composer text');
  }, [chatLLMId, debouncedText]);
  let tokensComposer = tokensComposerText + llmAttachments.tokenCountApprox;
  if (tokensComposer > 0)
    tokensComposer += 4; // every user message has this many surrounding tokens (note: shall depend on llm..)
  const tokensHistory = _historyTokenCount;
  const tokensReponseMax = (props.chatLLM?.options as LLMOptionsOpenAI /* FIXME: BIG ASSUMPTION */)?.llmResponseTokens || 0;
  const tokenLimit = props.chatLLM?.contextTokens || 0;


  // Effect: load initial text if queued up (e.g. by /link/share_targe)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [setComposeText, setStartupText, startupText]);


  // Primary button

  const { conversationId, onAction } = props;

  const handleSendAction = React.useCallback((_chatModeId: ChatModeId, composerText: string): boolean => {
    if (!conversationId)
      return false;

    // get attachments
    const multiPartMessage = llmAttachments.getAttachmentsOutputs(composerText || null);
    if (!multiPartMessage.length)
      return false;

    // send the message
    const enqueued = onAction(_chatModeId, conversationId, multiPartMessage);
    if (enqueued) {
      clearAttachments();
      setComposeText('');
    }

    return enqueued;
  }, [clearAttachments, conversationId, llmAttachments, onAction, setComposeText]);

  const handleTextareaKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {

      // Alt: append the message instead
      if (e.altKey) {
        handleSendAction('write-user', composeText);
        return e.preventDefault();
      }

      // Shift: toggles the 'enter is newline'
      if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
        if (!assistantTyping)
          handleSendAction(chatModeId, composeText);
        return e.preventDefault();
      }
    }
  }, [assistantTyping, chatModeId, composeText, enterIsNewline, handleSendAction]);

  const handleSendClicked = () => handleSendAction(chatModeId, composeText);

  const handleStopClicked = () => props.conversationId && stopTyping(props.conversationId);


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


  // Mic typing & continuation mode

  const onSpeechResultCallback = React.useCallback((result: SpeechResult) => {
    // not done: show interim
    if (!result.done) {
      setSpeechInterimResult({ ...result });
      return;
    }

    // done
    setSpeechInterimResult(null);
    const transcript = result.transcript.trim();
    let nextText = (composeText || '').trim();
    nextText = nextText ? nextText + ' ' + transcript : transcript;

    // auto-send (mic continuation mode) if requested
    const autoSend = micContinuation && nextText.length >= 1 && !!props.conversationId; //&& assistantTyping;
    const notUserStop = result.doneReason !== 'manual';
    if (autoSend) {
      if (notUserStop)
        playSoundUrl('/sounds/mic-off-mid.mp3');
      handleSendAction(chatModeId, nextText);
    } else {
      if (!micContinuation && notUserStop)
        playSoundUrl('/sounds/mic-off-mid.mp3');
      if (nextText) {
        props.composerTextAreaRef.current?.focus();
        setComposeText(nextText);
      }
    }
  }, [chatModeId, composeText, handleSendAction, micContinuation, props.composerTextAreaRef, props.conversationId, setComposeText]);

  const { isSpeechEnabled, isSpeechError, isRecordingAudio, isRecordingSpeech, toggleRecording } =
    useSpeechRecognition(onSpeechResultCallback, chatMicTimeoutMs || 2000);

  useGlobalShortcut('m', true, false, false, toggleRecording);

  const micIsRunning = !!speechInterimResult;
  const micContinuationTrigger = micContinuation && !micIsRunning && !assistantTyping;
  const micColor: ColorPaletteProp = isSpeechError ? 'danger' : isRecordingSpeech ? 'primary' : isRecordingAudio ? 'primary' : 'neutral';
  const micVariant: VariantProp = isRecordingSpeech ? 'solid' : isRecordingAudio ? 'soft' : 'soft';  //(isDesktop ? 'soft' : 'plain');

  const handleToggleMic = React.useCallback(() => {
    if (micIsRunning && micContinuation)
      setMicContinuation(false);
    toggleRecording();
  }, [micContinuation, micIsRunning, toggleRecording]);

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

  const handleAttachmentInlineText = React.useCallback((attachmentId: AttachmentId) => {
    setComposeText(currentText => {
      const attachmentOutputs = llmAttachments.getAttachmentOutputs(currentText, attachmentId);
      const inlinedText = getTextBlockText(attachmentOutputs) || '';
      removeAttachment(attachmentId);
      return inlinedText;
    });
  }, [llmAttachments, removeAttachment, setComposeText]);

  const handleAttachmentsInlineText = React.useCallback(() => {
    setComposeText(currentText => {
      const attachmentsOutputs = llmAttachments.getAttachmentsOutputs(currentText);
      const inlinedText = getTextBlockText(attachmentsOutputs) || '';
      clearAttachments();
      return inlinedText;
    });
  }, [clearAttachments, llmAttachments, setComposeText]);


  // Drag & Drop

  const eatDragEvent = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleTextareaDragEnter = React.useCallback((e: React.DragEvent) => {
    const isFromSelf = e.dataTransfer.types.includes('x-app/agi');
    if (!isFromSelf) {
      eatDragEvent(e);
      setIsDragging(true);
    }
  }, [eatDragEvent]);

  const handleTextareaDragStart = React.useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('x-app/agi', 'do-not-intercept');
  }, []);

  const handleOverlayDragLeave = React.useCallback((e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);
  }, [eatDragEvent]);

  const handleOverlayDragOver = React.useCallback((e: React.DragEvent) => {
    eatDragEvent(e);
    // this makes sure we don't "transfer" (or move) the attachment, but we tell the sender we'll copy it
    e.dataTransfer.dropEffect = 'copy';
  }, [eatDragEvent]);

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
  }, [attachAppendDataTransfer, eatDragEvent, setComposeText]);


  const isImmediate = chatModeId === 'immediate';
  const isWriteUser = chatModeId === 'write-user';
  const isChat = isImmediate || isWriteUser;
  const isReAct = chatModeId === 'react';
  const isDraw = chatModeId === 'draw-imagine';
  const isDrawPlus = chatModeId === 'draw-imagine-plus';
  const buttonColor: ColorPaletteProp = isReAct ? 'success' : (isDraw || isDrawPlus) ? 'warning' : 'primary';

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
              {isSpeechEnabled && <ButtonMicMemo variant={micVariant} color={micColor} onClick={handleToggleMic} />}

              {/* Responsive Camera OCR button */}
              <ButtonAttachCameraMemo isMobile onAttachImage={handleAttachCameraImage} />

              {/* Responsive Open Files button */}
              <ButtonAttachFileMemo isMobile onAttachFilePicker={handleAttachFilePicker} />

              {/* Responsive Paste button */}
              {supportsClipboardRead && <ButtonAttachClipboardMemo isMobile onClick={attachAppendClipboardItems} />}

            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { md: 2 } }}>

              {/*<FormHelperText sx={{ mx: 'auto' }}>*/}
              {/*  Attach*/}
              {/*</FormHelperText>*/}

              {/* Responsive Open Files button */}
              <ButtonAttachFileMemo onAttachFilePicker={handleAttachFilePicker} />

              {/* Responsive Paste button */}
              {supportsClipboardRead && <ButtonAttachClipboardMemo onClick={attachAppendClipboardItems} />}

              {/* Responsive Camera OCR button */}
              {labsCameraDesktop && <ButtonAttachCameraMemo onAttachImage={handleAttachCameraImage} />}

            </Box>
          )}

          {/* Vertically stacked [ Edit box + Overlays + Mic | Attachments ] */}
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
                        // mb: 0.5, // no need; the outer container already has enough p (for TokenProgressbar)
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

                {tokenLimit > 0 && (tokensComposer > 0 || (tokensHistory + tokensReponseMax) > 0) && (
                  <TokenProgressbarMemo direct={tokensComposer} history={tokensHistory} responseMax={tokensReponseMax} limit={tokenLimit} />
                )}

                {!!tokenLimit && (
                  <TokenBadgeMemo direct={tokensComposer} history={tokensHistory} responseMax={tokensReponseMax} limit={tokenLimit} showExcess absoluteBottomRight />
                )}

              </Box>

              {/* Mic & Mic Continuation Buttons */}
              {isSpeechEnabled && (
                <Box sx={{
                  position: 'absolute', top: 0, right: 0,
                  zIndex: 21,
                  mt: isDesktop ? 1 : 0.25,
                  mr: isDesktop ? 1 : 0.25,
                  display: 'flex', flexDirection: 'column', gap: isDesktop ? 1 : 0.25,
                }}>
                  {isDesktop && <ButtonMicMemo variant={micVariant} color={micColor} onClick={handleToggleMic} noBackground={!isRecordingSpeech} />}

                  {micIsRunning && (
                    <ButtonMicContinuationMemo
                      variant={micContinuation ? 'solid' : 'soft'} color={micContinuation ? 'primary' : 'neutral'} sx={{ background: micContinuation ? undefined : 'none' }}
                      onClick={handleToggleMicContinuation}
                    />
                  )}
                </Box>
              )}

              {/* overlay: Mic */}
              {micIsRunning && (
                <Card
                  color='primary' variant='soft' invertedColors
                  sx={{
                    display: 'flex',
                    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                    // alignItems: 'center', justifyContent: 'center',
                    border: '1px solid',
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
              {!isMobile && (
                <Card
                  color='success' variant='soft' invertedColors
                  sx={{
                    display: isDragging ? 'flex' : 'none',
                    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    border: '2px dashed',
                    borderRadius: 'xs',
                    boxShadow: 'none',
                    zIndex: 10,
                  }}
                  onDragLeave={handleOverlayDragLeave}
                  onDragOver={handleOverlayDragOver}
                  onDrop={handleOverlayDrop}
                >
                  {isDragging && <AttachFileIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />}
                  {isDragging && <Typography level='title-sm' sx={{ pointerEvents: 'none' }}>
                    I will hold on to this for you
                  </Typography>}
                </Card>
              )}

            </Box>

            {/* Render any Attachments & menu items */}
            <Attachments
              llmAttachments={llmAttachments}
              onAttachmentInlineText={handleAttachmentInlineText}
              onAttachmentsClear={clearAttachments}
              onAttachmentsInlineText={handleAttachmentsInlineText}
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
                  ? <ButtonCall isMobile disabled={!labsCalling || !props.conversationId || !chatLLMId} onClick={handleCallClicked} sx={{ mr: { xs: 1, md: 2 } }} />
                  : (isDraw || isDrawPlus)
                    ? <ButtonOptionsDraw isMobile onClick={handleDrawOptionsClicked} sx={{ mr: { xs: 1, md: 2 } }} />
                    : <IconButton disabled variant='plain' color='neutral' sx={{ mr: { xs: 1, md: 2 } }} />
              )}

              {/* Responsive Send/Stop buttons */}
              <ButtonGroup
                variant={isWriteUser ? 'outlined' : 'solid'}
                color={buttonColor}
                sx={{
                  flexGrow: 1,
                  boxShadow: isMobile ? 'none' : `0 8px 24px -4px rgb(var(--joy-palette-${buttonColor}-mainChannel) / 20%)`,
                }}
              >
                {!assistantTyping ? (
                  <Button
                    key='composer-act'
                    fullWidth disabled={!props.conversationId || !chatLLMId || !llmAttachments.isOutputAttacheable}
                    onClick={handleSendClicked}
                    endDecorator={micContinuation ? <AutoModeIcon /> : isWriteUser ? <SendIcon sx={{ fontSize: 18 }} /> : isReAct ? <PsychologyIcon /> : <TelegramIcon />}
                  >
                    {micContinuation && 'Voice '}
                    {isWriteUser ? 'Write' : isReAct ? 'ReAct' : isDraw ? 'Draw' : isDrawPlus ? 'Draw+' : 'Chat'}
                  </Button>
                ) : (
                  <Button
                    key='composer-stop'
                    fullWidth variant='soft' color={isReAct ? 'success' : 'primary'} disabled={!props.conversationId}
                    onClick={handleStopClicked}
                    endDecorator={<StopOutlinedIcon sx={{ fontSize: 18 }} />}
                    sx={{ animation: `${animationStopEnter} 0.1s ease-out` }}
                  >
                    Stop
                  </Button>
                )}
                <IconButton disabled={!props.conversationId || !chatLLMId || !!chatModeMenuAnchor} onClick={handleModeSelectorShow}>
                  <ExpandLessIcon />
                </IconButton>
              </ButtonGroup>

            </Box>


            {/* [desktop] secondary buttons (aligned to bottom for now, and mutually exclusive) */}
            {isDesktop && <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'flex-end' }}>

              {/* [desktop] Call secondary button */}
              {isChat && <ButtonCall disabled={!labsCalling || !props.conversationId || !chatLLMId} onClick={handleCallClicked} />}

              {/* [desktop] Draw Options secondary button */}
              {(isDraw || isDrawPlus) && <ButtonOptionsDraw onClick={handleDrawOptionsClicked} />}

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