import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- SakanaAI Model ID inference (auto-derived from _sakanaKnownModels) ---
export type LlmsSakanaAIModelId = typeof _sakanaKnownModels[number]['idPrefix'];


// [Sakana.ai] Models List API schema - observed at https://api.sakana.ai/v1/models (2026-06-23).
// The list returns only id/object/created/description/owned_by - NO capabilities or pricing - so all
// caps/pricing come from the manual mappings below; the API `description` is the unknown-model fallback.
// (`created` is a constant placeholder across all models, so it is NOT used to derive a pubDate.)
const _wireSakanaAIModelItemSchema = z.object({
  id: z.string(), // only strictly required field
  object: z.string().nullish(),
  created: z.number().nullish(),
  description: z.string().nullish(),
  owned_by: z.string().nullish(),
});


// [Sakana.ai] Fugu Ultra tiered PAYG pricing (USD per 1M tokens), boundary at 272K input tokens.
// Source: https://console.sakana.ai/pricing (2026-06-23). A single rate applies based on the top-tier
// model involved; orchestration/agent tokens are billed at the same input/output rates (never stacked).
const _fuguUltraPrice: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 272000, price: 5 }, { upTo: null, price: 10 }],
  output: [{ upTo: 272000, price: 30 }, { upTo: null, price: 45 }],
  cache: { cType: 'oai-ac', read: [{ upTo: 272000, price: 0.5 }, { upTo: null, price: 1 }] },
};

// Fugu params (Responses API). Reasoning effort: 'high' / 'xhigh' ('max' is a compat alias for 'xhigh',
// rejected by the Responses adapter, so not offered). Web search reuses the OpenAI Responses 'web_search'
// hosted tool: Sakana ignores the context-size value and accepts only the bare tool - the responses adapter
// emits `{ type: 'web_search' }` for the 'sakanaai' dialect.
const _fuguParamSpecs = [
  { paramId: 'llmVndOaiEffort' as const, enumValues: ['high', 'xhigh'] },
  // Reuse OpenAI's Responses web_search control, restricted to a single value so the UI shows On/Off (Sakana
  // has no context-size levels). The responses adapter emits the bare `{ type: 'web_search' }` for this dialect.
  { paramId: 'llmVndOaiWebSearchContext' as const, enumValues: ['high'] },
];

// Common Fugu interfaces. LLM_IF_OAI_Responses: all Fugu models are driven via the Responses API (see chatGenerate.dispatch).
const _fuguUltraInterfaces = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_OAI_PromptCaching];

const _sakanaKnownModels = llmsDefineManualMappings([
  // Fugu Ultra - dated snapshot (pinnable). Same capabilities/pricing as the floating 'fugu-ultra'.
  {
    idPrefix: 'fugu-ultra-20260615',
    label: 'Sakana Fugu Ultra (2026-06-15)',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning. Dated snapshot. 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguUltraPrice,
    pubDate: '20260615',
  },
  // Fugu Ultra - floating alias (latest).
  {
    idPrefix: 'fugu-ultra',
    label: 'Sakana Fugu Ultra',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning - maximum answer quality on hard tasks. 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguUltraPrice,
    pubDate: '20260622',
  },
  // Fugu - fast orchestration mini. Variable pricing: bills at the underlying routed model's standard rate (unpublished), so left unpriced.
  {
    idPrefix: 'fugu',
    label: 'Sakana Fugu',
    description: 'Fast orchestration model routing tasks across a swappable pool of frontier LLMs - low latency, high quality. 1M context. Billed at the routed underlying model\'s standard rate.',
    contextWindow: 1000000,
    interfaces: [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _fuguParamSpecs,
    pubDate: '20260622',
  },
]);


function _prettyModelId(id: string): string {
  // fallback labeler for unknown models, e.g. "fugu-nano" => "Sakana Fugu Nano"
  const pretty = id
    .replaceAll(/[_-]/g, ' ')
    .split(' ')
    .map(serverCapitalizeFirstLetter)
    .join(' ')
    .trim();
  return pretty.startsWith('Fugu') ? `Sakana ${pretty}` : pretty;
}


export function sakanaAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  // tolerant top-level unwrap: accept a plain array or `{ data: [...] }`, else fall back to []
  let rawItems: unknown[] = [];
  if (Array.isArray(wireModels))
    rawItems = wireModels;
  else if (wireModels && typeof wireModels === 'object' && Array.isArray((wireModels as { data?: unknown[] }).data))
    rawItems = (wireModels as { data: unknown[] }).data;

  const descriptions: ModelDescriptionSchema[] = [];

  for (const rawItem of rawItems) {
    // per-item safeParse: one bad entry never crashes the rest
    const { data: model, error } = _wireSakanaAIModelItemSchema.safeParse(rawItem);
    if (error || !model?.id) {
      if (error) console.warn('[DEV] sakanaAI: skipping invalid model entry', z.prettifyError(error));
      continue;
    }

    // known fugu models get full caps/pricing; unknown models fall back to a generic Fugu-family description
    descriptions.push(fromManualMapping(_sakanaKnownModels, model.id, model.created ?? undefined, undefined, {
      idPrefix: model.id,
      label: _prettyModelId(model.id),
      description: model.description || 'Model served via Sakana.ai.',
      contextWindow: 1000000,
      interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
      hidden: false,
    }));
  }

  // stable sort by id: 'fugu' < 'fugu-ultra' < 'fugu-ultra-20260615'
  return descriptions.sort((a, b) => a.id.localeCompare(b.id));
}
