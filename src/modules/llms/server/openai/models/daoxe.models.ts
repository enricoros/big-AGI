import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';


export function daoxeHeuristic(hostname: string) {
  // Match daoxe.com and subdomains (e.g. api.daoxe.com if used)
  return hostname === 'daoxe.com' || hostname.endsWith('.daoxe.com');
}


const _daoxeKnownModels = llmsDefineManualMappings([
  // No static model/price table: DaoXE catalogs are account-scoped and change over time.
  // Runtime /v1/models is the source of truth.
]);

const _daoxeDenyListContains: string[] = [
  // keep empty unless a non-chat id pattern appears
] as const;


function _prettyModelId(modelId: string): string {
  return modelId
    .replaceAll(/[_-]/g, ' ')
    .split(' ')
    .map(piece => {
      if (piece.match(/^\d+(\.\d+)*$/)) return piece;
      if (piece.toLowerCase() === 'ai') return 'AI';
      if (piece.match(/^v\d/i)) return piece.toUpperCase();
      return serverCapitalizeFirstLetter(piece);
    })
    .join(' ')
    .trim();
}


/**
 * Map DaoXE OpenAI-compatible /v1/models list to Big-AGI model descriptions.
 * Prefer live account catalog fields; do not invent a public static price list.
 */
export function daoxeModelsToModelDescriptions(
  models: OpenAIWire_API_Models_List.Model[],
): ModelDescriptionSchema[] {
  return models
    .filter((model) => !_daoxeDenyListContains.some((denied) => model.id.toLowerCase().includes(denied)))
    .map((model): ModelDescriptionSchema => {
      const label = _prettyModelId(model.id);
      const description = 'DaoXE multi-model multi-protocol gateway model (OpenAI-compatible Chat Completions).';

      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];
      // Soft heuristics only — account catalog may differ
      if (/vision|gpt-4o|claude|gemini|llava/i.test(model.id))
        interfaces.push(LLM_IF_OAI_Vision);

      return fromManualMapping(_daoxeKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow: null,
        interfaces,
        // No chatPrice: avoid hardcoding public rates; users see live DaoXE pricing in-account.
        hidden: false,
      });
    });
}
