import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, ListItemButton, ListItemDecorator } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { DLLM, DLLMId, DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';

import { DropdownItems, PageBarDropdownMemo } from '~/common/layout/optima/components/PageBarDropdown';
import { KeyStroke } from '~/common/components/KeyStroke';
import { useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';


function AppBarLLMDropdown(props: {
  llms: DLLM[],
  chatLlmId: DLLMId | null,
  setChatLlmId: (llmId: DLLMId | null) => void,
  placeholder?: string,
}) {

  // external state
  const { openLlmOptions, openModelsSetup } = useOptimaLayout();

  // derived state
  const { chatLlmId, llms, setChatLlmId } = props;


  const handleChatLLMChange = React.useCallback((value: DLLMId | null) => {
    value && setChatLlmId(value);
  }, [setChatLlmId]);

  const handleOpenLLMOptions = React.useCallback(() => {
    return chatLlmId && openLlmOptions(chatLlmId);
  }, [chatLlmId, openLlmOptions]);


  const dropdownItems: DropdownItems = React.useMemo(() => {
    const llmItems: DropdownItems = {};
    let prevSourceId: DModelSourceId | null = null;
    for (const llm of llms) {

      // filter-out hidden models
      if (!(!llm.hidden || llm.id === chatLlmId))
        continue;

      // add separators when changing sources
      if (!prevSourceId || llm.sId !== prevSourceId) {
        if (prevSourceId)
          llmItems[`sep-${llm.id}`] = {
            type: 'separator',
            title: llm.sId,
          };
        prevSourceId = llm.sId;
      }

      // add the model item
      llmItems[llm.id] = {
        title: llm.label,
        // icon: llm.id.startsWith('some vendor') ? <VendorIcon /> : undefined,
      };
    }
    return llmItems;
  }, [chatLlmId, llms]);


  const dropdownAppendOptions = React.useMemo(() => <>

    {chatLlmId && (
      <ListItemButton key='menu-opt' onClick={handleOpenLLMOptions}>
        <ListItemDecorator><SettingsIcon color='success' /></ListItemDecorator>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          Options
          <KeyStroke combo='Ctrl + Shift + O' />
        </Box>
      </ListItemButton>
    )}

    <ListItemButton key='menu-llms' onClick={openModelsSetup}>
      <ListItemDecorator><BuildCircleIcon color='success' /></ListItemDecorator>
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        Models
        <KeyStroke combo='Ctrl + Shift + M' />
      </Box>
    </ListItemButton>

  </>, [chatLlmId, handleOpenLLMOptions, openModelsSetup]);


  return (
    <PageBarDropdownMemo
      items={dropdownItems}
      value={chatLlmId}
      onChange={handleChatLLMChange}
      placeholder={props.placeholder || 'Models …'}
      appendOption={dropdownAppendOptions}
    />
  );
}

export function useChatLLMDropdown() {
  // external state
  const { llms, chatLLMId, setChatLLMId } = useModelsStore(state => ({
    llms: state.llms, // NOTE: we don't need a deep comparison as we reference the same array
    chatLLMId: state.chatLLMId,
    setChatLLMId: state.setChatLLMId,
  }), shallow);

  const chatLLMDropdown = React.useMemo(
    () => <AppBarLLMDropdown llms={llms} chatLlmId={chatLLMId} setChatLlmId={setChatLLMId} />,
    [llms, chatLLMId, setChatLLMId],
  );

  return { chatLLMId, chatLLMDropdown };
}

/*export function useTempLLMDropdown(props: { initialLlmId: DLLMId | null }) {
  // local state
  const [llmId, setLlmId] = React.useState<DLLMId | null>(props.initialLlmId);

  // external state
  const llms = useModelsStore(state => state.llms, shallow);

  const chatLLMDropdown = React.useMemo(
    () => <AppBarLLMDropdown llms={llms} llmId={llmId} setLlmId={setLlmId} />,
    [llms, llmId, setLlmId],
  );

  return { llmId, chatLLMDropdown };
}*/