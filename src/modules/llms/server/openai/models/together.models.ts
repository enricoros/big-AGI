import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from '../../models.mappings';
import { wireTogetherAIListOutputSchema } from '../wiretypes/togetherai.wiretypes';


// Note: 2025-01-28 - we used to have harcoded models here, but now we have a dynamic
// list from the API, so we don't need to hardcode them here anymore.
const _knownTogetherAIChatModels: ManualMappings = [
  // {
  //   idPrefix: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  //   label: 'Llama 3.3 70B Instruct Turbo',
  //   description: 'Llama 3.3 70B Instruct Turbo is an advanced model from Meta with a context length of 131072 tokens, using FP8 quantization.',
  //   contextWindow: 131072,
  //   interfaces: [LLM_IF_OAI_Chat],
  // },
] as const;

// allow list patterns
const _togetherAllowTypes = [
  'chat',
];

const _togetherAIDenyList: string[] = [
  'devuser/test',
  'test-lora',
  'test/test',
];

export function togetherAIModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {

  function togetherAIModelsSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
    if (a.hidden && !b.hidden)
      return 1;
    if (!a.hidden && b.hidden)
      return -1;
    if (a.created !== b.created)
      return (b.created || 0) - (a.created || 0);
    return a.id.localeCompare(b.id);
  }

  return wireTogetherAIListOutputSchema
    .parse(wireModels)

    .filter((model) => {
      // filter-out non-llms
      if (!_togetherAllowTypes.includes(model.type))
        return false;

      // NOTE: shall we filter out the non-running models?

      // filter-out deny list (testing models mainly)
      return !_togetherAIDenyList.some(prefix => model.id.includes(prefix));
    })

    .map((model): ModelDescriptionSchema => {

      // heuristics for names
      const label = model.display_name || model.id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' ');
      const description = `${model.organization || 'Toghether AI'} ${model.type} model. ${model.link || ''}`;
      const contextWindow = model.context_length || null;
      let chatPrice: ModelDescriptionSchema['chatPrice'] | undefined = undefined;
      if (typeof model.pricing?.input === 'number' && typeof model.pricing?.output === 'number') {
        const inputPrice = parseFloat('' + model.pricing.input);
        const outputPrice = parseFloat('' + model.pricing.output);
        if (inputPrice >= 0 && outputPrice >= 0)
          chatPrice = {
            input: model.pricing.input,
            output: model.pricing.output,
          };
      }
      const interfaces = [LLM_IF_OAI_Chat];
      if (model.id.indexOf('vision') !== -1)
        interfaces.push(LLM_IF_OAI_Vision);

      return fromManualMapping(_knownTogetherAIChatModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        // parameterSpecs: ...
        // maxCompletionTokens: ...
        // trainingDataCutoff: ...
        // benchmark: ...
        chatPrice,
        hidden: false,
      });
    })

    .sort(togetherAIModelsSort);
}
