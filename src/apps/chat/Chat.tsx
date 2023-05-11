import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { Button, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTheme } from '@mui/joy';

import { CmdRunProdia } from '@/modules/prodia/prodia.client';
import { CmdRunReact } from '@/modules/search/search.client';
import { PasteGG } from '@/modules/pastegg/pastegg.types';
import { PublishedModal } from '@/modules/pastegg/PublishedModal';
import { callPublish } from '@/modules/pastegg/pastegg.client';

import { ConfirmationModal } from '@/common/components/ConfirmationModal';
import { Link } from '@/common/components/Link';
import { conversationToMarkdown } from '@/common/util/conversationToMarkdown';
import { createDMessage, DMessage, restoreConversationFromJson, useChatStore } from '@/common/state/store-chats';
import { extractCommands } from '@/common/util/extractCommands';
import { useApplicationBarStore } from '@/common/components/appbar/useApplicationBarStore';
import { useComposerStore } from '@/common/state/store-composer';
import { useSettingsStore } from '@/common/state/store-settings';

import { AppBarDropdown } from './components/appbar/AppBarDropdown';
import { AppBarDropdownWithSymbol } from './components/appbar/AppBarDropdownWithSymbol';
import { ChatContextMenu } from './components/appbar/ChatContextMenu';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatModelId, ChatModels, fetchModels, SystemPurposeId, SystemPurposes} from '../../data';
import { ChatPagesMenu } from './components/appbar/ChatPagesMenu';
import { Composer } from './components/composer/Composer';
import { Ephemerals } from './components/ephemerals/Ephemerals';
import { ImportedModal, ImportedOutcome } from './components/appbar/ImportedModal';
import { imaginePromptFromText } from './util/ai-functions';
import { runAssistantUpdatingState } from './util/agi-immediate';
import { runImageGenerationUpdatingState } from './util/imagine';
import { runReActUpdatingState } from './util/agi-react';



export function Chat() {

  // state
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [clearConfirmationId, setClearConfirmationId] = React.useState<string | null>(null);
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishResponse, setPublishResponse] = React.useState<PasteGG.API.Publish.Response | null>(null);
  const [conversationImportOutcome, setConversationImportOutcome] = React.useState<ImportedOutcome | null>(null);
  const conversationFileInputRef = React.useRef<HTMLInputElement>(null);
  const [chatModels, setChatModels] = React.useState(ChatModels);
  const [loadingModels] = React.useState(false);
  const localAIUrl = useSettingsStore(state => state.localAIUrl);

  // external state
  const theme = useTheme();
  const { zenMode } = useSettingsStore(state => ({ zenMode: state.zenMode }), shallow);
  const { sendModeId } = useComposerStore(state => ({ sendModeId: state.sendModeId }), shallow);
  const { activeConversationId, isConversationEmpty, conversationsCount, importConversation, setMessages, chatModelId, setChatModelId, systemPurposeId, setSystemPurposeId, setAutoTitle } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === state.activeConversationId);
    return {
      activeConversationId: state.activeConversationId,
      isConversationEmpty: conversation ? !conversation.messages.length : true,
      conversationsCount: state.conversations.length,
      importConversation: state.importConversation,
      setMessages: state.setMessages,
      chatModelId: conversation?.chatModelId ?? null,
      setChatModelId: state.setChatModelId,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      setSystemPurposeId: state.setSystemPurposeId,
      setAutoTitle: state.setAutoTitle,
    };
  }, shallow);

  const fetchAndSetModels = async (localAIUrl:string) => {
    const models = await fetchModels(localAIUrl);
    if(models) {
      console.log("Populating models: ", models)
      setChatModels(models);
    } else {
      console.warn('Failed to fetch chat models');
    }
  };


  const handleExecuteConversation = async (conversationId: string, history: DMessage[]) => {
    if (!conversationId) return;

    // Command - last user message is a cmd
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastMessage?.role === 'user') {
      const pieces = extractCommands(lastMessage.text);
      if (pieces.length == 2 && pieces[0].type === 'cmd' && pieces[1].type === 'text') {
        const command = pieces[0].value;
        const prompt = pieces[1].value;
        if (CmdRunProdia.includes(command)) {
          setMessages(conversationId, history);
          return await runImageGenerationUpdatingState(conversationId, prompt);
        }
        if (CmdRunReact.includes(command) && chatModelId) {
          setMessages(conversationId, history);
          return await runReActUpdatingState(conversationId, prompt, chatModelId);
        }
        // if (CmdRunSearch.includes(command))
        //   return await run...
      }
    }

    // synchronous long-duration tasks, which update the state as they go
    if (sendModeId && chatModelId && systemPurposeId) {
      switch (sendModeId) {
        case 'immediate':
          return await runAssistantUpdatingState(conversationId, history, chatModelId, systemPurposeId);
        case 'react':
          if (lastMessage?.text) {
            setMessages(conversationId, history);
            return await runReActUpdatingState(conversationId, lastMessage.text, chatModelId);
          }
      }
    }

    // ISSUE: if we're here, it means we couldn't do the job, at least sync the history
    setMessages(conversationId, history);
  };

  const _findConversation = (conversationId: string) =>
    conversationId ? useChatStore.getState().conversations.find(c => c.id === conversationId) ?? null : null;

  const handleSendUserMessage = async (conversationId: string, userText: string) => {
    const conversation = _findConversation(conversationId);
    if (conversation)
      return await handleExecuteConversation(conversationId, [...conversation.messages, createDMessage('user', userText)]);
  };

  const handleImagineFromText = async (conversationId: string, messageText: string) => {
    const conversation = _findConversation(conversationId);
    if (conversation && chatModelId) {
      const prompt = await imaginePromptFromText(messageText, chatModelId);
      if (prompt)
        return await handleExecuteConversation(conversationId, [...conversation.messages, createDMessage('user', `${CmdRunProdia[0]} ${prompt}`)]);
    }
  };


  const handleClearConversation = (conversationId: string) => setClearConfirmationId(conversationId);

  const handleConfirmedClearConversation = () => {
    if (clearConfirmationId) {
      setMessages(clearConfirmationId, []);
      setAutoTitle(clearConfirmationId, '');
      setClearConfirmationId(null);
    }
  };

  const handlePublishConversation = (conversationId: string) => setPublishConversationId(conversationId);

  const handleConfirmedPublishConversation = async () => {
    if (publishConversationId) {
      const conversation = _findConversation(publishConversationId);
      setPublishConversationId(null);
      if (conversation) {
        const markdownContent = conversationToMarkdown(conversation, !useSettingsStore.getState().showSystemMessages);
        const publishResponse = await callPublish('paste.gg', markdownContent);
        setPublishResponse(publishResponse);
      }
    }
  };

  // Populate Chat Models on page load
  React.useEffect(() => {
    console.log('fetching chat models...')

    fetchAndSetModels(localAIUrl);
  }, [localAIUrl]);

  const handleRefreshModels = () => {

    fetchAndSetModels(localAIUrl);
  };


  const handleLoadConversations = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (!files || files.length < 1)
      return;

    // try to restore conversations from the selected files
    const outcomes: ImportedOutcome = { conversations: [] };
    for (const file of files) {
      const fileName = file.name || 'unknown file';
      try {
        const conversation = restoreConversationFromJson(await file.text());
        if (conversation) {
          importConversation(conversation);
          outcomes.conversations.push({ fileName, success: true, conversationId: conversation.id });
        } else {
          const fileDesc = `(${file.type}) ${file.size.toLocaleString()} bytes`;
          outcomes.conversations.push({ fileName, success: false, error: `Invalid file: ${fileDesc}` });
        }
      } catch (error) {
        console.error(error);
        outcomes.conversations.push({ fileName, success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      }
    }

    // show the outcome of the import
    setConversationImportOutcome(outcomes);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };


  // AppBar: Center Components
  const appBarCenterComponents = React.useMemo(() => {

    const handleChatModelChange = (event: any, value: ChatModelId | null) =>
      value && activeConversationId && setChatModelId(activeConversationId, value);

    const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
      value && activeConversationId && setSystemPurposeId(activeConversationId, value);

    return <>
      <Button onClick={handleRefreshModels} disabled={loadingModels} color="inherit">
        <RefreshIcon color="secondary" />
        {loadingModels && <CircularProgress size={24} />}
      </Button>
{chatModelId && <AppBarDropdown items={chatModels} value={chatModelId} onChange={handleChatModelChange} />}
      {systemPurposeId && (zenMode === 'cleaner'
          ? <AppBarDropdown items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />
          : <AppBarDropdownWithSymbol items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />
      )}
    </>;

  }, [activeConversationId, chatModelId, setChatModelId, setSystemPurposeId, systemPurposeId, zenMode]);

  // AppBar: Page Badge
  const appBarLeftBadge = conversationsCount < 2 ? 0 : conversationsCount;

  // AppBar: Page Menu
  const appBarLeftComponents = React.useMemo(() => {
    const handleConversationUpload = () => conversationFileInputRef.current?.click();

    return <ChatPagesMenu
      conversationId={activeConversationId}
      onImportConversation={handleConversationUpload}
    />;
  }, [activeConversationId]);

  // AppBar: Conversation Menu
  const appBarRightComponents = React.useMemo(() => {
    return <ChatContextMenu
      conversationId={activeConversationId} isConversationEmpty={isConversationEmpty}
      isMessageSelectionMode={isMessageSelectionMode} setIsMessageSelectionMode={setIsMessageSelectionMode}
      onClearConversation={handleClearConversation}
      onPublishConversation={handlePublishConversation}
    />;
  }, [activeConversationId, isConversationEmpty, isMessageSelectionMode]);

    // Register actions when the component mounts
  React.useEffect(() => {
    useApplicationBarStore.getState().register(appBarCenterComponents, appBarLeftBadge, appBarLeftComponents, appBarRightComponents);

    return () => {
      useApplicationBarStore.getState().unregister();
    };
  }, [appBarCenterComponents, appBarLeftBadge, appBarLeftComponents, appBarRightComponents]);


  return <>

    <ChatMessageList
      conversationId={activeConversationId}
      isMessageSelectionMode={isMessageSelectionMode} setIsMessageSelectionMode={setIsMessageSelectionMode}
      onExecuteConversation={handleExecuteConversation}
      onImagineFromText={handleImagineFromText}
      sx={{
        flexGrow: 1,
        background: theme.vars.palette.background.level2,
        overflowY: 'auto', // overflowY: 'hidden'
        minHeight: 96,
      }} />

    <Ephemerals
      conversationId={activeConversationId}
      sx={{
        // flexGrow: 0.1,
        flexShrink: 0.5,
        overflowY: 'auto',
        minHeight: 64,
      }} />

    <Composer
      conversationId={activeConversationId} messageId={null}
      isDeveloperMode={systemPurposeId === 'Developer'}
      onSendMessage={handleSendUserMessage}
      sx={{
        zIndex: 21, // position: 'sticky', bottom: 0,
        background: theme.vars.palette.background.surface,
        borderTop: `1px solid ${theme.vars.palette.divider}`,
        p: { xs: 1, md: 2 },
      }} />


    {/* Import Chat */}
    <input type='file' multiple hidden accept='.json' ref={conversationFileInputRef} onChange={handleLoadConversations} />
    {!!conversationImportOutcome && (
      <ImportedModal open outcome={conversationImportOutcome} onClose={() => setConversationImportOutcome(null)} />
    )}

    {/* Deletion */}
    <ConfirmationModal
      open={!!clearConfirmationId} onClose={() => setClearConfirmationId(null)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'}
    />

    {/* Publishing */}
    <ConfirmationModal
      open={!!publishConversationId} onClose={() => setPublishConversationId(null)} onPositive={handleConfirmedPublishConversation}
      confirmationText={<>
        Share your conversation anonymously on <Link href='https://paste.gg' target='_blank'>paste.gg</Link>?
        It will be unlisted and available to share and read for 30 days. Keep in mind, deletion may not be possible.
        Are you sure you want to proceed?
      </>} positiveActionText={'Understood, upload to paste.gg'}
    />
    {!!publishResponse && (
      <PublishedModal open onClose={() => setPublishResponse(null)} response={publishResponse} />
    )}

  </>;
}
