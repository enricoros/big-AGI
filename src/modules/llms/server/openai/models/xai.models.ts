import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { OPENAI_API_PATHS, openAIAccess, OpenAIAccessSchema } from '../openai.access';
import { llmsDefineManualMappings, fromManualMapping, KnownModel, llmDevCheckModels_DEV } from '../../models.mappings';

// --- xAI Model ID inference (auto-derived from _knownXAIChatModels) ---
export type LlmsXAIModelId = typeof _knownXAIChatModels[number]['idPrefix'];


// configuration
const DEV_DEBUG_XAI_MODELS = (Release.TenantSlug as any) === 'staging' /* ALSO IN STAGING! */ || Release.IsNodeDevBuild;


// Known xAI Models - Manual Mappings
// List on: https://docs.x.ai/docs/models?cluster=us-east-1
// Verified: 2026-05-20 (post-2026-05-15 retirement: grok-4-1-fast, grok-4-fast, grok-4-0709, grok-3 redirect to grok-4.3; grok-code-fast-1 now aliases grok-build-0.1)

// Flat pricing for Grok 4.3 / 4.20 flagship family (unified $1.25/$2.50 since May 2026)
const PRICE_FLAGSHIP = {
  input: 1.25,
  output: 2.5,
  cache: { cType: 'oai-ac' as const, read: 0.2 },
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

// Pre-Grok 4 models do NOT support server-side tools (web_search, x_search, code_interpreter)
const XAI_IF_Pre4: ModelDescriptionSchema['interfaces'] = [
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn,
] as const;

const XAI_IF_Pre4_Vision: ModelDescriptionSchema['interfaces'] = [
  ...XAI_IF_Pre4, LLM_IF_OAI_Vision,
] as const;

const XAI_PAR_Pre4: ModelDescriptionSchema['parameterSpecs'] = [] as const;


const _knownXAIChatModels = llmsDefineManualMappings([

  // Grok 4.3 (flagship, April 2026) - reasoning_effort: none/low(default)/medium/high
  {
    idPrefix: 'grok-4.3',
    label: 'Grok 4.3',
    pubDate: '20260417',
    description: 'xAI\'s latest flagship model with reasoning and a 1M token context window. Supports text and image inputs, with reasoning_effort control (none/low/medium/high). Knowledge cutoff: November 2024.',
    contextWindow: 1000000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] }, // vendor default 'low'; 'none' disables reasoning
      ...XAI_PAR_Reasoning,
    ],
    chatPrice: PRICE_FLAGSHIP,
    benchmark: { cbaElo: 1456 }, // grok-4.3
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
    benchmark: { cbaElo: 1480 }, // grok-4.20-beta-0309-reasoning (CBA name)
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
    benchmark: { cbaElo: 1482 }, // grok-4.20-beta1 (CBA name)
  },
  {
    idPrefix: 'grok-4.20-multi-agent-0309',
    label: 'Grok 4.20 Multi-Agent',
    pubDate: '20260309',
    description: 'Multi-agent model that runs specialized agents in parallel for collaborative verification with reduced hallucination. Reasoning effort selects 4 vs 16 agents.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    // no LLM_IF_OAI_Fn: multi-agent does not support function calling
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high', 'xhigh'] }, // low/medium = 4 agents, high/xhigh = 16 agents
      ...XAI_PAR_Reasoning,
    ],
    chatPrice: PRICE_FLAGSHIP,
    benchmark: { cbaElo: 1474 }, // grok-4.20-multi-agent-beta-0309
  },

  // Retired on 2026-05-15 (slugs still resolve, redirect to grok-4.3 at $1.25/$2.50 pricing):
  // - grok-4-1-fast-reasoning / grok-4-1-fast-non-reasoning
  // - grok-4-fast-reasoning / grok-4-fast-non-reasoning
  // - grok-4-0709
  // - grok-3
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
    interfaces: [...XAI_IF_Pre4_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Pre4,
    chatPrice: { input: 1.00, output: 2.00, cache: { cType: 'oai-ac', read: 0.20 } },
  },

  // Grok 3 Mini (Pre-Grok 4: no server-side tools) - not in 2026-05-15 retirement list
  {
    idPrefix: 'grok-3-mini',
    label: 'Grok 3 Mini',
    pubDate: '20250217',
    description: 'A lightweight model that is fast and smart for logic-based tasks. Supports function calling and structured outputs.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Pre4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] },
      ...XAI_PAR_Pre4,
    ],
    chatPrice: { input: 0.3, output: 0.5, cache: { cType: 'oai-ac', read: 0.075 } },
    benchmark: { cbaElo: 1357 }, // grok-3-mini-beta
  },

  // Grok 2 (Pre-Grok 4: no server-side tools) - not in 2026-05-15 retirement list
  {
    idPrefix: 'grok-2-vision-1212',
    label: 'Grok 2 Vision (1212)',
    pubDate: '20241212',
    description: 'xAI model grok-2-vision-1212 with image and text input capabilities. Supports text generation with a 32,768 token context window.',
    contextWindow: 32768,
    maxCompletionTokens: undefined,
    interfaces: XAI_IF_Pre4_Vision,
    parameterSpecs: XAI_PAR_Pre4,
    chatPrice: { input: 2, output: 10 },
    // no benchmark: keep this out
  },

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
      label: _xaiFormatNewModelLabel(xm.id),
      description: `xAI model ${xm.id}`,
      contextWindow: 256000, // random picked on 2026-01-22
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
  'grok-4.3',
  'grok-4.20-0309-reasoning',
  'grok-4.20-0309-non-reasoning',
  'grok-4.20-multi-agent-0309',
  'grok-build-0.1',
  'grok-3-mini-fast',
  'grok-3-mini',
  'grok-2-vision-1212',
  'grok-2-1212',
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

  // pricing - FIXME: SCALE UNKNOWN for now
  prompt_text_token_price: z.number().optional(),
  prompt_image_token_price: z.number().optional(),
  completion_text_token_price: z.number().optional(),
  cached_prompt_text_token_price: z.number().optional(),

  // System information
  fingerprint: z.string().optional(),

  // Aliases for models
  aliases: z.array(z.string()).optional(),
});

export const wireXAIModelsListSchema = z.object({
  models: z.array(wireXAIModelSchema),
});
