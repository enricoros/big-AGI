import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';

import type { DModelParameterId, DModelParameterSpec, DModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { FormSelectControl, FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';

import type { OrtWebFetchEngine, OrtWebSearchEngine, OrtWebSearchMode } from '~/modules/aix/server/api/aix.wiretypes.openrouter';
import { ORT_WEB_FETCH_ENGINES, ORT_WEB_SEARCH_ENGINES, ortWebSearchModesForEngine, ortWebToolsAdvancedMerge, ortWebToolsAdvancedParse } from '~/modules/llms/vendors/openrouter/openrouter.webtools';


// 'Off' on the engine selects, 'Default' on the option selects - the same sentinel the two editors use
const _UNSPECIFIED = '_UNSPECIFIED' as const;

const _defaultOption = { value: _UNSPECIFIED, label: 'Default', description: '-' } as const;

type _ContextSize = 'low' | 'medium' | 'high';

const _contextSizeOptions: FormSelectOption<_ContextSize | typeof _UNSPECIFIED>[] = [
  _defaultOption,
  { value: 'low', label: 'Low', description: 'Less text' },
  { value: 'medium', label: 'Medium', description: 'Balanced' },
  { value: 'high', label: 'High', description: 'More text' },
];

// engines where OpenRouter ignores the context and character limits
const _hasContextAxis = (engine: OrtWebSearchEngine) => engine !== 'native' && engine !== 'firecrawl';

const _engineOption = <T extends string>(engine: { value: T, label: string, description: string }, smaller: boolean | undefined) =>
  ({ value: engine.value, label: engine.label, description: smaller ? engine.label : engine.description });

const _offOption = (smaller: boolean | undefined, forcedOn: boolean) =>
  ({ value: _UNSPECIFIED, label: 'Off', description: smaller ? '-' : 'Disabled (default)', disabled: forcedOn } as const);

const _advancedSx = { ml: 2, mt: -1, display: 'flex', flexDirection: 'column', gap: 1 } as const;
const _advancedSxSmaller = { ml: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 } as const;


/**
 * OpenRouter web search and fetch, the per-model controls. Mounted by the model dialog and by the chat side panel
 * (`smaller`: compact controls, `showAdvanced` behind the panel's extra-settings toggle). Per section: selects
 * first, then the sliders.
 *
 * The engines are the on/off values of the two enum parameters; the advanced rows edit one JSON parameter through
 * the codec in openrouter.webtools.ts. Search and fetch run on OpenRouter itself, not on the model provider.
 * The values arrive as they will be sent (the panel applies the exec overrides before mounting).
 */
export function OpenRouterWebToolsConfig(props: {
  smaller?: boolean; // chat side panel density
  searchOverride?: 'force_on' | 'force_off'; // conversation exec override: forced on keeps the controls live and only removes 'Off'; forced off locks them
  showAdvanced: boolean; // the model has the advanced parameter and the surface wants the rows
  searchSpec?: DModelParameterSpec<'llmVndOrtWebSearch'>; // undefined: no search control; enumValues restrict the engines (['auto'] on plugin-only models)
  hasFetch: boolean;
  llmVndOrtWebSearch: OrtWebSearchEngine | undefined;
  llmVndOrtWebFetch: OrtWebFetchEngine | undefined;
  llmVndOrtWebToolsAdvanced: string | undefined;
  onChangeParameter: (params: DModelParameterValues) => void;
  onRemoveParameter: (paramId: DModelParameterId) => void;
}) {

  const {
    smaller, searchOverride, showAdvanced, searchSpec, hasFetch,
    llmVndOrtWebSearch: search, llmVndOrtWebFetch: fetch, llmVndOrtWebToolsAdvanced: advancedJson,
    onChangeParameter, onRemoveParameter,
  } = props;

  // derived
  const forcedOn = searchOverride === 'force_on';
  const disabled = searchOverride === 'force_off';
  const size = smaller ? 'sm' : undefined;
  const selectSx = smaller ? { minWidth: '7rem' } : undefined;
  const advanced = React.useMemo(() => ortWebToolsAdvancedParse(advancedJson), [advancedJson]);

  const searchOptions = React.useMemo((): FormSelectOption<OrtWebSearchEngine | typeof _UNSPECIFIED>[] => {
    const allowed = searchSpec?.enumValues;
    const engines = ORT_WEB_SEARCH_ENGINES.filter(engine => !allowed || allowed.includes(engine.value));
    const lone = engines.length === 1; // plugin-only models: a plain On/Off
    return [
      ...engines.map(engine => lone ? { value: engine.value, label: 'On', description: smaller ? 'Auto' : engine.description } : _engineOption(engine, smaller)),
      _offOption(smaller, forcedOn),
    ];
  }, [forcedOn, searchSpec, smaller]);

  const fetchOptions = React.useMemo((): FormSelectOption<OrtWebFetchEngine | typeof _UNSPECIFIED>[] => [
    ...ORT_WEB_FETCH_ENGINES.map(engine => _engineOption(engine, smaller)),
    _offOption(smaller, forcedOn),
  ], [forcedOn, smaller]);

  const modeOptions = React.useMemo((): FormSelectOption<OrtWebSearchMode | typeof _UNSPECIFIED>[] => {
    const modes = ortWebSearchModesForEngine(search);
    return !modes.length ? [] : [_defaultOption, ...modes];
  }, [search]);


  // handlers

  const setAdvanced = (patch: Parameters<typeof ortWebToolsAdvancedMerge>[1]) => {
    const next = ortWebToolsAdvancedMerge(advancedJson, patch);
    if (next === undefined) onRemoveParameter('llmVndOrtWebToolsAdvanced');
    else onChangeParameter({ llmVndOrtWebToolsAdvanced: next });
  };


  return <>

    {!!searchSpec && (
      <FormSelectControl
        title={smaller ? 'Search' : 'Web Search'}
        tooltip={smaller ? undefined : 'Web search run by OpenRouter. The model decides when to search; results show as citations.'}
        disabled={disabled}
        value={search ?? _UNSPECIFIED}
        onChange={value => {
          if (value === _UNSPECIFIED) onRemoveParameter('llmVndOrtWebSearch');
          else onChangeParameter({ llmVndOrtWebSearch: value });
        }}
        options={searchOptions}
        selectSx={selectSx}
        size={size}
      />
    )}

    {showAdvanced && !!search && <Box sx={smaller ? _advancedSxSmaller : _advancedSx}>

      {!!modeOptions.length && (
        <FormSelectControl
          title={smaller ? 'Depth' : 'Search Depth'}
          tooltip={smaller ? undefined : 'Search depth of the engine. Deeper is slower.'}
          disabled={disabled}
          value={advanced?.search?.mode ?? _UNSPECIFIED}
          onChange={value => setAdvanced({ search: { mode: value === _UNSPECIFIED ? undefined : value } })}
          options={modeOptions}
          selectSx={selectSx}
          size={size}
        />
      )}

      {_hasContextAxis(search) && (
        <FormSelectControl
          title={smaller ? 'Context' : 'Search Context'}
          tooltip={smaller ? undefined : 'Text retrieved per result. The character cap below overrides it.'}
          disabled={disabled}
          value={advanced?.search?.contextSize ?? _UNSPECIFIED}
          onChange={value => setAdvanced({ search: { contextSize: value === _UNSPECIFIED ? undefined : value } })}
          options={_contextSizeOptions}
          selectSx={selectSx}
          size={size}
        />
      )}

      <_OptionalSlider
        title={smaller ? 'Results/search' : 'Max Results per Search'} ariaLabel='OpenRouter Web Search Max Results per Search'
        value={advanced?.search?.maxResults} enableValue={5}
        min={1} max={search === 'perplexity' ? 20 : 25} step={1}
        format={value => `${value} results`}
        disabled={disabled} size={size}
        onChange={value => setAdvanced({ search: { maxResults: value } })}
      />

      {_hasContextAxis(search) && (
        <_OptionalSlider
          title={smaller ? 'Chars/result' : 'Max Chars per Result'} ariaLabel='OpenRouter Web Search Max Characters per Result'
          value={advanced?.search?.maxCharacters} enableValue={15000}
          min={1000} max={100000} step={1000}
          format={value => `${Math.round(value / 1000)}K chars`}
          disabled={disabled} size={size}
          onChange={value => setAdvanced({ search: { maxCharacters: value } })}
        />
      )}

    </Box>}

    {hasFetch && (
      <FormSelectControl
        title={smaller ? 'Fetch' : 'Web Fetch'}
        tooltip={smaller ? undefined : 'Page fetching run by OpenRouter: the model reads the URLs it needs.'}
        disabled={disabled}
        value={fetch ?? _UNSPECIFIED}
        onChange={value => {
          if (value === _UNSPECIFIED) onRemoveParameter('llmVndOrtWebFetch');
          else onChangeParameter({ llmVndOrtWebFetch: value });
        }}
        options={fetchOptions}
        selectSx={selectSx}
        size={size}
      />
    )}

    {showAdvanced && !!fetch && <Box sx={smaller ? _advancedSxSmaller : _advancedSx}>

      {/* max_uses is accepted upstream but was not enforced when probed (aix.wiretypes.openrouter.ts) */}
      <_OptionalSlider
        title={smaller ? 'Fetches/request' : 'Max Fetches per Request'} ariaLabel='OpenRouter Web Fetch Max Fetches per Request'
        value={advanced?.fetch?.maxUses} enableValue={10}
        min={1} max={50} step={1}
        format={value => `${value} fetches`}
        disabled={disabled} size={size}
        onChange={value => setAdvanced({ fetch: { maxUses: value } })}
      />

      <_OptionalSlider
        title={smaller ? 'Tokens/page' : 'Max Tokens per Page'} ariaLabel='OpenRouter Web Fetch Max Tokens per Page'
        value={advanced?.fetch?.maxContentTokens} enableValue={10000}
        min={1000} max={100000} step={1000}
        format={value => `${Math.round(value / 1000)}K tokens`}
        disabled={disabled} size={size}
        onChange={value => setAdvanced({ fetch: { maxContentTokens: value } })}
      />

    </Box>}

  </>;
}


/** Slider with an enable/reset button: undefined is the engine default (mirrors the Anthropic max-uses sliders) */
function _OptionalSlider(props: {
  title: string;
  ariaLabel: string;
  value: number | undefined;
  enableValue: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  disabled?: boolean;
  size?: 'sm';
  onChange: (value: number | undefined) => void;
}) {
  const { value, enableValue, disabled, onChange } = props;
  const isSet = value !== undefined;
  return (
    <FormSliderControl
      title={props.title} ariaLabel={props.ariaLabel}
      description={isSet ? props.format(value) : '-'}
      disabled={disabled || !isSet}
      min={props.min} max={props.max} step={props.step}
      value={value ?? enableValue}
      valueLabelDisplay={isSet ? 'auto' : 'off'}
      onChange={onChange}
      size={props.size}
      sliderSx={props.size === 'sm' ? { maxWidth: '4.5rem' } : { maxWidth: 148 }}
      startAdornment={
        <Tooltip arrow disableInteractive placement='top' title={isSet ? 'Reset to default' : 'Enable limit'}>
          <IconButton
            size={props.size}
            variant={isSet ? 'plain' : 'soft'}
            disabled={disabled}
            onClick={() => onChange(isSet ? undefined : enableValue)}
            sx={{ ml: 'auto', mr: 1 }}
          >
            <ClearIcon sx={{ fontSize: 'lg' }} />
          </IconButton>
        </Tooltip>
      }
    />
  );
}
