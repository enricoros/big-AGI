import * as z from 'zod/v4';

import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


export function arceeAIHeuristic(hostname: string) {
  return hostname.includes('arcee.ai');
}


// Arcee AI /v1/models response schema

const _wireArceeAIModelSchema = z.object({
  id: z.string(),
  hugging_face_id: z.string().nullish(),
  name: z.string().nullish(),
  created: z.number().nullish(),
  description: z.string().nullish(),
  input_modalities: z.array(z.string()).nullish(),
  output_modalities: z.array(z.string()).nullish(),
  context_length: z.number().nullish(),
  max_output_length: z.number().nullish(),
  quantization: z.string().nullish(),
  supported_features: z.array(z.string()).nullish(),
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


const _arceeKnownModels: ManualMappings = [
  // NOTE: no manual patching needed - API provides rich metadata
] as const;


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
      const descParts = [model.description || 'Arcee AI model'];
      if (model.quantization)
        descParts.push(`(${model.quantization})`);
      if (model.hugging_face_id)
        descParts.push(`- ${model.hugging_face_id}`);
      const description = descParts.join(' ') + '.';
      const contextWindow = model.context_length || null;
      const maxCompletionTokens = model.max_output_length || undefined;

      // detect interfaces from supported_features
      const features = new Set(model.supported_features || []);
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];
      if (model.input_modalities?.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);
      if (features.has('json_mode'))
        interfaces.push(LLM_IF_OAI_Json);
      if (features.has('reasoning'))
        interfaces.push(LLM_IF_OAI_Reasoning);

      // pricing: Arcee returns per-token as strings, convert to per-million-tokens
      const inputPrice = _arceePerTokenToPerMToken(model.pricing?.prompt ?? undefined);
      const outputPrice = _arceePerTokenToPerMToken(model.pricing?.completion ?? undefined);
      const cacheReadPrice = _arceePerTokenToPerMToken(model.pricing?.input_cache_read ?? undefined);
      const chatPrice = (inputPrice !== undefined || outputPrice !== undefined) ? {
        input: inputPrice,
        output: outputPrice,
        ...(cacheReadPrice ? { cache: { cType: 'oai-ac' as const, read: cacheReadPrice } } : {}),
      } : undefined;

      return fromManualMapping(_arceeKnownModels, model.id, model.created ?? undefined, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        maxCompletionTokens,
        interfaces,
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
