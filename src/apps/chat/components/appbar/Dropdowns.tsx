import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListItemDecorator, Option, Typography } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { DLLMId } from '~/modules/llms/llm.types';
import { SystemPurposeId, SystemPurposes } from '../../../../data';
import { useLLMs } from '~/modules/llms/llm.store';

import { AppBarDropdown, DropdownItems } from '~/common/layouts/appbar/AppBarDropdown';
import { useChatStore } from '~/common/state/store-chats';
import { useSettingsStore } from '~/common/state/store-settings';
import { useUIStore } from '~/common/state/store-ui';


export function Dropdowns(props: {
  conversationId: string | null
}) {

  // external state
  const llms = useLLMs();
  const { zenMode } = useSettingsStore(state => ({ zenMode: state.zenMode }), shallow);
  const { llmId, setLLMId, systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      llmId: conversation?.llmId ?? null,
      setLLMId: state.setLLMId,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      setSystemPurposeId: state.setSystemPurposeId,
    };
  }, shallow);
  const { openLLMOptions, openModelsSetup } = useUIStore(state => ({
    openLLMOptions: state.openLLMOptions, openModelsSetup: state.openModelsSetup,
  }), shallow);

  const handleChatModelChange = (event: any, value: DLLMId | null) =>
    value && props.conversationId && setLLMId(props.conversationId, value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
    value && props.conversationId && setSystemPurposeId(props.conversationId, value);

  // filter-out hidden models
  const llmItems: DropdownItems = {};
  for (const llm of llms)
    if (!llm.hidden || llm.id === llmId)
      llmItems[llm.id] = { title: llm.label };

  return <>

    <AppBarDropdown
      items={llmItems}
      value={llmId} onChange={handleChatModelChange}
      placeholder='Model'
      appendOption={<>

        <Option onClick={() => openLLMOptions('openai-gpt-4') /* FIXME */}>
          <ListItemDecorator>
            <SettingsIcon color='info' />
          </ListItemDecorator>
          <Typography>
            Options
          </Typography>
        </Option>

        <Option onClick={openModelsSetup}>
          <ListItemDecorator>
            <BuildCircleIcon color='info' />
          </ListItemDecorator>
          <Typography>
            Models
          </Typography>
        </Option>

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
