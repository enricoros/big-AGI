import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- SakanaAI Model ID inference (auto-derived from _sakanaKnownModels) ---
export type LlmsSakanaAIModelId = typeof _sakanaKnownModels[number]['idPrefix'];


// [Sakana.ai] Models List API schema - observed at https://api.sakana.ai/v1/models (2026-07-23).
// The list returns only id/object/created/owned_by - NO capabilities or pricing - so all caps/pricing
// come from the manual mappings below; `description` (returned until ~2026-06) is kept as a tolerated
// field and unknown-model fallback. (`created` now varies per model but does not track launch dates -
// e.g. 'fugu' reports 2026-06-16 vs its 2026-06-22 launch - so it is NOT used to derive a pubDate.)
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

// Fugu params (Responses API). Reasoning effort: validation enumerates 'high' / 'xhigh' / 'max' (re-verified
// 2026-07-23 on both fugu-ultra-v1.0 and -v1.1);
// 'max' (rejected pre-July) now executes but is a compat alias currently equal to 'xhigh', so it is not
// offered as a duplicate level. Web search reuses the OpenAI Responses 'web_search' hosted tool: since
// ~2026-07 Sakana tolerates the context-size value (effect undocumented) but the responses adapter still
// emits the bare `{ type: 'web_search' }` for the 'sakanaai' dialect.
const _fuguParamSpecs = [
  { paramId: 'llmVndOaiEffort' as const, enumValues: ['high', 'xhigh'] },
  // Reuse OpenAI's Responses web_search control, restricted to a single value so the UI shows On/Off (Sakana
  // has no context-size levels). The responses adapter emits the bare `{ type: 'web_search' }` for this dialect.
  { paramId: 'llmVndOaiWebSearchContext' as const, enumValues: ['high'] },
];

// Common Fugu interfaces. LLM_IF_OAI_Responses: all Fugu models are driven via the Responses API (see chatGenerate.dispatch).
const _fuguUltraInterfaces = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_OAI_PromptCaching];

// [Sakana.ai] Fugu Cyber tiered PAYG pricing (USD per 1M tokens), boundary at 272K input tokens.
// Source: https://console.sakana.ai/pricing (2026-07-20) - listed there as 'fugu-cyber-v1.0'; the API
// serves it as 'fugu-cyber' ONLY (2026-07-23: requesting 'fugu-cyber-v1.0' returns "Model not found",
// unlike the Ultra family where the versioned IDs are real). PAYG-only: not included in the subscription tiers.
const _fuguCyberPrice: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 272000, price: 6 }, { upTo: null, price: 12 }],
  output: [{ upTo: 272000, price: 36 }, { upTo: null, price: 54 }],
  cache: { cType: 'oai-ac', read: [{ upTo: 272000, price: 0.6 }, { upTo: null, price: 1.2 }] },
};

// Fugu Ultra versioning: Sakana switched to '-vX.Y' pinned IDs (API-registered 2026-07-23; sakana.ai/fugu:
// "fugu-ultra-v1.0 (previously fugu-ultra-20260615)"). Cache-identity probes (2026-07-23, cross-model prompt-cache
// hits/misses): 'fugu-ultra-v1.0' IS the 20260615 snapshot, and the floating 'fugu-ultra' currently IS 'v1.1'.
// Both versions share the same pricing (console.sakana.ai/pricing lists them under one Fugu Ultra card).
//
// Array order = display order (matching is longest-prefix, so order is free): the v-pins are the
// canonical visible entries; the floating alias and the legacy dated ID are hidden duplicates of the
// pins; Cyber leads but stays hidden until Sakana approves the key. When Sakana repoints the floating
// 'fugu-ultra' (next vX.Y), re-verify with the cache-identity probe and move the symLink target.
const _sakanaKnownModels = llmsDefineManualMappings([
  // Fugu Cyber - cybersecurity-specialized orchestrator, same interface set/params as Ultra. Access-gated:
  // non-approved API keys see it in the models list but get a permission_error (with the request form URL)
  // on use - hence hidden by default; unhide after Sakana approves the key.
  {
    idPrefix: 'fugu-cyber',
    label: 'Sakana Fugu Cyber',
    description: 'Orchestrator specialized for cybersecurity reasoning: security analysis, vulnerability research, threat investigation. 1M context. Requires access approval from Sakana; pay-as-you-go billing only.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguCyberPrice,
    pubDate: '20260721',
    hidden: true,
  },
  // Fugu Ultra v1.1 - latest pinned version (registered 2026-07-22 PT; on the pricing page, not yet announced).
  {
    idPrefix: 'fugu-ultra-v1.1',
    label: 'Sakana Fugu Ultra v1.1',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning - maximum answer quality on hard tasks. Latest pinned version (July 2026 update). 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguUltraPrice,
    pubDate: '20260722',
  },
  // Fugu Ultra v1.0 - pinned version; same underlying model as the legacy 'fugu-ultra-20260615' ID.
  {
    idPrefix: 'fugu-ultra-v1.0',
    label: 'Sakana Fugu Ultra v1.0',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning. Pinned version, previously served as fugu-ultra-20260615. 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguUltraPrice,
    pubDate: '20260615',
  },
  // Fugu Ultra - legacy dated ID, superseded by 'fugu-ultra-v1.0' (same model); still served, hidden from the default list.
  {
    idPrefix: 'fugu-ultra-20260615',
    label: 'Sakana Fugu Ultra (2026-06-15)',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning. Legacy dated ID, superseded by fugu-ultra-v1.0 (same model). 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguUltraPrice,
    pubDate: '20260615',
    isLegacy: true,
    hidden: true,
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
  // Fugu Ultra - floating alias (currently = v1.1, cache-identity verified 2026-07-23): symlinked to the
  // pin so the duplicate stays out of the picker but the alias relationship is visible in the models list.
  {
    idPrefix: 'fugu-ultra',
    label: 'Sakana Fugu Ultra',
    symLink: 'fugu-ultra-v1.1',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning. Tracks the latest Fugu Ultra version. 1M context.',
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

  // sort into editorial display order (= _sakanaKnownModels array order; unknown models sort at their
  // family slot via prefix, ties by id) - the client preserves the service's list order
  const _rank = (id: string) => {
    const exact = _sakanaKnownModels.findIndex(known => id === known.idPrefix);
    if (exact !== -1) return exact;
    const prefix = _sakanaKnownModels.findIndex(known => id.startsWith(known.idPrefix));
    return prefix === -1 ? _sakanaKnownModels.length : prefix;
  };
  return descriptions.sort((a, b) => _rank(a.id) - _rank(b.id) || a.id.localeCompare(b.id));
}
