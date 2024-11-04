import * as React from 'react';

import { IconButton, Tooltip } from '@mui/joy';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { InlineError } from '~/common/components/InlineError';

import { llmsStoreActions } from '~/common/stores/llms/store-llms';

import { DOpenAILLMOptions, FALLBACK_LLM_RESPONSE_TOKENS, FALLBACK_LLM_TEMPERATURE } from './openai.vendor';


function normalizeOpenAIOptions(partialOptions?: Partial<DOpenAILLMOptions>) {
  return {
    llmRef: 'unknown_id',
    llmTemperature: FALLBACK_LLM_TEMPERATURE,
    llmResponseTokens: FALLBACK_LLM_RESPONSE_TOKENS,
    ...partialOptions,
  };
}


export function OpenAILLMOptions(props: { llm: DLLM<DOpenAILLMOptions> }) {

  // derived state
  const { id: llmId, maxOutputTokens, options } = props.llm;
  const { llmResponseTokens, llmTemperature } = normalizeOpenAIOptions(options);
  const { updateLLMOptions } = llmsStoreActions();

  // state (here because the initial state depends on props)
  const [overheat, setOverheat] = React.useState(llmTemperature > 1);

  const showOverheatButton = overheat || llmTemperature >= 1;

  const handleOverheatToggle = React.useCallback(() => {
    if (overheat && llmTemperature > 1)
      updateLLMOptions(llmId, { llmTemperature: 1 });
    setOverheat(!overheat);
  }, [llmId, llmTemperature, overheat, updateLLMOptions]);


  return <>

    <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature < 0.33 ? 'More strict' : llmTemperature > 1 ? 'Extra hot ♨️' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      min={0} max={overheat ? 2 : 1} step={0.1} defaultValue={0.5}
      valueLabelDisplay='on'
      value={llmTemperature}
      onChange={value => updateLLMOptions(llmId, { llmTemperature: value })}
      endAdornment={showOverheatButton &&
        <Tooltip title={overheat ? 'Disable LLM Overheating' : 'Increase Max LLM Temperature to 2'} sx={{ p: 1 }}>
          <IconButton
            variant={overheat ? 'soft' : 'plain'} color={overheat ? 'danger' : 'neutral'}
            onClick={handleOverheatToggle} sx={{ ml: 2 }}
          >
            <LocalFireDepartmentIcon />
          </IconButton>
        </Tooltip>
      }
    />

    {(llmResponseTokens !== null && maxOutputTokens !== null) ? (
      <FormSliderControl
        title='Output Tokens' ariaLabel='Model Max Tokens'
        min={256} max={maxOutputTokens} step={256} defaultValue={1024}
        valueLabelDisplay='on'
        value={llmResponseTokens}
        onChange={value => updateLLMOptions(llmId, { llmResponseTokens: value })}
      />
    ) : (
      <InlineError error='Max Output Tokens: Token computations are disabled because this model does not declare the context window size.' />
    )}

  </>;
}