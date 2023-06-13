import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListItemButton, ListItemDecorator, Typography } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { DLLMId } from '~/modules/llms/llm.types';
import { SystemPurposeId, SystemPurposes } from '../../../../data';
import { useModelsStore } from '~/modules/llms/store-llms';

import { AppBarDropdown, DropdownItems } from '~/common/layouts/appbar/AppBarDropdown';
import { useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore, useUIStateStore } from '~/common/state/store-ui';


export function Dropdowns(props: {
  conversationId: string | null
}) {

  // external state
  const { chatLLMId, setChatLLMId, llms } = useModelsStore(state => ({
    chatLLMId: state.chatLLMId,
    setChatLLMId: state.setChatLLMId,
    llms: state.llms,
  }), shallow);

  const { zenMode } = useUIPreferencesStore(state => ({ zenMode: state.zenMode }), shallow);
  const { systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      systemPurposeId: conversation?.systemPurposeId ?? null,
      setSystemPurposeId: state.setSystemPurposeId,
    };
  }, shallow);
  const { openLLMOptions, openModelsSetup } = useUIStateStore(state => ({
    openLLMOptions: state.openLLMOptions, openModelsSetup: state.openModelsSetup,
  }), shallow);

  const handleChatModelChange = (event: any, value: DLLMId | null) =>
    value && props.conversationId && setChatLLMId(value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
    value && props.conversationId && setSystemPurposeId(props.conversationId, value);

  const handleOpenLLMOptions = () => chatLLMId && openLLMOptions(chatLLMId);

  // filter-out hidden models
  const llmItems: DropdownItems = {};
  for (const llm of llms)
    if (!llm.hidden || llm.id === chatLLMId)
      llmItems[llm.id] = { title: llm.label };

  return <>

    <AppBarDropdown
      items={llmItems}
      value={chatLLMId} onChange={handleChatModelChange}
      placeholder='Models …'
      appendOption={<>

        {chatLLMId && (
          <ListItemButton key='menu-opt' onClick={handleOpenLLMOptions}>
            <ListItemDecorator>
              <SettingsIcon color='info' />
            </ListItemDecorator>
            <Typography>
              Options
            </Typography>
          </ListItemButton>
        )}

        <ListItemButton key='menu-llms' onClick={openModelsSetup}>
          <ListItemDecorator>
            <BuildCircleIcon color='info' />
          </ListItemDecorator>
          <Typography>
            Models
          </Typography>
        </ListItemButton>

      </>}
    />

    {systemPurposeId && (
      <AppBarDropdown
        items={SystemPurposes} showSymbols={zenMode === 'clean'}
        value={systemPurposeId} onChange={handleSystemPurposeChange}
      />
    )}

  </>;
}
