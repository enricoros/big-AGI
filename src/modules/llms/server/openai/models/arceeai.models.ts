import * as z from 'zod/v4';

import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- Arcee AI Model ID inference (auto-derived from _arceeKnownModels) ---
export type LlmsArceeAIModelId = typeof _arceeKnownModels[number]['idPrefix'];


export function arceeAIHeuristic(hostname: string) {
  return hostname.includes('arcee.ai');
}


// Arcee AI /v1/models response schema

// [Arcee, 2026-08-31] the API moved to an OpenRouter-style shape: modalities under `architecture`,
// capability flags in `supported_parameters`, effort ladder under `reasoning`. Replaces the 2026-08-17
// top-level input_modalities/supported_features/supported_reasoning_efforts/max_output_length/quantization
// (all gone from the wire). Pricing sub-shape unchanged (per-token strings).
const _wireArceeAIModelSchema = z.object({
  id: z.string(),
  hugging_face_id: z.string().nullish(),
  name: z.string().nullish(),
  created: z.number().nullish(),
  description: z.string().nullish(),
  context_length: z.number().nullish(),
  architecture: z.object({
    input_modalities: z.array(z.string()).nullish(),
    output_modalities: z.array(z.string()).nullish(),
  }).nullish(),
  supported_parameters: z.array(z.string()).nullish(),
  reasoning: z.object({
    default_enabled: z.boolean().nullish(),
    supported_efforts: z.array(z.string()).nullish(),
    default_effort: z.string().nullish(),
  }).nullish(),
  pricing: z.object({
    prompt: z.string().nullish(),
    completion: z.string().nullish(),
    image: z.string().nullish(),
    request: z.string().nullish(),
    input_cache_read: z.string().nullish(),
  }).nullish(),
});

const _wireArceeAIListOutputSchema = z.object({
  data: z.array(_wireArceeAIModelSchema),
});

type WireArceeAIModel = z.infer<typeof _wireArceeAIModelSchema>;


const _arceeKnownModels = llmsDefineManualMappings([
  // NOTE: no manual patching needed - API provides rich metadata
]);


/**
 * The per-model effort ladder is declared by the API itself, so we never hardcode one:
 * `reasoning.supported_efforts` (2026-08-31 schema) draws from exactly these values.
 * Absent/empty -> no effort control. The wire order is unordered - render in this canonical order.
 */
const _arceeEffortValues = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;


function _prettyModelName(model: WireArceeAIModel): string {
  if (model.name)
    return model.name;
  // fallback: capitalize the id
  return model.id
    .replaceAll(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}


function _arceePerTokenToPerMToken(perToken: string | undefined): number | undefined {
  if (!perToken) return undefined;
  const val = parseFloat(perToken);
  if (!val || !isFinite(val)) return undefined;
  return Math.round(val * 1_000_000 * 1000) / 1000; // round to 3 decimals
}


export function arceeAIModelsToModelDescriptions(wireModelsResponse: unknown): ModelDescriptionSchema[] {
  return _wireArceeAIListOutputSchema.parse(wireModelsResponse).data

    .map((model): ModelDescriptionSchema => {

      const dateSuffix = model.created ? ` (${new Date(model.created * 1000).toISOString().slice(0, 10)})` : '';
      const label = _prettyModelName(model) + dateSuffix;
      const descParts = [(model.description || 'Arcee AI model').replace(/^"+|"+$/g, '')]; // some descriptions arrive quote-wrapped
      if (model.hugging_face_id)
        descParts.push(`- ${model.hugging_face_id}`);
      const description = descParts.join(' ') + '.';
      const contextWindow = model.context_length || null;
      // maxCompletionTokens: no longer published (2026-08-31 schema)

      // detect interfaces from supported_parameters + architecture
      const params = new Set(model.supported_parameters || []);
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
      if (params.has('tools'))
        interfaces.push(LLM_IF_OAI_Fn);
      if (model.architecture?.input_modalities?.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);
      if (params.has('response_format') || params.has('structured_outputs'))
        interfaces.push(LLM_IF_OAI_Json);
      if (params.has('reasoning'))
        interfaces.push(LLM_IF_OAI_Reasoning);

      // effort ladder: only what this model declares, in canonical order
      const efforts = _arceeEffortValues.filter(e => model.reasoning?.supported_efforts?.includes(e));

      // pricing: Arcee returns per-token as strings, convert to per-million-tokens
      const inputPrice = _arceePerTokenToPerMToken(model.pricing?.prompt ?? undefined);
      const outputPrice = _arceePerTokenToPerMToken(model.pricing?.completion ?? undefined);
      const cacheReadPrice = _arceePerTokenToPerMToken(model.pricing?.input_cache_read ?? undefined);
      const chatPrice = (inputPrice !== undefined || outputPrice !== undefined) ? {
        input: inputPrice,
        output: outputPrice,
        ...(cacheReadPrice ? { cache: { read: cacheReadPrice } } : {}),
      } : undefined;

      return fromManualMapping(_arceeKnownModels, model.id, model.created ?? undefined, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        ...(efforts.length ? { parameterSpecs: [{ paramId: 'llmVndOaiEffort' as const, enumValues: efforts }] } : {}),
        chatPrice,
        hidden: false,
      });
    })

    .sort((a: ModelDescriptionSchema, b: ModelDescriptionSchema): number => {
      if (a.created !== b.created)
        return (b.created || 0) - (a.created || 0);
      return a.id.localeCompare(b.id);
    });
}
