import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import { createDebugWireLogger } from '~/server/wire';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { formatPubDate, fromManualMapping, type KnownLink, type KnownModel, llmDevCheckModels_DEV, llmsDefineModels } from '../../models.mappings';
import { openAIAccess, type OpenAIAccessSchema } from '../openai.access';
import { wireCerebrasListOutputSchema, type WireCerebrasModel } from '../wiretypes/cerebras.wiretypes';


// --- Cerebras Model ID inference (auto-derived from _knownCerebrasModels) ---
export type LlmsCerebrasModelId = (typeof _knownCerebrasModels)[number]['idPrefix'];


// Rich public catalog endpoint - far more metadata than the authenticated /v1/models (id/created/owned_by only).
// Unauthenticated, OpenAI-shaped envelope. See cerebras.wiretypes.ts.
const CEREBRAS_PUBLIC_MODELS_PATH = '/public/v1/models';

// dev options
const DEV_DEBUG_CEREBRAS_MODELS = Release.IsNodeDevBuild; // not in staging to reduce noise

// shared interface bundles
const IF_CHAT_FN = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];


/**
 * Cerebras models - fast OpenAI-compatible inference (wafer-scale).
 * - models list: https://inference-docs.cerebras.ai/models/overview
 * - pricing: https://www.cerebras.ai/pricing (per-token rates from /public/v1/models)
 * - updated: 2026-06-30 (empirically verified caps/pricing against the live API)
 *
 * EDITORIAL OVERRIDES: the /public/v1/models catalog carries pricing/limits/capabilities, but its
 * metadata is unreliable for preview models (e.g. it reports gemma-4-31b with all caps false and an
 * 8K context, yet the model actually does vision + tools + reasoning at 131K - verified live). So the
 * entries below WIN for known models; the catalog only fills in UNKNOWN/new models (forward-compat).
 * Llama/Qwen families remain Dedicated-Endpoints only and are not exposed on the public catalog.
 */
type _CerebrasModelDef = (KnownModel & { pubDate?: string }) | KnownLink;

const _knownCerebrasModels = llmsDefineModels<_CerebrasModelDef>()([
  // Gemma 4 31B - Cerebras' first multimodal model (~1,850 tok/s). Free preview (eval-only).
  {
    isPreview: true,
    idPrefix: 'gemma-4-31b',
    label: 'Gemma 4 31B (Preview)',
    pubDate: '20260630',
    description: 'Google Gemma 4 31B on Cerebras - first multimodal model on wafer-scale inference (~1,850 tok/s). Vision (base64 PNG/JPEG, max 5 images / 10MB), function calling, reasoning (off by default, enable via effort). 131K context (65K free tier), 40K max output.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [...IF_CHAT_FN, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] }, // reasoning off by default
    ],
    chatPrice: { input: 0.99, output: 1.49 }, // NOTE: catalog reports 0/0 (preview) but not asserting free for now
  },

  // OpenAI GPT-OSS 120B - flagship open-weight MoE (~3,000 tok/s). Production (GA).
  {
    idPrefix: 'gpt-oss-120b',
    label: 'GPT OSS 120B',
    pubDate: '20250805',
    description: 'OpenAI flagship open-weight MoE (120B total, 5.1B active) on Cerebras (~3,000 tok/s). Reasoning (default medium effort) and function calling. 131K context, 40K max output.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [...IF_CHAT_FN, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, // reasoning model, no 'none'
    ],
    chatPrice: { input: 0.35, output: 0.75 },
  },

  // Z.ai GLM 4.7 - agentic coding, strong tool use (~1,000 tok/s). Preview.
  {
    isPreview: true,
    idPrefix: 'zai-glm-4.7',
    label: 'Z.ai GLM 4.7 (Preview)',
    pubDate: '20260107', // from catalog 'created' (kept editorial so the non-CSF/DB path has it too)
    description: 'Z.ai GLM 4.7 (355B) on Cerebras (~1,000 tok/s). Strong agentic coding, advanced reasoning (on by default), superior tool use. 131K context, 40K max output.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [...IF_CHAT_FN, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] }, // reasoning on by default
    ],
    chatPrice: { input: 2.25, output: 2.75 },
  },
]);


/**
 * Builds a tolerant fallback definition from the rich public-catalog entry, so UNKNOWN/new models
 * surface with their real capabilities/limits/pricing instead of a generic hidden placeholder.
 * (Used only when a model isn't in the editorial table above.)
 */
function _cerebrasApiModelToFallback(model: WireCerebrasModel): KnownModel {
  const caps = model.capabilities ?? {};
  const limits = model.limits ?? {};

  // interfaces: chat is implied; add the rest from advertised capabilities (relaxed - missing => off)
  const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
  if (caps.vision || model.architecture?.modality?.includes('image')) interfaces.push(LLM_IF_OAI_Vision);
  if (caps.function_calling || caps.tools) interfaces.push(LLM_IF_OAI_Fn);
  if (caps.reasoning) interfaces.push(LLM_IF_OAI_Reasoning);
  // NOTE: structured_outputs/json_mode -> LLM_IF_OAI_Json is intentionally omitted (that interface is currently suspended)

  // reasoning effort param (OpenAI-style reasoning_effort) when reasoning is advertised; no enumValues
  // => the full registry range applies (vendor default), since we can't know the model's exact set
  const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [];
  if (caps.reasoning) parameterSpecs.push({ paramId: 'llmVndOaiEffort' });

  // pricing: dollar-per-token strings -> $/M tokens; both 0 (or absent/non-numeric) => free
  const inputPerM = parseFloat(model.pricing?.prompt ?? '') * 1_000_000;
  const outputPerM = parseFloat(model.pricing?.completion ?? '') * 1_000_000;
  const isFree = !Number.isFinite(inputPerM) || !Number.isFinite(outputPerM) || (inputPerM === 0 && outputPerM === 0);
  const chatPrice = isFree ? { input: 'free' as const, output: 'free' as const } : { input: inputPerM, output: outputPerM };

  const isPreview = !!model.preview;
  const label = (model.name || model.id.replaceAll(/[_-]/g, ' ')) + (isPreview ? ' (Preview)' : '');

  return {
    idPrefix: model.id,
    isPreview,
    label,
    description: model.description || 'New Cerebras model.',
    contextWindow: limits.max_context_length || 131072,
    ...(limits.max_completion_tokens ? { maxCompletionTokens: limits.max_completion_tokens } : {}),
    interfaces,
    ...(parameterSpecs.length ? { parameterSpecs } : {}),
    chatPrice,
    // visible by default (forward-compat): surface new models with their real catalog metadata
  };
}

function _cerebrasModelFilter(model: WireCerebrasModel): boolean {
  // drop deprecated models
  if (model.deprecated) return false;
  // drop clearly non-text models (pure image/embedding); keep when modality is unknown (forward-compat)
  const modality = model.architecture?.modality;
  if (modality && !modality.includes('text')) return false;
  return !!model.id;
}

function _cerebrasModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;

  // sort as per their order in the known models
  const aIndex = _knownCerebrasModels.findIndex((base) => a.id.startsWith(base.idPrefix));
  const bIndex = _knownCerebrasModels.findIndex((base) => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1; // known before unknown
  if (bIndex !== -1) return 1;

  return a.id.localeCompare(b.id);
}


/**
 * Lists Cerebras models. Two paths, keyed on CSF (Direct Connection):
 * - NON-CSF (server): api.cerebras.ai is behind Cloudflare bot-management, which 403s the server fetch
 *   with a challenge page. Skip the doomed network call and serve the editorial catalog as-is.
 * - CSF (the default, runs in the browser): the browser passes Cloudflare, so fetch the rich live
 *   /public/v1/models catalog for full metadata + forward-compatible discovery of new models.
 * Kept here (not in the shared dispatch) because the endpoint, wire schema, CSF branching, and
 * editorial overrides are all Cerebras-specific.
 */
export async function cerebrasFetchModelDescriptions(access: OpenAIAccessSchema, signal?: AbortSignal): Promise<ModelDescriptionSchema[]> {

  // [non-CSF] don't even attempt the server->Cloudflare fetch (always 403s) - use the hardcoded DB
  if (!access.clientSideFetch)
    return _cerebrasEditorialModelDescriptions();

  // [CSF] in-browser fetch of the rich public catalog (no User-Agent: browsers forbid it, and the
  // browser already clears Cloudflare). Unauthenticated, but routed through openAIAccess to keep the
  // "missing key" UX consistent with the rest of the listing pipeline.
  const _wire = createDebugWireLogger('LLMs/Cerebras');
  const { headers, url } = openAIAccess(access, null, CEREBRAS_PUBLIC_MODELS_PATH);
  _wire?.logRequest('GET', url, headers);
  const wireModels = await fetchJsonOrTRPCThrow({ url, headers, name: 'Cerebras', signal });
  _wire?.logResponse(wireModels);

  return _cerebrasModelsToModelDescriptions(wireModels);
}


/** Converts the editorial _knownCerebrasModels table directly to descriptions (no API). */
function _cerebrasEditorialModelDescriptions(): ModelDescriptionSchema[] {
  return _knownCerebrasModels
    // each entry matches itself exactly in fromManualMapping, so the editorial def wins; the fallback is never used
    .map((known) => fromManualMapping(_knownCerebrasModels, known.idPrefix, undefined, undefined, _CEREBRAS_EDITORIAL_DUMMY_FALLBACK))
    .sort(_cerebrasModelSortFn);
}

const _CEREBRAS_EDITORIAL_DUMMY_FALLBACK: KnownModel = { idPrefix: '', label: '', description: '', contextWindow: null, interfaces: [LLM_IF_OAI_Chat] };

/**
 * Parses the rich /public/v1/models catalog into model descriptions.
 * Editorial table wins for known models; tolerant API-derived fallback for unknown/new models.
 */
function _cerebrasModelsToModelDescriptions(wireResponse: unknown): ModelDescriptionSchema[] {
  const models = wireCerebrasListOutputSchema.parse(wireResponse).data ?? [];

  // [DEV] check for stale editorial definitions (unknowns are expected - they flow through the fallback)
  _cerebrasValidateModelDefs_DEV(models.map((m) => m.id));

  return models
    .filter(_cerebrasModelFilter)
    .map((model): ModelDescriptionSchema => {
      // editorial (known) wins; rich fallback fills unknown/new models
      const description = fromManualMapping(_knownCerebrasModels, model.id, model.created || undefined, undefined, _cerebrasApiModelToFallback(model));

      // pubDate fallback: derive a day-precision pubDate from the API 'created' to drive the "new" badge.
      // An editorial pubDate (from _knownCerebrasModels) always wins.
      if (description.pubDate === undefined && description.created) description.pubDate = formatPubDate(description.created);

      return description;
    })
    .sort(_cerebrasModelSortFn);
}

function _cerebrasValidateModelDefs_DEV(apiModelIds: string[]): void {
  if (DEV_DEBUG_CEREBRAS_MODELS)
    llmDevCheckModels_DEV(
      'Cerebras',
      apiModelIds,
      _knownCerebrasModels.map((m) => m.idPrefix),
      { checkUnknown: false },
    );
}
