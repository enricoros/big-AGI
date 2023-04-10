import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { ApiPublishResponse } from '../pages/api/publish';
import { ApplicationBar } from '@/components/ApplicationBar';
import { ChatMessageList } from '@/components/ChatMessageList';
import { ChatModelId, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { Composer } from '@/components/Composer';
import { ConfirmationModal } from '@/components/dialogs/ConfirmationModal';
import { Link } from '@/components/util/Link';
import { PublishedModal } from '@/components/dialogs/PublishedModal';
import { createDMessage, DMessage, downloadConversationJson, useChatStore } from '@/lib/store-chats';
import { publishConversation } from '@/lib/publish';
import { streamAssistantMessageEdits } from '@/lib/ai';
import { useSettingsStore } from '@/lib/store-settings';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
const runAssistantUpdatingState = async (conversationId: string, history: DMessage[], assistantModel: ChatModelId, assistantPurpose: SystemPurposeId) => {

  // reference the state editing functions
  const { startTyping, appendMessage, editMessage, setMessages } = useChatStore.getState();

  // update the purpose of the system message (if not manually edited), and create if needed
  {
    const systemMessageIndex = history.findIndex(m => m.role === 'system');
    const systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');

    if (!systemMessage.updated) {
      systemMessage.purposeId = assistantPurpose;
      systemMessage.text = SystemPurposes[assistantPurpose]?.systemMessage
        .replaceAll('{{Today}}', new Date().toISOString().split('T')[0]);
    }

    history.unshift(systemMessage);
    setMessages(conversationId, history);
  }

  // create a blank and 'typing' message for the assistant
  let assistantMessageId: string;
  {
    const assistantMessage: DMessage = createDMessage('assistant', '...');
    assistantMessage.typing = true;
    assistantMessage.purposeId = history[0].purposeId;
    assistantMessage.originLLM = assistantModel;
    appendMessage(conversationId, assistantMessage);
    assistantMessageId = assistantMessage.id;
  }

  // when an abort controller is set, the UI switches to the "stop" mode
  const controller = new AbortController();
  startTyping(conversationId, controller);

  const { apiKey, apiHost, apiOrganizationId, modelTemperature, modelMaxResponseTokens } = useSettingsStore.getState();
  await streamAssistantMessageEdits(conversationId, assistantMessageId, history, apiKey, apiHost, apiOrganizationId, assistantModel, modelTemperature, modelMaxResponseTokens, editMessage, controller.signal);

  // clear to send, again
  startTyping(conversationId, null);
};


export function Chat(props: { onShowSettings: () => void, sx?: SxProps }) {
  // state
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishResponse, setPublishResponse] = React.useState<ApiPublishResponse | null>(null);

  // external state
  const theme = useTheme();
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


  const handleSendMessage = async (conversationId: string, userText: string) => {
    const conversation = _findConversation(conversationId);
    if (conversation && chatModelId && systemPurposeId)
      await runAssistantUpdatingState(conversation.id, [...conversation.messages, createDMessage('user', userText)], chatModelId, systemPurposeId);
  };

  const handleRestartConversation = async (conversationId: string, history: DMessage[]) => {
    if (conversationId && chatModelId && systemPurposeId)
      await runAssistantUpdatingState(conversationId, history, chatModelId, systemPurposeId);
  };


  const handleDownloadConversationToJson = (conversationId: string) => {
    const conversation = _findConversation(conversationId);
    conversation && downloadConversationJson(conversation);
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
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        ...(props.sx || {}),
      }}>

      <ApplicationBar
        conversationId={activeConversationId}
        onDownloadConversationJSON={handleDownloadConversationToJson}
        onPublishConversation={handlePublishConversation}
        onShowSettings={props.onShowSettings}
        sx={{
          position: 'sticky', top: 0, zIndex: 20,
          // ...(process.env.NODE_ENV === 'development' ? { background: theme.vars.palette.danger.solidBg } : {}),
        }} />

      <ChatMessageList
        conversationId={activeConversationId}
        onRestartConversation={handleRestartConversation}
        sx={{
          flexGrow: 1,
          background: theme.vars.palette.background.level2,
          overflowY: 'hidden',
          marginBottom: '-1px',
        }} />

      <Composer
        conversationId={activeConversationId} messageId={null}
        isDeveloperMode={systemPurposeId === 'Developer'}
        onSendMessage={handleSendMessage}
        sx={{
          position: 'sticky', bottom: 0, zIndex: 21,
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
