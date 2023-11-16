import * as React from 'react';

import { FormSliderControl } from '~/common/components/forms/FormSliderControl';

import { DLLM, useModelsStore } from '../../store-llms';
import { LLMOptionsOpenAI } from './openai.vendor';


function normalizeOpenAIOptions(partialOptions?: Partial<LLMOptionsOpenAI>) {
  return {
    llmRef: 'unknown_id',
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...partialOptions,
  };
}


export function OpenAILLMOptions(props: { llm: DLLM<unknown, LLMOptionsOpenAI> }) {

  const { id: llmId, maxOutputTokens, options } = props.llm;
  const { llmResponseTokens, llmTemperature } = normalizeOpenAIOptions(options);

  return <>

    <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature < 0.33 ? 'More strict' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      min={0} max={1} step={0.1} defaultValue={0.5}
      valueLabelDisplay='on'
      value={llmTemperature}
      onChange={value => useModelsStore.getState().updateLLMOptions(llmId, { llmTemperature: value })}
    />

    <FormSliderControl
      title='Output Tokens' ariaLabel='Model Max Tokens'
      min={256} max={maxOutputTokens} step={256} defaultValue={1024}
      valueLabelDisplay='on'
      value={llmResponseTokens}
      onChange={value => useModelsStore.getState().updateLLMOptions(llmId, { llmResponseTokens: value })}
    />

  </>;
}