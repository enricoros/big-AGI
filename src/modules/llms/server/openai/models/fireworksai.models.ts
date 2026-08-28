import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { formatPubDate, fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- FireworksAI Model ID inference (auto-derived from _fireworksKnownModels) ---
export type LlmsFireworksAIModelId = typeof _fireworksKnownModels[number]['idPrefix'];
import { wireFireworksAIListOutputSchema } from '../wiretypes/fireworksai.wiretypes';


export function fireworksAIHeuristic(hostname: string) {
  return hostname.includes('fireworks.ai/');
}


// Every model Fireworks curates for serverless today returns a `reasoning_content` sibling field on default settings
// (re-probed 2026-08-17, one arm each) - hence no non-reasoning shape here. Short budgets hide it: the field only
// materializes once the trace closes, so a truncated completion leaves the reasoning inline in `content`.
const IF_CHAT_FN_REASON = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning];
const IF_CHAT_FN_VISION_REASON = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning];

// [FireworksAI, 2026-08-17] Ladders re-ablated on this host (the 'openai' dialect passthrough; temperature 0, n=3 per arm,
// read off reasoning_content length + the prompt-token template fingerprint). Binary shape: 'none' cleanly disables thinking
// (no reasoning_content, the completion collapses to the bare answer) and every other accepted value is one tier - kimi-k3 and
// kimi-k2.7-code (+ their Fast routers), minimax-m3, qwen3.7-plus, and both Nemotrons. On qwen3.7-plus 'max' and 'xhigh' are
// accepted but return the same trace as 'high', so the ladder stops at 'high'. Left without a spec on purpose: inkling ('none'
// is accepted but not honored - same trace length as Default), minimax-m2.7 ('none' 400s, "requires reasoning to be enabled"),
// kimi-k2.6 ('none' drops the reasoning_content split but the model keeps reasoning, now as prose inside content - strictly
// worse than Default).
const _PS_Thinking: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high'] },
] as const;

// Editorial curation of the serverless-deployable chat models on the 'fireworks' account.
// The OpenAI-compat /inference/v1/models endpoint returns NO display name, description, or price, so
// without this every model falls back to the id-derived label (see _prettyModelId) and an "owned_by kind"
// description. Labels/descriptions/creators are lifted from Fireworks' control-plane API
// (GET /v1/accounts/fireworks/models/{id}: displayName, description, huggingFaceUrl); Standard-tier prices
// from https://docs.fireworks.ai/serverless/pricing (input / cached-input / output per 1M tokens); models the
// docs table omits are priced off their model page (https://app.fireworks.ai/models/fireworks/{id}).
// Un-curated / future models still render via _prettyModelId + the fromManualMapping '[?]' fallback.
// 2026-08-28 pass: live list = 26 ids (24 after the embedding filter), all curated. Added glm-5.3 + glm-5.3-flash;
// both qwen3.8 ids now take image input. No retirements, no price drift (deepseek-v4-pro-0813 joined the docs table
// at the numbers we already had). Serverless ids 404 intermittently on cold paths - capacity, not a delisting.
const _fireworksKnownModels = llmsDefineManualMappings([
  {
    // Unpriced on purpose: absent from the docs pricing table and from the control-plane catalog. Vision live-verified.
    idPrefix: 'accounts/fireworks/models/glm-5p3-flash',
    label: 'GLM 5.3 Flash (Vision)',
    pubDate: '20260825', // = zai.models.ts 'glm-5.3-flash'
    description: 'First natively-multimodal model of the GLM-5 line: a 320B MoE (18B active) on a new base with hybrid sparse and linear attention, image input, and a 1M-token context.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // thinking compulsory ('none' 400s); n=6/arm: low ~0.18K chars, high ~0.25K, medium = xhigh = max = Default ~1.7K
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high'] }],
  },
  {
    idPrefix: 'accounts/fireworks/models/glm-5p3',
    label: 'GLM 5.3',
    pubDate: '20260814', // = zai.models.ts 'glm-5.3' (upstream release; the Fireworks listing is 20260828)
    description: 'Z.ai flagship, post-trained on the GLM-5.2 base for frontier coding, cybersecurity and long-horizon agentic work, with a 1M-token context.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON, // text-only, like Z.ai's own serving
    // thinking compulsory ('none' -> 400 "thinking-only model"); n=4/arm: low ~0.17K chars, medium = high ~0.25K, xhigh = Default ~5.5K, max ~8.3K
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high', 'max'] }],
    benchmark: { cbaElo: 1487 }, // lmarena: glm-5.3-max
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.26 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-pro-0813',
    label: 'DeepSeek V4 Pro 0813',
    pubDate: '20260813',
    description: 'Official release of DeepSeek V4 Pro, superseding the preview, with greatly enhanced agentic capabilities, most pronounced in production environments. Ships with a DSpark speculative decoding module attached.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    // [2026-08-14, all V4 ids] 'none' hard-off, low/high/max scale the trace; medium/xhigh/budgets also accepted - DeepSeek-direct tiers kept for UI parity
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    benchmark: { cbaElo: 1458 }, // lmarena: deepseek-v4-pro (the board's -max-20260813 row is AutoEval-only and unranked - same call as alibaba.models.ts / deepseek.models.ts)
    chatPrice: { input: 1.32, output: 3.96, cache: { cType: 'oai-ac', read: 0.044 } }, // the docs pricing table now carries this id, at the model-page numbers (2026-08-28)
  },
  {
    // NOTE: listed with supports_image_input=false, yet reads images (live-verified 2026-08-28) - it shares the
    // qwen3p8-max deployment, so Vision is declared explicitly here. Alibaba's own serving of these weights is text-only.
    idPrefix: 'accounts/fireworks/models/qwen3p8-2p4t-a95b',
    label: 'Qwen3.8 2.4T-A95B (Vision)',
    pubDate: '20260812',
    description: 'Open-weights release of the Qwen3.8 flagship: 2.4T sparse MoE with ~95B active parameters, built for multi-day coding runs and self-improving research.',
    contextWindow: 262_144, // 256K - the native window; Alibaba's own serving extends it to 1M, Fireworks does not
    interfaces: IF_CHAT_FN_VISION_REASON,
    // [2026-08-17] unlike Alibaba's own serving, 'none' works (drops the thinking template); low ~0.9K chars, medium ~1.5K, high = xhigh = max = Default ~7K -> Off/Low/High
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high'] }],
    chatPrice: { input: 2.00, output: 6.00, cache: { cType: 'oai-ac', read: 0.25 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b',
    label: 'NVIDIA Nemotron 3.5 Lightning 30B A3B',
    pubDate: '20260811',
    description: 'NVIDIA hybrid Mamba-Transformer MoE (30B params, 3B active) with a multi-token prediction head, for low-latency agentic serving at long context.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_REASON,
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1348 }, // lmarena: nvidia-nemotron-3.5-lightning-30b-a3b-nvfp4
    chatPrice: { input: 0.05, output: 0.20, cache: { cType: 'oai-ac', read: 0.01 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/muse-glimmer-30b',
    label: 'Muse Glimmer 30B (Vision)',
    pubDate: '20260810',
    description: 'Meta dense 30B distilled from Muse Spark for local agentic work: multi-step reasoning, schema-based tool calling, and image input across 100+ languages.',
    contextWindow: 131_072, // 128K (max_model_len, live-probed)
    interfaces: IF_CHAT_FN_VISION_REASON,
    // 'minimal' 400s; low ~0.8K chars, medium ~1.6K, high = xhigh = max = Default ~2.5K. 'none' is accepted but NOT honored, so not offered
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high'] }],
    benchmark: { cbaElo: 1426 }, // lmarena: muse-glimmer
    chatPrice: { input: 0.35, output: 1.50, cache: { cType: 'oai-ac', read: 0.04 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-flash-0731',
    label: 'DeepSeek V4 Flash 0731',
    pubDate: '20260731',
    description: 'Official release of DeepSeek V4 Flash, superseding the preview, with substantially enhanced agentic capabilities. Ships with a speculative decoding module attached.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    benchmark: { cbaElo: 1435 }, // lmarena: deepseek-v4-flash (distinct from the -high-preview row, 1438)
    chatPrice: { input: 0.22, output: 0.66, cache: { cType: 'oai-ac', read: 0.007 } }, // repriced 2026-08-24 (docs table; was 0.14 / 0.028 / 0.28)
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k3',
    label: 'Kimi K3 (Vision)',
    pubDate: '20260716', // = moonshot.models.ts 'kimi-k3' (upstream release; the Fireworks listing was 20260719)
    description: 'Moonshot AI 2.8T-parameter flagship on Kimi Delta Attention, with native visual understanding and a 1M-token context for long-horizon coding and reasoning.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1489 }, // lmarena: kimi-k3-max
    chatPrice: { input: 3.00, output: 15.00, cache: { cType: 'oai-ac', read: 0.30 } },
  },
  {
    idPrefix: 'accounts/fireworks/routers/kimi-k3-fast',
    label: 'Kimi K3 Fast (Vision)',
    pubDate: '20260716', // = moonshot.models.ts 'kimi-k3'
    description: 'Fast serving path for Kimi K3: same model and quality, lower latency, higher per-token price.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking, // parity with the base id confirmed (same ladder fingerprint)
    chatPrice: { input: 4.50, output: 22.50, cache: { cType: 'oai-ac', read: 0.45 } },
  },
  {
    // Image input works as of 2026-08-28 (live-verified), reversing the 2026-08-17 probe where the endpoint answered
    // "This model does not support image inputs". Same deployment as qwen3p8-2p4t-a95b (same HF repo, price, ladder).
    idPrefix: 'accounts/fireworks/models/qwen3p8-max',
    label: 'Qwen3.8 Max (Vision)',
    pubDate: '20260719',
    description: 'Alibaba flagship Qwen3.8 tier, available outside Alibaba infrastructure through Fireworks AI.',
    contextWindow: null, // not published by Fireworks
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high'] }],
    benchmark: { cbaElo: 1491 }, // lmarena: qwen3.8-max
    chatPrice: { input: 2.00, output: 6.00, cache: { cType: 'oai-ac', read: 0.25 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/inkling',
    label: 'Inkling (Vision)',
    pubDate: '20260714',
    description: 'Thinking Machines Lab first open-weights model: a 975B MoE (41B active) trained natively across text, image, and audio, with controllable thinking effort.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    benchmark: { cbaElo: 1442 }, // lmarena: inkling
    chatPrice: { input: 1.00, output: 4.05, cache: { cType: 'oai-ac', read: 0.17 } }, // model page only - still absent from the serverless pricing table
  },
  {
    idPrefix: 'accounts/fireworks/models/glm-5p2',
    label: 'GLM 5.2',
    pubDate: '20260616',
    description: 'Z.ai flagship with 1M-token context and multi-effort coding for long-horizon agentic tasks. New IndexShare architecture and improved MTP layer cut per-token compute.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    // [2026-08-16] ablated: 'none' hard-off, low = medium = high (~1.2K chars), xhigh = max = default (~2.5K) - Z.ai's native 5.2 mapping; 'minimal' 400s
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] }],
    benchmark: { cbaElo: 1471 }, // lmarena: glm-5.2-max
    chatPrice: { input: 1.40, output: 4.40, cache: { cType: 'oai-ac', read: 0.14 } }, // re-verified 2026-08-17
  },
  {
    idPrefix: 'accounts/fireworks/routers/glm-5p2-fast',
    label: 'GLM 5.2 Fast',
    pubDate: '20260616',
    description: 'Fast serving path for GLM 5.2: same model and quality, lower latency, higher per-token price.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] }], // parity with glm-5p2 confirmed (router echoes it)
    chatPrice: { input: 2.10, output: 6.60, cache: { cType: 'oai-ac', read: 0.21 } }, // re-verified 2026-08-17 ('GLM 5.2 Fast US' router: same price, not in /inference/v1/models)
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k2p7-code',
    label: 'Kimi K2.7 Code (Vision)',
    pubDate: '20260612',
    description: 'Coding-focused agentic model built on Kimi K2.6, with better end-to-end completion on long-horizon software engineering and ~30% fewer thinking tokens.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking,
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.19 } },
  },
  {
    idPrefix: 'accounts/fireworks/routers/kimi-k2p7-code-fast',
    label: 'Kimi K2.7 Code Fast (Vision)',
    pubDate: '20260612',
    description: 'Fast serving path for Kimi K2.7 Code: same model and quality, lower latency, higher per-token price.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking, // parity with the base id confirmed
    chatPrice: { input: 1.90, output: 8.00, cache: { cType: 'oai-ac', read: 0.38 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/minimax-m3',
    label: 'MiniMax M3',
    pubDate: '20260601', // = minimax.models.ts 'MiniMax-M3' (upstream release, not the Fireworks listing)
    description: 'MiniMax 428B MoE (23B active) with Sparse Attention for efficient long context, tuned for long-horizon agentic coding and cowork.',
    contextWindow: 512_000, // 500K
    interfaces: IF_CHAT_FN_REASON, // native multimodal upstream, but Fireworks serves it text-only (supports_image_input=false)
    parameterSpecs: _PS_Thinking, // 'adaptive' is also accepted here (Fireworks: "only supported by MiniMax M3"), but it is not an llmVndMiscEffort value
    benchmark: { cbaElo: 1444 }, // lmarena: minimax-m3
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.06 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/qwen3p7-plus',
    label: 'Qwen3.7 Plus (Vision)',
    pubDate: '20260601', // = alibaba.models.ts 'qwen3.7-plus' (upstream release, not the Fireworks listing)
    description: 'Alibaba flagship closed model, available outside Alibaba infrastructure exclusively through Fireworks AI.',
    contextWindow: null, // not published by Fireworks
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking, // 'max'/'xhigh' are accepted but indistinguishable from 'high' (live-probed 2026-08-17), so the ladder stops at 'high'
    benchmark: { cbaElo: 1458 }, // lmarena: qwen3.7-plus
    chatPrice: { input: 0.40, output: 1.60, cache: { cType: 'oai-ac', read: 0.08 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/nemotron-3-ultra-nvfp4',
    label: 'NVIDIA Nemotron 3 Ultra NVFP4',
    pubDate: '20260604', // = nvidianim.models.ts 'nvidia/nemotron-3-ultra-550b-a55b' (NVIDIA HF card: 'Release Date: 06/04/2026 via Hugging Face'; the Computex announce was 06-01, weights and NIM followed on 06-04)
    description: 'NVIDIA frontier-scale hybrid LatentMoE (550B params, 55B active) interleaving Mamba-2 and MoE layers, for multi-step agents and long-context reasoning.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_REASON,
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1427 }, // lmarena: nvidia-nemotron-3-ultra-550b-a55b-nvfp4
    chatPrice: { input: 0.60, output: 2.40, cache: { cType: 'oai-ac', read: 0.12 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    pubDate: '20260424',
    description: 'DeepSeek flagship open MoE (1.6T params) for frontier reasoning, coding, and long-context work up to 1M tokens. Hybrid attention keeps long contexts efficient.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    benchmark: { cbaElo: 1458 }, // lmarena: deepseek-v4-pro
    chatPrice: { input: 1.74, output: 3.48, cache: { cType: 'oai-ac', read: 0.145 } },
  },
  // 'accounts/fireworks/models/deepseek-v4-flash': the undated April checkpoint retired from serverless (control-plane
  // deprecationDate 2026-08-14 + supportsServerless=false, absent from /inference/v1/models, generation 404s, 2026-08-17)
  // - superseded by the -0731 id above, which is what the pricing table now calls 'DeepSeek V4 Flash (0731)'
  {
    idPrefix: 'accounts/fireworks/models/kimi-k2p6',
    label: 'Kimi K2.6 (Vision)',
    pubDate: '20260420', // = moonshot.models.ts 'kimi-k2.6' (upstream release, not the Fireworks listing)
    description: 'Moonshot AI native-multimodal agentic model tuned for long-horizon coding, autonomous execution, and swarm task orchestration.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION_REASON,
    benchmark: { cbaElo: 1461 }, // lmarena: kimi-k2.6
    chatPrice: { input: 0.95, output: 4.00, cache: { cType: 'oai-ac', read: 0.16 } },
  },
  {
    // NOTE: the only serving tier named '-turbo' instead of '-fast'; the pricing table calls it 'Kimi K2.6 Fast'
    idPrefix: 'accounts/fireworks/routers/kimi-k2p6-turbo',
    label: 'Kimi K2.6 Fast (Vision)',
    pubDate: '20260420', // = moonshot.models.ts 'kimi-k2.6'
    description: 'Fast serving path for Kimi K2.6: same model and quality, lower latency, higher per-token price.',
    contextWindow: 262_144, // 256K
    interfaces: IF_CHAT_FN_VISION_REASON,
    chatPrice: { input: 2.00, output: 8.00, cache: { cType: 'oai-ac', read: 0.30 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/minimax-m2p7',
    label: 'MiniMax M2.7',
    pubDate: '20260318', // = minimax.models.ts 'MiniMax-M2.7' (upstream API launch; the open weights followed on 20260409)
    description: 'MiniMax MoE built for complex agent harnesses and elaborate productivity tasks, leveraging Agent Teams, Skills, and dynamic tool search.',
    contextWindow: 196_608, // 192K
    interfaces: IF_CHAT_FN_REASON,
    benchmark: { cbaElo: 1416 }, // lmarena: minimax-m2.7
    chatPrice: { input: 0.30, output: 1.20, cache: { cType: 'oai-ac', read: 0.06 } },
  },
  // 'accounts/fireworks/models/glm-5p1': retired from serverless (absent from /inference/v1/models, control plane supportsServerless=false, 2026-08-15); pricing page still lists it
  {
    idPrefix: 'accounts/fireworks/models/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    pubDate: '20250805', // = groq/cerebras/nvidianim/together 'gpt-oss-120b'
    description: 'OpenAI open-weight model for high-reasoning, agentic, general-purpose use that fits on a single H100.',
    contextWindow: 131_072, // 128K
    interfaces: IF_CHAT_FN_REASON,
    // [2026-08-17] native OpenAI ladder, strictly validated ('none'/'max' -> 400); tiers real (~0.5K chars low vs ~3.7K high)
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }],
    benchmark: { cbaElo: 1352 }, // lmarena: gpt-oss-120b
    chatPrice: { input: 0.15, output: 0.60, cache: { cType: 'oai-ac', read: 0.015 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    pubDate: '20250805', // = groq/nvidianim/together 'gpt-oss-20b'
    description: 'OpenAI smaller open-weight model for lower-latency, local, and specialized use cases.',
    contextWindow: 131_072, // 128K
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning], // no tools on Fireworks (supports_tools=false)
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }],
    benchmark: { cbaElo: 1318 }, // lmarena: gpt-oss-20b
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
