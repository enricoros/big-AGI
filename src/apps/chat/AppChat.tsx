import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import type { SxProps } from '@mui/joy/styles/types';
import { useTheme } from '@mui/joy';

import { DEV_MODE_SETTINGS } from '../settings-modal/UxLabsSettings';
import { DiagramConfig, DiagramsModal } from '~/modules/aifn/digrams/DiagramsModal';
import { FlattenerModal } from '~/modules/aifn/flatten/FlattenerModal';
import { TradeConfig, TradeModal } from '~/modules/trade/TradeModal';
import { downloadSingleChat, importConversationsFromFilesAtRest, openConversationsAtRestPicker } from '~/modules/trade/trade.client';
import { imaginePromptFromTextOrThrow } from '~/modules/aifn/imagine/imaginePromptFromText';
import { elevenLabsSpeakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useAreBeamsOpen } from '~/modules/beam/store-beam.hooks';
import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import type { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { OptimaDrawerIn, OptimaToolbarIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { PanelResizeInset } from '~/common/components/panes/GoodPanelResizeHandler';
import { Release } from '~/common/app.release';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { WorkspaceIdProvider } from '~/common/stores/workspace/WorkspaceIdProvider';
import { addSnackbar, removeSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { createDMessageFromFragments, createDMessagePlaceholderIncomplete, DMessageMetadata, duplicateDMessageMetadata } from '~/common/stores/chat/chat.message';
import { createErrorContentFragment, createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, duplicateDMessageFragmentsNoVoid } from '~/common/stores/chat/chat.fragments';
import { gcChatImageAssets } from '~/common/stores/chat/chat.gc';
import { getChatLLMId } from '~/common/stores/llms/store-llms';
import { getConversation, getConversationSystemPurposeId, useConversation } from '~/common/stores/chat/store-chats';
import { optimaActions, optimaOpenModels, optimaOpenPreferences, useSetOptimaAppMenu } from '~/common/layout/optima/useOptima';
import { themeBgAppChatComposer } from '~/common/app.theme';
import { useChatLLM } from '~/common/stores/llms/llms.hooks';
import { useFolderStore } from '~/common/stores/folders/store-chat-folders';
import { useIsMobile, useIsTallScreen } from '~/common/components/useMatchMedia';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useRouterQuery } from '~/common/app.routes';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { ChatPane } from './components/layout-pane/ChatPane';
import { ChatBarAltBeam } from './components/layout-bar/ChatBarAltBeam';
import { ChatBarAltTitle } from './components/layout-bar/ChatBarAltTitle';
import { ChatBarDropdowns } from './components/layout-bar/ChatBarDropdowns';
import { ChatBeamWrapper } from './components/ChatBeamWrapper';
import { ChatDrawerMemo } from './components/layout-drawer/ChatDrawer';
import { ChatMessageList } from './components/ChatMessageList';
import { Composer } from './components/composer/Composer';
import { usePanesManager } from './components/panes/usePanesManager';

import type { ChatExecuteMode } from './execute-mode/execute-mode.types';

import { _handleExecute } from './editors/_handleExecute';


// what to say when a chat is new and has no title
export const CHAT_NOVEL_TITLE = 'Chat';


export interface AppChatIntent {
  initialConversationId?: string;
  newChat?: 'voiceInput';
}

const scrollToBottomSx = {
  display: 'flex',
  flexDirection: 'column',
};

const chatMessageListSx: SxProps = {
  flexGrow: 1,
};

const chatBeamWrapperSx: SxProps = {
  flexGrow: 1,
  // minHeight: 'calc(100vh - 69px - var(--AGI-Nav-width))',
};

const composerOpenSx: SxProps = {
  zIndex: 21, // just to allocate a surface, and potentially have a shadow
  minWidth: { md: 480 }, // don't get compresses too much on desktop
  backgroundColor: themeBgAppChatComposer,
  borderTop: `1px solid`,
  borderTopColor: 'rgba(var(--joy-palette-neutral-mainChannel, 99 107 116) / 0.4)',
  // hack: eats the bottom of the last message (as it has a 1px divider)
  mt: '-1px',
};

const composerClosedSx: SxProps = {
  display: 'none',
};


export function AppChat() {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [isComposerMulticast, setIsComposerMulticast] = React.useState(false);
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [diagramConfig, setDiagramConfig] = React.useState<DiagramConfig | null>(null);
  const [tradeConfig, setTradeConfig] = React.useState<TradeConfig | null>(null);
  const [flattenConversationId, setFlattenConversationId] = React.useState<DConversationId | null>(null);
  const showNextTitleChange = React.useRef(false);
  const llmDropdownRef = React.useRef<OptimaBarControlMethods>(null);
  const personaDropdownRef = React.useRef<OptimaBarControlMethods>(null);
  const composerTextAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [_activeFolderId, setActiveFolderId] = React.useState<string | null>(null);

  // external state
  const theme = useTheme();

  const isMobile = useIsMobile();
  const isTallScreen = useIsTallScreen();

  const intent = useRouterQuery<Partial<AppChatIntent>>();

  const showAltTitleBar = useUXLabsStore(state => DEV_MODE_SETTINGS && state.labsChatBarAlt === 'title');

  const { chatLLM } = useChatLLM();

  const {
    // state
    chatPanes,
    focusedPaneIndex,
    focusedPaneConversationId,
    // actions
    navigateHistoryInFocusedPane,
    openConversationInFocusedPane,
    openConversationInSplitPane,
    removePane,
    setFocusedPaneIndex,
  } = usePanesManager();

  const { paneUniqueConversationIds, paneHandlers, paneBeamStores } = React.useMemo(() => {
    const paneConversationIds: (DConversationId | null)[] = chatPanes.map(pane => pane.conversationId || null);
    const paneHandlers = paneConversationIds.map(cId => cId ? ConversationsManager.getHandler(cId) : null);
    const paneBeamStores = paneHandlers.map(handler => handler?.getBeamStore() ?? null);
    const paneUniqueConversationIds = Array.from(new Set(paneConversationIds.filter(Boolean))) as DConversationId[];
    return {
      paneHandlers: paneHandlers,
      paneBeamStores: paneBeamStores,
      paneUniqueConversationIds: paneUniqueConversationIds,
    };
  }, [chatPanes]);

  const beamsOpens = useAreBeamsOpen(paneBeamStores);
  const beamOpenStoreInFocusedPane = React.useMemo(() => {
    const open = focusedPaneIndex !== null ? (beamsOpens?.[focusedPaneIndex] ?? false) : false;
    return open ? paneBeamStores?.[focusedPaneIndex!] ?? null : null;
  }, [beamsOpens, focusedPaneIndex, paneBeamStores]);

  const {
    // focused
    title: focusedChatTitle,
    isEmpty: isFocusedChatEmpty,
    isDeveloper: isFocusedChatDeveloper,
    conversationIdx: focusedChatNumber,
    // all
    hasConversations,
    recycleNewConversationId,
    // actions
    prependNewConversation,
    branchConversation,
    deleteConversations,
  } = useConversation(focusedPaneConversationId);

  // this will be used for the side panel
  // const focusedConversationWorkspaceId = workspaceForConversationIdentity(focusedPaneConversationId);
  //// const focusedConversationWorkspace = useWorkspaceIdForConversation(focusedPaneConversationId);

  const { mayWork: capabilityHasT2I } = useCapabilityTextToImage();

  const activeFolderId = useFolderStore(({ enableFolders, folders }) => {
    const activeFolderId = enableFolders ? _activeFolderId : null;
    const activeFolder = activeFolderId ? folders.find(folder => folder.id === activeFolderId) : null;
    return activeFolder?.id ?? null;
  });


  // Window actions

  const isMultiPane = chatPanes.length >= 2;
  const isMultiAddable = chatPanes.length < 4;
  const isMultiConversationId = paneUniqueConversationIds.length >= 2;
  const willMulticast = isComposerMulticast && isMultiConversationId;
  const disableNewButton = isFocusedChatEmpty && !isMultiPane;

  const handleOpenConversationInFocusedPane = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInFocusedPane(conversationId);
  }, [openConversationInFocusedPane]);

  const handleOpenConversationInSplitPane = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInSplitPane(conversationId);
  }, [openConversationInSplitPane]);

  const handleNavigateHistoryInFocusedPane = React.useCallback((direction: 'back' | 'forward') => {
    if (navigateHistoryInFocusedPane(direction))
      showNextTitleChange.current = true;
  }, [navigateHistoryInFocusedPane]);


  // Execution

  const handleExecuteAndOutcome = React.useCallback(async (chatExecuteMode: ChatExecuteMode, conversationId: DConversationId, callerNameDebug: string) => {
    const outcome = await _handleExecute(chatExecuteMode, conversationId, callerNameDebug);
    if (outcome === 'err-no-chatllm')
      optimaOpenModels();
    else if (outcome === 'err-t2i-unconfigured')
      optimaOpenPreferences('draw');
    else if (outcome === 'err-no-persona')
      addSnackbar({ key: 'chat-no-persona', message: 'No persona selected.', type: 'issue' });
    else if (outcome === 'err-no-conversation')
      addSnackbar({ key: 'chat-no-conversation', message: 'No active conversation.', type: 'issue' });
    else if (outcome === 'err-no-last-message')
      addSnackbar({ key: 'chat-no-conversation', message: 'No conversation history.', type: 'issue' });
    return outcome === true;
  }, []);

  const handleComposerAction = React.useCallback((conversationId: DConversationId, chatExecuteMode: ChatExecuteMode, fragments: (DMessageContentFragment | DMessageAttachmentFragment)[], metadata?: DMessageMetadata): boolean => {

    // [multicast] send the message to all the panes
    const uniqueConversationIds = willMulticast
      ? Array.from(new Set([conversationId, ...paneUniqueConversationIds]))
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
      const userMessage = createDMessageFromFragments('user', duplicateDMessageFragmentsNoVoid(fragments)); // [chat] create user:message to send per-chat
      if (metadata) userMessage.metadata = duplicateDMessageMetadata(metadata);

      ConversationsManager.getHandler(conversation.id).messageAppend(userMessage); // [chat] append user message in each conversation

      // fire/forget
      void handleExecuteAndOutcome(chatExecuteMode /* various */, conversation.id, 'chat-composer-action'); // append user message, then '*-*'
    }

    return true;
  }, [paneUniqueConversationIds, handleExecuteAndOutcome, willMulticast]);

  const handleConversationExecuteHistory = React.useCallback(async (conversationId: DConversationId) => {
    await handleExecuteAndOutcome('generate-content', conversationId, 'chat-execute-history'); // replace with 'history', then 'generate-content'
  }, [handleExecuteAndOutcome]);

  const handleMessageRegenerateLastInFocusedPane = React.useCallback(async () => {
    // Ctrl + Shift + Z
    if (!focusedPaneConversationId) return;
    const cHandler = ConversationsManager.getHandler(focusedPaneConversationId);
    if (!cHandler.isValid()) return;
    const inputHistory = cHandler.historyViewHeadOrThrow('chat-regenerate-shortcut');
    if (!inputHistory.length) return;

    // remove the last message if assistant's
    const lastMessage = inputHistory[inputHistory.length - 1];
    if (lastMessage.role === 'assistant')
      cHandler.historyTruncateTo(lastMessage.id, -1);

    // generate: NOTE: this will replace the system message correctly
    await handleExecuteAndOutcome('generate-content', focusedPaneConversationId, 'chat-regenerate-last'); // truncate if assistant, then gen-text
  }, [focusedPaneConversationId, handleExecuteAndOutcome]);

  const handleMessageBeamLastInFocusedPane = React.useCallback(async () => {
    // Ctrl + Shift + B
    if (!focusedPaneConversationId) return;
    const cHandler = ConversationsManager.getHandler(focusedPaneConversationId);
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
  }, [focusedPaneConversationId]);

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

  const handleTextSpeak = React.useCallback(async (text: string): Promise<void> => {
    await elevenLabsSpeakText(text, undefined, true, true);
  }, []);


  // Chat actions

  const handleConversationNewInFocusedPane = React.useCallback((forceNoRecycle: boolean, isIncognito: boolean) => {

    // create conversation (or recycle the existing top-of-stack empty conversation)
    const conversationId = (recycleNewConversationId && !forceNoRecycle && !isIncognito)
      ? recycleNewConversationId
      : prependNewConversation(getConversationSystemPurposeId(focusedPaneConversationId) ?? undefined, isIncognito);

    // switch the focused pane to the new conversation
    handleOpenConversationInFocusedPane(conversationId);

    // if a folder is active, add the new conversation to the folder
    if (activeFolderId && conversationId)
      useFolderStore.getState().addConversationToFolder(activeFolderId, conversationId);

    // focus the composer
    composerTextAreaRef.current?.focus();

  }, [activeFolderId, focusedPaneConversationId, handleOpenConversationInFocusedPane, prependNewConversation, recycleNewConversationId]);

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
            showNextTitleChange.current = true;
            handleOpenConversationInFocusedPane(outcome.activateConversationId);
          }
        })
        .catch(() => {
          addSnackbar({ key: 'chat-import-fail', message: 'Could not open file.', type: 'issue' });
        }),
    [handleOpenConversationInFocusedPane],
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

  const handleConversationBranch = React.useCallback((srcConversationId: DConversationId, messageId: string | null, addSplitPane: boolean): DConversationId | null => {
    // clone data
    const branchedConversationId = branchConversation(srcConversationId, messageId);

    // if a folder is active, add the new conversation to the folder
    if (activeFolderId && branchedConversationId)
      useFolderStore.getState().addConversationToFolder(activeFolderId, branchedConversationId);

    // replace/open a new pane with this
    showNextTitleChange.current = true;
    if (addSplitPane && isMultiAddable)
      handleOpenConversationInSplitPane(branchedConversationId);
    else
      handleOpenConversationInFocusedPane(branchedConversationId);

    return branchedConversationId;
  }, [activeFolderId, branchConversation, handleOpenConversationInFocusedPane, handleOpenConversationInSplitPane, isMultiAddable]);

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
    const nextConversationId = deleteConversations(conversationIds, /*focusedSystemPurposeId ??*/ undefined);

    // switch the focused pane to the new conversation - NOTE: this makes the assumption that deletion had impact on the focused pane
    handleOpenConversationInFocusedPane(nextConversationId);

    // run GC for dblobs in this conversation
    void gcChatImageAssets(); // fire/forget
  }, [showPromisedOverlay, deleteConversations, handleOpenConversationInFocusedPane]);


  // Pluggable Optima components

  const barAltTitle = showAltTitleBar ? focusedChatTitle ?? 'No Chat' : null;

  const focusedBarContent = React.useMemo(() => beamOpenStoreInFocusedPane
      ? <ChatBarAltBeam beamStore={beamOpenStoreInFocusedPane} isMobile={isMobile} />
      : (barAltTitle === null)
        ? <ChatBarDropdowns conversationId={focusedPaneConversationId} llmDropdownRef={llmDropdownRef} personaDropdownRef={personaDropdownRef} />
        : <ChatBarAltTitle conversationId={focusedPaneConversationId} conversationTitle={barAltTitle} />
    , [barAltTitle, beamOpenStoreInFocusedPane, focusedPaneConversationId, isMobile],
  );


  // Disabled by default, as it lags the opening of the drawer and immediatly vanishes during the closing animation
  const isDrawerOpen = true; // useOptimaDrawerOpen();

  const drawerContent = React.useMemo(() => !isDrawerOpen ? null :
      <ChatDrawerMemo
        // isMobile={isMobile /* expensive as it undoes the memo; not passed anymore */}
        activeConversationId={focusedPaneConversationId}
        activeFolderId={activeFolderId}
        chatPanesConversationIds={paneUniqueConversationIds}
        disableNewButton={disableNewButton}
        onConversationActivate={handleOpenConversationInFocusedPane}
        onConversationBranch={handleConversationBranch}
        onConversationNew={handleConversationNewInFocusedPane}
        onConversationsDelete={handleDeleteConversations}
        onConversationsExportDialog={handleConversationExport}
        onConversationsImportDialog={handleConversationImportDialog}
        setActiveFolderId={setActiveFolderId}
      />,
    [activeFolderId, disableNewButton, focusedPaneConversationId, handleConversationBranch, handleConversationExport, handleConversationImportDialog, handleConversationNewInFocusedPane, handleDeleteConversations, handleOpenConversationInFocusedPane, isDrawerOpen, paneUniqueConversationIds],
  );

  const focusedMenuItems = React.useMemo(() =>
      <ChatPane
        conversationId={focusedPaneConversationId}
        disableItems={!focusedPaneConversationId || isFocusedChatEmpty}
        hasConversations={hasConversations}
        isMessageSelectionMode={isMessageSelectionMode}
        isVerticalSplit={isMobile || isTallScreen}
        onConversationBranch={handleConversationBranch}
        onConversationClear={handleConversationReset}
        onConversationFlatten={handleConversationFlatten}
        // onConversationNew={handleConversationNewInFocusedPane}
        setIsMessageSelectionMode={setIsMessageSelectionMode}
      />,
    [focusedPaneConversationId, handleConversationBranch, handleConversationFlatten, handleConversationReset, hasConversations, isFocusedChatEmpty, isMessageSelectionMode, isMobile, isTallScreen],
  );

  useSetOptimaAppMenu(focusedMenuItems, 'AppChat');


  // Effects

  // [effect] Handle the conversation intent
  React.useEffect(() => {
    // Debug: open a null chat
    if (Release.IsNodeDevBuild && intent.initialConversationId === 'null')
      openConversationInFocusedPane(null! /* for debugging purporse */);
    // Open the initial conversation if set
    else if (intent.initialConversationId)
      openConversationInFocusedPane(intent.initialConversationId);
    // Create a new chat if requested
    else if (intent.newChat !== undefined)
      handleConversationNewInFocusedPane(false, false);
  }, [handleConversationNewInFocusedPane, intent.initialConversationId, intent.newChat, openConversationInFocusedPane]);

  // [effect] Show snackbar with the focused chat title after a history navigation in focused pane
  React.useEffect(() => {
    if (showNextTitleChange.current) {
      showNextTitleChange.current = false;
      const title = (focusedChatNumber >= 0 ? `#${focusedChatNumber + 1} · ` : '') + (focusedChatTitle || 'New Chat');
      const id = addSnackbar({ key: 'focused-title', message: title, type: 'center-title' });
      return () => removeSnackbar(id);
    }
  }, [focusedChatNumber, focusedChatTitle]);


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
    // focused conversation
    { key: 'z', ctrl: true, shift: true, disabled: isFocusedChatEmpty, action: handleMessageRegenerateLastInFocusedPane, description: 'Retry' },
    { key: 'b', ctrl: true, shift: true, disabled: isFocusedChatEmpty, action: handleMessageBeamLastInFocusedPane, description: 'Beam Edit' },
    { key: 'o', ctrl: true, action: handleConversationsImportFormFilePicker },
    { key: 's', ctrl: true, action: () => handleFileSaveConversation(focusedPaneConversationId) },
    { key: 'n', ctrl: true, shift: true, action: () => handleConversationNewInFocusedPane(false, false) },
    { key: 'x', ctrl: true, shift: true, action: () => isFocusedChatEmpty || (focusedPaneConversationId && handleConversationReset(focusedPaneConversationId)) },
    { key: 'd', ctrl: true, shift: true, action: () => focusedPaneConversationId && handleDeleteConversations([focusedPaneConversationId], false) },
    { key: '[', ctrl: true, action: () => handleNavigateHistoryInFocusedPane('back') },
    { key: ']', ctrl: true, action: () => handleNavigateHistoryInFocusedPane('forward') },
    // change active message (in any possible panel)
    { key: ShortcutKey.Up, ctrl: true, action: () => handleMoveFocus(-1) },
    { key: ShortcutKey.Down, ctrl: true, action: () => handleMoveFocus(1) },
    { key: ShortcutKey.Up, ctrl: true, shift: true, action: () => handleMoveFocus(-1, true) },
    { key: ShortcutKey.Down, ctrl: true, shift: true, action: () => handleMoveFocus(1, true) },
    // open the dropdowns
    { key: 'l', ctrl: true, action: () => llmDropdownRef.current?.openListbox() /*, description: 'Open Models Dropdown'*/ },
    { key: 'p', ctrl: true, action: () => personaDropdownRef.current?.openListbox() /*, description: 'Open Persona Dropdown'*/ },
    // focused conversation llm
    { key: 'o', ctrl: true, shift: true, action: handleOpenChatLlmOptions },
  ], [focusedPaneConversationId, handleConversationNewInFocusedPane, handleConversationReset, handleConversationsImportFormFilePicker, handleDeleteConversations, handleFileSaveConversation, handleMessageBeamLastInFocusedPane, handleMessageRegenerateLastInFocusedPane, handleMoveFocus, handleNavigateHistoryInFocusedPane, handleOpenChatLlmOptions, isFocusedChatEmpty]));


  return <>
    <OptimaDrawerIn>{drawerContent}</OptimaDrawerIn>
    <OptimaToolbarIn>{focusedBarContent}</OptimaToolbarIn>

    <PanelGroup
      direction={(isMobile || isTallScreen) ? 'vertical' : 'horizontal'}
      id='app-chat-panels'
    >

      {chatPanes.map((pane, idx) => {
        const _paneIsFocused = idx === focusedPaneIndex;
        const _paneConversationId = pane.conversationId;
        const _paneChatHandler = paneHandlers[idx] ?? null;
        const _paneIsIncognito = _paneChatHandler?.isIncognito() ?? false;
        const _paneBeamStoreApi = paneBeamStores[idx] ?? null;
        const _paneBeamIsOpen = !!beamsOpens?.[idx] && !!_paneBeamStoreApi;
        const _panesCount = chatPanes.length;
        const _keyAndId = `chat-pane-${pane.paneId}`;
        const _sepId = `sep-pane-${idx}`;
        return <WorkspaceIdProvider conversationId={_paneIsFocused ? _paneConversationId : null} key={_keyAndId}>

          <Panel
            id={_keyAndId}
            order={idx}
            collapsible={chatPanes.length === 2}
            defaultSize={(_panesCount === 3 && idx === 1) ? 34 : Math.round(100 / _panesCount)}
            minSize={20}
            onClick={(event) => {
              const setFocus = chatPanes.length < 2 || !event.altKey;
              setFocusedPaneIndex(setFocus ? idx : -1);
            }}
            onCollapse={() => {
              // NOTE: despite the delay to try to let the draggin settle, there seems to be an issue with the Pane locking the screen
              // setTimeout(() => removePane(idx), 50);
              // more than 2 will result in an assertion from the framework
              if (chatPanes.length === 2) removePane(idx);
            }}
            style={{
              // for anchoring the scroll button in place
              position: 'relative',
              ...(isMultiPane ? {
                borderRadius: '0.375rem',
                border: `2px solid ${_paneIsFocused
                  ? ((willMulticast || !isMultiConversationId) ? theme.palette.primary.solidBg : theme.palette.primary.solidBg)
                  : ((willMulticast || !isMultiConversationId) ? theme.palette.primary.softActiveBg : theme.palette.background.level1)}`,
                // DISABLED on 2024-03-13, it gets in the way quite a lot
                // filter: (!willMulticast && !_paneIsFocused)
                //   ? (!isMultiConversationId ? 'grayscale(66.67%)' /* clone of the same */ : 'grayscale(66.67%)')
                //   : undefined,
              } : {
                // NOTE: this is a workaround for the 'stuck-after-collapse-close' issue. We will collapse the 'other' pane, which
                // will get it removed (onCollapse), and somehow this pane will be stuck with a pointerEvents: 'none' style, which de-facto
                // disables further interaction with the chat. This is a workaround to re-enable the pointer events.
                // The root cause seems to be a Dragstate not being reset properly, however the pointerEvents has been set since 0.0.56 while
                // it was optional before: https://github.com/bvaughn/react-resizable-panels/issues/241
                pointerEvents: 'auto',
              }),
              ...((_paneIsIncognito && {
                backgroundColor: theme.palette.background.level3,
              })),
            }}
          >

            <ScrollToBottom
              bootToBottom
              stickToBottomInitial
              disableAutoStick={isMobile && _paneBeamIsOpen}
              sx={scrollToBottomSx}
            >

              {!_paneBeamIsOpen && (
                <ChatMessageList
                  conversationId={_paneConversationId}
                  conversationHandler={_paneChatHandler}
                  capabilityHasT2I={capabilityHasT2I}
                  chatLLMAntPromptCaching={chatLLM?.interfaces?.includes(LLM_IF_ANT_PromptCaching) ?? false}
                  chatLLMContextTokens={chatLLM?.contextTokens ?? null}
                  chatLLMSupportsImages={chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision) ?? false}
                  fitScreen={isMobile || isMultiPane}
                  isMobile={isMobile}
                  isMessageSelectionMode={isMessageSelectionMode}
                  setIsMessageSelectionMode={setIsMessageSelectionMode}
                  onConversationBranch={handleConversationBranch}
                  onConversationExecuteHistory={handleConversationExecuteHistory}
                  onConversationNew={handleConversationNewInFocusedPane}
                  onTextDiagram={handleTextDiagram}
                  onTextImagine={handleImagineFromText}
                  onTextSpeak={handleTextSpeak}
                  sx={chatMessageListSx}
                />
              )}

              {_paneBeamIsOpen && (
                <ChatBeamWrapper
                  beamStore={_paneBeamStoreApi}
                  isMobile={isMobile}
                  inlineSx={chatBeamWrapperSx}
                />
              )}

              {/* Visibility and actions are handled via Context */}
              <ScrollToBottomButton />

            </ScrollToBottom>

          </Panel>

          {/* Panel Separators & Resizers */}
          {idx < _panesCount - 1 && (
            <PanelResizeHandle id={_sepId}>
              <PanelResizeInset />
            </PanelResizeHandle>
          )}

        </WorkspaceIdProvider>;
      })}

    </PanelGroup>

    <Composer
      isMobile={isMobile}
      chatLLM={chatLLM}
      composerTextAreaRef={composerTextAreaRef}
      targetConversationId={focusedPaneConversationId}
      capabilityHasT2I={capabilityHasT2I}
      isMulticast={!isMultiConversationId ? null : isComposerMulticast}
      isDeveloperMode={isFocusedChatDeveloper}
      onAction={handleComposerAction}
      onConversationsImportFromFiles={handleConversationsImportFromFiles}
      onTextImagine={handleImagineFromText}
      setIsMulticast={setIsComposerMulticast}
      sx={beamOpenStoreInFocusedPane ? composerClosedSx : composerOpenSx}
    />

    {/* Diagrams */}
    {!!diagramConfig && (
      <DiagramsModal
        config={diagramConfig}
        onClose={() => setDiagramConfig(null)}
      />
    )}

    {/* Flatten */}
    {!!flattenConversationId && (
      <FlattenerModal
        conversationId={flattenConversationId}
        onConversationBranch={handleConversationBranch}
        onClose={() => setFlattenConversationId(null)}
      />
    )}

    {/* Import / Export  */}
    {!!tradeConfig && (
      <TradeModal
        config={tradeConfig}
        onConversationActivate={handleOpenConversationInFocusedPane}
        onClose={() => setTradeConfig(null)}
      />
    )}

  </>;
}
