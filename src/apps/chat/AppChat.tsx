import * as React from 'react';

import { PanelGroup } from 'react-resizable-panels';

import type { SxProps } from '@mui/joy/styles/types';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';
import type { TradeConfig } from '~/modules/trade/TradeModal';
import { downloadSingleChat, importConversationsFromFilesAtRest, openConversationsAtRestPicker } from '~/modules/trade/trade.client';
import { imaginePromptFromTextOrThrow } from '~/modules/aifn/imagine/imaginePromptFromText';
import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { conversationTitle, DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { OptimaDrawerIn, OptimaPanelIn, OptimaToolbarIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { Release } from '~/common/app.release';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { addSnackbar, removeSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { createDMessageFromFragments, createDMessagePlaceholderIncomplete, DMessageMetadata, duplicateDMessageMetadata } from '~/common/stores/chat/chat.message';
import { createErrorContentFragment, createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, duplicateDMessageFragments } from '~/common/stores/chat/chat.fragments';
import { gcChatImageAssets } from '~/common/stores/chat/chat.gc';
import { getChatLLMId } from '~/common/stores/llms/store-llms';
import { getConversation, getConversationSystemPurposeId, useChatStore } from '~/common/stores/chat/store-chats';
import { optimaActions, optimaOpenModels, optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { chatFoldersActions, getChatActiveFolderId } from '~/common/stores/folders/store-chat-folders';
import { getIsMobile, useIsMobile, useIsTallScreen } from '~/common/components/useMatchMedia';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useRouterQuery } from '~/common/app.routes';
import { useUIComplexityIsMinimal } from '~/common/stores/store-ui';
import { ChatDrawerMemo } from './components/layout-drawer/ChatDrawer';
import { ChatPaneMemo } from './components/ChatPane';
import { ChatPanelMemo } from './components/layout-panel/ChatPanel';
import { ChatShortcutsMemo } from './components/ChatShortcuts';
import { ChatToolbarMemo } from './components/layout-bar/ChatToolbar';
import { ComposerMemo } from './components/composer/Composer';
import { ComposerDock } from './components/composer/ComposerDock';
import { LiveSvgAnimator } from './components/live-svg/LiveSvgAnimator';
import { chatPanesActions, getFocusedPaneConversationId, getOtherPanesConversationIds, usePanesManager } from './components/panes/store-panes-manager';
import { liveSvgActions, useLiveSvgStore } from './components/live-svg/store-livesvg';

import type { ChatExecuteMode } from './execute-mode/execute-mode.types';

import { _handleExecute } from './editors/_handleExecute';


// what to say when a chat is new and has no title
export const CHAT_NOVEL_TITLE = 'Chat';


export interface AppChatIntent {
  initialConversationId?: string;
  newChat?: 'voiceInput';
}

const _styles = {

  composerOpenSx: {
    // NOTE: disabled on 2025-03-05: conflicts with the GlobalDragOverlay's
    // zIndex: 21, // just to allocate a surface, and potentially have a shadow
    minWidth: { md: 460 }, // don't get compresses too much on desktop
    // backgroundColor: themeBgAppChatComposer, // inlined in the Composer
    transition: 'background-color 0.5s ease-out',
    borderTop: `1px solid`,
    borderTopColor: 'rgba(var(--joy-palette-neutral-mainChannel, 99 107 116) / 0.4)',
    // hack: eats the bottom of the last message (as it has a 1px divider)
    // NOTE: commented on 2024-05-13, as other content was stepping on the border due to it and missing zIndex
    // mt: '-1px',
  } as const,

  composerOpenMobileSx: {
    // Mobile composer:
    zIndex: 21, // allocates the surface, possibly enables shadow if we like
    py: 0.5, // have some breathing room
    // boxShadow: '0px -1px 8px -2px rgba(0, 0, 0, 0.4)',

    // ...composerOpenSx:
    transition: 'background-color 0.5s ease-out',
    borderTop: `1px solid`,
    borderTopColor: 'rgba(var(--joy-palette-neutral-mainChannel, 99 107 116) / 0.4)',
  } as const,

  // composerClosedSx: {
  //   display: 'none',
  // } as const,

} as const satisfies Record<string, SxProps>;


// Lazy-loaded Modals
const DiagramsModalLazy = React.lazy(() => import('~/modules/aifn/digrams/DiagramsModal').then(module => ({ default: module.DiagramsModal })));
const FlattenerModalLazy = React.lazy(() => import('~/modules/aifn/flatten/FlattenerModal').then(module => ({ default: module.FlattenerModal })));
const TradeModalLazy = React.lazy(() => import('~/modules/trade/TradeModal').then(module => ({ default: module.TradeModal })));


export function AppChat() {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [multicastEnabled, setMulticastEnabled] = React.useState(false);
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [diagramConfig, setDiagramConfig] = React.useState<DiagramConfig | null>(null);
  const [tradeConfig, setTradeConfig] = React.useState<TradeConfig | null>(null);
  const [flattenConversationId, setFlattenConversationId] = React.useState<DConversationId | null>(null);
  const focusedTitleSnackbarIdRef = React.useRef<string | null>(null);
  const llmDropdownRef = React.useRef<OptimaBarControlMethods>(null);
  const personaDropdownRef = React.useRef<OptimaBarControlMethods>(null);
  const composerTextAreaRef = React.useRef<HTMLTextAreaElement>(null);

  // external state
  const isMobile = useIsMobile();
  const isTallScreen = useIsTallScreen();

  const isZenMode = useUIComplexityIsMinimal();

  const intent = useRouterQuery<Partial<AppChatIntent>>();

  const {
    chatPanes,
    chatPaneIds,
    chatPaneUniqueIds, // NOTE: does not contain nulls, for which we will patch the drawer render items (cardinality)
    /** key of most of the derived 'focused' states */
    focusedPaneConversationId,
    focusedPaneIndex,
  } = usePanesManager();

  // this will be used for the side panel
  // const focusedConversationWorkspaceId = workspaceForConversationIdentity(focusedPaneConversationId);
  //// const focusedConversationWorkspace = useWorkspaceIdForConversation(focusedPaneConversationId);

  const { mayWork: capabilityHasT2I, mayEdit: capabilityHasT2IEdit } = useCapabilityTextToImage();

    // Live SVG Animator: when active, this mode takes over the main panel (and hides the composer)
  const liveSvgModeActive = useLiveSvgStore((s) => s.modeActive);

  // Window actions

  const isMultiAddable = chatPanes.length < 4;
  const isMultiConversationId = chatPaneUniqueIds.length >= 2;
  const willMulticast = isMultiConversationId && multicastEnabled;
  const disableNewButton = false; // isFocusedChatEmpty && !isMultiPane;

  const handleOpenConversationInFocusedPane = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && chatPanesActions().openConversationInFocusedPane(conversationId);
  }, []);

  const handleOpenConversationInSplitPane = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && chatPanesActions().openConversationInSplitPane(conversationId);
  }, []);

  /** Snackbar with the title of the focused chat, after a navigation changed it; replaces the previous one. */
  const showFocusedChatTitle = React.useCallback(() => {
    if (focusedTitleSnackbarIdRef.current)
      removeSnackbar(focusedTitleSnackbarIdRef.current);
    const focusedConversation = getConversation(getFocusedPaneConversationId());
    const title = focusedConversation ? conversationTitle(focusedConversation) : null;
    focusedTitleSnackbarIdRef.current = !title ? null : addSnackbar({ key: 'focused-title', message: title, type: 'center-title' });
  }, []);

  const handleNavigateHistoryInFocusedPane = React.useCallback((direction: 'back' | 'forward') => {
    if (chatPanesActions().navigateHistoryInFocusedPane(direction))
      showFocusedChatTitle();
  }, [showFocusedChatTitle]);


  // Execution

  const handleExecuteAndOutcome = React.useCallback(async (chatExecuteMode: ChatExecuteMode, conversationId: DConversationId, callerNameDebug: string) => {
    const outcome = await _handleExecute(chatExecuteMode, conversationId, callerNameDebug);
    if (outcome === 'err-no-chatllm')
      optimaOpenModels();
    else if (outcome === 'err-t2i-unconfigured')
      optimaOpenPreferences('draw');
    else if (outcome === 'err-no-persona')
      addSnackbar({ key: 'chat-no-persona', message: 'No persona selected.', type: 'issue', overrides: { autoHideDuration: 4000 } });
    else if (outcome === 'err-no-conversation')
      addSnackbar({ key: 'chat-no-conversation', message: 'No active conversation.', type: 'issue' });
    else if (outcome === 'err-no-last-message')
      addSnackbar({ key: 'chat-no-conversation', message: 'No conversation history.', type: 'issue' });
    return outcome === true;
  }, []);

  const handleComposerAction = React.useCallback((conversationId: DConversationId, chatExecuteMode: ChatExecuteMode, fragments: (DMessageContentFragment | DMessageAttachmentFragment)[], metadata?: DMessageMetadata): boolean => {

    // [multicast] send the message to all the panes
    const uniqueConversationIds = willMulticast
      ? Array.from(new Set([conversationId, ...chatPaneUniqueIds]))
      : [conversationId];

    // validate conversation existence
    const uniqueConverations = uniqueConversationIds.map(cId => getConversation(cId)).filter(Boolean) as DConversation[];
    if (!uniqueConverations.length)
      return false;

    // we loop to handle both the normal and multicast modes
    for (const conversation of uniqueConverations) {

      // create the user:message
      // NOTE: this can lead to multiple chat messages with data refs that are referring to the same dblobs,
      //       however, we already got transferred ownership of the dblobs at this point.
      const userMessage = createDMessageFromFragments('user', duplicateDMessageFragments(fragments, true)); // [chat] create user:message to send per-chat
      if (metadata) userMessage.metadata = duplicateDMessageMetadata(metadata);

      ConversationsManager.getHandler(conversation.id).messageAppend(userMessage); // [chat] append user message in each conversation

      // fire/forget
      void handleExecuteAndOutcome(chatExecuteMode /* various */, conversation.id, 'chat-composer-action'); // append user message, then '*-*'
    }

    return true;
  }, [chatPaneUniqueIds, handleExecuteAndOutcome, willMulticast]);

  const handleConversationExecuteHistory = React.useCallback(async (conversationId: DConversationId) => {
    await handleExecuteAndOutcome('generate-content', conversationId, 'chat-execute-history'); // replace with 'history', then 'generate-content'
  }, [handleExecuteAndOutcome]);

  const handleFocusedConversationRegenerateHead = React.useCallback(async (): Promise<void> => {
    // Ctrl + Shift + Z
    const conversationId = getFocusedPaneConversationId();
    if (!conversationId) return;
    const cHandler = ConversationsManager.getHandler(conversationId);
    if (!cHandler.isValid()) return;
    const inputHistory = cHandler.historyViewHeadOrThrow('chat-regenerate-shortcut');
    const lastMessage = inputHistory.at(-1);
    if (!lastMessage || lastMessage.role === 'system') return;

    // remove the last message if assistant's
    if (lastMessage.role === 'assistant')
      cHandler.historyTruncateTo(lastMessage.id, -1);

    // generate: NOTE: this will replace the system message correctly
    await handleExecuteAndOutcome('generate-content', conversationId, 'chat-regenerate-last'); // truncate if assistant, then gen-text
  }, [handleExecuteAndOutcome]);

  const handleMessageBeamLastInFocusedPane = React.useCallback(async () => {
    // Ctrl + Shift + B
    const conversationId = getFocusedPaneConversationId();
    if (!conversationId) return;
    const cHandler = ConversationsManager.getHandler(conversationId);
    if (!cHandler.isValid()) return;
    const inputHistory = cHandler.historyViewHeadOrThrow('chat-beam-shortcut');
    if (!inputHistory.length) return;

    // TODO: replace the Persona and Auto-Cache-hint in the history?

    // replace the prompt in history
    const lastMessage = inputHistory[inputHistory.length - 1];
    if (lastMessage.role === 'assistant')
      cHandler.beamInvoke(inputHistory.slice(0, -1), [lastMessage], lastMessage.id);
    else if (lastMessage.role === 'user')
      cHandler.beamInvoke(inputHistory, [], null);
  }, []);

  const handleTextDiagram = React.useCallback((diagramConfig: DiagramConfig | null) => setDiagramConfig(diagramConfig), []);

  const handleImagineFromText = React.useCallback(async (conversationId: DConversationId, subjectText: string) => {
    const cHandler = ConversationsManager.getHandler(conversationId);
    if (!cHandler.isValid()) return;
    const userImagineMessage = createDMessagePlaceholderIncomplete('user', `Thinking at the subject...`); // [chat] append user:imagine prompt
    cHandler.messageAppend(userImagineMessage);
    await imaginePromptFromTextOrThrow(subjectText, conversationId)
      .then(imaginedPrompt => {
        // Replace the placeholder with the message to draw, then execute the draw
        cHandler.messageFragmentReplace(userImagineMessage.id, userImagineMessage.fragments[0].fId, createTextContentFragment(imaginedPrompt), true);
        return handleExecuteAndOutcome('generate-image', conversationId, 'chat-imagine-from-text'); // append message for 'imagine', then generate-image
      })
      .catch((error: any) => {
        // Replace the placeholder with the error message
        cHandler.messageFragmentReplace(userImagineMessage.id, userImagineMessage.fragments[0].fId, createErrorContentFragment(`Issue requesting an Image prompt. ${error?.message || ''}`), true);
      });
  }, [handleExecuteAndOutcome]);

  // Chat actions

  const handleConversationNewInFocusedPane = React.useCallback((forceNoRecycle: boolean, isIncognito: boolean) => {

    // create conversation (or recycle the existing top-of-stack empty conversation)
    // never recycle a chat shown in another pane: both panes would end up on the same chat
    const { conversations, prependNewConversation } = useChatStore.getState();
    const recycleNewConversationId = (conversations.length && !conversations[0].messages.length) ? conversations[0].id : null;
    const recycleShownElsewhere = !!recycleNewConversationId && getOtherPanesConversationIds().includes(recycleNewConversationId);
    const conversationId = (recycleNewConversationId && !forceNoRecycle && !isIncognito && !recycleShownElsewhere)
      ? recycleNewConversationId
      : prependNewConversation(getConversationSystemPurposeId(getFocusedPaneConversationId()) ?? undefined, isIncognito);

    // switch the focused pane to the new conversation
    handleOpenConversationInFocusedPane(conversationId);

    // if a folder is active, add the new conversation to the folder
    const activeFolderId = getChatActiveFolderId();
    if (activeFolderId && conversationId)
      chatFoldersActions().addConversationToFolder(activeFolderId, conversationId);

    // focus the composer
    if (!getIsMobile())
      composerTextAreaRef.current?.focus();

  }, [handleOpenConversationInFocusedPane]);

  const handleConversationImportDialog = React.useCallback(() => setTradeConfig({ dir: 'import' }), []);

  const handleConversationExport = React.useCallback((conversationId: DConversationId | null, exportAll: boolean) => {
    setTradeConfig({ dir: 'export', conversationId, exportAll });
  }, []);

  const handleConversationsImportFromFiles = React.useCallback(
    (files: File[] | null): Promise<void> =>
      importConversationsFromFilesAtRest(files, true)
        .then((outcome) => {
          // activate the last (most recent) imported conversation
          if (outcome.activateConversationId) {
            handleOpenConversationInFocusedPane(outcome.activateConversationId);
            showFocusedChatTitle();
          }
        })
        .catch(() => {
          addSnackbar({ key: 'chat-import-fail', message: 'Could not open file.', type: 'issue' });
        }),
    [handleOpenConversationInFocusedPane, showFocusedChatTitle],
  );

  const handleConversationsImportFormFilePicker = React.useCallback(
    () => openConversationsAtRestPicker().then(handleConversationsImportFromFiles),
    [handleConversationsImportFromFiles],
  );

  const handleFileSaveConversation = React.useCallback((conversationId: DConversationId | null) => {
    const conversation = getConversation(conversationId);
    conversation && downloadSingleChat(conversation, 'json')
      .then(() => {
        addSnackbar({ key: 'chat-save-as-ok', message: 'File saved.', type: 'success' });
      })
      .catch((err: any) => {
        if (err?.name !== 'AbortError')
          addSnackbar({ key: 'chat-save-as-fail', message: `Could not save the file. ${err?.message || ''}`, type: 'issue' });
      });
  }, []);

  // identity changes with the pane count only (a layout change), so the memoized panes and side panel take it directly
  const handleConversationBranchAndFocus = React.useCallback((srcConversationId: DConversationId, messageId: string | null, addSplitPane: boolean): DConversationId | null => {
    // clone data
    const branchedConversationId = useChatStore.getState().branchConversation(srcConversationId, messageId);

    // if a folder is active, add the new conversation to the folder
    const activeFolderId = getChatActiveFolderId();
    if (activeFolderId && branchedConversationId)
      chatFoldersActions().addConversationToFolder(activeFolderId, branchedConversationId);

    // replace/open a new pane with this
    if (addSplitPane && isMultiAddable)
      handleOpenConversationInSplitPane(branchedConversationId);
    else
      handleOpenConversationInFocusedPane(branchedConversationId);
    showFocusedChatTitle();

    return branchedConversationId;
  }, [handleOpenConversationInFocusedPane, handleOpenConversationInSplitPane, isMultiAddable, showFocusedChatTitle]);

  const handleConversationFlatten = React.useCallback((conversationId: DConversationId) => setFlattenConversationId(conversationId), []);

  const handleConversationReset = React.useCallback(async (conversationId: DConversationId) => {
    if (await showPromisedOverlay('chat-reset-confirmation', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText='This will clear all messages while keeping the current chat settings, model, and persona. Do you want to continue?'
        positiveActionText='Restart Chat'
        title='Restart Chat'
      />,
    )) {
      ConversationsManager.getHandler(conversationId).historyClear();
    }
  }, [showPromisedOverlay]);

  const handleDeleteConversations = React.useCallback(async (conversationIds: DConversationId[], bypassConfirmation: boolean) => {

    // show confirmation dialog
    if (!bypassConfirmation && !await showPromisedOverlay('chat-delete-confirmation', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={`Are you absolutely sure you want to delete ${conversationIds.length === 1 ? 'this conversation' : 'these conversations'}? This action cannot be undone.`}
        positiveActionText={conversationIds.length === 1 ? 'Delete conversation' : `Yes, delete all ${conversationIds.length} conversations`}
      />,
    )) return;

    // perform deletion, and return the next (or a new) conversation
    const nextConversationId = useChatStore.getState().deleteConversations(conversationIds, /*focusedSystemPurposeId ??*/ undefined);

    // switch the focused pane to the new conversation - NOTE: this makes the assumption that deletion had impact on the focused pane
    // unless another pane shows it (the panes store then re-targets to a distinct chat, or unsplits) - two panes must not share a chat
    if (!getOtherPanesConversationIds().includes(nextConversationId))
      handleOpenConversationInFocusedPane(nextConversationId);

    // run GC for dblobs in this conversation
    void gcChatImageAssets(); // fire/forget
  }, [showPromisedOverlay, handleOpenConversationInFocusedPane]);


  // Effects

  // [effect] Handle the conversation intent
  React.useEffect(() => {
    // Debug: open a null chat
    if (Release.IsNodeDevBuild && intent.initialConversationId === 'null')
      chatPanesActions().openConversationInFocusedPane(null! /* for debugging purpose */);
    // Open the initial conversation if set
    else if (intent.initialConversationId)
      chatPanesActions().openConversationInFocusedPane(intent.initialConversationId);
    // Create a new chat if requested
    else if (intent.newChat !== undefined)
      handleConversationNewInFocusedPane(false, false);
  }, [handleConversationNewInFocusedPane, intent.initialConversationId, intent.newChat]);


  // Shortcuts

  const handleOpenChatLlmOptions = React.useCallback(() => {
    const chatLLMId = getChatLLMId();
    if (!chatLLMId) return;
    optimaActions().openModelOptions(chatLLMId);
  }, []);

  const handleMoveFocus = React.useCallback((direction: number, wholeList?: boolean) => {
    // find the parent list
    let messageListElement: HTMLElement | null;
    let withinBeam = false;
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      messageListElement = document.querySelector('[role=beam-list]') as HTMLElement;
      if (!messageListElement)
        messageListElement = activeElement.closest('[role=chat-messages-list]') as HTMLElement;
      else
        withinBeam = true;
    } else
      messageListElement = document.querySelector('[role=chat-messages-list]') as HTMLElement;
    if (!messageListElement) return;

    // find the scrollable container and if we're at the bottom
    const scrollContainer = messageListElement.closest('[role=scrollable]') as HTMLElement;
    if (!scrollContainer) return;
    const isAtBottom = Math.abs(scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight) < 1;

    // determine the current message and next index
    const messageElements = Array.from(messageListElement.querySelectorAll(withinBeam ? '[role=beam-card]' : '[role=chat-message]')) as HTMLElement[];
    const currentIndex = messageElements.findIndex(el => el.contains(activeElement));

    // if going down and we're at/past the last message, scroll to bottom
    const snapToBottom = direction > 0 && (wholeList || (currentIndex === -1 || currentIndex >= messageElements.length - 1));
    const nextIndex = (wholeList && direction < 0) ? 0
      : snapToBottom ? messageElements.length - 1
        : (isAtBottom && direction < 0) ? currentIndex
          : currentIndex === -1 ? (direction < 0 ? 0 : messageElements.length - 1)
            : currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= messageElements.length) return;

    // perform the smooth scroll and focus
    const targetElement = messageElements[nextIndex];
    targetElement.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    targetElement.scrollIntoView({ behavior: 'smooth', block: snapToBottom ? 'end' : 'start' });
  }, []);

  useGlobalShortcuts('AppChat', React.useMemo(() => [
    // focused conversation: content-gated entries are in ChatShortcuts
    // change apps to llm Options overlay
    { key: 'o', ctrl: true, shift: true, action: handleOpenChatLlmOptions },
    // window management
    { key: 'n', ctrl: true, shift: true, action: () => handleConversationNewInFocusedPane(false, false) },
    { key: 'd', ctrl: true, shift: true, action: () => focusedPaneConversationId && handleDeleteConversations([focusedPaneConversationId], false) },
    { key: '[', ctrl: true, action: () => handleNavigateHistoryInFocusedPane('back') },
    { key: ']', ctrl: true, action: () => handleNavigateHistoryInFocusedPane('forward') },
    // change active message (in any possible panel, works in Beam too)
    { key: ShortcutKey.Up, ctrl: true, action: () => handleMoveFocus(-1) },
    { key: ShortcutKey.Down, ctrl: true, action: () => handleMoveFocus(1) },
    { key: ShortcutKey.Up, ctrl: true, shift: true, action: () => handleMoveFocus(-1, true) },
    { key: ShortcutKey.Down, ctrl: true, shift: true, action: () => handleMoveFocus(1, true) },
    // fun modes (live svg)
    { key: 's', ctrl: true, shift: true, action: () => liveSvgModeActive ? liveSvgActions().exitMode() : liveSvgActions().enterMode(getChatLLMId()) },
  ], [focusedPaneConversationId, handleConversationNewInFocusedPane, handleDeleteConversations, handleMoveFocus, handleNavigateHistoryInFocusedPane, handleOpenChatLlmOptions, liveSvgModeActive]));


  return <>

    {/* Shortcuts gated on the focused chat */}
    <ChatShortcutsMemo
      conversationId={focusedPaneConversationId}
      llmDropdownRef={llmDropdownRef}
      personaDropdownRef={personaDropdownRef}
      onConversationReset={handleConversationReset}
      onConversationSave={handleFileSaveConversation}
      onConversationsImport={handleConversationsImportFormFilePicker}
      onMessageBeamLast={handleMessageBeamLastInFocusedPane}
      onMessageRegenerateLast={handleFocusedConversationRegenerateHead}
    />

    {/* -> Toolbar, -> Drawer, -> Panel*/}
    <OptimaToolbarIn>
      <ChatToolbarMemo
        conversationId={focusedPaneConversationId}
        isMobile={isMobile}
        llmDropdownRef={llmDropdownRef}
        personaDropdownRef={personaDropdownRef}
      />
    </OptimaToolbarIn>
    <OptimaDrawerIn>
      {/* always mounted: gating on the drawer-open state lags the opening and vanishes during the closing animation */}
      <ChatDrawerMemo
        isMobile={isMobile}
        activeConversationId={focusedPaneConversationId}
        chatPanesConversationIds={chatPaneIds}
        disableNewButton={disableNewButton}
        onConversationActivate={handleOpenConversationInFocusedPane}
        onConversationBranch={handleConversationBranchAndFocus}
        onConversationNew={handleConversationNewInFocusedPane}
        onConversationsDelete={handleDeleteConversations}
        onConversationsExportDialog={handleConversationExport}
        onConversationsImportDialog={handleConversationImportDialog}
      />
    </OptimaDrawerIn>
    <OptimaPanelIn>
      <ChatPanelMemo
        isMobile={isMobile}
        conversationId={focusedPaneConversationId}
        isMessageSelectionMode={isMessageSelectionMode}
        isVerticalSplit={isMobile || isTallScreen}
        onConversationBranch={handleConversationBranchAndFocus}
        onConversationClear={handleConversationReset}
        onConversationFlatten={handleConversationFlatten}
        // onConversationNew={handleConversationNewInFocusedPane}
        setIsMessageSelectionMode={setIsMessageSelectionMode}
      />
    </OptimaPanelIn>

    {liveSvgModeActive ? (
      <LiveSvgAnimator isMobile={isMobile} />
    ) : (
    <PanelGroup
      direction={(isMobile || isTallScreen) ? 'vertical' : 'horizontal'}
      id='app-chat-panels'
    >

      {/* Render each sub-app in Chat (right now it's either CML or Beam */}
      {chatPanes.map((pane, idx) => (
        <ChatPaneMemo
          key={`chat-pane-${pane.paneId}`}
          paneId={pane.paneId}
          paneIdx={idx}
          panesCount={chatPanes.length}
          conversationId={pane.conversationId}
          isFocused={idx === focusedPaneIndex}
          composerReachesAll={willMulticast || !isMultiConversationId}
          isMobile={isMobile}
          isZenMode={isZenMode}
          capabilityHasT2I={capabilityHasT2I}
          isMessageSelectionMode={isMessageSelectionMode}
          setIsMessageSelectionMode={setIsMessageSelectionMode}
          onConversationBranch={handleConversationBranchAndFocus}
          onConversationDelete={handleDeleteConversations}
          onConversationExecuteHistory={handleConversationExecuteHistory}
          onConversationNew={handleConversationNewInFocusedPane}
          onTextDiagram={handleTextDiagram}
          onTextImagine={handleImagineFromText}
        />
      ))}

    </PanelGroup>
    )}

    {/* Composer with auto-hide */}
    <ComposerDock conversationId={focusedPaneConversationId} isMobile={isMobile}>
      {(setComposerHasContent) => (
        <ComposerMemo
          isMobile={isMobile}
          composerTextAreaRef={composerTextAreaRef}
          targetConversationId={focusedPaneConversationId}
          capabilityHasT2I={capabilityHasT2I}
          capabilityHasT2IEdit={capabilityHasT2IEdit}
          isMulticast={!isMultiConversationId ? null : multicastEnabled}
          onAction={handleComposerAction}
          onConversationBeamEdit={handleMessageBeamLastInFocusedPane}
          onConversationsImportFromFiles={handleConversationsImportFromFiles}
          onTextImagine={handleImagineFromText}
          setIsMulticast={setMulticastEnabled}
          onComposerHasContent={setComposerHasContent}
          sx={isMobile ? _styles.composerOpenMobileSx : _styles.composerOpenSx}
        />
      )}
    </ComposerDock>

    {/* Diagrams */}
    {!!diagramConfig && (
      <React.Suspense fallback={null}>
        <DiagramsModalLazy
          config={diagramConfig}
          onClose={() => setDiagramConfig(null)}
        />
      </React.Suspense>
    )}

    {/* Flatten */}
    {!!flattenConversationId && (
      <React.Suspense fallback={null}>
        <FlattenerModalLazy
          conversationId={flattenConversationId}
          onConversationBranch={handleConversationBranchAndFocus}
          onClose={() => setFlattenConversationId(null)}
        />
      </React.Suspense>
    )}

    {/* Import / Export  */}
    {!!tradeConfig && (
      <React.Suspense fallback={null}>
        <TradeModalLazy
          config={tradeConfig}
          onConversationActivate={handleOpenConversationInFocusedPane}
          onClose={() => setTradeConfig(null)}
        />
      </React.Suspense>
    )}

  </>;
}
