import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- TogetherAI Model ID inference (auto-derived from _knownTogetherAIChatModels) ---
export type LlmsTogetherAIModelId = typeof _knownTogetherAIChatModels[number]['idPrefix'];
import { wireTogetherAIListOutputSchema } from '../wiretypes/togetherai.wiretypes';


// Note: 2025-01-28 - we used to have harcoded models here, but now we have a dynamic
// list from the API, so we don't need to hardcode them here anymore.
const _knownTogetherAIChatModels = llmsDefineManualMappings([
  // {
  //   idPrefix: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  //   label: 'Llama 3.3 70B Instruct Turbo',
  //   description: 'Llama 3.3 70B Instruct Turbo is an advanced model from Meta with a context length of 131072 tokens, using FP8 quantization.',
  //   contextWindow: 131072,
  //   interfaces: [LLM_IF_OAI_Chat],
  // },
]);

// allow list patterns
const _togetherAllowTypes = [
  'chat',
];

const _togetherAIDenyList: string[] = [
  'devuser/test',
  'test-lora',
  'test/test',
];

// Vision (image input) id patterns - Together publishes no modality field, so these are the explicit
// '-vision'/'-vl' tags plus families that are natively multimodal across every served variant, each
// cross-checked against the same model on OpenRouter/Fireworks (which do publish modalities).
// Under-detect rather than over-detect: a false positive lets the composer attach images that the
// endpoint then rejects. Matched against the lowercased model id.
const _togetherVisionMatches: readonly (string | RegExp)[] = [
  'vision', '-vl', 'llava', 'pixtral', // explicitly tagged
  'llama-4', // Llama 4 Scout/Maverick
  'kimi-k2.6', 'kimi-k2.7', 'kimi-k3', // Moonshot: native visual understanding from K2.6 on
  'inkling', // Thinking Machines: text + image + audio
  'molmo', // AI2 vision-language
  'gemma-4', // verified live, see gemini.models.ts
  /gemma-3-(4b|12b|27b)/, // Gemma 3 4B+ are multimodal (1B/270M are text-only)
  /qwen3\.[56]-/, 'qwen3.7-plus', // Qwen 3.5/3.6 (all variants) and 3.7-Plus take image (3.7-Max does not)
  /glm-\d[\d.]*v\b/, // Z.ai vision line (GLM-4.5V, GLM-5V)
  '-omni', // omni-modal (Nemotron 3 Nano Omni)
  '-ocr', // OCR models are image-in by definition
];

// TogetherAI 'created' is the endpoint-record date, not the model release date (verified live
// 2026-07-12: DeepSeek-V4-Pro - released 2026-04-24 - stamped created=today; base 'zai-org/GLM-5'
// stamped 4 months AFTER its own 'GLM-5-FP4' quant; and 28/269 endpoints report created: 0,
// including the newest arrivals, e.g. GLM-5.2, Kimi-K2.7-Code). It is therefore NEVER used for
// pubDate (the "new" badge / 'published' display) - only for list placement.
//
// Editorial release dates for Together-hosted third-party models, keyed by Together model id.
// The ONLY source of pubDate for this vendor (besides the manual mappings above); keep dates
// consistent with the publisher's own catalog where we have one (e.g. deepseek.models.ts).
const _togetherEditorialPubDates: Record<string, string> = {
  'google/gemma-4-31B-it': '20260402', // = gemini.models.ts 'models/gemma-4-31b-it'
  'moonshotai/Kimi-K2.6': '20260417', // = fireworksai.models.ts 'kimi-k2p6'
  'deepseek-ai/DeepSeek-V4-Pro': '20260424', // = deepseek.models.ts 'deepseek-v4-pro'
  'MiniMaxAI/MiniMax-M3': '20260601',
  'nvidia/nemotron-3-ultra-550b-a55b': '20260602', // = fireworksai.models.ts 'nemotron-3-ultra-nvfp4'
  'moonshotai/Kimi-K2.7-Code': '20260612',
  'zai-org/GLM-5.2': '20260613',
  'thinkingmachines/Inkling': '20260714', // = fireworksai.models.ts 'inkling'
  'deepseek-ai/DeepSeek-V4-Flash-0731': '20260731',
};

/** 'YYYYMMDD' -> Unix epoch seconds (UTC midnight), 0 when absent - for list placement only */
function _pubDateEpoch(pubDate?: string): number {
  return pubDate ? Date.UTC(+pubDate.slice(0, 4), +pubDate.slice(4, 6) - 1, +pubDate.slice(6, 8)) / 1000 : 0;
}

export function togetherAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  function togetherAIModelsSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
    if (a.hidden && !b.hidden)
      return 1;
    if (!a.hidden && b.hidden)
      return -1;
    // sort by endpoint date, falling back to the editorial date (rescues created:0 endpoints)
    const aDate = a.created || _pubDateEpoch(a.pubDate);
    const bDate = b.created || _pubDateEpoch(b.pubDate);
    if (aDate !== bDate)
      return bDate - aDate;
    return a.id.localeCompare(b.id);
  }

  return wireTogetherAIListOutputSchema
    .parse(wireModels)

    .filter((model) => {
      // filter-out models that don't even have the type
      if (!model.type)
        return false;

      // filter-out non-llms
      if (!_togetherAllowTypes.includes(model.type))
        return false;

      // NOTE: shall we filter out the non-running models?

      // filter-out deny list (testing models mainly)
      return !_togetherAIDenyList.some(prefix => model.id.includes(prefix));
    })

    .map((model): ModelDescriptionSchema => {

      // heuristics for names
      const label = model.display_name || model.id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' ');
      const description = `${model.organization || 'Together AI'} ${model.type} model. ${model.link || ''}`;
      const contextWindow = model.context_length || null;
      // pricing: input/output 0/0 means 'not serverless-priced' (dedicated/LoRA-only endpoints,
      // 92/160 chat models on 2026-07-12), NOT free - Together's actual free tier uses explicit
      // '-Free' id suffixes (none listed today), which we keep honoring as truly free
      let chatPrice: ModelDescriptionSchema['chatPrice'] | undefined = undefined;
      if (typeof model.pricing?.input === 'number' && typeof model.pricing?.output === 'number') {
        const { input, output, cached_input } = model.pricing;
        if (input > 0 || output > 0 || model.id.endsWith('-Free'))
          chatPrice = {
            input,
            ...(!!cached_input && cached_input > 0 && cached_input < input && { cache: { cType: 'oai-ac' as const, read: cached_input } }),
            output,
          };
      }
      const interfaces = [LLM_IF_OAI_Chat];
      // vision detection by id string, see _togetherVisionMatches
      const lcId = model.id.toLowerCase();
      if (_togetherVisionMatches.some(match => typeof match === 'string' ? lcId.includes(match) : match.test(lcId)))
        interfaces.push(LLM_IF_OAI_Vision);

      const md = fromManualMapping(_knownTogetherAIChatModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        // parameterSpecs: ...
        // maxCompletionTokens: ...
        // benchmark: ...
        chatPrice,
        hidden: false,
      });

      // pubDate: editorial only - 'created' is endpoint churn, see _togetherEditorialPubDates above
      if (md.pubDate === undefined && _togetherEditorialPubDates[model.id])
        md.pubDate = _togetherEditorialPubDates[model.id];

      return md;
    })

    .sort(togetherAIModelsSort);
}
