import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { AppBarDropdown } from '@/common/components/appbar/AppBarDropdown';
import { useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '../../../../data';


export function Dropdowns(props: {
  conversationId: string | null
}) {

  // external state
  const { zenMode } = useSettingsStore(state => ({ zenMode: state.zenMode }), shallow);
  const { chatModelId, setChatModelId, systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      chatModelId: conversation?.chatModelId ?? null,
      setChatModelId: state.setChatModelId,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      setSystemPurposeId: state.setSystemPurposeId,
    };
  }, shallow);

  const handleChatModelChange = (event: any, value: ChatModelId | null) =>
    value && props.conversationId && setChatModelId(props.conversationId, value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
    value && props.conversationId && setSystemPurposeId(props.conversationId, value);

  return <>

    {chatModelId && (
      <AppBarDropdown
        items={ChatModels}
        value={chatModelId} onChange={handleChatModelChange}
      />
    )}

    {systemPurposeId && (
      <AppBarDropdown
        items={SystemPurposes} showSymbols={zenMode === 'clean'}
        value={systemPurposeId} onChange={handleSystemPurposeChange}
      />
    )}

  </>;
}
