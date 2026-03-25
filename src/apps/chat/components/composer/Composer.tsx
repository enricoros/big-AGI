import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Card, Chip, Grid, IconButton, Option, Select, Textarea, Typography } from '@mui/joy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import type { AppChatIntent } from '../../AppChat';
import { useChatAutoSuggestAttachmentPrompts, useChatMicTimeoutMsValue, useChatShowCallButton } from '../../store-app-chat';

import { useAgiAttachmentPrompts } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import { DLLM, getLLMContextTokens, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { llmChatPricing_adjusted } from '~/common/stores/llms/llms.pricing';
import { AudioGenerator } from '~/common/util/audio/AudioGenerator';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { ButtonAttachFilesMemo, openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { inferResumableCouncilSession } from '~/common/chat-overlay/ConversationHandler';
import { DMessageId, DMessageMetadata, DMetaReferenceItem, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import type { DConversationTurnTerminationMode } from '~/common/stores/chat/chat.conversation';
import { DConversationId, DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import { PhPaintBrush } from '~/common/components/icons/phosphor/PhPaintBrush';
import { ShortcutKey, ShortcutObject, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { animationEnterBelow } from '~/common/util/animUtils';
import { browserSpeechRecognitionCapability, PLACEHOLDER_INTERIM_TRANSCRIPT, SpeechResult, useSpeechRecognition } from '~/common/components/speechrecognition/useSpeechRecognition';
import { copyToClipboard, supportsClipboardRead } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, duplicateDMessageFragments } from '~/common/stores/chat/chat.fragments';
import { glueForMessageTokens, marshallWrapDocFragments } from '~/common/stores/chat/chat.tokens';
import { isValidConversation, useChatStore } from '~/common/stores/chat/store-chats';
import { getModelParameterValueWithFallback } from '~/common/stores/llms/llms.parameters';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';
import { launchAppCall, removeQueryParam, useRouterQuery } from '~/common/app.routes';
import { lineHeightTextareaMd, themeBgAppChatComposer } from '~/common/app.theme';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { supportsCameraCapture } from '~/common/components/camera/useCameraCapture';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useAttachHandler_CameraOpen, useAttachHandler_Files, useAttachHandler_PasteIntercept, useAttachHandler_ScreenCapture, useAttachHandler_UrlWebLinks } from '~/common/attachment-drafts/attachment-sources/useAttachmentSourceHandlers';
import { useChatComposerOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';
import { useComposerStartupText, useLogicSherpaStore } from '~/common/logic/store-logic-sherpa';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useUICounter, useUIPreferencesStore } from '~/common/stores/store-ui';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';
import { findParticipantMentionMatchIndex, getParticipantAccentColor, getParticipantAccentSx } from '~/common/util/dMessageUtils';

import type { ActileItem } from './actile/ActileProvider';
import { providerAttachmentLabels } from './actile/providerAttachmentLabels';
import { providerCommands } from './actile/providerCommands';
import { providerMentions } from './actile/providerMentions';
import { matchOpenMentionAtEnd } from './actile/providerMentions.utils';
import { providerStarredMessages, StarredMessageItem } from './actile/providerStarredMessage';
import { useActileManager } from './actile/useActileManager';

import type { AttachmentDraftId, AttachmentDraftsAction } from '~/common/attachment-drafts/attachment.types';
import { AttachmentSourcesMemo } from '~/common/attachment-drafts/attachment-sources/AttachmentSources';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useAttachmentDraftsEnrichment } from '~/common/attachment-drafts/llm-enrichment/useAttachmentDraftsEnrichment';
import { useGoogleDrivePicker } from '~/common/attachment-drafts/attachment-sources/useGoogleDrivePicker';

import type { ChatExecuteMode } from '../../execute-mode/execute-mode.types';
import { chatExecuteModeCanAttach, useChatExecuteMode } from '../../execute-mode/useChatExecuteMode';

import { ButtonBeamMemo } from './buttons/ButtonBeam';
import { ButtonCallMemo } from './buttons/ButtonCall';
import { ButtonGroupDrawRepeat } from './buttons/ButtonGroupDrawRepeat';
import { ButtonMicContinuationMemo } from './buttons/ButtonMicContinuation';
import { ButtonMicMemo } from './buttons/ButtonMic';
import { ButtonMultiChatMemo } from './buttons/ButtonMultiChat';
import { ButtonOptionsDraw } from './buttons/ButtonOptionsDraw';
import {
  getComposerActionBarState,
  getComposerCouncilPrimarySendMode,
  getComposerInterruptionPolicy,
  getComposerResumeLabel,
  getComposerSessionRoundLabel,
  getComposerSessionStatusLabel,
  getComposerThreadTargetDisplay,
  getComposerTurnModeDisplayPolicy,
} from './Composer.controls';
import { ComposerAttachmentDraftsList } from './llmattachments/ComposerAttachmentDraftsList';
import { ComposerTextAreaActions } from './textarea/ComposerTextAreaActions';
import { ComposerTextAreaDrawActions } from './textarea/ComposerTextAreaDrawActions';
import { StatusBarMemo } from '../StatusBar';
import { TokenBadgeMemo } from './tokens/TokenBadge';
import { TokenProgressbarMemo } from './tokens/TokenProgressbar';
import { useComposerDragDrop } from './useComposerDragDrop';
import { useTextTokenCount } from './tokens/useTextTokenCounter';


// configuration
const zIndexComposerOverlayMic = 10;
const SHOW_TIPS_AFTER_RELOADS = 25;


const paddingBoxSx: SxProps = {
  p: { xs: 1, md: 2 },
};


const minimizedSx: SxProps = {
  ...paddingBoxSx,
  display: 'none',
};

const stackedLifecycleButtonGroupSx: SxProps = {
  width: '100%',
  minWidth: 0,
  overflow: 'hidden',
  '--ButtonGroup-radius': 'var(--Button-radius, var(--joy-radius-sm))',
  '--ButtonGroup-connected': 1,
  '--ButtonGroup-separatorColor': 'rgb(var(--joy-palette-neutral-mainChannel) / 0.18)',
  '--ButtonGroup-separatorSize': '1px',
  borderRadius: 'var(--ButtonGroup-radius)',
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.surface',
  boxShadow: 'sm',
  '& > .MuiButton-root': {
    flex: 1,
    minWidth: 0,
    borderRadius: 0,
  },
  '& > .MuiIconButton-root': {
    flex: '0 0 auto',
    minWidth: '2.5rem',
    width: '2.5rem',
    aspectRatio: '1 / 1',
    borderRadius: 0,
  },
};

const stackedLifecycleActionButtonSx: SxProps = {
  minWidth: 0,
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  '--Button-gap': '0.25rem',
  px: 0.875,
  fontWeight: 'md',
  fontSize: 'sm',
};

const stackedLifecycleExpanderButtonSx: SxProps = {
  color: 'text.secondary',
};


/**
 * A React component for composing messages, with attachments and different modes.
 */
export function Composer(props: {
  isMobile: boolean;
  chatLLM: DLLM | null;
  composerTextAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  targetConversationId: DConversationId | null;
  participants?: DConversationParticipant[];
  capabilityHasT2I: boolean;
  capabilityHasT2IEdit: boolean;
  isMulticast: boolean | null;
  isDeveloperMode: boolean;
  onAction: (conversationId: DConversationId, sendMode: 'steer' | 'queue', chatExecuteMode: ChatExecuteMode, fragments: (DMessageContentFragment | DMessageAttachmentFragment)[], metadata?: DMessageMetadata) => boolean;
  onStopConversation: (conversationId: DConversationId) => void;
  onResumeCouncilSession: (conversationId: DConversationId) => Promise<boolean>;
  onConversationBeamEdit: (conversationId: DConversationId, editMessageId?: DMessageId) => Promise<void>;
  onConversationsImportFromFiles: (files: File[]) => Promise<void>;
  onTextImagine: (conversationId: DConversationId, text: string) => void;
  setIsMulticast: (on: boolean) => void;
  onComposerHasContent: (hasContent: boolean) => void;
  sx?: SxProps;
}) {

  // state
  const [composeText, setComposeText] = React.useState('');
  const [drawRepeat, setDrawRepeat] = React.useState(1);
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
  const { labsComposerAttachmentsInline, labsShowShortcutBar } = useUXLabsStore(useShallow(state => ({
    labsComposerAttachmentsInline: state.labsComposerAttachmentsInline,
    labsShowShortcutBar: state.labsShowShortcutBar,
  })));
  const timeToShowTips = useLogicSherpaStore(state => state.usageCount >= SHOW_TIPS_AFTER_RELOADS);
  const { novel: explainShiftEnter, touch: touchShiftEnter } = useUICounter('composer-shift-enter');
  const { novel: explainAltEnter, touch: touchAltEnter } = useUICounter('composer-alt-enter');
  const { novel: explainCtrlEnter, touch: touchCtrlEnter } = useUICounter('composer-ctrl-enter');
  const { novel: explainCtrlShiftEnter, touch: touchCtrlShiftEnter } = useUICounter('composer-ctrl-shift-enter');
  const [startupText, setStartupText] = useComposerStartupText();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);
  const composerQuickButton = useUIPreferencesStore(state => state.composerQuickButton);
  const [showCallButton] = useChatShowCallButton();
  const chatMicTimeoutMs = useChatMicTimeoutMsValue();
  const { assistantAbortible, conversation, systemPurposeId, turnTerminationMode, tokenCount: _historyTokenCount, abortConversationTemp } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.targetConversationId);
    const turnTerminationMode: DConversationTurnTerminationMode = conversation?.turnTerminationMode === 'continuous'
      ? 'continuous'
      : conversation?.turnTerminationMode === 'council'
        ? 'council'
        : 'round-robin-per-human';
    return {
      assistantAbortible: conversation ? !!conversation._abortController : false,
      conversation: conversation ?? null,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      turnTerminationMode,
      tokenCount: conversation ? conversation.tokenCount : 0,
      abortConversationTemp: state.abortConversationTemp,
    };
  }));
  const { llms: visibleLLMs } = useVisibleLLMs(props.chatLLM?.id ?? null, false, true);

  // external overlay state (extra conversationId-dependent state)
  const conversationOverlayStore = props.targetConversationId
    ? ConversationsManager.getHandler(props.targetConversationId)?.conversationOverlayStore ?? null
    : null;
  const overlayCouncilSession = useChatComposerOverlayStore(conversationOverlayStore, store => store.councilSession);
  const councilSession = React.useMemo(() => {
    if (overlayCouncilSession.status === 'running' || overlayCouncilSession.canResume)
      return overlayCouncilSession;

    const inferredCouncilSession = inferResumableCouncilSession(conversation);
    return inferredCouncilSession ?? overlayCouncilSession;
  }, [conversation, overlayCouncilSession]);

  // composer-overlay: for the in-reference-to state, comes from the conversation overlay
  const allowInReferenceTo = chatExecuteMode === 'generate-content';
  const inReferenceTo = useChatComposerOverlayStore(conversationOverlayStore, store => allowInReferenceTo ? store.inReferenceTo : null);
  const composerDraftText = useChatComposerOverlayStore(conversationOverlayStore, store => store.composerDraftText);

  // LLM-derived
  const noLLM = !props.chatLLM;
  const chatLLMSupportsImages = !!props.chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);

  // don't load URLs if the user is typing a command or there's no capability
  const browseCapability = useBrowseCapability();
  const enableLoadURLsInComposer = browseCapability.inComposer && !composeText.startsWith('/');

  // user message for attachments
  const { onConversationBeamEdit, onConversationsImportFromFiles } = props;
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
  const showChatAttachments = chatExecuteModeCanAttach(chatExecuteMode, props.capabilityHasT2IEdit);
  const {
    /* items */ attachmentDrafts,
    /* append */ attachAppendClipboardItems, attachAppendCloudFile, attachAppendDataTransfer, attachAppendEgoFragments, attachAppendFile, attachAppendUrl,
    /* take */ attachmentsRemoveAll, attachmentsTakeAllFragments, attachmentsTakeFragmentsByType,
  } = useAttachmentDrafts(conversationOverlayStore, enableLoadURLsInComposer, chatLLMSupportsImages, handleFilterAGIFile, showChatAttachments === 'only-images');

  // attachments derived state
  const { enrichment: attEnrichment, summary: attEnrichSummary } = useAttachmentDraftsEnrichment(attachmentDrafts, props.chatLLM, chatLLMSupportsImages);

  // drag/drop
  const { dragContainerSx, dropComponent, handleContainerDragEnter, handleContainerDragStart } = useComposerDragDrop(!props.isMobile, attachAppendDataTransfer);

  // ai functions
  const agiAttachmentPrompts = useAgiAttachmentPrompts(useChatAutoSuggestAttachmentPrompts(), attachmentDrafts);


  // derived state

  const { composerTextAreaRef, targetConversationId, onAction, onStopConversation, onTextImagine } = props;
  const assistantParticipants = React.useMemo(() => (props.participants ?? []).filter(participant => participant.kind === 'assistant'), [props.participants]);
  const leaderParticipant = React.useMemo(() => assistantParticipants.find(participant => participant.isLeader) ?? assistantParticipants[0] ?? null, [assistantParticipants]);
  const composerThreadTargetDisplay = React.useMemo(() => getComposerThreadTargetDisplay(turnTerminationMode), [turnTerminationMode]);
  const selectedThreadPromptLabel = composerThreadTargetDisplay.promptLabel;
  const mentionOnlyParticipants = React.useMemo(() => assistantParticipants.filter(participant => participant.speakWhen === 'when-mentioned' && !!participant.name?.trim()), [assistantParticipants]);
  const hasAllMention = React.useMemo(() => /(^|[^\w])@all(?=$|[^\w])/i.test(composeText.trim()), [composeText]);
  const mentionedParticipants = React.useMemo(() => {
    const currentText = composeText.trim();
    if (!currentText)
      return [] as DConversationParticipant[];

    if (hasAllMention)
      return mentionOnlyParticipants;

    return mentionOnlyParticipants.filter(participant => findParticipantMentionMatchIndex(currentText, participant.name) !== null);
  }, [composeText, hasAllMention, mentionOnlyParticipants]);
  const isMobile = props.isMobile;
  const isDesktop = !props.isMobile;
  const noConversation = !targetConversationId;

  const composerTextSuffix = chatExecuteMode === 'generate-image' && isDesktop && drawRepeat > 1 ? ` x${drawRepeat}` : '';
  const composerThreadMetadata = React.useMemo<DMessageMetadata | undefined>(() => {
    if (chatExecuteMode !== 'generate-content')
      return undefined;

    return {
      councilChannel: { channel: 'public-board' },
      initialRecipients: [{ rt: 'public-board' }],
    };
  }, [chatExecuteMode]);

  const micIsRunning = !!speechInterimResult;
  // more mic way below, as we use complex hooks



  // tokens derived state

  const tokensComposerTextDebounced = useTextTokenCount(composeText, props.chatLLM, 800, 1600);
  let tokensComposer = (tokensComposerTextDebounced ?? 0) + (attEnrichSummary.totalTokensApprox || 0);
  if (props.chatLLM && tokensComposer > 0)
    tokensComposer += glueForMessageTokens(props.chatLLM);
  const tokensHistory = _historyTokenCount;
  const tokensResponseMax = getModelParameterValueWithFallback('llmResponseTokens', props.chatLLM?.initialParameters, props.chatLLM?.userParameters, 0) ?? 0 /* if null, assume 0*/;
  const tokenLimit = getLLMContextTokens(props.chatLLM) ?? 0;
  const tokenChatPricing = React.useMemo(() => llmChatPricing_adjusted(props.chatLLM), [props.chatLLM]);


  // Effect: load initial text if queued up (e.g. by /link/share_targetF)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [setComposeText, setStartupText, startupText]);

  // Effect: notify the parent of presence/absence of content
  const isContentful = composeText.length > 0 || !!attachmentDrafts.length;
  const { onComposerHasContent } = props;
  React.useEffect(() => {
    onComposerHasContent?.(isContentful);
  }, [isContentful, onComposerHasContent]);


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
  React.useEffect(() => {
    if (!composerDraftText)
      return;

    setComposeText(current => current
      ? `${current}${/\s$/.test(current) ? '' : ' '}${composerDraftText}`
      : composerDraftText);
    conversationOverlayStore?.getState().clearComposerDraftText();
    setTimeout(() => composerTextAreaRef.current?.focus(), 1);
  }, [composerDraftText, composerTextAreaRef, conversationOverlayStore]);


  // Confirmation Modals

  const confirmProceedIfAttachmentsNotSupported = React.useCallback(async (): Promise<boolean> => {
    if (attEnrichSummary.allCompatible) return true;
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
  }, [attEnrichSummary.allCompatible, showPromisedOverlay]);


  // Primary button

  const _handleClearText = React.useCallback(() => {
    setComposeText('');
    attachmentsRemoveAll();
    handleInReferenceToClear();
  }, [attachmentsRemoveAll, handleInReferenceToClear, setComposeText]);

  const _handleSendActionUnguarded = React.useCallback(async (
    sendMode: 'steer' | 'queue',
    _chatExecuteMode: ChatExecuteMode,
    composerText: string,
    metadataOverrides?: Partial<DMessageMetadata>,
  ): Promise<boolean> => {
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
      fragments.push(createTextContentFragment(composerText + composerTextSuffix));

    const canAttach = chatExecuteModeCanAttach(_chatExecuteMode, props.capabilityHasT2IEdit);
    if (canAttach) {
      const attachmentFragments = await attachmentsTakeAllFragments('global', 'app-chat');
      fragments.push(...attachmentFragments);
    }

    if (!fragments.length) {
      // addSnackbar({ key: 'chat-composer-empty', message: 'Please enter a message or attach files.', type: 'info' });
      return false;
    }

    // prepare the metadata
    const metadata = {
      ...(inReferenceTo?.length ? { inReferenceTo: inReferenceTo } : {}),
      ...(composerThreadMetadata ? composerThreadMetadata : {}),
      ...(metadataOverrides ? metadataOverrides : {}),
    } satisfies DMessageMetadata;

    // send the message - NOTE: if successful, the ownership of the fragments is transferred to the receiver, so we just clear them
    const enqueued = onAction(targetConversationId, sendMode, _chatExecuteMode, fragments, metadata);
    if (enqueued)
      _handleClearText();
    return enqueued;
  }, [targetConversationId, confirmProceedIfAttachmentsNotSupported, composerTextSuffix, props.capabilityHasT2IEdit, inReferenceTo, composerThreadMetadata, onAction, _handleClearText, attachmentsTakeAllFragments]);

  const handleSendAction = React.useCallback(async (
    sendMode: 'steer' | 'queue',
    chatExecuteMode: ChatExecuteMode,
    composerText: string,
    metadataOverrides?: Partial<DMessageMetadata>,
  ): Promise<boolean> => {
    setSendStarted(true);
    const enqueued = await _handleSendActionUnguarded(sendMode, chatExecuteMode, composerText, metadataOverrides);
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
      void handleSendAction('steer', chatExecuteMode, nextText); // fire/forget
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
    await handleSendAction('steer', chatExecuteMode, newText);
  }, [chatExecuteMode, composeText, handleSendAction, setComposeText]);

  const handleFinishMicAndSend = React.useCallback(() => {
    if (!sendStarted) {
      setSendStarted(true);
      toggleRecognition(true);
    }
  }, [sendStarted, toggleRecognition]);

  const handleSendClicked = React.useCallback(async (sendMode: 'steer' | 'queue' = 'steer'): Promise<boolean> => {
    // Auto-send as soon as the mic is done
    if (recognitionState.isActive) {
      handleFinishMicAndSend();
      return false;
    }
    // Safety option
    if (micIsRunning) {
      addSnackbar({ key: 'chat-mic-running', message: 'Please wait for the microphone to finish.', type: 'info' });
      return false;
    }
    return await handleSendAction(sendMode, chatExecuteMode, composeText); // 'chat/write/...' button
  }, [chatExecuteMode, composeText, handleFinishMicAndSend, handleSendAction, micIsRunning, recognitionState.isActive]);

  const handleSendToChatClicked = React.useCallback(async (): Promise<boolean> => {
    if (recognitionState.isActive || micIsRunning) {
      addSnackbar({ key: 'chat-mic-running', message: 'Please wait for the microphone to finish.', type: 'info' });
      return false;
    }
    if (!leaderParticipant)
      return false;

    return await handleSendAction(
      assistantAbortible ? 'queue' : 'steer',
      'generate-content',
      composeText,
      {
        initialRecipients: [{ rt: 'participant', participantId: leaderParticipant.id }],
      },
    );
  }, [assistantAbortible, composeText, handleSendAction, leaderParticipant, micIsRunning, recognitionState.isActive]);

  const handleSendTextBeamClicked = React.useCallback(async () => {
    if (micIsRunning) {
      addSnackbar({ key: 'chat-mic-running', message: 'Please wait for the microphone to finish.', type: 'info' });
      return;
    }
    if (composeText) {
      await handleSendAction('steer', 'beam-content', composeText); // 'beam' button
    } else {
      if (targetConversationId)
        void onConversationBeamEdit(targetConversationId); // beam-edit conversation
    }
  }, [composeText, handleSendAction, micIsRunning, onConversationBeamEdit, targetConversationId]);

  const interruptionPolicy = getComposerInterruptionPolicy({
    assistantAbortible,
    assistantParticipantCount: props.participants?.filter(participant => participant.kind === 'assistant').length ?? 0,
    chatExecuteMode,
    councilSessionCanResume: councilSession.canResume,
    councilSessionStatus: councilSession.status,
    hasTargetConversationId: !!targetConversationId,
    turnTerminationMode: turnTerminationMode as DConversationTurnTerminationMode,
  });
  const councilSessionStatus = councilSession.status;
  const councilSessionStatusLabel = getComposerSessionStatusLabel(
    turnTerminationMode as DConversationTurnTerminationMode,
    councilSessionStatus,
    councilSession.interruptionReason,
  );
  const councilSessionRoundLabel = getComposerSessionRoundLabel(
    turnTerminationMode as DConversationTurnTerminationMode,
    councilSession.passIndex,
  );
  const councilLeaderPrimarySend = getComposerCouncilPrimarySendMode({
    assistantAbortible,
    assistantParticipantCount: assistantParticipants.length,
    chatExecuteMode,
    turnTerminationMode: turnTerminationMode as DConversationTurnTerminationMode,
  });
  const isCouncilSession = interruptionPolicy.isCouncilSession;
  const hasInlineLifecycleButtons = interruptionPolicy.showPause || interruptionPolicy.showStop || interruptionPolicy.showResume;
  const stackInlineLifecycleButtons = hasInlineLifecycleButtons;

  const handleStopClicked = React.useCallback(() => {
    if (!targetConversationId)
      return;
    onStopConversation(targetConversationId);
    const cHandler = ConversationsManager.getHandler(targetConversationId);
    if (interruptionPolicy.stopAction === 'abort-active-stop')
      cHandler.abortActive('@stop');
    else if (interruptionPolicy.stopAction === 'abort-conversation-temp')
      abortConversationTemp(targetConversationId);
  }, [abortConversationTemp, interruptionPolicy.stopAction, onStopConversation, targetConversationId]);

  const handlePauseClicked = React.useCallback(() => {
    if (!targetConversationId || interruptionPolicy.pauseAction !== 'abort-active-pause')
      return;
    ConversationsManager.getHandler(targetConversationId).abortActive('@pause');
  }, [interruptionPolicy.pauseAction, targetConversationId]);

  const handleResumeClicked = React.useCallback(async () => {
    if (!targetConversationId)
      return;
    setSendStarted(true);
    try {
      await props.onResumeCouncilSession(targetConversationId);
    } finally {
      setSendStarted(false);
    }
  }, [props, targetConversationId]);


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

  const onActileMentionPaste = React.useCallback(({ label }: ActileItem, searchPrefix: string) => {
    if (composerTextAreaRef.current) {
      const textArea = composerTextAreaRef.current;
      const currentText = textArea.value;
      const cursorPos = textArea.selectionStart;
      const textUntilCursor = currentText.slice(0, cursorPos);
      const mentionMatch = matchOpenMentionAtEnd(textUntilCursor);
      if (!mentionMatch)
        return;

      const mentionStart = cursorPos - mentionMatch[0].length + (mentionMatch[0].startsWith(' ') ? 1 : 0);
      setComposeText((prevText) => prevText.substring(0, mentionStart) + label + ' ' + prevText.substring(cursorPos));

      const newCursorPos = mentionStart + label.length + 1;
      setTimeout(() => composerTextAreaRef.current?.setSelectionRange(newCursorPos, newCursorPos), 0);
    }
  }, [composerTextAreaRef, setComposeText]);

  const onActileEmbedMessage = React.useCallback(async ({ conversationId, messageId }: StarredMessageItem) => {
    // get the message
    const cHandler = ConversationsManager.getHandler(conversationId);
    const messageToEmbed = cHandler.historyFindMessageOrThrow(messageId);
    if (messageToEmbed) {
      const fragmentsCopy = duplicateDMessageFragments(messageToEmbed.fragments, true); // [attach] deep copy a message's fragments to attach to ego
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
    providerMentions(assistantParticipants, onActileMentionPaste),
    providerStarredMessages(onActileEmbedMessage),
  ], [assistantParticipants, conversationOverlayStore, onActileCommandPaste, onActileEmbedMessage, onActileMentionPaste]);

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

    if ((e.key === 'Backspace' || e.key === 'Delete') && !composeText && inReferenceTo?.length) {
      handleInReferenceToClear();
      return e.preventDefault();
    }

    // Enter: primary action
    if (e.key === 'Enter') {
      // Skip if composing (e.g., CJK input methods) - issue #784
      if (e.nativeEvent.isComposing)
        return;

      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (await handleSendAction('steer', 'append-user', composeText)) // 'alt+enter' -> write
          touchAltEnter();
        return e.preventDefault();
      }

      if (councilLeaderPrimarySend) {
        if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (await handleSendClicked('steer')) {
            touchCtrlEnter();
            e.stopPropagation();
          }
          return e.preventDefault();
        }

        if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          touchShiftEnter();
          return;
        }

        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (await handleSendToChatClicked())
            e.stopPropagation();
          return e.preventDefault();
        }
      }

      // Ctrl (Windows) + Enter: queue the message behind the current turn
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (await handleSendClicked('queue')) {
          touchCtrlEnter();
          e.stopPropagation();
        }
        return e.preventDefault();
      }

      // Ctrl + Shift + Enter: steer the current turn once it finishes the current response chunk
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey) {
        if (await handleSendClicked('steer')) {
          touchCtrlShiftEnter();
          e.stopPropagation();
        }
        return e.preventDefault();
      }

      // Shift: toggles the 'enter is newline'
      if (e.shiftKey)
        touchShiftEnter();
      if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
        await handleSendClicked('steer'); // enter -> steer/send
        return e.preventDefault();
      }
    }

  }, [actileInterceptKeydown, composeText, councilLeaderPrimarySend, enterIsNewline, handleInReferenceToClear, handleSendAction, handleSendClicked, handleSendToChatClicked, inReferenceTo?.length, touchAltEnter, touchCtrlEnter, touchCtrlShiftEnter, touchShiftEnter]);


  // Focus mode

  // const handleFocusModeOn = React.useCallback(() => setIsFocusedMode(true), [setIsFocusedMode]);

  // const handleFocusModeOff = React.useCallback(() => setIsFocusedMode(false), [setIsFocusedMode]);

  // useMediaSessionCallbacks({ play: toggleRecognition, pause: toggleRecognition });


  // Minimize

  const handleToggleMinimized = React.useCallback(() => setIsMinimized(hide => !hide), []);


  // Attachments Up

  const handleAttachCtrlV = useAttachHandler_PasteIntercept(attachAppendDataTransfer);
  const handleAttachFiles = useAttachHandler_Files(attachAppendFile);
  const handleOpenCamera = useAttachHandler_CameraOpen(attachAppendFile);
  const handleAttachScreenCapture = useAttachHandler_ScreenCapture(attachAppendFile);
  const { openWebInputDialog, webInputDialogComponent } = useAttachHandler_UrlWebLinks(attachAppendUrl, composeText);
  const { openGoogleDrivePicker, googleDrivePickerComponent } = useGoogleDrivePicker(attachAppendCloudFile, isMobile);


  // Attachments Down

  const handleAttachmentDraftsAction = React.useCallback((attachmentDraftIdOrAll: AttachmentDraftId | null, action: AttachmentDraftsAction) => {
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
    ...(assistantAbortible
      ? [{
        key: ShortcutKey.Esc,
        action: turnTerminationMode === 'council' ? handlePauseClicked : handleStopClicked,
        description: turnTerminationMode === 'council' ? 'Pause council' : 'Stop response',
        level: 2,
      }]
      : []),
  ], [assistantAbortible, handlePauseClicked, handleStopClicked, turnTerminationMode]));

  useGlobalShortcuts('ChatComposer', React.useMemo(() => {
    const composerShortcuts: ShortcutObject[] = [];
    if (showChatAttachments) {
      composerShortcuts.push({ key: 'f', ctrl: true, shift: true, action: () => openFileForAttaching(true, handleAttachFiles), description: 'Attach File' });
      composerShortcuts.push({ key: 'l', ctrl: true, shift: true, action: openWebInputDialog, description: 'Attach Link' });
      if (supportsClipboardRead())
        composerShortcuts.push({ key: 'v', ctrl: true, shift: true, action: attachAppendClipboardItems, description: 'Attach Clipboard' });
      // Future: keep reactive state here to support Live Screen Capture and more
      // if (supportsScreenCapture)
      //   composerShortcuts.push({ key: 's', ctrl: true, shift: true, action: openScreenCaptureDialog, description: 'Attach Screen Capture' });
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
  }, [attachAppendClipboardItems, handleAttachFiles, handleFinishMicAndSend, openWebInputDialog, recognitionState.hasSpeech, recognitionState.isActive, sendStarted, showChatAttachments, toggleRecognition]));


  // ...

  const isText = chatExecuteMode === 'generate-content';
  const isTextBeam = chatExecuteMode === 'beam-content';
  const isAppend = chatExecuteMode === 'append-user';
  const isReAct = chatExecuteMode === 'react-content';
  const isDraw = chatExecuteMode === 'generate-image';

  const showChatInReferenceTo = !!inReferenceTo?.length;
  const showChatExtras = isText && !showChatInReferenceTo && !assistantAbortible && composerQuickButton !== 'off';

  const actionBarState = getComposerActionBarState({
    allAttachmentsCompatible: attEnrichSummary.allCompatible,
    assistantAbortible,
    assistantParticipantCount: assistantParticipants.length,
    chatExecuteMenuShown,
    chatExecuteMode,
    chatExecuteModeSendColor,
    chatExecuteModeSendLabel,
    isMobile,
    micContinuation,
    turnTerminationMode: turnTerminationMode as DConversationTurnTerminationMode,
  });
  const sendButtonVariant: VariantProp = actionBarState.sendButtonVariant;
  const sendButtonColor: ColorPaletteProp = actionBarState.sendButtonColor as ColorPaletteProp;
  const showQueueSendAction = actionBarState.showQueueSendAction;
  const primarySendButtonLabel = actionBarState.primarySendButtonLabel;
  const secondarySendButtonLabel = actionBarState.secondarySendButtonLabel;
  const turnModeChip = actionBarState.turnModeChip;
  const turnModeDisplay = getComposerTurnModeDisplayPolicy(isMobile, !!turnModeChip);

  const sendButtonIcon =
    actionBarState.primaryIcon === null ? null
      : actionBarState.primaryIcon === 'send' ? <SendIcon sx={{ fontSize: 18 }} />
        : actionBarState.primaryIcon === 'psychology' ? <PsychologyIcon />
          : actionBarState.primaryIcon === 'beam' ? <ChatBeamIcon />
            : actionBarState.primaryIcon === 'paintbrush' ? <PhPaintBrush />
              : <TelegramIcon />;

  const beamButtonColor: ColorPaletteProp | undefined =
    !attEnrichSummary.allCompatible ? 'warning'
      : undefined;

  const showTint: ColorPaletteProp | undefined = isDraw ? 'warning' : isReAct ? 'success' : undefined;

  const lifecycleButtons = (
    <>
      {interruptionPolicy.showPause && (
        <Button
          key='composer-pause'
          variant='soft'
          color='warning'
          disabled={noConversation}
          onClick={handlePauseClicked}
          endDecorator={stackInlineLifecycleButtons ? undefined : <PauseCircleOutlineIcon sx={{ fontSize: 18 }} />}
          sx={{
            animation: `${animationEnterBelow} 0.1s ease-out`,
            ...(stackInlineLifecycleButtons ? stackedLifecycleActionButtonSx : {}),
          }}
        >
          Pause
        </Button>
      )}

      {interruptionPolicy.showStop && (
        <Button
          key='composer-stop'
          variant='soft'
          color='danger'
          disabled={noConversation}
          onClick={handleStopClicked}
          endDecorator={stackInlineLifecycleButtons ? undefined : <StopOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{
            animation: `${animationEnterBelow} 0.1s ease-out`,
            ...(stackInlineLifecycleButtons ? stackedLifecycleActionButtonSx : {}),
          }}
        >
          Stop
        </Button>
      )}

      {interruptionPolicy.showResume && (
        <Button
          key='composer-resume'
          variant='soft'
          color='success'
          loading={sendStarted}
          onClick={() => void handleResumeClicked()}
          endDecorator={stackInlineLifecycleButtons ? undefined : <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />}
          sx={{
            animation: `${animationEnterBelow} 0.1s ease-out`,
            ...(stackInlineLifecycleButtons ? stackedLifecycleActionButtonSx : {}),
          }}
        >
          {getComposerResumeLabel(
            turnTerminationMode as DConversationTurnTerminationMode,
            props.participants?.filter(participant => participant.kind === 'assistant').length ?? 0,
          )}
        </Button>
      )}
    </>
  );

  const modeExpanderButton = (
    <IconButton
      key='composer-expander'
      variant={stackInlineLifecycleButtons ? 'soft' : actionBarState.expanderVariant ?? undefined}
      color={stackInlineLifecycleButtons ? 'neutral' : undefined}
      disabled={noConversation /*|| chatExecuteMenuShown*/}
      onClick={showChatExecuteMenu}
      sx={stackInlineLifecycleButtons ? stackedLifecycleExpanderButtonSx : undefined}
    >
      <ExpandLessIcon />
    </IconButton>
  );

  const placeholderAction = React.useMemo(() => {
    const actions: string[] = ['/react'];
    if (props.capabilityHasT2I) actions.push('/draw');
    return actions[Math.floor(Math.random() * actions.length)];
  }, [props.capabilityHasT2I]);

  let textPlaceholder: string =
    (isDraw ? 'Describe what you would like to see...'
      : isReAct ? 'Ask a multi-step reasoning question...'
        : isTextBeam ? 'Combine insights from multiple AI models...'
          : showChatInReferenceTo ? 'Chat about this...'
            : mentionOnlyParticipants.length
              ? `Message ${selectedThreadPromptLabel.toLowerCase()}…\nMention ${mentionOnlyParticipants.slice(0, 2).map(participant => `@${participant.name.trim()}`).join(' or ')} to trigger mention-only agents.`
              : `Message ${selectedThreadPromptLabel.toLowerCase()}`)
    + (isDesktop ? ` · drop ${props.isDeveloperMode ? 'source' : 'files'}` : '')
    + ` · ${placeholderAction}`
    + (recognitionState.isAvailable ? ' · ramble' : '')
    + '...';

  if (isDesktop && councilLeaderPrimarySend && !isDraw) {
    textPlaceholder += platformAwareKeystrokes('\n\n➤ Enter sends to leader · Ctrl + Enter sends to council');
    textPlaceholder += '\n\n⏎ Shift + Enter adds a new line';
  } else if (isDesktop && assistantAbortible && !isDraw) {
    textPlaceholder += platformAwareKeystrokes('\n\n⏳ Ctrl + Enter queues your message');
  }

  if (isDesktop && timeToShowTips && !isDraw && !councilLeaderPrimarySend) {
    if (explainShiftEnter)
      textPlaceholder += !enterIsNewline ? '\n\n⏎ Shift + Enter to add a new line' : '\n\n➤ Shift + Enter to send';
    else if (explainCtrlEnter && !assistantAbortible)
      textPlaceholder += platformAwareKeystrokes('\n\n⏳ Tip: Ctrl + Enter queues your message');
    else if (explainCtrlShiftEnter)
      textPlaceholder += platformAwareKeystrokes('\n\n➤ Tip: Ctrl + Shift + Enter steers next');
  }

  const stableGridSx: SxProps = React.useMemo(() => ({
    // basically a position:relative to enable the inner drop area
    ...dragContainerSx,
    // This used to be in the outer box, but we put it here instead
    // p: { xs: 1, md: 2 },
  }), [dragContainerSx]);

  return (
    <Box
      aria-label='New Message'
      component='section'
      bgcolor={showTint ? `var(--joy-palette-${showTint}-softBg)` : themeBgAppChatComposer}
      sx={props.sx}
    >

      {!isMobile && labsShowShortcutBar && <StatusBarMemo toggleMinimized={handleToggleMinimized} isMinimized={isMinimized} />}

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
              <Box sx={{ flexGrow: 0, display: 'grid', gap: 1, alignSelf: 'flex-start' }}>

                {/* [mobile] Mic button */}
                {recognitionState.isAvailable && <ButtonMicMemo variant={micVariant} color={micColor === 'danger' ? 'danger' : showTint || micColor} errorMessage={recognitionState.errorMessage} onClick={handleToggleMic} />}

                {/* [mobile] Attach file button (in draw with image mode)  */}
                {showChatAttachments === 'only-images' && <ButtonAttachFilesMemo color={showTint} isMobile onAttachFiles={handleAttachFiles} multiple />}

                {/* [mobile] [+] attachment sources menu */}
                {showChatAttachments === true && (
                  <AttachmentSourcesMemo
                    mode='menu-compact'
                    canBrowse={browseCapability.mayWork}
                    hasScreenCapture={supportsScreenCapture}
                    hasCamera={supportsCameraCapture()}
                    onlyImages={false /* because if yes, we only show the attach files above */}
                    onAttachClipboard={attachAppendClipboardItems}
                    onAttachFiles={handleAttachFiles}
                    onAttachScreenCapture={handleAttachScreenCapture}
                    onOpenCamera={handleOpenCamera}
                    onOpenGoogleDrivePicker={openGoogleDrivePicker}
                    onOpenWebInput={openWebInputDialog}
                  />
                )}

                {/* [Mobile] MultiChat button */}
                {props.isMulticast !== null && <ButtonMultiChatMemo isMobile multiChat={props.isMulticast} onSetMultiChat={props.setIsMulticast} />}

              </Box>
            )}

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
              <Box sx={{
                position: 'relative' /* for Mic overlay */,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                flexGrow: 1,
                minHeight: 0,
              }}>

                {!isDraw && !showChatInReferenceTo && composerThreadTargetDisplay.showChip && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 0.5, pb: 0.5, alignItems: 'center' }}>
                    <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
                      Sending to:
                    </Typography>
                    <Chip
                      size='sm'
                      variant='soft'
                      color='primary'
                    >
                      {selectedThreadPromptLabel}
                    </Chip>
                  </Box>
                )}

                {/* Edit box with inner Token Progress bar */}
                <Box sx={{
                  position: 'relative' /* for TokenBadge & TokenProgress */,
                  flexGrow: 1,
                  minHeight: 0,
                }}>

                  <Textarea
                    variant='outlined'
                    color={isDraw ? 'warning' : isReAct ? 'success' : undefined}
                    autoFocus={isDesktop}
                    minRows={isMobile ? 3.5 : isDraw ? 4 : agiAttachmentPrompts.hasData ? 3 : showChatInReferenceTo ? 4 : 5}
                    maxRows={isMobile ? 8 : 10}
                    placeholder={textPlaceholder}
                    value={composeText}
                    onChange={handleTextareaTextChange}
                    onKeyDown={handleTextareaKeyDown}
                    onPasteCapture={handleAttachCtrlV}
                    // onFocusCapture={handleFocusModeOn}
                    // onBlurCapture={handleFocusModeOff}
                    endDecorator={isDraw
                      ? <ComposerTextAreaDrawActions
                        composerText={composeText}
                        onReplaceText={setComposeText}
                      />
                      : <ComposerTextAreaActions
                        agiAttachmentPrompts={agiAttachmentPrompts}
                        inReferenceTo={inReferenceTo}
                        onAppendAndSend={handleAppendTextAndSend}
                        onRemoveReferenceTo={handleRemoveInReferenceTo}
                      />
                    }
                    slotProps={{
                      textarea: {
                        tabIndex: !recognitionState.isActive ? undefined : -1,
                        height: '100%',
                        enterKeyHint: enterIsNewline ? 'enter' : 'send',
                        sx: {
                          ...(recognitionState.isAvailable && { pr: { md: 5 } }),
                          '&::placeholder': {
                            whiteSpace: 'pre-line',
                          },
                          // mb: 0.5, // no need; the outer container already has enough p (for TokenProgressbar)
                        },
                        ref: composerTextAreaRef,
                      },
                    }}
                    sx={{
                      height: '100%',
                      backgroundColor: showTint ? undefined : 'background.level1',
                      '&:focus-within': { backgroundColor: 'background.popup', '.within-composer-focus': { backgroundColor: 'background.popup' } },
                      lineHeight: lineHeightTextareaMd,
                    }} />

                  {!showChatInReferenceTo && !isDraw && tokenLimit > 0 && (tokensComposer > 0 || (tokensHistory + tokensResponseMax) > 0) && (
                    <TokenProgressbarMemo chatPricing={tokenChatPricing} direct={tokensComposer} history={tokensHistory} responseMax={tokensResponseMax} limit={tokenLimit} />
                  )}

                  {!showChatInReferenceTo && !isDraw && tokenLimit > 0 && (
                    <TokenBadgeMemo showCost hideBelowDollars={0.01} chatPricing={tokenChatPricing} direct={tokensComposer} history={tokensHistory} responseMax={tokensResponseMax} limit={tokenLimit} enableHover={!isMobile} showExcess absoluteBottomRight />
                  )}

                </Box>

                {isDesktop && showChatAttachments && (
                  <Box sx={{ display: 'grid', gap: 0.5, alignSelf: 'flex-start' }}>
                    <AttachmentSourcesMemo
                      mode={!labsComposerAttachmentsInline ? 'menu-rich' : 'inline-buttons'}
                      color={!labsComposerAttachmentsInline ? (showTint || 'neutral') : showTint}
                      richButtonStandOut={!isText && !isAppend}
                      canBrowse={browseCapability.mayWork}
                      hasScreenCapture={supportsScreenCapture}
                      hasCamera={supportsCameraCapture()}
                      onlyImages={showChatAttachments === 'only-images'}
                      onAttachClipboard={attachAppendClipboardItems}
                      onAttachFiles={handleAttachFiles}
                      onAttachScreenCapture={handleAttachScreenCapture}
                      onOpenCamera={handleOpenCamera}
                      onOpenGoogleDrivePicker={openGoogleDrivePicker}
                      onOpenWebInput={openWebInputDialog}
                    />
                  </Box>
                )}

                {mentionOnlyParticipants.length > 0 && !isDraw && !showChatInReferenceTo && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 0.5, pt: 0.5, pb: 0.25 }}>
                    <Typography level='body-xs' sx={{ color: 'text.tertiary', mr: 0.5 }}>
                      Mention-only agents{hasAllMention ? ' · @all active' : ''}:
                    </Typography>
                    {mentionOnlyParticipants.map(participant => {
                      const isMentioned = mentionedParticipants.some(mentioned => mentioned.id === participant.id);
                      const participantAccentColor = getParticipantAccentColor(participant.name, props.participants);
                      const participantAccentSx = getParticipantAccentSx(participant.name, props.participants, isMentioned ? 'solid' : 'soft');
                      return (
                        <Chip
                          key={participant.id}
                          size='sm'
                          variant={isMentioned ? 'solid' : 'soft'}
                          color={participantAccentColor}
                          onClick={() => setComposeText(current => `${current}${current && !/\s$/.test(current) ? ' ' : ''}@${participant.name} `)}
                          sx={{ ...participantAccentSx, cursor: 'pointer', opacity: isMentioned ? 1 : 0.9 }}
                        >
                          @{participant.name}
                        </Chip>
                      );
                    })}
                  </Box>
                )}

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
                      {!!composeText && <span className='preceding'>{composeText.endsWith(' ') ? composeText : composeText + ' '}</span>}
                      {speechInterimResult.transcript}
                      <span className={speechInterimResult.interimTranscript === PLACEHOLDER_INTERIM_TRANSCRIPT ? 'placeholder' : 'interim'}>{speechInterimResult.interimTranscript}</span>
                    </Typography>
                  </Card>
                )}

              </Box>

              {/* Render any Attachments & menu items */}
              {!!conversationOverlayStore && showChatAttachments && (
                <ComposerAttachmentDraftsList
                  attachmentDraftsStoreApi={conversationOverlayStore}
                  attachmentDrafts={attachmentDrafts}
                  enrichment={attEnrichment}
                  enrichmentSummary={attEnrichSummary}
                  agiAttachmentPrompts={agiAttachmentPrompts}
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
                    ? (composerQuickButton === 'call'
                      ? (showCallButton
                        ? <ButtonCallMemo isMobile disabled={noConversation || noLLM} onClick={handleCallClicked} />
                        : <ButtonBeamMemo isMobile disabled={noConversation /*|| noLLM*/} color={beamButtonColor} hasContent={!!composeText} onClick={handleSendTextBeamClicked} />)
                      : <ButtonBeamMemo isMobile disabled={noConversation /*|| noLLM*/} color={beamButtonColor} hasContent={!!composeText} onClick={handleSendTextBeamClicked} />)
                    : isDraw
                      ? <ButtonOptionsDraw isMobile onClick={handleDrawOptionsClicked} sx={{ mr: { xs: 1, md: 2 } }} />
                      : <IconButton disabled sx={{ mr: { xs: 1, md: 2 } }} />
                )}

                {/* Responsive Send/Stop buttons */}
                <Box sx={{ display: 'grid', gap: 0.5, flexGrow: 1 }}>
                  {turnModeDisplay.showChip && turnModeChip && (
                    <Chip
                      size='sm'
                      variant='soft'
                      color={turnModeChip.color}
                      sx={{ alignSelf: 'stretch', justifyContent: 'center' }}
                    >
                      {turnModeChip.label}
                    </Chip>
                  )}
                {isCouncilSession && councilSessionStatusLabel && (interruptionPolicy.showResume || interruptionPolicy.showPause || isCouncilSession) && !assistantAbortible && (
                  <Chip
                    size='sm'
                    variant='soft'
                    color={councilSessionStatus === 'paused' ? 'warning' : councilSessionStatus === 'interrupted' ? 'danger' : councilSessionStatus === 'completed' ? 'success' : 'primary'}
                    sx={{ alignSelf: 'stretch', justifyContent: 'center' }}
                  >
                    {councilSessionStatusLabel}
                    {councilSessionRoundLabel}
                  </Chip>
                )}
                <Box sx={{ display: 'grid', gap: 0.5, minWidth: 0 }}>
                  <ButtonGroup
                    variant={sendButtonVariant}
                    color={sendButtonColor}
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      flexGrow: 1,
                      backgroundColor: (isMobile && sendButtonVariant === 'outlined') ? 'background.popup' : undefined,
                      boxShadow: (isMobile && sendButtonVariant !== 'outlined') ? 'none' : `0 8px 24px -4px rgb(var(--joy-palette-${sendButtonColor}-mainChannel) / 20%)`,
                      '& > *': {
                        minWidth: 0,
                      },
                    }}
                  >
                    <Button
                      key='composer-act'
                      fullWidth
                      disabled={noConversation /* || noLLM*/}
                      loading={sendStarted}
                      loadingPosition='end'
                      onClick={() => void (councilLeaderPrimarySend ? handleSendToChatClicked() : handleSendClicked())}
                      endDecorator={sendButtonIcon}
                      sx={{
                        '--Button-gap': '1rem',
                        flexGrow: 1,
                        minWidth: 0,
                      }}
                    >
                      {micContinuation && 'Voice '}{primarySendButtonLabel}
                    </Button>

                    {/* [Beam] Open Beam */}
                    {/*{isText && <Tooltip title='Open Beam'>*/}
                    {/*  <IconButton variant='outlined' disabled={noConversation || noLLM} onClick={handleSendTextBeamClicked}>*/}
                    {/*    <ChatBeamIcon />*/}
                    {/*  </IconButton>*/}
                    {/*</Tooltip>}*/}

                    {/* [Draw] Imagine */}
                    {/* NOTE: disabled: as we have prompt enhancement in the TextArea (Draw Mode) already */}
                    {/*{isDraw && !!composeText && <Tooltip title='Generate an image prompt'>*/}
                    {/*  <IconButton variant='outlined' disabled={noConversation || noLLM} onClick={handleTextImagineClicked}>*/}
                    {/*    <AutoAwesomeIcon />*/}
                    {/*  </IconButton>*/}
                    {/*</Tooltip>}*/}

                    {!stackInlineLifecycleButtons && lifecycleButtons}
                    {!stackInlineLifecycleButtons && modeExpanderButton}
                  </ButtonGroup>

                  {!!secondarySendButtonLabel && (
                    <Button
                      variant='soft'
                      color='neutral'
                      disabled={noConversation}
                      loading={sendStarted}
                      loadingPosition='end'
                      onClick={() => void handleSendClicked()}
                      endDecorator={<SendIcon sx={{ fontSize: 18 }} />}
                      sx={{ width: '100%', minWidth: 0 }}
                    >
                      {secondarySendButtonLabel}
                    </Button>
                  )}

                  {stackInlineLifecycleButtons && (
                    <ButtonGroup
                      variant='soft'
                      color='neutral'
                      sx={stackedLifecycleButtonGroupSx}
                    >
                      {lifecycleButtons}
                      {modeExpanderButton}
                    </ButtonGroup>
                  )}
                </Box>
                {turnModeDisplay.showHelper && turnModeChip && (
                  <Typography level='body-xs' sx={{ color: 'text.tertiary', px: 0.5 }}>
                    {turnModeChip.helper}
                  </Typography>
                )}
                </Box>

                {/* [desktop] secondary-top buttons */}
                {isDesktop && showChatExtras && !assistantAbortible && (
                  <ButtonBeamMemo
                    color={beamButtonColor}
                    disabled={noConversation /*|| noLLM*/}
                    hasContent={!!composeText}
                    onClick={handleSendTextBeamClicked}
                  />
                )}

              </Box>

              {/* [desktop] Draw mode N buttons */}
              {isDesktop && isDraw && <ButtonGroupDrawRepeat drawRepeat={drawRepeat} setDrawRepeat={setDrawRepeat} />}

              {/* [desktop] Multicast switch (under the Chat button) */}
              {isDesktop && props.isMulticast !== null && <ButtonMultiChatMemo multiChat={props.isMulticast} onSetMultiChat={props.setIsMulticast} />}

              {/* [desktop] secondary bottom-buttons (aligned to bottom for now, and mutually exclusive) */}
              {isDesktop && <Box sx={{ mt: 'auto', display: 'grid', gap: 1 }}>

                {/* [desktop] Call secondary button */}
                {showChatExtras && showCallButton && <ButtonCallMemo disabled={noConversation || noLLM || assistantAbortible} onClick={handleCallClicked} />}

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

      {/* Google Drive Picker (when open) */}
      {googleDrivePickerComponent}

      {/* Web Input Dialog (when open) */}
      {webInputDialogComponent}

      {/* Actile (when open) */}
      {actileComponent}

    </Box>
  );
}
