import * as React from 'react';

import { IconButton, Tooltip } from '@mui/joy';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

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

  // derived state
  const { id: llmId, maxOutputTokens, options } = props.llm;
  const { llmResponseTokens, llmTemperature } = normalizeOpenAIOptions(options);

  // state (here because the initial state depends on props)
  const [overheat, setOverheat] = React.useState(llmTemperature > 1);

  const showOverheatButton = overheat || llmTemperature >= 1;

  const handleOverheatToggle = React.useCallback(() => {
    if (overheat && llmTemperature > 1)
      useModelsStore.getState().updateLLMOptions(llmId, { llmTemperature: 1 });
    setOverheat(!overheat);
  }, [llmId, llmTemperature, overheat]);


  return <>

    <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature < 0.33 ? 'More strict' : llmTemperature > 1 ? 'Extra hot ♨️' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      min={0} max={overheat ? 2 : 1} step={0.1} defaultValue={0.5}
      valueLabelDisplay='on'
      value={llmTemperature}
      onChange={value => useModelsStore.getState().updateLLMOptions(llmId, { llmTemperature: value })}
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

    <FormSliderControl
      title='Output Tokens' ariaLabel='Model Max Tokens'
      min={256} max={maxOutputTokens} step={256} defaultValue={1024}
      valueLabelDisplay='on'
      value={llmResponseTokens}
      onChange={value => useModelsStore.getState().updateLLMOptions(llmId, { llmResponseTokens: value })}
    />

  </>;
}