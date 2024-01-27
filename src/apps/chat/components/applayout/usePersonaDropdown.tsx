import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { PageBarDropdown } from '~/common/layout/optima/components/PageBarDropdown';
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


  // options

  // let appendOption: React.JSX.Element | undefined = undefined;

  return (
    <PageBarDropdown
      items={SystemPurposes} showSymbols={zenMode !== 'cleaner'}
      value={props.systemPurposeId} onChange={handleSystemPurposeChange}
      // appendOption={appendOption}
    />
  );

}

export function usePersonaIdDropdown(conversationId: DConversationId | null) {

  // external state
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
      /> : null,
    [conversationId, systemPurposeId],
  );

  return { personaDropdown };
}