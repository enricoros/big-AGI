import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListItemDecorator, Option, Typography } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '../../../../data';

import { AppBarDropdown } from '~/common/layouts/appbar/AppBarDropdown';
import { useChatStore } from '~/common/state/store-chats';
import { useSettingsStore } from '~/common/state/store-settings';
import { useUIStore } from '~/common/state/store-ui';


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
  const { openLLMOptions, openModelsSetup } = useUIStore(state => ({
    openLLMOptions: state.openLLMOptions, openModelsSetup: state.openModelsSetup,
  }), shallow);

  const handleChatModelChange = (event: any, value: ChatModelId | null) =>
    value && props.conversationId && setChatModelId(props.conversationId, value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
    value && props.conversationId && setSystemPurposeId(props.conversationId, value);

  return <>

    {chatModelId && (
      <AppBarDropdown
        items={ChatModels}
        value={chatModelId} onChange={handleChatModelChange}
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
    )}

    {systemPurposeId && (
      <AppBarDropdown
        items={SystemPurposes} showSymbols={zenMode === 'clean'}
        value={systemPurposeId} onChange={handleSystemPurposeChange}
      />
    )}

  </>;
}
