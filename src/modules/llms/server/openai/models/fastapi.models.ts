import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';

import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from './models.data';


const _fastAPIKnownModels: ManualMappings = [
  // NOTE: we don't need manual patching as we have enough info for now
] as const;

const _fastAPIDenyListContains: string[] = [
  // nothing to deny for now
] as const;


// const fastAPIListOutputSchema = z.object({
//   id: z.string(),
//   object: z.literal('model'),
//   created: z.number(),
//   owned_by: z.string(),
//   root: z.string(),
//   parent: z.unknown(),
//   permission: z.array(ModelPermissionSchema ... ),
// });

/**
 * FastAPI models - minimal heuristics for enumeration using as much data as we can get.
 */
export function fastAPIHeuristic(models: OpenAIWire_API_Models_List.Model[]) {
  if (!models.length) return false;
  return models.some(model => model.owned_by === 'fastchat');
}

/**
 * NOTES:
 * - we assume all models are chat models that support the OpenAI ChatCompletion API
 * - we assume all models can take image inputs and produce function calls
 * - we don't have context window information
 */
export function fastAPIModels(models: OpenAIWire_API_Models_List.Model[]): ModelDescriptionSchema[] {
  return models
    .filter((model) => !_fastAPIDenyListContains.some(contains => model.id.includes(contains)))
    .map((model): ModelDescriptionSchema => {

      // heuristics
      const label = model.id; // assume the model ID is the label - as-is, don't even improve case/hyphens
      const description = 'FastAPI model. No additional information is provided by the API (capabilities, context window size, parameters, etc.).';
      const contextWindow = null; // NOTE: this is the worst part
      const interfaces: DModelInterfaceV1[] = [
        LLM_IF_OAI_Chat,    // assume all models are chat models
        // we can't know these permissions, so we unblock them from preventive warning, but some models won't support these
        LLM_IF_OAI_Vision,  // assume image inputs
        LLM_IF_OAI_Fn,      // assume can output function calls
        // LLM_IF_OAI_Json,    // assume can output json
      ];

      return fromManualMapping(_fastAPIKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        // parameterSpecs: ...
        // maxCompletionTokens: ...
        // trainingDataCutoff: ...
        // benchmark: ...
        // chatPrice,
        hidden: false,
      });

    });
}
