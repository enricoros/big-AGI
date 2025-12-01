import { TRPCError } from '@trpc/server';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { ModelDescriptionSchema } from './llm.server.types';


// protocol: Anthropic
import { AnthropicWire_API_Models_List, hardcodedAnthropicModels, hardcodedAnthropicVariants, llmsAntCreatePlaceholderModel, llmsAntDevCheckForObsoletedModels_DEV, llmsAntInjectWebSearchInterface } from './anthropic/anthropic.models';
import { anthropicAccess } from './anthropic/anthropic.access';

// protocol: Gemini
import { GeminiWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import { geminiAccess } from './gemini/gemini.access';
import { geminiDevCheckForParserMisses_DEV, geminiDevCheckForSuperfluousModels_DEV, geminiFilterModels, geminiModelsAddVariants, geminiModelToModelDescription, geminiSortModels } from './gemini/gemini.models';

// protocol: Ollama
import { OLLAMA_BASE_MODELS } from './ollama/ollama.models';
import { ollamaAccess } from './ollama/ollama.access';
import { wireOllamaListModelsSchema, wireOllamaModelInfoSchema } from './ollama/ollama.wiretypes';

// protocol: OpenAI-compatible
import type { OpenAIWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/openai.wiretypes';
import { openAIAccess } from './openai/openai.access';
import { alibabaModelFilter, alibabaModelSort, alibabaModelToModelDescription } from './openai/models/alibaba.models';
import { azureDeploymentFilter, azureDeploymentToModelDescription, azureParseFromDeploymentsAPI } from './openai/models/azure.models';
import { chutesAIHeuristic, chutesAIModelsToModelDescriptions } from './openai/models/chutesai.models';
import { deepseekInjectVariants, deepseekModelFilter, deepseekModelSort, deepseekModelToModelDescription } from './openai/models/deepseek.models';
import { fastAPIHeuristic, fastAPIModels } from './openai/models/fastapi.models';
import { fireworksAIHeuristic, fireworksAIModelsToModelDescriptions } from './openai/models/fireworksai.models';
import { groqModelFilter, groqModelSortFn, groqModelToModelDescription } from './openai/models/groq.models';
import { lmStudioModelToModelDescription } from './openai/models/lmstudio.models';
import { localAIModelSortFn, localAIModelToModelDescription } from './openai/models/localai.models';
import { mistralModels } from './openai/models/mistral.models';
import { moonshotModelFilter, moonshotModelSortFn, moonshotModelToModelDescription } from './openai/models/moonshot.models';
import { openPipeModelDescriptions, openPipeModelSort, openPipeModelToModelDescriptions } from './openai/models/openpipe.models';
import { openRouterInjectVariants, openRouterModelFamilySortFn, openRouterModelToModelDescription } from './openai/models/openrouter.models';
import { openaiDevCheckForModelsOverlap_DEV, openAIInjectVariants, openAIModelFilter, openAIModelToModelDescription, openAISortModels } from './openai/models/openai.models';
import { perplexityHardcodedModelDescriptions, perplexityInjectVariants } from './openai/models/perplexity.models';
import { togetherAIModelsToModelDescriptions } from './openai/models/together.models';
import { xaiFetchModelDescriptions, xaiModelSort } from './openai/models/xai.models';


// -- Dispatch types --

export type ListModelsDispatch<TWireModels = any> = {
  fetchModels: () => Promise<TWireModels>;
  convertToDescriptions: (wireModels: TWireModels) => ModelDescriptionSchema[];
};

/**
 * Helper to create a dispatch with proper type inference.
 * TypeScript will infer TWireModels from fetchModels return type and enforce it in convertToDescriptions.
 */
function createDispatch<T>(dispatch: ListModelsDispatch<T>): ListModelsDispatch<T> {
  return dispatch;
}


// -- Specialized Implementations -- Core of Server-side LLM Model Listing abstraction --

export async function listModelsRunDispatch(access: AixAPI_Access, signal?: AbortSignal): Promise<ModelDescriptionSchema[]> {
  const dispatch = _listModelsCreateDispatch(access, signal);
  const wireModels = await dispatch.fetchModels();
  return dispatch.convertToDescriptions(wireModels);
}


// stub to reduce dependencies - either server/client or both
function _capitalize(s: string): string {
  return s?.length ? (s.charAt(0).toUpperCase() + s.slice(1)) : s;
}


/**
 * Specializes to the correct vendor a request for listing models.
 * This follows the same pattern as AIX's chatGenerate dispatcher for consistency.
 */
function _listModelsCreateDispatch(access: AixAPI_Access, signal?: AbortSignal): ListModelsDispatch {

  // dialect is the only common property
  const { dialect } = access;

  switch (dialect) {

    case 'anthropic': {
      return createDispatch({
        fetchModels: async () => {
          const { headers, url } = anthropicAccess(access, '/v1/models?limit=1000', {/* ... no options for list ... */ });
          const wireModels = await fetchJsonOrTRPCThrow({ url, headers, name: 'Anthropic', signal });
          return AnthropicWire_API_Models_List.Response_schema.parse(wireModels);
        },
        convertToDescriptions: (wireModelsResponse) => {
          const { data: availableModels } = wireModelsResponse;

          // sort by: family (desc) > class (desc) > date (desc) -- Future NOTE: -5- will match -4-5- and -3-5-.. figure something else out
          const familyPrecedence = ['-4-7-', '-4-5-', '-4-1-', '-4-', '-3-7-', '-3-5-', '-3-'];
          const classPrecedence = ['-opus-', '-sonnet-', '-haiku-'];

          const getFamilyIdx = (id: string) => familyPrecedence.findIndex(f => id.includes(f));
          const getClassIdx = (id: string) => classPrecedence.findIndex(c => id.includes(c));

          // cast the models to the common schema
          const models = availableModels
            .sort((a, b) => {
              const familyA = getFamilyIdx(a.id);
              const familyB = getFamilyIdx(b.id);
              const classA = getClassIdx(a.id);
              const classB = getClassIdx(b.id);

              // family desc (lower index = better, -1 = unknown goes last)
              if (familyA !== familyB) return (familyA === -1 ? 999 : familyA) - (familyB === -1 ? 999 : familyB);
              // class desc
              if (classA !== classB) return (classA === -1 ? 999 : classA) - (classB === -1 ? 999 : classB);
              // date desc (newer first) - string comparison works since format is YYYYMMDD
              return b.id.localeCompare(a.id);
            })
            .reduce((acc: ModelDescriptionSchema[], model) => {
              // find the model description
              const hardcodedModel = hardcodedAnthropicModels.find(m => m.id === model.id);
              if (hardcodedModel) {

                // update creation date
                function roundTime(date: string) {
                  return Math.round(new Date(date).getTime() / 1000);
                }

                if (!hardcodedModel.created && model.created_at)
                  hardcodedModel.created = roundTime(model.created_at);

                // add FIRST a thinking variant, if defined
                if (hardcodedAnthropicVariants[model.id])
                  acc.push({
                    ...hardcodedModel,
                    ...hardcodedAnthropicVariants[model.id],
                  });

                // add the base model
                acc.push(hardcodedModel);
              } else {
                // for day-0 support of new models, create a placeholder model using sensible defaults
                const novelModel = llmsAntCreatePlaceholderModel(model);
                // if (DEV_DEBUG_ANTHROPIC_MODELS) // kind of important...
                console.log('[DEV] anthropic.router: new model found, please configure it:', novelModel.id);
                acc.push(novelModel);
              }
              return acc;
            }, [] as ModelDescriptionSchema[])
            .map(llmsAntInjectWebSearchInterface);

          // [DEV] check for obsoleted models (defined but no longer in API response)
          llmsAntDevCheckForObsoletedModels_DEV(availableModels);

          return models;
        },
      });
    }

    case 'gemini': {
      return createDispatch({
        fetchModels: async () => {
          const { headers, url } = geminiAccess(access, null, GeminiWire_API_Models_List.getPath, false);
          const wireModels = await fetchJsonOrTRPCThrow({ url, headers, name: 'Gemini', signal });
          const detailedModels = GeminiWire_API_Models_List.Response_schema.parse(wireModels).models;

          // [DEV] check for missing or superfluous models
          geminiDevCheckForParserMisses_DEV(wireModels, detailedModels);
          geminiDevCheckForSuperfluousModels_DEV(detailedModels.map((model: any) => model.name));

          return detailedModels;
        },
        convertToDescriptions: (detailedModels) => {
          // NOTE: no need to retrieve info for each of the models (e.g. /v1beta/model/gemini-pro),
          //       as the List API already has all the info on all the models

          // first filter from the original list
          const filteredModels = detailedModels.filter(geminiFilterModels);

          // map to our output schema
          const models = filteredModels
            .map(geminiModelToModelDescription)
            .filter(model => !!model)
            .sort(geminiSortModels);
          return geminiModelsAddVariants(models);
        },
      });
    }

    case 'ollama': {
      return createDispatch({
        fetchModels: async () => {
          const { headers, url } = ollamaAccess(access, '/api/tags');
          const wireModels = await fetchJsonOrTRPCThrow({ url, headers, name: 'Ollama', signal });
          const models = wireOllamaListModelsSchema.parse(wireModels).models;

          // retrieve info for each of the models
          return await Promise.all(models.map(async (model) => {

            // perform /api/show on each model to get detailed info
            const { headers, url } = ollamaAccess(access, '/api/show');
            const wireModelInfo = await fetchJsonOrTRPCThrow({ url, method: 'POST', headers, body: { 'name': model.name }, name: 'Ollama', signal });

            const modelInfo = wireOllamaModelInfoSchema.parse(wireModelInfo);
            return { ...model, ...modelInfo };
          }));
        },
        convertToDescriptions: (detailedModels) => {
          return detailedModels.map((model) => {
            // the model name is in the format "name:tag" (default tag = 'latest')
            const [modelName, modelTag] = model.name.split(':');

            // pretty label and description
            const label = _capitalize(modelName) + ((modelTag && modelTag !== 'latest') ? ` (${modelTag})` : '');
            const baseModel = OLLAMA_BASE_MODELS[modelName] ?? {};
            let description = ''; // baseModel.description || 'Model unknown'; // REMOVED description - bloated and not used by nobody

            // prepend the parameters count and quantization level
            if (model.details?.quantization_level || model.details?.format || model.details?.parameter_size) {
              let firstLine = model.details.parameter_size ? `${model.details.parameter_size} parameters ` : '';
              if (model.details.quantization_level)
                firstLine += `(${model.details.quantization_level}` + ((model.details.format) ? `, ${model.details.format})` : ')');
              if (model.size)
                firstLine += `, ${(model.size / 1024 / 1024 / 1024).toFixed(1)} GB`;
              if (baseModel.hasTools)
                firstLine += ' [tools]';
              if (baseModel.hasVision)
                firstLine += ' [vision]';
              description = firstLine + '\n\n' + description;
            }

            /* Find the context window from the 'num_ctx' line in the parameters string, if present
             *  - https://github.com/enricoros/big-AGI/issues/309
             *  - Note: as of 2024-01-26 the num_ctx line is present in 50% of the models, and in most cases set to 4096
             *  - We are tracking the Upstream issue https://github.com/ollama/ollama/issues/1473 for better ways to do this in the future
             */
            let contextWindow = baseModel.contextWindow || 8192;
            if (model.parameters) {
              // split the parameters into lines, and find one called "num_ctx ...spaces... number"
              const paramsNumCtx = model.parameters.split('\n').find((line) => line.startsWith('num_ctx '));
              if (paramsNumCtx) {
                const numCtxValue: string = paramsNumCtx.split(/\s+/)[1];
                if (numCtxValue) {
                  const numCtxNumber: number = parseInt(numCtxValue);
                  if (!isNaN(numCtxNumber))
                    contextWindow = numCtxNumber;
                }
              }
            }

            // auto-detect interfaces from the hardcoded description (in turn parsed from the html page)
            const interfaces = !baseModel.isEmbeddings ? [LLM_IF_OAI_Chat] : [];
            if (baseModel.hasTools)
              interfaces.push(LLM_IF_OAI_Fn);
            if (baseModel.hasVision || modelName.includes('-vision')) // Heuristic
              interfaces.push(LLM_IF_OAI_Vision);

            // console.log('>>> ollama model', model.name, model.template, model.modelfile, '\n');

            return {
              id: model.name,
              label,
              created: Date.parse(model.modified_at) ?? undefined,
              updated: Date.parse(model.modified_at) ?? undefined,
              description: description, // description: (model.license ? `License: ${model.license}. Info: ` : '') + model.modelfile || 'Model unknown',
              contextWindow,
              ...(contextWindow ? { maxCompletionTokens: Math.round(contextWindow / 2) } : {}),
              interfaces,
            };
          });
        },
      });
    }

    case 'perplexity':
      // [Perplexity]: there's no API for models listing (upstream: https://docs.perplexity.ai/getting-started/pricing#sonar-models-chat-completions)
      return createDispatch({
        fetchModels: async () => null,
        convertToDescriptions: () => perplexityHardcodedModelDescriptions().reduce(perplexityInjectVariants, []),
      });

    case 'xai':
      // [xAI]: custom models listing
      return createDispatch({
        fetchModels: async () => xaiFetchModelDescriptions(access),
        convertToDescriptions: models => models.sort(xaiModelSort),
      });

    case 'alibaba':
    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'moonshot':
    case 'openai':
    case 'openpipe':
    case 'openrouter':
    case 'togetherai':
      return createDispatch({

        // [OpenAI-compatible dialects]: fetch openAI-style /v1/models API
        fetchModels: async () => {
          const { headers, url } = openAIAccess(access, null, '/v1/models');
          return fetchJsonOrTRPCThrow<OpenAIWire_API_Models_List.Response>({ url, headers, name: `OpenAI/${_capitalize(dialect)}`, signal });
        },

        // OpenAI models conversions: dependent on the dialect
        convertToDescriptions: (openAIWireModelsResponse) => {

          // [Together] missing the .data property - so we have to do this early
          if (dialect === 'togetherai')
            return togetherAIModelsToModelDescriptions(openAIWireModelsResponse);

          // NOTE: we don't zod here as it would strip unknown properties needed for some dialects - so we proceed optimistically
          // let maybeModels = OpenAIWire_API_Models_List.Response_schema.parse(openAIWireModelsResponse).data || [];
          let maybeModels = openAIWireModelsResponse?.data || [];

          // de-duplicate by ids (can happen for local servers.. upstream bugs)
          const preCount = maybeModels.length;
          maybeModels = maybeModels.filter((model, index) => maybeModels.findIndex(m => m.id === model.id) === index);
          if (preCount !== maybeModels.length && dialect !== 'mistral' /* [Mistral, 2025-11-17] Mistral has 2 duplicate models */)
            console.warn(`openai.router.listModels: removed ${preCount - maybeModels.length} duplicate models for dialect ${dialect}`);

          // sort by id
          maybeModels.sort((a, b) => a.id.localeCompare(b.id));

          // every dialect has a different way to enumerate models - we execute the mapping on the server side
          switch (dialect) {
            case 'alibaba':
              return maybeModels
                .filter(({ id }) => alibabaModelFilter(id))
                .map(({ id, created }) => alibabaModelToModelDescription(id, created))
                .sort(alibabaModelSort);

            case 'azure':
              const azureOpenAIDeployments = azureParseFromDeploymentsAPI(maybeModels);
              return azureOpenAIDeployments
                .filter(azureDeploymentFilter)
                .map(azureDeploymentToModelDescription)
                .sort(openAISortModels);

            case 'deepseek':
              // [DeepSeek, 2025-12-01] Inject V3.2-Speciale variant via reduce
              return maybeModels
                .filter(({ id }) => deepseekModelFilter(id))
                .map(({ id }) => deepseekModelToModelDescription(id))
                .reduce(deepseekInjectVariants, [] as ModelDescriptionSchema[])
                .sort(deepseekModelSort);

            case 'groq':
              return maybeModels
                .filter(groqModelFilter)
                .map(groqModelToModelDescription)
                .sort(groqModelSortFn);

            case 'lmstudio':
              return maybeModels
                .map(({ id }) => lmStudioModelToModelDescription(id));

            case 'localai':
              return maybeModels
                .map(({ id }) => localAIModelToModelDescription(id))
                .sort(localAIModelSortFn);

            case 'mistral':
              return mistralModels(maybeModels);

            case 'moonshot':
              return maybeModels
                .filter(moonshotModelFilter)
                .map(moonshotModelToModelDescription)
                .sort(moonshotModelSortFn);

            case 'openai':
              // [ChutesAI] special case for model enumeration
              const oaiHost = access.oaiHost;
              if (chutesAIHeuristic(oaiHost))
                return chutesAIModelsToModelDescriptions(maybeModels);

              // [FireworksAI] special case for model enumeration
              if (fireworksAIHeuristic(oaiHost))
                return fireworksAIModelsToModelDescriptions(maybeModels);

              // [FastChat] make the best of the little info
              if (fastAPIHeuristic(maybeModels))
                return fastAPIModels(maybeModels);

              // [OpenAI or OpenAI-compatible]: chat-only models, custom sort, manual mapping
              const models = maybeModels
                // limit to only 'gpt' and 'non instruct' models
                .filter(openAIModelFilter)
                // to model description
                .map((model: any): ModelDescriptionSchema => openAIModelToModelDescription(model.id, model.created))
                // inject variants
                .reduce(openAIInjectVariants, [] as ModelDescriptionSchema[])
                // custom OpenAI sort
                .sort(openAISortModels);

              // [DEV] check for superfluous and missing models
              openaiDevCheckForModelsOverlap_DEV(maybeModels, models);
              return models;

            case 'openpipe':
              return [
                ...maybeModels.map(openPipeModelToModelDescriptions),
                ...openPipeModelDescriptions().sort(openPipeModelSort),
              ];

            case 'openrouter':
              // openRouterStatTokenizers(maybeModels);
              return maybeModels
                .sort(openRouterModelFamilySortFn)
                .map(openRouterModelToModelDescription)
                .filter(desc => !!desc)
                .reduce(openRouterInjectVariants, [] as ModelDescriptionSchema[]);

            default:
              const _exhaustiveCheck: never = dialect;
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Unhandled dialect: ${dialect}` });
          }
        },
      });

    default:
      const _exhaustiveCheck: never = dialect;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Unsupported dialect: ${dialect}` });
  }
}
