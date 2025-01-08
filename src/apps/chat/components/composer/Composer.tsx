import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { Box, Button, ButtonGroup, Card, Dropdown, Grid, IconButton, Menu, MenuButton, MenuItem, Textarea, Tooltip, Typography } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import type { AppChatIntent } from '../../AppChat';
import { useChatAutoSuggestAttachmentPrompts, useChatMicTimeoutMsValue } from '../../store-app-chat';

import { useAgiAttachmentPrompts } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import { DLLM, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { AudioGenerator } from '~/common/util/audio/AudioGenerator';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { ButtonAttachFilesMemo, openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { DMessageMetadata, DMetaReferenceItem, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { ShortcutKey, ShortcutObject, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { animationEnterBelow } from '~/common/util/animUtils';
import { browserSpeechRecognitionCapability, PLACEHOLDER_INTERIM_TRANSCRIPT, SpeechResult, useSpeechRecognition } from '~/common/components/speechrecognition/useSpeechRecognition';
import { DConversationId } from '~/common/stores/chat/chat.conversation';
import { copyToClipboard, supportsClipboardRead } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, duplicateDMessageFragmentsNoVoid } from '~/common/stores/chat/chat.fragments';
import { estimateTextTokens, glueForMessageTokens, marshallWrapDocFragments } from '~/common/stores/chat/chat.tokens';
import { isValidConversation, useChatStore } from '~/common/stores/chat/store-chats';
import { getModelParameterValueOrThrow } from '~/common/stores/llms/llms.parameters';
import { launchAppCall, removeQueryParam, useRouterQuery } from '~/common/app.routes';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useChatComposerOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';
import { useComposerStartupText, useLogicSherpaStore } from '~/common/logic/store-logic-sherpa';
import { useDebouncer } from '~/common/components/useDebouncer';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useUICounter, useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import type { ActileItem } from './actile/ActileProvider';
import { providerAttachmentLabels } from './actile/providerAttachmentLabels';
import { providerCommands } from './actile/providerCommands';
import { providerStarredMessages, StarredMessageItem } from './actile/providerStarredMessage';
import { useActileManager } from './actile/useActileManager';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import { LLMAttachmentDraftsAction, LLMAttachmentsList } from './llmattachments/LLMAttachmentsList';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useLLMAttachmentDrafts } from './llmattachments/useLLMAttachmentDrafts';

import type { ChatExecuteMode } from '../../execute-mode/execute-mode.types';
import { chatExecuteModeCanAttach, useChatExecuteMode } from '../../execute-mode/useChatExecuteMode';

import { ButtonAttachCameraMemo, useCameraCaptureModal } from './buttons/ButtonAttachCamera';
import { ButtonAttachClipboardMemo } from './buttons/ButtonAttachClipboard';
import { ButtonAttachScreenCaptureMemo } from './buttons/ButtonAttachScreenCapture';
import { ButtonBeamMemo } from './buttons/ButtonBeam';
import { ButtonCallMemo } from './buttons/ButtonCall';
import { ButtonMicContinuationMemo } from './buttons/ButtonMicContinuation';
import { ButtonMicMemo } from './buttons/ButtonMic';
import { ButtonMultiChatMemo } from './buttons/ButtonMultiChat';
import { ButtonOptionsDraw } from './buttons/ButtonOptionsDraw';
import { ComposerTextAreaActions } from './textarea/ComposerTextAreaActions';
import { StatusBar } from '../StatusBar';
import { TokenBadgeMemo } from './tokens/TokenBadge';
import { TokenProgressbarMemo } from './tokens/TokenProgressbar';
import { useComposerDragDrop } from './useComposerDragDrop';


const zIndexComposerOverlayMic = 10;


const paddingBoxSx: SxProps = {
  p: { xs: 1, md: 2 },
};


const minimizedSx: SxProps = {
  ...paddingBoxSx,
  display: 'none',
};


/**
 * A React component for composing messages, with attachments and different modes.
 */
export function Composer(props: {
  isMobile: boolean;
  chatLLM: DLLM | null;
  composerTextAreaRef: React.RefObject<HTMLTextAreaElement>;
  targetConversationId: DConversationId | null;
  capabilityHasT2I: boolean;
  isMulticast: boolean | null;
  isDeveloperMode: boolean;
  onAction: (conversationId: DConversationId, chatExecuteMode: ChatExecuteMode, fragments: (DMessageContentFragment | DMessageAttachmentFragment)[], metadata?: DMessageMetadata) => boolean;
  onConversationsImportFromFiles: (files: File[]) => Promise<void>;
  onTextImagine: (conversationId: DConversationId, text: string) => void;
  setIsMulticast: (on: boolean) => void;
  sx?: SxProps;
}) {

  // state
  const [composeText, debouncedText, setComposeText] = useDebouncer('', 300, 1200, true);
  const [micContinuation, setMicContinuation] = React.useState(false);
  const [speechInterimResult, setSpeechInterimResult] = React.useState<SpeechResult | null>(null);
  const [sendStarted, setSendStarted] = React.useState(false);
  const {
    chatExecuteMode,
    chatExecuteModeSendColor, chatExecuteModeSendLabel,
    chatExecuteMenuComponent, chatExecuteMenuShown, showChatExecuteMenu,
  } = useChatExecuteMode(props.capabilityHasT2I, props.isMobile);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const micCardRef = React.useRef<HTMLDivElement>(null);

  // external state
  const { showPromisedOverlay } = useOverlayComponents();
  const { newChat: appChatNewChatIntent } = useRouterQuery<Partial<AppChatIntent>>();
  const { labsAttachScreenCapture, labsCameraDesktop, labsShowCost, labsShowShortcutBar } = useUXLabsStore(useShallow(state => ({
    labsAttachScreenCapture: state.labsAttachScreenCapture,
    labsCameraDesktop: state.labsCameraDesktop,
    labsShowCost: state.labsShowCost,
    labsShowShortcutBar: state.labsShowShortcutBar,
  })));
  const timeToShowTips = useLogicSherpaStore(state => state.usageCount >= 5);
  const { novel: explainShiftEnter, touch: touchShiftEnter } = useUICounter('composer-shift-enter');
  const { novel: explainAltEnter, touch: touchAltEnter } = useUICounter('composer-alt-enter');
  const { novel: explainCtrlEnter, touch: touchCtrlEnter } = useUICounter('composer-ctrl-enter');
  const [startupText, setStartupText] = useComposerStartupText();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);
  const chatMicTimeoutMs = useChatMicTimeoutMsValue();
  const { assistantAbortible, systemPurposeId, tokenCount: _historyTokenCount, abortConversationTemp } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.targetConversationId);
    return {
      assistantAbortible: conversation ? !!conversation._abortController : false,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      tokenCount: conversation ? conversation.tokenCount : 0,
      abortConversationTemp: state.abortConversationTemp,
    };
  }));

  // external overlay state (extra conversationId-dependent state)
  const conversationOverlayStore = props.targetConversationId
    ? ConversationsManager.getHandler(props.targetConversationId)?.conversationOverlayStore ?? null
    : null;

  // composer-overlay: for the in-reference-to state, comes from the conversation overlay
  const allowInReferenceTo = chatExecuteMode === 'generate-content';
  const inReferenceTo = useChatComposerOverlayStore(conversationOverlayStore, store => allowInReferenceTo ? store.inReferenceTo : null);

  // LLM-derived
  const noLLM = !props.chatLLM;
  const chatLLMSupportsImages = !!props.chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);

  // don't load URLs if the user is typing a command or there's no capability
  const hasComposerBrowseCapability = useBrowseCapability().inComposer;
  const enableLoadURLsInComposer = hasComposerBrowseCapability && !composeText.startsWith('/');

  // user message for attachments
  const { onConversationsImportFromFiles } = props;
  const handleFilterAGIFile = React.useCallback(async (file: File): Promise<boolean> =>
    await showPromisedOverlay('composer-open-or-attach', { rejectWithValue: false }, ({ onResolve, onUserReject }) => (
      <ConfirmationModal
        open onClose={onUserReject}
        onPositive={() => {
          onConversationsImportFromFiles([file]);
          onResolve(true);
        }}
        title='Open Conversation or Attach?'
        positiveActionText='Open' negativeActionText='Attach'
        confirmationText={`Would you like to open the conversation "${file.name}" or attach it to the message?`}
      />
    )), [onConversationsImportFromFiles, showPromisedOverlay]);

  // attachments-overlay: comes from the attachments slice of the conversation overlay
  const {
    /* items */ attachmentDrafts,
    /* append */ attachAppendClipboardItems, attachAppendDataTransfer, attachAppendEgoFragments, attachAppendFile,
    /* take */ attachmentsRemoveAll, attachmentsTakeAllFragments, attachmentsTakeFragmentsByType,
  } = useAttachmentDrafts(conversationOverlayStore, enableLoadURLsInComposer, chatLLMSupportsImages, handleFilterAGIFile);

  // attachments derived state
  const llmAttachmentDraftsCollection = useLLMAttachmentDrafts(attachmentDrafts, props.chatLLM, chatLLMSupportsImages);

  // drag/drop
  const { dragContainerSx, dropComponent, handleContainerDragEnter, handleContainerDragStart } = useComposerDragDrop(!props.isMobile, attachAppendDataTransfer);

  // ai functions
  const agiAttachmentPrompts = useAgiAttachmentPrompts(useChatAutoSuggestAttachmentPrompts(), attachmentDrafts);


  // derived state

  const { composerTextAreaRef, targetConversationId, onAction, onTextImagine } = props;
  const isMobile = props.isMobile;
  const isDesktop = !props.isMobile;
  const noConversation = !targetConversationId;
  const showChatAttachments = chatExecuteModeCanAttach(chatExecuteMode);

  const micIsRunning = !!speechInterimResult;
  // more mic way below, as we use complex hooks


  // tokens derived state

  const tokensComposerTextDebounced = React.useMemo(() => {
    return (debouncedText && props.chatLLM)
      ? estimateTextTokens(debouncedText, props.chatLLM, 'composer text')
      : 0;
  }, [props.chatLLM, debouncedText]);
  let tokensComposer = tokensComposerTextDebounced + (llmAttachmentDraftsCollection.llmTokenCountApprox || 0);
  if (props.chatLLM && tokensComposer > 0)
    tokensComposer += glueForMessageTokens(props.chatLLM);
  const tokensHistory = _historyTokenCount;
  const tokensResponseMax = getModelParameterValueOrThrow('llmResponseTokens', props.chatLLM?.initialParameters, props.chatLLM?.userParameters, 0) ?? 0;
  const tokenLimit = props.chatLLM?.contextTokens || 0;
  const tokenChatPricing = props.chatLLM?.pricing?.chat;


  // Effect: load initial text if queued up (e.g. by /link/share_targetF)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [setComposeText, setStartupText, startupText]);


  // Overlay actions

  const handleRemoveInReferenceTo = React.useCallback((item: DMetaReferenceItem) => {
    conversationOverlayStore?.getState().removeInReferenceTo(item);
  }, [conversationOverlayStore]);

  const handleInReferenceToClear = React.useCallback(() => {
    conversationOverlayStore?.getState().clearInReferenceTo();
  }, [conversationOverlayStore]);

  React.useEffect(() => {
    if (inReferenceTo?.length)
      setTimeout(() => composerTextAreaRef.current?.focus(), 1 /* prevent focus theft */);
  }, [composerTextAreaRef, inReferenceTo]);


  // Confirmation Modals

  const confirmProceedIfAttachmentsNotSupported = React.useCallback(async (): Promise<boolean> => {
    if (llmAttachmentDraftsCollection.canAttachAllFragments) return true;
    return await showPromisedOverlay('composer-unsupported-attachments', { rejectWithValue: false }, ({ onResolve, onUserReject }) => (
      <ConfirmationModal
        open
        onClose={onUserReject}
        onPositive={() => onResolve(true)}
        confirmationText='Some attached files may not be fully compatible with the current AI model. This could affect processing. Would you like to review or proceed?'
        positiveActionText='Proceed'
        negativeActionText='Review Attachments'
        title='Attachment Compatibility Notice'
      />
    ));
  }, [llmAttachmentDraftsCollection.canAttachAllFragments, showPromisedOverlay]);


  // Primary button

  const _handleClearText = React.useCallback(() => {
    setComposeText('');
    attachmentsRemoveAll();
    handleInReferenceToClear();
  }, [attachmentsRemoveAll, handleInReferenceToClear, setComposeText]);

  const _handleSendActionUnguarded = React.useCallback(async (_chatExecuteMode: ChatExecuteMode, composerText: string): Promise<boolean> => {
    if (!isValidConversation(targetConversationId)) return false;

    // await user confirmation (or rejection) if attachments are not supported
    if (!await confirmProceedIfAttachmentsNotSupported()) return false;

    // validate some chat mode inputs
    const isDraw = _chatExecuteMode === 'generate-image';
    const isBlank = !composerText.trim();
    if (isDraw && isBlank) {
      addSnackbar({ key: 'chat-draw-empty', message: 'Please enter a description to generate an image.', type: 'info' });
      return false;
    }

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
      // addSnackbar({ key: 'chat-composer-empty', message: 'Please enter a message or attach files.', type: 'info' });
      return false;
    }

    // prepare the metadata
    const metadata = inReferenceTo?.length ? { inReferenceTo: inReferenceTo } : undefined;

    // send the message - NOTE: if successful, the ownership of the fragments is transferred to the receiver, so we just clear them
    const enqueued = onAction(targetConversationId, _chatExecuteMode, fragments, metadata);
    if (enqueued)
      _handleClearText();
    return enqueued;
  }, [attachmentsTakeAllFragments, confirmProceedIfAttachmentsNotSupported, _handleClearText, inReferenceTo, onAction, targetConversationId]);

  const handleSendAction = React.useCallback(async (chatExecuteMode: ChatExecuteMode, composerText: string): Promise<boolean> => {
    setSendStarted(true);
    const enqueued = await _handleSendActionUnguarded(chatExecuteMode, composerText);
    setSendStarted(false);
    return enqueued;
  }, [_handleSendActionUnguarded, setSendStarted]);


  // Mic typing & continuation mode - NOTE: this is here because needs the handleSendAction, and provides recognitionState

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
    const autoSend = (result.flagSendOnDone || micContinuation) && nextText.length >= 1 && !noConversation; //&& assistantAbortible;
    const notUserStop = result.doneReason !== 'manual';
    if (autoSend) {
      // if (notUserStop) {
      void AudioGenerator.chatAutoSend();
      // void AudioPlayer.playUrl('/sounds/mic-off-mid.mp3');
      // }
      void handleSendAction(chatExecuteMode, nextText); // fire/forget
    } else {
      // if scheduled for send but not sent, clear the send state
      if (result.flagSendOnDone)
        setSendStarted(false);

      // mic off sound
      if (!micContinuation && notUserStop)
        void AudioPlayer.playUrl('/sounds/mic-off-mid.mp3').catch(() => {
          // This happens on Is.Browser.Safari, where the audio is not allowed to play without user interaction
        });

      // update with the spoken text
      if (nextText) {
        composerTextAreaRef.current?.focus();
        setComposeText(nextText);
      }
    }
  }, [chatExecuteMode, composeText, composerTextAreaRef, handleSendAction, micContinuation, noConversation, setComposeText]);

  const { recognitionState, toggleRecognition } = useSpeechRecognition('webSpeechApi', onSpeechResultCallback, chatMicTimeoutMs || 2000);

  const micContinuationTrigger = micContinuation && !micIsRunning && !assistantAbortible && !recognitionState.errorMessage;
  const micColor: ColorPaletteProp = recognitionState.errorMessage ? 'danger' : recognitionState.isActive ? 'primary' : recognitionState.hasAudio ? 'primary' : 'neutral';
  const micVariant: VariantProp = recognitionState.hasSpeech ? 'solid' : recognitionState.hasAudio ? 'soft' : 'soft';  //(isDesktop ? 'soft' : 'plain');

  const handleToggleMic = React.useCallback(() => {
    if (micIsRunning && micContinuation)
      setMicContinuation(false);
    toggleRecognition();
  }, [micContinuation, micIsRunning, toggleRecognition]);

  const handleToggleMicContinuation = React.useCallback(() => {
    setMicContinuation(continued => !continued);
  }, []);

  React.useEffect(() => {
    // autostart the microphone if the assistant stopped typing
    if (micContinuationTrigger)
      toggleRecognition();
  }, [toggleRecognition, micContinuationTrigger]);

  React.useEffect(() => {
    // auto-scroll the mic card to the bottom
    micCardRef.current?.scrollTo({
      top: micCardRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [speechInterimResult]);

  React.useEffect(() => {
    // auto-start the microphone if appChat was created with a particular intent
    if (appChatNewChatIntent === 'voiceInput') {
      toggleRecognition();
      void removeQueryParam('newChat');
    }
  }, [appChatNewChatIntent, toggleRecognition]);


  // Other send actins

  const handleAppendTextAndSend = React.useCallback(async (appendText: string) => {
    const newText = composeText ? `${composeText} ${appendText}` : appendText;
    setComposeText(newText);
    await handleSendAction(chatExecuteMode, newText);
  }, [chatExecuteMode, composeText, handleSendAction, setComposeText]);

  const handleFinishMicAndSend = React.useCallback(() => {
    if (!sendStarted) {
      setSendStarted(true);
      toggleRecognition(true);
    }
  }, [sendStarted, toggleRecognition]);

  const handleSendClicked = React.useCallback(async () => {
    // Auto-send as soon as the mic is done
    if (recognitionState.isActive) {
      handleFinishMicAndSend();
      return;
    }
    // Safety option
    if (micIsRunning) {
      addSnackbar({ key: 'chat-mic-running', message: 'Please wait for the microphone to finish.', type: 'info' });
      return;
    }
    await handleSendAction(chatExecuteMode, composeText); // 'chat/write/...' button
  }, [chatExecuteMode, composeText, handleFinishMicAndSend, handleSendAction, micIsRunning, recognitionState.isActive]);

  const handleSendTextBeamClicked = React.useCallback(async () => {
    if (micIsRunning) {
      addSnackbar({ key: 'chat-mic-running', message: 'Please wait for the microphone to finish.', type: 'info' });
      return;
    }
    await handleSendAction('beam-content', composeText); // 'beam' button
  }, [composeText, handleSendAction, micIsRunning]);

  const handleStopClicked = React.useCallback(() => {
    targetConversationId && abortConversationTemp(targetConversationId);
  }, [abortConversationTemp, targetConversationId]);


  // Secondary buttons

  const handleCallClicked = React.useCallback(() => {
    targetConversationId && systemPurposeId && launchAppCall(targetConversationId, systemPurposeId);
  }, [systemPurposeId, targetConversationId]);

  const handleDrawOptionsClicked = React.useCallback(() => optimaOpenPreferences('draw'), []);

  const handleTextImagineClicked = React.useCallback(() => {
    if (!composeText || !targetConversationId) return;
    onTextImagine(targetConversationId, composeText);
    setComposeText('');
  }, [composeText, onTextImagine, setComposeText, targetConversationId]);


  // Actiles

  const onActileCommandPaste = React.useCallback(({ label }: ActileItem, searchPrefix: string) => {
    if (composerTextAreaRef.current) {
      const textArea = composerTextAreaRef.current;
      const currentText = textArea.value;
      const cursorPos = textArea.selectionStart;

      // Find the position where the command starts
      const commandStart = currentText.lastIndexOf(searchPrefix, cursorPos);

      // Construct the new text with the autocompleted command
      setComposeText((prevText) => prevText.substring(0, commandStart) + label + ' ' + prevText.substring(cursorPos));

      // Schedule setting the cursor position after the state update
      const newCursorPos = commandStart + label.length + 1;
      setTimeout(() => composerTextAreaRef.current?.setSelectionRange(newCursorPos, newCursorPos), 0);
    }
  }, [composerTextAreaRef, setComposeText]);

  const onActileEmbedMessage = React.useCallback(async ({ conversationId, messageId }: StarredMessageItem) => {
    // get the message
    const cHandler = ConversationsManager.getHandler(conversationId);
    const messageToEmbed = cHandler.historyFindMessageOrThrow(messageId);
    if (messageToEmbed) {
      const fragmentsCopy = duplicateDMessageFragmentsNoVoid(messageToEmbed.fragments); // [attach] deep copy a message's fragments to attach to ego
      if (fragmentsCopy.length) {
        const chatTitle = cHandler.title() ?? '';
        const messageText = messageFragmentsReduceText(fragmentsCopy);
        const label = `${chatTitle} > ${messageText.slice(0, 10)}...`;
        await attachAppendEgoFragments(fragmentsCopy, label, chatTitle, conversationId, messageId);
      }
    }
  }, [attachAppendEgoFragments]);


  const actileProviders = React.useMemo(() => [
    providerAttachmentLabels(conversationOverlayStore, onActileCommandPaste),
    providerCommands(onActileCommandPaste),
    providerStarredMessages(onActileEmbedMessage),
  ], [conversationOverlayStore, onActileCommandPaste, onActileEmbedMessage]);

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
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (await handleSendAction('append-user', composeText)) // 'alt+enter' -> write
          touchAltEnter();
        return e.preventDefault();
      }

      // Ctrl (Windows) or Command (Mac) + Enter: send for beaming
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        if (await handleSendAction('beam-content', composeText)) { // 'ctrl+enter' -> beam
          touchCtrlEnter();
          e.stopPropagation();
        }
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

  // useMediaSessionCallbacks({ play: toggleRecognition, pause: toggleRecognition });


  // Minimize

  const handleToggleMinimized = React.useCallback(() => setIsMinimized(hide => !hide), []);


  // Attachment Up

  const handleAttachCtrlV = React.useCallback(async (event: React.ClipboardEvent) => {
    if (await attachAppendDataTransfer(event.clipboardData, 'paste', false) === 'as_files')
      event.preventDefault();
  }, [attachAppendDataTransfer]);

  const handleAttachCameraImage = React.useCallback((file: FileWithHandle) => {
    void attachAppendFile('camera', file);
  }, [attachAppendFile]);

  const { openCamera, cameraCaptureComponent } = useCameraCaptureModal(handleAttachCameraImage);

  const handleAttachScreenCapture = React.useCallback((file: File) => {
    void attachAppendFile('screencapture', file);
  }, [attachAppendFile]);

  const handleAttachFiles = React.useCallback(async (files: FileWithHandle[], errorMessage: string | null) => {
    if (errorMessage)
      addSnackbar({ key: 'attach-files-open-fail', message: `Unable to open files: ${errorMessage}`, type: 'issue' });
    for (let file of files)
      await attachAppendFile('file-open', file)
        .catch((error: any) => addSnackbar({ key: 'attach-file-open-fail', message: `Unable to attach the file "${file.name}" (${error?.message || error?.toString() || 'unknown error'})`, type: 'issue' }));
  }, [attachAppendFile]);


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


  // Keyboard Shortcuts

  useGlobalShortcuts('ChatComposer.Gen', React.useMemo(() => [
    ...(assistantAbortible ? [{ key: ShortcutKey.Esc, action: handleStopClicked, description: 'Stop response', level: 2 }] : []),
  ], [assistantAbortible, handleStopClicked]));

  useGlobalShortcuts('ChatComposer', React.useMemo(() => {
    const composerShortcuts: ShortcutObject[] = [];
    if (showChatAttachments) {
      composerShortcuts.push({ key: 'f', ctrl: true, shift: true, action: () => openFileForAttaching(true, handleAttachFiles), description: 'Attach File' });
      if (supportsClipboardRead())
        composerShortcuts.push({ key: 'v', ctrl: true, shift: true, action: attachAppendClipboardItems, description: 'Attach Clipboard' });
    }
    if (recognitionState.isActive) {
      composerShortcuts.push({ key: 'm', ctrl: true, action: handleFinishMicAndSend, description: 'Mic · Send', disabled: !recognitionState.hasSpeech || sendStarted, endDecoratorIcon: TelegramIcon as any, level: 4 });
      composerShortcuts.push({
        key: ShortcutKey.Esc, action: () => {
          setMicContinuation(false);
          toggleRecognition(false);
        }, description: 'Mic · Stop', level: 4,
      });
    } else if (browserSpeechRecognitionCapability().mayWork)
      composerShortcuts.push({
        key: 'm', ctrl: true, action: () => {
          // steal focus from the textarea, in case it has - so that enter cannot work against us
          (document.activeElement as HTMLElement)?.blur?.();
          toggleRecognition(false);
        }, description: 'Microphone',
      });
    return composerShortcuts;
  }, [attachAppendClipboardItems, handleAttachFiles, handleFinishMicAndSend, recognitionState.hasSpeech, recognitionState.isActive, sendStarted, showChatAttachments, toggleRecognition]));


  // ...

  const isText = chatExecuteMode === 'generate-content';
  const isTextBeam = chatExecuteMode === 'beam-content';
  const isAppend = chatExecuteMode === 'append-user';
  const isReAct = chatExecuteMode === 'react-content';
  const isDraw = chatExecuteMode === 'generate-image';

  const showChatInReferenceTo = !!inReferenceTo?.length;
  const showChatExtras = isText && !showChatInReferenceTo;

  const sendButtonVariant: VariantProp = (isAppend || (isMobile && isTextBeam)) ? 'outlined' : 'solid';

  const sendButtonColor: ColorPaletteProp =
    assistantAbortible ? 'warning'
      : !llmAttachmentDraftsCollection.canAttachAllFragments ? 'warning'
        : chatExecuteModeSendColor;

  const sendButtonLabel = chatExecuteModeSendLabel;

  const sendButtonIcon =
    micContinuation ? null
      : isAppend ? <SendIcon sx={{ fontSize: 18 }} />
        : isReAct ? <PsychologyIcon />
          : isTextBeam ? <ChatBeamIcon /> /* <GavelIcon /> */
            : isDraw ? <FormatPaintTwoToneIcon />
              : <TelegramIcon />;

  const beamButtonColor: ColorPaletteProp | undefined =
    !llmAttachmentDraftsCollection.canAttachAllFragments ? 'warning'
      : undefined;

  // stable randomization of the /verb, between '/draw', '/react', '/browse'
  const placeholderAction = React.useMemo(() => {
    const actions: string[] = ['/react'];
    if (props.capabilityHasT2I) actions.push('/draw');
    if (hasComposerBrowseCapability) actions.push('/browse');
    return actions[Math.floor(Math.random() * actions.length)];
  }, [hasComposerBrowseCapability, props.capabilityHasT2I]);

  let textPlaceholder: string =
    isDraw ? 'Describe what you would like to see...'
      : isReAct ? 'Ask a multi-step reasoning question...'
        : isTextBeam ? 'Combine insights from multiple AI models...'
          : showChatInReferenceTo ? 'Chat about this...'
            : 'Type'
            + (props.isDeveloperMode ? ' · attach code' : '')
            + (isDesktop ? ` · drop ${props.isDeveloperMode ? 'source' : 'files'}` : '')
            + ` · ${placeholderAction}`
            + (recognitionState.isAvailable ? ' · ramble' : '')
            + '...';

  if (isDesktop && timeToShowTips) {
    if (explainShiftEnter)
      textPlaceholder += !enterIsNewline ? '\n\n💡 Shift + Enter to add a new line' : '\n\n💡 Shift + Enter to send';
    else if (explainAltEnter)
      textPlaceholder += platformAwareKeystrokes('\n\n💡 Tip: Alt + Enter to just append the message');
    else if (explainCtrlEnter)
      textPlaceholder += platformAwareKeystrokes('\n\n💡 Tip: Ctrl + Enter to beam');
  }

  const stableGridSx: SxProps = React.useMemo(() => ({
    // basically a position:relative to enable the inner drop area
    ...dragContainerSx,
    // This used to be in the outer box, but we put it here instead
    // p: { xs: 1, md: 2 },
  }), [dragContainerSx]);

  return (
    <Box aria-label='User Message' component='section' sx={props.sx}>

      {!isMobile && labsShowShortcutBar && <StatusBar toggleMinimized={handleToggleMinimized} isMinimized={isMinimized} />}

      {/* This container is here just to let the potential statusbar fill the whole space, so we moved the padding here and not in the parent */}
      <Box sx={(!isMinimized || isMobile || !labsShowShortcutBar) ? paddingBoxSx : minimizedSx}>

        <Grid
          container
          onDragEnter={handleContainerDragEnter}
          onDragStart={handleContainerDragStart}
          spacing={{ xs: 1, md: 2 }}
          sx={stableGridSx}
        >

          {/* [Mobile: top, Desktop: left] */}
          <Grid xs={12} md={9}><Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'stretch' }}>

            {/* [Mobile, Col1] Mic, Insert Multi-modal content, and Broadcast buttons */}
            {isMobile && (
              <Box sx={{ flexGrow: 0, display: 'grid', gap: 1 }}>

                {/* [mobile] Mic button */}
                {recognitionState.isAvailable && <ButtonMicMemo variant={micVariant} color={micColor} errorMessage={recognitionState.errorMessage} onClick={handleToggleMic} />}

                {/* Responsive Camera OCR button */}
                {showChatAttachments && <ButtonAttachCameraMemo isMobile onOpenCamera={openCamera} />}

                {/* [mobile] [+] button */}
                {showChatAttachments && (
                  <Dropdown>
                    <MenuButton slots={{ root: IconButton }}>
                      <AddCircleOutlineIcon />
                    </MenuButton>
                    <Menu>

                      {/* Responsive Open Files button */}
                      <MenuItem>
                        <ButtonAttachFilesMemo onAttachFiles={handleAttachFiles} fullWidth multiple />
                      </MenuItem>

                      {/* Responsive Paste button */}
                      {supportsClipboardRead() && <MenuItem>
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
            {isDesktop && showChatAttachments && (
              <Box sx={{ flexGrow: 0, display: 'grid', gap: (labsAttachScreenCapture && labsCameraDesktop) ? 0.5 : 1 }}>

                {/*<FormHelperText sx={{ mx: 'auto' }}>*/}
                {/*  Attach*/}
                {/*</FormHelperText>*/}

                {/* Responsive Open Files button */}
                <ButtonAttachFilesMemo onAttachFiles={handleAttachFiles} fullWidth multiple />

                {/* Responsive Paste button */}
                {supportsClipboardRead() && <ButtonAttachClipboardMemo onClick={attachAppendClipboardItems} />}

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
                    minRows={isMobile ? 4 : agiAttachmentPrompts.hasData ? 3 : showChatInReferenceTo ? 4 : 5}
                    maxRows={isMobile ? 8 : 10}
                    placeholder={textPlaceholder}
                    value={composeText}
                    onChange={handleTextareaTextChange}
                    onKeyDown={handleTextareaKeyDown}
                    onPasteCapture={handleAttachCtrlV}
                    // onFocusCapture={handleFocusModeOn}
                    // onBlurCapture={handleFocusModeOff}
                    endDecorator={
                      <ComposerTextAreaActions
                        agiAttachmentPrompts={agiAttachmentPrompts}
                        inReferenceTo={inReferenceTo}
                        onAppendAndSend={handleAppendTextAndSend}
                        onRemoveReferenceTo={handleRemoveInReferenceTo}
                      />
                    }
                    slotProps={{
                      textarea: {
                        enterKeyHint: enterIsNewline ? 'enter' : 'send',
                        sx: {
                          ...(recognitionState.isAvailable && { pr: { md: 5 } }),
                          // mb: 0.5, // no need; the outer container already has enough p (for TokenProgressbar)
                        },
                        ref: composerTextAreaRef,
                      },
                    }}
                    sx={{
                      backgroundColor: 'background.level1',
                      '&:focus-within': { backgroundColor: 'background.popup', '.within-composer-focus': { backgroundColor: 'background.popup' } },
                      lineHeight: lineHeightTextareaMd,
                    }} />

                  {!showChatInReferenceTo && tokenLimit > 0 && (tokensComposer > 0 || (tokensHistory + tokensResponseMax) > 0) && (
                    <TokenProgressbarMemo chatPricing={tokenChatPricing} direct={tokensComposer} history={tokensHistory} responseMax={tokensResponseMax} limit={tokenLimit} />
                  )}

                  {!showChatInReferenceTo && tokenLimit > 0 && (
                    <TokenBadgeMemo hideBelowDollars={0.0001} chatPricing={tokenChatPricing} direct={tokensComposer} history={tokensHistory} responseMax={tokensResponseMax} limit={tokenLimit} showCost={labsShowCost} enableHover={!isMobile} showExcess absoluteBottomRight />
                  )}

                </Box>

                {/* Mic & Mic Continuation Buttons */}
                {recognitionState.isAvailable && (
                  <Box sx={{
                    position: 'absolute', top: 0, right: 0,
                    zIndex: zIndexComposerOverlayMic + 1,
                    mt: isDesktop ? 1 : 0.25,
                    mr: isDesktop ? 1 : 0.25,
                    display: 'flex', flexDirection: 'column', gap: isDesktop ? 1 : 0.25,
                  }}>
                    {isDesktop && <ButtonMicMemo variant={micVariant} color={micColor} errorMessage={recognitionState.errorMessage} onClick={handleToggleMic} noBackground={!recognitionState.isActive} />}

                    {micIsRunning && (
                      <ButtonMicContinuationMemo
                        isActive={micContinuation}
                        variant={micContinuation ? 'soft' : 'soft'} color={micContinuation ? 'primary' : 'neutral'} sx={{ background: micContinuation ? undefined : 'none' }}
                        onClick={handleToggleMicContinuation}
                      />
                    )}
                  </Box>
                )}

                {/* overlay: Mic */}
                {micIsRunning && (
                  <Card
                    ref={micCardRef}
                    color='primary' variant='soft'
                    sx={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                      // alignItems: 'center', justifyContent: 'center',
                      border: '1px solid',
                      borderColor: 'primary.solidBg',
                      borderRadius: 'sm',
                      boxShadow: 'inset 1px 1px 4px -3px var(--joy-palette-primary-solidHoverBg)',
                      zIndex: zIndexComposerOverlayMic,
                      pl: 1.5,
                      pr: { xs: 1.5, md: 5 },
                      py: 0.625,
                      overflow: 'auto',
                      // '[data-joy-color-scheme="light"] &': {
                      //   backgroundColor: 'primary.50',
                      // },
                    }}>
                    <Typography sx={{
                      color: 'primary.softColor',
                      lineHeight: lineHeightTextareaMd,
                      '& > .preceding': {
                        color: 'primary.softDisabledColor',
                        // color: 'rgba(var(--joy-palette-primary-mainChannel) / 0.6)',
                        overflowWrap: 'break-word',
                        textWrap: 'wrap',
                        whiteSpaceCollapse: 'preserve',
                      },
                      '& > .interim': {
                        textDecoration: 'underline',
                        textDecorationThickness: '0.25em',
                        textDecorationColor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.1)',
                        textDecorationSkipInk: 'none',
                        textUnderlineOffset: '0.25em',
                      },
                      '& > .placeholder': {
                        fontStyle: 'italic',
                      },
                    }}>
                      {!!debouncedText && <span className='preceding'>{debouncedText.endsWith(' ') ? debouncedText : debouncedText + ' '}</span>}
                      {speechInterimResult.transcript}
                      <span className={speechInterimResult.interimTranscript === PLACEHOLDER_INTERIM_TRANSCRIPT ? 'placeholder' : 'interim'}>{speechInterimResult.interimTranscript}</span>
                    </Typography>
                  </Card>
                )}

              </Box>

              {/* Render any Attachments & menu items */}
              {!!conversationOverlayStore && showChatAttachments && (
                <LLMAttachmentsList
                  agiAttachmentPrompts={agiAttachmentPrompts}
                  attachmentDraftsStoreApi={conversationOverlayStore}
                  canInlineSomeFragments={llmAttachmentDraftsCollection.canInlineSomeFragments}
                  llmAttachmentDrafts={llmAttachmentDraftsCollection.llmAttachmentDrafts}
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
                      fullWidth
                      disabled={noConversation || noLLM}
                      loading={sendStarted}
                      loadingPosition='end'
                      onClick={handleSendClicked}
                      endDecorator={sendButtonIcon}
                      sx={{ '--Button-gap': '1rem' }}
                    >
                      {micContinuation && 'Voice '}{sendButtonLabel}
                    </Button>
                  ) : (
                    <Button
                      key='composer-stop'
                      fullWidth
                      variant='soft'
                      disabled={noConversation}
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
                  {isDraw && !!composeText && <Tooltip title='Generate an image prompt'>
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
                    color={beamButtonColor}
                    disabled={noConversation || noLLM}
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
                {showChatExtras && <ButtonCallMemo disabled={noConversation || noLLM || assistantAbortible} onClick={handleCallClicked} />}

                {/* [desktop] Draw Options secondary button */}
                {isDraw && <ButtonOptionsDraw onClick={handleDrawOptionsClicked} />}

              </Box>}

            </Box>
          </Grid>

          {/* overlay: Drag & Drop*/}
          {dropComponent}

        </Grid>

      </Box> {/* Padding container of the whole composer */}

      {/* Execution Mode Menu */}
      {chatExecuteMenuComponent}

      {/* Camera (when open) */}
      {cameraCaptureComponent}

      {/* Actile (when open) */}
      {actileComponent}

    </Box>
  );
}