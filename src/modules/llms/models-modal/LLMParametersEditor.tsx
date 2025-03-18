import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import { DModelParameterId, DModelParameterRegistry, DModelParameterSpec, DModelParameterValues, FALLBACK_LLM_PARAM_RESPONSE_TOKENS, FALLBACK_LLM_PARAM_TEMPERATURE, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { InlineError } from '~/common/components/InlineError';
import { webGeolocationRequest } from '~/common/util/webGeolocationUtils';


const _UNSPECIFIED = '_UNSPECIFIED' as const;
const _reasoningEffortOptions = [
  { value: 'high', label: 'High', description: 'Deep, thorough analysis' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning depth' } as const,
  { value: 'low', label: 'Low', description: 'Quick, concise responses' } as const,
  { value: _UNSPECIFIED, label: 'Default', description: 'Default value (unset)' } as const,
] as const;
const _webSearchContextOptions = [
  { value: 'high', label: 'High', description: 'Largest, highest cost, slower' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced context, cost, and speed' } as const,
  { value: 'low', label: 'Low', description: 'Smallest, cheapest, fastest' } as const,
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

  // rendering options
  simplified?: boolean,
}) {

  // derived input
  const { maxOutputTokens, parameterSpecs, baselineParameters, parameters, onChangeParameter, onRemoveParameter, simplified } = props;

  // external state
  const allParameters = getAllModelParameterValues(baselineParameters, parameters);

  // derived state
  const llmTemperature: number | null = allParameters.llmTemperature === undefined ? FALLBACK_LLM_PARAM_TEMPERATURE : allParameters.llmTemperature;
  const llmResponseTokens = allParameters.llmResponseTokens ?? FALLBACK_LLM_PARAM_RESPONSE_TOKENS;
  const llmVndAntThinkingBudget = allParameters.llmVndAntThinkingBudget;
  const llmVndGeminiShowThoughts = allParameters.llmVndGeminiShowThoughts;
  const llmVndOaiReasoningEffort = allParameters.llmVndOaiReasoningEffort;
  const llmVndOaiRestoreMarkdown = !!allParameters.llmVndOaiRestoreMarkdown;
  const llmVndOaiWebSearchContext = allParameters.llmVndOaiWebSearchContext;
  const llmVndOaiWebSearchGeolocation = allParameters.llmVndOaiWebSearchGeolocation;
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


  // optional parameters definitions
  const { llmVndAntThinkingBudget: defAntTB } = DModelParameterRegistry;

  // optional params specs - a spec is a definition of a parameter, and whether it's required or hidden, for a particular model
  const paramSpecAntThinkingBudget = parameterSpecs?.find(p => p.paramId === 'llmVndAntThinkingBudget') as DModelParameterSpec<'llmVndAntThinkingBudget'> | undefined;
  const paramSpecGeminiShowThoughts = parameterSpecs?.find(p => p.paramId === 'llmVndGeminiShowThoughts') as DModelParameterSpec<'llmVndGeminiShowThoughts'> | undefined;
  const paramSpecReasoningEffort = parameterSpecs?.find(p => p.paramId === 'llmVndOaiReasoningEffort') as DModelParameterSpec<'llmVndOaiReasoningEffort'> | undefined;
  const paramSpecRestoreMarkdown = parameterSpecs?.find(p => p.paramId === 'llmVndOaiRestoreMarkdown') as DModelParameterSpec<'llmVndOaiRestoreMarkdown'> | undefined;
  const paramSpecWebSearchContext = parameterSpecs?.find(p => p.paramId === 'llmVndOaiWebSearchContext') as DModelParameterSpec<'llmVndOaiWebSearchContext'> | undefined;
  const paramSpecWebSearchGeolocation = parameterSpecs?.find(p => p.paramId === 'llmVndOaiWebSearchGeolocation') as DModelParameterSpec<'llmVndOaiWebSearchGeolocation'> | undefined;

  const hideTemperature = !!paramSpecAntThinkingBudget;
  const showOverheatButton = overheat || llmTemperature === 1 || tempAboveOne;

  const llmVndAntThinkingNull = llmVndAntThinkingBudget === null;

  return <>

    {!hideTemperature && <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature === null ? 'Unsupported' : llmTemperature < 0.33 ? 'More strict' : llmTemperature > 1 ? 'Extra hot ♨️' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      disabled={props.parameterOmitTemperature}
      min={0} max={overheat ? 2 : 1} step={0.1} defaultValue={0.5}
      valueLabelDisplay={parameters?.llmTemperature !== undefined ? 'on' : 'auto'}
      value={llmTemperature}
      onChange={value => onChangeParameter({ llmTemperature: value })}
      endAdornment={
        <Tooltip arrow disableInteractive title={overheat ? 'Disable LLM Overheating' : 'Increase Max LLM Temperature to 2'} sx={{ p: 1 }}>
          <IconButton
            disabled={!showOverheatButton}
            variant={overheat ? 'soft' : 'plain'} color={overheat ? 'danger' : 'neutral'}
            onClick={handleOverheatToggle} sx={{ ml: 2 }}
          >
            <LocalFireDepartmentIcon />
          </IconButton>
        </Tooltip>
      }
    />}

    {llmResponseTokens === null || maxOutputTokens === null ? (
      <InlineError error='Max Output Tokens: Token computations are disabled because this model does not declare the context window size.' />
    ) : !props.simplified && (
      <Box sx={{ mr: 1 }}>
        <FormSliderControl
          title='Output Tokens' ariaLabel='Model Max Tokens'
          description='Max Size'
          min={256} max={maxOutputTokens} step={256} defaultValue={1024}
          valueLabelDisplay={parameters?.llmResponseTokens !== undefined ? 'on' : 'auto'}
          value={llmResponseTokens}
          onChange={value => onChangeParameter({ llmResponseTokens: value })}
        />
      </Box>
    )}

    {paramSpecAntThinkingBudget && (
      <FormSliderControl
        title='Thinking Budget' ariaLabel='Anthropic Extended Thinking Token Budget'
        description='Tokens'
        min={defAntTB.range[0]} max={defAntTB.range[1]} step={1024}
        valueLabelDisplay={llmVndAntThinkingNull ? 'off' : 'on'}
        value={llmVndAntThinkingBudget ?? 0}
        disabled={llmVndAntThinkingNull}
        onChange={value => onChangeParameter({ llmVndAntThinkingBudget: value })}
        endAdornment={
          <Tooltip arrow disableInteractive title={llmVndAntThinkingNull ? 'Enable Thinking' : 'Disable Thinking'}>
            <IconButton
              variant={llmVndAntThinkingNull ? 'solid' : 'outlined'}
              onClick={() => llmVndAntThinkingNull
                ? onRemoveParameter('llmVndAntThinkingBudget')
                : onChangeParameter({ llmVndAntThinkingBudget: null })
              }
              sx={{ ml: 2 }}
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>
        }
      />
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

    {paramSpecRestoreMarkdown && (
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

    {paramSpecWebSearchContext && (
      <FormSelectControl
        title='Search Context Size'
        tooltip='Controls how much context is retrieved from the web'
        value={llmVndOaiWebSearchContext ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiWebSearchContext');
          else
            onChangeParameter({ llmVndOaiWebSearchContext: value });
        }}
        options={_webSearchContextOptions}
      />
    )}

    {paramSpecWebSearchGeolocation && (
      <FormSwitchControl
        title='Add User Location'
        description='Use approximate location for better search results'
        tooltip='When enabled, uses browser geolocation API to provide approximate location data to improve search results relevance'
        checked={!!llmVndOaiWebSearchGeolocation}
        onChange={checked => {
          if (!checked)
            onRemoveParameter('llmVndOaiWebSearchGeolocation');
          else {
            webGeolocationRequest().then((locationOrNull) => {
              if (locationOrNull)
                onChangeParameter({ llmVndOaiWebSearchGeolocation: true });
            });
          }
        }}
      />
    )}

  </>;
}