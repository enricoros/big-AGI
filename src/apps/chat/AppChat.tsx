import * as React from 'react';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import { Panel, PanelGroup } from 'react-resizable-panels';

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
import { GoodPanelResizeHandler } from '~/common/components/panes/GoodPanelResizeHandler';
import { addSnackbar, removeSnackbar } from '~/common/components/useSnackbarsStore';
import { createDMessage, DConversationId, DMessage, getConversation, useConversation } from '~/common/state/store-chats';
import { themeBgAppChatComposer } from '~/common/app.theme';
import { useFolderStore } from '~/common/state/store-folders';
import { useOptimaLayout, usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import type { ComposerOutputMultiPart } from './components/composer/composer.types';
import { ChatDrawerMemo } from './components/applayout/ChatDrawer';
import { ChatDropdowns } from './components/applayout/ChatDropdowns';
import { ChatMenuItems } from './components/applayout/ChatMenuItems';
import { ChatMessageList } from './components/ChatMessageList';
import { Composer } from './components/composer/Composer';
import { Ephemerals } from './components/Ephemerals';
import { ScrollToBottom } from './components/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from './components/scroll-to-bottom/ScrollToBottomButton';
import { usePanesManager } from './components/panes/usePanesManager';

import { extractChatCommand, findAllChatCommands } from './commands/commands.registry';
import { runAssistantUpdatingState } from './editors/chat-stream';
import { runBrowseUpdatingState } from './editors/browse-load';
import { runImageGenerationUpdatingState } from './editors/image-generate';
import { runReActUpdatingState } from './editors/react-tangent';

/**
 * Mode: how to treat the input from the Composer
 */
export type ChatModeId =
  | 'generate-text'
  | 'append-user'
  | 'generate-image'
  | 'generate-react';


const SPECIAL_ID_WIPE_ALL: DConversationId = 'wipe-chats';

export function AppChat() {

  // state
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [diagramConfig, setDiagramConfig] = React.useState<DiagramConfig | null>(null);
  const [tradeConfig, setTradeConfig] = React.useState<TradeConfig | null>(null);
  const [clearConversationId, setClearConversationId] = React.useState<DConversationId | null>(null);
  const [deleteConversationId, setDeleteConversationId] = React.useState<DConversationId | null>(null);
  const [flattenConversationId, setFlattenConversationId] = React.useState<DConversationId | null>(null);
  const showNextTitle = React.useRef(false);
  const composerTextAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [_activeFolderId, setActiveFolderId] = React.useState<string | null>(null);

  // external state
  const theme = useTheme();

  const { openLlmOptions } = useOptimaLayout();

  const { chatLLM } = useChatLLM();

  const {
    chatPanes,
    focusedConversationId,
    navigateHistoryInFocusedPane,
    openConversationInFocusedPane,
    openConversationInSplitPane,
    paneIndex,
    duplicatePane,
    removePane,
    setFocusedPane,
  } = usePanesManager();

  const {
    title: focusedChatTitle,
    chatIdx: focusedChatNumber,
    isChatEmpty: isFocusedChatEmpty,
    areChatsEmpty,
    newConversationId,
    conversationsLength,
    _remove_systemPurposeId: focusedSystemPurposeId,
    prependNewConversation,
    branchConversation,
    deleteConversation,
    wipeAllConversations,
    setMessages,
  } = useConversation(focusedConversationId);

  const { mayWork: capabilityHasT2I } = useCapabilityTextToImage();

  const { activeFolderId, activeFolderConversationsCount } = useFolderStore(({ enableFolders, folders }) => {
    const activeFolderId = enableFolders ? _activeFolderId : null;
    const activeFolder = activeFolderId ? folders.find(folder => folder.id === activeFolderId) : null;
    return {
      activeFolderId: activeFolder?.id ?? null,
      activeFolderConversationsCount: activeFolder ? activeFolder.conversationIds.length : conversationsLength,
    };
  });

  // Window actions

  const panesConversationIDs = chatPanes.length > 0 ? chatPanes.map((pane) => pane.conversationId) : [null];
  const isSplitPane = chatPanes.length > 1;

  const setFocusedConversationId = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInFocusedPane(conversationId);
  }, [openConversationInFocusedPane]);

  const openSplitConversationId = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInSplitPane(conversationId);
  }, [openConversationInSplitPane]);

  const toggleSplitPane = React.useCallback(() => {
    if (isSplitPane)
      removePane(paneIndex ?? chatPanes.length - 1);
    else
      duplicatePane(paneIndex ?? chatPanes.length - 1);
  }, [chatPanes.length, duplicatePane, isSplitPane, paneIndex, removePane]);

  const handleNavigateHistory = React.useCallback((direction: 'back' | 'forward') => {
    if (navigateHistoryInFocusedPane(direction))
      showNextTitle.current = true;
  }, [navigateHistoryInFocusedPane]);

  React.useEffect(() => {
    if (showNextTitle.current) {
      showNextTitle.current = false;
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
          return await runAssistantUpdatingState(conversationId, history, chatLLMId, focusedSystemPurposeId);

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

  const handleComposerAction = (chatModeId: ChatModeId, conversationId: DConversationId, multiPartMessage: ComposerOutputMultiPart): boolean => {
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

    // find conversation
    const conversation = getConversation(conversationId);
    if (!conversation)
      return false;

    // start execution (async)
    void _handleExecute(chatModeId, conversationId, [
      ...conversation.messages,
      createDMessage('user', userText),
    ]);
    return true;
  };

  const handleConversationExecuteHistory = React.useCallback(async (conversationId: DConversationId, history: DMessage[]): Promise<void> => {
    await _handleExecute('generate-text', conversationId, history);
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

  const handleConversationNew = React.useCallback(() => {

    // activate an existing new conversation if present, or create another
    const conversationId = newConversationId
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

  const handleConversationExport = React.useCallback((conversationId: DConversationId | null) => setTradeConfig({ dir: 'export', conversationId }), []);

  const handleConversationBranch = React.useCallback((conversationId: DConversationId, messageId: string | null): DConversationId | null => {
    showNextTitle.current = true;
    const branchedConversationId = branchConversation(conversationId, messageId);
    addSnackbar({
      key: 'branch-conversation',
      message: 'Branch started.',
      type: 'success',
      overrides: {
        autoHideDuration: 3000,
        startDecorator: <ForkRightIcon />,
      },
    });
    const branchInAltPanel = useUXLabsStore.getState().labsSplitBranching;
    if (branchInAltPanel)
      openSplitConversationId(branchedConversationId);
    else
      setFocusedConversationId(branchedConversationId);
    return branchedConversationId;
  }, [branchConversation, openSplitConversationId, setFocusedConversationId]);

  const handleConversationFlatten = (conversationId: DConversationId) => setFlattenConversationId(conversationId);

  const handleConfirmedClearConversation = React.useCallback(() => {
    if (clearConversationId) {
      setMessages(clearConversationId, []);
      setClearConversationId(null);
    }
  }, [clearConversationId, setMessages]);

  const handleConversationClear = React.useCallback((conversationId: DConversationId) => setClearConversationId(conversationId), []);

  const handleConfirmedDeleteConversation = () => {
    if (deleteConversationId) {
      let nextConversationId: DConversationId | null;
      if (deleteConversationId === SPECIAL_ID_WIPE_ALL)
        nextConversationId = wipeAllConversations(focusedSystemPurposeId ?? undefined, activeFolderId);
      else
        nextConversationId = deleteConversation(deleteConversationId);
      setFocusedConversationId(nextConversationId);
      setDeleteConversationId(null);
    }
  };

  const handleConversationsDeleteAll = React.useCallback(() => setDeleteConversationId(SPECIAL_ID_WIPE_ALL), []);

  const handleConversationDelete = React.useCallback(
    (conversationId: DConversationId, bypassConfirmation: boolean) => {
      if (bypassConfirmation) setFocusedConversationId(deleteConversation(conversationId));
      else setDeleteConversationId(conversationId);
    },
    [deleteConversation, setFocusedConversationId],
  );

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
    ['d', true, false, true, () => focusedConversationId && handleConversationDelete(focusedConversationId, false)],
    [ShortcutKeyName.Left, true, false, true, () => handleNavigateHistory('back')],
    [ShortcutKeyName.Right, true, false, true, () => handleNavigateHistory('forward')],
  ], [focusedConversationId, handleConversationBranch, handleConversationClear, handleConversationDelete, handleConversationNew, handleMessageRegenerateLast, handleNavigateHistory, handleOpenChatLlmOptions, isFocusedChatEmpty]);
  useGlobalShortcuts(shortcuts);

  // Pluggable ApplicationBar components

  const centerItems = React.useMemo(() =>
      <ChatDropdowns
        conversationId={focusedConversationId}
        isSplitPanes={isSplitPane}
        onToggleSplitPanes={toggleSplitPane}
      />,
    [focusedConversationId, isSplitPane, toggleSplitPane],
  );

  const drawerContent = React.useMemo(() =>
      <ChatDrawerMemo
        activeConversationId={focusedConversationId}
        activeFolderId={activeFolderId}
        disableNewButton={isFocusedChatEmpty}
        onConversationActivate={setFocusedConversationId}
        onConversationDelete={handleConversationDelete}
        onConversationExportDialog={handleConversationExport}
        onConversationImportDialog={handleConversationImportDialog}
        onConversationNew={handleConversationNew}
        onConversationsDeleteAll={handleConversationsDeleteAll}
        setActiveFolderId={setActiveFolderId}
      />,
    [activeFolderId, focusedConversationId, handleConversationDelete, handleConversationExport, handleConversationImportDialog, handleConversationNew, handleConversationsDeleteAll, isFocusedChatEmpty, setFocusedConversationId],
  );

  const menuItems = React.useMemo(() =>
      <ChatMenuItems
        conversationId={focusedConversationId}
        hasConversations={!areChatsEmpty}
        isConversationEmpty={isFocusedChatEmpty}
        isMessageSelectionMode={isMessageSelectionMode}
        setIsMessageSelectionMode={setIsMessageSelectionMode}
        onConversationBranch={handleConversationBranch}
        onConversationClear={handleConversationClear}
        onConversationFlatten={handleConversationFlatten}
      />,
    [areChatsEmpty, focusedConversationId, handleConversationBranch, handleConversationClear, isFocusedChatEmpty, isMessageSelectionMode],
  );

  usePluggableOptimaLayout(drawerContent, centerItems, menuItems, 'AppChat');

  return <>

    <PanelGroup
      direction='horizontal'
      id='app-chat-panels'
    >

      {panesConversationIDs.map((_conversationId, idx, panels) =>
        <React.Fragment key={`chat-pane-${idx}-${panels.length}-${_conversationId}`}>
          <Panel
            id={'chat-pane-' + _conversationId}
            order={idx}
            collapsible
            defaultSize={panels.length > 0 ? Math.round(100 / panels.length) : undefined}
            minSize={20}
            onClick={(event) => {
              const setFocus = chatPanes.length < 2 || !event.altKey;
              setFocusedPane(setFocus ? idx : -1);
            }}
            onCollapse={() => setTimeout(() => removePane(idx), 50)}
            style={{
              // for anchoring the scroll button in place
              position: 'relative',
              // border only for active pane (if two or more panes)
              ...(panesConversationIDs.length < 2
                ? {}
                : (_conversationId === focusedConversationId)
                  ? { border: `2px solid ${theme.palette.primary.solidBg}` }
                  : { border: `2px solid ${theme.palette.background.level1}` }),
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
                conversationId={_conversationId}
                capabilityHasT2I={capabilityHasT2I}
                chatLLMContextTokens={chatLLM?.contextTokens ?? null}
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

              <Ephemerals
                conversationId={_conversationId}
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
          {idx < panels.length - 1 && <GoodPanelResizeHandler />}

        </React.Fragment>)}

    </PanelGroup>

    <Composer
      chatLLM={chatLLM}
      composerTextAreaRef={composerTextAreaRef}
      conversationId={focusedConversationId}
      capabilityHasT2I={capabilityHasT2I}
      isDeveloperMode={focusedSystemPurposeId === 'Developer'}
      onAction={handleComposerAction}
      onTextImagine={handleTextImagine}
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
        open
        onClose={() => setClearConversationId(null)}
        onPositive={handleConfirmedClearConversation}
        confirmationText='Are you sure you want to discard all messages?'
        positiveActionText='Clear conversation'
      />
    )}

    {/* [confirmation] Delete All */}
    {!!deleteConversationId && <ConfirmationModal
      open onClose={() => setDeleteConversationId(null)} onPositive={handleConfirmedDeleteConversation}
      confirmationText={deleteConversationId === SPECIAL_ID_WIPE_ALL
        ? `Are you absolutely sure you want to delete ${activeFolderId ? 'ALL conversations in this folder' : 'ALL conversations'}? This action cannot be undone.`
        : 'Are you sure you want to delete this conversation?'}
      positiveActionText={deleteConversationId === SPECIAL_ID_WIPE_ALL
        ? `Yes, delete all ${activeFolderConversationsCount} conversations`
        : 'Delete conversation'}
    />}
  </>;
}
