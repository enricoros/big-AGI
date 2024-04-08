import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useTheme } from '@mui/joy';

import { DiagramConfig, DiagramsModal } from '~/modules/aifn/digrams/DiagramsModal';
import { FlattenerModal } from '~/modules/aifn/flatten/FlattenerModal';
import { TradeConfig, TradeModal } from '~/modules/trade/TradeModal';
import { getChatLLMId, useChatLLM } from '~/modules/llms/store-llms';
import { imaginePromptFromText } from '~/modules/aifn/imagine/imaginePromptFromText';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useAreBeamsOpen } from '~/modules/beam/store-beam.hooks';
import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { GlobalShortcutItem, ShortcutKeyName, useGlobalShortcuts } from '~/common/components/useGlobalShortcut';
import { PanelResizeInset } from '~/common/components/panes/GoodPanelResizeHandler';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { addSnackbar, removeSnackbar } from '~/common/components/useSnackbarsStore';
import { createDMessage, DConversationId, DMessage, getConversation, getConversationSystemPurposeId, useConversation } from '~/common/state/store-chats';
import { getUXLabsHighPerformance, useUXLabsStore } from '~/common/state/store-ux-labs';
import { themeBgAppChatComposer } from '~/common/app.theme';
import { useFolderStore } from '~/common/state/store-folders';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useOptimaLayout, usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { useRouterQuery } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import type { ComposerOutputMultiPart } from './components/composer/composer.types';
import { ChatBarAltBeam } from './components/ChatBarAltBeam';
import { ChatBarAltTitle } from './components/ChatBarAltTitle';
import { ChatBarDropdowns } from './components/ChatBarDropdowns';
import { ChatBeamWrapper } from './components/ChatBeamWrapper';
import { ChatDrawerMemo } from './components/ChatDrawer';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatPageMenuItems } from './components/ChatPageMenuItems';
import { Composer } from './components/composer/Composer';
import { getInstantAppChatPanesCount, usePanesManager } from './components/panes/usePanesManager';

import { DEV_MODE_SETTINGS } from '../settings-modal/UxLabsSettings';
import { extractChatCommand, findAllChatCommands } from './commands/commands.registry';
import { runAssistantUpdatingState } from './editors/chat-stream';
import { runBrowseGetPageUpdatingState } from './editors/browse-load';
import { runImageGenerationUpdatingState } from './editors/image-generate';
import { runReActUpdatingState } from './editors/react-tangent';


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

  const { openLlmOptions } = useOptimaLayout();

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

  const _handleExecute = React.useCallback(async (chatModeId: ChatModeId, conversationId: DConversationId, history: DMessage[]): Promise<void> => {
    const chatLLMId = getChatLLMId();
    if (!chatModeId || !conversationId || !chatLLMId) return;

    // Update the system message from the active persona to the history
    // NOTE: this does NOT call setMessages anymore (optimization). make sure to:
    //       1. all the callers need to pass a new array
    //       2. all the exit points need to call setMessages
    const cHandler = ConversationsManager.getHandler(conversationId);
    cHandler.inlineUpdatePurposeInHistory(history, chatLLMId);

    // Valid /commands are intercepted here, and override chat modes, generally for mechanics or sidebars
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastMessage?.role === 'user') {
      const chatCommand = extractChatCommand(lastMessage.text)[0];
      if (chatCommand && chatCommand.type === 'cmd') {
        switch (chatCommand.providerId) {
          case 'ass-browse':
            cHandler.messagesReplace(history); // show command
            return await runBrowseGetPageUpdatingState(cHandler, chatCommand.params);

          case 'ass-t2i':
            cHandler.messagesReplace(history); // show command
            return await runImageGenerationUpdatingState(cHandler, chatCommand.params);

          case 'ass-react':
            cHandler.messagesReplace(history); // show command
            return await runReActUpdatingState(cHandler, chatCommand.params, chatLLMId);

          case 'chat-alter':
            // /clear
            if (chatCommand.command === '/clear') {
              if (chatCommand.params === 'all')
                return cHandler.messagesReplace([]);
              cHandler.messagesReplace(history);
              cHandler.messageAppendAssistant('Issue: this command requires the \'all\' parameter to confirm the operation.', undefined, 'issue', false);
              return;
            }
            // /assistant, /system
            Object.assign(lastMessage, {
              role: chatCommand.command.startsWith('/s') ? 'system' : chatCommand.command.startsWith('/a') ? 'assistant' : 'user',
              sender: 'Bot',
              text: chatCommand.params || '',
            } satisfies Partial<DMessage>);
            return cHandler.messagesReplace(history);

          case 'cmd-help':
            const chatCommandsText = findAllChatCommands()
              .map(cmd => ` - ${cmd.primary}` + (cmd.alternatives?.length ? ` (${cmd.alternatives.join(', ')})` : '') + `: ${cmd.description}`)
              .join('\n');
            cHandler.messagesReplace(history);
            cHandler.messageAppendAssistant('Available Chat Commands:\n' + chatCommandsText, undefined, 'help', false);
            return;

          case 'mode-beam':
            if (chatCommand.isError)
              return cHandler.messagesReplace(history);
            // remove '/beam ', as we want to be a user chat message
            Object.assign(lastMessage, { text: chatCommand.params || '' });
            cHandler.messagesReplace(history);
            return ConversationsManager.getHandler(conversationId).beamInvoke(history, [], null);

          default:
            return cHandler.messagesReplace([...history, createDMessage('assistant', 'This command is not supported.')]);
        }
      }
    }


    // get the system purpose (note: we don't react to it, or it would invalidate half UI components..)
    if (!getConversationSystemPurposeId(conversationId)) {
      cHandler.messagesReplace(history);
      cHandler.messageAppendAssistant('Issue: no Persona selected.', undefined, 'issue', false);
      return;
    }

    // synchronous long-duration tasks, which update the state as they go
    switch (chatModeId) {
      case 'generate-text':
        cHandler.messagesReplace(history);
        return await runAssistantUpdatingState(conversationId, history, chatLLMId, getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount());

      case 'generate-text-beam':
        cHandler.messagesReplace(history);
        return cHandler.beamInvoke(history, [], null);

      case 'append-user':
        return cHandler.messagesReplace(history);

      case 'generate-image':
        if (!lastMessage?.text) break;
        // also add a 'fake' user message with the '/draw' command
        cHandler.messagesReplace(history.map(message => (message.id !== lastMessage.id) ? message : {
          ...message,
          text: `/draw ${lastMessage.text}`,
        }));
        return await runImageGenerationUpdatingState(cHandler, lastMessage.text);

      case 'generate-react':
        if (!lastMessage?.text) break;
        cHandler.messagesReplace(history);
        return await runReActUpdatingState(cHandler, lastMessage.text, chatLLMId);
    }

    // ISSUE: if we're here, it means we couldn't do the job, at least sync the history
    console.log('Chat execute: issue running', chatModeId, conversationId, lastMessage);
    cHandler.messagesReplace(history);
  }, []);

  const handleComposerAction = React.useCallback((chatModeId: ChatModeId, conversationId: DConversationId, multiPartMessage: ComposerOutputMultiPart): boolean => {
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
    const uniqueIds = new Set([conversationId]);
    if (willMulticast)
      chatPanes.forEach(pane => pane.conversationId && uniqueIds.add(pane.conversationId));

    // we loop to handle both the normal and multicast modes
    let enqueued = false;
    for (const _cId of uniqueIds) {
      const _conversation = getConversation(_cId);
      if (_conversation) {
        // start execution fire/forget
        void _handleExecute(chatModeId, _cId, [..._conversation.messages, createDMessage('user', userText)]);
        enqueued = true;
      }
    }
    return enqueued;
  }, [chatPanes, willMulticast, _handleExecute]);

  const handleConversationExecuteHistory = React.useCallback(async (conversationId: DConversationId, history: DMessage[]): Promise<void> => {
    await _handleExecute('generate-text', conversationId, history);
  }, [_handleExecute]);

  const handleMessageRegenerateLastInFocusedPane = React.useCallback(async () => {
    const focusedConversation = getConversation(focusedPaneConversationId);
    if (focusedConversation?.messages?.length) {
      const lastMessage = focusedConversation.messages[focusedConversation.messages.length - 1];
      const history = lastMessage.role === 'assistant' ? focusedConversation.messages.slice(0, -1) : [...focusedConversation.messages];
      return await _handleExecute('generate-text', focusedConversation.id, history);
    }
  }, [_handleExecute, focusedPaneConversationId]);

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

  const handleTextImagine = React.useCallback(async (conversationId: DConversationId, messageText: string): Promise<void> => {
    const conversation = getConversation(conversationId);
    if (!conversation)
      return;
    const imaginedPrompt = await imaginePromptFromText(messageText) || 'An error sign.';
    return await _handleExecute('generate-image', conversationId, [
      ...conversation.messages,
      createDMessage('user', imaginedPrompt),
    ]);
  }, [_handleExecute]);

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

  const shortcuts = React.useMemo((): GlobalShortcutItem[] => [
    // focused conversation
    ['b', true, true, false, handleMessageBeamLastInFocusedPane],
    ['r', true, true, false, handleMessageRegenerateLastInFocusedPane],
    ['n', true, false, true, handleConversationNewInFocusedPane],
    ['b', true, false, true, () => isFocusedChatEmpty || (focusedPaneConversationId && handleConversationBranch(focusedPaneConversationId, null))],
    ['x', true, false, true, () => isFocusedChatEmpty || (focusedPaneConversationId && handleConversationClear(focusedPaneConversationId))],
    ['d', true, false, true, () => focusedPaneConversationId && handleDeleteConversations([focusedPaneConversationId], false)],
    [ShortcutKeyName.Left, true, false, true, () => handleNavigateHistoryInFocusedPane('back')],
    [ShortcutKeyName.Right, true, false, true, () => handleNavigateHistoryInFocusedPane('forward')],
    // global
    ['o', true, true, false, handleOpenChatLlmOptions],
    ['+', true, true, false, useUIPreferencesStore.getState().increaseContentScaling],
    ['-', true, true, false, useUIPreferencesStore.getState().decreaseContentScaling],
  ], [focusedPaneConversationId, handleConversationBranch, handleConversationClear, handleConversationNewInFocusedPane, handleDeleteConversations, handleMessageBeamLastInFocusedPane, handleMessageRegenerateLastInFocusedPane, handleNavigateHistoryInFocusedPane, handleOpenChatLlmOptions, isFocusedChatEmpty]);
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
        const _paneChatBeamStore = beamsStores[idx] ?? null;
        const _paneChatBeamIsOpen = !!beamsOpens?.[idx];
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
              sx={_paneChatBeamIsOpen ? { display: 'none' } : undefined}
            >

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
                  minHeight: '100%', // ensures filling of the blank space on newer chats
                }}
              />

              {/*<Ephemerals*/}
              {/*  conversationId={_paneConversationId}*/}
              {/*  sx={{*/}
              {/*    // TODO: Fixme post panels?*/}
              {/*    // flexGrow: 0.1,*/}
              {/*    flexShrink: 0.5,*/}
              {/*    overflowY: 'auto',*/}
              {/*    minHeight: 64,*/}
              {/*  }}*/}
              {/*/>*/}

              {/* Visibility and actions are handled via Context */}
              <ScrollToBottomButton />

            </ScrollToBottom>

            {(_paneChatBeamIsOpen && !!_paneChatBeamStore) && (
              <ChatBeamWrapper beamStore={_paneChatBeamStore} isMobile={isMobile} />
            )}

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
      sx={beamOpenStoreInFocusedPane ? {
        display: 'none',
      } : {
        zIndex: 21, // just to allocate a surface, and potentially have a shadow
        backgroundColor: themeBgAppChatComposer,
        borderTop: `1px solid`,
        borderTopColor: 'divider',
        p: { xs: 1, md: 2 },
      }}
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
