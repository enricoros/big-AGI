import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListItemButton, ListItemDecorator } from '@mui/joy';
import CallIcon from '@mui/icons-material/Call';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { AppBarDropdown } from '~/common/layout/AppBarDropdown';
import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { launchAppCall } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


function AppBarPersonaDropdown(props: {
  systemPurposeId: SystemPurposeId | null,
  setSystemPurposeId: (systemPurposeId: SystemPurposeId | null) => void,
  onCall?: () => void,
}) {

  // external state
  const { zenMode } = useUIPreferencesStore(state => ({
    zenMode: state.zenMode,
  }), shallow);

  const handleSystemPurposeChange = (_event: any, value: SystemPurposeId | null) => props.setSystemPurposeId(value);


  // options

  let appendOption: React.JSX.Element | undefined = undefined;

  if (props.onCall) {
    const enableCallOption = !!props.systemPurposeId;
    appendOption = (
      <ListItemButton color='primary' disabled={!enableCallOption} key='menu-call-persona' onClick={props.onCall} sx={{ minWidth: 160 }}>
        <ListItemDecorator><CallIcon color={enableCallOption ? 'primary' : 'warning'} /></ListItemDecorator>
        Call&nbsp; {!!props.systemPurposeId && SystemPurposes[props.systemPurposeId]?.symbol}
      </ListItemButton>
    );
  }

  return (
    <AppBarDropdown
      items={SystemPurposes} showSymbols={zenMode !== 'cleaner'}
      value={props.systemPurposeId} onChange={handleSystemPurposeChange}
      appendOption={appendOption}
    />
  );

}

export function usePersonaIdDropdown(conversationId: DConversationId | null) {

  // external state
  const labsCalling = useUXLabsStore(state => state.labsCalling);
  const { systemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === conversationId);
    return {
      systemPurposeId: conversation?.systemPurposeId ?? null,
    };
  }, shallow);

  const personaDropdown = React.useMemo(() => systemPurposeId
      ? <AppBarPersonaDropdown
        systemPurposeId={systemPurposeId}
        setSystemPurposeId={(systemPurposeId) => {
          if (conversationId && systemPurposeId)
            useChatStore.getState().setSystemPurposeId(conversationId, systemPurposeId);
        }}
        onCall={labsCalling ? () => {
          if (conversationId && systemPurposeId)
            launchAppCall(conversationId, systemPurposeId);
        } : undefined}
      /> : null,
    [conversationId, labsCalling, systemPurposeId],
  );

  return { personaDropdown };
}