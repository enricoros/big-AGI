import * as React from 'react';

import type { DLLM, DLLMId } from '~/common/stores/llms/llms.types';
import { useLLMs } from '~/common/stores/llms/llms.hooks';

import type { FormRadioOption } from './FormRadioControl';
import { useFormRadio } from './useFormRadio';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';


type LlmType = 'run' | 'util';

export function useFormRadioLlmType(label: string, runModelId: DLLMId | null, initialModelType: LlmType): [DLLM | undefined, React.JSX.Element | null] {

  // external state
  const { domainModelId: utilModelId } = useModelDomain('fastUtil');
  const [runLLM, utilLLM] = useLLMs([runModelId ?? '', utilModelId ?? '']);


  const hidden = !runLLM || !utilLLM || runLLM === utilLLM;

  const options = React.useMemo((): FormRadioOption<LlmType>[] => [
    { label: runLLM?.label ?? '[missing llm]', value: 'run' },
    { label: utilLLM?.label ?? '[missing util llm]', value: 'util' },
  ], [runLLM, utilLLM]);

  const [llmType, component] = useFormRadio<LlmType>(initialModelType, options, label, hidden);
  const value = (llmType === 'run' || !utilLLM) ? runLLM : utilLLM;

  return [value, component];
}