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
    idPrefix: 'accounts/fireworks/models/glm-5p2',
    label: 'GLM 5.2',
    pubDate: '20260616',
    description: 'Z.ai flagship with 1M-token context and multi-effort coding for long-horizon agentic tasks. New IndexShare architecture and improved MTP layer cut per-token compute.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN,
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.14 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    pubDate: '20260424',
    description: 'DeepSeek flagship open MoE (1.6T params) for frontier reasoning, coding, and long-context work up to 1M tokens. Hybrid attention keeps long contexts efficient.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN,
    chatPrice: { input: 1.74, output: 3.48, cache: { cType: 'oai-ac', read: 0.145 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k2p6',
    label: 'Kimi K2.6 (Vision)',
    pubDate: '20260417',
    description: 'Moonshot AI native-multimodal agentic model tuned for long-horizon coding, autonomous execution, and swarm task orchestration.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION,
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.16 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/glm-5p1',
    label: 'GLM 5.1',
    pubDate: '20260327',
    description: 'Z.ai 754B-parameter MoE built for agentic engineering, with strong coding and sustained performance across long multi-round tasks.',
    contextWindow: 202_752, // ~198K
    interfaces: IF_CHAT_FN,
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
  if (/\d/.test(piece)) return piece.toUpperCase(); // versions/sizes: v4 -> V4, 120b -> 120B, 5.2 stays 5.2
  return serverCapitalizeFirstLetter(piece);
}

function _prettyModelId(id: string, isVision: boolean): string {
  // example: "accounts/fireworks/models/llama-v3p1-405b-instruct" => "Fireworks · Llama V3.1 405B"
  let prettyName = id
    .replace(/^accounts\//, '') // remove the leading "accounts/" if present
    .replace(/\/models\//, ' · ') // turn the next "/models/" into " · "
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
