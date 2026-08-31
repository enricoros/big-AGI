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

// [NVIDIA NIM, 2026-08-24] Metadata refresh + targeted probes (no full re-probe, so measured windows stand):
// - glm-5.2 reached its EOL date: gone from /v1/models and probes 'retired' - entry deleted (no editorial pin held it).
// - Added kimi-k3, a 0-day arrival: probed alive at a measured 1M window, with tool calls, image input and a working
//   thinking toggle. Its predecessor kimi-k2.6 is still listed but stays denied (dead entitlement).
// - inkling picked up an NGC DEPRECATION of 2026-08-24 (it had none on 08-17); still listed, so marked, not deleted.
// - The 13 entries dated EOL 2026-08-25 still carry that date and still list - left alone, they delist themselves.

// [NVIDIA NIM, 2026-08-31] Full harvest refresh (probes re-run):
// - The EOL 2026-08-24/25 batch is gone as designed (delisted + 410 'retired'): 12 dated entries deleted -
//   inkling, the Llama 3.x tail, Nemotron Super v1/v1.5, Nano 9B v2 / 12B VL, Nemotron Mini, Nano VL 8B.
//   stepfun-ai/step-3.7-flash also delisted, with no NGC date ever published - deleted too.
// - nemotron-3-nano-30b-a3b did NOT retire: NGC moved its date 08-25 -> 08-31 and it still answers at 12M
//   invocations/month - kept, marker updated; it self-delists on the new date.
// - minimax-m3 picked up an NGC DEPRECATION of 2026-09-08 - marked, not deleted.
// - kimi-k3 is DEGRADED (still listed, invoke 400s '"DEGRADED function cannot be invoked"', function-level
//   so not a per-key artifact) - hidden until it recovers, not denied.
// - Added deepseek-v4-pro-0813, a 0-day arrival: alive (cold-start slow), measured 1M window, tool calls,
//   and a live-verified thinking toggle (thinking:false -> 0 reasoning chars).
// - The 'Delisted 2026-08-17' tail (deepseek-v4-pro/-flash, mistral-medium-3.5-128b) is deleted: the
//   editorial pins moved off those ids, so nothing holds them anymore.
// - TOOL BREAKAGE: build.nvidia.com 'models.md?page=2' answers an empty 202 (both runs, any UA) - the index
//   is one page now, so index-driven card coverage dropped; per-model cards still resolve (79/99 this run).
//   sources.ts needs a fallback if the index stays truncated.

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
    // EOL 2026-08-31 (NGC DEPRECATION - moved from 08-25; still alive and heavily used on the new date)
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    label: 'Nemotron 3 Nano 30B',
    description: 'Efficient open MoE (30B, 3B active) for high-volume tasks, 1M context, reasoning and tool use. Retires on NVIDIA 2026-08-31.',
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
  // DELETED 2026-08-31 (EOL 2026-08-25 enforced: delisted + 410): nvidia/llama-3.3-nemotron-super-49b-v1.5,
  // nvidia/nvidia-nemotron-nano-9b-v2, nvidia/nemotron-nano-12b-v2-vl

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
    id: 'deepseek-ai/deepseek-v4-pro-0813',
    label: 'DeepSeek V4 Pro 0813',
    description: 'DeepSeek flagship reasoning MoE (official 0813 release) with the full 1M context. Can be slow to cold-start on the free endpoint.',
    contextWindow: 1048576, // measured 2026-08-31
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: _PS_Thinking, // verified 2026-08-31: chat_template_kwargs thinking:false zeroes reasoning_content
    benchmark: { cbaElo: 1458 - 2 }, // lmarena: deepseek-v4-pro - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20260813', // = fireworksai.models.ts 'deepseek-v4-pro-0813' (upstream release; NVIDIA onboarded 2026-08-26)
  },
  {
    id: 'moonshotai/kimi-k3',
    label: 'Kimi K3',
    description: 'Moonshot flagship MoE, natively multimodal (image inputs), with the full 1M context and reasoning. Currently degraded on NVIDIA.',
    contextWindow: 1048576, // measured 2026-08-24
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking, // verified 2026-08-24: chat_template_kwargs thinking:false zeroes reasoning_content
    benchmark: { cbaElo: 1489 - 2 }, // lmarena: kimi-k3-max - 2 (yield to native vendor)
    chatPrice: _freePrice,
    pubDate: '20260716', // = moonshot.models.ts 'kimi-k3'
    hidden: true, // 2026-08-31: NVIDIA marks the function DEGRADED (every invoke 400s); still listed - unhide when it recovers
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
    // EOL 2026-09-08 (NGC DEPRECATION, first dated 2026-08-31)
    id: 'minimaxai/minimax-m3',
    label: 'MiniMax M3',
    description: 'MiniMax M3 reasoning model with image inputs. NVIDIA serves a reduced 256K context (native: 1M). Retires on NVIDIA 2026-09-08.',
    contextWindow: 262144, // measured 2026-08-17 (was 524288 on 2026-07-25) - NVIDIA halved its truncation of the native 1M
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
    parameterSpecs: _PS_Thinking,
    chatPrice: _freePrice,
    pubDate: '20260601', // = minimax.models.ts 'MiniMax-M3'
  },
  // DELETED 2026-08-31: stepfun-ai/step-3.7-flash - delisted + 410 with no NGC date ever published
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
  // DELETED 2026-08-31 (EOL 2026-08-24 enforced: delisted + 410): thinkingmachines/inkling

  // --- Meta Llama ---
  // DELETED 2026-08-31 (EOL 2026-08-25 enforced: delisted + 410): meta/llama-3.3-70b-instruct,
  // meta/llama-3.1-8b-instruct, meta/llama-3.1-70b-instruct, meta/llama-3.2-1b-instruct, meta/llama-3.2-3b-instruct
  // (the two llama-3.2 vision ids below carry no NGC date and still probe alive)

  // --- Hidden: alive but niche, superseded, unreliable, or non-chat ---
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
  // DELETED 2026-08-31 (EOL 2026-08-25 enforced: delisted + 410): nvidia/llama-3.3-nemotron-super-49b-v1,
  // nvidia/llama-3.1-nemotron-nano-vl-8b-v1
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
  // DELETED 2026-08-31 (EOL 2026-08-25 enforced: delisted + 410): nvidia/nemotron-mini-4b-instruct
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

  // DELETED 2026-08-31: the 'Delisted 2026-08-17' tail (deepseek-ai/deepseek-v4-pro, deepseek-ai/deepseek-v4-flash,
  // mistralai/mistral-medium-3.5-128b) - the editorial pins moved off these ids, so the type no longer holds them

] as const satisfies readonly _NvidiaNIMModelDef[];

// Ids of a 'Delisted' tail group: defs that outlive their listing to keep the editorial pins type-valid.
// Such ids are permanently absent from /v1/models, so they are subtracted from the DEV drift check below -
// otherwise they would fire the 'stale model defs (remove)' warning on every dev listing, and a real
// stale entry would be lost in the noise. Empty (2026-08-31): no def currently outlives its listing.
const _delistedNvidiaNIMIds = new Set<string>([]);


/**
 * DENY LIST - ids verified dead or non-chat by the harvest tool (2026-08-31 run), and still listed.
 * These are dropped from the listing entirely. Anything NOT curated and NOT here is a genuinely-new
 * catalog arrival and gets a '[?]' 0-day entry. Regenerated by the harvest refresh: an id that left
 * /v1/models leaves this list too (nothing to filter) - 2026-08-31 drops: baai/bge-m3, the nv-embed
 * quartet, nvidia/nemoretriever-parse, nvidia/llama-3.1-nemotron-nano-8b-v1.
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
  'bigcode/starcoder2-15b', 'snowflake/arctic-embed-l',
  'nvidia/embed-qa-4', 'nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1', 'nvidia/llama-3.2-nv-embedqa-1b-v1',
  'nvidia/llama-nemotron-embed-vl-1b-v2', 'nvidia/nemotron-3-embed-1b',
  'nvidia/nv-embedqa-mistral-7b-v2', 'nvidia/nvclip',
  // probe-error: document parsers (no text input) or persistent 5xx
  'nvidia/ai-synthetic-video-detector',
  'nvidia/nemotron-nano-3-30b-a3b', 'nvidia/nemotron-parse',
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
