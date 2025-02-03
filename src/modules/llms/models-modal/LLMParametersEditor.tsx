import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import { DModelParameterId, DModelParameterSpec, DModelParameterValues, FALLBACK_LLM_PARAM_RESPONSE_TOKENS, FALLBACK_LLM_PARAM_TEMPERATURE, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { InlineError } from '~/common/components/InlineError';


const _UNSPECIFIED = '_UNSPECIFIED' as const;
const _reasoningEffortOptions = [
  { value: 'high', label: 'High', description: 'Deep, thorough analysis' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning depth' } as const,
  { value: 'low', label: 'Low', description: 'Quick, concise responses' } as const,
  { value: _UNSPECIFIED, label: 'Default', description: 'Default value (unset)' } as const,
] as const;


export function LLMParametersEditor(props: {
  // consts
  maxOutputTokens: number | null,
  parameterSpecs: DModelParameterSpec<DModelParameterId>[],
  parameterOmitTemperature?: boolean,
  baselineParameters: DModelParameterValues,

  // value and onChange for the parameters
  parameters: undefined | DModelParameterValues,
  onChangeParameter: (parameterValue: DModelParameterValues) => void,
  onRemoveParameter: (parameterId: DModelParameterId) => void,
}) {

  // derived input
  const { maxOutputTokens, parameterSpecs, baselineParameters, parameters, onChangeParameter, onRemoveParameter } = props;

  // external state
  const allParameters = getAllModelParameterValues(baselineParameters, parameters);

  // derived state
  const llmTemperature: number | null = allParameters.llmTemperature === undefined ? FALLBACK_LLM_PARAM_TEMPERATURE : allParameters.llmTemperature;
  const llmResponseTokens = allParameters.llmResponseTokens ?? FALLBACK_LLM_PARAM_RESPONSE_TOKENS;
  const llmVndGeminiShowThoughts = allParameters.llmVndGeminiShowThoughts;
  const llmVndOaiReasoningEffort = allParameters.llmVndOaiReasoningEffort;
  const llmVndOaiRestoreMarkdown = !!allParameters.llmVndOaiRestoreMarkdown;
  const tempAboveOne = llmTemperature !== null && llmTemperature > 1;

  // more state (here because the initial state depends on props)
  const [overheat, setOverheat] = React.useState(tempAboveOne);


  // handlers

  const handleOverheatToggle = React.useCallback(() => {
    // snap to 1 when disabling overheating
    if (overheat && tempAboveOne)
      onChangeParameter({ llmTemperature: 1 });

    // toggle overheating
    setOverheat(on => !on);
  }, [onChangeParameter, overheat, tempAboveOne]);


  // find the gemini show thoughts parameter spec
  const paramSpecGeminiShowThoughts = parameterSpecs?.find(p => p.paramId === 'llmVndGeminiShowThoughts') as DModelParameterSpec<'llmVndGeminiShowThoughts'> | undefined;

  // find the reasoning effort parameter spec
  // NOTE: optimization: this controls both the 'reasoning effort' and 'restore markdown' UI settings
  const paramSpecReasoningEffort = parameterSpecs?.find(p => p.paramId === 'llmVndOaiReasoningEffort') as DModelParameterSpec<'llmVndOaiReasoningEffort'> | undefined;

  const showOverheatButton = overheat || llmTemperature === 1 || tempAboveOne;

  return <>

    <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature === null ? 'Unsupported' : llmTemperature < 0.33 ? 'More strict' : llmTemperature > 1 ? 'Extra hot ♨️' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      disabled={props.parameterOmitTemperature}
      min={0} max={overheat ? 2 : 1} step={0.1} defaultValue={0.5}
      valueLabelDisplay={parameters?.llmTemperature !== undefined ? 'on' : 'auto'}
      value={llmTemperature}
      onChange={value => onChangeParameter({ llmTemperature: value })}
      endAdornment={
        <Tooltip title={overheat ? 'Disable LLM Overheating' : 'Increase Max LLM Temperature to 2'} sx={{ p: 1 }}>
          <IconButton
            disabled={!showOverheatButton}
            variant={overheat ? 'soft' : 'plain'} color={overheat ? 'danger' : 'neutral'}
            onClick={handleOverheatToggle} sx={{ ml: 2 }}
          >
            <LocalFireDepartmentIcon />
          </IconButton>
        </Tooltip>
      }
    />

    {(llmResponseTokens !== null && maxOutputTokens !== null) ? (
      <Box sx={{ mr: 1 }}>
        <FormSliderControl
          title='Output Tokens' ariaLabel='Model Max Tokens'
          min={256} max={maxOutputTokens} step={256} defaultValue={1024}
          valueLabelDisplay={parameters?.llmResponseTokens !== undefined ? 'on' : 'auto'}
          value={llmResponseTokens}
          onChange={value => onChangeParameter({ llmResponseTokens: value })}
        />
      </Box>
    ) : (
      <InlineError error='Max Output Tokens: Token computations are disabled because this model does not declare the context window size.' />
    )}

    {paramSpecGeminiShowThoughts && (
      <FormSwitchControl
        title='Show Chain of Thought'
        description={`Displays Gemini\'s reasoning process`}
        checked={!!llmVndGeminiShowThoughts}
        onChange={checked => onChangeParameter({ llmVndGeminiShowThoughts: checked })}
      />
    )}

    {paramSpecReasoningEffort && (
      <FormSelectControl
        title='Reasoning Effort'
        tooltip='Controls how much effort the model spends on reasoning'
        value={llmVndOaiReasoningEffort ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiReasoningEffort');
          else
            onChangeParameter({ llmVndOaiReasoningEffort: value });
        }}
        options={_reasoningEffortOptions}
      />
    )}

    {paramSpecReasoningEffort && (
      <FormSwitchControl
        title='Restore Markdown'
        description='Enable markdown formatting'
        tooltip='o1 and o3 models in the API will avoid generating responses with markdown formatting. This option signals to the model to re-enable markdown formatting in the respons'
        checked={llmVndOaiRestoreMarkdown}
        onChange={checked => {
          if (!checked)
            onRemoveParameter('llmVndOaiRestoreMarkdown');
          else
            onChangeParameter({ llmVndOaiRestoreMarkdown: true });
        }}
      />
    )}

  </>;
}