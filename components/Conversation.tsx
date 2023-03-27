import * as React from 'react';
import { Box, List, Option, Select, Stack, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { Message, UiMessage } from '@/components/Message';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';
import { useSettingsStore } from '@/lib/store';
import { NoSSR } from '@/components/util/NoSSR';


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
          sx={{ minWidth: '40vw' }}
        >
          {Object.keys(SystemPurposes).map(spId => (
            <Option key={spId} value={spId}>
              {SystemPurposes[spId as SystemPurposeId]?.title}
            </Option>
          ))}
        </Select>
        <Typography level='body2' sx={{ mt: 2, minWidth: 260 }}>
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
  messages: UiMessage[], composerBusy: boolean, sx?: SxProps, onMessageDelete: (uid: string) => void,
  onMessageEdit: (uid: string, newText: string) => void, onMessageRunAgain: (uid: string) => void
}) {

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // when messages change, scroll to bottom (aka: at every new token)
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [props.messages]);

  // when there are no messages, show the purpose selector
  if (!props.messages.length) return (
    <Box sx={props.sx || {}}>
      <NoSSR><PurposeSelect /></NoSSR>
    </Box>
  );

  return (
    <Box sx={props.sx || {}}>
      <List sx={{ p: 0 }}>

        {props.messages.map(message =>
          <Message key={'msg-' + message.uid} uiMessage={message} composerBusy={props.composerBusy}
                   onDelete={() => props.onMessageDelete(message.uid)}
                   onEdit={newText => props.onMessageEdit(message.uid, newText)}
                   onRunAgain={() => props.onMessageRunAgain(message.uid)} />)}

        <div ref={messagesEndRef}></div>
      </List>
    </Box>
  );
}
