import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings, llmsLabelUncurated } from '../../models.mappings';

// --- Modular Model ID inference (auto-derived from _modularKnownModels) ---
export type LlmsModularModelId = typeof _modularKnownModels[number]['idPrefix'];


// [Modular] Models List API schema - observed at https://api.modular.com/v1/models (2026-08-13).
// The list carries only id/object/created/owned_by - no capabilities, no pricing - so all caps and
// prices come from the manual mappings below. Ids mostly mirror HuggingFace repo names, are
// CASE-SENSITIVE, and churn without notice (MiniMaxAI/MiniMax-M3 -> minimax/minimax-m3 mid-day
// 2026-08-13, the old id now 404s) - keep the table in sync with the live list.
const _wireModularModelItemSchema = z.object({
  id: z.string(), // only strictly required field
  object: z.string().nullish(),
  created: z.number().nullish(),
  owned_by: z.string().nullish(),
});


// GLM effort ladder on Modular: 'none' hard-off, 'high' the reduced tier, 'max' the deep tier (= vendor default).
// 'low' deliberately excluded - measured indistinguishable from 'high' (see the GLM 5.2 entry).
const _PS_GlmEffort: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] },
] as const;


// [Modular Cloud] Editorial table for the shared endpoints (array order = display order), measured
// live 2026-08-13 (GLM 5.2 added 2026-08-14, re-measured 2026-08-16). Output caps are unverified where
// noted: the server silently clamps oversized max_tokens instead of erroring, so an over-large value is
// never observable as a failure. Context windows ARE observable (oversized prompt -> 400 with the limit).
// pubDate is the upstream creator's release date, not the day Modular listed the model (host rule).
// Re-verified 2026-08-17: same 5 chat ids (+ the FLUX image id we skip), every context re-probed exact
// with the 400 oracle, every model still echoes an nvidia/*-NVFP4 id, prices unchanged on
// modular.com/pricing.
// 2026-08-31 pass: google/gemma-4-26b-a4b-it delisted (404 on use, gone from the rate card) - entry removed.
// zai-org/glm-5.3 landed (added below). MiniMaxAI/MiniMax-M3-MXFP8 is newly listed but 503s on use
// (not serving yet) - left to the uncurated fallback until it stabilizes.
const _modularKnownModels = llmsDefineManualMappings([
  {
    idPrefix: 'minimax/minimax-m3',
    label: 'MiniMax M3',
    pubDate: '20260601',
    description: '1M-context multimodal MoE with default-on reasoning. Served as NVIDIA NVFP4 (4-bit) quantization on Modular Cloud shared endpoints.',
    contextWindow: 1048576,
    maxCompletionTokens: 131072, // unverified
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning, LLM_IF_OAI_PromptCaching],
    benchmark: { cbaElo: 1444 }, // lmarena: minimax-m3
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.06 } },
  },
  {
    idPrefix: 'google/gemma-4-31b-it',
    label: 'Gemma 4 31B',
    pubDate: '20260402',
    description: 'Google Gemma 4 31B instruction-tuned, text+image input. Served as NVIDIA NVFP4 (4-bit) quantization.',
    contextWindow: 262144,
    maxCompletionTokens: 32768, // unverified
    // no Reasoning (the catalog claims it, but this deployment exposes no reasoning surface) and no Json
    // (json_object emits type-corrupted output here)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    benchmark: { cbaElo: 1451 }, // lmarena: gemma-4-31b
    chatPrice: { input: 0.25, output: 0.65 },
  },
  // REMOVED: google/gemma-4-26b-a4b-it (delisted + 404 on use + off the rate card, 2026-08-31)
  {
    idPrefix: 'moonshotai/kimi-k2.7-code',
    label: 'Kimi K2.7 Code',
    pubDate: '20260612',
    description: 'Moonshot Kimi K2.7 Code, agentic coding model with always-on reasoning. Served as NVIDIA NVFP4 (4-bit) quantization.',
    contextWindow: 262144,
    maxCompletionTokens: 131072, // unverified
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching],
    // no benchmark: no arena row for kimi-k2.7-code as of 2026-08-17
    // chatPrice: not on the rate card as of 2026-08-17 (modular.com/pricing lists Kimi K2.5 0.60/3.00/0.12 and
    // K2.6 0.85/3.50/0.16, no K2.7 row) - add when published
  },
  {
    idPrefix: 'zai-org/glm-5.3',
    label: 'GLM 5.3',
    pubDate: '20260814', // = zai.models.ts 'glm-5.3'
    description: 'Zhipu GLM-5.3, post-trained on the GLM-5.2 base for frontier coding and long-horizon agentic work, reasoning on by default (effort control), text-only. 192K context on the shared endpoint (native: 1M).',
    contextWindow: 192000, // enforced by the shared endpoint (400 'exceeds the configured maximum context length of 192000 tokens', probed 2026-08-31)
    maxCompletionTokens: 131072, // unverified
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_PromptCaching],
    // reasoning_effort passthrough probed 2026-08-31 (n=1/arm, fixed prompt): 'none' = off (0 reasoning tokens),
    // 'high' ~30, 'max' ~215 - the same none/high/max shape as GLM 5.2 below (default = on)
    parameterSpecs: _PS_GlmEffort,
    benchmark: { cbaElo: 1487 }, // lmarena: glm-5.3-max
    chatPrice: { input: 1.40, output: 4.40, cache: { read: 0.26 } }, // modular.com/pricing 2026-08-31, same card as GLM 5.2
  },
  {
    idPrefix: 'z-ai/glm-5.2',
    label: 'GLM 5.2',
    pubDate: '20260616', // = zai.models.ts 'glm-5.2'
    description: 'Zhipu GLM-5.2 open-weights coding/agentic MoE (753B, ~40B active), reasoning on by default (effort control), text-only. Served as NVIDIA NVFP4 (4-bit) quantization with speculative decoding, 160K context on the shared endpoint (native: 1M).',
    contextWindow: 163840, // enforced by the shared endpoint (400 'exceeds the configured maximum context length of 163840 tokens', probed 2026-08-16); the marketing page's 1M is the weights, not the deployment
    maxCompletionTokens: 131072, // unverified
    // no Vision (image_url REJECTED 400: text-only deployment) and no Json (json_object is clean
    // but json_schema strict emits template-token garbage inside valid JSON - probed 2026-08-14)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_PromptCaching],
    // reasoning_effort passthrough (generic dialect branch), ablated 2026-08-16 (n=17 on low/high/max/default, 9 elsewhere):
    // 'none' = off (0 reasoning tokens, template marker dropped), low = medium = high (~520-750 tokens), xhigh = max = default
    // (~1.1K, ~1.6x) - Z.ai's documented native mapping. Streams reasoning as delta.reasoning (not reasoning_content) - parser reads both.
    parameterSpecs: _PS_GlmEffort,
    benchmark: { cbaElo: 1471 }, // lmarena: glm-5.2-max
    chatPrice: { input: 1.40, output: 4.40, cache: { read: 0.26 } },
  },
]);


function _prettyModelId(id: string): string {
  // fallback labeler for unknown models, e.g. "deepseek-ai/DeepSeek-V3" => "DeepSeek V3"
  return (id.split('/').pop() || id)
    .replaceAll(/[_-]/g, ' ')
    .split(' ')
    .map(serverCapitalizeFirstLetter)
    .join(' ')
    .trim();
}


export function modularModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  // tolerant top-level unwrap: accept a plain array or `{ data: [...] }`, else fall back to []
  let rawItems: unknown[] = [];
  if (Array.isArray(wireModels))
    rawItems = wireModels;
  else if (wireModels && typeof wireModels === 'object' && Array.isArray((wireModels as { data?: unknown[] }).data))
    rawItems = (wireModels as { data: unknown[] }).data;

  const descriptions: ModelDescriptionSchema[] = [];

  for (const rawItem of rawItems) {
    // per-item safeParse: one bad entry never crashes the rest
    const { data: model, error } = _wireModularModelItemSchema.safeParse(rawItem);
    if (error || !model?.id) {
      if (error) console.warn('[DEV] modular: skipping invalid model entry', z.prettifyError(error));
      continue;
    }

    // skip image-generation ids: they surface in /v1/models but serve (if at all) only via
    // /v1/images/generations, so a chat-shaped row would be wrong (FLUX.2-klein-4B, 2026-08-14)
    if (model.id.startsWith('black-forest-labs/'))
      continue;

    // known models get full caps/pricing; unknown ids (day-zero cloud additions, or any model on a
    // self-hosted MAX host) stay visible with a conservative chat-only shape and no context window;
    // the '[?]' label prefix + null contextWindow mark them uncurated, which holds them off the
    // llm-registry-sync publication push (same convention as nvidianim 0-day arrivals)
    descriptions.push(fromManualMapping(_modularKnownModels, model.id, model.created ?? undefined, undefined, {
      idPrefix: model.id,
      label: llmsLabelUncurated(_prettyModelId(model.id)),
      description: `New Modular arrival '${model.id}', not yet curated - capabilities and context window unverified.`,
      contextWindow: null,
      interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
      hidden: false,
    }));
  }

  // sort into editorial display order (= _modularKnownModels array order; unknown models sort at their
  // family slot via prefix else last, ties by id)
  const _rank = (id: string) => {
    const exact = _modularKnownModels.findIndex(known => id === known.idPrefix);
    if (exact !== -1) return exact;
    const prefix = _modularKnownModels.findIndex(known => id.startsWith(known.idPrefix));
    return prefix === -1 ? _modularKnownModels.length : prefix;
  };
  return descriptions.sort((a, b) => _rank(a.id) - _rank(b.id) || a.id.localeCompare(b.id));
}
