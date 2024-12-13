import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { DConversationId } from '~/common/stores/chat/chat.conversation';
import { OptimaBarControlMethods, OptimaBarDropdownMemo } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useUIComplexityIsMinimal } from '~/common/state/store-ui';

import { usePurposeStore } from '../persona-selector/store-purposes';


function PersonaDropdown(props: {
  dropdownRef: React.Ref<OptimaBarControlMethods>,
  systemPurposeId: SystemPurposeId | null,
  setSystemPurposeId: (systemPurposeId: SystemPurposeId | null) => void,
}) {

  // external state
  const hiddenPurposeIDs = usePurposeStore(state => state.hiddenPurposeIDs);
  const zenMode = useUIComplexityIsMinimal();


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
    <OptimaBarDropdownMemo
      ref={props.dropdownRef}
      items={visibleSystemPurposes}
      value={props.systemPurposeId}
      onChange={handleSystemPurposeChange}
      showSymbols={!zenMode}
    />
  );

}

export function usePersonaIdDropdown(conversationId: DConversationId | null, dropdownRef: React.Ref<OptimaBarControlMethods>) {

  // external state
  const { systemPurposeId } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(conversation => conversation.id === conversationId);
    return {
      systemPurposeId: conversation?.systemPurposeId ?? null,
    };
  }));


  const handleSetSystemPurposeId = React.useCallback((systemPurposeId: SystemPurposeId | null) => {
    if (conversationId && systemPurposeId)
      useChatStore.getState().setSystemPurposeId(conversationId, systemPurposeId);
  }, [conversationId]);

  const personaDropdown = React.useMemo(() => {
      // Note: commented the following as chats with 'null' personas are allowed, and this prevents the control from showing
      // if (!systemPurposeId) return null;
      return (
        <PersonaDropdown
          dropdownRef={dropdownRef}
          systemPurposeId={systemPurposeId}
          setSystemPurposeId={handleSetSystemPurposeId}
        />
      );
    },
    [dropdownRef, handleSetSystemPurposeId, systemPurposeId],
  );

  return { personaDropdown };
}