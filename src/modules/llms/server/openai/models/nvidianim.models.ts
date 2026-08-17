import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { llmDevCheckModels_DEV, llmsLabelUncurated } from '../../models.mappings';

// --- NVIDIA NIM Model ID inference (auto-derived from _knownNvidiaNIMModels) ---
export type LlmsNvidiaNIMModelId = typeof _knownNvidiaNIMModels[number]['id'];


/**
 * NVIDIA API Catalog (build.nvidia.com), served on integrate.api.nvidia.com - free, rate-limited (~40 RPM/account).
 *
 * CURATED TABLE, refreshed via `tools/develop/nvidianim-catalog-sync/` (see its README):
 * - `GET /v1/models` returns only ids (its `created` is a constant sentinel, `owned_by` mirrors the id prefix),
 *   and is a stale superset: ~half the listed ids are retired and hard-404. Ids resolve in 3 tiers:
 *   curated (full metadata below) > denied (harvest-verified dead/non-chat/EOL, dropped) > unknown
 *   (0-day arrivals: surfaced visible with a '[?]' label until the next harvest curates them -
 *   NVIDIA is frequently the first host of new open models, so day-0 access matters).
 * - Context windows below are MEASURED live against the endpoint (oversized-prompt probe), NOT taken from
 *   build.nvidia.com pages, which mis-state them on ~25% of models (in both directions, up to 8x).
 * - The catalog retires models about every 2 weeks: NGC publishes a DEPRECATION date, the id keeps serving
 *   until then, and on the date it drops out of `/v1/models` altogether - so a dated entry stops being
 *   listed without any edit here. Such entries carry an `// EOL <date>` marker and go on the next refresh.
 * - All models are served free of charge; NVIDIA's trial ToS allow prompt retention/training and disallow
 *   production use - surfaced to the user in the vendor setup UI.
 */

// [NVIDIA NIM, 2026-08-17] Harvest refresh - the catalog turned over hard since the 2026-07-25 run:
// - EOL 2026-08-24/25: NGC dates 13 curated ids for removal - most of the Llama 3.x tail, Nemotron Super v1/v1.5,
//   Nano 9B v2 / 12B VL / 30B, Nemotron Mini and glm-5.2. All but one still answer, so they are marked, not
//   deleted; llama-3.3-70b-instruct is already draining and is hidden.
// - Gone from /v1/models (410): deepseek-v4-pro, deepseek-v4-flash, mistral-medium-3.5-128b (defs kept, see the
//   tail of the table), plus ising-calibration-1-35b-a3b and qwen3.5-397b-a17b (deleted).
// - Added: nemotron-3.5-lightning-30b-a3b, muse-glimmer-30b, deepseek-v4-flash-0731 (NVIDIA's DeepSeek
//   replacement, and it gets the full 1M window the V4 Pro entry never had), riva-translate-4b-instruct-v2.
// - Re-measured windows moved on two models: nemotron-3-ultra 1000000 -> 1048576, minimax-m3 524288 -> 262144.
// - llama-guard-4-12b, mistral-nemotron and the small Llamas timed out for our key this run; kept as-is, since
//   a timeout on the free tier is not a retirement signal (only the NGC date and the listing are).

// Shared param specs
// - gpt-oss: native `reasoning_effort`, strictly validated to low|medium|high (verified: 'none'/'max' -> 400)
// - thinking models: binary toggle via `chat_template_kwargs` (see openai.chatCompletions.ts 'nvidianim' block);
//   pinned to ['none','high'] as depth control is unverified on NVIDIA's serving stacks
const _PS_OaiEffort = [{ paramId: 'llmVndOaiEffort' as const, enumValues: ['low', 'medium', 'high'] }];
const _PS_Thinking = [{ paramId: 'llmVndMiscEffort' as const, enumValues: ['none', 'high'] }];

const _freePrice: ModelDescriptionSchema['chatPrice'] = { input: 'free', output: 'free' };

type _NvidiaNIMModelDef = Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated' | 'pubDate'> & {
  id: string;
  pubDate: string; // REQUIRED on every entry (upstream model release date, not NVIDIA's onboarding date)
};

const _knownNvidiaNIMModels = [

  // --- NVIDIA Nemotron (first-party) ---
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    label: 'Nemotron 3 Ultra 550B',
    description: 'NVIDIA flagship open hybrid Mamba-Transformer MoE (550B, 55B active), 1M context, reasoning and tool use.',
    contextWindow: 1048576, // measured 2026-08-17 (1000000 on 2026-07-25 - NVIDIA raised it to the full 1Mi)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1427 - 2 }, // lmarena: nvidia-nemotron-3-ultra-550b-a55b-nvfp4 - 2 (free trial catalog: yield to paid hosts of the same weights - NVIDIA is the native vendor here)
    chatPrice: _freePrice,
    pubDate: '20260604',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    label: 'Nemotron 3 Super 120B',
    description: 'Open hybrid Mamba-Transformer MoE (120B, 12B active), 1M context, reasoning and tool use.',
    contextWindow: 1000000, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1360 - 2 }, // lmarena: nvidia-nemotron-3-super-120b-a12b - 2 (free trial catalog: yield to paid hosts of the same weights - NVIDIA is the native vendor here)
    chatPrice: _freePrice,
    pubDate: '20260311',
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    label: 'Nemotron 3.5 Lightning 30B',
    description: 'Fastest Nemotron MoE (30B, 3B active), 1M context, reasoning and tool use. Text only.',
    contextWindow: 1000000, // measured 2026-08-17 (build.nvidia.com advertises 1048576)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking, // verified 2026-08-17: chat_template_kwargs thinking:false zeroes reasoning_content
    benchmark: { cbaElo: 1348 - 2 }, // lmarena: nvidia-nemotron-3.5-lightning-30b-a3b-nvfp4 - 2 (free trial catalog: yield to paid hosts of the same weights - NVIDIA is the native vendor here)
    chatPrice: _freePrice,
    pubDate: '20260811', // harvest: catalog createdDate
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    label: 'Nemotron 3 Nano 30B',
    description: 'Efficient open MoE (30B, 3B active) for high-volume tasks, 1M context, reasoning and tool use. Retires on NVIDIA 2026-08-25.',
    contextWindow: 1000000, // measured 2026-08-17 (build.nvidia.com understates this as 256K)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20251215',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    label: 'Nemotron 3 Nano Omni 30B',
    description: 'Omni-modal Nemotron Nano (image, video and audio inputs), 1M context, reasoning.',
    contextWindow: 1000000, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260428',
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    label: 'Llama 3.3 Nemotron Super 49B v1.5',
    description: 'Llama 3.3 70B distilled and post-trained by NVIDIA for reasoning and agentic tasks. Retires on NVIDIA 2026-08-25.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20250725',
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/nvidia-nemotron-nano-9b-v2',
    label: 'Nemotron Nano 9B v2',
    description: 'Small hybrid Mamba-Transformer for fast, cheap reasoning and tool use. Retires on NVIDIA 2026-08-25.',
    contextWindow: 128000, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20250818',
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/nemotron-nano-12b-v2-vl',
    label: 'Nemotron Nano 12B v2 VL',
    description: 'Vision-language Nemotron Nano for image and video understanding (verified image input). Retires on NVIDIA 2026-08-25.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20251028',
  },

  // --- OpenAI open-weights ---
  {
    id: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    description: 'OpenAI open-weight MoE (117B, 5.1B active) with adjustable reasoning effort.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_OaiEffort,
    benchmark: { cbaElo: 1352 - 2 }, // lmarena: gpt-oss-120b - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20250805',
  },
  {
    id: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    description: 'OpenAI open-weight MoE (20B, 3.6B active) with adjustable reasoning effort.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_OaiEffort,
    benchmark: { cbaElo: 1318 - 2 }, // lmarena: gpt-oss-20b - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20250805',
  },

  // --- Third-party frontier open models ---
  {
    id: 'deepseek-ai/deepseek-v4-flash-0731',
    label: 'DeepSeek V4 Flash 0731',
    description: 'Fast DeepSeek V4 MoE (284B, 13B active) with the full 1M context and reasoning.',
    contextWindow: 1048576, // measured 2026-08-17 - the full native window, unlike the truncated V4 Pro that preceded it here
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking, // verified 2026-08-17: NVIDIA serves it with thinking OFF by default, thinking:true turns it on
    benchmark: { cbaElo: 1435 - 2 }, // lmarena: deepseek-v4-flash - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20260731', // the 0731 checkpoint; deepseek.models.ts carries 20260424 for the undated 'deepseek-v4-flash' id
  },
  {
    // EOL 2026-08-24 (NGC DEPRECATION)
    id: 'z-ai/glm-5.2',
    label: 'GLM 5.2',
    description: 'Zhipu GLM 5.2 reasoning model. NVIDIA serves a reduced 202K context (native: 1M). Retires on NVIDIA 2026-08-24.',
    contextWindow: 202749, // measured 2026-08-17 - NVIDIA truncates from the native 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1471 - 2 }, // lmarena: glm-5.2 (max) - 2 (yield to native vendor)
    chatPrice: _freePrice,
    initialTemperature: 1.0, // = zai.models.ts GLM-5.x family
    pubDate: '20260616', // = zai.models.ts 'glm-5.2'
  },
  {
    id: 'meta/muse-glimmer-30b',
    label: 'Muse Glimmer 30B',
    description: 'Meta open multimodal reasoning model (30B dense) distilled from Muse Spark, with tool calling. Always reasons.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    // no _PS_Thinking: verified 2026-08-17 that both chat_template_kwargs thinking:false and enable_thinking:false
    // are ignored here - reasoning_content comes back either way, so a toggle would lie
    benchmark: { cbaElo: 1426 - 2 }, // lmarena: muse-glimmer - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20260810', // harvest: catalog createdDate
  },
  {
    id: 'minimaxai/minimax-m3',
    label: 'MiniMax M3',
    description: 'MiniMax M3 reasoning model with image inputs. NVIDIA serves a reduced 256K context (native: 1M).',
    contextWindow: 262144, // measured 2026-08-17 (was 524288 on 2026-07-25) - NVIDIA halved its truncation of the native 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260601', // = minimax.models.ts 'MiniMax-M3'
  },
  {
    id: 'stepfun-ai/step-3.7-flash',
    label: 'Step 3.7 Flash',
    description: 'StepFun fast multimodal reasoning model, 256K context.',
    contextWindow: 262144, // measured 2026-07-25
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260529',
  },
  {
    id: 'google/gemma-4-31b-it',
    label: 'Gemma 4 31B',
    description: 'Google open multimodal model. CAUTION: NVIDIA serves 131K context and silently truncates longer inputs.',
    contextWindow: 131072, // measured 2026-07-25 - build.nvidia.com claims 262144 but the endpoint SILENTLY truncates at 131072
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    benchmark: { cbaElo: 1451 - 2 }, // lmarena: gemma-4-31b - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20260402', // = gemini.models.ts 'gemma-4-31b-it' (actual release; NVIDIA onboarding was later)
  },
  {
    id: 'thinkingmachines/inkling',
    label: 'Inkling',
    description: 'Thinking Machines reasoning model (preview). Can be unstable under load on the free endpoint.',
    contextWindow: 131072, // conservative: probes returned 500s before revealing the real limit (upstream claims 1M)
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260714', // = fireworksai.models.ts 'inkling' (upstream release, not the NVIDIA catalog date)
  },

  // --- Meta Llama ---
  {
    // EOL 2026-08-25 (NGC DEPRECATION), and already draining: no answer to a 4-token completion at 45s nor on
    // the 120s retry, re-probed independently at 60s - hidden so it stops being offered while it still resolves
    id: 'meta/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    description: 'Meta Llama 3.3 70B instruction-tuned, with tool calling. Retires on NVIDIA 2026-08-25 and is already unresponsive.',
    contextWindow: 131072, // measured 2026-07-25
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _freePrice,
    pubDate: '20241206', // = groq.models.ts 'llama-3.3-70b'
    hidden: true,
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    description: 'Small fast Llama for utility tasks, with tool calling. Retires on NVIDIA 2026-08-25.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _freePrice,
    pubDate: '20240723', // = groq.models.ts 'llama-3.1-8b'
  },

  // --- Hidden: alive but niche, superseded, unreliable, or non-chat ---
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'meta/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B',
    description: 'Meta Llama 3.1 70B instruction-tuned (superseded by Llama 3.3 70B).',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _freePrice,
    pubDate: '20240723',
    hidden: true,
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'meta/llama-3.2-1b-instruct',
    label: 'Llama 3.2 1B',
    description: 'Tiny Llama for edge-class tasks.',
    contextWindow: 131072, // measured 2026-07-25
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _freePrice,
    pubDate: '20240925',
    hidden: true,
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'meta/llama-3.2-3b-instruct',
    label: 'Llama 3.2 3B',
    description: 'Small Llama for lightweight tasks.',
    contextWindow: 131072, // measured 2026-07-25
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _freePrice,
    pubDate: '20240925',
    hidden: true,
  },
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    label: 'Llama 3.2 11B Vision',
    description: 'Llama vision model for image understanding.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: _freePrice,
    pubDate: '20240925',
    hidden: true,
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    label: 'Llama 3.2 90B Vision',
    description: 'Llama large vision model. NVIDIA serves a reduced 32K context (native: 128K).',
    contextWindow: 32768, // measured 2026-07-25 - 4x below the family baseline
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: _freePrice,
    pubDate: '20240925',
    hidden: true,
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    label: 'Llama 3.3 Nemotron Super 49B v1',
    description: 'Superseded by v1.5.',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20250318',
    hidden: true,
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    label: 'Nemotron Nano VL 8B',
    description: 'Small vision-language model, 16K context.',
    contextWindow: 16384, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: _freePrice,
    pubDate: '20250528',
    hidden: true,
  },
  {
    id: 'mistralai/mistral-nemotron',
    label: 'Mistral Nemotron',
    description: 'Mistral model post-trained by NVIDIA.',
    contextWindow: 262144,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20250611',
    hidden: true,
  },
  {
    id: 'poolside/laguna-xs-2.1',
    label: 'Laguna XS 2.1',
    description: 'Poolside compact coding-focused reasoning model. Can be slow to cold-start on the free endpoint.',
    contextWindow: 262144, // measured 2026-07-25
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260715', // harvest: catalog createdDate
    hidden: true,
  },
  {
    id: 'google/diffusiongemma-26b-a4b-it',
    label: 'DiffusionGemma 26B',
    description: 'Experimental diffusion language model. CAUTION: prone to hanging under load.',
    contextWindow: 250000, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260610',
    hidden: true, // 82% observed failure rate on our traffic (long hangs) - keep discoverable but not default
  },
  {
    // EOL 2026-08-25 (NGC DEPRECATION)
    id: 'nvidia/nemotron-mini-4b-instruct',
    label: 'Nemotron Mini 4B',
    description: 'Tiny legacy Nemotron, 4K context.',
    contextWindow: 4096, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _freePrice,
    pubDate: '20240910',
    hidden: true,
  },
  {
    id: 'nvidia/riva-translate-4b-instruct-v1.1',
    label: 'Riva Translate 4B v1.1',
    description: 'Translation-specialized model, 8K context.',
    contextWindow: 8192, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: _freePrice,
    pubDate: '20251212', // harvest: NGC dateCreated (first-party model, catalog date = release date)
    hidden: true,
  },
  {
    id: 'nvidia/riva-translate-4b-instruct-v2',
    label: 'Riva Translate 4B v2',
    description: 'Translation-specialized model (37 languages, few-shot prompting), 8K context.',
    contextWindow: 8192, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: _freePrice,
    pubDate: '20260727', // harvest: catalog createdDate (first-party model, catalog date = release date)
    hidden: true,
  },
  {
    id: 'nvidia/ising-calibration-1.5-31b',
    label: 'Ising Calibration 1.5 31B',
    description: 'NVIDIA quantum-calibration VLM, preview (domain-specific, not for general chat).',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: _freePrice,
    pubDate: '20260720',
    hidden: true,
  },
  // Guard/safety models - listed for programmatic users, hidden from the chat picker
  {
    id: 'meta/llama-guard-4-12b',
    label: 'Llama Guard 4 12B',
    description: 'Meta content-safety classifier (not a chat model). NVIDIA serves a reduced 64K context.',
    contextWindow: 65536, // measured 2026-07-25
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: _freePrice,
    pubDate: '20250429',
    hidden: true,
  },
  {
    id: 'nvidia/nemotron-3.5-content-safety',
    label: 'Nemotron 3.5 Content Safety',
    description: 'NVIDIA content-safety classifier (not a chat model).',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: _freePrice,
    pubDate: '20260602',
    hidden: true,
  },
  {
    id: 'nvidia/llama-3.1-nemoguard-8b-content-safety',
    label: 'NemoGuard 8B Content Safety',
    description: 'NVIDIA content-safety classifier (not a chat model).',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: _freePrice,
    pubDate: '20250116', // harvest: catalog createdDate
    hidden: true,
  },
  {
    id: 'nvidia/llama-3.1-nemoguard-8b-topic-control',
    label: 'NemoGuard 8B Topic Control',
    description: 'NVIDIA topic-control guardrail (not a chat model).',
    contextWindow: 131072, // measured 2026-08-17 (it probed as an error on 2026-07-25, hence the late curation)
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: _freePrice,
    pubDate: '20250116', // harvest: catalog createdDate
    hidden: true,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-safety-guard-8b-v3',
    label: 'Nemotron Safety Guard 8B v3',
    description: 'NVIDIA content-safety classifier (not a chat model).',
    contextWindow: 131072, // measured 2026-08-17
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: _freePrice,
    pubDate: '20251028', // harvest: catalog createdDate
    hidden: true,
  },

  // --- Delisted 2026-08-17: dropped from /v1/models and 410 Gone, so never emitted. These defs survive ONLY
  //     because model.domains.editorial.ts pins the ids by literal type - drop the picks and these together.
  //     Kept out of the DEV drift check via _delistedNvidiaNIMIds below (they are stale by construction).
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: 'DeepSeek flagship reasoning MoE. No longer served by NVIDIA.',
    contextWindow: 262144,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260424', // = deepseek.models.ts 'deepseek-v4-pro'
    hidden: true,
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    description: 'Fast DeepSeek V4 MoE. Superseded here by the dated deepseek-v4-flash-0731 id.',
    contextWindow: 1000000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260424', // = deepseek.models.ts 'deepseek-v4-flash'
    hidden: true,
  },
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    label: 'Mistral Medium 3.5',
    description: 'Mistral frontier-class multimodal model. No longer served by NVIDIA.',
    contextWindow: 262144,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260428', // = mistral.models.ts 'mistral-medium-2604'
    hidden: true,
  },

] as const satisfies readonly _NvidiaNIMModelDef[];

// Ids of the 'Delisted' tail group: defs that outlive their listing to keep the editorial pins type-valid.
// They are permanently absent from /v1/models, so they are subtracted from the DEV drift check below -
// otherwise they would fire the 'stale model defs (remove)' warning on every dev listing, and a real
// stale entry would be lost in the noise. Empty this when the pins move off these ids and the defs go.
const _delistedNvidiaNIMIds = new Set<string>(['deepseek-ai/deepseek-v4-pro', 'deepseek-ai/deepseek-v4-flash', 'mistralai/mistral-medium-3.5-128b']);


/**
 * DENY LIST - ids verified dead or non-chat by the harvest tool (2026-08-17 run), and still listed.
 * These are dropped from the listing entirely. Anything NOT curated and NOT here is a genuinely-new
 * catalog arrival and gets a '[?]' 0-day entry. Regenerated by the harvest refresh: an id that left
 * /v1/models leaves this list too (nothing to filter), which is why the 2026-07-27 EOL group is gone.
 */
const _retiredNvidiaNIMIds = [
  // dead-entitlement: 404 "Function not found for account" - deployment removed
  '01-ai/yi-large', 'adept/fuyu-8b', 'ai21labs/jamba-1.5-large-instruct', 'aisingapore/sea-lion-7b-instruct',
  'databricks/dbrx-instruct', 'deepseek-ai/deepseek-coder-6.7b-instruct',
  'google/codegemma-1.1-7b', 'google/codegemma-7b', 'google/deplot', 'google/gemma-2b', 'google/gemma-3-12b-it', 'google/gemma-3-4b-it', 'google/recurrentgemma-2b',
  'ibm/granite-3.0-3b-a800m-instruct', 'ibm/granite-3.0-8b-instruct', 'ibm/granite-34b-code-instruct', 'ibm/granite-8b-code-instruct',
  'meta/codellama-70b', 'meta/llama2-70b',
  'microsoft/kosmos-2', 'microsoft/phi-3-vision-128k-instruct', 'microsoft/phi-3.5-moe-instruct',
  'mistralai/codestral-22b-instruct-v0.1', 'mistralai/mistral-7b-instruct-v0.3', 'mistralai/mistral-large', 'mistralai/mistral-large-2-instruct', 'mistralai/mixtral-8x22b-v0.1',
  'moonshotai/kimi-k2.6', 'nv-mistralai/mistral-nemo-12b-instruct',
  'nvidia/cosmos-reason2-8b', 'nvidia/llama-3.1-nemotron-51b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'nvidia/llama3-chatqa-1.5-70b', 'nvidia/mistral-nemo-minitron-8b-8k-instruct', 'nvidia/nemotron-4-340b-instruct', 'nvidia/nemotron-4-340b-reward',
  'nvidia/neva-22b', 'nvidia/riva-translate-4b-instruct', 'nvidia/vila',
  'writer/palmyra-creative-122b', 'writer/palmyra-fin-70b-32k', 'writer/palmyra-med-70b', 'writer/palmyra-med-70b-32k',
  'zyphra/zamba2-7b-instruct',
  // no-chat-route: embeddings / rerankers / CLIP - not servable on /chat/completions
  'baai/bge-m3', 'bigcode/starcoder2-15b', 'snowflake/arctic-embed-l',
  'nvidia/embed-qa-4', 'nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1', 'nvidia/llama-3.2-nv-embedqa-1b-v1',
  'nvidia/llama-nemotron-embed-1b-v2', 'nvidia/llama-nemotron-embed-vl-1b-v2', 'nvidia/nemotron-3-embed-1b',
  'nvidia/nv-embed-v1', 'nvidia/nv-embedcode-7b-v1', 'nvidia/nv-embedqa-e5-v5', 'nvidia/nv-embedqa-mistral-7b-v2', 'nvidia/nvclip',
  // probe-error: document parsers (no text input) or persistent 5xx
  'nvidia/ai-synthetic-video-detector', 'nvidia/nemoretriever-parse',
  'nvidia/nemotron-nano-3-30b-a3b', 'nvidia/nemotron-parse',
  // slow-or-dead: timed out at 45s and 120s across runs
  // NOT here: 'poolside/laguna-xs-2.1' (429 this run) and the small Llamas, which answered on an earlier run
  // and time out now - curated (hidden) rather than denied, since a free-tier timeout is not a retirement
  'nvidia/llama-3.1-nemotron-nano-8b-v1',
] as const;


/// Heuristic - used by the generic 'openai' dialect to route pre-existing custom-host services to this parser

export function nvidiaNIMHeuristic(oaiUrl: string): boolean {
  return oaiUrl.toLowerCase().includes('integrate.api.nvidia.com');
}


/// Models List transform

const _knownById = new Map<string, _NvidiaNIMModelDef>(_knownNvidiaNIMModels.map(m => [m.id, m]));
const _knownOrder = new Map<string, number>(_knownNvidiaNIMModels.map((m, i) => [m.id, i]));
const _retiredIds = new Set<string>(_retiredNvidiaNIMIds);

export function nvidiaNIMModelsToModelDescriptions(maybeModels: { id?: unknown, owned_by?: unknown }[]): ModelDescriptionSchema[] {

  const apiIds = maybeModels.map(m => m.id).filter((id): id is string => typeof id === 'string');

  // [DEV] drift detection: stale curated entries (in the table but gone from the API - user-breaking, remove ASAP);
  // 0-day arrivals are intentionally NOT flagged here (they surface as hidden entries and via the harvest refresh);
  // the knowingly-delisted defs are subtracted so the warning only ever means a NEW retirement
  if (Release.IsNodeDevBuild)
    llmDevCheckModels_DEV('NVIDIA NIM', apiIds, _knownNvidiaNIMModels.filter(m => !_delistedNvidiaNIMIds.has(m.id)).map(m => m.id), { checkUnknown: false });

  return apiIds
    // drop harvest-verified dead / non-chat / EOL ids (the API list is a stale superset)
    .filter(id => !_retiredIds.has(id))
    .map((id): ModelDescriptionSchema => {
      const known = _knownById.get(id);
      if (known) {
        const { id: _id, ...rest } = known;
        return { id, ...rest };
      }
      // 0-day arrival: neither curated nor denied - surfaced VISIBLE with generic metadata,
      // '[?]'-prefixed per the house convention for unrecognized variants (see fromManualMapping).
      // Auto-pick safety: strategies prefer ELO-carrying models, and the curated entries above hold
      // the vendor's ELOs, so a null-metadata arrival cannot win utility/chat auto-assignment.
      // NOTE: the registry-sync push filter identifies these by `[?]` label + null contextWindow.
      return {
        id,
        label: llmsLabelUncurated(id.includes('/') ? id.slice(id.indexOf('/') + 1) : id),
        description: `New NVIDIA catalog arrival '${id}', not yet curated - capabilities and context window unverified.`,
        contextWindow: null,
        interfaces: [LLM_IF_OAI_Chat],
        chatPrice: _freePrice,
      };
    })
    // table order is the display order (curated: flagships first, hidden tail last); 0-day arrivals sort last
    .sort((a, b) => (_knownOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (_knownOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
}
