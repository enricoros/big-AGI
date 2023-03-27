import * as React from 'react';

import { Box, Stack, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import Face6Icon from '@mui/icons-material/Face6';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SmartToyTwoToneIcon from '@mui/icons-material/SmartToyTwoTone';

import { ApiChatInput } from '../pages/api/chat';
import { ApplicationBar } from '@/components/ApplicationBar';
import { Composer } from '@/components/Composer';
import { Conversation } from '@/components/Conversation';
import { NoSSR } from '@/components/util/NoSSR';
import { SystemPurposes } from '@/lib/data';
import { UiMessage } from '@/components/Message';
import { useSettingsStore } from '@/lib/store';


/// UI Messages configuration

const UIMessageDefaults: { [key in UiMessage['role']]: Pick<UiMessage, 'role' | 'sender' | 'avatar'> } = {
  system: {
    role: 'system',
    sender: 'Bot',
    avatar: SmartToyTwoToneIcon, //'https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png',
  },
  user: {
    role: 'user',
    sender: 'You',
    avatar: Face6Icon, //https://mui.com/static/images/avatar/2.jpg',
  },
  assistant: {
    role: 'assistant',
    sender: 'Bot',
    avatar: SmartToyOutlinedIcon, // 'https://www.svgrepo.com/show/306500/openai.svg',
  },
};

const createUiMessage = (role: UiMessage['role'], text: string): UiMessage => ({
  uid: Math.random().toString(36).substring(2, 15),
  text: text,
  model: '',
  ...UIMessageDefaults[role],
});


export function ChatArea(props: { onShowSettings: () => void, sx?: SxProps }) {
  const theme = useTheme();

  const { apiKey, chatModelId, systemPurposeId } = useSettingsStore(state => ({
    apiKey: state.apiKey, chatModelId: state.chatModelId, systemPurposeId: state.systemPurposeId,
  }));
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);


  /** Main function to send a message to the assistant and receive a response */
  const streamAssistantResponseMessage = async (history: UiMessage[]) => {
    // when an abort controller is set, the UI switches to the "stop" mode
    const controller = new AbortController();
    setAbortController(controller);

    const payload: ApiChatInput = {
      apiKey: apiKey,
      model: chatModelId,
      messages: history.map(({ role, text }) => ({
        role: role,
        content: text,
      })),
    };

    try {

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.body) {
        const message: UiMessage = createUiMessage('assistant', '');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        // loop forever until the read is done, or the abort controller is triggered
        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          const messageText = decoder.decode(value);
          message.text += messageText;

          // there may be a JSON object at the beginning of the message, which contains the model name (streaming workaround)
          if (!message.model && message.text.startsWith('{')) {
            const endOfJson = message.text.indexOf('}');
            if (endOfJson > 0) {
              const json = message.text.substring(0, endOfJson + 1);
              try {
                const parsed = JSON.parse(json);
                message.model = parsed.model;
                message.text = message.text.substring(endOfJson + 1);
              } catch (e) {
                // error parsing JSON, ignore
                console.log('Error parsing JSON: ' + e);
              }
            }
          }

          setMessages(list => {
            // if missing, add the message at the end of the list, otherwise set a new list anyway, to trigger a re-render
            const existing = list.find(m => m.uid === message.uid);
            return existing ? [...list] : [...list, message];
          });
        }
      }

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // expected, the user clicked the "stop" button
      } else {
        // TODO: show an error to the UI
        console.error('Fetch request error:', error);
      }
    }

    // and we're done with this message/api call
    setAbortController(null);
  };

  const handleConversationClear = () =>
    setMessages([]);

  const handleMessageDelete = (uid: string) =>
    setMessages(list => list.filter(m => m.uid !== uid));

  const handleMessageEdit = (uid: string, newText: string) =>
    setMessages(list => list.map(m => (m.uid === uid ? { ...m, text: newText } : m)));

  const handleMessageRunAgain = (uid: string) => {
    const history = messages.slice(0, messages.findIndex(m => m.uid === uid) + 1);
    setMessages(history);

    // noinspection JSIgnoredPromiseFromCall
    streamAssistantResponseMessage(history);
  };

  const handleSendMessage = (userMessage: string) => {
    // prepend 'system' message if missing
    const history = [...messages];
    if (!history.length) {
      const systemMessage = SystemPurposes[systemPurposeId].systemMessage
        .replaceAll('{{Today}}', new Date().toISOString().split('T')[0]);
      history.push(createUiMessage('system', systemMessage));
    }

    history.push(createUiMessage('user', userMessage));
    setMessages(history);

    // noinspection JSIgnoredPromiseFromCall
    streamAssistantResponseMessage(history);
  };

  const handleStopGeneration = () => abortController?.abort();


  return (
    <Stack direction='column' sx={{
      minHeight: '100vh',
      ...(props.sx || {}),
    }}>

      {/* Application Bar */}
      <ApplicationBar
        onDoubleClick={handleConversationClear} onSettingsClick={props.onShowSettings}
        sx={{
          position: 'sticky', top: 0, zIndex: 20,
          background: process.env.NODE_ENV === 'development'
            ? theme.vars.palette.danger.solidHoverBg
            : theme.vars.palette.primary.solidHoverBg,
        }} />

      {/* Conversation */}
      <Conversation
        messages={messages}
        composerBusy={!!abortController}
        onMessageDelete={handleMessageDelete} onMessageEdit={handleMessageEdit} onMessageRunAgain={handleMessageRunAgain}
        sx={{
          flexGrow: 1,
          background: theme.vars.palette.background.level1,
        }} />

      {/* Composer */}
      <Box sx={{
        position: 'sticky', bottom: 0, zIndex: 10,
        background: theme.vars.palette.background.body,
        borderTop: `1px solid ${theme.vars.palette.divider}`,
        p: { xs: 1, md: 2 },
      }}>
        <NoSSR>
          <Composer disableSend={!!abortController} sendMessage={handleSendMessage} stopGeneration={handleStopGeneration} />
        </NoSSR>
      </Box>

    </Stack>
  );
}
