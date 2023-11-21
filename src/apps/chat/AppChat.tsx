import * as React from 'react';

import { CmdRunProdia } from '~/modules/prodia/prodia.client';
import { CmdRunReact } from '~/modules/aifn/react/react';
import { DiagramConfig, DiagramsModal } from '~/modules/aifn/digrams/DiagramsModal';
import { FlattenerModal } from '~/modules/aifn/flatten/FlattenerModal';
import { TradeConfig, TradeModal } from '~/modules/trade/TradeModal';
import { imaginePromptFromText } from '~/modules/aifn/imagine/imaginePromptFromText';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useModelsStore } from '~/modules/llms/store-llms';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { createDMessage, DConversationId, DMessage, getConversation, useConversation } from '~/common/state/store-chats';
import { useGlobalShortcut } from '~/common/components/useGlobalShortcut';
import { useLayoutPluggable } from '~/common/layout/store-applayout';

import { ChatDrawerItems } from './components/applayout/ChatDrawerItems';
import { ChatDropdowns } from './components/applayout/ChatDropdowns';
import { ChatMenuItems } from './components/applayout/ChatMenuItems';
import { ChatMessageList } from './components/ChatMessageList';
import { CmdAddRoleMessage, extractCommands } from './editors/commands';
import { Composer } from './components/composer/Composer';
import { Ephemerals } from './components/Ephemerals';

import { runAssistantUpdatingState } from './editors/chat-stream';
import { runImageGenerationUpdatingState } from './editors/image-generate';
import { runReActUpdatingState } from './editors/react-tangent';
import { usePanesManager } from './components/usePanesManager';


/**
 * Mode: how to treat the input from the Composer
 */
export type ChatModeId = 'immediate' | 'write-user' | 'react' | 'draw-imagine' | 'draw-imagine-plus';


const SPECIAL_ID_WIPE_ALL: DConversationId = 'wipe-chats';

export function AppChat() {

  // state
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [diagramConfig, setDiagramConfig] = React.useState<DiagramConfig | null>(null);
  const [tradeConfig, setTradeConfig] = React.useState<TradeConfig | null>(null);
  const [clearConversationId, setClearConversationId] = React.useState<DConversationId | null>(null);
  const [deleteConversationId, setDeleteConversationId] = React.useState<DConversationId | null>(null);
  const [flattenConversationId, setFlattenConversationId] = React.useState<DConversationId | null>(null);
  const composerTextAreaRef = React.useRef<HTMLTextAreaElement>(null);

  // external state
  const { focusedChatPane, openConversationInFocusedPane } = usePanesManager();
  const focusedConversationId = focusedChatPane?.conversationId ?? null;
  const {
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


  // Window actions

  const setFocusedConversationId = React.useCallback((conversationId: DConversationId | null) => {
    conversationId && openConversationInFocusedPane(conversationId);
  }, [openConversationInFocusedPane]);


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
        if (CmdRunProdia.includes(command)) {
          setMessages(conversationId, history);
          return await runImageGenerationUpdatingState(conversationId, prompt);
        }
        if (CmdRunReact.includes(command) && chatLLMId) {
          setMessages(conversationId, history);
          return await runReActUpdatingState(conversationId, prompt, chatLLMId);
        }
        if (CmdAddRoleMessage.includes(command)) {
          lastMessage.role = command.startsWith('/s') ? 'system' : command.startsWith('/a') ? 'assistant' : 'user';
          lastMessage.sender = 'Bot';
          lastMessage.text = prompt;
          return setMessages(conversationId, history);
        }
      }
    }

    // synchronous long-duration tasks, which update the state as they go
    if (chatLLMId && focusedSystemPurposeId) {
      switch (chatModeId) {
        case 'immediate':
          return await runAssistantUpdatingState(conversationId, history, chatLLMId, focusedSystemPurposeId);
        case 'write-user':
          return setMessages(conversationId, history);
        case 'react':
          if (!lastMessage?.text)
            break;
          setMessages(conversationId, history);
          return await runReActUpdatingState(conversationId, lastMessage.text, chatLLMId);
        case 'draw-imagine':
        case 'draw-imagine-plus':
          if (!lastMessage?.text)
            break;
          const imagePrompt = chatModeId == 'draw-imagine-plus'
            ? await imaginePromptFromText(lastMessage.text) || 'An error sign.'
            : lastMessage.text;
          setMessages(conversationId, history.map(message => message.id !== lastMessage.id ? message : {
            ...message,
            text: `${CmdRunProdia[0]} ${imagePrompt}`,
          }));
          return await runImageGenerationUpdatingState(conversationId, imagePrompt);
      }
    }

    // ISSUE: if we're here, it means we couldn't do the job, at least sync the history
    console.log('handleExecuteConversation: issue running', chatModeId, conversationId, lastMessage);
    setMessages(conversationId, history);
  }, [focusedSystemPurposeId, setMessages]);

  const handleComposerNewMessage = async (chatModeId: ChatModeId, conversationId: DConversationId, userText: string) => {
    const conversation = getConversation(conversationId);
    if (conversation)
      return await _handleExecute(chatModeId, conversationId, [
        ...conversation.messages,
        createDMessage('user', userText),
      ]);
  };

  const handleConversationExecuteHistory = async (conversationId: DConversationId, history: DMessage[]) =>
    await _handleExecute('immediate', conversationId, history);

  const handleMessageRegenerateLast = React.useCallback(async () => {
    const focusedConversation = getConversation(focusedConversationId);
    if (focusedConversation?.messages?.length) {
      const lastMessage = focusedConversation.messages[focusedConversation.messages.length - 1];
      return await _handleExecute('immediate', focusedConversation.id, lastMessage.role === 'assistant'
        ? focusedConversation.messages.slice(0, -1)
        : [...focusedConversation.messages],
      );
    }
  }, [focusedConversationId, _handleExecute]);

  useGlobalShortcut('r', true, true, false, handleMessageRegenerateLast);

  const handleTextDiagram = async (diagramConfig: DiagramConfig | null) => setDiagramConfig(diagramConfig);

  const handleTextImaginePlus = async (conversationId: DConversationId, messageText: string) => {
    const conversation = getConversation(conversationId);
    if (conversation)
      return await _handleExecute('draw-imagine-plus', conversationId, [
        ...conversation.messages,
        createDMessage('user', messageText),
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

  useGlobalShortcut('n', true, false, true, handleConversationNew);

  const handleConversationImportDialog = () => setTradeConfig({ dir: 'import' });

  const handleConversationExport = (conversationId: DConversationId | null) => setTradeConfig({ dir: 'export', conversationId });

  const handleConversationBranch = React.useCallback((conversationId: DConversationId, messageId: string | null) => {
    const branchedConversationId = branchConversation(conversationId, messageId);
    setFocusedConversationId(branchedConversationId);
  }, [branchConversation, setFocusedConversationId]);

  useGlobalShortcut('f', true, false, true, () =>
    isFocusedChatEmpty || focusedConversationId && handleConversationBranch(focusedConversationId, null));

  const handleConversationFlatten = (conversationId: DConversationId) => setFlattenConversationId(conversationId);


  const handleConfirmedClearConversation = React.useCallback(() => {
    if (clearConversationId) {
      setMessages(clearConversationId, []);
      setClearConversationId(null);
    }
  }, [clearConversationId, setMessages]);

  const handleConversationClear = (conversationId: DConversationId) => setClearConversationId(conversationId);

  useGlobalShortcut('x', true, false, true, () =>
    isFocusedChatEmpty || focusedConversationId && handleConversationClear(focusedConversationId));


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

  const handleConversationDelete = (conversationId: DConversationId) => setDeleteConversationId(conversationId);

  useGlobalShortcut('d', true, false, true, () =>
    focusedConversationId && handleConversationDelete(focusedConversationId));


  // Pluggable ApplicationBar components

  const centerItems = React.useMemo(() =>
      <ChatDropdowns conversationId={focusedConversationId} />,
    [focusedConversationId],
  );

  const drawerItems = React.useMemo(() =>
      <ChatDrawerItems
        conversationId={focusedConversationId}
        disableNewButton={isFocusedChatEmpty}
        onConversationActivate={setFocusedConversationId}
        onConversationDelete={handleConversationDelete}
        onConversationImportDialog={handleConversationImportDialog}
        onConversationNew={handleConversationNew}
        onConversationsDeleteAll={handleConversationsDeleteAll}
      />,
    [focusedConversationId, handleConversationNew, isFocusedChatEmpty, setFocusedConversationId],
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

  useLayoutPluggable(centerItems, drawerItems, menuItems);

  return <>

    <ChatMessageList
      conversationId={focusedConversationId}
      isMessageSelectionMode={isMessageSelectionMode}
      setIsMessageSelectionMode={setIsMessageSelectionMode}
      onConversationBranch={handleConversationBranch}
      onConversationExecuteHistory={handleConversationExecuteHistory}
      onTextDiagram={handleTextDiagram}
      onTextImagine={handleTextImaginePlus}
      onTextSpeak={handleTextSpeak}
      sx={{
        flexGrow: 1,
        backgroundColor: 'background.level1',
        overflowY: 'auto', // overflowY: 'hidden'
        minHeight: 96,
      }} />

    <Ephemerals
      conversationId={focusedConversationId}
      sx={{
        // flexGrow: 0.1,
        flexShrink: 0.5,
        overflowY: 'auto',
        minHeight: 64,
      }} />

    <Composer
      conversationId={focusedConversationId}
      isDeveloperMode={focusedSystemPurposeId === 'Developer'}
      composerTextAreaRef={composerTextAreaRef}
      onNewMessage={handleComposerNewMessage}
      sx={{
        zIndex: 21, // position: 'sticky', bottom: 0,
        backgroundColor: 'background.surface',
        borderTop: `1px solid`,
        borderTopColor: 'divider',
        p: { xs: 1, md: 2 },
      }} />


    {/* Diagrams */}
    {!!diagramConfig && <DiagramsModal config={diagramConfig} onClose={() => setDiagramConfig(null)} />}

    {/* Flatten */}
    {!!flattenConversationId && <FlattenerModal conversationId={flattenConversationId} onClose={() => setFlattenConversationId(null)} />}

    {/* Import / Export  */}
    {!!tradeConfig && <TradeModal config={tradeConfig} onClose={() => setTradeConfig(null)} />}


    {/* [confirmation] Reset Conversation */}
    {!!clearConversationId && <ConfirmationModal
      open onClose={() => setClearConversationId(null)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'}
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
