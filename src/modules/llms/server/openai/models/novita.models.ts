import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';
import { wireNovitaListOutputSchema, WireNovitaModel } from '../wiretypes/novita.wiretypes';


export function novitaHeuristic(hostname: string) {
  return hostname.includes('novita.ai');
}


const _novitaKnownModels: ManualMappings = [
  // NOTE: we don't need manual patching as we have enough info from API
] as const;

const _novitaDenyListContains: string[] = [
  // OCR models - not chat models
  'paddleocr',
  'deepseek-ocr',
] as const;


function _prettyModelId(model: WireNovitaModel): string {
  // Use display_name if available, otherwise format id
  if (model.display_name)
    return model.display_name;
  if (model.title)
    return model.title;

  // Format id: "deepseek/deepseek-v3-0324" => "Deepseek V3 0324"
  return model.id
    .replace(/^[^/]+\//, '') // remove vendor prefix like "deepseek/"
    .replaceAll(/[_-]/g, ' ') // replace underscores or dashes with spaces
    .split(' ')
    .map(piece => {
      if (piece.match(/^\d+(\.\d+)*$/)) return piece; // keep version numbers as-is
      if (piece.toLowerCase() === 'ai') return 'AI';
      if (piece.match(/^v\d/i)) return piece.toUpperCase(); // V1, V2, V3
      return piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}


export function novitaModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  const parsed = wireNovitaListOutputSchema.parse(wireModels);

  return parsed.data
    // Filter out non-chat models and denied models
    .filter((model) => {
      // Only include chat models
      if (model.model_type && model.model_type !== 'chat')
        return false;

      // Skip models without chat endpoints
      if (model.endpoints && !model.endpoints.includes('chat/completions'))
        return false;

      // Apply deny list
      return !_novitaDenyListContains.some(denied => model.id.toLowerCase().includes(denied));
    })

    .map((model): ModelDescriptionSchema => {
      // Label
      const label = _prettyModelId(model);

      // Description
      let description = model.description || '';
      if (description.length > 200)
        description = description.slice(0, 200) + '...';

      // Context window
      const contextWindow = model.context_size || 8192;

      // Max completion tokens
      const maxCompletionTokens = model.max_output_tokens || undefined;

      // Interfaces
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];

      // Check features array for capabilities
      const features = model.features || [];
      if (features.includes('function-calling'))
        interfaces.push(LLM_IF_OAI_Fn);
      if (features.includes('reasoning'))
        interfaces.push(LLM_IF_OAI_Reasoning);
      if (features.includes('structured-outputs'))
        interfaces.push(LLM_IF_OAI_Json);

      // Check input modalities for vision
      const inputModalities = model.input_modalities || [];
      if (inputModalities.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);

      // Pricing: API returns hundredths of a cent per million tokens, convert to dollars per 1K tokens
      // e.g., 700 = $0.007 per 1M = $0.000007 per 1K
      const chatPrice = (model.input_token_price_per_m !== undefined && model.output_token_price_per_m !== undefined)
        ? {
          input: model.input_token_price_per_m / 10000,
          output: model.output_token_price_per_m / 10000,
        }
        : undefined;

      return fromManualMapping(_novitaKnownModels, model.id, model.created, undefined, {
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
      // Sort by creation date (newer first), then by id
      if (a.created !== b.created)
        return (b.created || 0) - (a.created || 0);
      return a.id.localeCompare(b.id);
    });
}
