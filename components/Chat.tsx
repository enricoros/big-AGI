import * as React from 'react';

import { Box, Stack, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { ApiPublishResponse } from '../pages/api/publish';
import { ApplicationBar } from '@/components/ApplicationBar';
import { ChatMessageList } from '@/components/ChatMessageList';
import { Composer } from '@/components/Composer';
import { ConfirmationModal } from '@/components/dialogs/ConfirmationModal';
import { Link } from '@/components/util/Link';
import { PublishedModal } from '@/components/dialogs/PublishedModal';
import { SystemPurposes } from '@/lib/data';
import { createDMessage, DMessage, downloadConversationJson, useActiveConfiguration, useChatStore } from '@/lib/store-chats';
import { publishConversation } from '@/lib/publish';
import { streamAssistantMessageEdits } from '@/lib/ai';
import { useSettingsStore } from '@/lib/store-settings';


export function Chat(props: { onShowSettings: () => void, sx?: SxProps }) {
  // state
  const [clearConfirmationId, setClearConfirmationId] = React.useState<string | null>(null);
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishResponse, setPublishResponse] = React.useState<ApiPublishResponse | null>(null);

  // external state
  const theme = useTheme();
  const { assistantTyping, conversationId: activeConversationId, chatModelId, systemPurposeId } = useActiveConfiguration();

  const runAssistant = async (conversationId: string, history: DMessage[]) => {

    // reference the state editing functions
    const { startTyping, appendMessage, editMessage, setMessages } = useChatStore.getState();

    // update the purpose of the system message (if not manually edited), and create if needed
    {
      const systemMessageIndex = history.findIndex(m => m.role === 'system');
      const systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');

      if (!systemMessage.updated) {
        systemMessage.purposeId = systemPurposeId;
        systemMessage.text = SystemPurposes[systemPurposeId]?.systemMessage
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
      assistantMessage.originLLM = chatModelId;
      appendMessage(conversationId, assistantMessage);
      assistantMessageId = assistantMessage.id;
    }

    // when an abort controller is set, the UI switches to the "stop" mode
    const controller = new AbortController();
    startTyping(conversationId, controller);

    const { apiKey, apiHost, apiOrganizationId, modelTemperature, modelMaxResponseTokens } = useSettingsStore.getState();
    await streamAssistantMessageEdits(conversationId, assistantMessageId, history, apiKey, apiHost, apiOrganizationId, chatModelId, modelTemperature, modelMaxResponseTokens, editMessage, controller.signal);

    // clear to send, again
    startTyping(conversationId, null);
  };

  const findConversation = (conversationId: string) =>
    (conversationId ? useChatStore.getState().conversations.find(c => c.id === conversationId) : null) ?? null;

  const handleSendMessage = async (conversationId: string, userText: string) => {
    const conversation = findConversation(conversationId);
    if (conversation)
      await runAssistant(conversation.id, [...conversation.messages, createDMessage('user', userText)]);
  };

  const handleDownloadConversationToJson = (conversationId: string | null) => {
    if (conversationId || activeConversationId) {
      const conversation = findConversation(conversationId || activeConversationId);
      if (conversation)
        downloadConversationJson(conversation);
    }
  };


  const handlePublishConversation = (conversationId: string | null) =>
    setPublishConversationId(conversationId || activeConversationId || null);

  const handleConfirmedPublishConversation = async () => {
    if (publishConversationId) {
      const conversation = findConversation(publishConversationId);
      setPublishConversationId(null);
      if (conversation)
        setPublishResponse(await publishConversation('paste.gg', conversation, !useSettingsStore.getState().showSystemMessages));
    }
  };

  const handleClearConversation = (conversationId: string | null) =>
    setClearConfirmationId(conversationId || activeConversationId || null);

  const handleConfirmedClearConversation = () => {
    if (clearConfirmationId) {
      useChatStore.getState().setMessages(clearConfirmationId, []);
      setClearConfirmationId(null);
    }
  };


  return (

    <Stack
      sx={{
        minHeight: '100vh',
        position: 'relative',
        ...(props.sx || {}),
      }}>

      <ApplicationBar
        onClearConversation={handleClearConversation}
        onDownloadConversationJSON={handleDownloadConversationToJson}
        onPublishConversation={handlePublishConversation}
        onShowSettings={props.onShowSettings}
        sx={{
          position: 'sticky', top: 0, zIndex: 20,
          // ...(process.env.NODE_ENV === 'development' ? { background: theme.vars.palette.danger.solidBg } : {}),
        }} />

      <ChatMessageList
        disableSend={assistantTyping} runAssistant={runAssistant}
        sx={{
          flexGrow: 1,
          background: theme.vars.palette.background.level2,
          overflowY: 'hidden',
          marginBottom: '-1px',
        }} />

      <Box
        sx={{
          position: 'sticky', bottom: 0, zIndex: 21,
          background: theme.vars.palette.background.surface,
          borderTop: `1px solid ${theme.vars.palette.divider}`,
          p: { xs: 1, md: 2 },
        }}>
        <Composer conversationId={activeConversationId} messageId={null} sendMessage={handleSendMessage} isDeveloperMode={systemPurposeId === 'Developer'} />
      </Box>


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

      {/* Confirmation for Delete */}
      <ConfirmationModal
        open={!!clearConfirmationId} onClose={() => setClearConfirmationId(null)} onPositive={handleConfirmedClearConversation}
        confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'}
      />

    </Stack>

  );
}
