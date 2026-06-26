import * as z from 'zod/v4';

import { LLM_IF_HOTFIX_NoTemperature, LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { llmsDefineModels, fromManualMapping, KnownModel } from '../../models.mappings';

// --- Moonshot Model ID inference (auto-derived from _knownMoonshotModels) ---
export type LlmsMoonshotModelId = typeof _knownMoonshotModels[number]['idPrefix'];


const IF_K2 = [
  LLM_IF_HOTFIX_StripImages, // TEMPORARY HOTFIX - all these K2 models don't support images yet
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching,
  // LLM_IF_Tools_WebSearch // NOT YET
];
const IF_K2_REASON = [...IF_K2, LLM_IF_OAI_Reasoning];

const IF_K2_5 = [
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching,
  LLM_IF_OAI_Vision, // this is supported since 2.5
  LLM_IF_HOTFIX_NoTemperature, // no temperature control
];
const IF_K2_7_CODE = [...IF_K2_5, LLM_IF_OAI_Reasoning]; // always-on thinking, cannot be disabled

const _PS_Reasoning: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high'] },
] as const;


/**
 * Moonshot AI (Kimi) models.
 * - models list and pricing: https://platform.kimi.ai/docs/pricing/chat (was platform.moonshot.ai - now 301 redirect)
 * - API docs: https://platform.kimi.ai/docs/api/chat
 * - updated: 2026-06-26
 * - NOTE: K2 series (non-2.5/2.6) discontinued on 2026-05-25, removed from API; kept hidden for fallback.
 */
type _MoonshotModelDef = KnownModel & { pubDate: string };

const _knownMoonshotModels = llmsDefineModels<_MoonshotModelDef>()([

  // Kimi K2.7-code Series - Code-focused flagship (native multimodal, always-on thinking)
  {
    idPrefix: 'kimi-k2.7-code',
    label: 'Kimi K2.7 Code',
    pubDate: '20260601',
    description: 'Code-focused multimodal model (text, image, video inputs) with always-on thinking. ~180 tok/s output (up to 260 in short contexts for highspeed). 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2_7_CODE,
    // no _PS_Reasoning - thinking is always on (cannot be disabled)
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.19 } },
    benchmark: { cbaElo: 1460 + 2 } // not available yet, assuming kimi-k2.6 + 2
  },
  {
    idPrefix: 'kimi-k2.7-code-highspeed',
    label: 'Kimi K2.7 Code Highspeed',
    pubDate: '20260601',
    description: 'High-speed code variant with ~180 tok/s output (up to 260 in short contexts). Native multimodal with always-on thinking. 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2_7_CODE,
    chatPrice: { input: 1.90, output: 8.00, cache: { cType: 'oai-ac', read: 0.38 } },
    benchmark: { cbaElo: 1460 + 1 } // not available yet, assuming kimi-k2.6 + 1
  },

  // Kimi K2.6 Series - General-purpose flagship (native multimodal, thinking + non-thinking)
  {
    idPrefix: 'kimi-k2.6',
    label: 'Kimi K2.6',
    pubDate: '20260420',
    description: 'Native multimodal flagship (text, image, video inputs) with thinking and non-thinking modes. Stronger long-form coding, improved instruction compliance and self-correction. 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2_5,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.16 } },
    benchmark: { cbaElo: 1460 } // kimi-k2.6
  },

  // Kimi K2.5 Series - still API-listed; pricing page no longer documents it (superseded by K2.6)
  {
    idPrefix: 'kimi-k2.5',
    label: 'Kimi K2.5',
    pubDate: '20260127',
    description: 'Supports vision (images/videos), thinking mode, and Agent tasks. 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2_5,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.60, output: 3.00, cache: { cType: 'oai-ac', read: 0.10 } },
    benchmark: { cbaElo: 1450 }, // kimi-k2.5-thinking
  },

  // Kimi K2 Series - discontinued on 2026-05-25, removed from API

  // Fast, Thinking
  {
    hidden: true,
    idPrefix: 'kimi-k2-thinking-turbo',
    label: 'Kimi K2 Thinking Turbo',
    pubDate: '20251106',
    description: 'Discontinued. High-speed reasoning model with thinking and tool calling. 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 65536,
    interfaces: IF_K2_REASON,
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }], // NOT WORKING YET
    chatPrice: { input: 1.15, output: 8.00, cache: { cType: 'oai-ac', read: 0.15 } },
    benchmark: { cbaElo: 1430 }, // kimi-k2-thinking-turbo
  },
  // Thinking
  {
    hidden: true,
    idPrefix: 'kimi-k2-thinking',
    label: 'Kimi K2 Thinking',
    pubDate: '20251106',
    description: 'Discontinued. Advanced reasoning model with multi-step thinking and tool calling. 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 65536,
    interfaces: IF_K2_REASON,
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
    chatPrice: { input: 0.60, output: 2.50, cache: { cType: 'oai-ac', read: 0.15 } },
    benchmark: { cbaElo: 1417 + 2 }, // UNKNOWN +2 over 0905, to be at the top here
  },

  // K2
  {
    hidden: true,
    idPrefix: 'kimi-k2-0905-preview',
    label: 'Kimi K2 0905 (Preview)',
    pubDate: '20250905',
    description: 'Discontinued. MoE model (1T total, 32B active) with 256K context.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2,
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
    chatPrice: { input: 0.60, output: 2.50, cache: { cType: 'oai-ac', read: 0.15 } },
    isPreview: true,
    benchmark: { cbaElo: 1418 }, // kimi-k2-0905-preview
  },
  {
    hidden: true,
    idPrefix: 'kimi-k2-0711-preview',
    label: 'Kimi K2 0711 (Preview)',
    pubDate: '20250711',
    description: 'Earlier preview variant with 128K context. Superseded by 0905 version.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: IF_K2,
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
    chatPrice: { input: 0.60, output: 2.50, cache: { cType: 'oai-ac', read: 0.15 } },
    isPreview: true,
    benchmark: { cbaElo: 1417 }, // kimi-k2-0711-preview
  },
  {
    hidden: true,
    idPrefix: 'kimi-k2-turbo-preview',
    label: 'Kimi K2 Turbo (Preview)',
    pubDate: '20250801',
    description: 'High-speed variant with 60-100 tokens/second output. 256K context. Optimized for real-time applications and agentic tasks.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2,
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
    chatPrice: { input: 1.15, output: 8.00, cache: { cType: 'oai-ac', read: 0.15 } },
    isPreview: true,
  },

  // Legacy Moonshot V1 Models (deprecated, prefer K2 series)
  {
    idPrefix: 'moonshot-v1-128k',
    label: 'V1 128K',
    pubDate: '20240206',
    description: 'Legacy V1 model with 128K context. Deprecated - use Kimi K2 Instruct instead.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2.00, output: 5.00 },
    hidden: true,
  },
  {
    idPrefix: 'moonshot-v1-32k',
    label: 'V1 32K',
    pubDate: '20240206',
    description: 'Legacy V1 model with 32K context. Deprecated - use Kimi K2 Instruct instead.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.00, output: 3.00 },
    hidden: true,
  },
  {
    idPrefix: 'moonshot-v1-8k',
    label: 'V1 8K',
    pubDate: '20240206',
    description: 'Legacy V1 model with 8K context. Deprecated - use Kimi K2 Instruct instead.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 2.00 },
    hidden: true,
  },

  // Vision Models
  {
    // hidden: false, not hidden - only non-hidden vision for now
    idPrefix: 'moonshot-v1-128k-vision-preview',
    label: 'V1 128K Vision (Preview)',
    pubDate: '20250115',
    description: 'Legacy vision model with 128K context. Preview variant - use moonshot-v1-vision for production.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 2.00, output: 5.00 },
    isPreview: true,
  },
  {
    idPrefix: 'moonshot-v1-32k-vision-preview',
    label: 'V1 32K Vision (Preview)',
    pubDate: '20250115',
    description: 'Legacy vision model with 32K context. Preview variant - use moonshot-v1-vision for production.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 1.00, output: 3.00 },
    isPreview: true,
    hidden: true,
  },
  {
    idPrefix: 'moonshot-v1-8k-vision-preview',
    label: 'V1 8K Vision (Preview)',
    pubDate: '20250115',
    description: 'Legacy vision model with 8K context. Preview variant - use moonshot-v1-vision for production.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.20, output: 2.00 },
    isPreview: true,
    hidden: true,
  },

]);


// Excluded models: aliases, embeddings, and unknown variants
const _excludedMoonshotModels = [
  'kimi-latest',
  'kimi-thinking-preview',
  'moonshot-v1-auto',
  'moonshot-v1-vision',
] as const;

export function moonshotModelFilter(model: { id: string }): boolean {
  // Filter out excluded models
  return !_excludedMoonshotModels.some(excluded => model.id === excluded);
}

const _wireMoonshotModelsListOutputSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number().optional(),
  owned_by: z.string().optional(),
  context_length: z.number().optional(),
  // permission, root, parent fields are present but not used
});

export function moonshotModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = _wireMoonshotModelsListOutputSchema.parse(_model);

  // warn if the context window or other details differ from known mappings
  const knownModel = _knownMoonshotModels.find(base => model.id.startsWith(base.idPrefix));
  if (!knownModel)
    console.log(`moonshot.models: unknown model ${model.id}`, model);

  // NOTE: 'created' is passed for the indexed/created field but is deliberately NOT used as a pubDate
  // fallback for the "new" badge (unlike Groq/OpenAI/the aggregators): Moonshot's API returns a single
  // constant 'created' for ALL models (re-verified 2026-06-26: 11 models all share one ~fetch-time value), so it
  // can't tell new from old - a fallback would false-badge the entire catalog as "new". Known models
  // still get their real editorial pubDate via _knownMoonshotModels.
  const description = fromManualMapping(_knownMoonshotModels, model.id, model.created, undefined, {
    // NOTE: default: let us know if any of these show up
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'Unknown Moonshot Model',
    contextWindow: model.context_length || 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching],
    hidden: model.id.startsWith('moonshot-'), // hide older
  });

  // warn if API-reported context_length differs from our known mapping
  if (knownModel && model.context_length && model.context_length !== description.contextWindow)
    console.warn(`moonshot.models: context_length mismatch for ${model.id}: API reports ${model.context_length}, we have ${description.contextWindow}`);

  return description;
}

export function moonshotModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;

  // sort preview models after production
  // FIXME: this needs to be done before..
  // if (a.isPreview && !b.isPreview)
  //   return 1;
  // if (!a.isPreview && b.isPreview)
  //   return -1;

  // sort as per their order in the known models
  const aIndex = _knownMoonshotModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownMoonshotModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;

  return a.id.localeCompare(b.id);
}
