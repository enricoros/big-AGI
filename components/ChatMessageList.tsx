import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { AspectRatio, Box, Button, Grid, List, Stack, Textarea, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { ChatMessage } from '@/components/ChatMessage';
import { DMessage, useActiveConfiguration, useActiveConversation, useChatStore } from '@/lib/store-chats';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';
import { useSettingsStore } from '@/lib/store';


function PurposeSelect() {
  const theme = useTheme();
  const { setSystemPurposeId, systemPurposeId } = useActiveConfiguration();

  const handlePurposeChange = (purpose: SystemPurposeId | null) => {
    if (purpose) {
      setSystemPurposeId(purpose);
    }
  };

  function handleCustomSystemMessageChange(v: React.ChangeEvent<HTMLTextAreaElement>): void {
    SystemPurposes['Custom'].systemMessage = v.target.value;
  }

  return (
    <Stack direction='column' sx={{ justifyContent: 'center', alignItems: 'center', mx: 2, minHeight: '60vh' }}>

      <Box>

        <Typography level='body3' color='neutral' sx={{ mb: 2 }}>
          AI purpose
        </Typography>

        <Grid container spacing={1}>
          {Object.keys(SystemPurposes).map(spId => (
            <Grid key={spId} xs={4} lg={3} xl={2}>
              <AspectRatio variant='plain' ratio={1} sx={{
                minWidth: { xs: 56, lg: 78, xl: 130 }, maxWidth: 130,
                // borderRadius: 8,
                // boxShadow: theme.vars.shadow.md,
              }}>
                <Button
                  variant={systemPurposeId === spId ? 'solid' : 'soft'}
                  color={systemPurposeId === spId ? 'primary' : 'neutral'}
                  onClick={() => handlePurposeChange(spId as SystemPurposeId)}
                  sx={{
                    flexDirection: 'column',
                    gap: { xs: 2, lg: 3 },
                    fontFamily: theme.vars.fontFamily.code, fontWeight: 500,
                  }}
                >
                  <div style={{ fontSize: '1.875rem' }}>
                    {SystemPurposes[spId as SystemPurposeId]?.symbol}
                  </div>
                  <div>
                    {SystemPurposes[spId as SystemPurposeId]?.title}
                  </div>
                </Button>
              </AspectRatio>
            </Grid>
          ))}
        </Grid>

        <Typography level='body2' sx={{ mt: 2 }}>
          {SystemPurposes[systemPurposeId].description}
        </Typography>

        {systemPurposeId === 'Custom' && (
          <>
            <Textarea variant='soft' autoFocus placeholder={"Enter your custom system message here..."}
            minRows={5} maxRows={12}
            // onKeyDown={handleKeyPress}
            // onDragEnter={handleMessageDragEnter}
            defaultValue={SystemPurposes['Custom'].systemMessage} onChange={(e) => handleCustomSystemMessageChange(e)}
            sx={{
              fontSize: '16px',
              lineHeight: 1.75,
            }} />
          </>
        )}


      </Box>

    </Stack>
  );
}


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: { disableSend: boolean, sx?: SxProps, runAssistant: (conversationId: string, history: DMessage[]) => void }) {
  // state
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // external state
  const { id: activeConversationId, messages } = useActiveConversation();
  const { editMessage, deleteMessage } = useChatStore(state => ({ editMessage: state.editMessage, deleteMessage: state.deleteMessage }), shallow);
  const { freeScroll, showSystemMessages } = useSettingsStore(state => ({ freeScroll: state.freeScroll, showSystemMessages: state.showSystemMessages }), shallow);


  // when messages change, scroll to bottom (aka: at every new token)
  React.useEffect(() => {
    if (freeScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [freeScroll, messages]);

  // hide system messages if the user chooses so
  const filteredMessages = messages
    .filter(m => m.role !== 'system' || showSystemMessages);

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length) return (
    <Box sx={props.sx || {}}>
      <PurposeSelect />
    </Box>
  );


  const handleMessageDelete = (messageId: string) =>
    deleteMessage(activeConversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    editMessage(activeConversationId, messageId, { text: newText }, true);

  const handleMessageRunAgain = (messageId: string) => {
    const truncatedHistory = messages.slice(0, messages.findIndex(m => m.id === messageId) + 1);
    props.runAssistant(activeConversationId, truncatedHistory);
  };


  return (
    <Box sx={props.sx || {}}>
      <List sx={{ p: 0 }}>

        {filteredMessages.map(message =>
          <ChatMessage
            key={'msg-' + message.id} message={message} disableSend={props.disableSend}
            onDelete={() => handleMessageDelete(message.id)}
            onEdit={newText => handleMessageEdit(message.id, newText)}
            onRunAgain={() => handleMessageRunAgain(message.id)} />,
        )}

        <div ref={messagesEndRef}></div>
      </List>
    </Box>
  );
}