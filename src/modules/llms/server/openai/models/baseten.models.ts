import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { wireBasetenListOutputSchema, type WireBasetenModel } from '../wiretypes/baseten.wiretypes';


// configuration
// [Baseten, 2026-08-28] Model APIs: a small curated slate (15 ids) on https://inference.baseten.co, served
// quantized (fp4/fp8) with automatic prefix caching. The /v1/models listing carries display names, per-token
// pricing, context/output caps, features and modalities - the listing is authoritative for all of those.
// What it under-reports is the `reasoning_effort` control ('reasoning_effort' appears in supported_features
// on 1 of 11 models that honor it), so the effort ladders below are curated from
// https://docs.baseten.co/inference/model-apis/reasoning and live-probed (this file's dated comments).
// [2026-08-31] same 15 ids, no curation drift. GLM-5.2/-Fast now list image input and it is REAL here
// (prompt tokens scale with pixels + color check) - unlike Together/Fireworks, which serve GLM-5.2 text-only.


export function basetenHeuristic(hostname: string): boolean {
  // deliberately narrow: dedicated deployments (model-*.api.baseten.co) have a different API shape
  return hostname.includes('inference.baseten.co');
}


type _BasetenCurated = {
  pubDate?: ModelDescriptionSchema['pubDate'];    // upstream model release date - the listing 'created' is the catalog date
  parameterSpecs?: ModelDescriptionSchema['parameterSpecs'];
};

// Wire-wise every spec below collapses to `reasoning_effort` on the 'openai' dialect. Param choice follows
// the first-party tables for UI parity: llmVndOaiEffort where the ladder has OpenAI-only tiers (medium/xhigh),
// llmVndMiscEffort for the none/low/high/max thinking families (deepseek/moonshot/fireworks precedent).
// Ladders live-ablated 2026-08-28 (reasoning_tokens + reasoning_content length, 1-2 arms each):
// - GLM-5.2/-Fast validate strictly (400: "must be one of high, max, none"); 'none' hard-off.
// - GLM-5.3/-Flash accept anything but honor low < high < max; 'none' is a trap (accepted, still reasons,
//   ~= a low tier) and 'medium' collapses onto 'high' - docs ladder low|high|max published as-is.
// - DeepSeek + Kimi K3: 'none' hard-off (no reasoning_content), low/high/max real tiers - docs agree.
//   Flash-0731 also hard-offs on 'minimal' and honors 'xhigh'; MiscEffort family ladder kept for parity.
// - gpt-oss-120b: docs advertise none..max, measured none~=minimal~=low (~0.45K chars), medium ~0.73K,
//   high = xhigh = max (~1.3-1.9K) -> only the native low|medium|high tiers are real.
// - inkling-small: 'none' hard-off, low 0.18K < Default 0.38K < xhigh 0.54K chars - docs full ladder held,
//   published bare (= the full llmVndOaiEffort range) for both inkling sizes.
const _PS_MiscEffortFull: ModelDescriptionSchema['parameterSpecs'] = [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }];
const _PS_GlmEffort52: ModelDescriptionSchema['parameterSpecs'] = [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] }];
const _PS_GlmEffort53: ModelDescriptionSchema['parameterSpecs'] = [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high', 'max'] }];
const _PS_OaiEffortFull: ModelDescriptionSchema['parameterSpecs'] = [{ paramId: 'llmVndOaiEffort' }];

const _basetenCurated: Record<string, _BasetenCurated> = {
  'deepseek-ai/DeepSeek-V4-Flash-0731': { pubDate: '20260731', parameterSpecs: _PS_MiscEffortFull },
  'deepseek-ai/DeepSeek-V4-Pro': { pubDate: '20260424', parameterSpecs: _PS_MiscEffortFull },
  'deepseek-ai/DeepSeek-V4-Pro-0813': { pubDate: '20260813', parameterSpecs: _PS_MiscEffortFull },
  'moonshotai/Kimi-K2.6': { pubDate: '20260420' },      // reasoning always-on; reasoning_effort ignored (docs + live-probed)
  'moonshotai/Kimi-K2.7-Code': { pubDate: '20260612' }, // reasoning always-on; not in the docs effort table
  'moonshotai/Kimi-K3': { pubDate: '20260716', parameterSpecs: _PS_MiscEffortFull },
  'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B': { pubDate: '20260604' }, // reasoning-capable; no effort control on this host
  'openai/gpt-oss-120b': { pubDate: '20250805', parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }] },
  'thinkingmachines/inkling': { pubDate: '20260714', parameterSpecs: _PS_OaiEffortFull },
  'thinkingmachines/inkling-small': { pubDate: '20260730', parameterSpecs: _PS_OaiEffortFull }, // = together.models.ts 'thinkingmachines/Inkling-Small' (no publisher catalog: OpenRouter listing date, HF repo 2026-07-27)
  'zai-org/GLM-4.7': { pubDate: '20251222' },           // non-reasoning
  'zai-org/GLM-5.2': { pubDate: '20260616', parameterSpecs: _PS_GlmEffort52 },
  'zai-org/GLM-5.2-Fast': { pubDate: '20260616', parameterSpecs: _PS_GlmEffort52 },
  'zai-org/GLM-5.3': { pubDate: '20260814', parameterSpecs: _PS_GlmEffort53 },
  'zai-org/GLM-5.3-Flash': { pubDate: '20260825', parameterSpecs: _PS_GlmEffort53 },
};


export function basetenModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  return wireBasetenListOutputSchema.parse(wireModels).data

    // only text-output chat models (lenient: keep rows that don't declare output modalities)
    .filter((model: WireBasetenModel) => !model.output_modalities || model.output_modalities.includes('text'))

    .map((model: WireBasetenModel): ModelDescriptionSchema => {

      const curated = _basetenCurated[model.id];

      // capabilities: the listing's features/modalities are accurate (cross-checked with live requests)
      const features = model.supported_features || [];
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
      if (model.input_modalities?.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);
      if (features.includes('tools'))
        interfaces.push(LLM_IF_OAI_Fn);
      if (features.includes('reasoning') || curated?.parameterSpecs)
        interfaces.push(LLM_IF_OAI_Reasoning);
      // json_mode/structured_outputs: on every row today; LLM_IF_OAI_Json is suspended, not emitted

      // pricing: per-token dollar strings -> $/M tokens (rounded off the parseFloat*1e6 fp noise);
      // cache read is automatic prefix caching
      const perM = (perToken: string | null | undefined) => Math.round(parseFloat(perToken ?? '') * 1_000_000 * 1e6) / 1e6;
      const inputPriceM = perM(model.pricing?.prompt);
      const outputPriceM = perM(model.pricing?.completion);
      const cacheReadM = perM(model.pricing?.input_cache_read);
      const chatPrice: ModelDescriptionSchema['chatPrice'] = (Number.isFinite(inputPriceM) && Number.isFinite(outputPriceM)) ? {
        input: inputPriceM,
        output: outputPriceM,
        ...(Number.isFinite(cacheReadM) && cacheReadM > 0 ? { cache: { cType: 'oai-ac', read: cacheReadM } } : {}),
      } : undefined;

      // description: catalog text (empty on some rows) + the serving quantization
      const description = [
        model.description || '',
        model.quantization ? `Served ${model.quantization.toUpperCase()}-quantized.` : '',
      ].filter(Boolean).join(' ');

      return {
        id: model.id,
        label: model.name || model.id,
        created: model.created || 0,
        updated: model.created || 0,
        description,
        contextWindow: model.context_length || null,
        interfaces,
        ...(curated?.parameterSpecs ? { parameterSpecs: curated.parameterSpecs } : {}),
        ...(model.max_completion_tokens ? { maxCompletionTokens: model.max_completion_tokens } : {}),
        ...(chatPrice ? { chatPrice } : {}),
        ...(curated?.pubDate ? { pubDate: curated.pubDate } : {}),
      };
    })

    // creator ascending, newest first within
    .sort((a, b) => {
      const aCreator = a.id.split('/')[0];
      const bCreator = b.id.split('/')[0];
      return aCreator.localeCompare(bCreator) || (b.created || 0) - (a.created || 0);
    });
}
