import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings, llmsLabelUncurated } from '../../models.mappings';

// --- SakanaAI Model ID inference (auto-derived from _sakanaKnownModels) ---
export type LlmsSakanaAIModelId = typeof _sakanaKnownModels[number]['idPrefix'];


// [Sakana.ai] Models List API schema - observed at https://api.sakana.ai/v1/models (re-verified 2026-08-17).
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
// Source: https://console.sakana.ai/pricing (2026-06-23, unchanged as of 2026-08-17). A single rate applies
// based on the top-tier model involved; orchestration/agent tokens are billed at the same input/output rates
// (never stacked).
const _fuguUltraPrice: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 272000, price: 5 }, { upTo: null, price: 10 }],
  output: [{ upTo: 272000, price: 30 }, { upTo: null, price: 45 }],
  cache: { cType: 'oai-ac', read: [{ upTo: 272000, price: 0.5 }, { upTo: null, price: 1 }] },
};

// Fugu params (Responses API). Reasoning effort: validation enumerates 'high' / 'xhigh' / 'max' (re-verified
// 2026-08-17 on fugu-ultra and fugu-cyber); console.sakana.ai/models documents 'max' as an alias of 'xhigh'
// (defaults: 'xhigh' for fugu-ultra, 'high' for fugu), so it is not offered as a duplicate level. Web search
// reuses the OpenAI Responses 'web_search' hosted tool - the only hosted tool the Fugu models take
// ('web_search_preview' and 'code_interpreter' 400 with "Supported values are: 'function' and 'custom'"):
// Sakana tolerates the context-size value (effect undocumented) but the responses adapter still emits the
// bare `{ type: 'web_search' }` for the 'sakanaai' dialect.
const _fuguParamSpecs = [
  { paramId: 'llmVndOaiEffort' as const, enumValues: ['high', 'xhigh'] },
  // Reuse OpenAI's Responses web_search control, restricted to a single value so the UI shows On/Off (Sakana
  // has no context-size levels). The responses adapter emits the bare `{ type: 'web_search' }` for this dialect.
  { paramId: 'llmVndOaiWebSearchContext' as const, enumValues: ['high'] },
];

// Common Fugu interfaces. LLM_IF_OAI_Responses: all Fugu models are driven via the Responses API (see chatGenerate.dispatch).
const _fuguUltraInterfaces = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_OAI_PromptCaching];

// [Sakana.ai] Fugu Cyber tiered PAYG pricing (USD per 1M tokens), boundary at 272K input tokens.
// Last published rates: https://console.sakana.ai/pricing (2026-07-20) - listed there as 'fugu-cyber-v1.0'.
// As of 2026-08-17 that page no longer prints Cyber rates ("contact our sales team"), so these are kept as the
// last public PAYG numbers. The API serves it as 'fugu-cyber' ONLY: console.sakana.ai/models documents a
// 'fugu-cyber-v1.0' ID but requesting it still returns "Model not found" (re-probed 2026-08-17), unlike the
// Ultra family where the versioned IDs are real. PAYG-only: not included in the subscription tiers.
const _fuguCyberPrice: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 272000, price: 6 }, { upTo: null, price: 12 }],
  output: [{ upTo: 272000, price: 36 }, { upTo: null, price: 54 }],
  cache: { cType: 'oai-ac', read: [{ upTo: 272000, price: 0.6 }, { upTo: null, price: 1.2 }] },
};

// [Sakana.ai] Sakana Namazu flat PAYG pricing (USD per 1M tokens) - no context-size tiers, unlike Fugu.
// Source: https://console.sakana.ai/pricing (2026-08-04), listed as 'sakana-namazu-v1.0'. Thinking tokens
// bill at the output rate; the built-in tools bill on top ($7 / 1K web searches, $0.12 / hour of code execution).
const _namazuPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 0.95,
  output: 4,
  cache: { cType: 'oai-ac', read: 0.15 },
};

// Namazu interfaces/params, all empirically verified 2026-08-04 on the Responses API (Chat Completions is also
// served, but the 'sakanaai' dialect always dispatches to Responses): vision, function calling, the hosted
// 'web_search' tool, and automatic prompt caching (usage.input_tokens_details.cached_tokens > 0).
// Reasoning effort takes the whole OpenAI ladder ('none'|'minimal'|'low'|'medium'|'high'|'xhigh'|'max'; anything
// else 400s "backend rejected request" - re-probed 2026-08-17), but only 'none' has an observable effect (thinking
// off, ~250 vs 720-1050 output tokens on a fixed prompt; the other six are indistinguishable and usage carries no
// reasoning_tokens split), hence the binary none/high.
const _namazuInterfaces = [LLM_IF_OAI_Responses, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_OAI_PromptCaching];
const _namazuParamSpecs = [
  { paramId: 'llmVndOaiEffort' as const, enumValues: ['none', 'high'] },
  { paramId: 'llmVndOaiWebSearchContext' as const, enumValues: ['high'] },
];

// Fugu Ultra versioning: Sakana switched to '-vX.Y' pinned IDs (API-registered 2026-07-23; sakana.ai/fugu:
// "fugu-ultra-v1.0 (previously fugu-ultra-20260615)"). Cache-identity probes (2026-07-23, cross-model prompt-cache
// hits/misses): 'fugu-ultra-v1.0' IS the 20260615 snapshot, and the floating 'fugu-ultra' IS 'v1.1' - since
// stated outright at console.sakana.ai/models ("fugu-ultra ... defaults to fugu-ultra-v1.1", read 2026-08-17).
// Both versions share the same pricing (console.sakana.ai/pricing lists them under one Fugu Ultra card).
//
// Array order = display order (matching is longest-prefix, so order is free): the v-pins are the
// canonical visible entries; the floating alias and the legacy dated ID are hidden duplicates of the
// pins; Cyber leads but stays hidden, since its approval is per key. When Sakana repoints the floating
// 'fugu-ultra' (next vX.Y), re-verify with the cache-identity probe and move the symLink target.
const _sakanaKnownModels = llmsDefineManualMappings([
  // Fugu Cyber - cybersecurity-specialized orchestrator, same interface set/params as Ultra. Access-gated per
  // key: console.sakana.ai/models still requires an approval form (and pay-as-you-go billing mode), and
  // non-approved keys see it in the models list but get a permission_error (with the form URL) on use. An
  // approved key now generates fine (2026-08-17: HTTP 200 on /v1/responses, was permission_error 2026-07-20),
  // but approval is per key, so this stays hidden by default.
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
  // Sakana Namazu v1.0 - not an orchestrator: a Japanese-specialized model (Kimi K2.6 base, adapted by Sakana),
  // announced 2026-08-03 as the API version of the model already powering Sakana Chat. Context window is 256K
  // (probed: max_output_tokens is capped at 262144 minus the prompt tokens, there is no separate output ceiling).
  {
    idPrefix: 'sakana-namazu-v1.0',
    label: 'Sakana Namazu v1.0',
    description: 'Japanese-specialized LLM built on Moonshot AI\'s Kimi K2.6 and adapted by Sakana on in-house Japanese and Japanese-business data, with reduced over-refusal and bias. Built-in web search and code execution. 256K context.',
    contextWindow: 262144,
    interfaces: _namazuInterfaces,
    parameterSpecs: _namazuParamSpecs,
    chatPrice: _namazuPrice,
    pubDate: '20260803',
  },
  // Fugu Ultra - floating alias (currently = v1.1, cache-identity verified 2026-07-23): symlinked to the
  // pin so the duplicate stays out of the picker but the alias relationship is visible in the models list.
  {
    idPrefix: 'fugu-ultra',
    label: 'Sakana Fugu Ultra',
    symLink: 'fugu-ultra-v1.1',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning. Tracks the latest Fugu Ultra version. 1M context.',
  },
  // Sakana Namazu - floating alias, currently = v1.0 (the only published version): symlinked like 'fugu-ultra'.
  {
    idPrefix: 'sakana-namazu',
    label: 'Sakana Namazu',
    symLink: 'sakana-namazu-v1.0',
    description: 'Japanese-specialized LLM with built-in web search and code execution. Tracks the latest Sakana Namazu version. 256K context.',
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

    // known fugu models get full caps/pricing; unknown ids are uncurated (the list API discloses no
    // type/modality/context): '[?]' + null contextWindow keeps them visible in-app but holds them
    // off the llm-registry-sync publication push
    descriptions.push(fromManualMapping(_sakanaKnownModels, model.id, model.created ?? undefined, undefined, {
      idPrefix: model.id,
      label: llmsLabelUncurated(_prettyModelId(model.id)),
      description: model.description || `New Sakana.ai arrival '${model.id}', not yet curated - capabilities and context window unverified.`,
      contextWindow: null,
      // optimistic capability leeway for 0-day arrivals; rein in when cataloged
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
