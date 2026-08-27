import type { LlmsAnthropicModelId } from '~/modules/llms/server/anthropic/anthropic.models';
import type { LlmsDeepseekModelId } from '~/modules/llms/server/openai/models/deepseek.models';
import type { LlmsGeminiModelId } from '~/modules/llms/server/gemini/gemini.models';
import type { LlmsMoonshotModelId } from '~/modules/llms/server/openai/models/moonshot.models';
import type { LlmsNvidiaNIMModelId } from '~/modules/llms/server/openai/models/nvidianim.models';
import type { LlmsOpenAIModelId } from '~/modules/llms/server/openai/models/openai.models';
import type { LlmsXAIModelId } from '~/modules/llms/server/openai/models/xai.models';
import type { LlmsZAIModelId } from '~/modules/llms/server/openai/models/zai.models';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM, DLLMId } from './llms.types';
import type { DModelDomainId } from './model.domains.types';


/**
 * Hand-curated, per-domain Auto picks.
 *
 * Each domain holds an ordered list of `{ vendor, modelId }` pairs. The picker walks
 * the list in order and returns the first available match. Array order IS the
 * cross-vendor precedence - any vendor's model can be sandwiched between picks from
 * other vendors. No external vendor ranking (ELO/cost) is consulted.
 *
 * Type safety: each entry's `modelId` is constrained to its vendor's literal-union of
 * known model ids (auto-derived from `*.models.ts` via `LlmsXxxModelId`). Typos and
 * stale ids surface at compile time. Dynamic vendors (OpenRouter, Bedrock) use
 * `string` since their model lists are discovered at runtime.
 */


/** A single (vendor, modelId) pick. Discriminated by `vendor`; each variant binds the
 * `modelId` to that vendor's literal-union or `string` (dynamic vendors). */
type _EditorialPick =
  | { vendor: 'anthropic',  modelId: LlmsAnthropicModelId }
  | { vendor: 'bedrock',    modelId: `${'us.' | 'global.'}anthropic.${LlmsAnthropicModelId}${'' | '-thinking' | '-v1:0'}` }    // dynamic discovery
  | { vendor: 'deepseek',   modelId: LlmsDeepseekModelId }
  | { vendor: 'googleai',   modelId: LlmsGeminiModelId }
  | { vendor: 'moonshot',   modelId: LlmsMoonshotModelId }
  | { vendor: 'nvidianim',  modelId: LlmsNvidiaNIMModelId }
  | { vendor: 'openai',     modelId: LlmsOpenAIModelId }
  | { vendor: 'openrouter', modelId: `anthropic/${LlmsAnthropicModelId | 'claude-haiku-4-5'}` | `google/${string}` | `openai/${LlmsOpenAIModelId}` } // dynamic discovery
  | { vendor: 'xai',        modelId: LlmsXAIModelId }
  | { vendor: 'zai',        modelId: LlmsZAIModelId };

/** Compile-time check: every editorial vendor literal must be in `ModelVendorId` (catches typos like `oepnai`). */
const _assertEditorialVendorsAreValid: [_EditorialPick['vendor']] extends [ModelVendorId] ? true : never = true;
void _assertEditorialVendorsAreValid;

/** Per-domain ordered list of picks. Earlier wins. */
type _EditorialDefaultsTable = {
  [D in DModelDomainId]?: ReadonlyArray<_EditorialPick>;
};


// --- Editorial table ---
// Array order IS cross-vendor precedence. Interleave freely.

export const EditorialDefaults = {

  primaryChat: [
    // TEMP 2026-06-16: Fable 5 held - not recommended to new users via Auto picks. Uncomment to restore.
    // { vendor: 'anthropic',  modelId: 'claude-fable-5' },
    // { vendor: 'bedrock',    modelId: 'us.anthropic.claude-fable-5' },
    // { vendor: 'bedrock',    modelId: 'global.anthropic.claude-fable-5' },
    // { vendor: 'openrouter', modelId: 'anthropic/claude-fable-5' },
    // LAUNCHED 2026-07-24: claude-opus-5 replaces Opus 4.8 as the top Anthropic pick ($5/$25, 1M ctx, thinking
    // on by default). Single always-adaptive entry (no variant), so no '-thinking' Bedrock suffix.
    { vendor: 'anthropic',  modelId: 'claude-opus-5' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-5' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-5' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-opus-5' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-8' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-4-8-thinking' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-4-8-thinking' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-7' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-4-7-thinking' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-4-7-thinking' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-opus-4-7' },
    { vendor: 'openai',     modelId: 'gpt-5.6-sol' }, // 2026-07-09 GA - flagship tier, same price as 5.5
    { vendor: 'openrouter', modelId: 'openai/gpt-5.6-sol' },
    { vendor: 'openai',     modelId: 'gpt-5.5' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.5' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.7-flash' }, // 2026-08-13 GA - newest Flash flagship (Elo 1490 prelim vs 1485, same intro price as 3.6, big agentic/coding gains)
    { vendor: 'googleai',   modelId: 'models/gemini-3.6-flash' }, // 2026-07-21 GA - above 3.5 Flash (Elo 1485 vs 1476, cheaper output)
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-6' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.1-pro-preview' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-4-6' },
    { vendor: 'xai',        modelId: 'grok-4.6' }, // 2026-08-12 GA - frontier for coding/agentic/knowledge work, extends 4.5
    { vendor: 'xai',        modelId: 'grok-4.5' },
    { vendor: 'xai',        modelId: 'grok-4.3' },
    { vendor: 'moonshot',   modelId: 'kimi-k3' },
    { vendor: 'moonshot',   modelId: 'kimi-k2.6' },
    { vendor: 'zai',        modelId: 'glm-5.3' }, // 2026-08-27: standard API GA (was Coding-Plan-only at launch)
    { vendor: 'zai',        modelId: 'glm-5.2' },
    { vendor: 'deepseek',   modelId: 'deepseek-v4-pro' },
    // NVIDIA NIM: free trial catalog, tail picks (native vendors above always win when configured; z-ai/glm-5.2 dropped: NVIDIA EOL 2026-08-24)
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3-ultra-550b-a55b' }, // NVIDIA flagship, 1M ctx, reliably served
    { vendor: 'nvidianim',  modelId: 'deepseek-ai/deepseek-v4-flash-0731' }, // replaces deepseek-v4-pro (410 Gone on NVIDIA since 2026-08-17)
  ],

  codeApply: [
    { vendor: 'googleai',   modelId: 'models/gemini-3.7-flash' }, // 2026-08-13 GA - "most intelligent workhorse for coding and agents" (DeepSWE 65.3% vs 3.6's 49.0%)
    { vendor: 'openrouter', modelId: 'google/gemini-3.7-flash' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.6-flash' }, // 2026-07-21 GA - "improved code/agentic planning" + token efficiency over 3.5 Flash
    { vendor: 'openrouter', modelId: 'google/gemini-3.6-flash' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash' },
    { vendor: 'openrouter', modelId: 'google/gemini-3.5-flash' },
    { vendor: 'openai',     modelId: 'gpt-5.3-codex' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.3-codex' },
    { vendor: 'openai',     modelId: 'gpt-5.6-sol' }, // 2026-07-09 GA - "strongest yet for agentic coding"; codex still preferred for apply
    { vendor: 'openai',     modelId: 'gpt-5.5' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-4-6' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-sonnet-4-6' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-sonnet-4-6' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' },
    { vendor: 'anthropic',  modelId: 'claude-opus-5' }, // launched 2026-07-24
    { vendor: 'anthropic',  modelId: 'claude-opus-4-8' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-7' },
    { vendor: 'xai',        modelId: 'grok-4.6' }, // xAI frontier for coding/agentic; new Grok Build default (2026-08-12)
    { vendor: 'xai',        modelId: 'grok-4.5' },
    { vendor: 'xai',        modelId: 'grok-build-0.1' },
    { vendor: 'zai',        modelId: 'glm-5.3' }, // 2026-08-27: standard API GA; +50% over 5.2 on Z.ai's code bench
    { vendor: 'zai',        modelId: 'glm-5.2' },
    { vendor: 'zai',        modelId: 'glm-5' },
    { vendor: 'moonshot',   modelId: 'kimi-k2.6' },
    { vendor: 'deepseek',   modelId: 'deepseek-v4-flash' },
    // NVIDIA NIM: free trial catalog, tail picks (z-ai/glm-5.2 dropped: NVIDIA EOL 2026-08-24)
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3-super-120b-a12b' }, // agentic/tool-use tuned, 12B active
    { vendor: 'nvidianim',  modelId: 'deepseek-ai/deepseek-v4-flash-0731' }, // dated checkpoint: the undated id is 410 Gone on NVIDIA
  ],

  fastUtil: [
    { vendor: 'openai',     modelId: 'gpt-5.6-luna' }, // 2026-07-09 GA - measured ~160 tok/s (faster than 5.4-mini), 1M ctx, $0.20/$1.20
    { vendor: 'openrouter', modelId: 'openai/gpt-5.6-luna' },
    { vendor: 'openai',     modelId: 'gpt-5.4-mini' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.4-mini' },
    { vendor: 'openai',     modelId: 'gpt-5.4-nano' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash-lite' }, // 2026-07-21 GA - "low-latency subagent for high-volume automation" (Elo 1459 vs 3.1FL's 1432; slightly pricier at $0.30/$2.50 vs $0.25/$1.50)
    { vendor: 'openrouter', modelId: 'google/gemini-3.5-flash-lite' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.1-flash-lite' },
    { vendor: 'openrouter', modelId: 'google/gemini-3.1-flash-lite' },
    { vendor: 'googleai',   modelId: 'models/gemini-2.5-flash-lite' }, // deprecated 2026-07-22, kept as deep fallback
    { vendor: 'anthropic',  modelId: 'claude-haiku-4-5-20251001' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-haiku-4-5' },
    { vendor: 'moonshot',   modelId: 'kimi-k2.5' },
    { vendor: 'xai',        modelId: 'grok-4.20-0309-non-reasoning' },
    { vendor: 'xai',        modelId: 'grok-4.3' },
    { vendor: 'zai',        modelId: 'glm-5.3-flash' }, // 2026-08-27: 18B active, $0.15/$0.5 - the actual Z.ai fast tier (5.2 was a pre-flash placeholder)
    { vendor: 'zai',        modelId: 'glm-5.2' },
    { vendor: 'deepseek',   modelId: 'deepseek-v4-flash' },
    // NVIDIA NIM: free trial catalog, tail picks (nemotron-3-nano-30b-a3b and nemotron-nano-9b-v2 dropped: NVIDIA EOL 2026-08-25)
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3.5-lightning-30b-a3b' }, // fastest Nemotron MoE, 3B active, 1M ctx
    { vendor: 'nvidianim',  modelId: 'openai/gpt-oss-20b' },
  ],

  imageCaption: [
    { vendor: 'googleai',   modelId: 'models/gemini-3.7-flash' }, // 2026-08-13 GA - vision (text/image/video/audio/PDF in), same intro price as 3.6
    { vendor: 'openrouter', modelId: 'google/gemini-3.7-flash' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.6-flash' }, // 2026-07-21 GA - vision, cheaper output than 3.5 Flash
    { vendor: 'openrouter', modelId: 'google/gemini-3.6-flash' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash' },
    { vendor: 'openrouter', modelId: 'google/gemini-3.5-flash' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-4-6' },
    { vendor: 'anthropic',  modelId: 'claude-opus-5' }, // launched 2026-07-24
    { vendor: 'anthropic',  modelId: 'claude-opus-4-8' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-7' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' },
    { vendor: 'openai',     modelId: 'gpt-5.6-luna' }, // 2026-07-09 GA - vision, faster and a generation newer than 5.4-mini
    { vendor: 'openrouter', modelId: 'openai/gpt-5.6-luna' },
    { vendor: 'openai',     modelId: 'gpt-5.4-mini' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.4-mini' },
    // NVIDIA NIM: free trial catalog, tail picks (nemotron-nano-12b-v2-vl dropped: NVIDIA EOL 2026-08-25)
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' }, // omni-modal Nano: image, video and audio in
    { vendor: 'nvidianim',  modelId: 'meta/muse-glimmer-30b' }, // replaces mistral-medium-3.5-128b (410 Gone on NVIDIA since 2026-08-17)
  ],

} as const satisfies _EditorialDefaultsTable;


// --- Picking strategy ---

/**
 * Pick the editor's favorite for a domain, given pre-filtered candidates.
 *
 * Walks `EditorialDefaults[domainId]` in declared order and returns the first DLLMId
 * matching a (vendor, modelId) pair. Returns undefined when nothing matches; the
 * caller (auto-resolver) falls through to the ELO/cost strategy.
 */
export function llmsEditorialPickForDomain(
  domainId: DModelDomainId,
  filteredLlms: ReadonlyArray<DLLM>,
  fallbackEditorialDomainId?: DModelDomainId, // optional secondary domain to check when the primary domain has no picks or no matches
): DLLMId | undefined {
  const entries = EditorialDefaults[domainId]?.length ? EditorialDefaults[domainId]
    : fallbackEditorialDomainId && EditorialDefaults[fallbackEditorialDomainId]?.length ? EditorialDefaults[fallbackEditorialDomainId]
      : undefined;
  if (!entries) return undefined;
  for (const { vendor, modelId } of entries) {
    const hit = filteredLlms.find(llm => llm.vId === vendor && _editorialMatch(llm, modelId));
    if (hit) return hit.id;
  }
  return undefined;
}

/** Tolerant id match: exact `llmRef`, dated-suffix prefix on `llmRef`, or service-prefixed DLLM id (e.g. `anthropic-1-claude-opus-4-7`). */
function _editorialMatch(llm: DLLM, editorialId: string): boolean {
  const llmRef = llm.initialParameters?.llmRef;
  return typeof llmRef === 'string' && (llmRef === editorialId || llmRef.startsWith(editorialId));
  // this would match the mdoel in alternative services I guess - but also notice we use the llmRef correctly, not the DLLMId
  // return llm.id === editorialId || llm.id.endsWith(`-${editorialId}`);
}
