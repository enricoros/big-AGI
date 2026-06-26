import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { formatPubDate, fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- TogetherAI Model ID inference (auto-derived from _knownTogetherAIChatModels) ---
export type LlmsTogetherAIModelId = typeof _knownTogetherAIChatModels[number]['idPrefix'];
import { wireTogetherAIListOutputSchema } from '../wiretypes/togetherai.wiretypes';


// Note: 2025-01-28 - we used to have harcoded models here, but now we have a dynamic
// list from the API, so we don't need to hardcode them here anymore.
const _knownTogetherAIChatModels = llmsDefineManualMappings([
  // {
  //   idPrefix: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  //   label: 'Llama 3.3 70B Instruct Turbo',
  //   description: 'Llama 3.3 70B Instruct Turbo is an advanced model from Meta with a context length of 131072 tokens, using FP8 quantization.',
  //   contextWindow: 131072,
  //   interfaces: [LLM_IF_OAI_Chat],
  // },
]);

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
      // filter-out models that don't even have the type
      if (!model.type)
        return false;

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
      const description = `${model.organization || 'Together AI'} ${model.type} model. ${model.link || ''}`;
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
      // vision detection by id string (Together's API exposes no modality field): 'vision'/'-vl' plus
      // families that are natively multimodal across all variants (Llama 4 Scout/Maverick, Pixtral)
      const lcId = model.id.toLowerCase();
      if (lcId.includes('vision') || lcId.includes('-vl') || lcId.includes('llama-4') || lcId.includes('pixtral'))
        interfaces.push(LLM_IF_OAI_Vision);

      const md = fromManualMapping(_knownTogetherAIChatModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        // parameterSpecs: ...
        // maxCompletionTokens: ...
        // benchmark: ...
        chatPrice,
        hidden: false,
      });

      // pubDate fallback: TogetherAI's 'created' is verified real per-model release/index dates (225 unique,
      // 2023-2026 spread, not a constant; ~34 models omit it and simply get no badge), so derive a day-precision
      // pubDate to drive the "new" badge for models without an editorial pubDate. Editorial pubDate always wins.
      if (md.pubDate === undefined && md.created)
        md.pubDate = formatPubDate(md.created);

      return md;
    })

    .sort(togetherAIModelsSort);
}
