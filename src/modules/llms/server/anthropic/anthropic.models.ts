import * as z from 'zod/v4';

import type { DModelParameterId } from '~/common/stores/llms/llms.parameters';
import { LLM_IF_ANT_PromptCaching, LLM_IF_ANT_ToolsSearch, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../llm.server.types';
import { createVariantInjector, ModelVariantMap } from '../llm.server.variants';
import { llmDevCheckModels_DEV } from '../models.mappings';


// configuration
const DEV_DEBUG_ANTHROPIC_MODELS = (Release.TenantSlug as any) === 'staging' /* ALSO IN STAGING! */ || Release.IsNodeDevBuild;


const IF_4 = [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching];
const IF_4_R = [...IF_4, LLM_IF_OAI_Reasoning];


// Anthropic Parameters Semantics:
// - llmVndAnt1MContext         only available on select models
// - llmVndAntEffort            since 4.5: low/medium/high (3 levels). Since Opus 4.6: +max (4 levels, 'max' is Opus 4.6-exclusive). Sonnet 4.6 supports low/medium/high only.
// - llmVndAntSkills            2026-02-06: seems GA to any model now: a parameter spec for user/UI configurability
// - llmVndAntThinkingBudget    2026-02-06: deprecated since 4.6 in favor of adaptive thinking, was used for manual control of thinking up to 4.5, we pre-default it to 16384 and the user can set it to another value or null to turn thinking off
// - llmVndAntWebFetch/Search   seem an API feature available on all models

const ANT_TOOLS: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndAntWebSearch' },
  { paramId: 'llmVndAntWebFetch' },
  { paramId: 'llmVndAntSkills' },
] as const;


const _hardcodedAnthropicThinkingVariants: ModelVariantMap & { [id: string]: { idVariant: 'thinking' /* this is here because of OpenRouter matching, see below - all these are assued as thinking variants */ } } = {

  // NOTE: what's not redefined below is inherited from the underlying model definition

  // Claude 4.6 models with thinking variants
  'claude-opus-4-6': {
    idVariant: 'thinking',
    label: 'Claude Opus 4.6 (Adaptive)',
    description: 'Claude Opus 4.6 with adaptive thinking mode for the most complex reasoning and agentic workflows',
    interfaces: [...IF_4_R, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget', hidden: true, initialValue: -1 /* adaptive */ }, { paramId: 'llmVndAntEffortMax' }, { paramId: 'llmVndAnt1MContext' }, { paramId: 'llmVndAntInfSpeed' }],
    // benchmark: { cbaElo: ... }, // TBD
  },

  'claude-sonnet-4-6': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 4.6 (Adaptive)',
    description: 'Claude Sonnet 4.6 with adaptive thinking mode for balanced speed and intelligence',
    interfaces: [...IF_4_R, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget', hidden: true, initialValue: -1 /* adaptive */ }, { paramId: 'llmVndAntEffort' }, { paramId: 'llmVndAnt1MContext' }],
    // benchmark: { cbaElo: ... }, // TBD
  },

  // Claude 4.5 models with thinking variants
  'claude-opus-4-5-20251101': {
    idVariant: 'thinking',
    label: 'Claude Opus 4.5 (Thinking)',
    description: 'Claude Opus 4.5 with extended thinking mode for complex reasoning and agentic workflows',
    interfaces: [...IF_4_R, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }, { paramId: 'llmVndAntEffort' }],
    benchmark: { cbaElo: 1468 }, // claude-opus-4-5-20251101-thinking-32k
    maxCompletionTokens: 32000,
  },

  'claude-sonnet-4-5-20250929': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 4.5 (Thinking)',
    description: 'Claude Sonnet 4.5 with extended thinking mode enabled for complex reasoning',
    maxCompletionTokens: 64000,
    interfaces: [...IF_4_R, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }, { paramId: 'llmVndAnt1MContext' }],
    benchmark: { cbaElo: 1450 }, // claude-sonnet-4-5-20250929-thinking-32k
  },

  'claude-haiku-4-5-20251001': {
    idVariant: 'thinking',
    label: 'Claude Haiku 4.5 (Thinking)',
    description: 'Claude Haiku 4.5 with extended thinking mode - first Haiku model with reasoning capabilities',
    maxCompletionTokens: 64000,
    interfaces: IF_4_R,
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }],
  },

  // Claude 4.1 models with thinking variants
  'claude-opus-4-1-20250805': {
    idVariant: 'thinking',
    label: 'Claude Opus 4.1 (Thinking)',
    description: 'Claude Opus 4.1 with extended thinking mode enabled for complex reasoning',
    maxCompletionTokens: 32000,
    interfaces: IF_4_R,
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }],
    benchmark: { cbaElo: 1448 }, // claude-opus-4-1-20250805-thinking-16k
  },

  // Claude 4 models with thinking variants
  'claude-opus-4-20250514': {
    idVariant: 'thinking',
    hidden: true, // superseded by 4.1
    label: 'Claude Opus 4 (Thinking)',
    description: 'Claude Opus 4 with extended thinking mode enabled for complex reasoning',
    maxCompletionTokens: 32000,
    interfaces: IF_4_R,
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }],
    benchmark: { cbaElo: 1424 }, // claude-opus-4-20250514-thinking-16k
  },

  'claude-sonnet-4-20250514': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 4 (Thinking)',
    description: 'Claude Sonnet 4 with extended thinking mode enabled for complex reasoning',
    maxCompletionTokens: 64000,
    interfaces: IF_4_R,
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }, { paramId: 'llmVndAnt1MContext' }],
    benchmark: { cbaElo: 1400 }, // claude-sonnet-4-20250514-thinking-32k
  },

  // Changes to the thinking variant (same model ID) for the Claude Sonnet 3.7 model
  'claude-3-7-sonnet-20250219': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 3.7 (Thinking)',
    description: 'Claude 3.7 with extended thinking mode enabled for complex reasoning',
    maxCompletionTokens: 64000,
    interfaces: IF_4_R,
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntThinkingBudget' }],
    benchmark: { cbaElo: 1389 }, // claude-3-7-sonnet-20250219-thinking-32k
  },

} as const;

export function anthropicInjectVariants(acc: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  return createVariantInjector(_hardcodedAnthropicThinkingVariants, 'before')(acc, model);
}


export const hardcodedAnthropicModels: (ModelDescriptionSchema & { isLegacy?: boolean })[] = [

  // Claude 4.6 models
  {
    id: 'claude-opus-4-6', // Active
    label: 'Claude Opus 4.6', // 🌟
    description: 'Most intelligent model for building agents and coding, with adaptive thinking',
    contextWindow: 200000,
    maxCompletionTokens: 128000,
    interfaces: [...IF_4, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntEffortMax' }, { paramId: 'llmVndAnt1MContext' }, { paramId: 'llmVndAntInfSpeed' }],
    // Note: Tiered pricing - ≤200K: $5/$25, >200K: $10/$37.50 (with 1M context enabled)
    // Cache pricing also tiered: write 1.25× input, read 0.10× input
    chatPrice: {
      input: [{ upTo: 200000, price: 5 }, { upTo: null, price: 10 }],
      output: [{ upTo: 200000, price: 25 }, { upTo: null, price: 37.50 }],
      cache: {
        cType: 'ant-bp',
        read: [{ upTo: 200000, price: 0.50 }, { upTo: null, price: 1.00 }],
        write: [{ upTo: 200000, price: 6.25 }, { upTo: null, price: 12.50 }],
        duration: 300,
      },
    },
    // benchmark: { cbaElo: ... }, // TBD
  },
  {
    id: 'claude-sonnet-4-6', // Active
    label: 'Claude Sonnet 4.6', // 🌟
    description: 'Best combination of speed and intelligence for everyday tasks',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    interfaces: [...IF_4, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntEffort' }, { paramId: 'llmVndAnt1MContext' }],
    // Note: Tiered pricing - ≤200K: $3/$15, >200K: $6/$22.50 (with 1M context enabled)
    // Cache pricing also tiered: write 1.25× input, read 0.10× input
    chatPrice: {
      input: [{ upTo: 200000, price: 3 }, { upTo: null, price: 6 }],
      output: [{ upTo: 200000, price: 15 }, { upTo: null, price: 22.50 }],
      cache: {
        cType: 'ant-bp',
        read: [{ upTo: 200000, price: 0.30 }, { upTo: null, price: 0.60 }],
        write: [{ upTo: 200000, price: 3.75 }, { upTo: null, price: 7.50 }],
        duration: 300,
      },
    },
    // benchmark: { cbaElo: ... }, // TBD
  },

  // Claude 4.5 models
  {
    id: 'claude-opus-4-5-20251101', // Active
    label: 'Claude Opus 4.5',
    description: 'Previous most intelligent model with advanced reasoning for complex agentic workflows',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    interfaces: [...IF_4, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAntEffort' }],
    chatPrice: { input: 5, output: 25, cache: { cType: 'ant-bp', read: 0.50, write: 6.25, duration: 300 } },
    benchmark: { cbaElo: 1466 }, // claude-opus-4-5-20251101
  },
  {
    id: 'claude-sonnet-4-5-20250929', // Active
    label: 'Claude Sonnet 4.5',
    description: 'Previous best combination of speed and intelligence for complex agents and coding',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    interfaces: [...IF_4, LLM_IF_ANT_ToolsSearch],
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAnt1MContext' }],
    // Note: Tiered pricing - ≤200K: $3/$15, >200K: $6/$22.50 (with 1M context enabled)
    // Cache pricing also tiered: write 1.25× input, read 0.10× input
    chatPrice: {
      input: [{ upTo: 200000, price: 3 }, { upTo: null, price: 6 }],
      output: [{ upTo: 200000, price: 15 }, { upTo: null, price: 22.50 }],
      cache: {
        cType: 'ant-bp',
        read: [{ upTo: 200000, price: 0.30 }, { upTo: null, price: 0.60 }],
        write: [{ upTo: 200000, price: 3.75 }, { upTo: null, price: 7.50 }],
        duration: 300,
      },
    },
    benchmark: { cbaElo: 1450 }, // claude-sonnet-4-5-20250929
  },
  {
    id: 'claude-haiku-4-5-20251001', // Active
    label: 'Claude Haiku 4.5', // 🌟
    description: 'Fastest model with exceptional speed and performance',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    interfaces: IF_4,
    parameterSpecs: ANT_TOOLS,
    chatPrice: { input: 1, output: 5, cache: { cType: 'ant-bp', read: 0.10, write: 1.25, duration: 300 } },
    benchmark: { cbaElo: 1403 }, // claude-haiku-4-5-20251001
  },

  // Claude 4.1 models
  {
    id: 'claude-opus-4-1-20250805', // Active
    label: 'Claude Opus 4.1',
    description: 'Exceptional model for specialized complex tasks requiring advanced reasoning',
    contextWindow: 200000,
    maxCompletionTokens: 32000,
    interfaces: IF_4,
    parameterSpecs: ANT_TOOLS,
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1445 }, // claude-opus-4-1-20250805
  },

  // Claude 4 models
  {
    hidden: true, // superseded by 4.1
    id: 'claude-opus-4-20250514', // Active
    label: 'Claude Opus 4',
    description: 'Previous flagship model',
    contextWindow: 200000,
    maxCompletionTokens: 32000,
    interfaces: IF_4,
    parameterSpecs: ANT_TOOLS,
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1414 }, // claude-opus-4-20250514
  },
  {
    id: 'claude-sonnet-4-20250514', // Active
    label: 'Claude Sonnet 4',
    description: 'High-performance model',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    interfaces: IF_4,
    parameterSpecs: [...ANT_TOOLS, { paramId: 'llmVndAnt1MContext' }],
    // Note: Tiered pricing - ≤200K: $3/$15, >200K: $6/$22.50 (with 1M context enabled)
    // Cache pricing also tiered: write 1.25× input, read 0.10× input
    chatPrice: {
      input: [{ upTo: 200000, price: 3 }, { upTo: null, price: 6 }],
      output: [{ upTo: 200000, price: 15 }, { upTo: null, price: 22.50 }],
      cache: {
        cType: 'ant-bp',
        read: [{ upTo: 200000, price: 0.30 }, { upTo: null, price: 0.60 }],
        write: [{ upTo: 200000, price: 3.75 }, { upTo: null, price: 7.50 }],
        duration: 300,
      },
    },
    benchmark: { cbaElo: 1390 }, // claude-sonnet-4-20250514
  },

  // Claude 3.7 models
  {
    id: 'claude-3-7-sonnet-20250219', // Deprecated | Deprecated: October 28, 2025 | Retiring: February 19, 2026 | Replacement: claude-opus-4-6
    label: 'Claude Sonnet 3.7 [Deprecated]',
    description: 'High-performance model with early extended thinking. Deprecated October 28, 2025, retiring February 19, 2026.',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    interfaces: IF_4,
    parameterSpecs: ANT_TOOLS,
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1372 }, // claude-3-7-sonnet-20250219
    hidden: true, // deprecated
    isLegacy: true,
  },

  // Claude 3.5 models
  // retired: 'claude-3-5-sonnet-20241022'
  // retired: 'claude-3-5-sonnet-20240620'
  {
    id: 'claude-3-5-haiku-20241022', // Deprecated | Deprecated: December 19, 2025 | Retiring: February 19, 2026
    label: 'Claude Haiku 3.5 [Deprecated]',
    description: 'Intelligence at blazing speeds. Deprecated December 19, 2025, retiring February 19, 2026.',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    interfaces: IF_4,
    parameterSpecs: ANT_TOOLS,
    chatPrice: { input: 0.80, output: 4.00, cache: { cType: 'ant-bp', read: 0.08, write: 1.00, duration: 300 } },
    benchmark: { cbaElo: 1324 }, // claude-3-5-haiku-20241022
    hidden: true, // deprecated
    isLegacy: true,
  },

  // Claude 3 models
  // retired: 'claude-3-opus-20240229' - Retired January 5, 2026
  {
    hidden: true, // yield to successors
    id: 'claude-3-haiku-20240307', // Active
    label: 'Claude Haiku 3',
    description: 'Fast and compact model for near-instant responsiveness',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    interfaces: IF_4,
    chatPrice: { input: 0.25, output: 1.25, cache: { cType: 'ant-bp', read: 0.03, write: 0.30, duration: 300 } },
    benchmark: { cbaElo: 1262 }, // claude-3-haiku-20240307
  },

  // Legacy/Retired models
  // retired: 'claude-3-sonnet-20240229'
  // retired: 'claude-2.1'
  // retired: 'claude-2.0'
];


// -- Wire Types --

/**
 * Namespace for the Anthropic API Models List response schema.
 * NOTE: not merged into AIX because of possible circular dependency issues - future work.
 */
export namespace AnthropicWire_API_Models_List {

  export type ModelObject = z.infer<typeof ModelObject_schema>;
  const ModelObject_schema = z.object({
    type: z.literal('model'),
    id: z.string(),
    display_name: z.string(),
    created_at: z.string(),
  });

  export const Response_schema = z.object({
    data: z.array(ModelObject_schema),
    has_more: z.boolean(),
    first_id: z.string().nullable(),
    last_id: z.string().nullable(),
  });

}


// -- Helper Functions --

export function anthropicValidateModelDefs_DEV(availableModels: AnthropicWire_API_Models_List.ModelObject[]): void {
  if (DEV_DEBUG_ANTHROPIC_MODELS) {
    llmDevCheckModels_DEV('Anthropic', availableModels.map(m => m.id), hardcodedAnthropicModels.map(m => m.id));
  }
}

/**
 * Create a placeholder ModelDescriptionSchema for Anthropic models not in the hardcoded list.
 * Uses sensible defaults with the newest available interfaces for day-0 support.
 */
export function llmsAntCreatePlaceholderModel(model: AnthropicWire_API_Models_List.ModelObject): ModelDescriptionSchema {
  return {
    id: model.id,
    idVariant: '::placeholder',
    label: model.display_name,
    created: Math.round(new Date(model.created_at).getTime() / 1000),
    description: 'Newest model, description not available yet.',
    contextWindow: 200000,
    maxCompletionTokens: 32768,
    interfaces: IF_4_R,
    // chatPrice: ...
    // benchmark: ...
  };
}


// -- Anthropic-through-OpenRouter Vendor Lookup --

const _ORT_ANT_IF_ALLOWLIST: ReadonlySet<string> = new Set([
  LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning,
] as const);
// NOTE: llmVndAntInfSpeed intentionally NOT included - fast mode not available through OpenRouter
const _ORT_ANT_PARAM_ALLOWLIST: ReadonlySet<string> = new Set([
  'llmVndAntEffort', 'llmVndAntEffortMax',
  'llmVndAntThinkingBudget',
] as const satisfies DModelParameterId[]);

/**
 * Lookup for OpenRouter: match an OR Anthropic model ID to a known hardcoded model
 * @param orModelName - The model name after stripping 'anthropic/' prefix (e.g. 'claude-4.6-opus')
 */
export function llmOrtAntLookup_ThinkingVariants(orModelName: string): OrtVendorLookupResult | undefined {

  // tokenize the OR name into a set of tokens ['claude', '3', '7', 'sonnet'], ignoring order, dots vs dashes, date suffixes, and OR-specific tags (e.g. ':beta')
  const orTokens = new Set(orModelName.replace(/:.*$/, '').replace(/\./g, '-').replace(/-\d{8}$/, '').split('-'));

  // find a known model by matching all tokens
  const _knownModel = hardcodedAnthropicModels.find((m) => {
    // tokenize known model name, removing the '...-date' suffix
    const antTokens = new Set(m.id.replace(/-\d{8}$/, '').split('-'));
    return antTokens.size === orTokens.size && [...antTokens].every((t) => orTokens.has(t));
  });
  if (!_knownModel) return undefined;

  // found a model
  let model = _knownModel;

  // if there's a variant, it must be the thinking variant, so return that
  const thinkingVariant = _hardcodedAnthropicThinkingVariants[model.id];
  if (thinkingVariant && !Array.isArray(thinkingVariant)) {
    const { idVariant: _idV, variantOrder: _vo, ...variantChanges } = thinkingVariant;
    model = { ...model, ...variantChanges };
  }

  // allowlists on interfaces and parameter specs
  const interfaces = model.interfaces.filter((i) => _ORT_ANT_IF_ALLOWLIST.has(i));

  const parameterSpecs = model.parameterSpecs
    ?.filter((spec) => _ORT_ANT_PARAM_ALLOWLIST.has(spec.paramId))
    .map((spec) => ({ ...spec }));

  // initialTemperature: not set - Anthropic models use the global fallback (0.5)
  return { interfaces, parameterSpecs };
}
