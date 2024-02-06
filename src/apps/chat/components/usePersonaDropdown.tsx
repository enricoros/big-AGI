import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { SystemPurposeId, SystemPurposes } from '../../../data';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { PageBarDropdownMemo } from '~/common/layout/optima/components/PageBarDropdown';
import { useUIPreferencesStore } from '~/common/state/store-ui';


function PersonaDropdown(props: {
  systemPurposeId: SystemPurposeId | null,
  setSystemPurposeId: (systemPurposeId: SystemPurposeId | null) => void,
}) {

  // external state
  const { zenMode } = useUIPreferencesStore(state => ({
    zenMode: state.zenMode,
  }), shallow);


  const { setSystemPurposeId } = props;

  const handleSystemPurposeChange = React.useCallback((value: string | null) => {
    setSystemPurposeId(value as (SystemPurposeId | null));
  }, [setSystemPurposeId]);


  return (
    <PageBarDropdownMemo
      items={SystemPurposes}
      value={props.systemPurposeId}
      onChange={handleSystemPurposeChange}
      showSymbols={zenMode !== 'cleaner'}
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


  const handleSetSystemPurposeId = React.useCallback((systemPurposeId: SystemPurposeId | null) => {
    if (conversationId && systemPurposeId)
      useChatStore.getState().setSystemPurposeId(conversationId, systemPurposeId);
  }, [conversationId]);

  const personaDropdown = React.useMemo(() => {
      if (!systemPurposeId) return null;
      return (
        <PersonaDropdown
          systemPurposeId={systemPurposeId}
          setSystemPurposeId={handleSetSystemPurposeId}
        />
      );
    },
    [handleSetSystemPurposeId, systemPurposeId],
  );

  return { personaDropdown };
}