import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import type { SxProps } from '@mui/joy/styles/types';
import { useTheme } from '@mui/joy';

import { DEV_MODE_SETTINGS } from '../settings-modal/UxLabsSettings';
import { DiagramConfig, DiagramsModal } from '~/modules/aifn/digrams/DiagramsModal';
import { FlattenerModal } from '~/modules/aifn/flatten/FlattenerModal';
import { TradeConfig, TradeModal } from '~/modules/trade/TradeModal';
import { downloadConversation, openAndLoadConversations } from '~/modules/trade/trade.client';
import { getChatLLMId, useChatLLM } from '~/modules/llms/store-llms';
import { imaginePromptFromText } from '~/modules/aifn/imagine/imaginePromptFromText';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useAreBeamsOpen } from '~/modules/beam/store-beam.hooks';
import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { GlobalShortcutDefinition, useGlobalShortcuts } from '~/common/components/useGlobalShortcuts';
import { PanelResizeInset } from '~/common/components/panes/GoodPanelResizeHandler';
import { PreferencesTab, useOptimaLayout, usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { addSnackbar, removeSnackbar } from '~/common/components/useSnackbarsStore';
import { createDMessage, DConversationId, DMessage, DMessageMetadata, getConversation, getConversationSystemPurposeId, useConversation } from '~/common/state/store-chats';
import { themeBgAppChatComposer } from '~/common/app.theme';
import { useFolderStore } from '~/common/state/store-folders';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useRouterQuery } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import type { ComposerOutputMultiPart } from './components/composer/composer.types';
import { ChatBarAltBeam } from './components/ChatBarAltBeam';
import { ChatBarAltTitle } from './components/ChatBarAltTitle';
import { ChatBarDropdowns } from './components/ChatBarDropdowns';
import { ChatBeamWrapper } from './components/ChatBeamWrapper';
import { ChatDrawerMemo } from './components/ChatDrawer';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatPageMenuItems } from './components/ChatPageMenuItems';
import { Composer } from './components/composer/Composer';
import { usePanesManager } from './components/panes/usePanesManager';

import { _handleExecute } from './editors/_handleExecute';


// what to say when a chat is new and has no title
export const CHAT_NOVEL_TITLE = 'Chat';


/**
 * Mode: how to treat the input from the Composer
 */
export type ChatModeId =
  | 'generate-text'
  | 'generate-text-beam'
  | 'append-user'
  | 'generate-image'
  | 'generate-react';


export interface AppChatIntent {
  initialConversationId: string | null;
}


const composerOpenSx: SxProps = {
  zIndex: 21, // just to allocate a surface, and potentially have a shadow
  backgroundColor: themeBgAppChatComposer,
  borderTop: `1px solid`,
  borderTopColor: 'divider',
  p: { xs: 1, md: 2 },
};

const composerClosedSx: SxProps = {
  display: 'none',
};


export function AppChat() {

  // state
  const [isComposerMulticast, setIsComposerMulticast] = React.useState(false);
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [diagramConfig, setDiagramConfig] = React.useState<DiagramConfig | null>(null);
  const [tradeConfig, setTradeConfig] = React.useState<TradeConfig | null>(null);
  const [clearConversationId, setClearConversationId] = React.useState<DConversationId | null>(null);
  const [deleteConversationIds, setDeleteConversationIds] = React.useState<DConversationId[] | null>(null);
  const [flattenConversationId, setFlattenConversationId] = React.useState<DConversationId | null>(null);
  const showNextTitleChange = React.useRef(false);
  const composerTextAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [_activeFolderId, setActiveFolderId] = React.useState<string | null>(null);

  // external state
  const theme = useTheme();

  const isMobile = useIsMobile();

  const intent = useRouterQuery<Partial<AppChatIntent>>();

  const showAltTitleBar = useUXLabsStore(state => DEV_MODE_SETTINGS && state.labsChatBarAlt === 'title');

  const { openLlmOptions, openModelsSetup, openPreferencesTab } = useOptimaLayout();

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

  const chatHandlers = React.useMemo(() => chatPanes.map(pane => {
    return pane.conversationId ? ConversationsManager.getHandler(pane.conversationId) : null;
  }), [chatPanes]);

  const beamsStores = React.useMemo(() => chatHandlers.map(handler => {
    return handler?.getBeamStore() ?? null;
  }), [chatHandlers]);

  const beamsOpens = useAreBeamsOpen(beamsStores);
  const beamOpenStoreInFocusedPane = React.useMemo(() => {
    const open = focusedPaneIndex !== null ? (beamsOpens?.[focusedPaneIndex] ?? false) : false;
    return open ? beamsStores?.[focusedPaneIndex!] ?? null : null;
  }, [beamsOpens, beamsStores, focusedPaneIndex]);

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

  const { mayWork: capabilityHasT2I } = useCapabilityTextToImage();

  const { activeFolderId } = useFolderStore(({ enableFolders, folders }) => {
    const activeFolderId = enableFolders ? _activeFolderId : null;
    const activeFolder = activeFolderId ? folders.find(folder => folder.id === activeFolderId) : null;
    return {
      activeFolderId: activeFolder?.id ?? null,
    };
  });


  // Window actions

  const isMultiPane = chatPanes.length >= 2;
  const isMultiAddable = chatPanes.length < 4;
  const isMultiConversationId = isMultiPane && new Set(chatPanes.map((pane) => pane.conversationId)).size >= 2;
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

  // [effect] Handle the initial conversation intent
  React.useEffect(() => {
    intent.initialConversationId && handleOpenConversationInFocusedPane(intent.initialConversationId);
  }, [handleOpenConversationInFocusedPane, intent.initialConversationId]);

  // [effect] Show snackbar with the focused chat title after a history navigation in focused pane
  React.useEffect(() => {
    if (showNextTitleChange.current) {
      showNextTitleChange.current = false;
      const title = (focusedChatNumber >= 0 ? `#${focusedChatNumber + 1} · ` : '') + (focusedChatTitle || 'New Chat');
      const id = addSnackbar({ key: 'focused-title', message: title, type: 'title' });
      return () => removeSnackbar(id);
    }
  }, [focusedChatNumber, focusedChatTitle]);


  // Execution

  const handleExecuteAndOutcome = React.useCallback(async (chatModeId: ChatModeId, conversationId: DConversationId, history: DMessage[]) => {
    const outcome = await _handleExecute(chatModeId, conversationId, history);
    if (outcome === 'err-no-chatllm')
      openModelsSetup();
    else if (outcome === 'err-t2i-unconfigured')
      openPreferencesTab(PreferencesTab.Draw);
    else if (outcome === 'err-no-persona')
      addSnackbar({ key: 'chat-no-persona', message: 'No persona selected.', type: 'issue' });
    else if (outcome === 'err-no-conversation')
      addSnackbar({ key: 'chat-no-conversation', message: 'No active conversation.', type: 'issue' });
    return outcome === true;
  }, [openModelsSetup, openPreferencesTab]);

  const handleComposerAction = React.useCallback((conversationId: DConversationId, chatModeId: ChatModeId, multiPartMessage: ComposerOutputMultiPart, metadata?: DMessageMetadata): boolean => {
    // validate inputs
    if (multiPartMessage.length !== 1 || multiPartMessage[0].type !== 'text-block') {
      addSnackbar({
        key: 'chat-composer-action-invalid',
        message: 'Only a single text part is supported for now.',
        type: 'issue',
        overrides: {
          autoHideDuration: 2000,
        },
      });
      return false;
    }
    const userText = multiPartMessage[0].text;

    // multicast: send the message to all the panes
    const uniqueConversationIds = new Set([conversationId]);
    if (willMulticast)
      chatPanes.forEach(pane => pane.conversationId && uniqueConversationIds.add(pane.conversationId));

    // we loop to handle both the normal and multicast modes
    let enqueuedAny = false;
    for (const _cId of uniqueConversationIds) {
      const history = getConversation(_cId)?.messages;
      if (!history) continue;

      const newUserMessage = createDMessage('user', userText);
      if (metadata) newUserMessage.metadata = metadata;

      // fire/forget
      void handleExecuteAndOutcome(chatModeId, _cId, [...history, newUserMessage]);
      enqueuedAny = true;
    }
    return enqueuedAny;
  }, [chatPanes, handleExecuteAndOutcome, willMulticast]);

  const handleConversationExecuteHistory = React.useCallback(async (conversationId: DConversationId, history: DMessage[]) => {
    await handleExecuteAndOutcome('generate-text', conversationId, history);
  }, [handleExecuteAndOutcome]);

  const handleMessageRegenerateLastInFocusedPane = React.useCallback(async () => {
    const focusedConversation = getConversation(focusedPaneConversationId);
    if (focusedConversation?.messages?.length) {
      const lastMessage = focusedConversation.messages[focusedConversation.messages.length - 1];
      const history = lastMessage.role === 'assistant' ? focusedConversation.messages.slice(0, -1) : [...focusedConversation.messages];
      await handleExecuteAndOutcome('generate-text', focusedConversation.id, history);
    }
  }, [focusedPaneConversationId, handleExecuteAndOutcome]);

  const handleMessageBeamLastInFocusedPane = React.useCallback(async () => {
    // Ctrl + Shift + B
    const focusedConversation = getConversation(focusedPaneConversationId);
    if (focusedConversation?.messages?.length) {
      const lastMessage = focusedConversation.messages[focusedConversation.messages.length - 1];
      if (lastMessage.role === 'assistant')
        ConversationsManager.getHandler(focusedConversation.id).beamInvoke(focusedConversation.messages.slice(0, -1), [lastMessage], lastMessage.id);
      else if (lastMessage.role === 'user')
        ConversationsManager.getHandler(focusedConversation.id).beamInvoke(focusedConversation.messages, [], null);
    }
  }, [focusedPaneConversationId]);

  const handleTextDiagram = React.useCallback((diagramConfig: DiagramConfig | null) => setDiagramConfig(diagramConfig), []);

  const handleTextImagine = React.useCallback(async (conversationId: DConversationId, messageText: string) => {
    const conversation = getConversation(conversationId);
    if (!conversation)
      return;
    const imaginedPrompt = await imaginePromptFromText(messageText, conversationId) || 'An error sign.';
    await handleExecuteAndOutcome('generate-image', conversationId, [
      ...conversation.messages,
      createDMessage('user', imaginedPrompt),
    ]);
  }, [handleExecuteAndOutcome]);

  const handleTextSpeak = React.useCallback(async (text: string): Promise<void> => {
    await speakText(text);
  }, []);


  // Chat actions

  const handleConversationNewInFocusedPane = React.useCallback((forceNoRecycle?: boolean) => {

    // create conversation (or recycle the existing top-of-stack empty conversation)
    const conversationId = (recycleNewConversationId && !forceNoRecycle)
      ? recycleNewConversationId
      : prependNewConversation(getConversationSystemPurposeId(focusedPaneConversationId) ?? undefined);

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

  const handleFileOpenConversation = React.useCallback(() => {
    openAndLoadConversations(true)
      .then((outcome) => {
        // activate the last (most recent) imported conversation
        if (outcome?.activateConversationId) {
          showNextTitleChange.current = true;
          handleOpenConversationInFocusedPane(outcome.activateConversationId);
        }
      })
      .catch(() => {
        addSnackbar({ key: 'chat-import-fail', message: 'Could not open the file.', type: 'issue' });
      });
  }, [handleOpenConversationInFocusedPane]);

  const handleFileSaveConversation = React.useCallback((conversationId: DConversationId | null) => {
    const conversation = getConversation(conversationId);
    conversation && downloadConversation(conversation, 'json')
      .then(() => {
        addSnackbar({ key: 'chat-save-as-ok', message: 'File saved.', type: 'success' });
      })
      .catch((err: any) => {
        if (err?.name !== 'AbortError')
          addSnackbar({ key: 'chat-save-as-fail', message: `Could not save the file. ${err?.message || ''}`, type: 'issue' });
      });
  }, []);

  const handleConversationBranch = React.useCallback((srcConversationId: DConversationId, messageId: string | null): DConversationId | null => {
    // clone data
    const branchedConversationId = branchConversation(srcConversationId, messageId);

    // if a folder is active, add the new conversation to the folder
    if (activeFolderId && branchedConversationId)
      useFolderStore.getState().addConversationToFolder(activeFolderId, branchedConversationId);

    // replace/open a new pane with this
    showNextTitleChange.current = true;
    if (!isMultiAddable)
      handleOpenConversationInFocusedPane(branchedConversationId);
    else
      handleOpenConversationInSplitPane(branchedConversationId);

    return branchedConversationId;
  }, [activeFolderId, branchConversation, handleOpenConversationInFocusedPane, handleOpenConversationInSplitPane, isMultiAddable]);

  const handleConversationFlatten = React.useCallback((conversationId: DConversationId) => setFlattenConversationId(conversationId), []);

  const handleConfirmedClearConversation = React.useCallback(() => {
    if (clearConversationId) {
      ConversationsManager.getHandler(clearConversationId).messagesReplace([]);
      setClearConversationId(null);
    }
  }, [clearConversationId]);

  const handleConversationClear = React.useCallback((conversationId: DConversationId) => setClearConversationId(conversationId), []);

  const handleDeleteConversations = React.useCallback((conversationIds: DConversationId[], bypassConfirmation: boolean) => {
    if (!bypassConfirmation)
      return setDeleteConversationIds(conversationIds);

    // perform deletion, and return the next (or a new) conversation
    const nextConversationId = deleteConversations(conversationIds, /*focusedSystemPurposeId ??*/ undefined);

    // switch the focused pane to the new conversation - NOTE: this makes the assumption that deletion had impact on the focused pane
    handleOpenConversationInFocusedPane(nextConversationId);

    setDeleteConversationIds(null);
  }, [deleteConversations, handleOpenConversationInFocusedPane]);

  const handleConfirmedDeleteConversations = React.useCallback(() => {
    !!deleteConversationIds?.length && handleDeleteConversations(deleteConversationIds, true);
  }, [deleteConversationIds, handleDeleteConversations]);


  // Shortcuts

  const handleOpenChatLlmOptions = React.useCallback(() => {
    const chatLLMId = getChatLLMId();
    if (!chatLLMId) return;
    openLlmOptions(chatLLMId);
  }, [openLlmOptions]);

  const shortcuts = React.useMemo((): GlobalShortcutDefinition[] => [
    // focused conversation
    ['b', true, true, false, handleMessageBeamLastInFocusedPane],
    ['g', true, true, false, handleMessageRegenerateLastInFocusedPane],
    ['o', true, false, false, handleFileOpenConversation],
    ['s', true, false, false, () => handleFileSaveConversation(focusedPaneConversationId)],
    ['n', true, true, false, handleConversationNewInFocusedPane],
    ['x', true, true, false, () => isFocusedChatEmpty || (focusedPaneConversationId && handleConversationClear(focusedPaneConversationId))],
    ['d', true, true, false, () => focusedPaneConversationId && handleDeleteConversations([focusedPaneConversationId], false)],
    ['[', true, false, false, () => handleNavigateHistoryInFocusedPane('back')],
    [']', true, false, false, () => handleNavigateHistoryInFocusedPane('forward')],
    // global
    ['o', true, true, false, handleOpenChatLlmOptions],
    ['+', true, true, false, useUIPreferencesStore.getState().increaseContentScaling],
    ['-', true, true, false, useUIPreferencesStore.getState().decreaseContentScaling],
  ], [focusedPaneConversationId, handleConversationClear, handleConversationNewInFocusedPane, handleFileOpenConversation, handleFileSaveConversation, handleDeleteConversations, handleMessageBeamLastInFocusedPane, handleMessageRegenerateLastInFocusedPane, handleNavigateHistoryInFocusedPane, handleOpenChatLlmOptions, isFocusedChatEmpty]);
  useGlobalShortcuts(shortcuts);


  // Pluggable Optima components

  const barAltTitle = showAltTitleBar ? focusedChatTitle ?? 'No Chat' : null;

  const focusedBarContent = React.useMemo(() => beamOpenStoreInFocusedPane
      ? <ChatBarAltBeam beamStore={beamOpenStoreInFocusedPane} isMobile={isMobile} />
      : (barAltTitle === null)
        ? <ChatBarDropdowns conversationId={focusedPaneConversationId} />
        : <ChatBarAltTitle conversationId={focusedPaneConversationId} conversationTitle={barAltTitle} />
    , [barAltTitle, beamOpenStoreInFocusedPane, focusedPaneConversationId, isMobile],
  );

  const drawerContent = React.useMemo(() =>
      <ChatDrawerMemo
        isMobile={isMobile}
        activeConversationId={focusedPaneConversationId}
        activeFolderId={activeFolderId}
        chatPanesConversationIds={chatPanes.map(pane => pane.conversationId).filter(Boolean) as DConversationId[]}
        disableNewButton={disableNewButton}
        onConversationActivate={handleOpenConversationInFocusedPane}
        onConversationBranch={handleConversationBranch}
        onConversationNew={handleConversationNewInFocusedPane}
        onConversationsDelete={handleDeleteConversations}
        onConversationsExportDialog={handleConversationExport}
        onConversationsImportDialog={handleConversationImportDialog}
        setActiveFolderId={setActiveFolderId}
      />,
    [activeFolderId, chatPanes, disableNewButton, focusedPaneConversationId, handleConversationBranch, handleConversationExport, handleConversationImportDialog, handleConversationNewInFocusedPane, handleDeleteConversations, handleOpenConversationInFocusedPane, isMobile],
  );

  const focusedMenuItems = React.useMemo(() =>
      <ChatPageMenuItems
        isMobile={isMobile}
        conversationId={focusedPaneConversationId}
        disableItems={!focusedPaneConversationId || isFocusedChatEmpty}
        hasConversations={hasConversations}
        isMessageSelectionMode={isMessageSelectionMode}
        onConversationBranch={handleConversationBranch}
        onConversationClear={handleConversationClear}
        onConversationFlatten={handleConversationFlatten}
        // onConversationNew={handleConversationNewInFocusedPane}
        setIsMessageSelectionMode={setIsMessageSelectionMode}
      />,
    [focusedPaneConversationId, handleConversationBranch, handleConversationClear, handleConversationFlatten, hasConversations, isFocusedChatEmpty, isMessageSelectionMode, isMobile],
  );

  usePluggableOptimaLayout(drawerContent, focusedBarContent, focusedMenuItems, 'AppChat');


  return <>

    <PanelGroup
      direction={isMobile ? 'vertical' : 'horizontal'}
      id='app-chat-panels'
    >

      {chatPanes.map((pane, idx) => {
        const _paneIsFocused = idx === focusedPaneIndex;
        const _paneConversationId = pane.conversationId;
        const _paneChatHandler = chatHandlers[idx] ?? null;
        const _paneBeamStore = beamsStores[idx] ?? null;
        const _paneBeamIsOpen = !!beamsOpens?.[idx] && !!_paneBeamStore;
        const _panesCount = chatPanes.length;
        const _keyAndId = `chat-pane-${pane.paneId}`;
        const _sepId = `sep-pane-${idx}`;
        return <React.Fragment key={_keyAndId}>

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
            }}
          >

            <ScrollToBottom
              bootToBottom
              stickToBottomInitial
              sx={{ display: 'flex', flexDirection: 'column' }}
            >

              {!_paneBeamIsOpen && (
                <ChatMessageList
                  conversationId={_paneConversationId}
                  conversationHandler={_paneChatHandler}
                  capabilityHasT2I={capabilityHasT2I}
                  chatLLMContextTokens={chatLLM?.contextTokens ?? null}
                  fitScreen={isMobile || isMultiPane}
                  isMessageSelectionMode={isMessageSelectionMode}
                  setIsMessageSelectionMode={setIsMessageSelectionMode}
                  onConversationBranch={handleConversationBranch}
                  onConversationExecuteHistory={handleConversationExecuteHistory}
                  onTextDiagram={handleTextDiagram}
                  onTextImagine={handleTextImagine}
                  onTextSpeak={handleTextSpeak}
                  sx={{
                    flexGrow: 1,
                  }}
                />
              )}

              {_paneBeamIsOpen && (
                <ChatBeamWrapper
                  beamStore={_paneBeamStore}
                  isMobile={isMobile}
                  inlineSx={{
                    flexGrow: 1,
                    // minHeight: 'calc(100vh - 69px - var(--AGI-Nav-width))',
                  }}
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

        </React.Fragment>;
      })}

    </PanelGroup>

    <Composer
      isMobile={isMobile}
      chatLLM={chatLLM}
      composerTextAreaRef={composerTextAreaRef}
      conversationId={focusedPaneConversationId}
      capabilityHasT2I={capabilityHasT2I}
      isMulticast={!isMultiConversationId ? null : isComposerMulticast}
      isDeveloperMode={isFocusedChatDeveloper}
      onAction={handleComposerAction}
      onTextImagine={handleTextImagine}
      setIsMulticast={setIsComposerMulticast}
      sx={beamOpenStoreInFocusedPane ? composerClosedSx : composerOpenSx}
    />

    {/* Diagrams */}
    {!!diagramConfig && <DiagramsModal config={diagramConfig} onClose={() => setDiagramConfig(null)} />}

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

    {/* [confirmation] Reset Conversation */}
    {!!clearConversationId && (
      <ConfirmationModal
        open onClose={() => setClearConversationId(null)} onPositive={handleConfirmedClearConversation}
        confirmationText='Are you sure you want to discard all messages?'
        positiveActionText='Clear conversation'
      />
    )}

    {/* [confirmation] Delete All */}
    {!!deleteConversationIds?.length && (
      <ConfirmationModal
        open onClose={() => setDeleteConversationIds(null)} onPositive={handleConfirmedDeleteConversations}
        confirmationText={`Are you absolutely sure you want to delete ${deleteConversationIds.length === 1 ? 'this conversation' : 'these conversations'}? This action cannot be undone.`}
        positiveActionText={deleteConversationIds.length === 1 ? 'Delete conversation' : `Yes, delete all ${deleteConversationIds.length} conversations`}
      />
    )}

  </>;
}
