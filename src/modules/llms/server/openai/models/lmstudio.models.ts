import * as z from 'zod/v4';

import { LLM_IF_HOTFIX_NoWebP, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import type { OpenAIAccessSchema } from '../openai.access';
import { openAIAccess } from '../openai.access';


/**
 * LM Studio Native API Path for listing models.
 * Different from the OpenAI-compatible `/v1/models` endpoint.
 */
export const LMSTUDIO_API_PATHS = {
  models: '/api/v1/models',
} as const;


// Wire Types for LM Studio Native API

export namespace LMStudioWire_API_Models_List {

  export type Model = z.infer<typeof Model_schema>;
  const Model_schema = z.object({
    type: z.enum(['llm', 'embedding']).or(z.string()),
    publisher: z.string().optional(),
    key: z.string(),
    display_name: z.string().optional(),
    architecture: z.string().nullish(),
    quantization: z.object({
      name: z.string().nullish(),
      bits_per_weight: z.number().nullish(),
    }).nullish(),
    size_bytes: z.number().optional(),
    params_string: z.string().nullish(),
    loaded_instances: z.array(z.object({
      id: z.string().optional(),
      config: z.object({
        context_length: z.number().optional(),
        eval_batch_size: z.number().optional(),
        flash_attention: z.boolean().optional(),
        num_experts: z.number().optional(),
        offload_kv_cache_to_gpu: z.boolean().optional(),
      }).optional(),
    })).optional(),
    max_context_length: z.number().optional(),
    format: z.enum(['gguf', 'mlx']).or(z.string()).nullish(),
    capabilities: z.object({
      vision: z.boolean().optional(),
      trained_for_tool_use: z.boolean().optional(),
    }).nullish(),
    description: z.string().nullish(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    models: z.array(Model_schema),
  });

}


export async function lmStudioFetchModels(access: OpenAIAccessSchema): Promise<LMStudioWire_API_Models_List.Response> {
  const { headers, url } = openAIAccess(access, null, LMSTUDIO_API_PATHS.models);
  const wireModels = await fetchJsonOrTRPCThrow({ url, headers, name: 'LM Studio' });
  return LMStudioWire_API_Models_List.Response_schema.parse(wireModels);
}


export function lmStudioModelsToModelDescriptions(wireModels: LMStudioWire_API_Models_List.Model[]): ModelDescriptionSchema[] {
  return wireModels
    .filter((model) => model.type === 'llm')
    .map((model): ModelDescriptionSchema => {

      const modelId = model.key;

      const label = model.display_name || model.key;

      // build description
      const descs: string[] = [];
      if (model.params_string)
        descs.push(`${model.params_string} parameters`);
      if (model.quantization?.name) {
        const quantInfo = model.quantization.bits_per_weight
          ? `${model.quantization.name} (${model.quantization.bits_per_weight}-bit)`
          : model.quantization.name;
        descs.push(quantInfo);
      }
      if (model.format)
        descs.push(model.format.toUpperCase());
      if (model.size_bytes) {
        const sizeGB = (model.size_bytes / 1024 / 1024 / 1024).toFixed(1);
        descs.push(`${sizeGB} GB`);
      }
      if (model.architecture)
        descs.push(`arch: ${model.architecture}`);
      if (model.publisher)
        descs.push(`by ${model.publisher}`);
      if (model.capabilities?.vision)
        descs.push('[vision]');
      if (model.capabilities?.trained_for_tool_use)
        descs.push('[tool use]');
      if (model.description)
        descs.push(model.description);

      const description = descs.join(' · ') || 'LM Studio model';

      const contextWindow = model.max_context_length || null;

      const interfaces: ModelDescriptionSchema['interfaces'] = [
        LLM_IF_OAI_Chat,
        ...(model.capabilities?.vision ? [LLM_IF_OAI_Vision] : []),
        ...(model.capabilities?.trained_for_tool_use ? [LLM_IF_OAI_Fn] : []),
        LLM_IF_HOTFIX_NoWebP, // because they are not supported
      ];

      // If loaded, use the actual context length from the instance config
      const loadedContextLength = model.loaded_instances?.length
        ? model.loaded_instances[0]?.config?.context_length ?? null
        : null;

      return {
        id: modelId,
        // idVariant
        label,
        // created
        // updated
        description,
        contextWindow: (contextWindow && loadedContextLength) ? Math.max(contextWindow, loadedContextLength) : contextWindow || loadedContextLength,
        interfaces,
        // parameterSpects
        maxCompletionTokens: contextWindow ? Math.round(contextWindow / 2) : undefined,
        // benchmark
        chatPrice: { input: 'free', output: 'free' },
        // hidden
        // initialTemperature
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
