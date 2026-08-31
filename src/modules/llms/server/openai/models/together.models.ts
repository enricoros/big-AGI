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

// Retired from serverless but still priced non-zero, so the 0/0 rule below misses them: chat calls return
// 400 'Unable to access non-serverless model'. /v1/models has no field for this - only a live probe or the
// docs serverless table separates the two, hence this exact-id list.
// Sweep 2026-08-28 (1-token probe, 72 priced chat rows): 19 alive (3 Qwen3.x-Plus/Max streaming-only), 51
// non-serverless 400, GLM-4.5-Air-FP8 503, Kimi-K2.7-Code 500 then 400. Matches the chat rows on
// https://docs.together.ai/docs/serverless-models except Prism-ML/Ternary-Bonsai-27B (0/0-priced) and
// arize-ai/qwen-2-1.5b-instruct (priced, answering, undocumented).
// Sweep 2026-08-31 (74 priced rows): all 53 entries below still dead (Kimi-K2.6 now errors 'all configured
// deployments are stopped' instead of the non-serverless 400 - still dead); 21 alive, +Qwen3.8-Flash (new,
// streaming-only like the other Qwen Plus/Max tiers) and +GLM-5.3 (relisted and serving, see pubDates below).
// Membership rotates fast in both directions ('created' gets re-stamped) - probe, never trust this list's age.
// Accepted cost: a user with a dedicated endpoint for one of these ids no longer sees it.
const _togetherAIRetiredIds = new Set<string>([
  // zai-org
  'zai-org/GLM-5.1', // deprecated 2026-07-10 (row now labeled 'GLM 5.1 FP4')
  'zai-org/GLM-5', // deprecated 2026-06-22
  'zai-org/GLM-4.7', // deprecated 2026-04-02
  'zai-org/GLM-4.6', // 400 non-serverless (fine-tuning removal 2026-07-29)
  'zai-org/GLM-4.5-Air-FP8', // deprecated 2026-04-02 (503 'Service unavailable', not the usual 400)
  // Qwen
  'Qwen/QwQ-32B',
  'Qwen/Qwen2-1.5B-Instruct',
  'Qwen/Qwen2-72B-Instruct',
  'Qwen/Qwen2-VL-72B-Instruct',
  'Qwen/Qwen2.5-14B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct-Turbo',
  'Qwen/Qwen2.5-7B-Instruct-Turbo', // retired between the 2026-08-17 and -27 sweeps
  'Qwen/Qwen2.5-Coder-32B-Instruct',
  'Qwen/Qwen2.5-VL-72B-Instruct',
  'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8',
  'Qwen/Qwen3-Coder-Next-FP8',
  'Qwen/Qwen3-Next-80B-A3B-Instruct',
  'Qwen/Qwen3-Next-80B-A3B-Thinking',
  'Qwen/Qwen3-VL-32B-Instruct',
  'Qwen/Qwen3-VL-8B-Instruct',
  'Qwen/Qwen3.5-397B-A17B',
  // meta-llama
  'meta-llama/Llama-3-8b-chat-hf',
  'meta-llama/Llama-3.1-405B-Instruct',
  'meta-llama/Llama-3.2-1B-Instruct',
  'meta-llama/Llama-3.2-3B-Instruct',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'meta-llama/Meta-Llama-3-70B-Instruct-Turbo',
  'meta-llama/Meta-Llama-3-8B-Instruct',
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  // deepseek-ai
  'deepseek-ai/DeepSeek-R1-0528',
  'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
  'deepseek-ai/DeepSeek-V3.1',
  'deepseek-ai/DeepSeek-V4-Pro', // off serverless 2026-08-28; docs keep only the -0813 id
  'deepseek-ai/deepseek-coder-33b-instruct',
  // mistralai
  'mistralai/Ministral-3-14B-Instruct-2512',
  'mistralai/Mistral-7B-Instruct-v0.1',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'mistralai/Mistral-Small-24B-Instruct-2501',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
  // others
  'MiniMaxAI/MiniMax-M2.7',
  'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
  'arcee-ai/trinity-mini',
  'google/gemma-2-27b-it',
  'moonshotai/Kimi-K2.5-fp4',
  'moonshotai/Kimi-K2.6', // retired between the 2026-08-17 and -27 sweeps
  'moonshotai/Kimi-K2.7-Code', // 500 on the 08-28 sweep, standard 400 on re-probe
  'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',
  'nvidia/nemotron-3-ultra-550b-a55b', // off serverless 2026-08-28
  'nvidia/NVIDIA-Nemotron-Nano-9B-v2',
]);

// Vision (image input) id patterns - Together publishes no modality field, so these are the explicit
// '-vision'/'-vl' tags plus families that are natively multimodal across every served variant, each
// cross-checked against the same model on OpenRouter/Fireworks (which do publish modalities).
// Under-detect rather than over-detect: a false positive lets the composer attach images that the
// endpoint then rejects. Matched against the lowercased model id.
// Sweep 2026-08-17: every serverless model was probed at 3 image sizes. A real vision endpoint scales
// prompt_tokens with pixel count; a text-only one either 400s ('is not a multimodal model' /
// 'Multimodal processing failed') or silently drops the part for a flat placeholder cost (gpt-oss +0,
// Qwen2.5-7B-Turbo +6 at every size) - flat cost is NOT vision. Gemma exception (2026-08-27): its
// fixed-size encoder is flat at ~+256/image yet passes a color-identification check - a ~256 step IS vision.
const _togetherVisionMatches: readonly (string | RegExp)[] = [
  'vision', '-vl', 'llava', 'pixtral', // explicitly tagged
  'llama-4', // Llama 4 Scout/Maverick
  'kimi-k2.6', 'kimi-k2.7', 'kimi-k3', // Moonshot: native visual understanding from K2.6 on
  'inkling', // Thinking Machines: text + image + audio
  'minimax-m3', // MiniMax: M3 only (M2.x accept an image part and drop it)
  'muse-glimmer', // Meta Muse Glimmer: built-in vision encoder
  'bonsai-27b', // PrismML Bonsai: low-bit build of the multimodal Qwen3.6-27B
  'molmo', // AI2 vision-language
  'gemma-4', // verified live, see gemini.models.ts
  'gemma-3n', // Gemma 3n E2B/E4B are multimodal
  /gemma-3-(4b|12b|27b)/, // Gemma 3 4B+ are multimodal (1B/270M are text-only)
  /qwen3\.[56]-/, 'qwen3.7-plus', // Qwen 3.5/3.6 (all variants) and 3.7-Plus take image (3.7-Max does not)
  'qwen3.8-flash', // scaling (123 -> 843 prompt tokens) + color check 2026-08-31; NOT all of qwen3.8: Together's Qwen3.8-2.4T-A95B is a text-only NVFP4 quant ('is not a multimodal model'), unlike Fireworks' serving of the same weights
  /glm-\d[\d.]*v\b/, // Z.ai vision line (GLM-4.5V, GLM-5V)
  'glm-5.3-flash', // multimodal Flash base, scaling+color check 2026-08-27 (the glm-5.3 text flagship rejects images), see zai.models.ts
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
// Keys for currently-retired ids stay - the serverless set rotates back, and a deleted date must be re-researched.
const _togetherEditorialPubDates: Record<string, string> = {
  'openai/gpt-oss-120b': '20250805', // = groq.models.ts / cerebras.models.ts 'gpt-oss-120b'
  'openai/gpt-oss-20b': '20250805',
  'Qwen/Qwen3.5-9B': '20260302', // HF public 2026-03-02, follow-up to the 20260225 Qwen3.5 open-weights drop (no alibaba.models.ts id)
  'google/gemma-4-31B-it': '20260402', // = gemini.models.ts 'models/gemma-4-31b-it'
  'Qwen/Qwen3.6-Plus': '20260402', // = alibaba.models.ts 'qwen3.6-plus'
  'moonshotai/Kimi-K2.6': '20260420', // = moonshot.models.ts 'kimi-k2.6' (fireworksai.models.ts still says 20260417)
  'deepseek-ai/DeepSeek-V4-Pro': '20260424', // = deepseek.models.ts 'deepseek-v4-pro' (undated id = the 0424 launch weights)
  'MiniMaxAI/MiniMax-M3': '20260601',
  'Qwen/Qwen3.7-Plus': '20260601', // = alibaba.models.ts 'qwen3.7-plus'
  'nvidia/nemotron-3-ultra-550b-a55b': '20260604', // = nvidianim.models.ts (NVIDIA HF card: 'Release Date: 06/04/2026 via Hugging Face')
  'moonshotai/Kimi-K2.7-Code': '20260612',
  'zai-org/GLM-5.2': '20260616', // = zai.models.ts 'glm-5.2'
  'Qwen/Qwen3.7-Max': '20260622', // = alibaba.models.ts 'qwen3.7-max'
  'Prism-ML/Ternary-Bonsai-27B': '20260714', // PrismML announcement (prismml.com/news/bonsai-27b)
  'thinkingmachines/Inkling': '20260714', // = fireworksai.models.ts 'inkling'
  'moonshotai/Kimi-K3': '20260716', // = moonshot.models.ts 'kimi-k3'
  'thinkingmachines/Inkling-Small': '20260730', // no publisher catalog: OpenRouter listing date (HF repo 2026-07-27)
  'deepseek-ai/DeepSeek-V4-Flash-0731': '20260731',
  'meta-models/Muse-Glimmer-30B': '20260810', // Meta announcement (HF repo 2026-08-09)
  'Qwen/Qwen3.8-2.4T-A95B': '20260812', // = alibaba.models.ts 'qwen3.8-2.4t-a95b'
  'deepseek-ai/DeepSeek-V4-Pro-0813': '20260813', // 0813 GA weights, unlike the undated id above
  'zai-org/GLM-5.3': '20260814', // = zai.models.ts 'glm-5.3' - pre-announced then delisted by 2026-08-27; relisted and serving as of 2026-08-31
  'zai-org/GLM-5.3-Flash': '20260825', // = zai.models.ts 'glm-5.3-flash' (HF weights 2026-08-25)
  'Qwen/Qwen3.8-Flash': '20260826', // no alibaba.models.ts id yet: OpenRouter listing date - true up if DashScope lands one
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

      // NOTE: do not filter on `running` - it is false on all 276 rows (2026-08-28), serverless ones included.

      // filter-out retired-but-still-priced ids
      if (_togetherAIRetiredIds.has(model.id))
        return false;

      // filter-out deny list (testing models mainly)
      return !_togetherAIDenyList.some(prefix => model.id.includes(prefix));
    })

    .map((model): ModelDescriptionSchema => {

      // heuristics for names
      const label = model.display_name || model.id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' ');
      const description = `${model.organization || 'Together AI'} ${model.type} model. ${model.link || ''}`;
      // no '[?]' marker (evaluated 2026-08-14): API-characterized (`type` filter above) - see llmsLabelUncurated
      const contextWindow = model.context_length || null;
      // pricing: input/output 0/0 means 'not serverless-priced' (dedicated/LoRA-only endpoints,
      // 96/169 chat models on 2026-08-27), NOT free - Together's actual free tier uses explicit
      // '-Free' id suffixes (none listed today), which we keep honoring as truly free.
      // Exception (2026-08-17): Prism-ML/Ternary-Bonsai-27B is 0/0 yet serverless and priced 'Free' on
      // docs/serverless-models, so it surfaces with no price rather than as free
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
