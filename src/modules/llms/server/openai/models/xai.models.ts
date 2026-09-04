import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { DModelParameterId } from '~/common/stores/llms/llms.parameters';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';
import { OPENAI_API_PATHS, openAIAccess, OpenAIAccessSchema } from '../openai.access';
import type { KnownLink, KnownModel } from '../../models.mappings';
import { fromManualMapping, llmsDefineModels, llmDevCheckModels_DEV } from '../../models.mappings';

// --- xAI Model ID inference (auto-derived from _knownXAIChatModels) ---
export type LlmsXAIModelId = typeof _knownXAIChatModels[number]['idPrefix'];


// configuration
const DEV_DEBUG_XAI_MODELS = (Release.TenantSlug as any) === 'staging' /* ALSO IN STAGING! */ || Release.IsNodeDevBuild;


// Known xAI Models - Manual Mappings
// List on: https://docs.x.ai/docs/models?cluster=us-east-1
// Verified: 2026-06-16 via live /v1/language-models (post-2026-05-15 retirement: grok-4-1-fast, grok-4-fast, grok-4-0709, grok-3, grok-3-mini, grok-2-vision-1212 redirect to grok-4.3; grok-code-fast-1 now aliases grok-build-0.1)
// Re-confirmed: 2026-06-26 via docs.x.ai (no API key this run): same 5 chat models, same pricing/context windows
// Verified: 2026-07-08 via live /v1/language-models + live probes: +grok-4.5 (released today); API now reports >200K long-context price tiers for ALL models (carried below as tiered pricing)
// Verified: 2026-08-04 via live /v1/language-models + docs.x.ai + effort probes: same 6 chat models, contexts unchanged; fixed grok-4.5 cached-input price (0.30/0.60, was 0.50/1.00)
// Verified: 2026-08-06 via live /v1/language-models + /v1/models + docs.x.ai + effort/tool probes: same 6 chat models, prices/contexts unchanged; grok-4.5 'xhigh' still accepted (docs table only lists low/medium/high)
// Verified: 2026-08-13 via live ablation (effort/tools/modality/catalog probes) + docs.x.ai + x.ai/news/grok-4-6: +grok-4.6 (announced 2026-08-12, catalog created 08-06); effort domain same as 4.5 (low/medium/high/xhigh, 'none' 400s, 'minimal' silently normalizes to low on both); cache read $0.50/$1.00 vs 4.5's $0.30/$0.60 (verified via usage.cost_in_usd_ticks reconstruction); no aliases minted, grok-latest still 4.3, grok-build-latest still 4.5; nothing retired
// Verified: 2026-08-17 via live /v1/language-models + /v1/models + docs.x.ai/developers/models + release-notes + effort probes: same 7 chat models, prices/contexts unchanged, nothing retired; grok-latest now routes to grok-4.6 (was 4.3), grok-build-latest still 4.5; grok-4.6-latest and grok-5 both 404; effort domains re-confirmed (4.6/4.5 reject 'none', 4.3 accepts it); CBA ELO refresh
// Verified: 2026-08-31 via live /v1/language-models + /v1/models + docs.x.ai/developers/models: same 7 chat models, prices/contexts/aliases unchanged, nothing retired, no new models announced

// Server-side tools (web search, X search): $5 / 1K calls, on top of tokens
const XAI_PRICE_TOOLS: NonNullable<ModelDescriptionSchema['chatPrice']>['tools'] = { webSearch: 5 };

// Pricing for Grok 4.3 / 4.20 flagship family (unified $1.25/$2.50 since May 2026; >200K tier per live API 2026-07-08)
const PRICE_FLAGSHIP = {
  input: [{ upTo: 200000, price: 1.25 }, { upTo: null, price: 2.50 }],
  output: [{ upTo: 200000, price: 2.50 }, { upTo: null, price: 5.00 }],
  cache: { read: [{ upTo: 200000, price: 0.20 }, { upTo: null, price: 0.40 }] },
  tools: XAI_PRICE_TOOLS,
};

// Interfaces: ALL XAI MODELS use the OpenAI Responses API (XAI dialect)
// we don't add LLM_IF_OAI_Responses explicitly here, as the code fully treats XAI/XAI Models with responses

const XAI_IF: ModelDescriptionSchema['interfaces'] = [
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn,
] as const;

const XAI_IF_Vision: ModelDescriptionSchema['interfaces'] = [
  ...XAI_IF, LLM_IF_OAI_Vision,
] as const;


// Parameter specs for xAI models

const XAI_PAR: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndXaiCodeExecution' },
  { paramId: 'llmVndXaiSearchInterval' },
  { paramId: 'llmVndXaiWebSearch' },
  { paramId: 'llmVndXaiXSearch' },
  // { paramId: 'llmVndXaiXSearchHandles' }, // too early
] as const;

// Reasoning variants have no configuration for it - only grok-3-mini had it, as of 2026-01-22:
// - https://docs.x.ai/docs/guides/reasoning
// hence it's the same parameters
const XAI_PAR_Reasoning = XAI_PAR;


// pubDate is REQUIRED on every real model entry; symlinks inherit it.
type _XaiModelDef = (KnownModel & { pubDate: string }) | KnownLink;

const _knownXAIChatModels = llmsDefineModels<_XaiModelDef>()([

  // Grok 4.6 (flagship, August 2026) - post-training refresh extending 4.5 (same base, context, $2/$6 price); always-on reasoning, effort low/medium/high/xhigh (default high)
  // grok-latest routes here as of 2026-08-17 (probe; the API alias array still reports none), grok-build-latest still 4.5; spends 3-20x the reasoning tokens of 4.5 at matched effort, so real per-turn cost runs higher
  {
    idPrefix: 'grok-4.6',
    label: 'Grok 4.6',
    pubDate: '20260812',
    description: 'xAI\'s frontier model for coding, agentic tasks, and knowledge work, extending Grok 4.5 with longer supplemental training and agentic RL (co-developed with Cursor). 500K token context window, text and image inputs, always-on reasoning with effort control (low/medium/high/xhigh, default high). Knowledge cutoff: February 2026. Alias: grok-latest.',
    contextWindow: 500000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }, // no 'none': always-on reasoning, API 400s like grok-4.5 (2026-08-13 probe)
      ...XAI_PAR_Reasoning, // web_search + x_search + code_execution + fn + strict json_schema all live-verified 2026-08-13
    ],
    chatPrice: {
      input: [{ upTo: 200000, price: 2.00 }, { upTo: null, price: 4.00 }],
      output: [{ upTo: 200000, price: 6.00 }, { upTo: null, price: 12.00 }],
      cache: { read: [{ upTo: 200000, price: 0.50 }, { upTo: null, price: 1.00 }] }, // higher than grok-4.5's 0.30/0.60 - tick-verified 2026-08-13
      tools: XAI_PRICE_TOOLS,
    },
    benchmark: { cbaElo: 1464 }, // grok-4.6-high (CBA name)
  },

  // Grok 4.5 (flagship, July 2026) - premium tier over 4.3; reasoning always-on: effort low/medium/high/xhigh, 'none' rejected by API (2026-07-08 probe)
  {
    idPrefix: 'grok-4.5',
    label: 'Grok 4.5',
    pubDate: '20260708',
    description: 'xAI\'s July 2026 flagship with frontier performance on coding, knowledge work, and STEM - superseded by Grok 4.6 as xAI\'s recommended model. 500K token context window, text and image inputs, always-on reasoning with effort control (low/medium/high/xhigh). Knowledge cutoff: February 2026. Aliases: grok-4.5-latest, grok-build-latest.',
    contextWindow: 500000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }, // no 'none': reasoning cannot be disabled (API 400s, unlike grok-4.3)
      ...XAI_PAR_Reasoning, // web_search + code_execution live-verified 2026-07-08
    ],
    chatPrice: {
      input: [{ upTo: 200000, price: 2.00 }, { upTo: null, price: 4.00 }],
      output: [{ upTo: 200000, price: 6.00 }, { upTo: null, price: 12.00 }],
      cache: { read: [{ upTo: 200000, price: 0.30 }, { upTo: null, price: 0.60 }] },
      tools: XAI_PRICE_TOOLS,
    },
    benchmark: { cbaElo: 1469 }, // grok-4.5
  },

  // Grok 4.3 (flagship, April 2026) - reasoning_effort: none/low(default)/medium/high/xhigh
  {
    idPrefix: 'grok-4.3',
    label: 'Grok 4.3',
    pubDate: '20260417',
    description: 'xAI\'s latest flagship model with reasoning and a 1M token context window. Supports text and image inputs, with reasoning_effort control (none/low/medium/high/xhigh). Knowledge cutoff: December 2025.',
    contextWindow: 1000000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'] }, // vendor default 'low'; 'none' disables reasoning; 'xhigh' per 2026-06 sweep
      ...XAI_PAR_Reasoning,
    ],
    chatPrice: PRICE_FLAGSHIP,
    benchmark: { cbaElo: 1442 }, // grok-4.3
  },

  // Grok 4.20 (flagship, March 2026) - superseded by 4.3 but still active with unified pricing
  {
    idPrefix: 'grok-4.20-0309-reasoning',
    label: 'Grok 4.20 Reasoning',
    pubDate: '20260309',
    description: 'xAI flagship reasoning model with a 1M token context window. Deep reasoning and problem-solving with text and image inputs.',
    contextWindow: 1000000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Reasoning,
    chatPrice: PRICE_FLAGSHIP,
    benchmark: { cbaElo: 1472 }, // grok-4.20-beta-0309-reasoning (CBA name)
  },
  {
    idPrefix: 'grok-4.20-0309-non-reasoning',
    label: 'Grok 4.20',
    pubDate: '20260309',
    description: 'xAI flagship model with a 1M token context window. Non-reasoning variant for fast, high-quality responses with text and image inputs.',
    contextWindow: 1000000,
    maxCompletionTokens: undefined,
    interfaces: XAI_IF_Vision,
    parameterSpecs: XAI_PAR,
    chatPrice: PRICE_FLAGSHIP,
    benchmark: { cbaElo: 1475 }, // grok-4.20-beta1 (CBA name)
  },
  {
    idPrefix: 'grok-4.20-multi-agent-0309',
    label: 'Grok 4.20 Multi-Agent',
    pubDate: '20260309',
    description: 'Multi-agent model that runs specialized agents in parallel for collaborative verification with reduced hallucination. Reasoning effort selects 4 vs 16 agents.',
    contextWindow: 1000000,
    maxCompletionTokens: undefined,
    // no LLM_IF_OAI_Fn: client-side tools on multi-agent are beta-gated (2026-08-06 probe: 400 'require beta access')
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'xhigh'] }, // 'none' disables reasoning (per 2026-06 sweep); low/medium = 4 agents, high/xhigh = 16 agents
      ...XAI_PAR_Reasoning,
    ],
    chatPrice: PRICE_FLAGSHIP,
    benchmark: { cbaElo: 1470 }, // grok-4.20-multi-agent-beta-0309
  },

  // Retired (slugs still resolve, redirect to grok-4.3 at $1.25/$2.50 pricing):
  // - grok-4-1-fast-reasoning / grok-4-1-fast-non-reasoning
  // - grok-4-fast-reasoning / grok-4-fast-non-reasoning
  // - grok-4-0709
  // - grok-3 / grok-3-mini (all grok-3-* are now aliases of grok-4.3)
  // - grok-2-vision-1212 (gone from API entirely as of 2026-06-16)
  // Removed from manual mappings; will fall through to unknownModelFallback if listed by API.
  // Note: grok-code-fast-1 / grok-code-fast / grok-code-fast-1-0825 now alias grok-build-0.1 (see below).

  // Grok Build 0.1 (May 2026) - fast coding model, replaces grok-code-fast-1 family
  {
    idPrefix: 'grok-build-0.1',
    label: 'Grok Build 0.1',
    pubDate: '20260520',
    description: 'xAI fast coding model with reasoning, function calling, and structured outputs. Text and image inputs, 256K context. Aliases: grok-code-fast-1, grok-code-fast, grok-code-fast-1-0825.',
    contextWindow: 256000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Reasoning, // sweep (2026-06) confirms web search; rolled into the standard Grok-4 server-side toolset
    chatPrice: {
      input: [{ upTo: 200000, price: 1.00 }, { upTo: null, price: 2.00 }],
      output: [{ upTo: 200000, price: 2.00 }, { upTo: null, price: 4.00 }],
      cache: { read: [{ upTo: 200000, price: 0.20 }, { upTo: null, price: 0.40 }] },
      tools: XAI_PRICE_TOOLS,
    },
  },

  // Retired: grok-3-mini (now alias of grok-4.3), grok-2-vision-1212 (gone from API)

]);


// -- xAI Model Descriptions --

function xaiValidateModelDefs_DEV(availableModels: z.infer<typeof wireXAIModelsListSchema>['models']): void {
  if (DEV_DEBUG_XAI_MODELS) {
    llmDevCheckModels_DEV('xAI', availableModels.map(m => m.id), _knownXAIChatModels.map(m => m.idPrefix));
  }
}

export async function xaiFetchModelDescriptions(access: OpenAIAccessSchema): Promise<ModelDescriptionSchema[]> {

  // List models
  const { headers, url } = openAIAccess(access, null, OPENAI_API_PATHS.xaiLanguageModels);
  const modelsResponse = await fetchJsonOrTRPCThrow({ url, headers, name: 'xAI' });

  const xaiModels = wireXAIModelsListSchema.parse(modelsResponse);

  // DEV: validate model definitions
  xaiValidateModelDefs_DEV(xaiModels.models);

  return xaiModels.models.reduce((acc, xm) => {

    // Fallback for unknown models
    const unknownModelFallback: KnownModel = {
      idPrefix: xm.id,
      // no '[?]' marker (evaluated 2026-08-14): API-characterized (language-models endpoint + modalities) - see llmsLabelUncurated
      label: _xaiFormatNewModelLabel(xm.id),
      description: `New xAI arrival '${xm.id}', not yet curated - context window unverified.`,
      contextWindow: null, // API omits context; null, never a guess
      interfaces: [
        ...XAI_IF,
        ...(xm.input_modalities?.includes('image') ? [LLM_IF_OAI_Vision] : []),
      ],
      parameterSpecs: XAI_PAR,
      ...(xm.prompt_text_token_price != null && xm.completion_text_token_price != null && {
        chatPrice: {
          input: xm.prompt_text_token_price / 10000, // Scaling factor applied as per API data
          output: xm.completion_text_token_price / 10000,
        },
      }),
    };

    // xAI model description
    const modelDescription = fromManualMapping(_knownXAIChatModels, xm.id, xm.created, undefined, unknownModelFallback);

    // quick validation for non-text modalities
    const knownInputModalities = ['text', 'image'];
    const knownOutputModalities = ['text'];
    const nonTextInput = xm.input_modalities?.filter(m => !knownInputModalities.includes(m)) || [];
    const nonTextOutput = xm.output_modalities?.filter(m => !knownOutputModalities.includes(m)) || [];
    if (nonTextInput.length > 0 || nonTextOutput.length > 0) {
      console.warn(`[xAI Model Check] Model '${xm.id}' has non-text modalities. Input: [${nonTextInput.join(', ')}], Output: [${nonTextOutput.join(', ')}]`);
      modelDescription.label += ' 🧩';
      let modalityDetails = '';
      if (nonTextInput.length > 0) modalityDetails += ` Input: ${nonTextInput.join(', ')}.`;
      if (nonTextOutput.length > 0) modalityDetails += ` Output: ${nonTextOutput.join(', ')}.`;
      modelDescription.description += ` Supports additional modalities.${modalityDetails}`;
    }

    acc.push(modelDescription);

    // NOTE: disabled, as this is not useful
    // if there are aliases, add them as 'symlinked' models
    // if (xm.aliases?.length) {
    //   xm.aliases.forEach((alias) => {
    //     const aliasedModel = fromManualMapping([{
    //       idPrefix: alias,
    //       label: alias,
    //       symLink: xm.id,
    //       description: `xAI model ${alias}`,
    //       contextWindow: 16384,
    //       interfaces: unknownModelFallback.interfaces,
    //     }], alias, xm.created, xm.updated, unknownModelFallback);
    //     acc.push(aliasedModel);
    //   });
    // }

    return acc;
  }, [] as ModelDescriptionSchema[]);
}

// manual sort order - your desired order
const _xaiIdStartsWithOrder = [
  'grok-4.6',
  'grok-4.5',
  'grok-4.3',
  'grok-4.20-0309-reasoning',
  'grok-4.20-0309-non-reasoning',
  'grok-4.20-multi-agent-0309',
  'grok-build-0.1',
];

export function xaiModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // First try exact matches with the order array
  const aExact = _xaiIdStartsWithOrder.indexOf(a.id);
  const bExact = _xaiIdStartsWithOrder.indexOf(b.id);

  // If both have exact matches, use those positions
  if (aExact !== -1 && bExact !== -1)
    return aExact - bExact;

  // If only one has exact match, prioritize it
  if (aExact !== -1) return -1;
  if (bExact !== -1) return 1;

  // Fall back to prefix matching for unknown models
  const aStartsWith = _xaiIdStartsWithOrder.findIndex((prefix) => a.id.startsWith(prefix));
  const bStartsWith = _xaiIdStartsWithOrder.findIndex((prefix) => b.id.startsWith(prefix));

  if (aStartsWith !== bStartsWith)
    return aStartsWith - bStartsWith;

  return b.label.localeCompare(a.label);
}

function _xaiFormatNewModelLabel(modelId: string): string {
  if (!modelId) return 'Unknown Model';

  const parts = modelId.split('-');
  if (parts.length)
    parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

  let hasBeta = false;
  const cleanedParts = parts.filter(part => {
    if (part.toLowerCase() === 'beta') {
      hasBeta = true;
      return false;
    }
    return true;
  });

  return '[new] ' + cleanedParts.join(' ') + (hasBeta ? ' (beta)' : '');
}


// --- OpenRouter inheritance ---

const _ORT_XAI_IF_ALLOWLIST: ReadonlySet<string> = new Set([
  LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning,
] as const);

// only the effort spec travels: xAI's server-side tools are native-only, OR does not tunnel them
const _ORT_XAI_PARAM_ALLOWLIST: ReadonlySet<string> = new Set([
  'llmVndOaiEffort',
] as const satisfies DModelParameterId[]);

/**
 * Lookup for OpenRouter: match an OR xAI model ID to a known hardcoded xAI model.
 * OR's `reasoning.supported_efforts` omits 'xhigh' for grok-4.3/4.5, both verified working 2026-07-31 - so our swept
 * definitions own the effort list, and OR's `reasoning.mandatory` is used only to subtract 'none'.
 * @param orModelName - The model name after stripping 'x-ai/' (e.g. 'grok-4.5')
 */
export function llmOrtXaiLookup(orModelName: string): OrtVendorLookupResult | undefined {

  // OR collapses the dated native ids. Unmapped: 'grok-4.20' (native splits reasoning/non-reasoning, OR's single id is
  // a binary toggle - verified), 'grok-build-0.1' (native has no effort spec).
  const ortXaiRefMap: Record<string, string> = {
    'grok-4.20-multi-agent': 'grok-4.20-multi-agent-0309',
  };
  const entry = _knownXAIChatModels.find(m => m.idPrefix === (ortXaiRefMap[orModelName] ?? orModelName));
  if (!entry?.interfaces) return undefined;

  const interfaces = entry.interfaces.filter(i => _ORT_XAI_IF_ALLOWLIST.has(i));

  const parameterSpecs = entry.parameterSpecs
    ?.filter(spec => _ORT_XAI_PARAM_ALLOWLIST.has(spec.paramId))
    .map(spec => ({ ...spec }));

  return { pubDate: entry.pubDate, interfaces, parameterSpecs };
}


export const wireXAIModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  owned_by: z.literal('xai').or(z.string()),

  // timestamps
  created: z.number().optional(),
  updated: z.number().optional(),
  version: z.string().optional(),

  // modalities
  input_modalities: z.array(z.string()),    // 'text', 'image', etc.
  output_modalities: z.array(z.string()),   // 'text', 'image', etc.

  // pricing (raw units: divide by 10,000 for $/M tokens)
  prompt_text_token_price: z.number().optional(),
  prompt_image_token_price: z.number().optional(),
  completion_text_token_price: z.number().optional(),
  cached_prompt_text_token_price: z.number().optional(),
  search_price: z.number().optional(),
  // long-context pricing (above long_context_threshold tokens)
  prompt_text_token_price_long_context: z.number().optional(),
  cached_prompt_text_token_price_long_context: z.number().optional(),
  completion_text_token_price_long_context: z.number().optional(),
  long_context_threshold: z.number().optional(),
  // image generation pricing (non-chat models)
  image_price: z.number().optional(),

  // System information
  fingerprint: z.string().optional(),

  // Aliases for models
  aliases: z.array(z.string()).optional(),
});

export const wireXAIModelsListSchema = z.object({
  models: z.array(wireXAIModelSchema),
});
