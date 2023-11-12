import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, FormLabel, Radio, RadioGroup } from '@mui/joy';

import { useModelsStore } from '~/modules/llms/store-llms';


export function useLlmTypeSelector(label: string = 'Model') {

  const { chatLLM, fastLLM } = useModelsStore(state => {
    const { chatLLMId, fastLLMId } = state;
    const chatLLM = chatLLMId ? state.llms.find(llm => llm.id === chatLLMId) ?? null : null;
    const fastLLM = fastLLMId ? state.llms.find(llm => llm.id === fastLLMId) ?? null : null;
    return { chatLLM, fastLLM };
  }, shallow);

  const [modelType, setModelType] = React.useState<'chat' | 'fast'>('chat');

  const selectorComponent = React.useMemo(() => {
    if (!chatLLM || !fastLLM || chatLLM === fastLLM)
      return null;
    return (
      <FormControl>
        {!!label && <FormLabel>{label}</FormLabel>}
        <RadioGroup
          orientation='horizontal'
          value={modelType}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setModelType(event.target.value as 'chat' | 'fast')}
        >
          <Radio value='chat' label={chatLLM.label + (chatLLM.label.startsWith('GPT-4') ? ' (slow, accurate)' : '')} />
          <Radio value='fast' label={fastLLM.label} />
        </RadioGroup>
      </FormControl>
    );
  }, [chatLLM, fastLLM, modelType]);

  return {
    chosenLlm: (modelType === 'chat' || !fastLLM || chatLLM === fastLLM) ? chatLLM : fastLLM,
    selectorComponent,
  };
}