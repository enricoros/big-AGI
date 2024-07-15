import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fileOpen, FileWithHandle } from 'browser-fs-access';

import { Box, Button, ButtonGroup, Card, Dropdown, Grid, IconButton, Menu, MenuButton, MenuItem, Textarea, Tooltip, Typography } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import { useChatMicTimeoutMsValue } from '../../store-app-chat';

import type { DLLM } from '~/modules/llms/store-llms';
import type { LLMOptionsOpenAI } from '~/modules/llms/vendors/openai/openai.vendor';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { DMessageMetadata, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { PreferencesTab, useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { SpeechResult, useSpeechRecognition } from '~/common/components/useSpeechRecognition';
import { animationEnterBelow } from '~/common/util/animUtils';
import { conversationTitle, DConversationId } from '~/common/stores/chat/chat.conversation';
import { copyToClipboard, supportsClipboardRead } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, duplicateDMessageFragments } from '~/common/stores/chat/chat.fragments';
import { estimateTextTokens, glueForMessageTokens, marshallWrapDocFragments } from '~/common/stores/chat/chat.tokens';
import { getConversation, isValidConversation, useChatStore } from '~/common/stores/chat/store-chats';
import { isMacUser } from '~/common/util/pwaUtils';
import { launchAppCall } from '~/common/app.routes';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useAppStateStore } from '~/common/state/store-appstate';
import { useChatOverlayStore } from '~/common/chats/store-chat-overlay';
import { useDebouncer } from '~/common/components/useDebouncer';
import { useGlobalShortcuts } from '~/common/components/useGlobalShortcuts';
import { useUICounter, useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import type { ActileItem } from './actile/ActileProvider';
import { providerCommands } from './actile/providerCommands';
import { providerStarredMessage, StarredMessageItem } from './actile/providerStarredMessage';
import { useActileManager } from './actile/useActileManager';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import { LLMAttachmentDraftsAction, LLMAttachmentsList } from './llmattachments/LLMAttachmentsList';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useLLMAttachmentDrafts } from './llmattachments/useLLMAttachmentDrafts';

import type { ChatExecuteMode } from '../../execute-mode/execute-mode.types';
import { chatExecuteModeCanAttach, useChatExecuteMode } from '../../execute-mode/useChatExecuteMode';

import { ButtonAttachCameraMemo, useCameraCaptureModal } from './buttons/ButtonAttachCamera';
import { ButtonAttachClipboardMemo } from './buttons/ButtonAttachClipboard';
import { ButtonAttachFileMemo } from './buttons/ButtonAttachFile';
import { ButtonAttachScreenCaptureMemo } from './buttons/ButtonAttachScreenCapture';
import { ButtonBeamMemo } from './buttons/ButtonBeam';
import { ButtonCallMemo } from './buttons/ButtonCall';
import { ButtonMicContinuationMemo } from './buttons/ButtonMicContinuation';
import { ButtonMicMemo } from './buttons/ButtonMic';
import { ButtonMultiChatMemo } from './buttons/ButtonMultiChat';
import { ButtonOptionsDraw } from './buttons/ButtonOptionsDraw';
import { ReplyToBubble } from '../message/ReplyToBubble';
import { TokenBadgeMemo } from './TokenBadge';
import { TokenProgressbarMemo } from './TokenProgressbar';
import { useComposerStartupText } from './store-composer';
import { useDragDrop } from './useComposerDragDrop';
import { useMediaSessionCallbacks } from '~/common/util/useMediaSessionCallbacks';


const zIndexComposerOverlayMic = 10;


/**
 * A React component for composing messages, with attachments and different modes.
 */
export function Composer(props: {
  isMobile?: boolean;
  chatLLM: DLLM | null;
  composerTextAreaRef: React.RefObject<HTMLTextAreaElement>;
  targetConversationId: DConversationId | null;
  capabilityHasT2I: boolean;
  isMulticast: boolean | null;
  isDeveloperMode: boolean;
  onAction: (conversationId: DConversationId, chatExecuteMode: ChatExecuteMode, fragments: (DMessageContentFragment | DMessageAttachmentFragment)[], metadata?: DMessageMetadata) => boolean;
  onTextImagine: (conversationId: DConversationId, text: string) => void;
  setIsMulticast: (on: boolean) => void;
  sx?: SxProps;
}) {

  // state
  const [composeText, debouncedText, setComposeText] = useDebouncer('', 300, 1200, true);
  const [micContinuation, setMicContinuation] = React.useState(false);
  const [speechInterimResult, setSpeechInterimResult] = React.useState<SpeechResult | null>(null);
  const {
    chatExecuteMode,
    chatExecuteModeSendColor, chatExecuteModeSendLabel,
    chatExecuteMenuComponent, chatExecuteMenuShown, showChatExecuteMenu,
  } = useChatExecuteMode(props.capabilityHasT2I, !!props.isMobile);

  // external state
  const { openPreferencesTab /*, setIsFocusedMode*/ } = useOptimaLayout();
  const { labsAttachScreenCapture, labsCameraDesktop, labsShowCost } = useUXLabsStore(useShallow(state => ({
    labsAttachScreenCapture: state.labsAttachScreenCapture,
    labsCameraDesktop: state.labsCameraDesktop,
    labsShowCost: state.labsShowCost,
  })));
  const timeToShowTips = useAppStateStore(state => state.usageCount > 2);
  const { novel: explainShiftEnter, touch: touchShiftEnter } = useUICounter('composer-shift-enter');
  const { novel: explainAltEnter, touch: touchAltEnter } = useUICounter('composer-alt-enter');
  const { novel: explainCtrlEnter, touch: touchCtrlEnter } = useUICounter('composer-ctrl-enter');
  const [startupText, setStartupText] = useComposerStartupText();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);
  const chatMicTimeoutMs = useChatMicTimeoutMsValue();
  const { assistantAbortible, systemPurposeId, tokenCount: _historyTokenCount, abortConversationTemp } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.targetConversationId);
    return {
      assistantAbortible: conversation ? !!conversation.abortController : false,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      tokenCount: conversation ? conversation.tokenCount : 0,
      abortConversationTemp: state.abortConversationTemp,
    };
  }));

  // external overlay state (extra conversationId-dependent state)
  const conversationOverlayStore = props.targetConversationId
    ? ConversationsManager.getHandler(props.targetConversationId)?.getOverlayStore() || null
    : null;

  // composer-overlay: for the reply-to state, comes from the conversation overlay
  const { replyToGenerateText } = useChatOverlayStore(conversationOverlayStore, useShallow(store => ({
    replyToGenerateText: (chatExecuteMode === 'generate-content' || chatExecuteMode === 'generate-text-v1') ? store.replyToText?.trim() || null : null,
  })));

  // don't load URLs if the user is typing a command or there's no capability
  const enableLoadURLsInComposer = useBrowseCapability().inComposer && !composeText.startsWith('/');

  // attachments-overlay: comes from the attachments slice of the conversation overlay
  const {
    /* items */ attachmentDrafts,
    /* append */ attachAppendClipboardItems, attachAppendDataTransfer, attachAppendEgoFragments, attachAppendFile,
    /* take */ attachmentsRemoveAll, attachmentsTakeAllFragments, attachmentsTakeFragmentsByType,
  } = useAttachmentDrafts(conversationOverlayStore, enableLoadURLsInComposer);

  // attachments derived state
  const llmAttachmentDrafts = useLLMAttachmentDrafts(attachmentDrafts, props.chatLLM);

  // drag/drop
  const { dragContainerSx, dragDropComponent, handleDragEnter, handleDragStart } = useDragDrop(!!props.isMobile, attachAppendDataTransfer);


  // derived state

  const { composerTextAreaRef, targetConversationId, onAction, onTextImagine } = props;
  const isMobile = !!props.isMobile;
  const isDesktop = !props.isMobile;
  const noConversation = !targetConversationId;
  const noLLM = !props.chatLLM;
  const showLLMAttachments = chatExecuteModeCanAttach(chatExecuteMode);


  // tokens derived state

  const tokensComposerTextDebounced = React.useMemo(() => {
    return (debouncedText && props.chatLLM)
      ? estimateTextTokens(debouncedText, props.chatLLM, 'composer text')
      : 0;
  }, [props.chatLLM, debouncedText]);
  let tokensComposer = tokensComposerTextDebounced + (llmAttachmentDrafts.llmTokenCountApprox || 0);
  if (props.chatLLM && tokensComposer > 0)
    tokensComposer += glueForMessageTokens(props.chatLLM);
  const tokensHistory = _historyTokenCount;
  const tokensReponseMax = (props.chatLLM?.options as LLMOptionsOpenAI /* FIXME: BIG ASSUMPTION */)?.llmResponseTokens || 0;
  const tokenLimit = props.chatLLM?.contextTokens || 0;
  const tokenPriceIn = props.chatLLM?.pricing?.chatIn;
  const tokenPriceOut = props.chatLLM?.pricing?.chatOut;


  // Effect: load initial text if queued up (e.g. by /link/share_targe)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [setComposeText, setStartupText, startupText]);


  // Overlay actions

  const handleReplyToClear = React.useCallback(() => {
    conversationOverlayStore?.getState().setReplyToText(null);
  }, [conversationOverlayStore]);

  React.useEffect(() => {
    if (replyToGenerateText)
      setTimeout(() => composerTextAreaRef.current?.focus(), 1 /* prevent focus theft */);
  }, [composerTextAreaRef, replyToGenerateText]);


  // Primary button

  const handleClear = React.useCallback(() => {
    setComposeText('');
    attachmentsRemoveAll();
    handleReplyToClear();
  }, [attachmentsRemoveAll, handleReplyToClear, setComposeText]);


  const handleSendAction = React.useCallback(async (_chatExecuteMode: ChatExecuteMode, composerText: string): Promise<boolean> => {
    if (!isValidConversation(targetConversationId)) return false;

    // validate some chat mode inputs
    const isDraw = _chatExecuteMode === 'generate-image';
    const isBlank = !composerText.trim();
    if (isDraw && isBlank)
      return false;

    // prepare the fragments: content (if any) and attachments (if allowed, and any)
    const fragments: (DMessageContentFragment | DMessageAttachmentFragment)[] = [];
    if (composerText)
      fragments.push(createTextContentFragment(composerText));

    const canAttach = chatExecuteModeCanAttach(_chatExecuteMode);
    if (canAttach) {
      const attachmentFragments = await attachmentsTakeAllFragments('global', 'app-chat');
      fragments.push(...attachmentFragments);
    }

    if (!fragments.length) {
      // addSnackbar({ key: 'chat-composer-empty', message: 'Nothing to send', type: 'info' });
      return false;
    }

    // send the message - NOTE: if successful, the ownership of the fragments is transferred to the receiver, so we just clear them
    const metadata = replyToGenerateText ? { inReplyToText: replyToGenerateText } : undefined;
    const enqueued = onAction(targetConversationId, _chatExecuteMode, fragments, metadata);
    if (enqueued)
      handleClear();
    return enqueued;
  }, [attachmentsTakeAllFragments, handleClear, onAction, replyToGenerateText, targetConversationId]);


  const handleSendClicked = React.useCallback(async () => {
    await handleSendAction(chatExecuteMode, composeText); // 'chat/write/...' button
  }, [chatExecuteMode, composeText, handleSendAction]);

  const handleSendTextBeamClicked = React.useCallback(async () => {
    await handleSendAction('beam-content', composeText); // 'beam' button
  }, [composeText, handleSendAction]);

  const handleStopClicked = React.useCallback(() => {
    targetConversationId && abortConversationTemp(targetConversationId);
  }, [abortConversationTemp, targetConversationId]);


  // Secondary buttons

  const handleCallClicked = React.useCallback(() => {
    targetConversationId && systemPurposeId && launchAppCall(targetConversationId, systemPurposeId);
  }, [systemPurposeId, targetConversationId]);

  const handleDrawOptionsClicked = React.useCallback(() => {
    openPreferencesTab(PreferencesTab.Draw);
  }, [openPreferencesTab]);

  const handleTextImagineClicked = React.useCallback(() => {
    if (!composeText || !targetConversationId) return;
    onTextImagine(targetConversationId, composeText);
    setComposeText('');
  }, [composeText, onTextImagine, setComposeText, targetConversationId]);


  // Actiles

  const onActileCommandPaste = React.useCallback((item: ActileItem) => {
    if (composerTextAreaRef.current) {
      const textArea = composerTextAreaRef.current;
      const currentText = textArea.value;
      const cursorPos = textArea.selectionStart;

      // Find the position where the command starts
      const commandStart = currentText.lastIndexOf('/', cursorPos);

      // Construct the new text with the autocompleted command
      const newText = currentText.substring(0, commandStart) + item.label + ' ' + currentText.substring(cursorPos);

      // Update the text area with the new text
      setComposeText(newText);

      // Move the cursor to the end of the autocompleted command
      const newCursorPos = commandStart + item.label.length + 1;
      textArea.setSelectionRange(newCursorPos, newCursorPos);
    }
  }, [composerTextAreaRef, setComposeText]);

  const onActileEmbedMessage = React.useCallback(async ({ conversationId, messageId }: StarredMessageItem) => {
    // get the message
    const conversation = getConversation(conversationId);
    const messageToEmbed = conversation?.messages.find(m => m.id === messageId);
    if (conversation && messageToEmbed) {
      const fragmentsCopy = duplicateDMessageFragments(messageToEmbed.fragments);
      if (fragmentsCopy.length) {
        const chatTitle = conversationTitle(conversation);
        const messageText = messageFragmentsReduceText(fragmentsCopy);
        const label = `${chatTitle} > ${messageText.slice(0, 10)}...`;
        await attachAppendEgoFragments(fragmentsCopy, label, chatTitle, conversationId, messageId);
      }
    }
  }, [attachAppendEgoFragments]);

  const actileProviders = React.useMemo(() => {
    return [providerCommands(onActileCommandPaste), providerStarredMessage(onActileEmbedMessage)];
  }, [onActileCommandPaste, onActileEmbedMessage]);

  const { actileComponent, actileInterceptKeydown, actileInterceptTextChange } = useActileManager(actileProviders, composerTextAreaRef);


  // Type...

  const handleTextareaTextChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComposeText(e.target.value);
    isMobile && actileInterceptTextChange(e.target.value);
  }, [actileInterceptTextChange, isMobile, setComposeText]);

  const handleTextareaKeyDown = React.useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // disable keyboard handling if the actile is visible
    if (actileInterceptKeydown(e))
      return;

    // Enter: primary action
    if (e.key === 'Enter') {

      // Alt (Windows) or Option (Mac) + Enter: append the message instead of sending it
      if (e.altKey) {
        if (await handleSendAction('append-user', composeText)) // 'alt+enter' -> write
          touchAltEnter();
        return e.preventDefault();
      }

      // Ctrl (Windows) or Command (Mac) + Enter: send for beaming
      if ((isMacUser && e.metaKey && !e.ctrlKey) || (!isMacUser && e.ctrlKey && !e.metaKey)) {
        if (await handleSendAction('beam-content', composeText)) // 'ctrl+enter' -> beam
          touchCtrlEnter();
        return e.preventDefault();
      }

      // Shift: toggles the 'enter is newline'
      if (e.shiftKey)
        touchShiftEnter();
      if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
        if (!assistantAbortible)
          await handleSendAction(chatExecuteMode, composeText); // enter -> send
        return e.preventDefault();
      }
    }

  }, [actileInterceptKeydown, assistantAbortible, chatExecuteMode, composeText, enterIsNewline, handleSendAction, touchAltEnter, touchCtrlEnter, touchShiftEnter]);


  // Focus mode

  // const handleFocusModeOn = React.useCallback(() => setIsFocusedMode(true), [setIsFocusedMode]);

  // const handleFocusModeOff = React.useCallback(() => setIsFocusedMode(false), [setIsFocusedMode]);


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
    const autoSend = micContinuation && nextText.length >= 1 && !noConversation; //&& assistantAbortible;
    const notUserStop = result.doneReason !== 'manual';
    if (autoSend) {
      if (notUserStop)
        void AudioPlayer.playUrl('/sounds/mic-off-mid.mp3');
      void handleSendAction(chatExecuteMode, nextText); // fire/forget
    } else {
      if (!micContinuation && notUserStop)
        void AudioPlayer.playUrl('/sounds/mic-off-mid.mp3');
      if (nextText) {
        composerTextAreaRef.current?.focus();
        setComposeText(nextText);
      }
    }
  }, [chatExecuteMode, composeText, composerTextAreaRef, handleSendAction, micContinuation, noConversation, setComposeText]);

  const { isSpeechEnabled, isSpeechError, isRecordingAudio, isRecordingSpeech, toggleRecording } =
    useSpeechRecognition(onSpeechResultCallback, chatMicTimeoutMs || 2000);

  useGlobalShortcuts([['m', true, false, false, toggleRecording]]);
  useMediaSessionCallbacks({ play: toggleRecording, pause: toggleRecording });

  const micIsRunning = !!speechInterimResult;
  const micContinuationTrigger = micContinuation && !micIsRunning && !assistantAbortible && !isSpeechError;
  const micColor: ColorPaletteProp = isSpeechError ? 'danger' : isRecordingSpeech ? 'primary' : isRecordingAudio ? 'primary' : 'neutral';
  const micVariant: VariantProp = isRecordingSpeech ? 'solid' : isRecordingAudio ? 'soft' : 'soft';  //(isDesktop ? 'soft' : 'plain');

  const handleToggleMic = React.useCallback(() => {
    if (micIsRunning && micContinuation)
      setMicContinuation(false);
    toggleRecording();
  }, [micContinuation, micIsRunning, toggleRecording]);

  const handleToggleMicContinuation = React.useCallback(() => {
    setMicContinuation(continued => !continued);
  }, []);

  React.useEffect(() => {
    // autostart the microphone if the assistant stopped typing
    if (micContinuationTrigger)
      toggleRecording();
  }, [toggleRecording, micContinuationTrigger]);


  // Attachment Up

  const handleAttachCtrlV = React.useCallback((event: React.ClipboardEvent) => {
    if (attachAppendDataTransfer(event.clipboardData, 'paste', false) === 'as_files')
      event.preventDefault();
  }, [attachAppendDataTransfer]);

  const handleAttachCameraImage = React.useCallback((file: FileWithHandle) => {
    void attachAppendFile('camera', file);
  }, [attachAppendFile]);

  const { openCamera, cameraCaptureComponent } = useCameraCaptureModal(handleAttachCameraImage);

  const handleAttachScreenCapture = React.useCallback((file: File) => {
    void attachAppendFile('screencapture', file);
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

  useGlobalShortcuts([[supportsClipboardRead ? 'v' : false, true, true, false, attachAppendClipboardItems]]);


  // Attachments Down

  const handleAttachmentDraftsAction = React.useCallback((attachmentDraftIdOrAll: AttachmentDraftId | null, action: LLMAttachmentDraftsAction) => {
    switch (action) {
      case 'copy-text':
        const copyFragments = attachmentsTakeFragmentsByType('doc', attachmentDraftIdOrAll, false);
        const copyString = marshallWrapDocFragments(null, copyFragments, false, '\n\n---\n\n');
        copyToClipboard(copyString, attachmentDraftIdOrAll ? 'Attachment Text' : 'Attachments Text');
        break;
      case 'inline-text':
        const inlineFragments = attachmentsTakeFragmentsByType('doc', attachmentDraftIdOrAll, true);
        setComposeText(currentText => marshallWrapDocFragments(currentText, inlineFragments, 'markdown-code', '\n\n'));
        break;
    }
  }, [attachmentsTakeFragmentsByType, setComposeText]);


  // ...

  const isText = chatExecuteMode === 'generate-content' || chatExecuteMode === 'generate-text-v1';
  const isTextBeam = chatExecuteMode === 'beam-content';
  const isAppend = chatExecuteMode === 'append-user';
  const isReAct = chatExecuteMode === 'react-content';
  const isDraw = chatExecuteMode === 'generate-image';

  const showChatReplyTo = !!replyToGenerateText;
  const showChatExtras = isText && !showChatReplyTo;

  const sendButtonVariant: VariantProp = (isAppend || (isMobile && isTextBeam)) ? 'outlined' : 'solid';

  const sendButtonColor: ColorPaletteProp = assistantAbortible ? 'warning' : chatExecuteModeSendColor;

  const sendButtonLabel = chatExecuteModeSendLabel;

  const sendButtonIcon =
    micContinuation ? <AutoModeIcon />
      : isAppend ? <SendIcon sx={{ fontSize: 18 }} />
        : isReAct ? <PsychologyIcon />
          : isTextBeam ? <ChatBeamIcon /> /* <GavelIcon /> */
            : isDraw ? <FormatPaintTwoToneIcon />
              : <TelegramIcon />;

  let textPlaceholder: string =
    isDraw ? 'Describe an idea or a drawing...'
      : isReAct ? 'Multi-step reasoning question...'
        : isTextBeam ? 'Beam: combine the smarts of models...'
          : showChatReplyTo ? 'Chat about this'
            : props.isDeveloperMode ? 'Chat with me' + (isDesktop ? ' · drop source' : '') + ' · attach code...'
              : props.capabilityHasT2I ? 'Chat · /beam · /draw · drop files...'
                : 'Chat · /react · drop files...';
  if (isDesktop && timeToShowTips) {
    if (explainShiftEnter)
      textPlaceholder += !enterIsNewline ? '\n\n💡 Shift + Enter to add a new line' : '\n\n💡 Shift + Enter to send';
    else if (explainAltEnter)
      textPlaceholder += platformAwareKeystrokes('\n\n💡 Tip: Alt + Enter to just append the message');
    else if (explainCtrlEnter)
      textPlaceholder += platformAwareKeystrokes('\n\n💡 Tip: Ctrl + Enter to beam');
  }

  return (
    <Box aria-label='User Message' component='section' sx={props.sx}>
      <Grid
        container
        onDragEnter={handleDragEnter}
        onDragStart={handleDragStart}
        spacing={{ xs: 1, md: 2 }}
        sx={dragContainerSx}
      >

        {/* [Mobile: top, Desktop: left] */}
        <Grid xs={12} md={9}><Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'flex-start' }}>

          {/* [Mobile, Col1] Mic, Insert Multi-modal content, and Broadcast buttons */}
          {isMobile && (
            <Box sx={{ flexGrow: 0, display: 'grid', gap: 1 }}>

              {/* [mobile] Mic button */}
              {isSpeechEnabled && <ButtonMicMemo variant={micVariant} color={micColor} onClick={handleToggleMic} />}

              {/* [mobile] [+] button */}
              {showLLMAttachments && (
                <Dropdown>
                  <MenuButton slots={{ root: IconButton }}>
                    <AddCircleOutlineIcon />
                  </MenuButton>
                  <Menu>
                    {/* Responsive Camera OCR button */}
                    <MenuItem>
                      <ButtonAttachCameraMemo onOpenCamera={openCamera} />
                    </MenuItem>

                    {/* Responsive Open Files button */}
                    <MenuItem>
                      <ButtonAttachFileMemo onAttachFilePicker={handleAttachFilePicker} />
                    </MenuItem>

                    {/* Responsive Paste button */}
                    {supportsClipboardRead && <MenuItem>
                      <ButtonAttachClipboardMemo onClick={attachAppendClipboardItems} />
                    </MenuItem>}
                  </Menu>
                </Dropdown>
              )}

              {/* [Mobile] MultiChat button */}
              {props.isMulticast !== null && <ButtonMultiChatMemo isMobile multiChat={props.isMulticast} onSetMultiChat={props.setIsMulticast} />}

            </Box>
          )}

          {/* [Desktop, Col1] Insert Multi-modal content buttons */}
          {isDesktop && showLLMAttachments && (
            <Box sx={{ flexGrow: 0, display: 'grid', gap: 1 }}>

              {/*<FormHelperText sx={{ mx: 'auto' }}>*/}
              {/*  Attach*/}
              {/*</FormHelperText>*/}

              {/* Responsive Open Files button */}
              <ButtonAttachFileMemo onAttachFilePicker={handleAttachFilePicker} />

              {/* Responsive Paste button */}
              {supportsClipboardRead && <ButtonAttachClipboardMemo onClick={attachAppendClipboardItems} />}

              {/* Responsive Screen Capture button */}
              {labsAttachScreenCapture && supportsScreenCapture && <ButtonAttachScreenCaptureMemo onAttachScreenCapture={handleAttachScreenCapture} />}

              {/* Responsive Camera OCR button */}
              {labsCameraDesktop && <ButtonAttachCameraMemo onOpenCamera={openCamera} />}

            </Box>)}


          {/* Top: Textarea & Mic & Overlays, Bottom, Attachment Drafts */}
          <Box sx={{
            flexGrow: 1,
            // layout
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minWidth: 200, // flex: enable X-scrolling (resetting any possible minWidth due to the attachment drafts)
          }}>

            {/* Text Edit + Mic buttons + MicOverlay */}
            <Box sx={{ position: 'relative' /* for Mic overlay */ }}>

              {/* Edit box with inner Token Progress bar */}
              <Box sx={{ position: 'relative' /* for TokenBadge & TokenProgress */ }}>

                <Textarea
                  variant='outlined'
                  color={isDraw ? 'warning' : isReAct ? 'success' : undefined}
                  autoFocus
                  minRows={isMobile ? 4 : showChatReplyTo ? 4 : 5}
                  maxRows={isMobile ? 8 : 10}
                  placeholder={textPlaceholder}
                  value={composeText}
                  onChange={handleTextareaTextChange}
                  onKeyDown={handleTextareaKeyDown}
                  onPasteCapture={handleAttachCtrlV}
                  // onFocusCapture={handleFocusModeOn}
                  // onBlurCapture={handleFocusModeOff}
                  endDecorator={showChatReplyTo && <ReplyToBubble replyToText={replyToGenerateText} onClear={handleReplyToClear} className='reply-to-bubble' />}
                  slotProps={{
                    textarea: {
                      enterKeyHint: enterIsNewline ? 'enter' : 'send',
                      sx: {
                        ...(isSpeechEnabled && { pr: { md: 5 } }),
                        // mb: 0.5, // no need; the outer container already has enough p (for TokenProgressbar)
                      },
                      ref: composerTextAreaRef,
                    },
                  }}
                  sx={{
                    backgroundColor: 'background.level1',
                    '&:focus-within': { backgroundColor: 'background.popup', '.reply-to-bubble': { backgroundColor: 'background.popup' } },
                    lineHeight: lineHeightTextareaMd,
                  }} />

                {!showChatReplyTo && tokenLimit > 0 && (tokensComposer > 0 || (tokensHistory + tokensReponseMax) > 0) && (
                  <TokenProgressbarMemo direct={tokensComposer} history={tokensHistory} responseMax={tokensReponseMax} limit={tokenLimit} tokenPriceIn={tokenPriceIn} tokenPriceOut={tokenPriceOut} />
                )}

                {!showChatReplyTo && tokenLimit > 0 && (
                  <TokenBadgeMemo direct={tokensComposer} history={tokensHistory} responseMax={tokensReponseMax} limit={tokenLimit} tokenPriceIn={tokenPriceIn} tokenPriceOut={tokenPriceOut} showCost={labsShowCost} enableHover={!isMobile} showExcess absoluteBottomRight />
                )}

              </Box>

              {/* Mic & Mic Continuation Buttons */}
              {isSpeechEnabled && (
                <Box sx={{
                  position: 'absolute', top: 0, right: 0,
                  zIndex: zIndexComposerOverlayMic + 1,
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
                  color='primary' variant='soft'
                  sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                    // alignItems: 'center', justifyContent: 'center',
                    border: '1px solid',
                    borderColor: 'primary.solidBg',
                    borderRadius: 'sm',
                    zIndex: zIndexComposerOverlayMic,
                    pl: 1.5,
                    pr: { xs: 1.5, md: 5 },
                    py: 0.625,
                    overflow: 'auto',
                  }}>
                  <Typography sx={{
                    color: 'primary.softColor',
                    lineHeight: lineHeightTextareaMd,
                    '& .interim': {
                      textDecoration: 'underline',
                      textDecorationThickness: '0.25em',
                      textDecorationColor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.1)',
                      textDecorationSkipInk: 'none',
                      textUnderlineOffset: '0.25em',
                    },
                  }}>
                    {speechInterimResult.transcript}{' '}
                    <span className={speechInterimResult.interimTranscript !== 'Listening...' ? 'interim' : undefined}>{speechInterimResult.interimTranscript}</span>
                  </Typography>
                </Card>
              )}

            </Box>

            {/* Render any Attachments & menu items */}
            {!!conversationOverlayStore && showLLMAttachments && (
              <LLMAttachmentsList
                attachmentDraftsStoreApi={conversationOverlayStore}
                llmAttachmentDrafts={llmAttachmentDrafts}
                onAttachmentDraftsAction={handleAttachmentDraftsAction}
              />
            )}

          </Box>

        </Box></Grid>


        {/* [Mobile: bottom, Desktop: right] */}
        <Grid xs={12} md={3}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' } as const}>

            {/* [mobile] This row is here only for the [mobile] bottom-start corner item */}
            {/* [desktop] This column arrangement will have the [desktop] beam button right under call */}
            <Box sx={isMobile ? { display: 'flex' } : { display: 'grid', gap: 1 }}>

              {/* [mobile] bottom-corner secondary button */}
              {isMobile && (showChatExtras
                  ? <ButtonCallMemo isMobile disabled={noConversation || noLLM} onClick={handleCallClicked} />
                  : isDraw
                    ? <ButtonOptionsDraw isMobile onClick={handleDrawOptionsClicked} sx={{ mr: { xs: 1, md: 2 } }} />
                    : <IconButton disabled sx={{ mr: { xs: 1, md: 2 } }} />
              )}

              {/* Responsive Send/Stop buttons */}
              <ButtonGroup
                variant={sendButtonVariant}
                color={sendButtonColor}
                sx={{
                  flexGrow: 1,
                  backgroundColor: (isMobile && sendButtonVariant === 'outlined') ? 'background.popup' : undefined,
                  boxShadow: (isMobile && sendButtonVariant !== 'outlined') ? 'none' : `0 8px 24px -4px rgb(var(--joy-palette-${sendButtonColor}-mainChannel) / 20%)`,
                }}
              >
                {!assistantAbortible ? (
                  <Button
                    key='composer-act'
                    fullWidth disabled={noConversation || noLLM || !llmAttachmentDrafts.canAttachAllFragments}
                    onClick={handleSendClicked}
                    endDecorator={sendButtonIcon}
                    sx={{ '--Button-gap': '1rem' }}
                  >
                    {micContinuation && 'Voice '}{sendButtonLabel}
                  </Button>
                ) : (
                  <Button
                    key='composer-stop'
                    fullWidth variant='soft' disabled={noConversation}
                    onClick={handleStopClicked}
                    endDecorator={<StopOutlinedIcon sx={{ fontSize: 18 }} />}
                    sx={{ animation: `${animationEnterBelow} 0.1s ease-out` }}
                  >
                    Stop
                  </Button>
                )}

                {/* [Beam] Open Beam */}
                {/*{isText && <Tooltip title='Open Beam'>*/}
                {/*  <IconButton variant='outlined' disabled={noConversation || noLLM} onClick={handleSendTextBeamClicked}>*/}
                {/*    <ChatBeamIcon />*/}
                {/*  </IconButton>*/}
                {/*</Tooltip>}*/}

                {/* [Draw] Imagine */}
                {isDraw && !!composeText && <Tooltip title='Imagine a drawing prompt'>
                  <IconButton variant='outlined' disabled={noConversation || noLLM} onClick={handleTextImagineClicked}>
                    <AutoAwesomeIcon />
                  </IconButton>
                </Tooltip>}

                {/* Mode expander */}
                <IconButton
                  variant={assistantAbortible ? 'soft' : isDraw ? undefined : undefined}
                  disabled={noConversation || noLLM || chatExecuteMenuShown}
                  onClick={showChatExecuteMenu}
                >
                  <ExpandLessIcon />
                </IconButton>
              </ButtonGroup>

              {/* [desktop] secondary-top buttons */}
              {isDesktop && showChatExtras && !assistantAbortible && (
                <ButtonBeamMemo
                  disabled={noConversation || noLLM || !llmAttachmentDrafts.canAttachAllFragments}
                  hasContent={!!composeText}
                  onClick={handleSendTextBeamClicked}
                />
              )}

            </Box>

            {/* [desktop] Multicast switch (under the Chat button) */}
            {isDesktop && props.isMulticast !== null && <ButtonMultiChatMemo multiChat={props.isMulticast} onSetMultiChat={props.setIsMulticast} />}

            {/* [desktop] secondary bottom-buttons (aligned to bottom for now, and mutually exclusive) */}
            {isDesktop && <Box sx={{ mt: 'auto', display: 'grid', gap: 1 }}>

              {/* [desktop] Call secondary button */}
              {showChatExtras && <ButtonCallMemo disabled={noConversation || noLLM} onClick={handleCallClicked} />}

              {/* [desktop] Draw Options secondary button */}
              {isDraw && <ButtonOptionsDraw onClick={handleDrawOptionsClicked} />}

            </Box>}

          </Box>
        </Grid>

        {/* overlay: Drag & Drop*/}
        {dragDropComponent}

      </Grid>

      {/* Execution Mode Menu */}
      {chatExecuteMenuComponent}

      {/* Camera (when open) */}
      {cameraCaptureComponent}

      {/* Actile (when open) */}
      {actileComponent}

    </Box>
  );
}