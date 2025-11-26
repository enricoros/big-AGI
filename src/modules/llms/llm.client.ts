import { hasGoogleAnalytics, sendGAEvent } from '~/common/components/3rdparty/GoogleAnalytics';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DLLM, DModelInterfaceV1, LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';
import { applyModelParameterInitialValues, FALLBACK_LLM_PARAM_TEMPERATURE } from '~/common/stores/llms/llms.parameters';
import { isModelPricingFree } from '~/common/stores/llms/llms.pricing';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';

import type { ModelDescriptionSchema } from './server/llm.server.types';
import { findServiceAccessOrThrow } from './vendors/vendor.helpers';


// LLM Model Updates Client Functions

export async function llmsUpdateModelsForServiceOrThrow(serviceId: DModelsServiceId, keepUserEdits: boolean): Promise<{ models: ModelDescriptionSchema[] }> {

  // get the access, assuming there's no client config and the server will do all
  const { service, vendor, transportAccess } = findServiceAccessOrThrow(serviceId);


  // [CSF] Pre-load client-side executor if needed
  let clientSideListModels: typeof import('./llm.client.direct-listModels').clientSideListModels | undefined;
  if (!!transportAccess && typeof transportAccess === 'object' && (transportAccess as any).clientSideFetch)
    try {
      clientSideListModels = (await import('./llm.client.direct-listModels')).clientSideListModels;
    } catch (error) {
      throw new Error(`Direct model listing issue: ${(error as any)?.message || 'unknown loading error'}`, { cause: error });
    }

  // fetch models
  let models: ModelDescriptionSchema[];

  // LLMs [CSM] Direct Execution
  if (clientSideListModels)
    models = await clientSideListModels(transportAccess);

  // LLMs tRPC Execution
  else
    models = (await vendor.rpcUpdateModelsOrThrow(transportAccess)).models;


  // update the global models store
  llmsStoreActions().setServiceLLMs(
    service.id,
    models.map(model => _createDLLMFromModelDescription(model, service)),
    keepUserEdits,
    false,
  );

  // figure out which vendors are actually used and useful
  hasGoogleAnalytics && sendGAEvent('event', 'app_models_updated', {
    app_models_source_id: service.id,
    app_models_source_label: service.label,
    app_models_updated_count: models.length || 0,
    app_models_vendor_id: vendor.id,
    app_models_vendor_label: vendor.name,
  });

  // return the fetched models
  return { models };
}

const _fallbackInterfaces = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];

function _createDLLMFromModelDescription(d: ModelDescriptionSchema, service: DModelsService): DLLM {

  // null means unknown context/output tokens
  const contextTokens = d.contextWindow || null;
  const maxOutputTokens = d.maxCompletionTokens || (contextTokens ? Math.round(contextTokens / 2) : null);
  const llmResponseTokensRatio = d.maxCompletionTokens ? 1 : 1 / 4;
  const llmResponseTokens = maxOutputTokens ? Math.round(maxOutputTokens * llmResponseTokensRatio) : null;

  // DLLM is a fundamental type in our application
  const dllm: DLLM = {

    // this id is Big-AGI specific, not the vendor's
    id: !d.idVariant ? `${service.id}-${d.id}`
      : `${service.id}-${d.id}-${d.idVariant}`,

    // editable properties
    label: d.label,
    created: d.created || 0,
    updated: d.updated || 0,
    description: d.description,
    hidden: !!d.hidden,

    // hard properties
    contextTokens,
    maxOutputTokens,
    trainingDataCutoff: d.trainingDataCutoff,
    interfaces: d.interfaces?.length ? d.interfaces as DModelInterfaceV1[] : _fallbackInterfaces,
    benchmark: d.benchmark,
    // pricing?: ..., // set below, since it needs some adaptation

    // parameters system (spec and initial values)
    parameterSpecs: d.parameterSpecs?.length ? d.parameterSpecs : [],
    initialParameters: {
      llmRef: d.id, // this is the vendor model id
      llmTemperature: d.interfaces.includes(LLM_IF_HOTFIX_NoTemperature) ? null : FALLBACK_LLM_PARAM_TEMPERATURE,
      llmResponseTokens: llmResponseTokens,
    },

    // references
    sId: service.id,
    vId: service.vId,

    // user edited properties: not set
    // userLabel: undefined,
    // userHidden: undefined
    // userStarred: undefined,
    // userParameters: undefined,
    // userContextTokens: undefined,
    // userMaxOutputTokens: undefined,
    // userPricing: undefined,
  };

  // set the pricing
  if (d.chatPrice && typeof d.chatPrice === 'object') {
    dllm.pricing = {
      chat: {
        ...d.chatPrice,
        // compute the free status
        _isFree: isModelPricingFree(d.chatPrice),
      },
    };
  }

  // set other params from spec's initialValues
  if (dllm.parameterSpecs?.length)
    applyModelParameterInitialValues(dllm.initialParameters, dllm.parameterSpecs, false);

  return dllm;
}
