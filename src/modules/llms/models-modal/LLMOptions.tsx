import * as React from 'react';

import { IconButton, Tooltip } from '@mui/joy';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { DModelParameterSpec, FALLBACK_LLM_PARAM_RESPONSE_TOKENS, FALLBACK_LLM_PARAM_TEMPERATURE, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { InlineError } from '~/common/components/InlineError';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';


const reasoningEffortOptions = [
  { value: 'high', label: 'High', description: 'Deep, thorough analysis' },
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning depth' },
  { value: 'low', label: 'Low', description: 'Quick, concise responses' },
  { value: 'unspecified', label: 'Default', description: 'Default value (unset)' },
] as const;


export function LLMOptions(props: { llm: DLLM }) {

  // input state
  const { id: llmId, maxOutputTokens, initialParameters, userParameters, parameterSpecs } = props.llm;

  // external state
  const { updateLLMUserParameters, deleteLLMUserParameter } = llmsStoreActions();
  const allParameters = getAllModelParameterValues(initialParameters, userParameters);

  // derived state
  const llmTemperature = allParameters?.llmTemperature ?? FALLBACK_LLM_PARAM_TEMPERATURE;
  const llmResponseTokens = allParameters?.llmResponseTokens ?? FALLBACK_LLM_PARAM_RESPONSE_TOKENS;
  const llmVndOaiReasoningEffort = allParameters?.llmVndOaiReasoningEffort;
  const tempAboveOne = llmTemperature > 1;

  // more state (here because the initial state depends on props)
  const [overheat, setOverheat] = React.useState(llmTemperature > 1);


  // handlers

  const handleOverheatToggle = React.useCallback(() => {
    if (overheat && tempAboveOne)
      updateLLMUserParameters(llmId, { llmTemperature: 1 });
    setOverheat(!overheat);
  }, [llmId, overheat, tempAboveOne, updateLLMUserParameters]);


  // find the reasoning effort parameter spec
  const paramReasoningEffort = parameterSpecs?.find(p => p.paramId === 'llmVndOaiReasoningEffort') as DModelParameterSpec<'llmVndOaiReasoningEffort'> | undefined;

  const showOverheatButton = overheat || tempAboveOne;


  return <>

    <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature < 0.33 ? 'More strict' : llmTemperature > 1 ? 'Extra hot ♨️' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      min={0} max={overheat ? 2 : 1} step={0.1} defaultValue={0.5}
      valueLabelDisplay='on'
      value={llmTemperature}
      onChange={value => updateLLMUserParameters(llmId, { llmTemperature: value })}
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
        onChange={value => updateLLMUserParameters(llmId, { llmResponseTokens: value })}
      />
    ) : (
      <InlineError error='Max Output Tokens: Token computations are disabled because this model does not declare the context window size.' />
    )}

    {paramReasoningEffort && (
      <FormSelectControl
        title='Reasoning Effort'
        tooltip='Controls how much effort the model spends on reasoning'
        value={llmVndOaiReasoningEffort ?? 'unspecified'}
        onChange={(value) => {
          if (value === 'unspecified' || !value)
            deleteLLMUserParameter(llmId, 'llmVndOaiReasoningEffort');
          else
            updateLLMUserParameters(llmId, { 'llmVndOaiReasoningEffort': value });
        }}
        options={reasoningEffortOptions}
      />
    )}

  </>;
}