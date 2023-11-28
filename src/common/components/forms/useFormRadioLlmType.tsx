import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { DLLM, useModelsStore } from '~/modules/llms/store-llms';

import { FormRadioOption } from './FormRadioControl';
import { useFormRadio } from './useFormRadio';


type LlmType = 'chat' | 'fast';

export function useFormRadioLlmType(label: string = 'Model', initialModelType: LlmType = 'fast'): [DLLM | null, React.JSX.Element | null] {

  // external state
  const { chatLLM, fastLLM } = useModelsStore(state => {
    const { chatLLMId, fastLLMId } = state;
    const chatLLM = chatLLMId ? state.llms.find(llm => llm.id === chatLLMId) ?? null : null;
    const fastLLM = fastLLMId ? state.llms.find(llm => llm.id === fastLLMId) ?? null : null;
    return { chatLLM, fastLLM };
  }, shallow);

  const hidden = !chatLLM || !fastLLM || chatLLM === fastLLM;

  const options = React.useMemo((): FormRadioOption<LlmType>[] => [
    { label: chatLLM?.label ?? '[missing chat llm]', value: 'chat' },
    { label: fastLLM?.label ?? '[missing fast llm]', value: 'fast' },
  ], [chatLLM, fastLLM]);

  const [llmType, component] = useFormRadio<LlmType>(initialModelType, options, label, hidden);
  const value = (llmType === 'chat' || !fastLLM) ? chatLLM : fastLLM;

  return [value, component];
}