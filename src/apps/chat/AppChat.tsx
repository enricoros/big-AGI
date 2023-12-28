import * as React from 'react';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { Box, useTheme } from '@mui/joy';

import { CmdRunBrowse } from '~/modules/browse/browse.client';
import { CmdRunReact } from '~/modules/aifn/react/react';
import { CmdRunT2I, useCapabilityTextToImage } from '~/modules/t2i/t2i.client';
import { DiagramConfig, DiagramsModal } from '~/modules/aifn/digrams/DiagramsModal';
import { FlattenerModal } from '~/modules/aifn/flatten/FlattenerModal';
import { TradeConfig, TradeModal } from '~/modules/trade/TradeModal';
import { imaginePromptFromText } from '~/modules/aifn/imagine/imaginePromptFromText';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';
import { useChatLLM, useModelsStore } from '~/modules/llms/store-llms';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { GlobalShortcutItem, ShortcutKeyName, useGlobalShortcuts } from '~/common/components/useGlobalShortcut';
import { addSnackbar, removeSnackbar } from '~/common/components/useSnackbarsStore';
import { createDMessage, DConversationId, DMessage, getConversation, useConversation } from '~/common/state/store-chats';
import { themeBgApp, themeBgAppChatComposer } from '~/common/app.theme';
import { useOptimaLayout, usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import type { ComposerOutputMultiPart } from './components/composer/composer.types';
import { ChatDrawerItemsMemo } from './components/applayout/ChatDrawerItems';
import { ChatDropdowns } from './components/applayout/ChatDropdowns';
import { ChatMenuItems } from './components/applayout/ChatMenuItems';
import { ChatMessageList } from './components/ChatMessageList';
import { CmdAddRoleMessage, CmdHelp, createCommandsHelpMessage, extractCommands } from './editors/commands';
import { Composer } from './components/composer/Composer';
import { Ephemerals } from './components/Ephemerals';
import { usePanesManager } from './components/panes/usePanesManager';

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
    _remove_systemPurposeId: focusedSystemPurposeId,
    prependNewConversation,
    branchConversation,
    deleteConversation,
    wipeAllConversations,
    setMessages,
  } = useConversation(focusedConversationId);

  const { mayWork: capabilityHasT2I } = useCapabilityTextToImage();


  // Window actions

  const panesConversationIDs = chatPanes.length > 0 ? chatPanes.map(pane => pane.conversationId) : [null];
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

  const _handleExecute = React.useCallback(async (chatModeId: ChatModeId, conversationId: DConversationId, history: DMessage[]) => {
    const { chatLLMId } = useModelsStore.getState();
    if (!chatModeId || !conversationId || !chatLLMId) return;

    // "/command ...": overrides the chat mode
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastMessage?.role === 'user') {
      const pieces = extractCommands(lastMessage.text);
      if (pieces.length == 2 && pieces[0].type === 'cmd' && pieces[1].type === 'text') {
        const [command, prompt] = [pieces[0].value, pieces[1].value];
        if (CmdRunT2I.includes(command)) {
          setMessages(conversationId, history);
          return await runImageGenerationUpdatingState(conversationId, prompt);
        }
        if (CmdRunReact.includes(command) && chatLLMId) {
          setMessages(conversationId, history);
          return await runReActUpdatingState(conversationId, prompt, chatLLMId);
        }
        if (CmdRunBrowse.includes(command) && prompt?.trim() && useBrowseStore.getState().enableCommandBrowse) {
          setMessages(conversationId, history);
          return await runBrowseUpdatingState(conversationId, prompt);
        }
        if (CmdAddRoleMessage.includes(command)) {
          lastMessage.role = command.startsWith('/s') ? 'system' : command.startsWith('/a') ? 'assistant' : 'user';
          lastMessage.sender = 'Bot';
          lastMessage.text = prompt;
          return setMessages(conversationId, history);
        }
        if (CmdHelp.includes(command)) {
          return setMessages(conversationId, [...history, createCommandsHelpMessage()]);
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
          setMessages(conversationId, history.map(message => message.id !== lastMessage.id ? message : {
            ...message,
            text: `${CmdRunT2I[0]} ${lastMessage.text}`,
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

  const handleConversationExecuteHistory = async (conversationId: DConversationId, history: DMessage[]) =>
    await _handleExecute('generate-text', conversationId, history);

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

  const handleTextDiagram = async (diagramConfig: DiagramConfig | null) => setDiagramConfig(diagramConfig);

  const handleTextImagine = async (conversationId: DConversationId, messageText: string) => {
    const conversation = getConversation(conversationId);
    if (!conversation)
      return;
    const imaginedPrompt = await imaginePromptFromText(messageText) || 'An error sign.';
    return await _handleExecute('generate-image', conversationId, [
      ...conversation.messages,
      createDMessage('user', imaginedPrompt),
    ]);
  };

  const handleTextSpeak = async (text: string) => {
    await speakText(text);
  };


  // Chat actions

  const handleConversationNew = React.useCallback(() => {
    // activate an existing new conversation if present, or create another
    setFocusedConversationId(newConversationId
      ? newConversationId
      : prependNewConversation(focusedSystemPurposeId ?? undefined),
    );
    composerTextAreaRef.current?.focus();
  }, [focusedSystemPurposeId, newConversationId, prependNewConversation, setFocusedConversationId]);

  const handleConversationImportDialog = () => setTradeConfig({ dir: 'import' });

  const handleConversationExport = (conversationId: DConversationId | null) => setTradeConfig({ dir: 'export', conversationId });

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

  const handleConversationClear = (conversationId: DConversationId) => setClearConversationId(conversationId);


  const handleConfirmedDeleteConversation = () => {
    if (deleteConversationId) {
      let nextConversationId: DConversationId | null;
      if (deleteConversationId === SPECIAL_ID_WIPE_ALL)
        nextConversationId = wipeAllConversations(focusedSystemPurposeId ?? undefined);
      else
        nextConversationId = deleteConversation(deleteConversationId);
      setFocusedConversationId(nextConversationId);
      setDeleteConversationId(null);
    }
  };

  const handleConversationsDeleteAll = () => setDeleteConversationId(SPECIAL_ID_WIPE_ALL);

  const handleConversationDelete = React.useCallback((conversationId: DConversationId, bypassConfirmation: boolean) => {
    if (bypassConfirmation)
      setFocusedConversationId(deleteConversation(conversationId));
    else
      setDeleteConversationId(conversationId);
  }, [deleteConversation, setFocusedConversationId]);


  // Shortcuts

  const handleOpenChatLlmOptions = React.useCallback(() => {
    const { chatLLMId } = useModelsStore.getState();
    if (!chatLLMId) return;
    openLlmOptions(chatLLMId);
  }, [openLlmOptions]);

  const shortcuts = React.useMemo((): GlobalShortcutItem[] => [
    ['o', true, true, false, handleOpenChatLlmOptions],
    ['r', true, true, false, handleMessageRegenerateLast],
    ['n', true, false, true, handleConversationNew],
    ['b', true, false, true, () => isFocusedChatEmpty || focusedConversationId && handleConversationBranch(focusedConversationId, null)],
    ['x', true, false, true, () => isFocusedChatEmpty || focusedConversationId && handleConversationClear(focusedConversationId)],
    ['d', true, false, true, () => focusedConversationId && handleConversationDelete(focusedConversationId, false)],
    [ShortcutKeyName.Left, true, false, true, () => handleNavigateHistory('back')],
    [ShortcutKeyName.Right, true, false, true, () => handleNavigateHistory('forward')],
  ], [focusedConversationId, handleConversationBranch, handleConversationDelete, handleConversationNew, handleMessageRegenerateLast, handleNavigateHistory, handleOpenChatLlmOptions, isFocusedChatEmpty]);
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

  const drawerItems = React.useMemo(() =>
      <ChatDrawerItemsMemo
        activeConversationId={focusedConversationId}
        disableNewButton={isFocusedChatEmpty}
        onConversationActivate={setFocusedConversationId}
        onConversationDelete={handleConversationDelete}
        onConversationImportDialog={handleConversationImportDialog}
        onConversationNew={handleConversationNew}
        onConversationsDeleteAll={handleConversationsDeleteAll}
      />,
    [focusedConversationId, handleConversationDelete, handleConversationNew, isFocusedChatEmpty, setFocusedConversationId],
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
        onConversationExport={handleConversationExport}
        onConversationFlatten={handleConversationFlatten}
      />,
    [areChatsEmpty, focusedConversationId, handleConversationBranch, isFocusedChatEmpty, isMessageSelectionMode],
  );

  usePluggableOptimaLayout(drawerItems, centerItems, menuItems, 'AppChat');

  return <>

    <PanelGroup direction='horizontal'>

      {panesConversationIDs.map((_conversationId, idx, panels) => <React.Fragment key={`chat-pane-${idx}-${panels.length}-${_conversationId}`}>

        <Panel
          id={'chat-pane-' + _conversationId}
          order={idx}
          collapsible
          defaultSize={panels.length > 0 ? Math.round(100 / panels.length) : undefined}
          minSize={20}
          onClick={() => setFocusedPane(idx)}
          onCollapse={() => setTimeout(() => removePane(idx), 50)}
          style={{
            // allows the content to be scrolled (all browsers)
            overflowY: 'auto',
            // border only for active pane (if two or more panes)
            ...(panesConversationIDs.length < 2 ? {}
              : (_conversationId === focusedConversationId)
                ? { border: `2px solid ${theme.palette.primary.solidBg}` }
                : { border: `2px solid ${theme.palette.background.level1}` }),
          }}
        >

          <ChatMessageList
            conversationId={_conversationId}
            capabilityHasT2I={capabilityHasT2I}
            chatLLMContextTokens={chatLLM?.contextTokens}
            isMessageSelectionMode={isMessageSelectionMode}
            setIsMessageSelectionMode={setIsMessageSelectionMode}
            onConversationBranch={handleConversationBranch}
            onConversationExecuteHistory={handleConversationExecuteHistory}
            onTextDiagram={handleTextDiagram}
            onTextImagine={handleTextImagine}
            onTextSpeak={handleTextSpeak}
            sx={{
              backgroundColor: themeBgApp,
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
            }} />

        </Panel>

        {/* Panel Separators & Resizers */}
        {idx < panels.length - 1 && (
          <PanelResizeHandle>
            <Box sx={{
              backgroundColor: themeBgApp,
              height: '100%',
              width: '4px',
              '&:hover': {
                backgroundColor: 'primary.softActiveBg',
              },
            }} />
          </PanelResizeHandle>
        )}

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
      }} />


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
    {!!tradeConfig && <TradeModal config={tradeConfig} onConversationActivate={setFocusedConversationId} onClose={() => setTradeConfig(null)} />}


    {/* [confirmation] Reset Conversation */}
    {!!clearConversationId && <ConfirmationModal
      open onClose={() => setClearConversationId(null)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all messages?'} positiveActionText={'Clear conversation'}
    />}

    {/* [confirmation] Delete All */}
    {!!deleteConversationId && <ConfirmationModal
      open onClose={() => setDeleteConversationId(null)} onPositive={handleConfirmedDeleteConversation}
      confirmationText={deleteConversationId === SPECIAL_ID_WIPE_ALL
        ? 'Are you absolutely sure you want to delete ALL conversations? This action cannot be undone.'
        : 'Are you sure you want to delete this conversation?'}
      positiveActionText={deleteConversationId === SPECIAL_ID_WIPE_ALL
        ? 'Yes, delete all'
        : 'Delete conversation'}
    />}

  </>;
}
