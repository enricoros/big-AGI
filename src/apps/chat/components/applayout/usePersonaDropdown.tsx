import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { AppBarDropdown } from '~/common/layout/AppBarDropdown';
import { useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';


function AppBarPersonaDropdown(props: {
  systemPurposeId: SystemPurposeId | null,
  setSystemPurposeId: (systemPurposeId: SystemPurposeId | null) => void,
}) {

  // external state
  const { zenMode } = useUIPreferencesStore(state => ({
    zenMode: state.zenMode,
  }), shallow);

  const handleSystemPurposeChange = (_event: any, value: SystemPurposeId | null) => props.setSystemPurposeId(value);

  return (
    <AppBarDropdown
      items={SystemPurposes} showSymbols={zenMode !== 'cleaner'}
      value={props.systemPurposeId} onChange={handleSystemPurposeChange}
    />
  );

}

export function usePersonaIdDropdown(conversationId: string | null) {
  // external state
  const { systemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === conversationId);
    return {
      systemPurposeId: conversation?.systemPurposeId ?? null,
    };
  }, shallow);

  const personaDropdown = React.useMemo(() =>
      systemPurposeId ? <AppBarPersonaDropdown
        systemPurposeId={systemPurposeId}
        setSystemPurposeId={(systemPurposeId) => {
          if (conversationId && systemPurposeId)
            useChatStore.getState().setSystemPurposeId(conversationId, systemPurposeId);
        }}
      /> : null,
    [conversationId, systemPurposeId],
  );

  return { personaDropdown };
}