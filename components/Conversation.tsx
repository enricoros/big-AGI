import * as React from 'react';
import { Box, List, Option, Select, Stack, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { DMessage, useActiveConversation, useChatStore } from '@/lib/store-chats';
import { Message } from '@/components/Message';
import { NoSSR } from '@/components/util/NoSSR';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';
import { useSettingsStore } from '@/lib/store';


function PurposeSelect() {
  const systemPurposeId = useSettingsStore(state => state.systemPurposeId);
  const setSystemPurposeId = useSettingsStore(state => state.setSystemPurposeId);

  const handlePurposeChange = (purpose: SystemPurposeId | null) => {
    if (purpose) {

      if (purpose === 'Custom') {
        const systemMessage = prompt('Enter your custom AI purpose', SystemPurposes['Custom'].systemMessage);
        SystemPurposes['Custom'].systemMessage = systemMessage || '';
      }

      setSystemPurposeId(purpose);
    }
  };

  return (
    <Stack direction='column' sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <Box>
        <Typography level='body3' color='neutral'>
          AI purpose
        </Typography>
        <Select
          value={systemPurposeId}
          onChange={(e, v) => handlePurposeChange(v)}
          sx={{ minWidth: '20vw' }}
        >
          {Object.keys(SystemPurposes).map(spId => (
            <Option key={spId} value={spId}>
              {SystemPurposes[spId as SystemPurposeId]?.title}
            </Option>
          ))}
        </Select>
        <Typography level='body2' sx={{ mt: 1, minWidth: 260 }}>
          {SystemPurposes[systemPurposeId].description}
        </Typography>
      </Box>
    </Stack>
  );
}


/**
 * A list of Messages - not fancy at the moment
 */
export function Conversation(props: {
  disableSend: boolean, sx?: SxProps,
  runAssistant: (conversationId: string, history: DMessage[]) => void
}) {

  const { id: activeConversationId, messages } = useActiveConversation();
  const { editMessage, removeMessage } = useChatStore(state => ({ editMessage: state.editMessage, removeMessage: state.removeMessage }));
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);


  // when messages change, scroll to bottom (aka: at every new token)
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // when there are no messages, show the purpose selector
  if (!messages.length) return (
    <Box sx={props.sx || {}}>
      <NoSSR><PurposeSelect /></NoSSR>
    </Box>
  );


  const handleMessageDelete = (messageId: string) =>
    removeMessage(activeConversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    editMessage(activeConversationId, messageId, { text: newText });

  const handleMessageRunAgain = (messageId: string) => {
    const history = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
    props.runAssistant(activeConversationId, history);
  };

  return (
    <Box sx={props.sx || {}}>
      <List sx={{ p: 0 }}>

        {messages.map(message =>
          <Message key={'msg-' + message.id} dMessage={message} disableSend={props.disableSend}
                   onDelete={() => handleMessageDelete(message.id)}
                   onEdit={newText => handleMessageEdit(message.id, newText)}
                   onRunAgain={() => handleMessageRunAgain(message.id)} />)}

        <div ref={messagesEndRef}></div>
      </List>
    </Box>
  );
}
