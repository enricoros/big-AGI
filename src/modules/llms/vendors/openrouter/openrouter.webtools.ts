import * as z from 'zod/v4';

import type { AixAPI_Model } from '~/modules/aix/server/api/aix.wiretypes';
import { OrtMaxToolCalls_schema, OrtWebFetchEngine, OrtWebFetchTool_schema, OrtWebSearchEngine, OrtWebSearchMode, OrtWebSearchTool_schema } from '~/modules/aix/server/api/aix.wiretypes.openrouter';

import { DModelParameterRegistry } from '~/common/stores/llms/llms.parameters';
import { DLLM, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';
import { hasKeys, stripUndefined } from '~/common/util/objectUtils';


/**
 * OpenRouter web tools, client side: how the wire tools (aix.wiretypes.openrouter.ts) are stored per model and
 * assembled into the request.
 *
 * Per-model parameters: two engine switches (`llmVndOrtWebSearch`, `llmVndOrtWebFetch`, undefined = off) and one
 * JSON string with the remaining options (`llmVndOrtWebToolsAdvanced`). This module owns that JSON codec, the merge
 * into the wire model, and the editorial engine/mode tables the UI renders.
 */


// -- Advanced options: persisted as JSON in `llmVndOrtWebToolsAdvanced` --
// the wire tools minus their engines, which are the two on/off parameters

type _SearchOptions = z.infer<typeof _SearchOptions_schema>;
const _SearchOptions_schema = OrtWebSearchTool_schema.omit({ engine: true, via: true });

type _FetchOptions = z.infer<typeof _FetchOptions_schema>;
const _FetchOptions_schema = OrtWebFetchTool_schema.omit({ engine: true });

type _Advanced = z.infer<typeof _Advanced_schema>;
const _Advanced_schema = z.object({
  search: _SearchOptions_schema.optional(),
  fetch: _FetchOptions_schema.optional(),
  maxToolCalls: OrtMaxToolCalls_schema.optional(),
});

/** Decode the persisted JSON. Malformed or stale content reads as 'no options' - this runs in the request path, it never throws. */
export function ortWebToolsAdvancedParse(json: string | undefined): _Advanced | undefined {
  if (!json) return undefined;
  try {
    const parsed = _Advanced_schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Merge a patch into the persisted JSON, per group; an undefined value clears its key. Returns the new JSON, or undefined when empty (remove the parameter). */
export function ortWebToolsAdvancedMerge(json: string | undefined, patch: {
  search?: Partial<_SearchOptions>;
  fetch?: Partial<_FetchOptions>;
  maxToolCalls?: number | undefined;
}): string | undefined {
  const current = ortWebToolsAdvancedParse(json) ?? {};
  const next = stripUndefined({
    search: _group({ ...current.search, ...patch.search }),
    fetch: _group({ ...current.fetch, ...patch.fetch }),
    maxToolCalls: 'maxToolCalls' in patch ? patch.maxToolCalls : current.maxToolCalls,
  });
  return hasKeys(next) ? JSON.stringify(next) : undefined;
}

// a group with every key cleared is dropped, not stored empty
function _group<T extends object>(group: T): T | undefined {
  const compact = stripUndefined(group);
  return hasKeys(compact) ? compact : undefined;
}


// -- Wire model --

/**
 * The wire model fields from the per-model parameters. Endpoints without tool support (no Fn interface, which the
 * model def derives from OpenRouter's per-endpoint `supported_parameters`) get the legacy 'web' plugin instead of
 * the server tools; drop that branch when OpenRouter retires the plugin.
 */
export function ortWebToolsToAixModel(
  llmInterfaces: DLLM['interfaces'],
  search: OrtWebSearchEngine | undefined,
  fetch: OrtWebFetchEngine | undefined,
  advancedJson: string | undefined,
): Pick<AixAPI_Model, 'vndOrtWebSearch' | 'vndOrtWebFetch' | 'vndOrtMaxToolCalls'> {
  if (!search && !fetch) return {};

  if (!llmInterfaces.includes(LLM_IF_OAI_Fn))
    return search ? { vndOrtWebSearch: { via: 'plugin' } } : {};

  const advanced = ortWebToolsAdvancedParse(advancedJson);
  return {
    ...(search && { vndOrtWebSearch: { engine: search, ...advanced?.search } }),
    ...(fetch && { vndOrtWebFetch: { engine: fetch, ...advanced?.fetch } }),
    ...(advanced?.maxToolCalls !== undefined && { vndOrtMaxToolCalls: advanced.maxToolCalls }),
  };
}


// -- [EDITORIAL] engines and modes, for the UI --
// The lists come from the registry (what the user can pick); the label maps are keyed by the wire engines, so a
// registry value the wire does not accept fails to compile. `price` is OpenRouter's per-call fee on top of the
// model tokens (2026-09-06), kept for reference and not rendered: the reported cost is exact.

type _EngineInfo = { label: string, description: string, price?: string };

const _SEARCH_ENGINE_INFO = {
  auto: { label: 'Auto', description: 'Native where available, else Exa' },
  native: { label: 'Native', description: 'Provider search, else Exa', price: 'provider rate' },
  exa: { label: 'Exa', description: 'Exa search', price: '$0.007 to $0.015 by depth' },
  parallel: { label: 'Parallel', description: 'Parallel search', price: '$0.001 to $0.005 by depth' },
  perplexity: { label: 'Perplexity', description: 'Perplexity search', price: '$0.005' },
  firecrawl: { label: 'Firecrawl', description: 'BYOK, key set on OpenRouter', price: 'Firecrawl credits' },
} satisfies Record<OrtWebSearchEngine, _EngineInfo>;

const _FETCH_ENGINE_INFO = {
  auto: { label: 'Auto', description: 'Native where available, else OpenRouter' },
  native: { label: 'Native', description: 'Provider fetch, else OpenRouter', price: 'provider rate' },
  openrouter: { label: 'OpenRouter', description: 'OpenRouter fetcher', price: 'free, 50 per request' },
  exa: { label: 'Exa', description: 'Exa fetcher', price: '$0.001' },
  parallel: { label: 'Parallel', description: 'Parallel fetcher', price: '$0.001' },
  firecrawl: { label: 'Firecrawl', description: 'BYOK, key set on OpenRouter', price: 'Firecrawl credits' },
} satisfies Record<OrtWebFetchEngine, _EngineInfo>;

export const ORT_WEB_SEARCH_ENGINES = DModelParameterRegistry.llmVndOrtWebSearch.values.map(value => ({ value, ..._SEARCH_ENGINE_INFO[value] }));
export const ORT_WEB_FETCH_ENGINES = DModelParameterRegistry.llmVndOrtWebFetch.values.map(value => ({ value, ..._FETCH_ENGINE_INFO[value] }));

type _SearchModeInfo = { value: OrtWebSearchMode, label: string, description: string, price?: string };

const _SEARCH_MODES: Record<'exa' | 'parallel', _SearchModeInfo[]> = {
  exa: [
    { value: 'instant', label: 'Instant', description: 'Fastest', price: '$0.007' },
    { value: 'fast', label: 'Fast', description: 'Fast', price: '$0.007' },
    { value: 'auto', label: 'Auto', description: 'Exa picks', price: '$0.007' },
    { value: 'deep-lite', label: 'Deep Lite', description: 'Deeper', price: '$0.012' },
    { value: 'deep', label: 'Deep', description: 'Deep', price: '$0.012' },
    { value: 'deep-reasoning', label: 'Deep Reasoning', description: 'Deepest, slow', price: '$0.015' },
  ],
  parallel: [
    { value: 'turbo', label: 'Turbo', description: 'Fastest', price: '$0.001' },
    { value: 'fast', label: 'Fast', description: 'Fast', price: '$0.001' },
    { value: 'basic', label: 'Basic', description: 'Standard', price: '$0.005' },
    { value: 'advanced', label: 'Advanced', description: 'Deepest', price: '$0.005' },
  ],
};

/** Modes for the engine that will run the search: Exa also covers 'auto' (its fallback); the other engines have no depth axis */
export function ortWebSearchModesForEngine(engine: OrtWebSearchEngine | undefined): _SearchModeInfo[] {
  return engine === 'parallel' ? _SEARCH_MODES.parallel : (engine === 'exa' || engine === 'auto') ? _SEARCH_MODES.exa : [];
}
