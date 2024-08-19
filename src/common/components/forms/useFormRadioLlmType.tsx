import * as React from 'react';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { useDefaultLLMs } from '~/common/stores/llms/llms.hooks';

import type { FormRadioOption } from './FormRadioControl';
import { useFormRadio } from './useFormRadio';


type LlmType = 'chat' | 'fast';

export function useFormRadioLlmType(label: string = 'Model', initialModelType: LlmType = 'fast'): [DLLM | null, React.JSX.Element | null] {

  // external state
  const { chatLLM, fastLLM } = useDefaultLLMs();

  const hidden = !chatLLM || !fastLLM || chatLLM === fastLLM;

  const options = React.useMemo((): FormRadioOption<LlmType>[] => [
    { label: chatLLM?.label ?? '[missing chat llm]', value: 'chat' },
    { label: fastLLM?.label ?? '[missing fast llm]', value: 'fast' },
  ], [chatLLM, fastLLM]);

  const [llmType, component] = useFormRadio<LlmType>(initialModelType, options, label, hidden);
  const value = (llmType === 'chat' || !fastLLM) ? chatLLM : fastLLM;

  return [value, component];
}