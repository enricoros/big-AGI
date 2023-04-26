import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { ApiPublishResponse } from '../pages/api/publish';
import { ApplicationBar } from '@/components/ApplicationBar';
import { ChatMessageList } from '@/components/ChatMessageList';
import { Composer } from '@/components/Composer';
import { ConfirmationModal } from '@/components/dialogs/ConfirmationModal';
import { Link } from '@/components/util/Link';
import { PublishedModal } from '@/components/dialogs/PublishedModal';
import { createDMessage, DMessage, useChatStore } from '@/global/stores/store-chats';
import { imaginePromptFromText } from '@/lib/llm/ai';
import { publishConversation } from '@/lib/util/publish';
import { runAssistantUpdatingState } from '@/lib/llm/agi-immediate';
import { runImageGenerationUpdatingState } from '@/lib/llm/imagine';
import { runReActUpdatingState } from '@/lib/llm/agi-react';
import { useComposerStore } from '@/global/stores/store-composer';
import { useSettingsStore } from '@/global/stores/store-settings';


export function Chat(props: { onShowSettings: () => void, sx?: SxProps }) {
  // state
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishResponse, setPublishResponse] = React.useState<ApiPublishResponse | null>(null);

  // external state
  const theme = useTheme();
  const { sendModeId } = useComposerStore(state => ({ sendModeId: state.sendModeId }), shallow);
  const { activeConversationId, chatModelId, systemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === state.activeConversationId);
    return {
      activeConversationId: state.activeConversationId,
      chatModelId: conversation?.chatModelId ?? null,
      systemPurposeId: conversation?.systemPurposeId ?? null,
    };
  }, shallow);


  const _findConversation = (conversationId: string) =>
    conversationId ? useChatStore.getState().conversations.find(c => c.id === conversationId) ?? null : null;


  const handleExecuteConversation = async (conversationId: string, history: DMessage[]) => {
    if (!conversationId) return;

    // [special case] command: '/imagine <prompt>'
    if (history.length > 0 && history[history.length - 1].role === 'user') {
      const lastUserText = history[history.length - 1].text;
      if (lastUserText.startsWith('/imagine ') || lastUserText.startsWith('/img ')) {
        const prompt = lastUserText.substring(lastUserText.indexOf(' ') + 1).trim();
        return await runImageGenerationUpdatingState(conversationId, history, prompt);
      }
    }

    // synchronous long-duration tasks, which update the state as they go
    if (sendModeId && chatModelId && systemPurposeId) {
      switch (sendModeId) {
        case 'immediate':
          return await runAssistantUpdatingState(conversationId, history, chatModelId, systemPurposeId);
        case 'react':
          return await runReActUpdatingState(conversationId, history, chatModelId, systemPurposeId);
      }
    }
  };

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
        return await handleExecuteConversation(conversationId, [...conversation.messages, createDMessage('user', `/imagine ${prompt}`)]);
    }
  };


  const handlePublishConversation = (conversationId: string) => setPublishConversationId(conversationId);

  const handleConfirmedPublishConversation = async () => {
    if (publishConversationId) {
      const conversation = _findConversation(publishConversationId);
      setPublishConversationId(null);
      conversation && setPublishResponse(await publishConversation('paste.gg', conversation, !useSettingsStore.getState().showSystemMessages));
    }
  };


  return (

    <Box
      sx={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        ...(props.sx || {}),
      }}>

      <ApplicationBar
        conversationId={activeConversationId}
        isMessageSelectionMode={isMessageSelectionMode} setIsMessageSelectionMode={setIsMessageSelectionMode}
        onPublishConversation={handlePublishConversation}
        onShowSettings={props.onShowSettings}
        sx={{
          zIndex: 20, // position: 'sticky', top: 0,
          // ...(process.env.NODE_ENV === 'development' ? { background: theme.vars.palette.danger.solidBg } : {}),
        }} />

      <ChatMessageList
        conversationId={activeConversationId}
        isMessageSelectionMode={isMessageSelectionMode} setIsMessageSelectionMode={setIsMessageSelectionMode}
        onExecuteConversation={handleExecuteConversation}
        onImagineFromText={handleImagineFromText}
        sx={{
          flexGrow: 1,
          background: theme.vars.palette.background.level2,
          overflowY: 'auto', // overflowY: 'hidden'
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

      {/* Confirmation for Publishing */}
      <ConfirmationModal
        open={!!publishConversationId} onClose={() => setPublishConversationId(null)} onPositive={handleConfirmedPublishConversation}
        confirmationText={<>
          Share your conversation anonymously on <Link href='https://paste.gg' target='_blank'>paste.gg</Link>?
          It will be unlisted and available to share and read for 30 days. Keep in mind, deletion may not be possible.
          Are you sure you want to proceed?
        </>} positiveActionText={'Understood, upload to paste.gg'}
      />

      {/* Show the Published details */}
      {!!publishResponse && (
        <PublishedModal open onClose={() => setPublishResponse(null)} response={publishResponse} />
      )}

    </Box>

  );
}
