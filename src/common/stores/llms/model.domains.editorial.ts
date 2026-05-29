import type { LlmsAnthropicModelId } from '~/modules/llms/server/anthropic/anthropic.models';
import type { LlmsDeepseekModelId } from '~/modules/llms/server/openai/models/deepseek.models';
import type { LlmsGeminiModelId } from '~/modules/llms/server/gemini/gemini.models';
import type { LlmsMoonshotModelId } from '~/modules/llms/server/openai/models/moonshot.models';
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
    { vendor: 'anthropic',  modelId: 'claude-opus-4-8' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-4-8-thinking' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-4-8-thinking' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-7' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-opus-4-7-thinking' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-opus-4-7-thinking' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-opus-4-7' },
    { vendor: 'openai',     modelId: 'gpt-5.5' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.5' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-6' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.1-pro-preview' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-4-6' },
    { vendor: 'xai',        modelId: 'grok-4.3' },
    { vendor: 'moonshot',   modelId: 'kimi-k2.6' },
    { vendor: 'zai',        modelId: 'glm-5' },
    { vendor: 'deepseek',   modelId: 'deepseek-v4-pro' },
  ],

  codeApply: [
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash' },
    { vendor: 'openrouter', modelId: 'google/gemini-3.5-flash' },
    { vendor: 'openai',     modelId: 'gpt-5.3-codex' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.3-codex' },
    { vendor: 'openai',     modelId: 'gpt-5.5' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-4-6' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-sonnet-4-6' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-sonnet-4-6' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-8' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-7' },
    { vendor: 'xai',        modelId: 'grok-build-0.1' },
    { vendor: 'zai',        modelId: 'glm-5-code' },
    { vendor: 'zai',        modelId: 'glm-5' },
    { vendor: 'moonshot',   modelId: 'kimi-k2.6' },
    { vendor: 'deepseek',   modelId: 'deepseek-v4-flash' },
  ],

  fastUtil: [
    { vendor: 'openai',     modelId: 'gpt-5.4-mini' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.4-mini' },
    { vendor: 'openai',     modelId: 'gpt-5.4-nano' },
    { vendor: 'googleai',   modelId: 'models/gemini-3.1-flash-lite' },
    { vendor: 'openrouter', modelId: 'google/gemini-3.1-flash-lite' },
    { vendor: 'googleai',   modelId: 'models/gemini-2.5-flash-lite' },
    { vendor: 'anthropic',  modelId: 'claude-haiku-4-5-20251001' },
    { vendor: 'bedrock',    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' },
    { vendor: 'bedrock',    modelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-haiku-4-5' },
    { vendor: 'moonshot',   modelId: 'kimi-k2.5' },
    { vendor: 'xai',        modelId: 'grok-4.20-0309-non-reasoning' },
    { vendor: 'xai',        modelId: 'grok-4.3' },
    { vendor: 'zai',        modelId: 'glm-4.7-flash' },
    { vendor: 'deepseek',   modelId: 'deepseek-v4-flash' },
  ],

  imageCaption: [
    { vendor: 'googleai',   modelId: 'models/gemini-3.5-flash' },
    { vendor: 'openrouter', modelId: 'google/gemini-3.5-flash' },
    { vendor: 'anthropic',  modelId: 'claude-sonnet-4-6' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-8' },
    { vendor: 'anthropic',  modelId: 'claude-opus-4-7' },
    { vendor: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' },
    { vendor: 'openai',     modelId: 'gpt-5.4-mini' },
    { vendor: 'openrouter', modelId: 'openai/gpt-5.4-mini' },
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
): DLLMId | undefined {
  const entries = EditorialDefaults[domainId];
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
