import type { LlmsAnthropicModelId } from '~/modules/llms/server/anthropic/anthropic.models';
import type { LlmsDeepseekModelId } from '~/modules/llms/server/openai/models/deepseek.models';
import type { LlmsGeminiModelId } from '~/modules/llms/server/gemini/gemini.models';
import type { LlmsMoonshotModelId } from '~/modules/llms/server/openai/models/moonshot.models';
import type { LlmsNvidiaNIMModelId } from '~/modules/llms/server/openai/models/nvidianim.models';
import type { LlmsOpenAIModelId } from '~/modules/llms/server/openai/models/openai.models';
import type { LlmsXAIModelId } from '~/modules/llms/server/openai/models/xai.models';
import type { LlmsZAIModelId } from '~/modules/llms/server/openai/models/zai.models';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import { textEqualsDotDashInsensitive } from '~/common/util/textUtils';

import type { DLLM, DLLMId } from './llms.types';
import type { DModelDomainId } from './model.domains.types';
import { getLLMPubDate, isLLMHidden, LLM_IF_Inputs_Video } from './llms.types';


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
 * stale ids surface at compile time. Dynamic vendors (OpenRouter, Bedrock) list their
 * models at runtime: their picks are templates over the native unions.
 */


/** A single (vendor, modelId) pick. Discriminated by `vendor`; each variant binds the
 * `modelId` to that vendor's literal-union or `string` (dynamic vendors). */
type _EditorialPick =
  | { vendor: 'anthropic',  modelId: LlmsAnthropicModelId }
  | { vendor: 'bedrock',    modelId: `${'us.' | 'global.'}anthropic.${LlmsAnthropicModelId}${'' | '-v1:0'}` }    // dynamic discovery; matched as a prefix of the listed id
  | { vendor: 'deepseek',   modelId: LlmsDeepseekModelId }
  | { vendor: 'googleai',   modelId: LlmsGeminiModelId }
  | { vendor: 'moonshot',   modelId: LlmsMoonshotModelId }
  | { vendor: 'nvidianim',  modelId: LlmsNvidiaNIMModelId }
  | { vendor: 'openai',     modelId: LlmsOpenAIModelId }
  | { vendor: 'openrouter', modelId: `anthropic/${LlmsAnthropicModelId}` | `google/${string}` | `openai/${LlmsOpenAIModelId}` } // dynamic discovery
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
//
// One pick per service and domain: the current model at that service level, which every user of the service can call.
// No previous-generation fallbacks: when a pick is not in the user's list, the ELO/cost heuristic takes over.
// - Bedrock is the exception: access is per account and region. The newest comes first, although an account without the
//   enablement gets 403 'not available for this account' on every Claude released since Opus 4.7; the second pick is the
//   newest such an account can invoke, and it applies only where the first is not listed.
// - OpenRouter serves every upstream: a single pick per domain, the best across vendors.
// - NVIDIA NIM is a free trial catalog: last in every domain, so that a configured paid service always wins.
// Scores are LMArena text (style control), 2026-10-28; prices are $/M tokens, input/output.

export const EditorialDefaults = {

  // flagship quality
  primaryChat: [
    { vendor: 'anthropic',  modelId: 'claude-opus-5-5' }, // 1509, $4/$20, 1M ctx - above Fable 5.1 (1504) at 40% of its price
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-5-5' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-5-5' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-4-6' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-4-6' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-opus-5-5' },
    { vendor: 'googleai',   modelId: 'models/gemini-4-argon' }, // 1520, the top score among the models we list - $2/$10 through 2026-11-30, then $4/$20
    { vendor: 'googleai',   modelId: 'models/gemini-3.8-flash' }, // 1496, the top Gemini with a free tier - here if the free Gemini key doesn't allow 4-Argon (however it will prob still list it, so free users may have a default-fail here)
    { vendor: 'openai',     modelId: 'gpt-6.1-sol' }, // 1481, $2/$10 - level with 5.6 Sol (1485) and above Astra (1476, $10/$50)
    { vendor: 'moonshot',   modelId: 'kimi-k3.1-pro' }, // $2/$10 - succeeds K3 (1488, $3/$15), no arena row of its own yet
    { vendor: 'zai',        modelId: 'glm-5.3' }, // 1481, $1.4/$4.4
    { vendor: 'deepseek',   modelId: 'deepseek-flash' }, // V4.1 Flash: 1476, $0.3/$1.2 - above V4 Pro (1465) at a quarter of its price
    { vendor: 'xai',        modelId: 'grok-4.7' }, // xAI's flagship - 1441, below Grok 4.5 (1465) and 4.6 (1455)
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3-ultra-550b-a55b' }, // 1427, 1M ctx
  ],

  // workhorse coder with function calling: strong, quick, mid-priced
  codeApply: [
    { vendor: 'googleai',   modelId: 'models/gemini-3.8-flash' }, // 1496 - Google's "workhorse for coding and agents"
    { vendor: 'openrouter', modelId: 'google/gemini-3.8-flash' },
    { vendor: 'openai',     modelId: 'gpt-6.1-sol' }, // 1481, $2/$10 - "exceptionally strong on agentic coding"
    { vendor: 'anthropic',  modelId: 'claude-sonnet-5-5' }, // 1477, $2/$10 - cheaper than Sonnet 4.6 ($3/$15), which it succeeds; thinks by default
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-sonnet-5-5' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-sonnet-5-5' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-sonnet-4-6' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-sonnet-4-6' },
    { vendor: 'zai',        modelId: 'glm-5.3' }, // 1481
    { vendor: 'deepseek',   modelId: 'deepseek-flash' }, // 1476
    { vendor: 'moonshot',   modelId: 'kimi-k2.7-code' }, // code-focused, ~180 tok/s, $0.95/$4
    { vendor: 'xai',        modelId: 'grok-4.7' },
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3.5-super-vl-120b-a12b' }, // agentic and tool-use tuned
  ],

  // titles, summaries and other short utility calls: fast and cheap first
  fastUtil: [
    { vendor: 'anthropic',  modelId: 'claude-haiku-5-5' }, // measured ~200 tok/s with thinking off, titles in 0.4-0.8s; short prompts mostly skip thinking
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-haiku-5-5' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-haiku-5-5' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-haiku-5-5' },
    { vendor: 'openai',     modelId: 'gpt-6-luna' }, // $0.10/$0.50, measured ~117 tok/s
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash-lite' }, // 1456, $0.30/$2.50 - "low-latency subagent for high-volume automation"
    { vendor: 'zai',        modelId: 'glm-5.3-flash' }, // 1477, $0.15/$0.5
    { vendor: 'deepseek',   modelId: 'deepseek-flash' }, // $0.3/$1.2
    { vendor: 'moonshot',   modelId: 'kimi-k2.6' }, // $0.95/$4, as K2.7 Code - which cannot turn thinking off
    { vendor: 'xai',        modelId: 'grok-4.20-0309-non-reasoning' }, // non-reasoning: no thinking delay
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3.5-lightning-30b-a3b' }, // fastest Nemotron, 3B active
  ],

  // describes an attached image as text: vision, quick
  imageCaption: [
    { vendor: 'googleai',   modelId: 'models/gemini-3.8-flash' }, // text, image, video, audio and PDF in
    { vendor: 'openrouter', modelId: 'google/gemini-3.8-flash' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-5-5' },
    { vendor: 'openai',     modelId: 'gpt-6-luna' },
    { vendor: 'nvidianim',  modelId: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' }, // image, video and audio in
  ],

  scratchChat: [],

} as const satisfies _EditorialDefaultsTable;


// --- Picking strategy ---

/**
 * Pick the editor's favorite for a domain, given pre-filtered candidates.
 *
 * Walks `EditorialDefaults[domainId]` for each of `domainIds` in order, each in declared
 * order, and returns the first DLLMId matching a (vendor, modelId) pair. Returns undefined
 * when nothing matches; the caller (auto-resolver) falls through to the ELO/cost strategy.
 */
export function llmsEditorial_ModelIdForDomain_SLOW<Tllm extends Pick<DLLM, 'id' | 'vId' | 'initialParameters'>>(
  domainIds: ReadonlyArray<DModelDomainId>,
  universe: ReadonlyArray<Tllm>,
): DLLMId | undefined {
  for (const domainId of domainIds) {
    for (const { vendor, modelId } of EditorialDefaults[domainId] ?? []) {

      // exact first: match by (vendor, id)
      let relaxedLlm: Tllm | undefined;
      const exactLlm = universe.find((llm) => {
        if (llm.vId !== vendor) return false;

        const llmRef = llm.initialParameters?.llmRef;
        if (!llmRef || typeof llmRef !== 'string') return false;

        // exact match
        if (llmRef === modelId) return true;

        // relaxed after: the prefix rule would otherwise take OpenRouter's 'openai/gpt-6-luna-pro' (listed first) for 'openai/gpt-6-luna';
        // first relaxed hit wins: dated-suffix prefix, or dot/dash-equivalent (OpenRouter's 'claude-opus-4.8' vs our 'claude-opus-4-8')
        if (!relaxedLlm && (llmRef.startsWith(modelId) || textEqualsDotDashInsensitive(llmRef, modelId)))
          relaxedLlm = llm;
        return false; // keep looking for an exact match
      });
      if (exactLlm) return exactLlm.id;
      if (relaxedLlm) return relaxedLlm.id;
    }
  }
  return undefined;
}

// --- Capability picks (editorial suggestions outside the domain system) ---

/** Video-input hint copy - surfaced by the composer when a video URL is pasted on a non-capable model. */
export const EditorialVideoInput = {
  hintSwitch: `This model can't watch videos`,
  actionSwitch: (modelLabel: string) => `Use ${modelLabel}`,
  hintSetup: `Add a Gemini model to have the AI watch videos`,
  actionSetup: 'Models',
} as const;

/**
 * Pick the model to suggest for video-URL input: Gemini models only - most recent (pubDate desc),
 * visible before hidden, native Google AI service breaking ties.
 * Gemini-only because URL video (YouTube fetch) is a Gemini capability: other models may carry
 * LLM_IF_Inputs_Video (e.g. Qwen video models on OpenRouter) but don't take URL-referenced video.
 * NOTE: there's an argument for preferring CHEAP capable models instead - video is
 * input-token heavy - revisit if the suggestion proves expensive in practice.
 */
export function llmsEditorialVideoInputPick(llms: ReadonlyArray<DLLM>): DLLM | undefined {
  const capable = llms.filter(llm => llm.interfaces.includes(LLM_IF_Inputs_Video) && _isGeminiFamily(llm));
  if (capable.length < 2) return capable[0];
  return [...capable].sort((a, b) =>
    ((isLLMHidden(a) ? 1 : 0) - (isLLMHidden(b) ? 1 : 0))
    || ((getLLMPubDate(b)?.getTime() ?? 0) - (getLLMPubDate(a)?.getTime() ?? 0))
    || ((a.vId === 'googleai' ? 0 : 1) - (b.vId === 'googleai' ? 0 : 1)),
  )[0];
}

/** Gemini on any service: the native Google AI vendor, or a gemini-named ref elsewhere (e.g. OpenRouter `google/gemini-*`). */
function _isGeminiFamily(llm: DLLM): boolean {
  if (llm.vId === 'googleai') return true;
  const llmRef = llm.initialParameters?.llmRef;
  return typeof llmRef === 'string' && llmRef.toLowerCase().includes('gemini');
}
