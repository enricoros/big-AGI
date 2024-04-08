import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { SystemPurposeId, SystemPurposes } from '../../../data';

import { DConversationId, useChatStore } from '~/common/state/store-chats';
import { PageBarDropdownMemo } from '~/common/layout/optima/components/PageBarDropdown';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { usePurposeStore } from './persona-selector/store-purposes';


function PersonaDropdown(props: {
  systemPurposeId: SystemPurposeId | null,
  setSystemPurposeId: (systemPurposeId: SystemPurposeId | null) => void,
}) {

  // external state
  const hiddenPurposeIDs = usePurposeStore(state => state.hiddenPurposeIDs);
  const { zenMode } = useUIPreferencesStore(state => ({
    zenMode: state.zenMode,
  }), shallow);


  // filter by key in the object - must be missing the system purpose ids hidden by the user, or be the currently active one
  const visibleSystemPurposes = React.useMemo(() => {
    return Object.keys(SystemPurposes)
      .filter(key => !hiddenPurposeIDs.includes(key as SystemPurposeId) || key === props.systemPurposeId)
      .reduce((obj, key) => {
        obj[key as SystemPurposeId] = SystemPurposes[key as SystemPurposeId];
        return obj;
      }, {} as typeof SystemPurposes);
  }, [hiddenPurposeIDs, props.systemPurposeId]);


  const { setSystemPurposeId } = props;

  const handleSystemPurposeChange = React.useCallback((value: string | null) => {
    setSystemPurposeId(value as (SystemPurposeId | null));
  }, [setSystemPurposeId]);


  return (
    <PageBarDropdownMemo
      items={visibleSystemPurposes}
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