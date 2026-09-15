import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Responses, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { DModelParameterId } from '~/common/stores/llms/llms.parameters';

import type { ModelDescriptionSchema, OrtVendorLookupResult } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings, llmsLabelUncurated } from '../../models.mappings';

// --- SakanaAI Model ID inference (auto-derived from _sakanaKnownModels) ---
export type LlmsSakanaAIModelId = typeof _sakanaKnownModels[number]['idPrefix'];


// [Sakana.ai] Models List API schema - observed at https://api.sakana.ai/v1/models (re-verified 2026-09-14).
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
// Source: https://console.sakana.ai/pricing (2026-06-23; re-read 2026-09-14: the card is now headed 'fugu-ultra-v2.0'
// but still covers every Ultra version, and gained a $0.007 per web search/fetch call fee, = $7 per 1K calls). A single
// rate applies based on the top-tier model involved; orchestration/agent tokens are billed at the same input/output
// rates (never stacked).
const _fuguUltraPrice: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 272000, price: 5 }, { upTo: null, price: 10 }],
  output: [{ upTo: 272000, price: 30 }, { upTo: null, price: 45 }],
  cache: { read: [{ upTo: 272000, price: 0.5 }, { upTo: null, price: 1 }] },
  tools: { webSearch: 7 },
};

// [Sakana.ai] Fugu Max flat PAYG pricing (USD per 1M tokens) - no context-size tiers, unlike Ultra.
// Source: https://console.sakana.ai/pricing (2026-09-14), listed as 'fugu-max-v1.0'; web search/fetch $0.007 per call.
const _fuguMaxPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 2,
  output: 6,
  cache: { read: 0.25 },
  tools: { webSearch: 7 },
};

// Fugu params (Responses API). Reasoning effort: validation enumerates 'high' / 'xhigh' / 'max' (re-verified
// 2026-09-14 on fugu-max, fugu-ultra-v2.0 and fugu-cyber, 'low' 400s); console.sakana.ai/models documents 'max' as an
// alias of 'xhigh' (defaults: 'xhigh' for fugu-ultra, 'high' for fugu), so it is not offered as a duplicate level. Web
// search reuses the OpenAI Responses 'web_search' hosted tool ('web_search_preview' and 'code_interpreter' 400 with
// "Supported values are: 'function' and 'custom'"; a bare `{ type: 'web_fetch' }` is also accepted since the
// 2026-09-11 models, priced like a search call, but not wired): Sakana tolerates the context-size value (effect
// undocumented) but the responses adapter still emits the bare `{ type: 'web_search' }` for the 'sakanaai' dialect.
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
// 'fugu-cyber-v1.0' ID but requesting it still returns "Model not found" (re-probed 2026-09-14), unlike the
// Ultra and Max families where the versioned IDs are real. PAYG-only: not included in the subscription tiers.
const _fuguCyberPrice: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 272000, price: 6 }, { upTo: null, price: 12 }],
  output: [{ upTo: 272000, price: 36 }, { upTo: null, price: 54 }],
  cache: { read: [{ upTo: 272000, price: 0.6 }, { upTo: null, price: 1.2 }] },
};

// [Sakana.ai] Sakana Namazu flat PAYG pricing (USD per 1M tokens) - no context-size tiers, unlike Fugu Ultra.
// Source: https://console.sakana.ai/pricing (2026-08-04, unchanged 2026-09-14), listed as 'sakana-namazu-v1.0'. Thinking
// tokens bill at the output rate; the built-in tools bill on top: $7 / 1K web searches (carried in `tools`), and
// $0.12 / hour of code execution (no schema slot, not carried).
const _namazuPrice: ModelDescriptionSchema['chatPrice'] = {
  input: 0.95,
  output: 4,
  cache: { read: 0.15 },
  tools: { webSearch: 7 },
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

// Fugu versioning: '-vX.Y' pinned IDs plus a floating alias per family (since 2026-07-23; sakana.ai/fugu: "fugu-ultra-v1.0
// (previously fugu-ultra-20260615)"). Cache-identity probes (cross-model prompt-cache hits/misses on one long prompt):
// - 2026-09-14: 'fugu-ultra' IS 'fugu-ultra-v2.0' (10370/10372 cached tokens on the alias right after warming v2.0,
//   0 on v1.1) - stated outright at console.sakana.ai/models ("fugu-ultra (defaults to v2.0)"); 'fugu-max' IS
//   'fugu-max-v1.0' the same way (4070/6144 cached on the pin after warming the alias).
// - 2026-07-23: 'fugu-ultra-v1.0' IS the 20260615 snapshot, and 'fugu-ultra' was 'v1.1' back then.
// Every Ultra version shares one pricing card. The tokenizers differ per version (the same prompt counts 10372 tokens
// on Ultra v2.0, 5515 on v1.1, 6144 on Max), so cross-version cache hits are impossible by construction.
//
// Array order = display order (matching is longest-prefix, so order is free): the v-pins are the
// canonical visible entries; the floating aliases and the legacy dated ID are hidden duplicates of the
// pins; Cyber leads but stays hidden, since its approval is per key. When Sakana repoints a floating
// alias (next vX.Y), re-verify with the cache-identity probe and move the symLink target.
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
  // Fugu Ultra v2.0 - latest pinned version, launched 2026-09-11 (JST) together with Fugu Max: API-registered 2026-09-08
  // (list `created`), first seen by the app 2026-09-11, on OpenRouter as 'sakana/fugu-ultra-v2' (no '.0') from
  // 2026-09-11. Deeper expert-agent pool than v1.x; training cutoff 2026-08-28 (console.sakana.ai/models). Probed
  // 2026-09-14 on the Responses API: same effort enum as v1.x, image input 200, prompt caching live, 'low' 400s.
  {
    idPrefix: 'fugu-ultra-v2.0',
    label: 'Sakana Fugu Ultra v2.0',
    description: 'Multi-agent conductor system routing a deeper pool of expert agents for complex, multi-step reasoning - maximum answer quality on hard tasks. Latest pinned version (September 2026 update, training cutoff 2026-08-28). 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguUltraPrice,
    pubDate: '20260911',
  },
  // Fugu Max v1.0 - cost-optimized orchestrator over Sakana's largest model pool (open-weights and specialized models,
  // plus the NVIDIA Nemotron family), launched 2026-09-11 alongside Ultra v2.0 (API-registered 2026-09-08). Flat pricing,
  // no context tiers, included in the subscription tiers. Probed 2026-09-14 on the Responses API: effort enum
  // high/xhigh/max (as Ultra; 'low' 400s), image input 200, hosted 'web_search' and 'web_fetch' accepted,
  // 'code_interpreter' 400, prompt caching live (4070 cached of a 6144-token prompt). Context window: not stated by
  // Sakana; 1M per the OpenRouter listing (max_output_tokens is not validated, so there is no ceiling tell to probe).
  {
    idPrefix: 'fugu-max-v1.0',
    label: 'Sakana Fugu Max v1.0',
    description: 'Cost-optimized multi-agent orchestrator over Sakana\'s largest model pool - open-weights and specialized models, including the NVIDIA Nemotron family - for strong results at a fraction of Fugu Ultra\'s price. Built-in web search. 1M context.',
    contextWindow: 1000000,
    interfaces: _fuguUltraInterfaces,
    parameterSpecs: _fuguParamSpecs,
    chatPrice: _fuguMaxPrice,
    pubDate: '20260911',
  },
  // Fugu Ultra v1.1 - previous pinned version (registered 2026-07-22 PT), superseded by v2.0 on 2026-09-11; still served.
  {
    idPrefix: 'fugu-ultra-v1.1',
    label: 'Sakana Fugu Ultra v1.1',
    description: 'Multi-agent conductor system routing 1-3 expert agents for complex, multi-step reasoning. Pinned version (July 2026 update), superseded by v2.0. 1M context.',
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
  // Fugu Ultra - floating alias (currently = v2.0, cache-identity verified 2026-09-14): symlinked to the
  // pin so the duplicate stays out of the picker but the alias relationship is visible in the models list.
  {
    idPrefix: 'fugu-ultra',
    label: 'Sakana Fugu Ultra',
    symLink: 'fugu-ultra-v2.0',
    description: 'Multi-agent conductor system routing expert agents for complex, multi-step reasoning. Tracks the latest Fugu Ultra version. 1M context.',
  },
  // Fugu Max - floating alias, currently = v1.0 (the only published version, cache-identity verified 2026-09-14).
  {
    idPrefix: 'fugu-max',
    label: 'Sakana Fugu Max',
    symLink: 'fugu-max-v1.0',
    description: 'Cost-optimized multi-agent orchestrator over Sakana\'s largest model pool. Tracks the latest Fugu Max version. 1M context.',
  },
  // Sakana Namazu - floating alias, currently = v1.0 (the only published version): symlinked like 'fugu-ultra'.
  {
    idPrefix: 'sakana-namazu',
    label: 'Sakana Namazu',
    symLink: 'sakana-namazu-v1.0',
    description: 'Japanese-specialized LLM with built-in web search and code execution. Tracks the latest Sakana Namazu version. 256K context.',
  },
]);


// --- OpenRouter inheritance ---

const _ORT_SAK_IF_ALLOWLIST: ReadonlySet<string> = new Set([
  // no LLM_IF_OAI_Responses: OpenRouter serves these over Chat Completions
  LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning,
] as const);

// only the effort spec travels (Sakana's hosted web_search is a Responses-API construct; OR has its own)
const _ORT_SAK_PARAM_ALLOWLIST: ReadonlySet<string> = new Set([
  'llmVndOaiEffort',
] as const satisfies DModelParameterId[]);

/**
 * Lookup for OpenRouter: match an OR Sakana model ID to a known hardcoded model (OR's `created` is the onboarding
 * date, so pubDate must come from here).
 * @param orModelName - The model name after stripping 'sakana/' (e.g. 'fugu-ultra')
 */
export function llmOrtSakLookup(orModelName: string): OrtVendorLookupResult | undefined {

  // OR lists the floating aliases and drops the '.0' minor from pins ('sakana/fugu-ultra-v2' = 'fugu-ultra-v2.0',
  // 2026-09-11): resolve exact, then '<id>.0', then follow the symLink to the pin, which carries caps/params/pubDate
  let entry = _sakanaKnownModels.find(m => m.idPrefix === orModelName) ?? _sakanaKnownModels.find(m => m.idPrefix === `${orModelName}.0`);
  const symLink = entry && 'symLink' in entry ? entry.symLink : undefined;
  if (symLink) entry = _sakanaKnownModels.find(m => m.idPrefix === symLink);
  if (!entry?.interfaces) return undefined;

  const interfaces = entry.interfaces.filter(i => _ORT_SAK_IF_ALLOWLIST.has(i));

  const parameterSpecs = entry.parameterSpecs
    ?.filter(spec => _ORT_SAK_PARAM_ALLOWLIST.has(spec.paramId))
    .map(spec => ({ ...spec }));

  return { pubDate: entry.pubDate, interfaces, parameterSpecs };
}


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
