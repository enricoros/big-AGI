import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ClearIcon from '@mui/icons-material/Clear';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import type { DLLMMaxOutputTokens } from '~/common/stores/llms/llms.types';
import { DModelParameterId, DModelParameterRegistry, DModelParameterSpec, DModelParameterValues, FALLBACK_LLM_PARAM_RESPONSE_TOKENS, FALLBACK_LLM_PARAM_TEMPERATURE, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { InlineError } from '~/common/components/InlineError';
import { useUIComplexityMode } from '~/common/stores/store-ui';
import { webGeolocationRequest } from '~/common/util/webGeolocationUtils';

import { AnthropicSkillsConfig } from './AnthropicSkillsConfig';


const _UNSPECIFIED = '_UNSPECIFIED' as const;
const _reasoningEffortOptions = [
  { value: 'high', label: 'High', description: 'Deep, thorough analysis' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning depth' } as const,
  { value: 'low', label: 'Low', description: 'Quick, concise responses' } as const,
  { value: _UNSPECIFIED, label: 'Default', description: 'Default value (unset)' } as const,
] as const;
const _reasoningEffort4Options = [
  { value: 'high', label: 'High', description: 'Deep, thorough analysis' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning depth' } as const,
  { value: 'low', label: 'Low', description: 'Quick, concise responses' } as const,
  { value: 'minimal', label: 'Minimal', description: 'Fastest, cheapest, least reasoning' } as const,
  { value: _UNSPECIFIED, label: 'Default', description: 'Default value (unset)' } as const,
] as const;
const _verbosityOptions = [
  { value: 'high', label: 'Detailed', description: 'Thorough responses, great for audits' } as const,
  { value: 'medium', label: 'Balanced', description: 'Standard detail level (default)' } as const,
  { value: 'low', label: 'Brief', description: 'Concise responses' } as const,
  { value: _UNSPECIFIED, label: 'Default', description: 'Default value (unset)' } as const,
] as const;
const _webSearchContextOptions = [
  { value: 'high', label: 'Comprehensive', description: 'Largest, highest cost, slower' } as const,
  { value: 'medium', label: 'Medium', description: 'Balanced context, cost, and speed' } as const,
  { value: 'low', label: 'Low', description: 'Smallest, cheapest, fastest' } as const,
  { value: _UNSPECIFIED, label: 'Off', description: 'Default (disabled)' } as const,
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

const _geminiAspectRatioOptions = [
  { value: _UNSPECIFIED, label: 'Auto', description: 'Model decides' },
  { value: '1:1', label: '1:1', description: 'Square' },
  { value: '2:3', label: '2:3', description: 'Portrait' },
  { value: '3:2', label: '3:2', description: 'Landscape' },
  { value: '3:4', label: '3:4', description: 'Portrait' },
  { value: '4:3', label: '4:3', description: 'Landscape' },
  { value: '9:16', label: '9:16', description: 'Tall portrait' },
  { value: '16:9', label: '16:9', description: 'Wide landscape' },
  { value: '21:9', label: '21:9', description: 'Ultra wide' },
] as const;

const _geminiImageSizeOptions = [
  { value: _UNSPECIFIED, label: 'Default', description: '1K (default)' },
  { value: '1K', label: '1K', description: 'Default' },
  { value: '2K', label: '2K', description: '2K' },
  { value: '4K', label: '4K', description: '4K' },
] as const;

const _geminiCodeExecutionOptions = [
  { value: 'auto', label: 'On', description: 'Enable code generation and execution' },
  { value: _UNSPECIFIED, label: 'Off', description: 'Disabled (default)' },
] as const;

const _geminiGoogleSearchOptions = [
  { value: 'unfiltered', label: 'On', description: 'Web Search' },
  { value: '1d', label: 'Last Day', description: 'Last 24 hours' },
  { value: '1w', label: 'Last Week', description: 'Recent results' },
  { value: '1m', label: 'Last Month', description: 'Results from last month' },
  { value: '1y', label: 'Last Year', description: 'Results since last year' },
  // { value: '6m', label: 'Last 6 Months', description: 'Results from last 6 months' },
  { value: _UNSPECIFIED, label: 'Off', description: 'Default (disabled)' },
] as const;

const _geminiMediaResolutionOptions = [
  { value: 'mr_high', label: 'High', description: 'Best quality, higher token usage' },
  { value: 'mr_medium', label: 'Medium', description: 'Balanced quality and cost' },
  { value: 'mr_low', label: 'Low', description: 'Faster, lower cost' },
  { value: _UNSPECIFIED, label: 'Auto', description: 'Model optimizes based on media type (default)' },
] as const;

const _geminiThinkingLevelOptions = [
  { value: 'high', label: 'High', description: 'Maximum reasoning depth' },
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning' },
  { value: 'low', label: 'Low', description: 'Quick responses (default when unset)' },
  { value: _UNSPECIFIED, label: 'Default', description: 'Model decides automatically (default)' },
] as const;

const _xaiSearchModeOptions = [
  { value: 'auto', label: 'Auto', description: 'Model decides (default)' },
  { value: 'on', label: 'On', description: 'Always search active sources' },
  { value: 'off', label: 'Off', description: 'Never perform a search' },
] as const;

const _antWebSearchOptions = [
  { value: 'auto', label: 'On', description: 'Enable web search for real-time information' },
  { value: _UNSPECIFIED, label: 'Off', description: 'Disabled (default)' },
] as const;

const _antWebFetchOptions = [
  { value: 'auto', label: 'On', description: 'Enable fetching web content and PDFs' },
  { value: _UNSPECIFIED, label: 'Off', description: 'Disabled (default)' },
] as const;

const _antEffortOptions = [
  { value: _UNSPECIFIED, label: 'High', description: 'Maximum capability (default)' },
  { value: 'medium', label: 'Medium', description: 'Balanced speed and quality' },
  { value: 'low', label: 'Low', description: 'Fastest, most efficient' },
] as const;

// const _moonshotWebSearchOptions = [
//   { value: 'auto', label: 'On', description: 'Enable Kimi $web_search ($0.005 per search)' },
//   { value: _UNSPECIFIED, label: 'Off', description: 'Disabled (default)' },
// ] as const;

const _ortWebSearchOptions = [
  { value: 'auto', label: 'On', description: 'Enable web search (native for OpenAI/Anthropic, Exa for others)' },
  { value: _UNSPECIFIED, label: 'Off', description: 'Disabled (default)' },
] as const;

const _imageGenerationOptions = [
  { value: _UNSPECIFIED, label: 'Off', description: 'Default (disabled)' },
  { value: 'mq', label: 'Standard', description: 'Quick gen' },
  { value: 'hq', label: 'High Quality', description: 'Best looks' },
  { value: 'hq_edit', label: 'Precise Edits', description: 'Controlled' },
  // { value: 'hq_png', label: 'HD PNG', description: 'Uncompressed' }, // TODO: re-enable when uncompressed PNG saving is implemented
] as const;

const _xaiDateFilterOptions = [
  { value: 'unfiltered', label: 'All Time', description: 'No date restriction' },
  { value: '1d', label: 'Last Day', description: 'Results from last 24 hours' },
  { value: '1w', label: 'Last Week', description: 'Results from last 7 days' },
  { value: '1m', label: 'Last Month', description: 'Results from last 30 days' },
  { value: '6m', label: 'Last 6 Months', description: 'Results from last 6 months' },
  { value: '1y', label: 'Last Year', description: 'Results from last 12 months' },
] as const;


export function LLMParametersEditor(props: {
  // constants
  maxOutputTokens: DLLMMaxOutputTokens,
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

  // external state
  const isExtra = useUIComplexityMode() === 'extra';


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
    llmVndAnt1MContext,
    llmVndAntEffort,
    llmVndAntSkills,
    llmVndAntThinkingBudget,
    llmVndAntWebFetch,
    llmVndAntWebSearch,
    llmVndGeminiAspectRatio,
    llmVndGeminiCodeExecution,
    llmVndGeminiGoogleSearch,
    llmVndGeminiImageSize,
    llmVndGeminiMediaResolution,
    llmVndGeminiShowThoughts,
    llmVndGeminiThinkingBudget,
    llmVndGeminiThinkingLevel,
    // llmVndMoonshotWebSearch,
    llmVndOaiReasoningEffort,
    llmVndOaiReasoningEffort4,
    llmVndOaiRestoreMarkdown,
    llmVndOaiWebSearchContext,
    llmVndOaiWebSearchGeolocation,
    llmVndOaiImageGeneration,
    llmVndOaiVerbosity,
    llmVndOrtWebSearch,
    llmVndPerplexityDateFilter,
    llmVndPerplexitySearchMode,
    llmVndXaiSearchMode,
    llmVndXaiSearchSources,
    llmVndXaiSearchDateFilter,
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

  // Check if web search should be disabled due to minimal reasoning effort
  const isOaiReasoningEffortMinimal = llmVndOaiReasoningEffort4 === 'minimal';

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

    {showParam('llmVndAntEffort') && (
      <FormSelectControl
        title='Effort'
        tooltip='Controls token usage vs. thoroughness. Low = fastest, most efficient. High = maximum capability (default). Works alongside thinking budget.'
        value={llmVndAntEffort ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'high') onRemoveParameter('llmVndAntEffort');
          else onChangeParameter({ llmVndAntEffort: value });
        }}
        options={_antEffortOptions}
      />
    )}

    {showParam('llmVndAntWebSearch') && (
      <FormSelectControl
        title='Web Search'
        tooltip='Enable web search for real-time information retrieval'
        value={llmVndAntWebSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'off') onRemoveParameter('llmVndAntWebSearch');
          else onChangeParameter({ llmVndAntWebSearch: value });
        }}
        options={_antWebSearchOptions}
      />
    )}

    {showParam('llmVndAntWebFetch') && (
      <FormSelectControl
        title='Web Fetch'
        tooltip='Enable fetching full content from web pages and PDF documents'
        value={llmVndAntWebFetch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'off') onRemoveParameter('llmVndAntWebFetch');
          else onChangeParameter({ llmVndAntWebFetch: value });
        }}
        options={_antWebFetchOptions}
      />
    )}

    {showParam('llmVndAnt1MContext') && (
      <FormSwitchControl
        title='1M Context Window (Beta)'
        description='Enable 1M token context'
        tooltip='Enables the 1M token context window with premium pricing for &gt;200K input tokens. - https://docs.claude.com/en/docs/build-with-claude/context-windows#1m-token-context-window'
        checked={!!llmVndAnt1MContext}
        onChange={checked => {
          if (!checked) onRemoveParameter('llmVndAnt1MContext');
          else onChangeParameter({ llmVndAnt1MContext: true });
        }}
      />
    )}

    {isExtra && showParam('llmVndAntSkills') && (
      <AnthropicSkillsConfig llmVndAntSkills={llmVndAntSkills} onChangeParameter={onChangeParameter} onRemoveParameter={onRemoveParameter} />
    )}


    {showParam('llmVndGeminiImageSize') && (
      <FormSelectControl
        title='Image Size'
        tooltip='Controls the resolution of generated images'
        value={llmVndGeminiImageSize ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiImageSize');
          else onChangeParameter({ llmVndGeminiImageSize: value });
        }}
        options={_geminiImageSizeOptions}
      />
    )}

    {showParam('llmVndGeminiAspectRatio') && (
      <FormSelectControl
        title='Aspect Ratio'
        tooltip='Controls the aspect ratio of generated images'
        value={llmVndGeminiAspectRatio ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiAspectRatio');
          else onChangeParameter({ llmVndGeminiAspectRatio: value });
        }}
        options={_geminiAspectRatioOptions}
      />
    )}


    {showParam('llmVndGeminiGoogleSearch') && (
      <FormSelectControl
        title='Google Search'
        // tooltip='Enable Google Search grounding to ground responses in real-time web content. Optionally filter results by publication date.'
        value={llmVndGeminiGoogleSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiGoogleSearch');
          else onChangeParameter({ llmVndGeminiGoogleSearch: value });
        }}
        options={_geminiGoogleSearchOptions}
      />
    )}


    {showParam('llmVndGeminiShowThoughts') && (
      <FormSwitchControl
        title='Show Reasoning'
        description='Show chain of thoughts'
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

    {showParam('llmVndGeminiThinkingLevel') && (
      <FormSelectControl
        title='Thinking Level'
        tooltip='Controls internal reasoning depth. Replaces thinking_budget for Gemini 3 models. When unset, the model decides dynamically.'
        value={llmVndGeminiThinkingLevel ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiThinkingLevel');
          else onChangeParameter({ llmVndGeminiThinkingLevel: value });
        }}
        options={_geminiThinkingLevelOptions}
      />
    )}

    {showParam('llmVndGeminiCodeExecution') && (
      <FormSelectControl
        title='Code Execution'
        tooltip='Enable automatic Python code generation and execution by the model'
        value={llmVndGeminiCodeExecution ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiCodeExecution');
          else onChangeParameter({ llmVndGeminiCodeExecution: value });
        }}
        options={_geminiCodeExecutionOptions}
      />
    )}

    {showParam('llmVndGeminiMediaResolution') && (
      <FormSelectControl
        title='Media Resolution'
        tooltip='Controls vision processing quality for multimodal inputs. Higher resolution improves text reading and detail identification but increases token usage.'
        value={llmVndGeminiMediaResolution ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiMediaResolution');
          else onChangeParameter({ llmVndGeminiMediaResolution: value });
        }}
        options={_geminiMediaResolutionOptions}
      />
    )}


    {/*{showParam('llmVndMoonshotWebSearch') && (*/}
    {/*  <FormSelectControl*/}
    {/*    title='Web Search'*/}
    {/*    tooltip='Enable Kimi $web_search builtin function for real-time web search. Costs $0.005 per search. Use kimi-k2-turbo-preview for dynamic context handling.'*/}
    {/*    value={llmVndMoonshotWebSearch ?? _UNSPECIFIED}*/}
    {/*    onChange={(value) => {*/}
    {/*      if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndMoonshotWebSearch');*/}
    {/*      else onChangeParameter({ llmVndMoonshotWebSearch: value });*/}
    {/*    }}*/}
    {/*    options={_moonshotWebSearchOptions}*/}
    {/*  />*/}
    {/*)}*/}

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
        title='Web Search'
        tooltip={isOaiReasoningEffortMinimal ? 'Web search is not compatible with minimal reasoning effort' : 'Controls how much context is retrieved from the web (low = default for Perplexity, medium = default for OpenAI). For GPT-5 models, Default=OFF.'}
        disabled={isOaiReasoningEffortMinimal}
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
        tooltip={isOaiReasoningEffortMinimal ? 'Web search geolocation is not compatible with minimal reasoning effort' : 'When enabled, uses browser geolocation API to provide approximate location data to improve search results relevance'}
        disabled={isOaiReasoningEffortMinimal}
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

    {showParam('llmVndOaiReasoningEffort4') && (
      <FormSelectControl
        title='Reasoning Effort'
        tooltip='Controls how much effort the model spends on reasoning (4-level scale)'
        value={llmVndOaiReasoningEffort4 ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiReasoningEffort4');
          else
            onChangeParameter({ llmVndOaiReasoningEffort4: value });
        }}
        options={_reasoningEffort4Options}
      />
    )}

    {showParam('llmVndOaiVerbosity') && (
      <FormSelectControl
        title='Verbosity'
        tooltip='Controls response length and detail level'
        value={llmVndOaiVerbosity ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiVerbosity');
          else
            onChangeParameter({ llmVndOaiVerbosity: value });
        }}
        options={_verbosityOptions}
      />
    )}

    {showParam('llmVndOaiImageGeneration') && (
      <FormSelectControl
        title='Image Generation'
        tooltip='Configure image generation mode and quality'
        value={llmVndOaiImageGeneration ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiImageGeneration');
          else
            onChangeParameter({ llmVndOaiImageGeneration: value });
        }}
        options={_imageGenerationOptions}
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


    {showParam('llmVndOrtWebSearch') && (
      <FormSelectControl
        title='Web Search'
        tooltip='Enable OpenRouter web search plugin. Uses native search for OpenAI/Anthropic models, Exa for others. Adds web citations to responses.'
        value={llmVndOrtWebSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndOrtWebSearch');
          else onChangeParameter({ llmVndOrtWebSearch: value });
        }}
        options={_ortWebSearchOptions}
      />
    )}


    {showParam('llmVndXaiSearchMode') && (
      <FormSelectControl
        title='Search Mode'
        tooltip='Controls when to search'
        value={llmVndXaiSearchMode ?? 'auto'}
        onChange={value => onChangeParameter({ llmVndXaiSearchMode: value })}
        options={_xaiSearchModeOptions}
      />
    )}

    {showParam('llmVndXaiSearchSources') && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 0 }}>
        {[
          { key: 'web', label: 'Web Search', description: 'Search websites' },
          { key: 'x', label: 'X Posts', description: 'Search X posts' },
          { key: 'news', label: 'News', description: 'Search news' },
        ].map(({ key, label, description }) => {
          const currentSources = llmVndXaiSearchSources?.split(',').map(s => s.trim()).filter(Boolean) || [];
          const isEnabled = currentSources.includes(key);
          const searchIsOff = llmVndXaiSearchMode === 'off';

          return (
            <FormSwitchControl
              key={key}
              title={label}
              description={description}
              checked={isEnabled}
              disabled={searchIsOff}
              onChange={checked => {
                const newSources = currentSources.filter(s => s !== key);
                if (checked) newSources.push(key);
                const newValue = newSources.length > 0 ? newSources.join(',') : undefined;
                onChangeParameter({ llmVndXaiSearchSources: newValue || 'web,x' });
              }}
            />
          );
        })}
      </Box>
    )}

    {showParam('llmVndXaiSearchDateFilter') && (
      <FormSelectControl
        title='Search Period'
        // tooltip='Recency of search results'
        disabled={llmVndXaiSearchMode === 'off'}
        value={llmVndXaiSearchDateFilter ?? 'unfiltered'}
        onChange={(value) => {
          if (value === 'unfiltered' || !value)
            onRemoveParameter('llmVndXaiSearchDateFilter');
          else
            onChangeParameter({ llmVndXaiSearchDateFilter: value });
        }}
        options={_xaiDateFilterOptions}
      />
    )}

  </>;
}