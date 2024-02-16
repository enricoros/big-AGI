import * as React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useTheme } from '@mui/joy';

import { DiagramConfig, DiagramsModal } from '~/modules/aifn/digrams/DiagramsModal';
import { FlattenerModal } from '~/modules/aifn/flatten/FlattenerModal';
import { TradeConfig, TradeModal } from '~/modules/trade/TradeModal';
import { getChatLLMId, useChatLLM } from '~/modules/llms/store-llms';
import { imaginePromptFromText } from '~/modules/aifn/imagine/imaginePromptFromText';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { Brand } from '~/common/app.config';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { GlobalShortcutItem, ShortcutKeyName, useGlobalShortcuts } from '~/common/components/useGlobalShortcut';
import { PanelResizeInset } from '~/common/components/panes/GoodPanelResizeHandler';
import { addSnackbar, removeSnackbar } from '~/common/components/useSnackbarsStore';
import { createDMessage, DConversationId, DMessage, getConversation, useConversation } from '~/common/state/store-chats';
import { getUXLabsHighPerformance, useUXLabsStore } from '~/common/state/store-ux-labs';
import { themeBgAppChatComposer } from '~/common/app.theme';
import { useFolderStore } from '~/common/state/store-folders';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useOptimaLayout, usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import type { ComposerOutputMultiPart } from './components/composer/composer.types';
import { ChatDrawerMemo } from './components/ChatDrawer';
import { ChatDropdowns } from './components/ChatDropdowns';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatPageMenuItems } from './components/ChatPageMenuItems';
import { ChatTitle } from './components/ChatTitle';
import { Composer } from './components/composer/Composer';
import { Ephemerals } from './components/Ephemerals';
import { ScrollToBottom } from './components/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from './components/scroll-to-bottom/ScrollToBottomButton';
import { getInstantAppChatPanesCount, usePanesManager } from './components/panes/usePanesManager';

import { extractChatCommand, findAllChatCommands } from './commands/commands.registry';
import { runAssistantUpdatingState } from './editors/chat-stream';
import { runBrowseUpdatingState } from './editors/browse-load';
import { runImageGenerationUpdatingState } from './editors/image-generate';
import { runReActUpdatingState } from './editors/react-tangent';


// what to say when a chat is new and has no title
export const CHAT_NOVEL_TITLE = 'Chat';


/**
 * Mode: how to treat the input from the Composer
 */
export type ChatModeId =
  | 'generate-text'
  | 'append-user'
  | 'generate-image'
  | 'generate-best-of'
  | 'generate-react';


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

  const showAltTitleBar = useUXLabsStore(state => state.labsChatBarAlt === 'title');

  const { openLlmOptions } = useOptimaLayout();

  const { chatLLM } = useChatLLM();

  const {
    chatPanes,
    focusedConversationId,
    navigateHistoryInFocusedPane,
    openConversationInFocusedPane,
    openConversationInSplitPane,
    focusedPaneIndex,
    removePane,
    setFocusedPane,
  } = usePanesManager();

  const {
    title: focusedChatTitle,
    isChatEmpty: isFocusedChatEmpty,
    areChatsEmpty,
    conversationIdx: focusedChatNumber,
    newConversationId,
    _remove_systemPurposeId: focusedSystemPurposeId,
    prependNewConversation,
    branchConversation,
    deleteConversations,
    setMessages,
  } = useConversation(focusedConversationId);

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

  const setFocusedConversationId = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInFocusedPane(conversationId);
  }, [openConversationInFocusedPane]);

  const openSplitConversationId = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInSplitPane(conversationId);
  }, [openConversationInSplitPane]);

  const handleNavigateHistory = React.useCallback((direction: 'back' | 'forward') => {
    if (navigateHistoryInFocusedPane(direction))
      showNextTitleChange.current = true;
  }, [navigateHistoryInFocusedPane]);

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

    // "/command ...": overrides the chat mode
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastMessage?.role === 'user') {
      const chatCommand = extractChatCommand(lastMessage.text)[0];
      if (chatCommand && chatCommand.type === 'cmd') {
        switch (chatCommand.providerId) {
          case 'ass-browse':
            setMessages(conversationId, history);
            return await runBrowseUpdatingState(conversationId, chatCommand.params!);

          case 'ass-t2i':
            setMessages(conversationId, history);
            return await runImageGenerationUpdatingState(conversationId, chatCommand.params!);

          case 'ass-react':
            setMessages(conversationId, history);
            return await runReActUpdatingState(conversationId, chatCommand.params!, chatLLMId);

          case 'chat-alter':
            if (chatCommand.command === '/clear') {
              if (chatCommand.params === 'all')
                return setMessages(conversationId, []);
              const helpMessage = createDMessage('assistant', 'This command requires the \'all\' parameter to confirm the operation.');
              helpMessage.originLLM = Brand.Title.Base;
              return setMessages(conversationId, [...history, helpMessage]);
            }
            Object.assign(lastMessage, {
              role: chatCommand.command.startsWith('/s') ? 'system' : chatCommand.command.startsWith('/a') ? 'assistant' : 'user',
              sender: 'Bot',
              text: chatCommand.params || '',
            } satisfies Partial<DMessage>);
            return setMessages(conversationId, history);

          case 'cmd-help':
            const chatCommandsText = findAllChatCommands()
              .map(cmd => ` - ${cmd.primary}` + (cmd.alternatives?.length ? ` (${cmd.alternatives.join(', ')})` : '') + `: ${cmd.description}`)
              .join('\n');
            const helpMessage = createDMessage('assistant', 'Available Chat Commands:\n' + chatCommandsText);
            helpMessage.originLLM = Brand.Title.Base;
            return setMessages(conversationId, [...history, helpMessage]);
        }
      }
    }

    // synchronous long-duration tasks, which update the state as they go
    if (chatLLMId && focusedSystemPurposeId) {
      switch (chatModeId) {
        case 'generate-text':
          return await runAssistantUpdatingState(conversationId, history, chatLLMId, focusedSystemPurposeId, getUXLabsHighPerformance() ? 0 : getInstantAppChatPanesCount());

        case 'append-user':
          return setMessages(conversationId, history);

        case 'generate-image':
          if (!lastMessage?.text)
            break;
          // also add a 'fake' user message with the '/draw' command
          setMessages(conversationId, history.map(message => message.id !== lastMessage.id ? message : {
            ...message,
            text: `/draw ${lastMessage.text}`,
          }));
          return await runImageGenerationUpdatingState(conversationId, lastMessage.text);

        case 'generate-react':
          if (!lastMessage?.text)
            break;
          setMessages(conversationId, history);
          return await runReActUpdatingState(conversationId, lastMessage.text, chatLLMId);
      }
    }

    // ISSUE: if we're here, it means we couldn't do the job, at least sync the history
    console.log('handleExecuteConversation: issue running', chatModeId, conversationId, lastMessage);
    setMessages(conversationId, history);
  }, [focusedSystemPurposeId, setMessages]);

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

  const handleConversationExecuteHistory = React.useCallback(async (conversationId: DConversationId, history: DMessage[], effectBestOf: boolean): Promise<void> => {
    await _handleExecute(effectBestOf ? 'generate-best-of' : 'generate-text', conversationId, history);
  }, [_handleExecute]);

  const handleMessageRegenerateLast = React.useCallback(async () => {
    const focusedConversation = getConversation(focusedConversationId);
    if (focusedConversation?.messages?.length) {
      const lastMessage = focusedConversation.messages[focusedConversation.messages.length - 1];
      return await _handleExecute('generate-text', focusedConversation.id, lastMessage.role === 'assistant'
        ? focusedConversation.messages.slice(0, -1)
        : [...focusedConversation.messages],
      );
    }
  }, [focusedConversationId, _handleExecute]);

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

  const handleConversationNew = React.useCallback((forceNoRecycle?: boolean) => {

    // activate an existing new conversation if present, or create another
    const conversationId = (newConversationId && !forceNoRecycle)
      ? newConversationId
      : prependNewConversation(focusedSystemPurposeId ?? undefined);
    setFocusedConversationId(conversationId);

    // if a folder is active, add the new conversation to the folder
    if (activeFolderId && conversationId)
      useFolderStore.getState().addConversationToFolder(activeFolderId, conversationId);

    // focus the composer
    composerTextAreaRef.current?.focus();

  }, [activeFolderId, focusedSystemPurposeId, newConversationId, prependNewConversation, setFocusedConversationId]);

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
    if (isMultiAddable)
      openSplitConversationId(branchedConversationId);
    else
      setFocusedConversationId(branchedConversationId);

    return branchedConversationId;
  }, [activeFolderId, branchConversation, isMultiAddable, openSplitConversationId, setFocusedConversationId]);

  const handleConversationFlatten = React.useCallback((conversationId: DConversationId) => setFlattenConversationId(conversationId), []);

  const handleConfirmedClearConversation = React.useCallback(() => {
    if (clearConversationId) {
      setMessages(clearConversationId, []);
      setClearConversationId(null);
    }
  }, [clearConversationId, setMessages]);

  const handleConversationClear = React.useCallback((conversationId: DConversationId) => setClearConversationId(conversationId), []);

  const handleDeleteConversations = React.useCallback((conversationIds: DConversationId[], bypassConfirmation: boolean) => {
    if (!bypassConfirmation)
      return setDeleteConversationIds(conversationIds);

    // perform deletion
    const nextConversationId = deleteConversations(conversationIds, /*focusedSystemPurposeId ??*/ undefined);

    setFocusedConversationId(nextConversationId);

    setDeleteConversationIds(null);
  }, [deleteConversations, setFocusedConversationId]);

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
    ['o', true, true, false, handleOpenChatLlmOptions],
    ['r', true, true, false, handleMessageRegenerateLast],
    ['n', true, false, true, handleConversationNew],
    ['b', true, false, true, () => isFocusedChatEmpty || (focusedConversationId && handleConversationBranch(focusedConversationId, null))],
    ['x', true, false, true, () => isFocusedChatEmpty || (focusedConversationId && handleConversationClear(focusedConversationId))],
    ['d', true, false, true, () => focusedConversationId && handleDeleteConversations([focusedConversationId], false)],
    ['+', true, true, false, useUIPreferencesStore.getState().increaseContentScaling],
    ['-', true, true, false, useUIPreferencesStore.getState().decreaseContentScaling],
    [ShortcutKeyName.Left, true, false, true, () => handleNavigateHistory('back')],
    [ShortcutKeyName.Right, true, false, true, () => handleNavigateHistory('forward')],
  ], [focusedConversationId, handleConversationBranch, handleConversationClear, handleConversationNew, handleDeleteConversations, handleMessageRegenerateLast, handleNavigateHistory, handleOpenChatLlmOptions, isFocusedChatEmpty]);
  useGlobalShortcuts(shortcuts);

  // Pluggable ApplicationBar components

  const barAltTitle = showAltTitleBar ? focusedChatTitle ?? 'No Chat' : null;

  const barContent = React.useMemo(() =>
      (barAltTitle === null)
        ? <ChatDropdowns conversationId={focusedConversationId} />
        : <ChatTitle conversationId={focusedConversationId} conversationTitle={barAltTitle} />
    , [focusedConversationId, barAltTitle],
  );

  const drawerContent = React.useMemo(() =>
      <ChatDrawerMemo
        isMobile={isMobile}
        activeConversationId={focusedConversationId}
        activeFolderId={activeFolderId}
        chatPanesConversationIds={chatPanes.map(pane => pane.conversationId).filter(Boolean) as DConversationId[]}
        disableNewButton={disableNewButton}
        onConversationActivate={setFocusedConversationId}
        onConversationBranch={handleConversationBranch}
        onConversationNew={handleConversationNew}
        onConversationsDelete={handleDeleteConversations}
        onConversationsExportDialog={handleConversationExport}
        onConversationsImportDialog={handleConversationImportDialog}
        setActiveFolderId={setActiveFolderId}
      />,
    [activeFolderId, chatPanes, disableNewButton, focusedConversationId, handleConversationBranch, handleConversationExport, handleConversationImportDialog, handleConversationNew, handleDeleteConversations, isMobile, setFocusedConversationId],
  );

  const menuItems = React.useMemo(() =>
      <ChatPageMenuItems
        isMobile={isMobile}
        conversationId={focusedConversationId}
        disableItems={!focusedConversationId || isFocusedChatEmpty}
        hasConversations={!areChatsEmpty}
        isMessageSelectionMode={isMessageSelectionMode}
        onConversationBranch={handleConversationBranch}
        onConversationClear={handleConversationClear}
        onConversationFlatten={handleConversationFlatten}
        // onConversationNew={handleConversationNew}
        setIsMessageSelectionMode={setIsMessageSelectionMode}
      />,
    [areChatsEmpty, focusedConversationId, handleConversationBranch, handleConversationClear, handleConversationFlatten, /*handleConversationNew,*/ isFocusedChatEmpty, isMessageSelectionMode, isMobile],
  );

  usePluggableOptimaLayout(drawerContent, barContent, menuItems, 'AppChat');

  return <>

    <PanelGroup
      direction={isMobile ? 'vertical' : 'horizontal'}
      id='app-chat-panels'
    >

      {chatPanes.map((pane, idx) => {
        const _paneConversationId = pane.conversationId;
        const _panesCount = chatPanes.length;
        const _keyAndId = `chat-pane-${idx}-${_paneConversationId}`;
        const _sepId = `sep-pane-${idx}-${_paneConversationId}`;
        return <React.Fragment key={_keyAndId}>

          <Panel
            id={_keyAndId}
            order={idx}
            collapsible={chatPanes.length === 2}
            defaultSize={(_panesCount === 3 && idx === 1) ? 34 : Math.round(100 / _panesCount)}
            minSize={20}
            onClick={(event) => {
              const setFocus = chatPanes.length < 2 || !event.altKey;
              setFocusedPane(setFocus ? idx : -1);
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
                border: `2px solid ${idx === focusedPaneIndex
                  ? ((willMulticast || !isMultiConversationId) ? theme.palette.primary.solidBg : theme.palette.primary.solidBg)
                  : ((willMulticast || !isMultiConversationId) ? theme.palette.warning.softActiveBg : theme.palette.background.level1)}`,
                filter: (!willMulticast && idx !== focusedPaneIndex)
                  ? (!isMultiConversationId ? 'grayscale(66.67%)' /* clone of the same */ : 'grayscale(66.67%)')
                  : undefined,
              } : {}),
            }}
          >

            <ScrollToBottom
              bootToBottom
              stickToBottom
              sx={{
                // allows the content to be scrolled (all browsers)
                overflowY: 'auto',
                // actually make sure this scrolls & fills
                height: '100%',
              }}
            >

              <ChatMessageList
                conversationId={_paneConversationId}
                capabilityHasT2I={capabilityHasT2I}
                chatLLMContextTokens={chatLLM?.contextTokens ?? null}
                isMessageSelectionMode={isMessageSelectionMode}
                isMobile={isMobile}
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

              <Ephemerals
                conversationId={_paneConversationId}
                sx={{
                  // TODO: Fixme post panels?
                  // flexGrow: 0.1,
                  flexShrink: 0.5,
                  overflowY: 'auto',
                  minHeight: 64,
                }}
              />

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
      conversationId={focusedConversationId}
      capabilityHasT2I={capabilityHasT2I}
      isMulticast={!isMultiConversationId ? null : isComposerMulticast}
      isDeveloperMode={focusedSystemPurposeId === 'Developer'}
      onAction={handleComposerAction}
      onTextImagine={handleTextImagine}
      setIsMulticast={setIsComposerMulticast}
      sx={{
        zIndex: 21, // position: 'sticky', bottom: 0,
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
        onConversationActivate={setFocusedConversationId}
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
