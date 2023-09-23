import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListItemButton, ListItemDecorator } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { DLLM, DLLMId, DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';

import { AppBarDropdown, DropdownItems } from '~/common/layout/AppBarDropdown';
import { useUIStateStore } from '~/common/state/store-ui';


function AppBarLLMDropdown(props: {
  llms: DLLM[],
  llmId: DLLMId | null,
  setLlmId: (llmId: DLLMId | null) => void,
  placeholder?: string,
}) {

  // build model menu items, filtering-out hidden models, and add Source separators
  const llmItems: DropdownItems = {};
  let prevSourceId: DModelSourceId | null = null;
  for (const llm of props.llms) {
    if (!llm.hidden || llm.id === props.llmId) {
      if (!prevSourceId || llm.sId !== prevSourceId) {
        if (prevSourceId)
          llmItems[`sep-${llm.id}`] = { type: 'separator', title: llm.sId };
        prevSourceId = llm.sId;
      }
      llmItems[llm.id] = { title: llm.label };
    }
  }

  const handleChatLLMChange = (_event: any, value: DLLMId | null) => value && props.setLlmId(value);

  const handleOpenLLMOptions = () => props.llmId && useUIStateStore.getState().openLLMOptions(props.llmId);

  const handleOpenModelsSetup = () => useUIStateStore.getState().openModelsSetup();

  return (
    <AppBarDropdown
      items={llmItems}
      value={props.llmId} onChange={handleChatLLMChange}
      placeholder={props.placeholder || 'Models …'}
      appendOption={<>

        {props.llmId && (
          <ListItemButton key='menu-opt' onClick={handleOpenLLMOptions}>
            <ListItemDecorator><SettingsIcon color='success' /></ListItemDecorator>
            Options
          </ListItemButton>
        )}

        <ListItemButton key='menu-llms' onClick={handleOpenModelsSetup}>
          <ListItemDecorator><BuildCircleIcon color='success' /></ListItemDecorator>
          Models
        </ListItemButton>

      </>}
    />
  );
}

export function useChatLLMDropdown() {
  // external state
  const { llms, chatLLMId, setChatLLMId } = useModelsStore(state => ({
    llms: state.llms,
    chatLLMId: state.chatLLMId,
    setChatLLMId: state.setChatLLMId,
  }), shallow);

  const chatLLMDropdown = React.useMemo(
    () => <AppBarLLMDropdown llms={llms} llmId={chatLLMId} setLlmId={setChatLLMId} />,
    [llms, chatLLMId, setChatLLMId],
  );

  return { chatLLMId, chatLLMDropdown };
}

export function useTempLLMDropdown(props: { initialLlmId: DLLMId | null }) {
  // local state
  const [llmId, setLlmId] = React.useState<DLLMId | null>(props.initialLlmId);

  // external state
  const llms = useModelsStore(state => state.llms, shallow);

  const chatLLMDropdown = React.useMemo(
    () => <AppBarLLMDropdown llms={llms} llmId={llmId} setLlmId={setLlmId} />,
    [llms, llmId, setLlmId],
  );

  return { llmId, chatLLMDropdown };
}