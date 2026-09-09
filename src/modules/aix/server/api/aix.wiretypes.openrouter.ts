import * as z from 'zod/v4';


/**
 * OpenRouter web tools, wire shapes: the 'openrouter:web_search' and 'openrouter:web_fetch' server tools as they
 * cross the AIX wire, on AixWire_API.Model_schema. Protocol only - how the client stores and edits them per model
 * lives in the vendor codec (openrouter.webtools.ts), which derives its shapes from these.
 *
 * What OpenRouter does with them (probed 2026-09-06, https://openrouter.ai/docs/guides/features/server-tools):
 * - Hosted by the intermediary, not by the model provider: OpenRouter runs the search/fetch loop itself and feeds the
 *   model the results; only the 'native' engine delegates to the provider's own search. The model decides whether and
 *   how often to call.
 * - On Chat Completions we receive the final turn only: text plus url_citation annotations for search, text only for
 *   fetch, never a tool_calls entry for these; counts in usage.server_tool_use_details, engine fees in usage.cost.
 *   The Responses API does list the calls as output items (a future path to tool cards).
 * - Budgets (max_uses, max_tool_calls) were accepted but not enforced.
 * - Tool-capable endpoints only: the others 404 ('No endpoints found that support tool use') and keep the legacy
 *   'web' plugin - prompt-side, always one search, no options (`via: 'plugin'` below).
 */

const _SearchEngine_schema = z.enum(['auto', 'native', 'exa', 'parallel', 'firecrawl', 'perplexity']);
const _FetchEngine_schema = z.enum(['auto', 'native', 'exa', 'openrouter', 'firecrawl', 'parallel']);

// engine-specific depth: Exa instant..deep-reasoning, Parallel turbo..advanced ('fast' is in both); the other engines ignore it
const _SearchMode_schema = z.enum(['instant', 'fast', 'auto', 'deep-lite', 'deep', 'deep-reasoning', 'turbo', 'basic', 'advanced']);

export const OrtWebSearchTool_schema = z.object({
  engine: _SearchEngine_schema.optional(), // upstream default 'auto'
  via: z.enum(['plugin']).optional(), // the legacy 'web' plugin instead of the tool, for endpoints without tool support; every other field is ignored
  mode: _SearchMode_schema.optional(),
  maxResults: z.number().int().min(1).max(25).optional(), // per search call; Perplexity caps at 20; ignored by native
  maxUses: z.number().int().min(1).optional(), // searches per request
  maxTotalResults: z.number().int().min(1).optional(), // results across every search of the request
  contextSize: z.enum(['low', 'medium', 'high']).optional(), // per-result (Exa) or total (Parallel) character budget; ignored by native and Firecrawl
  maxCharacters: z.number().int().min(1).max(100000).optional(), // exact per-result cap, wins over contextSize; ignored by native and Firecrawl
});

export const OrtWebFetchTool_schema = z.object({
  engine: _FetchEngine_schema,
  maxUses: z.number().int().min(1).optional(), // fetches per request (hard cap of 50 on the openrouter and native engines)
  maxContentTokens: z.number().int().min(1).optional(), // approximate tokens per fetched page
});

/** Request-level budget of server-tool steps, shared by every server tool; OpenRouter defaults to and caps at 30 */
export const OrtMaxToolCalls_schema = z.number().int().min(1).max(30);

export type OrtWebSearchEngine = z.infer<typeof _SearchEngine_schema>;
export type OrtWebFetchEngine = z.infer<typeof _FetchEngine_schema>;
export type OrtWebSearchMode = z.infer<typeof _SearchMode_schema>;
export type OrtWebSearchTool = z.infer<typeof OrtWebSearchTool_schema>;
