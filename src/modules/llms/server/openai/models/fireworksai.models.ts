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
// (no reasoning_content, the completion collapses to the bare answer) and every other accepted value is one tier - kimi-k3
// (+ its Fast router), ember-1, minimax-m3, both Nemotrons, hy4-flash and inkling-2-small.
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
// Serverless ids 404 intermittently on cold paths - capacity, not a delisting: re-probe before retiring an id.
const _fireworksKnownModels = llmsDefineManualMappings([
  {
    idPrefix: 'accounts/fireworks/models/qwen4-max',
    label: 'Qwen4 Max (Vision)',
    pubDate: '20261116', // = alibaba.models.ts 'qwen4-max' (upstream release; the Fireworks listing is 20261123)
    description: 'Alibaba flagship of the Qwen4 series: a ~2.7T-parameter sparse MoE with image input and controllable thinking, for coding and complex agentic tasks.',
    contextWindow: 262_144, // 256K on Fireworks - Alibaba's own serving is 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // 'none' hard-off; low < high < max by trace length (minimal = low, medium = high, xhigh = max). Default may skip thinking
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    chatPrice: { input: 1.50, output: 4.50, cache: { read: 0.075 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/hy4-flash',
    label: 'Hy4 Flash (Vision)',
    pubDate: '20261116', // no publisher catalog: OpenRouter listing date
    description: 'Tencent most cost-efficient Hy4 model: a 220B MoE (~12B active) with image input, for document processing, deep search, slide creation and computer use.',
    contextWindow: 262_144, // 256K on Fireworks (the model card claims up to 512K)
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking, // 'none' hard-off; low/high/max = Default
    chatPrice: { input: 0.07, output: 0.281, cache: { read: 0.003 } }, // model page only - absent from the serverless pricing table
  },
  {
    // NOTE: listed with supports_chat=false, supports_image_input=false and supports_tools=false (the model page also
    // says "Function Calling Not Supported"), yet it serves chat, reads images (prompt tokens scale with image size) and calls tools
    idPrefix: 'accounts/fireworks/models/inkling-2-small',
    label: 'Inkling 2 Small (Vision)',
    pubDate: '20261109', // = together.models.ts 'thinkingmachines/Inkling-2-Small'
    description: 'Thinking Machines Lab second-generation open-weights model: a 594B multimodal MoE (17B active) for agentic and tool-use applications, with a 1M-token context.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking, // 'none' hard-off; low/high/max show no tier order
    chatPrice: { input: 0.30, output: 1.00, cache: { read: 0.03 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/glm-5p3-flash',
    label: 'GLM 5.3 Flash (Vision)',
    pubDate: '20260825', // = zai.models.ts 'glm-5.3-flash'
    description: 'First natively-multimodal model of the GLM-5 line: a 320B MoE (18B active) on a new base with hybrid sparse and linear attention, image input, and a 1M-token context.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // thinking compulsory ('none' 400s); n=6/arm: low ~0.18K chars, high ~0.25K, medium = xhigh = max = Default ~1.7K
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high'] }],
    benchmark: { cbaElo: 1477 }, // lmarena: glm-5.3-flash
    chatPrice: { input: 0.15, output: 0.50, cache: { read: 0.03 } }, // joined the docs pricing table by 2026-08-31 (was unpriced at launch)
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
    chatPrice: { input: 1.40, output: 4.40, cache: { read: 0.26 } },
  },
  {
    idPrefix: 'accounts/fireworks/routers/glm-5p3-fast',
    label: 'GLM 5.3 Fast',
    pubDate: '20260814', // = glm-5p3
    description: 'Fast serving path for GLM 5.3: same model and quality, lower latency, higher per-token price.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    // same ladder as glm-5p3 (the router echoes it): 'none' 400s "thinking-only model", medium = high, xhigh = max = default
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high', 'max'] }],
    chatPrice: { input: 2.10, output: 6.60, cache: { read: 0.39 } },
  },
  {
    idPrefix: 'accounts/fireworks/routers/glm-5p3-spot',
    label: 'GLM 5.3 Spot',
    pubDate: '20260814', // = glm-5p3
    description: 'Spot serving path for GLM 5.3: same model at 30% lower price, on best-effort capacity that can drop to zero.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['low', 'high', 'max'] }], // same ladder as glm-5p3 ('none' 400s "thinking-only model")
    chatPrice: { input: 0.98, output: 3.08, cache: { read: 0.182 } }, // Spot = Standard less 30% (docs: guides/spot-serverless)
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
    chatPrice: { input: 2.00, output: 6.00, cache: { read: 0.25 } },
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
    chatPrice: { input: 0.05, output: 0.20, cache: { read: 0.01 } },
    hidden: true, // serverless shutdown announced for 2026-11-07 (docs changelog), yet still served and in the pricing table
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4p1-flash-1017',
    label: 'DeepSeek V4.1 Flash 1017 (Vision)',
    pubDate: '20261017', // upstream HF release; Fireworks listed it the same day
    description: 'Post-training update of DeepSeek V4.1 Flash (552B multimodal MoE, 1M-token context): stronger reasoning, coding, agentic and visual results with shorter outputs.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON, // image input (OCR) and tool calls live-verified 2026-10-21
    // 2026-10-21, n=2/arm: 'none' hard-off (0 reasoning tokens); low/high/max accepted, gaps within noise on its short traces - family ladder kept
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    benchmark: { cbaElo: 1476 }, // lmarena: deepseek-v4.1-flash-20260910-max (0910 checkpoint; no 1017 row)
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.006 } }, // same card as deepseek-v4p1-flash
  },
  {
    idPrefix: 'accounts/fireworks/routers/deepseek-v4p1-flash-1017-ultrafast',
    label: 'DeepSeek V4.1 Flash 1017 Ultra-fast (Vision)',
    pubDate: '20261017', // = deepseek-v4p1-flash-1017
    description: 'Ultra-fast serving path (preview) for DeepSeek V4.1 Flash 1017: same model and quality at 6-8x generation speed, 4x the per-token price.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // 'none' hard-off (0 reasoning tokens); low < medium = xhigh = high < max, Default between high and max
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    chatPrice: { input: 1.20, output: 4.80, cache: { read: 0.024 } },
  },
  {
    idPrefix: 'accounts/fireworks/routers/deepseek-v4p1-flash-1017-spot',
    label: 'DeepSeek V4.1 Flash 1017 Spot (Vision)',
    pubDate: '20261017', // = deepseek-v4p1-flash-1017
    description: 'Spot serving path for DeepSeek V4.1 Flash 1017: same model at 30% lower price, on best-effort capacity that can drop to zero.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }], // same ladder as the base id ('none' hard-off)
    chatPrice: { input: 0.21, output: 0.84, cache: { read: 0.0042 } }, // Spot = Standard less 30% (docs: guides/spot-serverless)
  },
  {
    idPrefix: 'accounts/fireworks/models/deepseek-v4p1-flash',
    label: 'DeepSeek V4.1 Flash (Vision)',
    pubDate: '20260910', // V4.1-Flash GA (upstream release; Fireworks listed it the same day)
    description: 'DeepSeek multimodal MoE (552B, 8B active on input) with native image input and a 1M-token context; ahead of V4 Pro on agentic benchmarks at a fraction of the price.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON, // image input live-verified 2026-09-12
    // 2026-09-12, one arm each: 'none' hard-off (0 reasoning tokens); low/high/max accepted - tiers per the native docs, not re-measured here
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.006 } },
    hidden: true, // superseded by -1017 (same card); still served on the 0910 weights (control-plane HF URL unchanged, changelog: "not affected")
  },
  {
    idPrefix: 'accounts/fireworks/routers/deepseek-v4p1-flash-spot',
    label: 'DeepSeek V4.1 Flash Spot (Vision)',
    pubDate: '20260910', // = deepseek-v4p1-flash
    description: 'Spot serving path for DeepSeek V4.1 Flash: same model at 30% lower price, on best-effort capacity that can drop to zero.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }], // same ladder as the base id ('none' hard-off)
    chatPrice: { input: 0.21, output: 0.84, cache: { read: 0.0042 } }, // Spot = Standard less 30% (docs: guides/spot-serverless)
    hidden: true, // superseded by -1017-spot, like its base id
  },
  {
    idPrefix: 'accounts/fireworks/models/ember-1',
    label: 'Ember-1 (Vision)',
    pubDate: '20260922', // Fireworks control-plane createTime (Fireworks' own model, no upstream release)
    description: 'Fireworks reasoning model built on Kimi K3: ~40% fewer reasoning tokens at comparable quality, with image input and a 1M-token context.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking,
    chatPrice: { input: 3.00, output: 15.00, cache: { read: 0.30 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/kimi-k3p1-pro',
    label: 'Kimi K3.1 Pro (Vision)',
    pubDate: '20261023', // = moonshot.models.ts 'kimi-k3.1-pro' (upstream release; the Fireworks listing is 20261102)
    description: 'Moonshot AI flagship post-trained from Kimi K3 with large-scale joint RL: 2.8T MoE (104B active) with native image input and a 1M-token context, for coding and agentic work.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // 'none' hard-off (0 reasoning tokens); n=2/arm: low ~0.17K tokens, high ~0.44K, max = Default ~1.6K; medium not separable from high
    parameterSpecs: [{ paramId: 'llmVndMiscEffort', enumValues: ['none', 'low', 'high', 'max'] }],
    chatPrice: { input: 2.00, output: 10.00, cache: { read: 0.20 } },
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
    chatPrice: { input: 3.00, output: 15.00, cache: { read: 0.30 } },
  },
  {
    idPrefix: 'accounts/fireworks/routers/kimi-k3-fast',
    label: 'Kimi K3 Fast (Vision)',
    pubDate: '20260716', // = moonshot.models.ts 'kimi-k3'
    description: 'Fast serving path for Kimi K3: same model and quality, lower latency, higher per-token price.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    parameterSpecs: _PS_Thinking, // parity with the base id confirmed (same ladder fingerprint)
    chatPrice: { input: 4.50, output: 22.50, cache: { read: 0.45 } },
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
    chatPrice: { input: 2.00, output: 6.00, cache: { read: 0.25 } },
  },
  {
    idPrefix: 'accounts/fireworks/models/muse-spark-open',
    label: 'Muse Spark Open (Vision)',
    pubDate: '20261015', // = metaai.models.ts 'muse-spark-open'
    description: 'Meta open-weights reasoning model for coding and agentic workflows: an 816B sparse MoE (42B active) with tool calling, native image understanding and a 1M-token context.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // thinking compulsory ('none' 400s "disabling thinking ... is not supported"); n=3/arm: low ~0.6K tokens, medium ~0.8K, high = xhigh = max = Default ~1.3K
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }],
    chatPrice: { input: 1.25, output: 4.25, cache: { read: 0.15 } }, // US-only capacity, the 50% US premium waived
  },
  {
    idPrefix: 'accounts/fireworks/models/minimax-m3p1-flash',
    label: 'MiniMax M3.1 Flash (Vision)',
    pubDate: '20261019', // = minimax.models.ts 'MiniMax-M3.1-Flash'
    description: 'MiniMax natively multimodal MoE (~428B params, ~23B active) with a 1M-token context, built for agentic reasoning, tool use, coding and long-context work.',
    contextWindow: 1_048_576, // 1M
    interfaces: IF_CHAT_FN_VISION_REASON,
    // 'none' hard-off (0 reasoning tokens; MiniMax's own API rejects it); n=3/arm: low ~135 tokens, medium ~170, high = xhigh ~290, max = Default ~0.5-0.9K
    parameterSpecs: [{ paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high', 'max'] }],
    chatPrice: { input: 0.15, output: 0.60, cache: { read: 0.015 } }, // model page only - absent from the serverless pricing table
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
    chatPrice: { input: 0.30, output: 1.20, cache: { read: 0.06 } },
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
    chatPrice: { input: 0.60, output: 2.40, cache: { read: 0.12 } },
    hidden: true, // serverless shutdown announced for 2026-11-07 (docs changelog), yet still served and in the pricing table
  },
  {
    // Nexus Auto (formerly FireRouter, listed kind 'ROUTER'): each user turn goes to the open model predicted to handle it at the
    // lowest cost (closed models only with an x-anthropic-api-key / x-openai-api-key header, which we do not send); the response
    // 'model' names the server. Billed at the serving model's rate, hence no chatPrice. No effort spec: 'none' is not honored.
    idPrefix: 'auto',
    label: 'Nexus Auto (Vision)',
    description: 'Fireworks router that picks, for each user turn, the open model predicted to handle it well at the lowest cost, billed at that model\'s rate.',
    contextWindow: null, // not listed - depends on the serving model
    interfaces: IF_CHAT_FN_VISION_REASON,
  },
]);

const _fireworksDenyListContains: string[] = [
  // 'kimi-k2p5', // deprecated 2026-06-16 (Fireworks control-plane deprecationDate); still listed serverless but retired, and absent from the pricing table
];

// Exact ids that /inference/v1/models still returns although serving is gone (generation 404s, absent from the docs pricing table),
// or that still serve but are not offered (legacy aliases, retired models behind an old router).
const _fireworksDenyListExact: string[] = [
  'accounts/fireworks/models/glm-5p2', // decommissioned 2026-09-25 (docs changelog); control plane still says supportsServerless=true
  'accounts/fireworks/routers/glm-5p2-fast',
  'accounts/fireworks/routers/kimi-k3-spot', // in the Spot docs table, but 404 "not deployed" (Spot capacity can be zero: re-probe)
  'accounts/fireworks/models/gpt-oss-120b', // decommissioned 2026-11-07 (docs changelog); control plane supportsServerless=false
  'accounts/fireworks/models/inkling', // decommissioned 2026-11-07 (docs changelog; replacement: Muse Spark Open); control plane supportsServerless=false
  'accounts/fireworks/routers/spot-deepseek-v4-flash', // serves the retired DeepSeek V4 Flash (decommissioned 2026-09-25); absent from the Spot docs table
  'firerouter/auto', // legacy FireRouter alias of 'auto' (docs: use 'auto')
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
      // filter-out non-llms - curated ids pass: kimi-k3p1-pro, muse-spark-open, qwen4-max and inkling-2-small are listed supports_chat=false,
      // yet serve chat completions (rune, also supports_chat=false, truly does not: 400 "This model only serves /v1/systemone.")
      if (model.supports_chat === false && !_fireworksKnownModels.some(known => known.idPrefix === model.id))
        return false;

      // embedding/reranker models are listed with supports_chat=true (qwen3-embedding-8b, qwen3-reranker-8b): 'kind' is the reliable signal
      if (model.kind === 'EMBEDDING_MODEL')
        return false;

      if (_fireworksDenyListExact.includes(model.id))
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
