import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { formatPubDate, fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- FireworksAI Model ID inference (auto-derived from _fireworksKnownModels) ---
export type LlmsFireworksAIModelId = typeof _fireworksKnownModels[number]['idPrefix'];
import { wireFireworksAIListOutputSchema } from '../wiretypes/fireworksai.wiretypes';


export function fireworksAIHeuristic(hostname: string) {
  return hostname.includes('fireworks.ai/');
}


const IF_CHAT_FN = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];
const IF_CHAT_FN_VISION = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision];

// Editorial curation of the serverless-deployable chat models on the 'fireworks' account.
// The OpenAI-compat /inference/v1/models endpoint returns NO display name, description, or price, so
// without this every model falls back to the id-derived label (see _prettyModelId) and an "owned_by kind"
// description. Labels/descriptions/creators are lifted from Fireworks' control-plane API
// (GET /v1/accounts/fireworks/models/{id}: displayName, description, huggingFaceUrl); Standard-tier prices
// from https://docs.fireworks.ai/serverless/pricing (input / cached-input / output per 1M tokens).
// Un-curated / future models still render via _prettyModelId + the fromManualMapping '[?]' fallback.
const _fireworksKnownModels = llmsDefineManualMappings([
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-flash-0731',
    label: 'DeepSeek V4 Flash 0731',
    pubDate: '20260731',
    description: 'Official release of DeepSeek V4 Flash, superseding the preview, with substantially enhanced agentic capabilities. Ships with a speculative decoding module attached.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN,
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.028 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k3',
    label: 'Kimi K3 (Vision)',
    pubDate: '20260719',
    description: 'Moonshot AI 2.8T-parameter flagship on Kimi Delta Attention, with native visual understanding and a 1M-token context for long-horizon coding and reasoning.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION,
    chatPrice: { input: 3.00, output: 15.00, cache: { cType: 'oai-ac', read: 0.30 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/inkling',
    label: 'Inkling (Vision)',
    pubDate: '20260714',
    description: 'Thinking Machines Lab first open-weights model: a 975B MoE (41B active) trained natively across text, image, and audio, with controllable thinking effort.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION,
    benchmark: { cbaElo: 1441 }, // lmarena: inkling
    // chatPrice: not on the serverless pricing table as of 2026-08-04
  },
  {
    idPrefix: 'accounts/fireworks/models/glm-5p2',
    label: 'GLM 5.2',
    pubDate: '20260616',
    description: 'Z.ai flagship with 1M-token context and multi-effort coding for long-horizon agentic tasks. New IndexShare architecture and improved MTP layer cut per-token compute.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN,
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.14 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k2p7-code',
    label: 'Kimi K2.7 Code (Vision)',
    pubDate: '20260612',
    description: 'Coding-focused agentic model built on Kimi K2.6, with better end-to-end completion on long-horizon software engineering and ~30% fewer thinking tokens.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION,
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.19 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/minimax-m3',
    label: 'MiniMax M3',
    pubDate: '20260611',
    description: 'MiniMax 428B MoE (23B active) with Sparse Attention for efficient long context, tuned for long-horizon agentic coding and cowork.',
    contextWindow: 512_000, // 500K
    interfaces: IF_CHAT_FN, // native multimodal upstream, but Fireworks serves it text-only (supports_image_input=false)
    benchmark: { cbaElo: 1445 }, // lmarena: minimax-m3
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.06 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/qwen3p7-plus',
    label: 'Qwen3.7 Plus (Vision)',
    pubDate: '20260609',
    description: 'Alibaba flagship closed model, available outside Alibaba infrastructure exclusively through Fireworks AI.',
    contextWindow: null, // not published by Fireworks
    interfaces: IF_CHAT_FN_VISION,
    benchmark: { cbaElo: 1459 }, // lmarena: qwen3.7-plus
    chatPrice: { input: 0.40, output: 1.60, cache: { cType: 'oai-ac', read: 0.08 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/nemotron-3-ultra-nvfp4',
    label: 'NVIDIA Nemotron 3 Ultra NVFP4',
    pubDate: '20260602',
    description: 'NVIDIA frontier-scale hybrid LatentMoE (550B params, 55B active) interleaving Mamba-2 and MoE layers, for multi-step agents and long-context reasoning.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN,
    benchmark: { cbaElo: 1426 }, // lmarena: nvidia-nemotron-3-ultra-550b-a55b-nvfp4
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.12 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    pubDate: '20260424',
    description: 'DeepSeek flagship open MoE (1.6T params) for frontier reasoning, coding, and long-context work up to 1M tokens. Hybrid attention keeps long contexts efficient.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN,
    benchmark: { cbaElo: 1458 }, // lmarena: deepseek-v4-pro
    chatPrice: { input: 1.74, output: 3.48, cache: { cType: 'oai-ac', read: 0.145 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    pubDate: '20260424',
    description: 'Streamlined DeepSeek open MoE tuned for low-latency, high-throughput inference at 1M-token context, retaining most of Pro reasoning and coding quality.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN,
    benchmark: { cbaElo: 1436 }, // lmarena: deepseek-v4-flash
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.028 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k2p6',
    label: 'Kimi K2.6 (Vision)',
    pubDate: '20260417',
    description: 'Moonshot AI native-multimodal agentic model tuned for long-horizon coding, autonomous execution, and swarm task orchestration.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION,
    benchmark: { cbaElo: 1461 }, // lmarena: kimi-k2.6
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.16 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/minimax-m2p7',
    label: 'MiniMax M2.7',
    pubDate: '20260411',
    description: 'MiniMax MoE built for complex agent harnesses and elaborate productivity tasks, leveraging Agent Teams, Skills, and dynamic tool search.',
    contextWindow: 196_608, // 192K
    interfaces: IF_CHAT_FN,
    benchmark: { cbaElo: 1417 }, // lmarena: minimax-m2.7
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.06 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/glm-5p1',
    label: 'GLM 5.1',
    pubDate: '20260327',
    description: 'Z.ai 754B-parameter MoE built for agentic engineering, with strong coding and sustained performance across long multi-round tasks.',
    contextWindow: 202_752, // ~198K
    interfaces: IF_CHAT_FN,
    benchmark: { cbaElo: 1469 }, // lmarena: glm-5.1
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.26 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    pubDate: '20250804',
    description: 'OpenAI open-weight model for high-reasoning, agentic, general-purpose use that fits on a single H100.',
    contextWindow: 131_072, // 128K
    interfaces: IF_CHAT_FN,
    chatPrice: { input: 0.15, output: 0.60, cache: { cType: 'oai-ac', read: 0.015 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    pubDate: '20250804',
    description: 'OpenAI smaller open-weight model for lower-latency, local, and specialized use cases.',
    contextWindow: 131_072, // 128K
    interfaces: [LLM_IF_OAI_Chat], // no tools on Fireworks (supports_tools=false)
    chatPrice: { input: 0.07, output: 0.30, cache: { cType: 'oai-ac', read: 0.035 } },
  },
]);

const _fireworksDenyListContains: string[] = [
  // 'kimi-k2p5', // deprecated 2026-06-16 (Fireworks control-plane deprecationDate); still listed serverless but retired, and absent from the pricing table
];


// Fireworks slugs use 'p' as a decimal point (llama-v3p1 = v3.1, glm-5p2 = 5.2) and the OpenAI-compat API
// returns no display name, so we synthesize one from the id. Known acronyms/creators are cased explicitly;
// version/size tokens (v4, 5.2, 120b) are uppercased; everything else is Title-cased.
const _FW_ACRONYMS = new Set(['glm', 'gpt', 'oss', 'ai', 'llm', 'moe', 'vl', 'hf']);
const _FW_WORDCASE: Record<string, string> = { deepseek: 'DeepSeek', kimi: 'Kimi', qwen: 'Qwen', llama: 'Llama', mixtral: 'Mixtral', mistral: 'Mistral' };

function _prettyFireworksPiece(piece: string): string {
  const lower = piece.toLowerCase();
  if (_FW_WORDCASE[lower]) return _FW_WORDCASE[lower];
  if (_FW_ACRONYMS.has(lower)) return piece.toUpperCase();
  // known word glued to its version, with no separator to split on: 'qwen3.7' -> 'Qwen3.7' (not 'QWEN3.7')
  const glued = /^([a-z]+)([\d.]+[a-z]*)$/.exec(lower);
  if (glued && (_FW_WORDCASE[glued[1]] || _FW_ACRONYMS.has(glued[1])))
    return (_FW_WORDCASE[glued[1]] || glued[1].toUpperCase()) + glued[2].toUpperCase();
  if (/\d/.test(piece)) return piece.toUpperCase(); // versions/sizes: v4 -> V4, 120b -> 120B, 5.2 stays 5.2
  return serverCapitalizeFirstLetter(piece);
}

function _prettyModelId(id: string, isVision: boolean): string {
  // example: "accounts/fireworks/models/llama-v3p1-405b-instruct" => "Fireworks · Llama V3.1 405B"
  let prettyName = id
    .replace(/^accounts\//, '') // remove the leading "accounts/" if present
    .replace(/\/(models|routers)\//, ' · ') // turn the next "/models/" (or "/routers/", the fast/turbo serving tiers) into " · "
    .replace(/(\d)p(\d)/g, '$1.$2') // Fireworks slug convention: 'p' between digits is a decimal point (5p2 -> 5.2)
    .replaceAll(/[_-]/g, ' ') // replace underscores or dashes with spaces
    .split(' ')
    .filter(piece => piece !== 'instruct')
    .map(_prettyFireworksPiece)
    .join(' ')
    .replaceAll('/', ' · ') // replace any additional slash with " · "
    .replace('Fireworks · ', '') // remove any stray prefix - we don't need it here
    .trim();
  // add "Vision" to the name if it's a vision model
  if (isVision && !id.includes('-vision'))
    prettyName += ' Vision';
  prettyName = prettyName.replace(' Vision', ' (Vision)');
  return prettyName;
}


// Fallback description for un-curated models. The API has no marketing text, so we keep it clean and
// generic rather than exposing the raw enum ("fireworks `HF_BASE_MODEL` type."). Curated models in
// _fireworksKnownModels override this with an editorial description.
function _fireworksGenericDescription(kind: string | undefined): string {
  switch (kind) {
    case 'HF_BASE_MODEL': return 'Open-weights model served on Fireworks AI.';
    case 'HF_PEFT_ADDON': return 'Fine-tuned adapter served on Fireworks AI.';
    case 'FLUMINA_BASE_MODEL': return 'Image model served on Fireworks AI.';
    default: return 'Model served on Fireworks AI.';
  }
}


export function fireworksAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  return wireFireworksAIListOutputSchema
    .parse(wireModels)

    .filter((model) => {
      // filter-out non-llms
      if (model.supports_chat === false)
        return false;

      // embedding/reranker models are listed with supports_chat=true (qwen3-embedding-8b, qwen3-reranker-8b): 'kind' is the reliable signal
      if (model.kind === 'EMBEDDING_MODEL')
        return false;

      return !_fireworksDenyListContains.some(contains => model.id.includes(contains));
    })

    .map((model): ModelDescriptionSchema => {

      // heuristics
      const label = _prettyModelId(model.id, !!model.supports_image_input);
      const description = _fireworksGenericDescription(model.kind);
      const contextWindow = model.context_length || null;
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
      if (model.supports_image_input)
        interfaces.push(LLM_IF_OAI_Vision);
      if (model.supports_tools)
        interfaces.push(LLM_IF_OAI_Fn);

      const md = fromManualMapping(_fireworksKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        // parameterSpecs: ...
        // maxCompletionTokens: ...
        // benchmark: ...
        // chatPrice,
        hidden: false,
      });

      // pubDate fallback: Fireworks' 'created' is verified real per-model release/index dates (unique,
      // 2024-2026 spread, not a constant), so derive a day-precision pubDate to drive the "new" badge for
      // models without an editorial pubDate. An editorial pubDate (from _fireworksKnownModels) always wins.
      if (md.pubDate === undefined && md.created)
        md.pubDate = formatPubDate(md.created);

      return md;
    })

    .sort((a: ModelDescriptionSchema, b: ModelDescriptionSchema): number => {
      if (a.created !== b.created)
        return (b.created || 0) - (a.created || 0);
      return a.id.localeCompare(b.id);
    });
}
