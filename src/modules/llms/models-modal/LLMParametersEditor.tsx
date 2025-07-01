import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ClearIcon from '@mui/icons-material/Clear';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

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
  { value: 'high', label: 'Comprehensive', description: 'Largest, highest cost, slower' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced context, cost, and speed' } as const,
  { value: 'low', label: 'Low', description: 'Smallest, cheapest, fastest' } as const,
  { value: _UNSPECIFIED, label: 'Default', description: 'Default value (unset)' } as const,
] as const;
const _perplexitySearchModeOptions = [
  { value: _UNSPECIFIED, label: 'Default', description: 'General web sources' },
  { value: 'academic', label: 'Academic', description: 'Scholarly and peer-reviewed sources' },
] as const;
const _perplexityDateFilterOptions = [
  { value: _UNSPECIFIED, label: 'All Time', description: 'No date restriction' },
  { value: '1m', label: 'Last Month', description: 'Results from last 30 days' },
  { value: '3m', label: 'Last 3 Months', description: 'Results from last 90 days' },
  { value: '6m', label: 'Last 6 Months', description: 'Results from last 6 months' },
  { value: '1y', label: 'Last Year', description: 'Results from last 12 months' },
] as const;

export function LLMParametersEditor(props: {
  // constants
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

  // registry (const) values
  const defAntTB = DModelParameterRegistry['llmVndAntThinkingBudget'];
  const defGemTB = DModelParameterRegistry['llmVndGeminiThinkingBudget'];

  // specs: whether a models supports a parameter
  const modelParamSpec = React.useMemo(() => {
    return Object.fromEntries(
      (props.parameterSpecs ?? []).map(spec => [spec.paramId, spec]),
    ) as Record<DModelParameterId, DModelParameterSpec<DModelParameterId>>;
  }, [props.parameterSpecs]);


  // current values: { ...fallback, ...baseline, ...user }
  const allParameters = getAllModelParameterValues(props.baselineParameters, props.parameters);
  const {
    llmResponseTokens = FALLBACK_LLM_PARAM_RESPONSE_TOKENS, // fallback for undefined, result is number | null
    llmTemperature = FALLBACK_LLM_PARAM_TEMPERATURE, // fallback for undefined, result is number | null
    llmForceNoStream,
    llmVndAntThinkingBudget,
    llmVndGeminiShowThoughts,
    llmVndGeminiThinkingBudget,
    llmVndOaiReasoningEffort,
    llmVndOaiRestoreMarkdown,
    llmVndOaiWebSearchContext,
    llmVndOaiWebSearchGeolocation,
    llmVndPerplexityDateFilter,
    llmVndPerplexitySearchMode,
  } = allParameters;


  // state (here because the initial state depends on props)
  const tempAboveOne = llmTemperature !== null && llmTemperature > 1;
  const [overheat, setOverheat] = React.useState(tempAboveOne);
  const showOverheatButton = overheat || llmTemperature === 1 || tempAboveOne;


  // handlers

  const { onChangeParameter, onRemoveParameter } = props;

  const handleOverheatToggle = React.useCallback(() => {
    // snap to 1 when disabling overheating
    if (overheat && tempAboveOne)
      onChangeParameter({ llmTemperature: 1 });

    // toggle overheating
    setOverheat(on => !on);
  }, [onChangeParameter, overheat, tempAboveOne]);


  // semantics
  function showParam(paramId: DModelParameterId): boolean {
    return paramId in modelParamSpec && !modelParamSpec[paramId].hidden;
  }

  const temperatureHide = showParam('llmVndAntThinkingBudget');
  const antThinkingOff = llmVndAntThinkingBudget === null;
  const gemThinkingAuto = llmVndGeminiThinkingBudget === undefined;
  const gemThinkingOff = llmVndGeminiThinkingBudget === 0;

  // Get the range override if available for Gemini thinking budget
  const gemTBSpec = modelParamSpec['llmVndGeminiThinkingBudget'];
  const gemTBMinMax = gemTBSpec?.rangeOverride || defGemTB.range;

  return <>

    {!temperatureHide && <FormSliderControl
      title='Temperature' ariaLabel='Model Temperature'
      description={llmTemperature === null ? 'Unsupported' : llmTemperature < 0.33 ? 'More strict' : llmTemperature > 1 ? 'Extra hot ♨️' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}
      disabled={props.parameterOmitTemperature}
      min={0} max={overheat ? 2 : 1} step={0.1} defaultValue={0.5}
      valueLabelDisplay={props.parameters?.llmTemperature !== undefined ? 'on' : 'auto'} // detect user-overridden or not
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

    {llmResponseTokens === null || props.maxOutputTokens === null ? (
      <InlineError error='Max Output Tokens: Token computations are disabled because this model does not declare the context window size.' />
    ) : !props.simplified && (
      <Box sx={{ mr: 1 }}>
        <FormSliderControl
          title='Output Tokens' ariaLabel='Model Max Tokens'
          description='Max Size'
          min={256} max={props.maxOutputTokens} step={256} defaultValue={1024}
          valueLabelDisplay={props.parameters?.llmResponseTokens !== undefined ? 'on' : 'auto'} // detect user-overridden or not
          value={llmResponseTokens}
          onChange={value => onChangeParameter({ llmResponseTokens: value })}
        />
      </Box>
    )}

    {showParam('llmVndAntThinkingBudget') && (
      <FormSliderControl
        title='Thinking Budget' ariaLabel='Anthropic Extended Thinking Token Budget'
        description='Tokens'
        min={defAntTB.range[0]} max={defAntTB.range[1]} step={1024}
        valueLabelDisplay={antThinkingOff ? 'off' : 'on'}
        value={llmVndAntThinkingBudget ?? 0}
        disabled={antThinkingOff}
        onChange={value => onChangeParameter({ llmVndAntThinkingBudget: value })}
        endAdornment={
          <Tooltip arrow disableInteractive title={antThinkingOff ? 'Enable Thinking' : 'Disable Thinking'}>
            <IconButton
              variant={antThinkingOff ? 'solid' : 'outlined'}
              onClick={() => antThinkingOff
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

    {showParam('llmVndGeminiShowThoughts') && (
      <FormSwitchControl
        title='Show Chain of Thought'
        description={`Displays Gemini\'s reasoning process`}
        checked={!!llmVndGeminiShowThoughts}
        onChange={checked => onChangeParameter({ llmVndGeminiShowThoughts: checked })}
      />
    )}

    {showParam('llmVndGeminiThinkingBudget') && (
      <FormSliderControl
        title='Thinking Budget' ariaLabel='Gemini Thinking Token Budget'
        description={gemThinkingAuto ? 'Auto' : gemThinkingOff ? 'Thinking Off' : 'Tokens'}
        min={gemTBMinMax[0]} max={gemTBMinMax[1]} step={1024}
        valueLabelDisplay={(gemThinkingAuto || gemThinkingOff) ? 'off' : 'on'}
        value={llmVndGeminiThinkingBudget ?? [gemTBMinMax[0], gemTBMinMax[1]]}
        variant={gemThinkingAuto ? 'soft' : undefined}
        // disabled={gemThinkingAuto}
        onChange={value => onChangeParameter({ llmVndGeminiThinkingBudget: Array.isArray(value) ? (value[0] || value[1]) : value })}
        startAdornment={gemTBMinMax[0] === 0 && (
          <Tooltip arrow disableInteractive title={gemThinkingOff ? 'Thinking Off' : 'Disable Thinking'}>
            <IconButton
              variant={gemThinkingOff ? 'solid' : 'outlined'}
              // disabled={gemThinkingOff}
              onClick={() => onChangeParameter({ llmVndGeminiThinkingBudget: 0 })}
              sx={{ mr: 2 }}
            >
              {gemThinkingOff ? <ClearIcon sx={{ fontSize: 'lg' }} /> : <PowerSettingsNewIcon />}
            </IconButton>
          </Tooltip>
        )}
        endAdornment={
          <Tooltip arrow disableInteractive title={gemThinkingAuto ? 'Automatic Thinking (default)' : 'Auto Budget'}>
            <IconButton
              variant={gemThinkingAuto ? 'solid' : 'outlined'}
              // disabled={gemThinkingAuto}
              onClick={() => onRemoveParameter('llmVndGeminiThinkingBudget')}
              sx={{ ml: 2 }}
            >
              <AutoModeIcon sx={{ fontSize: 'xl' }} />
            </IconButton>
          </Tooltip>
        }
      />
    )}

    {showParam('llmVndPerplexitySearchMode') && (
      <FormSelectControl
        title='Search Mode'
        tooltip='Type of sources to prioritize in search results'
        value={llmVndPerplexitySearchMode ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndPerplexitySearchMode');
          else
            onChangeParameter({ llmVndPerplexitySearchMode: value });
        }}
        options={_perplexitySearchModeOptions}
      />
    )}

    {showParam('llmVndOaiWebSearchContext') && (
      <FormSelectControl
        title='Search Size'
        tooltip='Controls how much context is retrieved from the web (low = default for Perplexity, medium = default for OpenAI)'
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

    {showParam('llmVndOaiWebSearchGeolocation') && (
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

    {showParam('llmVndPerplexityDateFilter') && (
      <FormSelectControl
        title='Date Range'
        tooltip='Filter search results by publication date'
        value={llmVndPerplexityDateFilter ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndPerplexityDateFilter');
          else
            onChangeParameter({ llmVndPerplexityDateFilter: value });
        }}
        options={_perplexityDateFilterOptions}
      />
    )}

    {showParam('llmVndOaiReasoningEffort') && (
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

    {showParam('llmVndOaiRestoreMarkdown') && (
      <FormSwitchControl
        title='Restore Markdown'
        description='Enable markdown formatting'
        tooltip='o1 and o3 models in the API will avoid generating responses with markdown formatting. This option signals to the model to re-enable markdown formatting in the respons'
        checked={!!llmVndOaiRestoreMarkdown}
        onChange={checked => {
          if (!checked)
            onChangeParameter({ llmVndOaiRestoreMarkdown: false });
          else
            onChangeParameter({ llmVndOaiRestoreMarkdown: true });
        }}
      />
    )}

    {showParam('llmForceNoStream') && (
      <FormSwitchControl
        title='Disable Streaming'
        description='Receive complete responses'
        tooltip='Turn on to get entire responses at once. Useful for models with streaming issues, but will make responses appear slower.'
        checked={!!llmForceNoStream}
        onChange={checked => {
          if (!checked)
            onRemoveParameter('llmForceNoStream');
          else
            onChangeParameter({ llmForceNoStream: true });
        }}
      />
    )}

  </>;
}